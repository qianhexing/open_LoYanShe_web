import type { BaseResponse, PaginationParams, PaginationResponse, User } from '@/types/api';
export interface LoginUser {
  accessLevel: number
  userFace: string
  userId: number
  userName: string
  userPhone: string
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
