import type {
  FeaturesNavManifest,
  FeatureNavItem,
  FeatureNavHarmonyStrategy,
  FeatureNavUniStrategy
} from '~/types/featuresNav'

function interpolate(template: string, ctx: { userId: string }): string {
  return template.replaceAll('{userId}', ctx.userId)
}

type ResolvedPlatforms = {
  uni: { strategy: FeatureNavUniStrategy; url?: string; outerUrl?: string }
  harmony: {
    strategy: FeatureNavHarmonyStrategy
    path?: string
    params?: Record<string, string>
    url?: string
  }
}

function resolvePlatforms(item: FeatureNavItem): ResolvedPlatforms {
  return {
    uni: {
      strategy: item.uniapp?.strategy ?? 'outer',
      url: item.uniapp?.url,
      outerUrl: item.uniapp?.outerUrl
    },
    harmony: {
      strategy: item.harmony?.strategy ?? 'outlink',
      path: item.harmony?.path,
      params: item.harmony?.params,
      url: item.harmony?.url
    }
  }
}

type UniNavigateFn = (opts: {
  url: string
  fail?: (err?: unknown) => void
}) => void

function pickNavigateTo(
  mod: unknown
): { navigateTo: UniNavigateFn; ctx: object } | null {
  if (!mod || typeof mod !== 'object') return null
  const inner = (mod as { default?: unknown }).default ?? mod
  if (!inner || typeof inner !== 'object') return null
  const nt = (inner as { navigateTo?: UniNavigateFn }).navigateTo
  if (typeof nt !== 'function') return null
  return { navigateTo: nt, ctx: inner as object }
}

/** 与 layout、wardrobe/detail 一致：dynamic import 取 navigateTo */
async function loadUniNavigateTo(): Promise<UniNavigateFn | undefined> {
  if (!import.meta.client) return undefined
  const mod = await import('@dcloudio/uni-webview-js').catch(() => null)
  if (!mod) return undefined
  const picked = pickNavigateTo(mod)
  if (!picked) return undefined
  return picked.navigateTo.bind(picked.ctx)
}

function isInUniAppShell(): boolean {
  return (
    import.meta.client &&
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  )
}

function resolveHarmonyParams(
  params: Record<string, string> | undefined,
  ctx: { userId: string }
): Record<string, string | number> {
  if (!params) return {}
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    const s = interpolate(v, ctx)
    if (
      (k === 'id' || k.endsWith('Id')) &&
      /^\d+$/.test(s)
    ) {
      out[k] = Number(s)
    } else {
      out[k] = s
    }
  }
  return out
}

export function useFeaturesPlatformNav(manifest: FeaturesNavManifest) {
  const router = useRouter()
  const configStore = useConfigStore()
  const port = computed(() => configStore.getPort())
  const { user } = storeToRefs(useUserStore())

  let uniNavigateTo: UniNavigateFn | undefined
  let uniLoadPromise: Promise<void> | null = null

  /**
   * Html5Plus 内优先用 layout 注入的 uniWebviewJs（与 wardrobe、SafeRichText 一致），
   * 避免首屏竞态时再兜底 dynamic import。
   */
  async function ensureUni(): Promise<void> {
    if (!isInUniAppShell()) return
    const fromStore = configStore.uniWebviewJs
    if (fromStore && typeof fromStore.navigateTo === 'function') {
      uniNavigateTo = fromStore.navigateTo.bind(fromStore)
      return
    }
    if (uniNavigateTo) return
    if (!uniLoadPromise) {
      uniLoadPromise = (async () => {
        uniNavigateTo = await loadUniNavigateTo()
      })()
    }
    await uniLoadPromise
  }

  /** 解析 path 模板；需要登录且无 userId 时返回 fallbackPath */
  function resolvedPath(item: FeatureNavItem): string {
    const uid = user.value?.user_id != null ? String(user.value.user_id) : ''
    if (item.requiresUserId && !uid) {
      return item.fallbackPath ?? '/register'
    }
    return interpolate(item.path, { userId: uid })
  }

  function absoluteUrl(path: string): string {
    const origin = manifest.siteOrigin.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${origin}${p}`
  }

  async function go(item: FeatureNavItem): Promise<void> {
    const path = resolvedPath(item)
    const ctx = {
      userId:
        user.value?.user_id != null ? String(user.value.user_id) : ''
    }
    const pf = resolvePlatforms(item)

    await ensureUni()

    if (isInUniAppShell() && uniNavigateTo) {
      if (pf.uni.strategy === 'native' && pf.uni.url) {
        const url = interpolate(pf.uni.url, ctx)
        uniNavigateTo({
          url,
          fail: () => {
            console.warn('[featuresNav] uni native 跳转失败', url)
          }
        })
        return
      }
      if (pf.uni.strategy === 'outer') {
        const full = pf.uni.outerUrl
          ? interpolate(pf.uni.outerUrl, ctx)
          : absoluteUrl(path)
        /**
         * 与 wardrobe/detail 一致：`outerLink` + 明文绝对地址；
         * `uni-webview-js` 会对整段 url 再 encodeURI，此处不要再 encodeURIComponent。
         */
        uniNavigateTo({
          url: `/pages/common/outerLink2?url=${full}`,
          fail: () => console.warn('[featuresNav] uni outer 跳转失败', full)
        })
        return
      }
      // router
      await router.push(path)
      return
    }

    if (port.value) {
      if (pf.harmony.strategy === 'jump' && pf.harmony.path) {
        const params = resolveHarmonyParams(pf.harmony.params, ctx)
        port.value.postMessage(
          JSON.stringify({
            type: 'jump',
            path: pf.harmony.path,
            params
          })
        )
        return
      }
      const harmonyOutUrl = pf.harmony.url
        ? interpolate(pf.harmony.url, ctx)
        : absoluteUrl(path)
      port.value.postMessage(
        JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: { url: harmonyOutUrl }
        })
      )
      return
    }

    if (!import.meta.client) return

    /** Web：功能导航统一新标签页打开，避免打断当前页 */
    const url = path.includes('://') ? path : `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    go,
    resolvedPath,
    isUniAppShell: () => isInUniAppShell(),
    hasHarmonyPort: computed(() => !!port.value)
  }
}

export const featureNavToneClasses: Record<
  string,
  {
    card: string
    iconWrap: string
    iconHover: string
    iconText: string
  }
> = {
  pink: {
    card: 'hover:bg-pink-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-pink-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-pink-200 dark:group-hover:bg-gray-600',
    iconText: 'text-pink-600 dark:text-pink-300'
  },
  purple: {
    card: 'hover:bg-purple-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-purple-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-purple-200 dark:group-hover:bg-gray-600',
    iconText: 'text-purple-600 dark:text-purple-300'
  },
  rose: {
    card: 'hover:bg-rose-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-rose-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-rose-200 dark:group-hover:bg-gray-600',
    iconText: 'text-rose-600 dark:text-rose-300'
  },
  teal: {
    card: 'hover:bg-teal-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-teal-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-teal-200 dark:group-hover:bg-gray-600',
    iconText: 'text-teal-600 dark:text-teal-300'
  },
  blue: {
    card: 'hover:bg-blue-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-blue-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-blue-200 dark:group-hover:bg-gray-600',
    iconText: 'text-blue-600 dark:text-blue-300'
  },
  green: {
    card: 'hover:bg-green-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-green-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-green-200 dark:group-hover:bg-gray-600',
    iconText: 'text-green-600 dark:text-green-300'
  },
  orange: {
    card: 'hover:bg-orange-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-orange-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-orange-200 dark:group-hover:bg-gray-600',
    iconText: 'text-orange-600 dark:text-orange-300'
  },
  yellow: {
    card: 'hover:bg-yellow-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-yellow-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-yellow-200 dark:group-hover:bg-gray-600',
    iconText: 'text-yellow-600 dark:text-yellow-300'
  },
  indigo: {
    card: 'hover:bg-indigo-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-indigo-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-indigo-200 dark:group-hover:bg-gray-600',
    iconText: 'text-indigo-600 dark:text-indigo-300'
  },
  cyan: {
    card: 'hover:bg-cyan-50 dark:hover:bg-gray-800',
    iconWrap: 'bg-cyan-100 dark:bg-gray-700',
    iconHover: 'group-hover:bg-cyan-200 dark:group-hover:bg-gray-600',
    iconText: 'text-cyan-600 dark:text-cyan-300'
  }
}
