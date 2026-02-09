import type { BaseResponse, PaginationResponse, PlanList } from '@/types/api';

/** 获取攒钱计划列表参数 */
interface GetPlanListParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

/** 获取攒钱计划列表 */
export async function getPlanList(
  params?: GetPlanListParams
): Promise<PaginationResponse<PlanList>> {
  const response = await use$Get<BaseResponse<PaginationResponse<PlanList>>>(
    '/plan/list',
    params
  );
  return response.data;
}

/** 修改攒钱计划参数 */
interface UpdatePlanListParams extends Partial<PlanList> {
  list_id: number;
}

/** 修改攒钱计划 */
export async function updatePlanList(
  params: UpdatePlanListParams
): Promise<PlanList> {
  const response = await use$Post<BaseResponse<PlanList>>(
    '/plan/list/update',
    params
  );
  return response.data;
}

/** 新增攒钱计划参数 */
interface InsertPlanListParams extends Partial<PlanList> {}

/** 新增攒钱计划 */
export async function insertPlanList(
  params: InsertPlanListParams
): Promise<PlanList> {
  const response = await use$Post<BaseResponse<PlanList>>(
    '/plan/list/insert',
    params
  );
  return response.data;
}

/** 删除攒钱计划参数 */
interface DeletePlanListParams {
  list_id: number;
  [key: string]: any;
}

/** 删除攒钱计划 */
export async function deletePlanList(
  params: DeletePlanListParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/plan/list/delete',
    params
  );
  return response.data;
}

/** 更新攒钱计划金额参数 */
interface UpdatePlanMoneyParams {
  list_id: number;
  have_money?: number;
  need_money?: number;
  [key: string]: any;
}

/** 更新攒钱计划金额 */
export async function updatePlanMoney(
  params: UpdatePlanMoneyParams
): Promise<PlanList> {
  const response = await use$Post<BaseResponse<PlanList>>(
    '/plan/list/update/money',
    params
  );
  return response.data;
}

/** 获取攒钱计划衣柜参数 */
interface GetPlanListWardrobeParams {
  list_id?: number;
  [key: string]: any;
}

/** 获取攒钱计划衣柜 */
export async function getPlanListWardrobe(
  params: GetPlanListWardrobeParams
): Promise<any> {
  const response = await use$Post<BaseResponse<any>>(
    '/plan/list/wardrobe',
    params
  );
  return response.data;
}

/** 完成攒钱计划参数 */
interface PlanCompleteParams {
  list_id: number;
  is_complete?: number;
  [key: string]: any;
}

/** 完成攒钱计划 */
export async function planComplete(
  params: PlanCompleteParams
): Promise<PlanList> {
  const response = await use$Post<BaseResponse<PlanList>>(
    '/plan/complete',
    params
  );
  return response.data;
}

