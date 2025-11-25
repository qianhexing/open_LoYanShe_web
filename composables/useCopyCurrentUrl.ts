export const useCopyCurrentUrl = () => {
  const copyCurrentUrl = async () => {
    if (process.client) {
      try {
        let currentUrl = window.location.href;
  
        // 手动去掉 token 参数，兼容性比 new URL 更高
        const urlObj = new URL(currentUrl);
        urlObj.searchParams.delete('token');
        currentUrl = urlObj.toString();
  
        // 兼容性写法：优先使用 Clipboard API
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(currentUrl);
        } else {
          // iOS Safari / 安卓 WebView 兼容处理
          const textArea = document.createElement('textarea');
          textArea.value = currentUrl;
          textArea.style.position = 'fixed';
          textArea.style.top = '-1000px';
          textArea.style.left = '-1000px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
  
          // 执行复制
          const success = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (!success) throw new Error('execCommand failed');
        }
  
        console.log('页面地址已复制:', currentUrl);
        return { success: true, message: '链接已复制！', url: currentUrl };
      } catch (err) {
        console.error('复制失败:', err);
        return { success: false, message: '复制失败，请手动复制', error: err };
      }
    }
  };
  

  return { copyCurrentUrl };
};