export const hexToRgba = (hex: string, opacity = 1): string => {
  // 验证输入
  if (!hex || typeof hex !== 'string') {
    throw new Error('Invalid HEX color');
  }

  // 移除 # 符号并处理缩写形式（如 #abc → aabbcc）
  let newHex = hex.replace('#', '');
  if (newHex.length === 3) {
    newHex = newHex.split('').map(c => c + c).join('');
  }

  // 验证长度
  if (newHex.length !== 6) {
    throw new Error('Invalid HEX color length');
  }

  // 解析 R, G, B 值
  const r = Number.parseInt(newHex.substring(0, 2), 16);
  const g = Number.parseInt(newHex.substring(2, 4), 16);
  const b = Number.parseInt(newHex.substring(4, 6), 16);

  // 验证 opacity
  if (opacity < 0 || opacity > 1) {
    throw new Error('Opacity must be between 0 and 1');
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * 防抖函数
 * @param func 要执行的函数
 * @param wait 等待时间(毫秒)
 * @param immediate 是否立即执行
 * @returns 包装后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
}

/**
 * 节流函数
 * @param func 要执行的函数
 * @param limit 时间间隔(毫秒)
 * @param options 配置选项
 * @returns 包装后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = { leading: true, trailing: true }
): (...args: Parameters<T>) => void {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;
  let inThrottle: boolean;
  
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    const now = Date.now();
    
    if (!inThrottle) {
      if (options.leading !== false) {
        func.apply(context, args);
      }
      lastRan = now;
      inThrottle = true;
    } else {
      if (options.trailing !== false) {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if (now - lastRan >= limit) {
            func.apply(context, args);
            lastRan = now;
          }
        }, Math.max(limit - (now - lastRan), 0));
      }
    }
  };
}