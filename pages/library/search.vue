<script setup lang="ts">
/**
 * 图鉴信息查询：按关键词检索本站已收录图鉴条目。
 */
import type { Library } from '@/types/api';
import { getLibraryList } from '@/api/library';
import { getBrowTimeOne, insertBrowTime } from '@/api/brow_time';
import { BASE_IMG } from '@/utils/ipConfig';
import dayjs from 'dayjs';

const openLibraryDetail = (libraryId: number) => {
  window.open(`/library/detail/${libraryId}`, '_blank');
};

const route = useRoute();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();
const user = computed(() => userStore.user);

const visitCount = ref(0);
let visitRecordTimer: ReturnType<typeof setTimeout> | null = null;

const BROW_TIME_ID = () => dayjs(new Date()).format('YYYYMMDD');
const BROW_TIME_TYPE = 'library_search';

async function loadLibrarySearchVisitStat() {
  try {
    const row = await getBrowTimeOne({
      id: BROW_TIME_ID(),
      type: BROW_TIME_TYPE,
    });
    visitCount.value = row.count_times ?? 0;
  } catch (e) {
    if (process.client) {
      console.error('图鉴查询访问统计读取失败:', e);
    }
  }
}

async function recordLibrarySearchVisit() {
  try {
    await insertBrowTime({
      id: BROW_TIME_ID(),
      type: BROW_TIME_TYPE,
    });
    await loadLibrarySearchVisitStat();
  } catch (e) {
    if (process.client) {
      console.error('图鉴查询访问统计上报失败:', e);
    }
  }
}

function toSpacedFuzzyKeyword(raw: string): string {
  const compact = raw.replace(/\s+/g, '');
  if (!compact) return '';
  return Array.from(compact).join(' ');
}

const listPageSize = 200;

const inputValue = ref('');
const activeKeyword = ref('');
const list = ref<Library[]>([]);
const loading = ref(false);
const hasSearched = ref(false);

const fetchList = async () => {
  const k = activeKeyword.value.trim();
  if (!k) return;
  const keyword = toSpacedFuzzyKeyword(k);
  if (!keyword) return;
  loading.value = true;
  try {
    const res = await getLibraryList({
      page: 1,
      pageSize: listPageSize,
      keyword,
      filter_list: [],
      need_Statistics: true,
      parent_id: true,
      sort: 0,
    });
    list.value = res.rows ?? [];
  } catch (e) {
    if (process.client) {
      console.error('图鉴查询列表失败:', e);
    }
    list.value = [];
  } finally {
    loading.value = false;
  }
};

const handleSearch = async () => {
  const k = inputValue.value.trim();
  if (!k) return;
  hasSearched.value = true;
  activeKeyword.value = k;
  await router.replace({ query: { ...route.query, q: k } });
  await fetchList();
};

const handleShareLink = async () => {
  try {
    const { copyCurrentUrl } = useCopyCurrentUrl();
    const result = await copyCurrentUrl();
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '可将本页链接分享给他人',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      });
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message || '请手动复制地址栏链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange',
      });
    }
  } catch {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    });
  }
};

function applyQueryAndFetch() {
  const raw = route.query.q;
  const q = typeof raw === 'string' ? raw.trim() : '';
  if (!q) return;
  inputValue.value = q;
  hasSearched.value = true;
  activeKeyword.value = q;
  void fetchList();
}

onMounted(() => {
  applyQueryAndFetch();
  loadLibrarySearchVisitStat();
  visitRecordTimer = setTimeout(() => {
    visitRecordTimer = null;
    if (user.value?.user_id === 1) return;
    recordLibrarySearchVisit();
  }, 5000);
});

onBeforeUnmount(() => {
  if (visitRecordTimer != null) {
    clearTimeout(visitRecordTimer);
    visitRecordTimer = null;
  }
});

useHead({
  title: 'lolita图鉴信息查询',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,图鉴查询,Lolita图鉴,裙子图鉴',
    },
    {
      name: 'description',
      content: '按名称或关键词检索本站已收录的 Lolita 图鉴信息',
    },
  ],
});
</script>

<template>
  <div class="min-h-screen pb-28 md:pb-32">
    <NuxtLink
      to="/"
      class="fixed z-40 left-3 md:left-4 flex items-center rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200/80 dark:border-gray-700 px-3 py-2 text-base font-bold text-gray-900 dark:text-white shadow-sm hover:opacity-90 transition-opacity"
      :style="{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }"
      aria-label="返回 Lo研社 主页"
    >
      Lo 研社
    </NuxtLink>

    <div class="container mx-auto px-4 min-h-[70vh]">
      <div class="flex flex-col items-center pt-16 md:pt-20">
        <div class="flex items-center justify-center gap-2 flex-wrap mb-2 w-full max-w-xl">
          <h1 class="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center">
            lolita图鉴信息查询
          </h1>
          <UButton
            icon="i-heroicons-share"
            variant="ghost"
            color="gray"
            size="sm"
            class="shrink-0"
            aria-label="复制分享链接"
            @click.stop="handleShareLink"
          >
            分享链接
          </UButton>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-lg mb-8">
          输入裙子名称、店铺名或关键词，查询本站已收录的图鉴条目
        </p>

        <div class="w-full max-w-xl flex items-center gap-2 mb-10">
          <UInput
            v-model="inputValue"
            placeholder="请输入图鉴名称或关键词"
            class="flex-1 focus:ring-0"
            @keyup.enter="handleSearch"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline:
                    'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary',
                },
              },
            }"
          />
          <UButton color="primary" :loading="loading" @click="handleSearch">
            查询
          </UButton>
        </div>
      </div>

      <div
        v-if="hasSearched && !loading && !list.length"
        class="max-w-xl mx-auto text-center rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 px-5 py-6"
      >
        <p class="text-gray-800 dark:text-gray-200 font-medium mb-3">
          当前检索条件下，本站未收录匹配的图鉴条目。
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          可能尚未录入或关键词需调整；结果仅供参考，完整筛选可前往图鉴主页。
        </p>
      </div>

      <div v-else-if="loading" class="flex justify-center items-center min-h-[200px]">
        <span class="text-gray-500 text-sm">加载中…</span>
      </div>

      <ul
        v-else-if="list.length"
        class="max-w-2xl mx-auto w-full border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm"
      >
        <li
          v-for="lib in list"
          :key="lib.library_id"
          class="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
          @click="openLibraryDetail(lib.library_id)"
        >
          <img
            :src="`${BASE_IMG}${lib.cover}?x-oss-process=image/quality,q_80/resize,w_120,h_120`"
            :alt="lib.name"
            class="w-12 h-12 shrink-0 object-cover rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 mt-0.5"
            loading="lazy"
          />
          <div class="min-w-0 flex-1 flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
              {{ lib.name }}
            </span>
            <div
              class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400"
            >
              <span
                v-if="lib.shop_country != null"
                :class="
                  lib.shop_country === 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                "
              >
                {{ lib.shop_country === 0 ? '国牌' : '日牌' }}
              </span>
              <span v-if="lib.shop?.shop_name">{{ lib.shop.shop_name }}</span>
              <span v-if="lib.library_type">{{ lib.library_type }}</span>
              <span v-if="lib.state">{{ lib.state }}</span>
              <span v-if="lib.color">{{ lib.color }}</span>
            </div>
            <p
              v-if="lib.notes?.trim()"
              class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed"
            >
              {{ lib.notes.trim() }}
            </p>
          </div>
        </li>
      </ul>
    </div>

    <div
      class="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
      style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom, 0px))"
    >
      <div class="container mx-auto px-4 py-2.5 flex flex-col items-center gap-2">
        <div class="flex justify-center items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-eye" class="shrink-0" />
          <span>今日访问</span>
          <span class="tabular-nums text-gray-700 dark:text-gray-300">{{ visitCount }}</span>
        </div>
        <div
          class="flex justify-center items-center w-full pt-2 border-t border-gray-200/90 dark:border-gray-700/90"
        >
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <img
              src="https://lolitalibrary.com/ali/static/batb.png"
              alt="备案图标"
              class="h-4 w-auto"
            />
            <span class="text-xs">闽ICP备19007279号-1</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
