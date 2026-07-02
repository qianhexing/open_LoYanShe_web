import { getAlbumList, getAlbumAchievementStats } from '@/api/album'
import type { AlbumAchievementStats } from '@/api/album'
import { getUserDecoBadges } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import type { Album, UserDeco } from '@/types/api'

const PAGE_SIZE = 10

function badgeToUserDeco(item: UserDecoBadgeItem): UserDeco {
  const cover = item.cover || item.url || 'static/plan_cover/default.jpg'
  const name = item.title ?? `徽章${item.deco_id}`
  return {
    deco_id: item.deco_id,
    pk_type: 1,
    pk_id: item.deco_id,
    foreign: { cover, name },
  }
}

export function getAlbumItemProgress(item: Album) {
  const total = item.count ?? 0
  const achieved = item.count_achieve ?? 0
  if (!total) return 0
  return Math.min(100, Math.round((achieved / total) * 100))
}

export function isAlbumItemCompleted(item: Album) {
  const total = item.count ?? 0
  if (!total) return false
  return (item.count_achieve ?? 0) >= total
}

export function useAlbumIndexPage() {
  const userStore = useUserStore()

  const userBadges = ref<UserDecoBadgeItem[]>([])
  const userBadgesLoading = ref(false)
  const displayBadgeStr = ref('')

  const achievementStats = ref<AlbumAchievementStats | null>(null)
  const statsLoading = ref(false)

  const list = ref<Album[]>([])
  const total = ref(0)
  const page = ref(1)
  const listLoading = ref(false)
  const listLoadingMore = ref(false)

  const displayBadges = computed<UserDeco[]>(() =>
    userBadges.value
      .filter((item) => item.is_displayed === 1)
      .map(badgeToUserDeco),
  )

  const hasDisplayBadges = computed(() => displayBadges.value.length > 0)
  const badgesLoaded = computed(() => !userBadgesLoading.value)
  const displayBadgesKey = computed(
    () =>
      displayBadgeStr.value ||
      (displayBadges.value.length
        ? displayBadges.value.map((badge) => badge.deco_id).join(',')
        : 'empty'),
  )

  const hasMoreAlbums = computed(() => list.value.length < total.value)

  const fetchUserBadges = async () => {
    if (!userStore.token) {
      userBadges.value = []
      displayBadgeStr.value = ''
      return
    }

    userBadgesLoading.value = true
    try {
      const res = await getUserDecoBadges()
      userBadges.value = res.rows ?? []
      displayBadgeStr.value = res.display_badge ?? ''
    } catch (error) {
      console.error('获取用户徽章失败:', error)
      userBadges.value = []
      displayBadgeStr.value = ''
    } finally {
      userBadgesLoading.value = false
    }
  }

  const fetchAchievementStats = async () => {
    statsLoading.value = true
    try {
      achievementStats.value = await getAlbumAchievementStats({})
    } catch (error) {
      console.error('获取成就统计失败:', error)
      achievementStats.value = null
    } finally {
      statsLoading.value = false
    }
  }

  const loadAlbumList = async (isLoadMore = false) => {
    if (isLoadMore) {
      if (listLoadingMore.value || !hasMoreAlbums.value) return
      listLoadingMore.value = true
    } else {
      listLoading.value = true
      page.value = 1
      list.value = []
    }

    try {
      const res = await getAlbumList({
        page: page.value,
        pageSize: PAGE_SIZE,
        parent_id: 0,
      })
      total.value = res.count ?? 0
      const rows = res.rows ?? []
      if (isLoadMore) {
        list.value.push(...rows)
      } else {
        list.value = rows
      }
    } catch (error) {
      console.error('获取相册列表失败:', error)
      if (!isLoadMore) {
        list.value = []
        total.value = 0
      }
    } finally {
      listLoading.value = false
      listLoadingMore.value = false
    }
  }

  const loadMoreAlbums = async () => {
    if (!hasMoreAlbums.value || listLoading.value || listLoadingMore.value) return
    page.value += 1
    await loadAlbumList(true)
  }

  const refreshPage = async () => {
    await Promise.all([
      fetchUserBadges(),
      fetchAchievementStats(),
      loadAlbumList(false),
    ])
  }

  return {
    PAGE_SIZE,
    userBadges,
    userBadgesLoading,
    displayBadgeStr,
    achievementStats,
    statsLoading,
    list,
    total,
    page,
    listLoading,
    listLoadingMore,
    displayBadges,
    hasDisplayBadges,
    badgesLoaded,
    displayBadgesKey,
    hasMoreAlbums,
    fetchUserBadges,
    fetchAchievementStats,
    loadAlbumList,
    loadMoreAlbums,
    refreshPage,
  }
}
