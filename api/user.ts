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
export interface Permission {
  menu_id: number
  permissions: string
}
export interface loginResonse {
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