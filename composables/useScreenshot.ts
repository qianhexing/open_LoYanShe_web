import html2canvas from 'html2canvas'

export const useScreenshot = () => {
  const captureElement = async (element: HTMLElement, fileName = 'screenshot.png') => {
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // 提高分辨率
        logging: false,
        useCORS: true, // 如果需要加载跨域图片
        allowTaint: true // 如果需要加载跨域图片
      })
      
      // 创建下载链接
      const link = document.createElement('a')
      link.download = fileName
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Error capturing element:', error)
    }
  }

  return { captureElement }
}