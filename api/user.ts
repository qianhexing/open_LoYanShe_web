import type { BaseResponse, PaginationParams, PaginationResponse } from '@/types/api';
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
  phone_code: string
  verification_code: string
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