import type { BaseResponse, PaginationParams, PaginationResponse, Teaparty, TeapartyAttend } from '@/types/api';

/** 获取茶会列表参数 */
interface GetTeapartyListParams extends PaginationParams {
  keyword?: string | null
  tea_type?: number
  province?: string
  city?: string
  area?: string
}

/** 获取茶会详情参数 */
interface GetTeapartyByIdParams {
  tea_id: number
}

/** 获取参与者列表参数 */
interface GetTeapartyAttendListParams extends PaginationParams {
  tea_id: number
}

/** 判断是否参与参数 */
interface JudgeIsAttendParams {
  tea_id: number
  user_id?: number
}

/** 参与茶会参数 */
interface AttendTeapartyParams {
  tea_id: number
  user_id?: number
  note?: string
}

/** 参与审批参数 */
interface AttendApprovalParams {
  tea_id: number
  user_id: number
  is_approval: number // 0拒绝 1通过
}

/** 退出茶会参数 */
interface QuitTeapartyParams {
  tea_id: number
  user_id?: number
}

/** 获取茶会列表 */
export async function getTeapartyList(
  params: GetTeapartyListParams
): Promise<PaginationResponse<Teaparty>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Teaparty>>>(
    '/teaparty/list',
    params
  );
  return response.data;
}

/** 创建茶会 */
export async function insertTeaparty(
  params: Teaparty
): Promise<Teaparty> {
  const response = await use$Post<BaseResponse<Teaparty>>(
    '/teaparty/insert',
    params
  );
  return response.data;
}

/** 根据ID获取茶会详情 */
export async function getTeapartyById(
  params: GetTeapartyByIdParams
): Promise<Teaparty> {
  const response = await use$Post<BaseResponse<Teaparty>>(
    '/teaparty/id',
    params
  );
  return response.data;
}

/** 获取参与者列表 */
export async function getTeapartyAttendList(
  params: GetTeapartyAttendListParams
): Promise<PaginationResponse<TeapartyAttend>> {
  const response = await use$Post<BaseResponse<PaginationResponse<TeapartyAttend>>>(
    '/teaparty/attend/list',
    params
  );
  return response.data;
}

/** 判断是否参与 */
export async function judgeIsAttend(
  params: JudgeIsAttendParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/teaparty/attend/is',
    params
  );
  return response.data;
}

/** 参与茶会 */
export async function attendTeaparty(
  params: AttendTeapartyParams
): Promise<TeapartyAttend> {
  const response = await use$Post<BaseResponse<TeapartyAttend>>(
    '/teaparty/attend/insert',
    params
  );
  return response.data;
}

/** 参与审批 */
export async function attendApproval(
  params: AttendApprovalParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/teaparty/attend/approval',
    params
  );
  return response.data;
}

/** 退出茶会 */
export async function quitTeaparty(
  params: QuitTeapartyParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/teaparty/attend/quit',
    params
  );
  return response.data;
}

/** 更新茶会 */
export async function updateTeaparty(
  params: Teaparty
): Promise<Teaparty> {
  const response = await use$Post<BaseResponse<Teaparty>>(
    '/teaparty/update',
    params
  );
  return response.data;
}

/** 根据年份获取茶会列表参数 */
interface GetTeapartyByYearParams {
  year: number
}

/** 根据年份获取当年全部茶会 */
export async function getTeapartyByYear(
  params: GetTeapartyByYearParams
): Promise<Teaparty[]> {
  const response = await use$Post<BaseResponse<Teaparty[]>>(
    '/teaparty/all/year',
    params
  );
  return response.data;
}

