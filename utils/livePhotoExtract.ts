/** 从 iOS 实况 / 安卓动态照片 / .livp 包里拆出短视频 */

const VIDEO_BRANDS = new Set([
  'qt',
  'mp41',
  'mp42',
  'isom',
  'iso2',
  'iso5',
  'iso6',
  'avc1',
  'm4v',
  'dash',
  '3gp4',
  '3gp5',
])
const IMAGE_BRAND_RE = /hei[cf]|heix|mif1|msf1|heim|heis|avif|avis/i
const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|qt)$/i
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i
const PACK_EXT_RE = /\.(livp|pvt|zip)$/i

function readFourCC(u8: Uint8Array, offset: number): string {
  if (offset + 4 > u8.length) return ''
  return String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3])
}

function readUint32BE(u8: Uint8Array, offset: number): number {
  if (offset + 4 > u8.length) return 0
  return (
    ((u8[offset] << 24) | (u8[offset + 1] << 16) | (u8[offset + 2] << 8) | u8[offset + 3])
    >>> 0
  )
}

function readUint32LE(u8: Uint8Array, offset: number): number {
  if (offset + 4 > u8.length) return 0
  return (
    (u8[offset] | (u8[offset + 1] << 8) | (u8[offset + 2] << 16) | (u8[offset + 3] << 24))
    >>> 0
  )
}

function isVideoBrand(brand: string): boolean {
  return VIDEO_BRANDS.has(brand.trim().toLowerCase())
}

function looksLikeVideoFtyp(u8: Uint8Array, start: number): boolean {
  if (start < 0 || start + 16 > u8.length) return false
  if (readFourCC(u8, start + 4) !== 'ftyp') return false
  const size = readUint32BE(u8, start)
  if (size < 16 || size > 256) return false
  const brand = readFourCC(u8, start + 8)
  if (IMAGE_BRAND_RE.test(brand)) return false
  return isVideoBrand(brand) || brand.trim() === 'qt'
}

function parseMotionPhotoOffsetFromEnd(u8: Uint8Array): number | null {
  const head = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(u8.length, 256 * 1024)))
  const micro = head.match(/MicroVideoOffset["'\s:=]+(\d+)/i)
  if (micro) {
    const n = Number(micro[1])
    if (Number.isFinite(n) && n > 64 && n < u8.length - 16) return u8.length - n
  }
  const lengths = [...head.matchAll(/Item:Length["'\s:=]+(\d+)/gi)].map((m) => Number(m[1]))
  const last = lengths.filter((n) => Number.isFinite(n) && n > 64 && n < u8.length - 16).pop()
  if (last) return u8.length - last
  return null
}

function findEmbeddedVideoStart(u8: Uint8Array): number {
  const xmpStart = parseMotionPhotoOffsetFromEnd(u8)
  if (xmpStart != null && looksLikeVideoFtyp(u8, xmpStart)) return xmpStart

  // 视频一般在后半段，从后往前找第二个 ftyp（跳过文件头自己的 heic/jpeg）
  const minStart = u8[0] === 0xff && u8[1] === 0xd8 ? 2 : 32
  for (let i = u8.length - 16; i >= minStart; i--) {
    if (
      u8[i + 4] === 0x66 &&
      u8[i + 5] === 0x74 &&
      u8[i + 6] === 0x79 &&
      u8[i + 7] === 0x70 &&
      looksLikeVideoFtyp(u8, i)
    ) {
      return i
    }
  }
  return -1
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('no inflate')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

async function readZipEntries(u8: Uint8Array): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = []
  let offset = 0
  while (offset + 30 < u8.length) {
    if (u8[offset] !== 0x50 || u8[offset + 1] !== 0x4b) break
    if (u8[offset + 2] !== 0x03 || u8[offset + 3] !== 0x04) break
    const method = u8[offset + 8] | (u8[offset + 9] << 8)
    const compSize = readUint32LE(u8, offset + 18)
    const nameLen = u8[offset + 26] | (u8[offset + 27] << 8)
    const extraLen = u8[offset + 28] | (u8[offset + 29] << 8)
    const nameStart = offset + 30
    const name = new TextDecoder().decode(u8.subarray(nameStart, nameStart + nameLen))
    const dataStart = nameStart + nameLen + extraLen
    const comp = u8.subarray(dataStart, dataStart + compSize)
    let data = comp
    if (method === 8) data = await inflateRaw(comp)
    else if (method !== 0) {
      offset = dataStart + compSize
      continue
    }
    entries.push({ name, data })
    offset = dataStart + compSize
  }
  return entries
}

function fileFromBytes(data: Uint8Array, name: string, type: string): File {
  return new File([data], name, { type })
}

function guessVideoType(name: string): string {
  return /\.mov$/i.test(name) ? 'video/quicktime' : 'video/mp4'
}

function guessImageType(name: string): string {
  if (/\.hei[cf]$/i.test(name)) return 'image/heic'
  if (/\.png$/i.test(name)) return 'image/png'
  return 'image/jpeg'
}

async function extractFromZipPackage(file: File, u8: Uint8Array): Promise<EmbeddedLiveExtract | null> {
  try {
    const entries = await readZipEntries(u8)
    const video = entries.find((e) => VIDEO_EXT_RE.test(e.name))
    if (!video || video.data.length < 64) return null
    const photo = entries.find((e) => IMAGE_EXT_RE.test(e.name))
    const base = (file.name || 'live').replace(/\.[^.]+$/, '') || 'live'
    return {
      videoFile: fileFromBytes(video.data, `${base}.mp4`, guessVideoType(video.name)),
      posterFile: photo
        ? fileFromBytes(photo.data, `${base}${photo.name.slice(photo.name.lastIndexOf('.')) || '.jpg'}`, guessImageType(photo.name))
        : undefined,
    }
  } catch {
    return null
  }
}

export interface EmbeddedLiveExtract {
  videoFile: File
  posterFile?: File
}

export function isLivePackageName(file: File): boolean {
  return PACK_EXT_RE.test(file.name)
}

/**
 * 从静图/实况包中拆出配套短视频。
 * 覆盖：JPEG/HEIC 后拼接 MOV、安卓 Motion Photo、.livp/.pvt zip。
 * 普通 iOS 相册只给 HEIC 静图时返回 null。
 */
export function mightContainEmbeddedLive(file: File): boolean {
  if (isLivePackageName(file)) return true
  if (/\.(hei[cf]|jpe?g|livp|pvt)$/i.test(file.name)) return true
  if (/image\/(hei[cf]|jpeg)/i.test(file.type || '')) return true
  return file.size > 1.5 * 1024 * 1024
}

export function hasLivePhotoHint(u8: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(u8.length, 256 * 1024)))
  return /MotionPhoto|MicroVideo|livephotovitality|ContentIdentifier|quicktime\.content\.identifier/i.test(head)
}

export async function extractEmbeddedLiveVideo(file: File): Promise<EmbeddedLiveExtract | null> {
  if (file.size < 128 || !mightContainEmbeddedLive(file)) return null
  const u8 = new Uint8Array(await file.arrayBuffer())
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b
  if (isZip || isLivePackageName(file)) {
    return extractFromZipPackage(file, u8)
  }

  const start = findEmbeddedVideoStart(u8)
  if (start < 2 || !looksLikeVideoFtyp(u8, start)) {
    if (hasLivePhotoHint(u8)) {
      console.warn('[livePhotoExtract] 有实况标记但文件内没有视频轨', file.name, file.type, file.size)
    }
    return null
  }

  const videoBytes = u8.subarray(start)
  if (videoBytes.length < 64) return null
  console.log('[livePhotoExtract] 拆出内嵌视频', file.name, 'offset', start, 'videoBytes', videoBytes.length)

  const base = (file.name || 'live').replace(/\.[^.]+$/, '') || 'live'
  const posterBytes = u8.subarray(0, start)
  const posterType = posterBytes[0] === 0xff && posterBytes[1] === 0xd8
    ? 'image/jpeg'
    : 'image/heic'

  return {
    videoFile: fileFromBytes(videoBytes, `${base}.mp4`, 'video/mp4'),
    posterFile: posterBytes.length > 64
      ? fileFromBytes(posterBytes, `${base}.${posterType === 'image/jpeg' ? 'jpg' : 'heic'}`, posterType)
      : undefined,
  }
}

export function fileBaseName(file: File): string {
  return (file.name || '').replace(/\.[^.]+$/, '').toLowerCase()
}

export function isImageLikeFile(file: File): boolean {
  if (file.type?.startsWith('image/')) return true
  return IMAGE_EXT_RE.test(file.name)
}

export function isVideoLikeName(file: File): boolean {
  if (file.type?.startsWith('video/')) return true
  return VIDEO_EXT_RE.test(file.name)
}

/** 同一次选择里的 IMG_xx.HEIC + IMG_xx.MOV 配成一对 */
export function pairLivePhotoFiles(files: File[]): {
  pairs: Array<{ poster: File; video: File }>
  rest: File[]
} {
  const groups = new Map<string, File[]>()
  for (const f of files) {
    const key = fileBaseName(f) || `__anon_${groups.size}`
    const list = groups.get(key)
    if (list) list.push(f)
    else groups.set(key, [f])
  }

  const pairs: Array<{ poster: File; video: File }> = []
  const rest: File[] = []
  for (const group of groups.values()) {
    const poster = group.find((f) => isImageLikeFile(f) && !isVideoLikeName(f))
    const video = group.find((f) => isVideoLikeName(f))
    if (poster && video) {
      pairs.push({ poster, video })
      for (const f of group) {
        if (f !== poster && f !== video) rest.push(f)
      }
    } else {
      rest.push(...group)
    }
  }
  return { pairs, rest }
}
