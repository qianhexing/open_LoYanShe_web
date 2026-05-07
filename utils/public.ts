import { BASE_IMG } from '@/utils/ipConfig'

/** 富文本里历史绝对地址，统一成当前图片域名 + 相对路径 */
function normalizeLolitaAliImgSrc(src: string): string {
  const prefixes = [
    'https://www.lolitalibrary.com/ali/',
    'https://lolitalibrary.com/ali/',
  ] as const
  for (const p of prefixes) {
    if (src.startsWith(p)) {
      return `${BASE_IMG}${src.slice(p.length)}`
    }
  }
  return src
}

function rewriteImgTagLolitaAliSrc(imgTag: string): string {
  return imgTag.replace(
    /\bsrc\s*=\s*(["'])([^"']*)\1/i,
    (match, quote: string, srcVal: string) => {
      const next = normalizeLolitaAliImgSrc(srcVal)
      return next === srcVal ? match : `src=${quote}${next}${quote}`
    }
  )
}

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

export function  safeHtml(html:string) {
  if (!html) return '';

  // 创建一个div元素作为临时容器
  const temp = document.createElement('div');
  temp.textContent = html; // 自动转义HTML标签

  // 获取转义后的内容（此时所有HTML标签都被转义为文本）
  let safeContent = temp.innerHTML;

  // 如果需要允许一些安全的HTML标签，可以使用以下方法
  // 这里以允许 <b>, <i>, <u>, <p>, <br>, <span> 为例
  safeContent = safeContent.replace(/&lt;(\/?)(b|i|u|p|br|span)&gt;/g, '<$1$2>');
  safeContent.replace('60vh', '500px')
  return safeContent;
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

/**
 * 判断当前设备是否为电脑端（PC）
 * @returns {boolean} true=电脑端 | false=移动端/平板
 */
export const isPC = (): boolean => {
  // 1. 优先检测触摸屏+屏幕尺寸（现代设备更准确）
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 1024;
  
  // 2. 用户代理检测（作为备用方案）
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /(iphone|ipod|ipad|android|windows phone|mobile)/i.test(userAgent);
  
  // 符合PC的特征：无触摸或大屏幕，且UA不包含移动端关键词
  return !hasTouch || (!isSmallScreen && !isMobileUA);
};

// 格式化lable
export function formatLabel(value: string | number, options: Array<{ value: number, label: string }> = []) {
	if (Array.isArray(options)) {
		const index = options.findIndex((item) => { return Number.parseInt(value.toString()) === item.value })
		if (index !== -1) {
			return options[index].label
		}
    return null
	}
  return null
}
// 格式化富文本(用于大多数列表组件)
export function formatRich(richText: string) {
	
	// 正则表达式匹配所有的img标签
	const imgTagRegex = /<img[^>]+src="([^">]+)"[^>]*>/g;
	const editorImageRegex = /<editorimage[^>]*>([\s\S]*?)<\/editorimage>/g;
	// 用于存储提取的图片链接
	const imageUrls = [];
	
	// 用于存储去除img标签后的字符串
	let textWithoutImgTags = richText;
	
	// 提取图片链接
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = imgTagRegex.exec(richText)) !== null) {
    if (match[1].includes('sence')) {

    } else {
      imageUrls.push(match[1]);
    }  
	}
	
	// 去除img标签
	textWithoutImgTags = richText.replace(editorImageRegex, '');
  // textWithoutImgTags = safeHtml(textWithoutImgTags)
  return {
	    image: imageUrls,
	    text: textWithoutImgTags
	};
}

/**
 * 编辑器/历史富文本中的投票块，替换为可解析的 <vote href="id">
 * 内层 iframe 如 …/lolitaVote/47
 */
export function replaceLolitavoteWithVoteTag(html: string): string {
  return html.replace(
    /<\s*lolitavote[^>]*>([\s\S]*?)<\/\s*lolitavote\s*>/gi,
    (_all, inner: string) => {
      const m = inner.match(/lolitaVote\/(\d+)/i)
      if (!m) return ''
      return `<vote href="${m[1]}"></vote>`
    }
  )
}

export interface RichNode {
  name: string;                         // 标签名，如 'div', 'p', 'text'
  text: string;                         // 节点包含的纯文本内容
  children: RichNode[];                 // 子节点列表
  attrs: Record<string, string>;       // 标签属性，如 { href: '', class: '' }
}
// 解析富文本
export function parseRichText(html: string): RichNode[] {
  let newHtml = html.replace(/ahref/g, 'a href')
  newHtml = newHtml.replace(/editorcommunity/g, 'p')
  newHtml = replaceLolitavoteWithVoteTag(newHtml)
  // 编辑器包裹的图片：去掉 editorimage，只保留内层 img，便于 DOM 解析为 img 节点
  newHtml = newHtml.replace(
    /<editorimage[^>]*>([\s\S]*?)<\/editorimage>/gi,
    (_match, inner: string) => {
      const imgs = inner.match(/<img\b[^>]*>/gi)
      if (!imgs) return ''
      return imgs.map((tag) => rewriteImgTagLolitaAliSrc(tag)).join('')
    }
  )
  newHtml = newHtml.replace(/<img\b[^>]*>/gi, (tag) => rewriteImgTagLolitaAliSrc(tag))
  const parser = new DOMParser()
  const doc = parser.parseFromString(newHtml, 'text/html')

  function parseNode(node: ChildNode): RichNode | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || ''
      return text
        ? {
            name: 'text',
            text,
            children: [],
            attrs: {}
          }
        : null
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tagName = el.tagName.toLowerCase()

      const attrs: Record<string, string> = {}
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value
      }

      const children = Array.from(el.childNodes)
        .map(parseNode)
        .filter((n): n is RichNode => n !== null)
      return {
        name: tagName,
        text: el.textContent?.trim() || '',
        children,
        attrs
      }
    }

    return null
  }

  const rootNodes = Array.from(doc.body.childNodes)
    .map(parseNode)
    .filter((n): n is RichNode => n !== null)
  return rootNodes
}

/** 自闭合标签，无需闭合 */
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source'])

/** 转义 HTML 实体 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c)
}

/** 根据 emoji id 解析图片 URL 的回调，用于还原 emoji img 标签 */
export type GetEmojiUrlFn = (id: number) => string

/**
 * 将 RichNode 归一化为编辑器格式（如 span+data-emoji-id -> emoji），并补充 emoji img 显示表情
 */
function normalizeToEditorNode(node: RichNode, getEmojiUrl?: GetEmojiUrlFn): RichNode {
  const normalized: RichNode = {
    ...node,
    attrs: { ...node.attrs },
    children: node.children.map((c) => normalizeToEditorNode(c, getEmojiUrl))
  }
  // SafeRichText 将 emoji 渲染为 span，若存的是 span 含 data-emoji-id，还原为 emoji 以便编辑器解析
  if (
    normalized.name === 'span' &&
    (normalized.attrs['data-emoji-id'] || normalized.attrs['data-type'] === 'emoji' || normalized.attrs['class']?.includes('rich-text-emoji'))
  ) {
    normalized.name = 'emoji'
    if (!normalized.attrs['data-emoji-id'] && normalized.attrs['href']) {
      normalized.attrs['data-emoji-id'] = normalized.attrs['href'].replace(/^#emoji\/?/, '')
    }
  }
  // emoji 节点：若无 img 子节点，根据 id 用 getEmojiUrl 还原 img 标签以显示表情
  if (normalized.name === 'emoji') {
    const emojiId = normalized.attrs['data-emoji-id'] || normalized.attrs['href']?.replace(/^#emoji\/?/, '')
    const hasImg = normalized.children.some((c) => c.name === 'img')
    if (emojiId && !hasImg && getEmojiUrl) {
      const idNum = Number.parseInt(String(emojiId), 10)
      if (!Number.isNaN(idNum)) {
        const src = getEmojiUrl(idNum)
        if (src) {
          normalized.children = [
            { name: 'img', text: '', children: [], attrs: { src, alt: normalized.attrs['alt'] || '' } }
          ]
        }
      }
    }
  }
  return normalized
}

/** 将 RichNode 序列化为 HTML 字符串 */
function richNodeToHtml(node: RichNode, getEmojiUrl?: GetEmojiUrlFn): string {
  const n = normalizeToEditorNode(node, getEmojiUrl)
  if (n.name === 'text') {
    return escapeHtml(n.text)
  }
  const attrsStr = Object.entries(n.attrs)
    .map(([k, v]) => `${k}="${escapeHtml(String(v))}"`)
    .join(' ')
  const attrs = attrsStr ? ` ${attrsStr}` : ''
  if (VOID_TAGS.has(n.name)) {
    return `<${n.name}${attrs}>`
  }
  const childrenHtml = n.children.map((c) => richNodeToHtml(c, getEmojiUrl)).join('')
  return `<${n.name}${attrs}>${childrenHtml || n.text}</${n.name}>`
}

export interface ContentToEditorFormatOptions {
  /** 根据 emoji id 返回图片完整 URL，用于还原 emoji img 标签显示表情 */
  getEmojiUrl?: GetEmojiUrlFn
}

/**
 * 将 RichNode[] 转换为富文本编辑器可编辑的 HTML 格式
 * 参考 SafeRichText 的解析逻辑，确保 emoji、topic 等自定义标签格式正确
 */
export function richNodesToEditorHtml(nodes: RichNode[], options?: ContentToEditorFormatOptions): string {
  return nodes.map((n) => richNodeToHtml(n, options?.getEmojiUrl)).join('')
}

/**
 * 将内容还原为富文本编辑器可编辑的格式
 * @param content HTML 字符串 或 RichNode[]（如 SafeRichText 的 nodes）
 * @param options.getEmojiUrl 根据 emoji id 返回图片 URL，用于还原 emoji img 标签显示表情
 * @returns 编辑器可解析的 HTML 字符串
 */
export function contentToEditorFormat(
  content: string | RichNode[],
  options?: ContentToEditorFormatOptions
): string {
  if (Array.isArray(content)) {
    return richNodesToEditorHtml(content, options)
  }
  if (!content || typeof content !== 'string') {
    return ''
  }
  const nodes = parseRichText(content)
  return richNodesToEditorHtml(nodes, options)
}

// 获取店铺主体类型
export function formatShopMainType(main_type: string) {
	if (main_type) {
    return main_type.split(',').map((type) => {
      const value = Number.parseInt(type)
      let label = '未知'
      switch (value) {
        case 0:
          label = '网店'
          break;
        case 1:
          label = '实体店'
          break;
        case 2:
          label = '手作店'
          break;
        case 3:
          label = '厂原'
          break;
        case 4:
          label = '山店'
          break;
        default:
          break;
      }
      return label
    })
  }
  return []
}