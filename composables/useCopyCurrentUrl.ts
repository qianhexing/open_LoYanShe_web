export const useCopyCurrentUrl = () => {
  const copyCurrentUrl = async () => {
    // 在客户端环境中执行，因为 window 对象只在客户端存在
    if (process.client) {
      try {
        // 获取当前完整的 URL
        const currentUrl = window.location.href;
        await navigator.clipboard.writeText(currentUrl);
        console.log('页面地址已复制: ', currentUrl);
        // 通常这里会返回成功状态或触发一个提示
        return { success: true, message: '链接已复制！', url: currentUrl };
      } catch (err) {
        console.error('复制失败:', err);
        return { success: false, message: '复制失败，请手动复制', error: err };
      }
    }
  };

  return { copyCurrentUrl };
};