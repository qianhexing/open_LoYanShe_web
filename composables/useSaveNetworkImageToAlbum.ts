/**
 * uni-app App / Html5Plus 内嵌 WebView：将网络图片保存到系统相册。
 * 优先 window.uni.downloadFile + saveImageToPhotosAlbum，否则 plus.downloader + plus.gallery.save。
 */

export function isHtml5PlusWebView(): boolean {
  if (import.meta.server || typeof navigator === 'undefined') return false
  return navigator.userAgent.includes('Html5Plus')
}

type PlusDownloaderTask = { start: () => void }
type PlusDownloadResult = { filename: string }
type PlusRuntime = {
  downloader: {
    createDownload: (
      url: string,
      options: { filename?: string },
      cb: (d: PlusDownloadResult, status: number) => void
    ) => PlusDownloaderTask
  }
  gallery: {
    save: (path: string, success: () => void, fail: (e?: unknown) => void) => void
  }
}

function getPlusRuntime(): PlusRuntime | null {
  if (import.meta.server || typeof window === 'undefined') return null
  const w = window as unknown as { plus?: PlusRuntime }
  return w.plus ?? null
}

function whenPlusReady(): Promise<PlusRuntime> {
  const existing = getPlusRuntime()
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve, reject) => {
    if (import.meta.server || typeof document === 'undefined') {
      reject(new Error('no document'))
      return
    }
    const ms = 12_000
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      document.removeEventListener('plusready', onReady)
      reject(new Error('plusready 超时'))
    }, ms)
    function onReady() {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      const p = getPlusRuntime()
      if (p) resolve(p)
      else reject(new Error('plus 不可用'))
    }
    document.addEventListener('plusready', onReady, { once: true })
    queueMicrotask(() => {
      if (settled) return
      const p = getPlusRuntime()
      if (p) {
        settled = true
        window.clearTimeout(timer)
        document.removeEventListener('plusready', onReady)
        resolve(p)
      }
    })
  })
}

function saveRemoteImageWithPlus(plusRt: PlusRuntime, url: string, docFilename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = plusRt.downloader.createDownload(url, { filename: docFilename }, (d, status) => {
      if (status !== 200) {
        reject(new Error(`下载图片失败 (${status})`))
        return
      }
      plusRt.gallery.save(
        d.filename,
        () => resolve(),
        (e) => reject(e ?? new Error('写入相册失败'))
      )
    })
    task.start()
  })
}

function trySaveWithGlobalUni(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const uniGlobal = (window as unknown as {
    uni?: {
      downloadFile?: (o: {
        url: string
        success?: (r: { tempFilePath: string }) => void
        fail?: (e?: unknown) => void
      }) => void
      saveImageToPhotosAlbum?: (o: {
        filePath: string
        success?: () => void
        fail?: (e?: unknown) => void
      }) => void
    }
  }).uni
  if (!uniGlobal) return Promise.resolve(false)
  const downloadFile = uniGlobal.downloadFile
  const saveImageToPhotosAlbum = uniGlobal.saveImageToPhotosAlbum
  if (!downloadFile || !saveImageToPhotosAlbum) {
    return Promise.resolve(false)
  }
  return new Promise((resolve, reject) => {
    downloadFile({
      url,
      success: (res) => {
        saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => resolve(true),
          fail: (e) => reject(e ?? new Error('saveImageToPhotosAlbum 失败')),
        })
      },
      fail: (e) => reject(e ?? new Error('downloadFile 失败')),
    })
  })
}

export interface SaveNetworkImageToAlbumOptions {
  /** plus 下载落地文件名，默认 `_doc/share_img_${timestamp}.png` */
  docFilename?: string
}

/**
 * 将可访问的图片 URL 保存到相册。成功 resolve；失败 throw Error。
 */
export async function saveNetworkImageToAlbum(
  url: string,
  options?: SaveNetworkImageToAlbumOptions
): Promise<void> {
  if (import.meta.server) {
    throw new Error('saveNetworkImageToAlbum 仅在客户端可用')
  }
  const u = url.trim()
  if (!u) {
    throw new Error('图片地址为空')
  }
  let ok = false
  try {
    ok = await trySaveWithGlobalUni(u)
  } catch (e) {
    console.warn('[saveNetworkImageToAlbum] uni.downloadFile 路径失败，尝试 plus', e)
  }
  if (!ok) {
    const plusRt = await whenPlusReady()
    const docFilename = options?.docFilename ?? `_doc/share_img_${Date.now()}.png`
    await saveRemoteImageWithPlus(plusRt, u, docFilename)
  }
}

/**
 * 带 saving 状态的封装，便于按钮 loading。
 */
export function useSaveNetworkImageToAlbum() {
  const saving = ref(false)

  const saveToAlbum = async (url: string, options?: SaveNetworkImageToAlbumOptions) => {
    if (import.meta.server || saving.value) return
    saving.value = true
    try {
      await saveNetworkImageToAlbum(url, options)
    } finally {
      saving.value = false
    }
  }

  return {
    saving: readonly(saving),
    saveToAlbum,
  }
}
