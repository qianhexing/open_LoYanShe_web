/**
 * VIP 收银台可用支付渠道（扩展：在此新增条目并在收银台页实现对应下单逻辑）。
 */
export type VipPaymentChannelId = 'alipay' | 'wechat'

export interface VipPaymentChannelMeta {
  id: VipPaymentChannelId
  /** 展示名称 */
  label: string
  /** 副文案 */
  subtitle?: string
  /** 是否已接入后端下单 */
  implemented: boolean
}

export const VIP_PAYMENT_CHANNELS: readonly VipPaymentChannelMeta[] = [
  {
    id: 'alipay',
    label: '支付宝',
    subtitle: '网页收银台 · PC / H5',
    implemented: true,
  },
  {
    id: 'wechat',
    label: '微信支付',
    subtitle: '即将支持',
    implemented: false,
  },
]
