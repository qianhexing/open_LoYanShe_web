<script setup lang="ts">
/**
 * 山正查询：根据关键词检索已收录店铺列表。
 * 未搜到结果仅表示本站未收录该关键词对应店铺，不作任何「山店 / 正店」定性，详见页内提示与模板注释。
 */
import type { Shop } from '@/types/api';
import { getShopList } from '@/api/shop';
import { getBrowTimeOne, insertBrowTime } from '@/api/brow_time';
import { BASE_IMG } from '@/utils/ipConfig';
import dayjs from 'dayjs';

const openShopDetail = (shopId: number) => {
  window.open(`/shop/detail/${shopId}`, '_blank');
};

const route = useRoute();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();
const user = computed(() => userStore.user);

/** 今日访问统计（连续停留满 5 秒会触发一次上报） */
const visitCount = ref(0);
let visitRecordTimer: ReturnType<typeof setTimeout> | null = null;

const BROW_TIME_ID = () => dayjs(new Date()).format('YYYYMMDD');
const BROW_TIME_TYPE = 'shanzheng';

async function loadShopShanzhengVisitStat() {
  try {
    const row = await getBrowTimeOne({
      id: BROW_TIME_ID(),
      type: BROW_TIME_TYPE,
    });
    visitCount.value = row.count_times ?? 0;
  } catch (e) {
    if (process.client) {
      console.error('山正查询访问统计读取失败:', e);
    }
  }
}

async function recordShopShanzhengVisit() {
  try {
    await insertBrowTime({
      id: BROW_TIME_ID(),
      type: BROW_TIME_TYPE,
    });
    await loadShopShanzhengVisitStat();
  } catch (e) {
    if (process.client) {
      console.error('山正查询访问统计上报失败:', e);
    }
  }
}

/**
 * 去掉所有空白后，在相邻字符之间插入空格，交给列表接口做更松散的模糊匹配。
 */
function toSpacedFuzzyKeyword(raw: string): string {
  const compact = raw.replace(/\s+/g, '');
  if (!compact) return '';
  return Array.from(compact).join(' ');
}

/** 单次查询拉取条数上限（本页不分页） */
const listPageSize = 200;

/** 输入框绑定值 */
const inputValue = ref('');
/** 已提交的查询关键词（传入列表接口） */
const activeKeyword = ref('');
const list = ref<Shop[]>([]);
const loading = ref(false);
/** 用户是否已至少发起过一次查询（用于区分「未查询」与「无结果」） */
const hasSearched = ref(false);

const fetchList = async () => {
  const k = activeKeyword.value.trim();
  if (!k) return;
  const keyword = toSpacedFuzzyKeyword(k);
  if (!keyword) return;
  loading.value = true;
  try {
    const res = await getShopList({
      page: 1,
      pageSize: listPageSize,
      keyword,
    });
    list.value = res.rows ?? [];
  } catch (e) {
    if (process.client) {
      console.error('山正查询列表失败:', e);
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

/** 复制当前页链接（含查询关键词），便于分享 */
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

/** 从地址栏 ?q= 恢复关键词并查询（分享链接进入） */
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
  loadShopShanzhengVisitStat();
  visitRecordTimer = setTimeout(() => {
    visitRecordTimer = null;
    if (user.value?.user_id === 1) return;
    recordShopShanzhengVisit();
  }, 5000);
});

onBeforeUnmount(() => {
  if (visitRecordTimer != null) {
    clearTimeout(visitRecordTimer);
    visitRecordTimer = null;
  }
});

useHead({
  title: 'lolita店铺山正查询',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,山正查询,Lolita店铺,店铺查询',
    },
    {
      name: 'description',
      content: '按店名检索本站已收录的 Lolita 店铺，结果仅供参考',
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
          lolita店铺山正查询
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
        输入店名或关键词，查询本站已收录的店铺信息
      </p>

      <!-- 主要查询区域：居中输入框 -->
      <div class="w-full max-w-xl flex items-center gap-2 mb-10">
        <UInput
          v-model="inputValue"
          placeholder="请输入店铺名称或关键词"
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

    <!--
      业务说明（展示给用户）：
      未收录仅表示本站数据库中暂无匹配条目，不代表该店一定是「山店」；
      山正相关结论请勿单独依赖本页结果，仅作检索参考。
    -->
    <div
      v-if="hasSearched && !loading && !list.length"
      class="max-w-xl mx-auto text-center rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 px-5 py-6"
    >
      <p class="text-gray-800 dark:text-gray-200 font-medium mb-3">
        当前检索条件下，请注意：本站未收录匹配的店铺。
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        也可能仅为尚未收录，不代表一定是山店；是否构成「山」「正」等结论请勿单独依赖本页，仅供参考。
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
        v-for="shop in list"
        :key="shop.shop_id"
        class="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
        @click="openShopDetail(shop.shop_id)"
      >
        <img
          :src="`${BASE_IMG}${shop.shop_logo}`"
          :alt="shop.shop_name"
          class="w-10 h-10 shrink-0 object-cover rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 mt-0.5"
          loading="lazy"
        />
        <div class="min-w-0 flex-1 flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
            {{ shop.shop_name }}
          </span>
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400"
          >
            <span
              :class="
                shop.shop_country === 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              "
            >
              {{ shop.shop_country === 0 ? '国牌' : '日牌' }}
            </span>
            <span v-if="shop.count_library != null">
              已收录：{{ shop.count_library }} 条图鉴
            </span>
            <span v-if="shop.main_type">{{ shop.main_type }}</span>
            <span v-if="shop.good_count != null">商品：{{ shop.good_count }}</span>
            <span v-if="shop.likes != null">关注：{{ shop.likes }}</span>
          </div>
          <p
            v-if="shop.shop_describe?.trim()"
            class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed"
          >
            {{ shop.shop_describe.trim() }}
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
      <!-- 与 layouts/default 页脚一致的备案信息（本页不展示社交链接与版权） -->
      <div class="flex justify-center items-center w-full pt-2 border-t border-gray-200/90 dark:border-gray-700/90">
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
