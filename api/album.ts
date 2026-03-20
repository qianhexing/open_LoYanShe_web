import type { BaseResponse, PaginationParams, PaginationResponse, Album } from '@/types/api';

interface AlbumSearchParams extends PaginationParams {
  parent_id?: number | null;
  album_id?: number;
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
