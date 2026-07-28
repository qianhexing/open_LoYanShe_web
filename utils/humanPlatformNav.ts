import { isRadLodSplatUrl } from '@/utils/materiaModelKind'

export const HUMAN_PLATFORM_ORIGIN = 'https://lolitalibrary.com'

/** 人台地址是否含 rad（Spark 2 LoD） */
export function libraryVideoAddrIsRad(addr?: string | null): boolean {
  if (!addr) return false
  return addr.split(',').some((part) => isRadLodSplatUrl(part.trim()))
}

export type BuildHumanPlatformNavOptions = {
  videoId: number | string
  libraryId?: number | string | null
  /** 模型地址；非 rad 走旧版 /pc/humanPlatform */
  addr?: string | null
  /** 仅新版路径附加 query */
  query?: Record<string, string | number | boolean | null | undefined>
}

export type HumanPlatformNav = {
  path: string
  isLegacy: boolean
  fullUrl: string
}

/**
 * 按模型格式生成人台路径：
 * - rad → `/humanPlatform/:id`
 * - 非 rad → `/pc/humanPlatform/:id`（旧版）
 */
export function buildHumanPlatformNav(
  options: BuildHumanPlatformNavOptions,
): HumanPlatformNav {
  const { videoId, libraryId, addr, query } = options
  const isLegacy = !libraryVideoAddrIsRad(addr)

  if (isLegacy) {
    const path = `/pc/humanPlatform/${videoId}`
    return {
      path,
      isLegacy: true,
      fullUrl: `${HUMAN_PLATFORM_ORIGIN}${path}`,
    }
  }

  const q = new URLSearchParams()
  if (libraryId != null && libraryId !== '') {
    q.set('library_id', String(libraryId))
  }
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') q.set(key, String(value))
    }
  }
  const qs = q.toString()
  const path = qs ? `/humanPlatform/${videoId}?${qs}` : `/humanPlatform/${videoId}`
  return {
    path,
    isLegacy: false,
    fullUrl: `${HUMAN_PLATFORM_ORIGIN}${path}`,
  }
}
