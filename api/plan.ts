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

/** 计划关联服饰参数 */
interface PlanListRelateParams {
  list_id: number;
  /** 服饰ID，传 null 可取消关联 */
  clothes_id: number | null;
}

/** 计划关联/取消关联服饰 */
export async function planListRelate(
  params: PlanListRelateParams
): Promise<PlanList> {
  const response = await use$Post<BaseResponse<PlanList>>(
    '/plan/list/relate',
    params
  );
  return response.data;
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

/** 获取攒钱计划衣柜参数（按衣柜分页列表） */
export interface GetPlanListWardrobeParams {
  wardrobe_id?: number;
  page?: number;
  pageSize?: number;
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

/** 按月查询计划列表（不包含有子计划的父计划） */
export async function getPlanListByMonth(params: {
  year: number;
  month: number;
}): Promise<PlanList[]> {
  const response = await use$Get<BaseResponse<PlanList[]>>(
    '/plan/list/byMonth',
    params
  );
  return response.data;
}

/** 按年汇总计划总价（按月聚合，不统计有子计划的父计划） */
export async function getPlanTotalByYear(params: {
  year: number;
}): Promise<{ month: number; total_money: number }[]> {
  const response = await use$Get<
    BaseResponse<{ month: number; total_money: number }[]>
  >('/plan/list/totalByYear', params);
  return response.data;
}

/** 按日汇总计划总价（按 end_time 日期聚合，无数据补 0，排除有子计划的父计划） */
export async function getPlanTotalByDay(params: {
  year: number;
  month: number;
}): Promise<{ day: number; total_money: number }[]> {
  const response = await use$Get<
    BaseResponse<{ day: number; total_money: number }[]>
  >('/plan/list/totalByDay', params);
  return response.data;
}

