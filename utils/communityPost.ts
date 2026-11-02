import type { LocationQuery } from 'vue-router'

/**
 * 发帖成功后写入 community foreign 的上下文。
 * `pk_type`：0店铺 1实体店 2衣柜服饰 3搭配场景 4搭配清单 5合集考据 6茶会返图 7图鉴返图 8小工具（详见 types/api `CommunityForeign`）。
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

/** 服饰详情「写新记忆」谁能看到偏好 */
export const CLOTHES_MEMORY_IS_OPEN_STORAGE_KEY = 'clothes-detail-memory-is-open'

/** `is_open`：0 正式居民可见，1 开放，2 仅自己可见；非法返回 undefined */
export function parseCommunityPostIsOpenValue(
  raw: string | number | null | undefined
): 0 | 1 | 2 | undefined {
  if (raw == null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (n === 0 || n === 1 || n === 2) return n
  return undefined
}

/** URL `is_open`：0 正式居民可见，1 开放，2 仅自己可见；非法或未传返回 undefined（由编辑器使用默认值） */
export function parseCommunityPostIsOpenFromQuery(query: LocationQuery): number | undefined {
  const raw = query.is_open
  if (Array.isArray(raw)) return parseCommunityPostIsOpenValue(raw[0])
  return parseCommunityPostIsOpenValue(raw)
}

export function readCachedCommunityPostIsOpen(key: string): 0 | 1 | 2 | undefined {
  if (!import.meta.client || typeof localStorage === 'undefined') return undefined
  try {
    return parseCommunityPostIsOpenValue(localStorage.getItem(key))
  } catch {
    return undefined
  }
}

export function writeCachedCommunityPostIsOpen(key: string, value: number): void {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  const parsed = parseCommunityPostIsOpenValue(value)
  if (parsed === undefined) return
  try {
    localStorage.setItem(key, String(parsed))
  } catch {
    /* 忽略写入失败 */
  }
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
