import html2canvas from 'html2canvas'

export const useScreenshot = () => {
  const captureElement = async (element: HTMLElement, fileName = 'screenshot.png', options?: {
    scale?: number
    backgroundColor?: string
  }) => {
    try {
      const canvas = await html2canvas(element, {
        scale: options?.scale || 2, // 提高分辨率，长图建议使用2
        logging: false,
        useCORS: true, // 如果需要加载跨域图片
        allowTaint: true, // 如果需要加载跨域图片
        backgroundColor: options?.backgroundColor || '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        width: element.scrollWidth,
        height: element.scrollHeight
      })
      
      // 创建下载链接
      const link = document.createElement('a')
      link.download = fileName
      link.href = canvas.toDataURL('image/png', 1.0) // 最高质量
      link.click()
      
      return canvas
    } catch (error) {
      console.error('Error capturing element:', error)
      throw error
    }
  }

  return { captureElement }
}