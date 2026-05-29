import {
  vipAlipayWebCreate,
  type VipAlipayWebCreateParams,
  type VipPackageCode,
  type VipAlipayTerminal,
} from '@/api/vipAlipay'

/** 下单前写入 sessionStorage，返回页用于兜底 out_trade_no */
export const VIP_ALIPAY_OUT_TRADE_NO_KEY = 'vip_alipay_out_trade_no'

/**
 * 当前站点支付结果页完整 URL（本项目 i18n 为 strategy: no_prefix，路径为 /vip/pay-result）。
 * 生产环境须为 HTTPS，与后端 return_url 要求一致。
 */
export function getVipAlipayReturnUrl(): string {
  if (import.meta.server || typeof window === 'undefined') return ''
  return `${window.location.origin}/vip/pay-result`
}

/** 宽度 / UA：大屏或桌面场景用 pc，否则 h5（勿在 h5 使用 App 的 order_str 接口） */
export function detectVipAlipayTerminal(): VipAlipayTerminal {
  if (import.meta.server || typeof window === 'undefined') return 'pc'
  const w = window.innerWidth || document.documentElement.clientWidth
  const ua = navigator.userAgent || ''
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  )
  if (w >= 768 && !mobileUa) return 'pc'
  if (mobileUa || w < 768) return 'h5'
  return 'pc'
}

export interface StartVipAlipayWebPayOptions {
  vip_package: VipPackageCode
  /** 不传则用 detectVipAlipayTerminal() */
  terminal?: VipAlipayTerminal
  /** 不传则用 getVipAlipayReturnUrl() */
  return_url?: string
}

/**
 * 已登录场景：创建支付宝网页订单并跳转收银台（response_mode: redirect）。
 * 会自动缓存 out_trade_no 到 sessionStorage。
 */
export async function startVipAlipayWebPayRedirect(
  options: StartVipAlipayWebPayOptions,
): Promise<void> {
  const terminal = options.terminal ?? detectVipAlipayTerminal()
  const return_url = options.return_url ?? getVipAlipayReturnUrl()
  const params: VipAlipayWebCreateParams = {
    vip_package: options.vip_package,
    terminal,
    return_url,
    response_mode: 'redirect',
  }
  const data = await vipAlipayWebCreate(params)
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(VIP_ALIPAY_OUT_TRADE_NO_KEY, data.out_trade_no)
  }
  if (!data.pay_url) {
    throw new Error('未返回 pay_url，请确认 response_mode 为 redirect')
  }
  window.location.href = data.pay_url
}
