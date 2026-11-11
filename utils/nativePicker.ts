/**
 * Web ↔ iOS / Android 原生选图（图片 / Live / 视频）
 * 上行 openNativePicker → 下行 nativePickerResult，通道 LoYanSheBridge。
 */
import {
  postIosBridge,
  isIosWebview,
  hasIosNativeBridge,
  isAndroidWebview,
  hasAndroidNativeBridge,
} from '@/utils/nativeShell'
import { LIVE_MAX_DURATION_SEC } from '@/utils/livePhotoUpload'
import { uploadImageOSS, uploadPairedLiveToOSS } from '@/utils/ossUpload'

export type NativePickerTab = 'image' | 'video'

export type NativePickerOpenOptions = {
  requestId?: string
  selectionLimit?: number
  initialTab?: NativePickerTab
  allowLive?: boolean
  maxLiveDurationSec?: number
}

export type NativePickerItemKind = 'image' | 'live' | 'video'

export type NativePickerItem = {
  kind: NativePickerItemKind
  mime?: string
  fileName?: string
  base64?: string
  byteLength?: number
  width?: number
  height?: number
  duration?: number
  /** Live 配对视频 */
  videoMime?: string
  videoFileName?: string
  videoBase64?: string
  videoByteLength?: number
  /** 视频 Tab 封面（可选） */
  posterBase64?: string
  posterMime?: string
  assetLocalIdentifier?: string
}

export type NativePickerResultParams = {
  requestId: string
  cancelled?: boolean
  error?: string
  items?: NativePickerItem[]
}

export type NativePickerPreviewEntry =
  | {
      kind: 'image'
      file: File
      previewUrl: string
      width?: number
      height?: number
    }
  | {
      kind: 'live'
      posterFile: File
      videoFile: File
      previewUrl: string
      videoUrl: string
      duration?: number
      width?: number
      height?: number
    }
  | {
      kind: 'video'
      file: File
      posterFile: File | null
      previewUrl: string
      videoUrl: string
      duration?: number
    }

type NativePickerResultMessage = {
  type: string
  params?: NativePickerResultParams & Record<string, unknown>
}

const STORAGE_SUPPORTED = 'native_picker'
const STORAGE_UNSUPPORTED = 'native_picker_unsupported'
/** 旧版有桥但无 openNativePicker：等 opened/result 的最长毫秒，超时回退 input */
const NATIVE_PICKER_ACK_MS = 1000

const pendingPickers = new Map<
  string,
  (result: NativePickerResultParams) => void
>()
/** 原生已拉起相册后的回调（取消 ack 超时） */
const pendingAcks = new Map<string, () => void>()

let listenersInstalled = false

function newRequestId(): string {
  return `pick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function parseNativeMsg(raw: unknown): NativePickerResultMessage | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as NativePickerResultMessage
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as NativePickerResultMessage
  } catch {
    return null
  }
}

function readStorageFlag(key: string): boolean {
  if (!import.meta.client || typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeStorageFlag(key: string, on: boolean): void {
  if (!import.meta.client || typeof sessionStorage === 'undefined') return
  try {
    if (on) sessionStorage.setItem(key, '1')
    else sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** 本会话已确认原生支持选图（能力声明或曾成功 opened/result） */
export function markNativePickerSupported(): void {
  writeStorageFlag(STORAGE_SUPPORTED, true)
  writeStorageFlag(STORAGE_UNSUPPORTED, false)
  if (typeof window !== 'undefined') {
    ;(window as Window & { __loNativePicker?: boolean }).__loNativePicker = true
  }
}

/** 本会话确认无选图事件（旧版桥）：后续直接走 input，不再空等 */
export function markNativePickerUnsupported(): void {
  writeStorageFlag(STORAGE_UNSUPPORTED, true)
  writeStorageFlag(STORAGE_SUPPORTED, false)
}

export function isNativePickerMarkedUnsupported(): boolean {
  return readStorageFlag(STORAGE_UNSUPPORTED)
}

/** 原生已声明支持，或本会话验证过 */
export function hasNativePickerCapability(): boolean {
  if (isNativePickerMarkedUnsupported()) return false
  if (readStorageFlag(STORAGE_SUPPORTED)) return true
  if (!import.meta.client || typeof window === 'undefined') return false
  return (window as Window & { __loNativePicker?: boolean }).__loNativePicker === true
}

function hasPickerBridge(): boolean {
  return hasIosNativeBridge() || hasAndroidNativeBridge()
}

/**
 * 是否走原生相册。
 *
 * 必须「桥 + 能力声明」同时满足。旧版 iOS 也有 LoYanSheBridge，但无 openNativePicker，
 * 若仅凭有桥就异步等回包，超时后再 input.click() 会丢掉用户手势，系统相册也弹不出。
 * 故未声明能力时直接 false，由 ImagePicker 同步走 input。
 *
 * 新版声明方式（任一即可）：
 * - 下行 `{ type: 'setCapabilities', params: { nativePicker: true } }`
 * - 下行 `{ type: 'nativePickerReady' }`
 * - `sessionStorage.native_picker = '1'` / `window.__loNativePicker = true`
 * - URL `?nativePicker=1`
 */
export function canUseNativePicker(): boolean {
  if (!import.meta.client) return false
  if (isNativePickerMarkedUnsupported()) return false
  if (!hasNativePickerCapability()) return false
  if (hasPickerBridge()) return true
  return isIosWebview() || isAndroidWebview()
}

export function onNativePickerOpened(msg: NativePickerResultMessage | null): boolean {
  if (!msg || msg.type !== 'nativePickerOpened') return false
  const id = msg.params?.requestId
  if (!id || typeof id !== 'string') return false
  const ack = pendingAcks.get(id)
  if (!ack) return false
  pendingAcks.delete(id)
  markNativePickerSupported()
  ack()
  return true
}

export function onNativePickerResult(msg: NativePickerResultMessage | null): boolean {
  if (!msg || msg.type !== 'nativePickerResult') return false
  const p = msg.params
  if (!p?.requestId) return false
  // result 也视为已打开，取消 ack 超时
  const ack = pendingAcks.get(p.requestId)
  if (ack) {
    pendingAcks.delete(p.requestId)
    ack()
  }
  const cb = pendingPickers.get(p.requestId)
  if (!cb) return false
  pendingPickers.delete(p.requestId)
  markNativePickerSupported()
  cb(p)
  return true
}

/** 解析 setCapabilities / nativePickerReady */
export function onNativePickerCapabilityMessage(
  msg: NativePickerResultMessage | null,
): boolean {
  if (!msg) return false
  if (msg.type === 'nativePickerReady') {
    markNativePickerSupported()
    return true
  }
  if (msg.type !== 'setCapabilities') return false
  const p = msg.params || {}
  const flag =
    p.nativePicker === true ||
    p.native_picker === true ||
    p.openNativePicker === true
  if (flag) {
    markNativePickerSupported()
    return true
  }
  return false
}

/** 供 installWkStyleNativeBridge / loyanshe-native 统一转发 */
export function handleNativePickerInbound(raw: unknown): boolean {
  const msg = parseNativeMsg(raw)
  if (!msg) return false
  if (onNativePickerCapabilityMessage(msg)) return true
  if (onNativePickerOpened(msg)) return true
  if (onNativePickerResult(msg)) return true
  return false
}

/**
 * 挂下行监听：订阅 `loyanshe-native`（由 installWkStyleNativeBridge 派发）。
 * 若桥尚未安装，再包一层 `__loOnNativeMessage` 兜底（安装后桥会覆盖并继续派发事件）。
 * 多次调用幂等。
 */
function applyNativePickerQueryFlag(): void {
  if (typeof window === 'undefined') return
  try {
    const q = new URLSearchParams(window.location.search)
    const v = q.get('nativePicker') ?? q.get('native_picker')
    if (v === '1' || v === 'true') markNativePickerSupported()
  } catch {
    /* ignore */
  }
}

export function ensureNativePickerListeners(): void {
  if (!import.meta.client || typeof window === 'undefined') return
  applyNativePickerQueryFlag()
  if (listenersInstalled) return
  listenersInstalled = true

  window.addEventListener('loyanshe-native', ((e: CustomEvent<unknown>) => {
    handleNativePickerInbound(e.detail)
  }) as EventListener)

  const win = window as Window & {
    __loOnNativeMessage?: (payload: string) => void
  }
  if (typeof win.__loOnNativeMessage !== 'function') {
    win.__loOnNativeMessage = (raw: string) => {
      try {
        window.dispatchEvent(
          new CustomEvent('loyanshe-native', { detail: raw }),
        )
      } catch {
        handleNativePickerInbound(raw)
      }
    }
  }
}

export type OpenNativePickerResult = {
  requestId: string
  /** false：桥未挂上 / post 失败，调用方应立刻回退 input */
  posted: boolean
}

export function openNativePicker(
  opts: NativePickerOpenOptions = {},
): OpenNativePickerResult {
  ensureNativePickerListeners()
  const requestId = opts.requestId || newRequestId()
  const posted = postIosBridge({
    type: 'openNativePicker',
    params: {
      requestId,
      selectionLimit: opts.selectionLimit ?? 9,
      initialTab: opts.initialTab ?? 'image',
      allowLive: opts.allowLive ?? true,
      maxLiveDurationSec: opts.maxLiveDurationSec ?? LIVE_MAX_DURATION_SEC,
    },
  })
  if (!posted) {
    console.warn('[nativePicker] 无 LoYanSheBridge，回退 <input type=file>')
  }
  return { requestId, posted }
}

export type PickFromNativeOutcome =
  | { ok: true; result: NativePickerResultParams }
  /** 无桥 / post 失败 / 旧版无选图事件：业务应回退系统文件选择 */
  | { ok: false; reason: 'no_bridge' | 'unsupported' }

/**
 * 打开并等待回包。
 * - post 失败 → 立刻 no_bridge
 * - 旧版有桥但无事件：等 {@link NATIVE_PICKER_ACK_MS} 内无 `nativePickerOpened` /
 *   `nativePickerResult` → unsupported，并标记本会话，后续不再空等
 * - 已声明能力或已收到 opened：一直等到 result
 */
export function pickFromNative(
  opts: NativePickerOpenOptions = {},
): Promise<PickFromNativeOutcome> {
  if (isNativePickerMarkedUnsupported()) {
    return Promise.resolve({ ok: false, reason: 'unsupported' })
  }

  const { requestId, posted } = openNativePicker(opts)
  if (!posted) {
    return Promise.resolve({ ok: false, reason: 'no_bridge' })
  }

  return new Promise((resolve) => {
    let settled = false
    let ackTimer: ReturnType<typeof setTimeout> | null = null

    const finish = (outcome: PickFromNativeOutcome) => {
      if (settled) return
      settled = true
      if (ackTimer != null) {
        clearTimeout(ackTimer)
        ackTimer = null
      }
      pendingAcks.delete(requestId)
      pendingPickers.delete(requestId)
      resolve(outcome)
    }

    pendingPickers.set(requestId, (result) => {
      finish({ ok: true, result })
    })

    const clearAckWait = () => {
      if (ackTimer != null) {
        clearTimeout(ackTimer)
        ackTimer = null
      }
      pendingAcks.delete(requestId)
    }

    // 已确认支持：不必短超时（用户可能在相册里选很久）
    if (hasNativePickerCapability()) {
      pendingAcks.set(requestId, clearAckWait)
      return
    }

    // 未知是否支持：短等 opened/result；旧版无事件则回退 input
    pendingAcks.set(requestId, clearAckWait)
    ackTimer = setTimeout(() => {
      console.warn(
        '[nativePicker] 未收到 nativePickerOpened/Result，疑似旧版无选图事件，回退 input',
      )
      markNativePickerUnsupported()
      finish({ ok: false, reason: 'unsupported' })
    }, NATIVE_PICKER_ACK_MS)
  })
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function base64ToFile(
  b64: string,
  fileName: string,
  mime?: string,
): File {
  const bytes = base64ToUint8Array(b64)
  return new File([bytes], fileName || 'file.bin', {
    type: mime || 'application/octet-stream',
  })
}

/** 单条 item → 可上传 File + 预览 objectURL */
export function itemToPreviewable(
  item: NativePickerItem,
): NativePickerPreviewEntry | null {
  if (item.kind === 'image') {
    if (!item.base64) return null
    const file = base64ToFile(
      item.base64,
      item.fileName || `image_${Date.now()}.jpg`,
      item.mime || 'image/jpeg',
    )
    return {
      kind: 'image',
      file,
      previewUrl: URL.createObjectURL(file),
      width: item.width,
      height: item.height,
    }
  }

  if (item.kind === 'live') {
    if (!item.base64 || !item.videoBase64) return null
    const poster = base64ToFile(
      item.base64,
      item.fileName || `live_${Date.now()}.jpg`,
      item.mime || 'image/jpeg',
    )
    const video = base64ToFile(
      item.videoBase64,
      item.videoFileName || `live_${Date.now()}.mp4`,
      item.videoMime || 'video/mp4',
    )
    return {
      kind: 'live',
      posterFile: poster,
      videoFile: video,
      previewUrl: URL.createObjectURL(poster),
      videoUrl: URL.createObjectURL(video),
      duration: item.duration,
      width: item.width,
      height: item.height,
    }
  }

  if (item.kind === 'video') {
    if (!item.base64) return null
    const file = base64ToFile(
      item.base64,
      item.fileName || `video_${Date.now()}.mp4`,
      item.mime || 'video/mp4',
    )
    const poster = item.posterBase64
      ? base64ToFile(
          item.posterBase64,
          `poster_${item.fileName || Date.now()}.jpg`,
          item.posterMime || 'image/jpeg',
        )
      : null
    return {
      kind: 'video',
      file,
      posterFile: poster,
      previewUrl: poster
        ? URL.createObjectURL(poster)
        : URL.createObjectURL(file),
      videoUrl: URL.createObjectURL(file),
      duration: item.duration,
    }
  }

  return null
}

export function itemsToPreviewable(
  items: NativePickerItem[] | undefined,
): NativePickerPreviewEntry[] {
  if (!items?.length) return []
  return items.map(itemToPreviewable).filter((e): e is NativePickerPreviewEntry => e != null)
}

export function revokeNativePreviewEntry(entry: NativePickerPreviewEntry): void {
  if (entry.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(entry.previewUrl)
  if ('videoUrl' in entry && entry.videoUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(entry.videoUrl)
  }
}

export function revokeNativePreviewEntries(
  entries: NativePickerPreviewEntry[],
): void {
  entries.forEach(revokeNativePreviewEntry)
}

/** 静帧 → 现有 uploadImageOSS */
export async function uploadImageEntry(
  entry: Extract<NativePickerPreviewEntry, { kind: 'image' }>,
  uploadImageFile: (file: File) => Promise<string> = uploadImageOSS,
): Promise<string> {
  return uploadImageFile(entry.file)
}

/** Live：封面 + 配对视频，返回视频相对路径 */
export async function uploadLiveEntry(
  entry: Extract<NativePickerPreviewEntry, { kind: 'live' }>,
  uploadPairedLive: (
    videoFile: File,
    posterFile: File,
  ) => Promise<string> = uploadPairedLiveToOSS,
): Promise<string> {
  return uploadPairedLive(entry.videoFile, entry.posterFile)
}

/** 视频 Tab：有封面时按 Live 成对上传；否则仅传视频 File 给自定义 uploader */
export async function uploadVideoEntry(
  entry: Extract<NativePickerPreviewEntry, { kind: 'video' }>,
  uploadVideoFile: (file: File) => Promise<string>,
): Promise<string> {
  if (entry.posterFile) {
    return uploadPairedLiveToOSS(entry.file, entry.posterFile)
  }
  return uploadVideoFile(entry.file)
}

/** 串行上传，返回逗号拼接相对路径（对齐 img_list） */
export async function uploadNativeEntries(
  entries: NativePickerPreviewEntry[],
  apis: {
    uploadImageFile?: (file: File) => Promise<string>
    uploadPairedLive?: (videoFile: File, posterFile: File) => Promise<string>
    uploadVideoFile?: (file: File) => Promise<string>
  } = {},
): Promise<string> {
  const paths: string[] = []
  for (const e of entries) {
    if (e.kind === 'image') {
      paths.push(await uploadImageEntry(e, apis.uploadImageFile))
    } else if (e.kind === 'live') {
      paths.push(
        await uploadLiveEntry(
          e,
          apis.uploadPairedLive ?? uploadPairedLiveToOSS,
        ),
      )
    } else if (e.kind === 'video') {
      if (apis.uploadVideoFile) {
        paths.push(await uploadVideoEntry(e, apis.uploadVideoFile))
      } else if (e.posterFile) {
        paths.push(await uploadPairedLiveToOSS(e.file, e.posterFile))
      }
    }
  }
  return paths.filter(Boolean).join(',')
}
