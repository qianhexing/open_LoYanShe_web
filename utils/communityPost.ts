import type { LocationQuery } from 'vue-router'

/**
 * 发帖成功后写入 community foreign 的上下文。
 * `pk_type`：0店铺 1实体店 2衣柜服饰 3搭配场景 4搭配清单 5合集考据 6茶会返图 7图鉴返图（详见 types/api `CommunityForeign`）。
 * `extra` 预留给后续接口扩展（如排序、标签），当前不会传给 insertCommunityForeign。
 */
export interface CommunityPostForeignContext {
  pk_id: number
  pk_type: number
  extra?: Record<string, unknown>
}

export function parseCommunityPostForeignFromQuery(
  query: LocationQuery
): CommunityPostForeignContext | undefined {
  const rawId = query.pk_id
  const rawType = query.pk_type
  if (rawId == null || rawType === undefined || rawId === '' || rawType === '') {
    return undefined
  }
  const pk_id = Number.parseInt(String(rawId), 10)
  const pk_type = Number.parseInt(String(rawType), 10)
  if (!Number.isFinite(pk_id) || !Number.isFinite(pk_type)) {
    return undefined
  }
  return { pk_id, pk_type }
}

/** URL `is_open`：0 正式居民可见，1 开放，2 仅自己可见；非法或未传返回 undefined（由编辑器使用默认值） */
export function parseCommunityPostIsOpenFromQuery(query: LocationQuery): number | undefined {
  const raw = query.is_open
  if (raw == null || raw === '') return undefined
  const n = Number.parseInt(String(raw), 10)
  if (n === 0 || n === 1 || n === 2) return n
  return undefined
}

/** 从任意来源规范化出 foreign 参数（完整对象优先于 pk_id + pk_type） */
export function resolveCommunityPostForeignPk(
  foreignPk: CommunityPostForeignContext | null | undefined,
  pk_id: number | null | undefined,
  pk_type: number | null | undefined
): { pk_id: number; pk_type: number } | undefined {
  if (
    foreignPk != null &&
    Number.isFinite(foreignPk.pk_id) &&
    Number.isFinite(foreignPk.pk_type)
  ) {
    return { pk_id: foreignPk.pk_id, pk_type: foreignPk.pk_type }
  }
  if (
    pk_id != null &&
    pk_type != null &&
    Number.isFinite(pk_id) &&
    Number.isFinite(pk_type)
  ) {
    return { pk_id, pk_type }
  }
  return undefined
}
