import type { BaseResponse, PaginationParams, PaginationResponse, CollectionList } from '@/types/api'
import { use$Post } from '@/composables/httpCore'

// 采集清单列表查询参数
export interface CollectionListParams extends PaginationParams {
  /** 用户 ID，可选，用于查某个用户的采集清单 */
  user_id?: number
  /** 关联业务类型，比如 0/1 等 */
  pk_type?: number
  /** 关联业务主键 ID */
  pk_id?: number
  /** 是否完成 */
  is_completed?: number
}


// 对应后台：.post('/collectionList/list', CollectionListController.getCollectionList)
export async function getCollectionList(
  params: CollectionListParams
): Promise<PaginationResponse<CollectionList>> {
  const response = await use$Post<BaseResponse<PaginationResponse<CollectionList>>>(
    '/collectionList/list',
    params
  )
  return response.data
}

// 对应后台：.post('/collectionList/insert', CollectionListController.insertCollection)
export async function insertCollection(
  params: CollectionList
): Promise<CollectionList> {
  const response = await use$Post<BaseResponse<CollectionList>>(
    '/collectionList/insert',
    params
  )
  return response.data
}

// 对应后台：.post('/collectionList/update', CollectionListController.updateCollection)
export async function completedCollection(
  params: CollectionList
): Promise<CollectionList> {
  const response = await use$Post<BaseResponse<CollectionList>>(
    '/collectionList/completed',
    params
  )
  return response.data
}
