import type {
  BaseResponse,
  PaginationParams,
  PaginationResponse,
  Album,
  InsertAlbumParams,
  UpdateAlbumParams,
} from '@/types/api';

interface AlbumSearchParams extends PaginationParams {
  parent_id?: number | null;
  album_id?: number;
  /** owned | subscribed */
  list_type?: 'owned' | 'subscribed';
  /** 查看指定用户的相册列表（如个人空间成就簿） */
  user_id?: number;
}

export async function getAlbumList(
  params: AlbumSearchParams
): Promise<PaginationResponse<Album>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Album>>>(
    '/album/list',
    params
  );
  return response.data;
}

export async function getAlbumDetail(
  params: {
    album_id: number;
    user_id?: number;
  }
): Promise<Album> {
  const response = await use$Post<BaseResponse<Album>>(
    '/album/detail',
    params
  );
  return response.data;
}

export async function insertAlbumForeign(
  data: Record<string, unknown>
): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>(
    '/album/foregin/insert',
    data
  );
  return response.data;
}

export async function updateAlbumForeign(
  data: Record<string, unknown>
): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>(
    '/album/foregin/update',
    data
  );
  return response.data;
}

/** 成就统计返回数据 */
export interface AlbumAchievementStats {
  user_id: number;
  points: number;
  achieved_count: number;
  total_count: number;
  progress: number;
}

export async function getAlbumAchievementStats(params?: { user_id?: number }): Promise<AlbumAchievementStats> {
  const response = await use$Post<BaseResponse<AlbumAchievementStats>>(
    '/album/achievement/stats',
    params ?? {}
  );
  return response.data;
}

export async function insertAlbum(data: InsertAlbumParams): Promise<Album> {
  const response = await use$Post<BaseResponse<Album>>('/album/insert', data);
  return response.data;
}

export async function updateAlbum(data: UpdateAlbumParams): Promise<Album> {
  const response = await use$Post<BaseResponse<Album>>('/album/update', data);
  return response.data;
}

/** 成就市场：浏览他人公开的成就簿 */
export async function getAlbumDiscover(
  params: PaginationParams
): Promise<PaginationResponse<Album>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Album>>>(
    '/album/discover',
    params
  );
  return response.data;
}

/** 添加成就簿到我的目标 */
export async function subscribeAlbum(params: {
  album_id: number;
  sort?: number;
}): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>('/album/subscribe', params);
  return response.data;
}

/** 从我的目标移除（不删除原作者成就簿） */
export async function unsubscribeAlbum(params: {
  album_id: number;
}): Promise<{ album_id: number; is_subscribed: boolean }> {
  const response = await use$Post<
    BaseResponse<{ album_id: number; is_subscribed: boolean }>
  >('/album/unsubscribe', params);
  return response.data;
}
