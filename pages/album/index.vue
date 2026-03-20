<script setup lang="ts">
import { getAlbumList, getAlbumAchievementStats } from '@/api/album';
import type { AlbumAchievementStats } from '@/api/album';
import { getUserDecoBadges } from '@/api/user';
import type { UserDecoBadgeItem } from '@/api/user';
import type { PaginationResponse, Album, UserDeco } from '@/types/api';
import { BASE_IMG } from '@/utils/ipConfig';
import useScrollBottom from '@/composables/useScrollBottom';

const userStore = useUserStore();

/** 将 UserDecoBadgeItem 转为 UserDeco */
function badgeToUserDeco(item: UserDecoBadgeItem): UserDeco {
  const cover = item.cover || item.url || 'static/plan_cover/default.jpg';
  const name = item.title ?? `徽章${item.deco_id}`;
  return {
    deco_id: item.deco_id,
    pk_type: 1,
    pk_id: item.deco_id,
    foreign: { cover, name },
  };
}

// 用户徽章数据
const userBadges = ref<UserDecoBadgeItem[]>([]);
const userBadgesLoading = ref(false);
const displayBadgeStr = ref('');

const fetchUserBadges = async () => {
  if (!userStore.token) {
    userBadges.value = [];
    displayBadgeStr.value = '';
    return;
  }
  userBadgesLoading.value = true;
  try {
    const res = await getUserDecoBadges();
    userBadges.value = res.rows ?? [];
    displayBadgeStr.value = res.display_badge ?? '';
  } catch (e) {
    console.error('获取用户徽章失败:', e);
    userBadges.value = [];
    displayBadgeStr.value = '';
  } finally {
    userBadgesLoading.value = false;
  }
};

// 展示的徽章：从用户数据中取 is_displayed=1 的，转为 UserDeco（仅展示用户选中的，不重复）
const displayBadges = computed<UserDeco[]>(() => {
  const list = userBadges.value;
  const displayed = list.filter((d) => d.is_displayed === 1);
  return displayed.map(badgeToUserDeco);
});

const hasDisplayBadges = computed(() => displayBadges.value.length > 0);

// 用于强制 BadgePhysics 在配置变更后重新挂载
const displayBadgesKey = computed(() => displayBadgeStr.value || (displayBadges.value.length ? displayBadges.value.map((b) => b.deco_id).join(',') : 'empty'));
const badgesLoaded = computed(() => !userBadgesLoading.value);

// 配置徽章弹窗
const decoConfigModalOpen = ref(false);
const decoModalPosition = ref({ x: 0, y: 0 });
const decoInitialSelectedIds = computed(() =>
  displayBadgeStr.value
    ? displayBadgeStr.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : []
);

const openDecoConfig = (e?: MouseEvent) => {
  if (e) decoModalPosition.value = { x: e.clientX, y: e.clientY };
  else if (typeof window !== 'undefined') decoModalPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  decoConfigModalOpen.value = true;
};

const onDecoSaved = () => {
  fetchUserBadges();
};

const router = useRouter();
const route = useRoute();
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())

// 分页参数
const pageSize = 10;
const page = ref(Number(route.query.page) || 1);
const keywords = ref('');
const value = ref('');
const current = ref(0); // 当前选中的标签页

// 列表数据
const list = ref<Album[]>([]);
const total = ref(0);
const isLoading = ref(false);

// 成就统计
const achievementStats = ref<AlbumAchievementStats | null>(null);
const statsLoading = ref(false);
const fetchAchievementStats = async () => {
  try {
    statsLoading.value = true;
    achievementStats.value = await getAlbumAchievementStats({});
  } catch (e) {
    console.error('获取成就统计失败:', e);
  } finally {
    statsLoading.value = false;
  }
};

// 获取相册列表
const fetchList = async (page: number, pageSize: number): Promise<PaginationResponse<Album>> => {
  try {
    isLoading.value = true;
		const params = {
			page: page,
      pageSize: pageSize,
      parent_id: 0,
		}
    const response = await getAlbumList(params);
		if (params.page === 1) {
			list.value = response.rows;
			total.value = response.count;
		} else {
			list.value = [...list.value, ...response.rows];
			total.value = response.count;
		}
  } catch (error) {
    console.error('获取相册列表失败:', error);
  } finally {
    isLoading.value = false;
  }
	return {
		rows: list.value,
		count: total.value,
	}
};

// const { data, refresh } = await useAsyncData('albums', fetchList, {
//   watch: [page, keywords]
// });

// watch(data, () => {
//   if (page.value === 1) {
//     list.value = data.value?.rows ?? [];
//   } else {
//     list.value = [...list.value, ...(data.value?.rows ?? [])];
//   }
//   total.value = data.value?.count ?? 0;
// }, { immediate: true });

// 页码改变处理函数
const handlePageChange = (currentPage: number) => {
  page.value = currentPage;
};

// 加载更多
const loadMore = () => {
  if (isLoading.value) {
    return;
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize)) {
    isLoading.value = true;
    handlePageChange(page.value + 1);
  }
};

// 使用滚动到底部自动加载更多
const { isFinished } = useScrollBottom(
  async () => {
    // 加载更多数据的逻辑
    if (page.value < Math.ceil(total.value / pageSize)) {
      loadMore();
    }
  },
  {
    distance: 300, // 距离底部300px时触发
    immediate: false // 初始化时立即加载一次
  }
);

// 标签页切换
const tabsChange = (index: number) => {
  current.value = index;
  // 切换标签页时可以重新加载数据
  if (index === 0) {
    page.value = 1;
    fetchList(page.value, pageSize);
  }
};

// 搜索
const handleSearch = () => {
  keywords.value = value.value.trim();
  if (keywords.value) {
    page.value = 1;
		fetchList(page.value, pageSize);
  }
};

// 返回上一页
const goBack = () => {
  router.back();
};

// SEO 配置
useHead({
  title: '成就相册',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,成就相册,Lolita相册'
    },
    {
      name: 'description',
      content: 'Lolita成就相册'
    }
  ]
});
const layoutReady = inject('layoutReady') as Ref<boolean> | undefined;
const loadInitialData = () => {
	setTimeout(async () => {
		await fetchList(page.value, pageSize);
	});
	fetchAchievementStats();
	fetchUserBadges();
};
onMounted(async () => {
	uni = await import('@dcloudio/uni-webview-js').catch((err) => {
		console.error('Failed to load uni-webview-js:', err);
	});
	if (layoutReady ? layoutReady.value : true) {
		loadInitialData();
	}
});
watch(
	() => layoutReady?.value,
	(ready) => {
		if (ready) loadInitialData();
	},
	{ immediate: true }
);
const handleJump = (item: Album) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({
			url: `/pages/common/outerLink2?url=https://lolitalibrary.com/album/detail/${item.album_id}`,
		});
	}
	else if (port.value) {
		port.value.postMessage(JSON.stringify({
			type: 'jump',
			path: 'Outlink',
			params: {
				url: `https://lolitalibrary.com/album/detail/${item.album_id}`
			}
		}));
	} else {
		navigateTo(`/album/detail/${item.album_id}`);
	}
};
</script>

<template>
  <div class="album-page container mx-auto pb-20 overflow-hidden bg-qhx-bg min-h-screen safe-area-page">
    <!-- 状态栏高度占位（适配沉浸式/刘海屏） -->
    <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
    <!-- 页面标题 -->
    <!-- <div class="px-4 pt-6 pb-4">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">成就相册</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">记录你的 Lolita 成就与收藏</p>
    </div> -->

    <!-- 成就徽章物理展示 -->
    <div class="badge-showcase relative">
      <template v-if="hasDisplayBadges">
        <AchievementBadgePhysics :key="displayBadgesKey" :badges="displayBadges" :badge-size="40" :spawn-interval="400" />
      </template>
      <div
        v-else-if="badgesLoaded"
        class="badge-empty absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500"
      >
        <UIcon name="i-heroicons-photo" class="w-16 h-16 mb-2 opacity-50" />
        <span class="text-sm">暂无展示</span>
        <span class="text-xs mt-1">点击配置徽章选择要展示的成就</span>
      </div>
      <div
        v-else
        class="badge-loading absolute inset-0 flex items-center justify-center"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-qhx-primary" />
      </div>
      <!-- 成就统计悬浮卡片 -->
      <div class="achievement-stats-card">
        <template v-if="statsLoading">
          <div class="stats-loading">
            <span class="stats-loading-dot" />
            <span class="stats-loading-dot" />
            <span class="stats-loading-dot" />
          </div>
        </template>
        <template v-else-if="achievementStats">
          <div class="stats-card-inner">
          <div class="stats-header">
            <span class="stats-icon">✨</span>
            <span class="stats-title">成就进度</span>
          </div>
          <div class="stats-grid">
            <div class="stats-item">
              <span class="stats-value">{{ achievementStats.points }}</span>
              <span class="stats-label">成就点</span>
            </div>
            <div class="stats-item">
              <span class="stats-value">{{ achievementStats.achieved_count }}<span class="stats-divider">/</span>{{ achievementStats.total_count }}</span>
              <span class="stats-label">已达成</span>
            </div>
            <div class="stats-item stats-progress-item">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${achievementStats.progress}%` }"
                />
              </div>
              <span class="stats-label">{{ achievementStats.progress }}% 完成</span>
            </div>
            <div class="stats-item">
              <UButton
                size="xs"
                variant="soft"
                icon="i-heroicons-cog-6-tooth"
                class="config-badge-btn bg-qhx-primary/10 hover:bg-qhx-primary/20 text-qhx-primary border-qhx-primary/30"
                @click="openDecoConfig"
              >
                配置徽章
              </UButton>
            </div>
          </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 配置徽章弹窗 -->
    <AchievementDecoConfigModal
      v-model="decoConfigModalOpen"
      :trigger-position="decoModalPosition"
      :initial-selected-ids="decoInitialSelectedIds"
      @saved="onDecoSaved"
    />

    <!-- 内容区域 -->
    <div class="album-content px-4 pt-4">
      <!-- 成就相册列表 -->
      <div v-if="current === 0" class="album-list">
        <div v-if="list.length > 0" class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          <div
            v-for="item in list"
            :key="item.album_id"
            class="album-card group"
            @click="handleJump(item)"
          >
            <div class="album-card-inner">
              <div class="album-cover">
                <img
                  :src="`${BASE_IMG}${item.album_cover || 'static/plan_cover/default.jpg'}`"
                  :alt="item.album_title"
                  class="album-img"
                  loading="lazy"
                />
                <div class="album-overlay">
                  <span class="album-title">{{ item.album_title }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!isLoading" class="flex flex-col items-center justify-center py-16 text-center">
          <UIcon name="i-heroicons-photo" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <p class="text-gray-500 dark:text-gray-400">暂无成就相册</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">快去收集更多成就吧</p>
        </div>

        <!-- 加载更多组件 -->
        <QhxLoading
          :loading="isLoading"
          :page="page"
          :total="total"
          :page-size="pageSize"
          @load-more="loadMore"
        />
      </div>

      <!-- 第二个标签页（预留） -->
      <div v-if="current === 1" class="album-list">
        <div class="text-center text-gray-500 py-16">暂无内容</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album-page {
  min-height: 100vh;
}

/* 适配安全区：当状态栏由 query 传入时用 spacer，否则用 env 兜底 */
.safe-area-page {
  padding-top: env(safe-area-inset-top, 0px);
}

.badge-showcase {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.7) 50%, rgba(255, 255, 255, 0.9) 100%);
  border-radius: 0 0 1rem 1rem;
  overflow: hidden;
}

/* 成就统计悬浮卡片 - 甜美风格 */
.achievement-stats-card {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
  pointer-events: none;
  display: flex;
  justify-content: flex-start;
  padding: 0 0.5rem;
}

.config-badge-btn {
  pointer-events: auto;
}

.stats-card-inner {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid color-mix(in srgb, var(--primary-color) 30%, #e5e7eb);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--primary-color) 10%, rgba(0, 0, 0, 0.08));
  max-width: 320px;
}

.stats-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
}

.stats-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-color);
  opacity: 0.8;
  animation: stats-bounce 0.8s ease-in-out infinite alternate;
}

.stats-loading-dot:nth-child(2) { animation-delay: 0.15s; }
.stats-loading-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes stats-bounce {
  to { transform: translateY(-4px); opacity: 0.5; }
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  color: var(--primary-color);
  font-weight: 600;
  font-size: 0.9rem;
}

.stats-icon {
  font-size: 1rem;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stats-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stats-value {
  font-weight: 700;
  font-size: 1rem;
  color: var(--primary-color);
  font-variant-numeric: tabular-nums;
}

.stats-divider {
  font-weight: 500;
  color: var(--primary-color);
  opacity: 0.8;
  margin: 0 0.1rem;
}

.stats-label {
  font-size: 0.8rem;
  color: var(--primary-color);
  opacity: 0.85;
}

.stats-progress-item {
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.progress-bar {
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--primary-color) 22%, #f3f4f6);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--primary-color);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .stats-card-inner {
  background: color-mix(in srgb, var(--primary-color) 12%, rgb(30 41 59));
  border-color: color-mix(in srgb, var(--primary-color) 30%, rgb(51 65 85));
  box-shadow: 0 4px 20px color-mix(in srgb, var(--primary-color) 12%, rgba(0, 0, 0, 0.3));
}

.dark .stats-header,
.dark .stats-value,
.dark .stats-label { color: color-mix(in srgb, var(--primary-color) 90%, #f3e8ff); }
.dark .stats-divider { color: color-mix(in srgb, var(--primary-color) 80%, #e9d5ff); opacity: 0.9; }
.dark .progress-bar { background: color-mix(in srgb, var(--primary-color) 18%, rgb(51 65 85)); }
.dark .progress-fill { background: var(--primary-color); }

.dark .badge-showcase {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
}

.album-content {
  padding-top: 1rem;
}

.album-list {
  min-height: 200px;
}

/* 相册卡片 - 拍立得风格 */
.album-card {
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.album-card:hover {
  transform: translateY(-4px);
}

.album-card-inner {
  @apply bg-white dark:bg-gray-800 rounded-2xl overflow-hidden;
  box-shadow: 0 6px 24px 0 rgba(0, 0, 0, 0.08), 0 1.5px 4px 0 rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(243, 243, 243, 0.8);
  transition: box-shadow 0.3s ease;
}

.dark .album-card-inner {
  border-color: rgba(51, 65, 85, 0.6);
  box-shadow: 0 6px 24px 0 rgba(0, 0, 0, 0.3);
}

.album-card:hover .album-card-inner {
  box-shadow: 0 12px 32px 0 rgba(0, 0, 0, 0.12), 0 4px 8px 0 rgba(0, 0, 0, 0.08);
}

.dark .album-card:hover .album-card-inner {
  box-shadow: 0 12px 32px 0 rgba(0, 0, 0, 0.4);
}

.album-cover {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

.album-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.album-card:hover .album-img {
  transform: scale(1.05);
}

.album-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 50%);
  display: flex;
  align-items: flex-end;
  padding: 1rem 1.25rem;
  opacity: 0.95;
  transition: opacity 0.3s ease;
}

.album-card:hover .album-overlay {
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%);
}

.album-title {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (min-width: 768px) {
  .badge-showcase {
    margin: 0 1rem;
    border-radius: 1rem;
  }
}
</style>
