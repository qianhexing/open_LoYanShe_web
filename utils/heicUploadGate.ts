/**
 * 上传闸门：HEIC/HEIF → JPEG，避免非 Safari 浏览器无法展示。
 * 使用 heic-to（较新 libheif），仅在确认为 HEIC 时懒加载。
 */

const HEIC_EXT_RE = /\.hei[cf]$/i
const HEIC_MIME_RE = /image\/hei[cf]/i

export class HeicConvertError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HeicConvertError'
  }
}

function jpegFileName(name: string): string {
  const base = (name || 'image').replace(/\.[^.]+$/, '') || 'image'
  return `${base}.jpg`
}

/** 文件头 sniff：ftyp + heic/heif/mif1 等 brand（覆盖伪 jpg 后缀） */
export async function sniffHeicBlob(blob: Blob): Promise<boolean> {
  try {
    const buf = await blob.slice(0, 32).arrayBuffer()
    const u8 = new Uint8Array(buf)
    if (u8.length < 12) return false
    const ftyp = String.fromCharCode(u8[4], u8[5], u8[6], u8[7])
    if (ftyp !== 'ftyp') return false
    const brands = String.fromCharCode(...u8.slice(8, Math.min(u8.length, 32)))
    return /hei[cf]|mif1|msf1|hevx|hevc|heim|heis/i.test(brands)
  } catch {
    return false
  }
}

export function isHeicByNameOrMime(file: { name?: string; type?: string }): boolean {
  if (file.type && HEIC_MIME_RE.test(file.type)) return true
  if (file.name && HEIC_EXT_RE.test(file.name)) return true
  return false
}

/** 是否需要对上传文件做 HEIC 转换 */
export async function needsHeicUploadConvert(file: Blob & { name?: string; type?: string }): Promise<boolean> {
  if (isHeicByNameOrMime(file)) return true
  return sniffHeicBlob(file)
}

/**
 * 若为 HEIC/HEIF 则转为 JPEG File；否则原样返回。
 * 转换失败抛出 HeicConvertError（调用方应拦截，禁止上传原 HEIC）。
 */
export async function ensureJpegForUpload(
  file: File,
  opts?: { quality?: number },
): Promise<File> {
  const quality = opts?.quality ?? 0.92
  const need = await needsHeicUploadConvert(file)
  if (!need) return file

  try {
    const { heicTo } = await import('heic-to')
    const jpegBlob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality,
    })
    if (!jpegBlob || jpegBlob.size <= 0) {
      throw new HeicConvertError('HEIC 转换结果为空')
    }
    const name = jpegFileName(file.name || 'image.heic')
    console.log(`[heicUploadGate] ${file.name} → ${name} (${file.size} → ${jpegBlob.size})`)
    return new File([jpegBlob], name, { type: 'image/jpeg' })
  } catch (e) {
    if (e instanceof HeicConvertError) throw e
    throw new HeicConvertError(
      '无法解析该 HEIC/HEIF 图片，请在系统相册导出为 JPEG 后再上传',
      { cause: e },
    )
  }
}
