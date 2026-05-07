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