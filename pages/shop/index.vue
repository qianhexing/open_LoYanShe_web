<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Shop, PaginationResponse } from '@/types/api'
import { getShopList } from '@/api/shop'
import QhxJellyButton from '@/components/Qhx/JellyButton.vue'
import QhxPagination from '@/components/Qhx/Pagination.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const configStore = useConfigStore()

const pageSize = 20
const page = shallowRef(Number(route.query.page) || 1)
const keyword = shallowRef('')
const value = shallowRef('')
const user = computed(() => userStore.user)

const fetchShopList = async (): Promise<PaginationResponse<Shop>> => {
  try {
    const response = await getShopList({
      page: page.value,
      pageSize,
      keyword: keyword.value,
    })
    return response
  } catch (error) {
    if (import.meta.client) {
      console.error('获取店铺列表失败:', error)
    }
    return {
      rows: [],
      count: 0,
    }
  }
}

const { data } = await useAsyncData('shops', fetchShopList, {
  watch: [page, keyword],
})

const list = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.count ?? 0)

useHead({
  title: 'Lolita店铺',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,洛丽塔店铺,Lolita,Lolita店铺,Lolita店铺汇总',
    },
    {
      name: 'description',
      content: '洛丽塔店铺汇总',
    },
  ],
})

function syncPageQuery(current: number) {
  const queryPage = Number(route.query.page) || 1
  if (queryPage === current) return
  const { page: _page, ...rest } = route.query
  router.replace({
    query: current <= 1 ? rest : { ...rest, page: String(current) },
  })
}

watch(page, (current) => {
  syncPageQuery(current)
  if (!import.meta.client) return
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
})

watch(
  () => Number(route.query.page) || 1,
  (queryPage) => {
    if (queryPage !== page.value) page.value = queryPage
  },
)

const handleSearch = () => {
  keyword.value = value.value.trim()
  page.value = 1
  syncPageQuery(1)
}

const jumpToAddShop = () => {
  router.push('/addShop')
}

const jumpToAddPhysicalShop = () => {
  router.push('/addPhysicalShop')
}
</script>

<template>
  <div class="min-h-screen">
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

    <div class="container mx-auto p-4 pb-20">
      <div class="shop-toolbar">
        <div class="shop-search">
          <input
            v-model="value"
            class="shop-search-input"
            type="search"
            enterkeyhint="search"
            placeholder="搜索店铺 多条件空格分割."
            @keyup.enter="handleSearch"
          >
          <QhxJellyButton>
            <button
              type="button"
              class="shop-icon-btn"
              aria-label="搜索"
              @click="handleSearch"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 21l-5.2-5.2M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </QhxJellyButton>
        </div>

        <ClientOnly>
          <div v-if="user" class="shop-actions">
            <QhxJellyButton>
              <button type="button" class="shop-action-btn is-primary" @click="jumpToAddShop">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
                补充店铺
              </button>
            </QhxJellyButton>
            <QhxJellyButton>
              <button type="button" class="shop-action-btn is-outline" @click="jumpToAddPhysicalShop">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle cx="12" cy="10" r="2.2" stroke="currentColor" stroke-width="1.8" />
                </svg>
                收录实体店
              </button>
            </QhxJellyButton>
          </div>
        </ClientOnly>
      </div>

      <div class="shop-grid">
        <div
          v-for="shop in list"
          :key="shop.shop_id"
          class="bg-white polaroid-card dark:bg-gray-900 rounded-[18px] shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center overflow-hidden border border-gray-100 dark:border-gray-800 group relative hover:bg-qhx-primary hover:text-white"
        >
          <ShopItem size="big" :item="shop" />
        </div>
      </div>

      <div v-if="total > pageSize" class="mt-8 flex justify-center">
        <QhxPagination v-model="page" :total="total" :page-size="pageSize" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 0 1rem 0.75rem;
}

.shop-search {
  display: flex;
  flex: 1 1 16rem;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.shop-search-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--border-color, #ffd1dc);
  background: var(--card-color, #fff);
  color: var(--text-color, #111827);
  font-size: 14px;
  outline: none;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.shop-search-input::placeholder {
  color: var(--textSecondary-color, #9b8a97);
}

.shop-search-input:focus {
  border-color: var(--primary-color, #ff9eb5);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color, #ff9eb5) 28%, transparent);
}

.shop-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.shop-icon-btn,
.shop-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.shop-icon-btn {
  width: 40px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-color, #4b5563);
}

.shop-icon-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 12%, transparent);
  color: var(--primary-color, #ff9eb5);
}

.shop-icon-btn svg,
.shop-action-btn svg {
  width: 18px;
  height: 18px;
}

.shop-action-btn.is-primary {
  padding: 0 14px;
  border: 1px solid var(--primary-color, #ff9eb5);
  background: var(--primary-color, #ff9eb5);
  color: var(--inverted-color, #fff);
}

.shop-action-btn.is-outline {
  padding: 0 14px;
  border: 1px solid var(--primary-color, #ff9eb5);
  background: var(--card-color, #fff);
  color: var(--primary-color, #ff9eb5);
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .shop-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .shop-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .shop-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.polaroid-card {
  box-shadow: 0 6px 24px 0 rgba(0, 0, 0, 0.1), 0 1.5px 4px 0 rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid #f3f3f3;
}
</style>
