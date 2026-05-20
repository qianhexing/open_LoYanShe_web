import type { BaseResponse, PaginationParams, PaginationResponse, User } from '@/types/api';
export interface LoginUser {
  accessLevel: number
  userFace: string
  userId: number
  userName: string
  userPhone: string
  permission_list?: string[]
}
interface LoginParams {
  user_password: string
  user_phone: string
}
interface RegisterParams {
  user_phone: string
  user_name: string
  user_password: string
  sms_code: string
}
interface SendCodeParams {
  user_phone: string
  phone_code: string
}
export interface Permission {
  menu_id: number
  permissions: string
}
export interface loginResonse {
  token: string
  permission: Permission[]
  data: LoginUser
}
export interface RegisterResponse {
  token: string
  permission: Permission[]
  data: LoginUser
}
export async function loginIn(
  params: LoginParams
): Promise<loginResonse> {
  const response = await use$Post<BaseResponse<loginResonse>>(
    '/user/login',
    params
  );
  return response.data;
}

export async function registerUser(
  params: RegisterParams
): Promise<RegisterResponse> {
  const response = await use$Post<BaseResponse<RegisterResponse>>(
    '/user/insert',
    params
  );
  return response.data;
}

export async function sendVerificationCode(
  params: SendCodeParams
): Promise<{ success: boolean }> {
  const response = await use$Post<BaseResponse<{ success: boolean }>>(
    '/user/sendSms',
    params
  );
  return response.data;
}

// 检查手机号是否已存在
export async function checkUserExist(
  params: { user_phone: string }
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/user/CheckUserExist',
    params
  );
  return response.data;
}

// 检查用户名是否已存在
export async function checkUserName(
  params: { user_name: string }
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/user/CheckUserName',
    params
  );
  return response.data;
}

// 获取我的信息
export async function getUserMy (): Promise<User> {
  const response = await use$Post<BaseResponse<User>>(
    '/user/my',
    {}
  );
  return response.data;
}

// 更新用户信息
interface UpdateUserInfoParams {
  signature?: string
  main_style?: string | null
  province?: string | null
  city?: string | null
  area?: string | null
  show_area?: number
  is_achieve?: number
  user_face?: string
  is_annual_report?: number
  email?: string
  message_config?: Record<string, unknown>
}

export async function changeUserInfo(
  params: UpdateUserInfoParams
): Promise<User> {
  const response = await use$Post<BaseResponse<User>>(
    '/user/update/my',
    params
  );
  return response.data;
}

// 获取短信验证码（用于修改密码）
interface GetSmsCodeParams {
  user_phone: string
  type: string
}

export async function getSmsCode(
  params: GetSmsCodeParams
): Promise<{ success: boolean }> {
  const response = await use$Post<BaseResponse<{ success: boolean }>>(
    '/user/sendSms',
    params
  );
  return response.data;
}

// 修改密码
interface ChangePasswordParams {
  user_phone: string
  user_password: string
  sms_code: string
}

export async function changePassword(
  params: ChangePasswordParams
): Promise<{ success: boolean }> {
  const response = await use$Post<BaseResponse<{ success: boolean }>>(
    '/user/change/password',
    params
  );
  return response.data;
}

export async function getUserSpace(params: { user_id: number }): Promise<User> {
  const response = await use$Post<BaseResponse<User>>('/userSpace/id', params);
  return response.data;
}

/** 管理员将指定用户升级为正式居民（需后端权限：userSpace:admin:upgradeFormal） */
export async function adminUpgradeUserFormalResident(params: {
  user_id: number;
}): Promise<void> {
  await use$Post<BaseResponse<unknown>>('/admin/user/upgrade', params);
}

// 发送邮箱验证码
interface SendEmailCodeParams {
  email: string
}

export async function sendEmailCode(
  params: SendEmailCodeParams
): Promise<{ success: boolean }> {
  const response = await use$Post<BaseResponse<{ success: boolean }>>(
    '/email/code',
    params
  );
  return response.data;
}

// 绑定邮箱
interface BindEmailParams {
  email: string
  code: string
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 【@提及 / 发帖艾特联想】推荐给后端的契约（对齐后可删除本说明中的多余空行）
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **方法与路径：** `POST /user/search/mention`
 *
 * **请求体（JSON）：**
 * | 字段        | 类型   | 说明 |
 * |------------|--------|------|
 * | `keywords` | string | 可选；用户昵称关键词，空字符串可表示「默认推荐」列表 |
 * | `page`     | number | 页码，与项目内其它分页一致，从 1 起 |
 * | `pageSize` | number | 每页条数，建议上限 20 |
 *
 * **响应体：** 与 `PaginationResponse<User>` 一致（`rows` + `count`）
 * - 每条 `User` 建议至少包含：`user_id`（number）、`user_name`、`user_face`（可为相对路径，前端会拼 CDN）
 *
 * **前端落库 HTML 形态（Tiptap 默认）：**
 * `<span data-type="mention" data-id="{user_id}" data-label="{user_name}" class="mention" ...>@昵称</span>`
 * 服务端可用 `data-id` 解析被艾特用户，做通知、计数等。
 *
 * **若暂时无该接口：** 前端会捕获错误并回退到本地默认昵称列表 + 父组件传入的 `mentionUsers`。
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface SearchUsersForMentionParams {
  keywords?: string | null
  page?: number
  pageSize?: number
}

export async function searchUsersForMention(
  params: SearchUsersForMentionParams = {}
): Promise<PaginationResponse<User>> {
  const response = await use$Post<BaseResponse<PaginationResponse<User>>>('/user/search/mention', {
    keywords: params.keywords ?? '',
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 12,
  })
  return response.data
}

export async function bindEmail(
  params: BindEmailParams
): Promise<{ success: boolean }> {
  const response = await use$Post<BaseResponse<{ success: boolean }>>(
    '/email/bind',
    params
  );
  return response.data;
}

// 用户徽章相关
export interface UserDecoBadgeItem {
  deco_id: number
  title?: string
  cover?: string
  url?: string
  type: number
  is_free?: number
  price_type?: number
  user_deco_id?: number
  create_time?: string
  is_displayed: number
}

export interface UserDecoBadgesResponse {
  rows: UserDecoBadgeItem[]
  display_badge: string
}

/** 获取用户已拥有的徽章列表及展示状态。不传 user_id 时为当前用户 */
export async function getUserDecoBadges(params?: { user_id?: number }): Promise<UserDecoBadgesResponse> {
  const response = await use$Post<BaseResponse<UserDecoBadgesResponse>>(
    '/user/deco/badges',
    params ?? {}
  );
  return response.data;
}

/** 修改用户展示的徽章 */
export async function updateUserDisplayBadges(params: { badge_ids: number[] }): Promise<{ display_badge: string }> {
  const response = await use$Post<BaseResponse<{ display_badge: string }>>(
    '/user/deco/display/update',
    params
  );
  return response.data;
}