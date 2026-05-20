import { storeToRefs } from 'pinia'
import { use$Post } from '@/composables/httpCore'
import { useUserStore } from '@/stores/user'
import { BASE_URL } from '@/utils/ipConfig'
import type { BaseResponse } from '@/types/api'
import type { AiIntentAnalysisResult } from '@/types/aiAssistant'

export interface PostAiIntentAnalysisBody {
  text: string
}

/**
 * `/intent/analyze` 成功后 `data`：`{ type, params }`，与后端字段一致。
 */
export interface AiIntentAnalyzeApiData {
  type: number
  params?: Record<string, unknown>
}

function coerceType(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
    return Number(v)
  return null
}

function normalizeParams(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  return { ...(obj as Record<string, unknown>) }
}

/** 将接口 data 规范为 AiIntentAnalysisResult，不改动 type / params 语义 */
function asIntentResult(data: unknown): AiIntentAnalysisResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('分析接口返回格式无效')
  }
  const body = data as Record<string, unknown>
  const t = coerceType(body.type)
  if (t === null) throw new Error('分析接口缺少有效的 type')
  return {
    type: t,
    params: normalizeParams(body.params)
  }
}

/**
 * 分析用户自然语言意图。
 * POST `/intent/analyze`，body: `{ text }`
 */
export async function postAiIntentAnalysis(
  body: PostAiIntentAnalysisBody
): Promise<AiIntentAnalysisResult> {
  const text = body.text.trim()
  const response = await use$Post<BaseResponse<AiIntentAnalyzeApiData>>(
    '/intent/analyze',
    { text }
  )
  return asIntentResult(response.data)
}

/** 流式回调：与后端 SSE `event` 对齐 */
export interface StreamAiIntentAnalysisCallbacks {
  onReasoningDelta?: (delta: string) => void
  onContentDelta?: (delta: string) => void
}

function sseAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream'
  }
  if (typeof window !== 'undefined') {
    try {
      const { token } = storeToRefs(useUserStore())
      headers.Authorization = `${token.value}`
    } catch {
      /* 无 Pinia 上下文时忽略 */
    }
  }
  return headers
}

function parseSseBlock(block: string): { event: string; dataRaw: string } | null {
  const lines = block.split('\n')
  let event = 'message'
  const dataParts: string[] = []
  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (trimmed.startsWith('event:')) {
      event = trimmed.slice(6).trim() || event
    } else if (trimmed.startsWith('data:')) {
      dataParts.push(trimmed.replace(/^data:\s*/, ''))
    }
  }
  if (dataParts.length === 0) return null
  return { event, dataRaw: dataParts.join('\n').trim() }
}

function readDelta(obj: unknown): string {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ''
  const d = (obj as Record<string, unknown>).delta
  return typeof d === 'string' ? d : ''
}

/**
 * POST `/intent/analyze/stream`，body `{ text }`，SSE：`reasoning` | `content` | `done` | `error`。
 * `done` 的 payload 中 `data` 与 `/intent/analyze` 的 `response.data` 一致。
 */
export async function streamAiIntentAnalysis(
  body: PostAiIntentAnalysisBody,
  callbacks?: StreamAiIntentAnalysisCallbacks,
  init?: { signal?: AbortSignal }
): Promise<AiIntentAnalysisResult> {
  const text = body.text.trim()
  const res = await fetch(`${BASE_URL}/intent/analyze/stream`, {
    method: 'POST',
    headers: sseAuthHeaders(),
    body: JSON.stringify({ text }),
    signal: init?.signal
  })

  if (res.status === 401 && typeof window !== 'undefined') {
    try {
      useUserStore().clearToken()
    } catch {
      window.location.reload()
    }
    throw new Error('登录已失效，请重新登录')
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `意图流式分析失败（HTTP ${res.status}）`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('无法读取流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: AiIntentAnalysisResult | null = null

  function dispatchSseParsed(parsed: { event: string; dataRaw: string }) {
    const { event, dataRaw } = parsed
    if (event === 'reasoning') {
      try {
        const delta = readDelta(JSON.parse(dataRaw) as unknown)
        if (delta) callbacks?.onReasoningDelta?.(delta)
      } catch {
        /* 忽略单行损坏 */
      }
    } else if (event === 'content') {
      try {
        const delta = readDelta(JSON.parse(dataRaw) as unknown)
        if (delta) callbacks?.onContentDelta?.(delta)
      } catch {
        /* 忽略单行损坏 */
      }
    } else if (event === 'done') {
      try {
        const wrap = JSON.parse(dataRaw) as Record<string, unknown>
        if (wrap.data !== undefined) {
          finalResult = asIntentResult(wrap.data)
        }
      } catch {
        throw new Error('意图分析结束包格式无效')
      }
    } else if (event === 'error') {
      let code = 500
      let msg = '意图分析失败'
      try {
        const errObj = JSON.parse(dataRaw) as Record<string, unknown>
        const c = errObj.code
        if (typeof c === 'number' && Number.isFinite(c)) code = c
        const m = errObj.msg
        if (typeof m === 'string' && m.trim()) msg = m
      } catch {
        /* 使用默认 */
      }
      throw new Error(`${code !== 500 ? `[${code}] ` : ''}${msg}`)
    }
  }

  function drainBuffer() {
    for (;;) {
      const idx = buffer.indexOf('\n\n')
      if (idx === -1) break
      const rawBlock = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const parsed = parseSseBlock(rawBlock)
      if (parsed) dispatchSseParsed(parsed)
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      drainBuffer()
    }
    buffer += decoder.decode()
    drainBuffer()
    const tail = buffer.trim()
    if (tail) {
      const parsed = parseSseBlock(tail)
      if (parsed) dispatchSseParsed(parsed)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* 已释放或不可释放 */
    }
  }

  if (!finalResult) {
    throw new Error('流式意图分析未返回有效结果')
  }
  return finalResult
}
