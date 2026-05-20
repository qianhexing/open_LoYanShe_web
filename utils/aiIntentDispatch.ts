import { getLibraryList } from '@/api/library'
import { getClothesSharedList } from '@/api/wardrobe'
import type { FilterList, Library, WardrobeClothes } from '@/types/api'
import type { AiIntentAnalysisResult } from '@/types/aiAssistant'

/** 图鉴预览条数上限 */
export const AI_INTENT_LIBRARY_PREVIEW_MAX = 5

export interface AiIntentRichResult {
  analysis: AiIntentAnalysisResult
  /** 下列表预览 */
  libraries?: Library[]
  /**
   * type=0 且带 keyword 时：用户共享服饰（与 ClothesAdd 同源接口）
   */
  sharedClothes?: WardrobeClothes[]
  /** 助手气泡内简短说明 */
  hint?: string
  /**
   * type=1 相似推荐第一步：已列出候选图鉴，需用户在会话中点选一条后再调相似接口
   */
  similarRecommendAwaitPick?: boolean
}

function pickKeyword(params: Record<string, unknown>): string | null {
  const k = params.keyword ?? params.keywords ?? params.q ?? params.query
  if (typeof k === 'string' && k.trim()) return k.trim()
  return null
}

/**
 * 意图 params 里的 `filter_lists`（后端命名）或 `filter_list`，规范为列表接口所需的 `filter_list` 数组。
 */
function normalizeFilterListsFromIntentParams(
  params: Record<string, unknown>
): FilterList[] {
  const raw = params.filter_lists ?? params.filter_list
  if (!Array.isArray(raw)) return []
  const out: FilterList[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const field = o.field
    const op = o.op
    const value = o.value
    if (typeof field !== 'string' || typeof op !== 'string') continue
    if (value === undefined || value === null) continue
    if (typeof value === 'string' || typeof value === 'number') {
      out.push({ field, op, value })
      continue
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      out.push({
        field,
        op,
        value: value as Record<string, unknown>
      })
    }
  }
  return out
}

/**
 * 按后端 `type` 数值执行 UI 侧补充逻辑（拉图鉴等），与接口约定一致。
 */
export async function runAiIntentHandlers(
  result: AiIntentAnalysisResult
): Promise<AiIntentRichResult> {
  const out: AiIntentRichResult = { analysis: result }

  switch (result.type) {
    /** 加衣柜 */
    case 0: {
      const lid = result.params.library_id
      const cid = result.params.clothes_id
      const kw = pickKeyword(result.params)

      if (typeof lid === 'number' && Number.isFinite(lid)) {
        const extra =
          typeof cid === 'number' && Number.isFinite(cid)
            ? `，服饰 ID：${cid}`
            : ''
        out.hint = `已识别「加衣柜」，图鉴 ID：${lid}${extra}。（写入衣柜可按业务接入）`
        return out
      }

      if (kw) {
        try {
          const [libRes, sharedRes] = await Promise.allSettled([
            getLibraryList({
              page: 1,
              pageSize: AI_INTENT_LIBRARY_PREVIEW_MAX,
              keyword: kw
            }),
            getClothesSharedList({
              page: 1,
              pageSize: AI_INTENT_LIBRARY_PREVIEW_MAX,
              keywords: kw
            })
          ])

          if (libRes.status === 'fulfilled') {
            out.libraries = (libRes.value.rows ?? []).slice(
              0,
              AI_INTENT_LIBRARY_PREVIEW_MAX
            )
          }

          if (sharedRes.status === 'fulfilled') {
            out.sharedClothes = (sharedRes.value.rows ?? []).slice(
              0,
              AI_INTENT_LIBRARY_PREVIEW_MAX
            )
          } else {
            out.sharedClothes = []
          }

          const libN = out.libraries?.length ?? 0
          const shN = out.sharedClothes?.length ?? 0
          if (libN === 0 && shN === 0) {
            out.hint = `「加衣柜」未找到与「${kw}」匹配的图鉴或共享服饰，请换一种说法试试。`
          } else if (libN === 0 && shN > 0) {
            out.hint = `「加衣柜」关键词「${kw}」：未匹配到图鉴。以下为用户共享服饰，点击将触发加衣柜（能力接入中）。`
          } else if (libN > 0 && shN === 0) {
            out.hint = `「加衣柜」关键词「${kw}」：横向滑动查看图鉴候选；点击卡片将触发加衣柜（能力接入中）。未匹配到共享服饰。`
          } else {
            out.hint = `「加衣柜」关键词「${kw}」：横向滑动查看图鉴与下方共享服饰；点击任意卡片将触发加衣柜（能力接入中）。`
          }
        } catch {
          out.hint = `「加衣柜」与「${kw}」相关的数据加载失败，请稍后重试。`
          out.sharedClothes = []
        }
        return out
      }

      out.hint =
        '「加衣柜」；请在 params 中提供 keyword，或 library_id / clothes_id。'
      return out
    }

    /** 相似推荐：先按 keyword 搜图鉴供选择，选后由页面调 /library/similar */
    case 1: {
      const kw = pickKeyword(result.params)
      if (!kw) {
        out.hint = '相似推荐需要在 params 中提供 keyword。'
        return out
      }
      try {
        const data = await getLibraryList({
          page: 1,
          pageSize: AI_INTENT_LIBRARY_PREVIEW_MAX,
          keyword: kw
        })
        const rows = (data.rows ?? []).slice(0, AI_INTENT_LIBRARY_PREVIEW_MAX)
        out.libraries = rows
        out.similarRecommendAwaitPick = rows.length > 0
        if (rows.length === 0) {
          out.hint = `相似推荐：未找到与「${kw}」匹配的图鉴，请换关键词或通过其它方式指定裙子。`
        } else {
          out.hint =
            '请问是下面哪一条裙子呢？可左右滑动查看，点击卡片即可作为相似推荐基准。'
        }
      } catch {
        out.hint = '相似推荐：图鉴搜索失败，请稍后重试。'
      }
      return out
    }

    /** 查裙子信息：按 params.filter_lists（或 filter_list）调用图鉴列表 */
    case 2: {
      const filterList = normalizeFilterListsFromIntentParams(result.params)
      const kw = pickKeyword(result.params)
      if (filterList.length === 0 && !kw) {
        out.hint =
          '「查裙子信息」需要在 params 中提供 filter_lists（或 filter_list），或补充 keyword。'
        return out
      }
      try {
        const data = await getLibraryList({
          page: 1,
          pageSize: AI_INTENT_LIBRARY_PREVIEW_MAX,
          ...(kw ? { keyword: kw } : { keyword: null}),
          filter_list: filterList,
          need_Statistics: true
        })
        const rows = (data.rows ?? []).slice(0, AI_INTENT_LIBRARY_PREVIEW_MAX)
        out.libraries = rows
        if (rows.length === 0) {
          out.hint =
            '按当前筛选条件未找到匹配的图鉴，可放宽价格区间或换一种说法试试。'
        } else {
          out.hint =
            '已根据筛选条件列出下列裙子（可左右滑动，点击卡片查看详情）。'
        }
      } catch {
        out.hint = '查裙子信息：图鉴列表加载失败，请稍后重试。'
      }
      return out
    }

    /** 未能理解意图 */
    case -1: {
      const backendMsg =
        typeof result.params.msg === 'string'
          ? result.params.msg
          : typeof result.params.message === 'string'
            ? result.params.message
            : ''
      const trimmed = backendMsg.trim()
      out.hint = trimmed.length
        ? trimmed
        : '暂时没能理解这句话，请换种说法或补充服饰/图鉴相关信息。'
      return out
    }

    default: {
      out.hint = `意图 type=${result.type}，当前暂未做专项处理；可查看明细中的 params。`
      return out
    }
  }
}
