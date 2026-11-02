/** 选短视频模拟实况：校验时长并抽一帧作封面 */

import { extractEmbeddedLiveVideo } from '@/utils/livePhotoExtract'

export const LIVE_MAX_DURATION_SEC = 8

const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|qt)$/i
const HEIC_FTYP_RE = /hei[cf]|mif1|msf1|heim|heis|avif|avis/i

export function isLiveVideoFile(file: File): boolean {
  if (file.type?.startsWith('video/')) return true
  return VIDEO_EXT_RE.test(file.name)
}

/** 扩展名/MIME 缺失时按文件头判断（iOS/微信 WebView 常见） */
export async function sniffVideoFile(file: Blob): Promise<boolean> {
  try {
    const buf = await file.slice(0, 64).arrayBuffer()
    const u8 = new Uint8Array(buf)
    if (u8.length < 12) return false
    // WebM EBML
    if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return true
    const ftyp = String.fromCharCode(u8[4], u8[5], u8[6], u8[7])
    if (ftyp !== 'ftyp') return false
    const brands = String.fromCharCode(...u8.slice(8, Math.min(u8.length, 48)))
    if (HEIC_FTYP_RE.test(brands)) return false
    return true
  } catch {
    return false
  }
}

export async function isLikelyLiveVideoFile(file: File): Promise<boolean> {
  if (isLiveVideoFile(file)) return true
  // iOS 实况常带 image/heic、image/jpeg，不能只看 MIME
  return sniffVideoFile(file)
}

function waitForMediaEvent(
  el: HTMLMediaElement,
  event: string,
  timeoutMs = 8000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('读取视频超时'))
    }, timeoutMs)
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('无法读取该视频'))
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      el.removeEventListener(event, onOk)
      el.removeEventListener('error', onErr)
    }
    el.addEventListener(event, onOk, { once: true })
    el.addEventListener('error', onErr, { once: true })
  })
}

function isFiniteDuration(d: number): boolean {
  return Number.isFinite(d) && d > 0 && d < 1e6
}

/** iOS Safari 常把 duration 报成 Infinity，seek 到极大值后才会算出真实时长 */
async function resolveVideoDuration(video: HTMLVideoElement): Promise<number> {
  if (isFiniteDuration(video.duration)) return video.duration

  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.removeEventListener('durationchange', onTick)
      video.removeEventListener('timeupdate', onTick)
      video.removeEventListener('seeked', onTick)
      resolve()
    }
    const onTick = () => {
      if (isFiniteDuration(video.duration)) done()
    }
    const timer = window.setTimeout(done, 4000)
    video.addEventListener('durationchange', onTick)
    video.addEventListener('timeupdate', onTick)
    video.addEventListener('seeked', onTick)
    try {
      video.currentTime = 1e101
    } catch {
      done()
    }
  })

  if (isFiniteDuration(video.duration)) {
    try {
      video.currentTime = 0
    } catch {
      /* ignore */
    }
    return video.duration
  }
  return video.duration
}

function posterFileName(file: File): string {
  const base = (file.name || 'live').replace(/\.[^.]+$/, '') || 'live'
  return `${base}.jpg`
}

export function liveDurationExceededMessage(duration: number): string {
  return `实况图请选择 ${LIVE_MAX_DURATION_SEC} 秒以内的视频（当前约 ${duration.toFixed(1)} 秒）`
}

export interface LiveVideoProcessOk {
  ok: true
  videoFile: File
  posterFile: File
  duration: number
}

export interface LiveVideoProcessFail {
  ok: false
  error: string
  reason?: 'duration' | 'format' | 'decode'
}

export type LiveVideoProcessResult = LiveVideoProcessOk | LiveVideoProcessFail

function durationFail(duration: number): LiveVideoProcessFail {
  return {
    ok: false,
    reason: 'duration',
    error: liveDurationExceededMessage(duration),
  }
}

/**
 * 读取视频时长并抽封面。超 8 秒在拿到 metadata 后立刻返回，不等抽帧。
 */
export async function processLiveVideoFile(file: File): Promise<LiveVideoProcessResult> {
  let source = file
  const likelyVideo = isLiveVideoFile(file) || (await sniffVideoFile(file))
  if (!likelyVideo) {
    const embedded = await extractEmbeddedLiveVideo(file)
    if (!embedded) {
      return { ok: false, reason: 'format', error: '请选择视频文件作为实况图' }
    }
    source = embedded.videoFile
  }

  const objectUrl = URL.createObjectURL(source)
  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.preload = 'auto'
  video.controls = false
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.setAttribute('muted', '')
  // iOS / 部分 WebView：脱离 DOM 的 video 往往不解码
  video.style.cssText =
    'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;'
  document.body.appendChild(video)
  video.src = objectUrl
  try {
    video.load()
  } catch {
    /* ignore */
  }

  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await waitForMediaEvent(video, 'loadedmetadata')
    }
    const duration = await resolveVideoDuration(video)
    if (!isFiniteDuration(duration)) {
      return { ok: false, reason: 'decode', error: '无法读取视频时长' }
    }
    if (duration > LIVE_MAX_DURATION_SEC + 0.2) {
      return durationFail(duration)
    }

    // 部分手机需要先 play 才有画面尺寸
    if (!video.videoWidth || !video.videoHeight) {
      try {
        const playing = waitForMediaEvent(video, 'playing', 4000)
        await video.play()
        await playing
        video.pause()
      } catch {
        /* ignore */
      }
    }

    const seekTo = Math.min(0.15, Math.max(0.05, duration * 0.1))
    if (Math.abs(video.currentTime - seekTo) > 0.02) {
      const seeked = waitForMediaEvent(video, 'seeked', 6000)
      video.currentTime = seekTo
      await seeked
    }

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      return { ok: false, reason: 'decode', error: '无法读取视频画面' }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { ok: false, reason: 'decode', error: '当前环境无法抽帧' }
    }
    ctx.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    })
    if (!blob || blob.size <= 0) {
      return { ok: false, reason: 'decode', error: '抽帧失败，请换一段视频' }
    }

    return {
      ok: true,
      videoFile: source,
      posterFile: new File([blob], posterFileName(file), { type: 'image/jpeg' }),
      duration,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '无法处理该视频'
    return { ok: false, reason: 'decode', error: message }
  } finally {
    video.pause()
    video.removeAttribute('src')
    try {
      video.load()
    } catch {
      /* ignore */
    }
    video.remove()
    URL.revokeObjectURL(objectUrl)
  }
}
