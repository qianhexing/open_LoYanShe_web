/**
 * 上传闸门，与后端 UploadGuard 对齐：
 * - 可直接上传：jpg/jpeg、png、webp（扩展名须与文件头一致）
 * - 其它图片（gif、bmp、heic/heif、avif、tiff、svg、jfif、ico 等）转为 JPEG
 * HEIC 使用 heic-to（较新 libheif），仅在确认为 HEIC 时懒加载。
 */

const HEIC_EXT_RE = /\.hei[cf]$/i
const HEIC_MIME_RE = /image\/hei[cf]/i
const LIKELY_IMAGE_EXT_RE = /\.(jpe?g|jfif|jpe|png|gif|webp|hei[cf]|bmp|avif|tiff?|svg|ico)$/i

/** 后端允许直接落盘的图片类型 */
export const ALLOWED_UPLOAD_IMAGE_TYPES = ['jpeg', 'png', 'webp'] as const
export type AllowedUploadImageType = (typeof ALLOWED_UPLOAD_IMAGE_TYPES)[number]

const EXT_BY_MAGIC: Record<AllowedUploadImageType, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
}

const MIME_BY_MAGIC: Record<AllowedUploadImageType, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export class ImageConvertError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ImageConvertError'
  }
}

export class HeicConvertError extends ImageConvertError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HeicConvertError'
  }
}

function fileBaseName(name: string): string {
  const base = (name || 'image').replace(/\.[^.]+$/, '')
  return base || 'image'
}

function jpegFileName(name: string): string {
  return `${fileBaseName(name)}.jpg`
}

function normalizeExt(filename: string): string {
  const i = (filename || '').lastIndexOf('.')
  return i >= 0 ? filename.slice(i).toLowerCase() : ''
}

export function isLikelyImageFile(file: { name?: string; type?: string }): boolean {
  if (file.type && /^image\//i.test(file.type)) return true
  if (file.name && LIKELY_IMAGE_EXT_RE.test(file.name)) return true
  return false
}

function extMatchesMagic(ext: string, magic: AllowedUploadImageType): boolean {
  if (magic === 'jpeg') return ext === '.jpg' || ext === '.jpeg'
  return ext === EXT_BY_MAGIC[magic]
}

/** 文件头识别，规则与后端 detectImageMagic 一致 */
export async function detectAllowedImageMagic(blob: Blob): Promise<AllowedUploadImageType | null> {
  try {
    const u8 = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
    if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
      return 'jpeg'
    }
    if (
      u8.length >= 8 &&
      u8[0] === 0x89 &&
      u8[1] === 0x50 &&
      u8[2] === 0x4e &&
      u8[3] === 0x47 &&
      u8[4] === 0x0d &&
      u8[5] === 0x0a &&
      u8[6] === 0x1a &&
      u8[7] === 0x0a
    ) {
      return 'png'
    }
    if (u8.length >= 12) {
      const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3])
      const webp = String.fromCharCode(u8[8], u8[9], u8[10], u8[11])
      if (riff === 'RIFF' && webp === 'WEBP') return 'webp'
    }
    return null
  } catch {
    return null
  }
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

async function convertHeicToJpeg(file: File, quality: number): Promise<File> {
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
    const out = new File([jpegBlob], name, { type: 'image/jpeg', lastModified: Date.now() })
    if ((await detectAllowedImageMagic(out)) !== 'jpeg') {
      throw new HeicConvertError('HEIC 转换结果不是合法 JPEG')
    }
    console.log(`[imageUploadGate] ${file.name} → ${name} (${file.size} → ${out.size})`)
    return out
  } catch (e) {
    if (e instanceof HeicConvertError) throw e
    throw new HeicConvertError(
      '无法解析该 HEIC/HEIF 图片，请在系统相册导出为 JPEG 后再上传',
      { cause: e },
    )
  }
}

function renameToAllowed(file: File, magic: AllowedUploadImageType): File {
  const ext = EXT_BY_MAGIC[magic]
  const name = `${fileBaseName(file.name)}${ext}`
  console.log(`[imageUploadGate] 扩展名修正 ${file.name || '(无文件名)'} → ${name}`)
  return new File([file], name, {
    type: MIME_BY_MAGIC[magic],
    lastModified: file.lastModified || Date.now(),
  })
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode failed'))
    img.src = url
  })
}

async function rasterToJpegFile(
  source: CanvasImageSource,
  width: number,
  height: number,
  name: string,
  quality: number,
): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageConvertError('当前环境无法转换图片')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })
  if (!blob || blob.size <= 0) throw new ImageConvertError('图片转 JPG 失败')
  const out = new File([blob], jpegFileName(name), { type: 'image/jpeg', lastModified: Date.now() })
  if ((await detectAllowedImageMagic(out)) !== 'jpeg') {
    throw new ImageConvertError('图片转 JPG 失败')
  }
  console.log(`[imageUploadGate] ${name || '(无文件名)'} → ${out.name} (${blob.size})`)
  return out
}

async function convertRasterToJpeg(file: File, quality: number): Promise<File> {
  if (typeof document === 'undefined') {
    throw new ImageConvertError('请在浏览器中上传图片')
  }
  try {
    const bitmap = await createImageBitmap(file)
    try {
      if (!bitmap.width || !bitmap.height) throw new Error('empty')
      return await rasterToJpegFile(bitmap, bitmap.width, bitmap.height, file.name, quality)
    } finally {
      bitmap.close()
    }
  } catch (bitmapError) {
    if (bitmapError instanceof ImageConvertError) throw bitmapError
    const url = URL.createObjectURL(file)
    try {
      const img = await loadHtmlImage(url)
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty')
      return await rasterToJpegFile(img, img.naturalWidth, img.naturalHeight, file.name, quality)
    } catch (e) {
      if (e instanceof ImageConvertError) throw e
      throw new ImageConvertError(
        '无法将该图片转为 JPG。直接上传仅支持 jpg/jpeg、png、webp',
        { cause: bitmapError },
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export interface EnsureAllowedImageOptions {
  quality?: number
  /** 调用方已确认这是图片（如 /qhxUpload），即使没有图片 MIME / 后缀也尝试转换 */
  assumeImage?: boolean
}

/**
 * 对齐后端上传限制：
 * jpg/jpeg、png、webp 且扩展名与文件头一致时原样返回；
 * 类型合法但后缀不符时只改后缀；
 * 其余图片转为 JPEG。非图片原样返回。
 */
export async function ensureAllowedImageForUpload(
  file: File,
  opts?: EnsureAllowedImageOptions,
): Promise<File> {
  const quality = opts?.quality ?? 0.92
  if (!opts?.assumeImage && !isLikelyImageFile(file)) return file

  if (await needsHeicUploadConvert(file)) {
    return convertHeicToJpeg(file, quality)
  }

  const magic = await detectAllowedImageMagic(file)
  const ext = normalizeExt(file.name)
  if (magic && extMatchesMagic(ext, magic)) return file
  if (magic) return renameToAllowed(file, magic)
  return convertRasterToJpeg(file, quality)
}

/**
 * 上传前整理图片。非 jpg/jpeg、png、webp 会转为 JPEG。
 */
export async function ensureJpegForUpload(
  file: File,
  opts?: { quality?: number },
): Promise<File> {
  return ensureAllowedImageForUpload(file, opts)
}
