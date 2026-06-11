<script setup lang="ts">
import type { PhysicalShop } from '@/types/api'
import type { CommunityPostForeignContext } from '@/utils/communityPost'
import CommunityForeignList from '@/components/community/CommunityForeignList.vue'
import type CommunityPostModal from '@/components/community/CommunityPostModal.vue'
import { BASE_IMG } from '@/utils/ipConfig'

/** 实体店返帖 community foreign pk_type */
const PHYSICAL_SHOP_FOREIGN_PK_TYPE = 1 as const

interface Props {
  fallbackLogo?: string
}

const props = defineProps<Props>()

const show = ref(false)
const info = ref<PhysicalShop | null>(null)
const foreignRefreshKey = ref(0)
const showPostModal = ref(false)
const postModalRef = ref<InstanceType<typeof CommunityPostModal> | null>(null)

const addressText = computed(() => formatPhysicalShopAddress(info.value))

const logoSrc = computed(() => {
  const logo = info.value?.physical_logo
  if (logo) return `${BASE_IMG}${logo}`
  if (props.fallbackLogo) return `${BASE_IMG}${props.fallbackLogo}`
  return `${BASE_IMG}static/plan_cover/default.jpg`
})

const mapLink = computed(() => buildPhysicalShopMapLink(info.value, addressText.value))

const foreignPk = computed((): CommunityPostForeignContext | null => {
  const pid = info.value?.physical_id
  if (pid == null) return null
  return { pk_id: pid, pk_type: PHYSICAL_SHOP_FOREIGN_PK_TYPE }
})

function formatPhysicalShopAddress(shop: PhysicalShop | null | undefined) {
  if (!shop) return ''
  return [shop.province, shop.city, shop.area, shop.address].filter(Boolean).join('')
}

function buildPhysicalShopMapLink(shop: PhysicalShop | null | undefined, address: string) {
  if (!shop) return ''
  const lat = shop.latitude
  const lng = shop.longitude
  if (lat != null && lat !== '' && lng != null && lng !== '') {
    const title = encodeURIComponent(shop.physical_name || '实体店')
    const content = encodeURIComponent(address || '')
    return `https://api.map.baidu.com/marker?location=${lat},${lng}&title=${title}&content=${content}&output=html`
  }
  if (address) {
    return `https://api.map.baidu.com/geocoder?address=${encodeURIComponent(address)}&output=html`
  }
  return ''
}

function showModel(item: PhysicalShop) {
  info.value = item
  show.value = true
}

function closeModel() {
  show.value = false
}

function openAddMemory(e?: MouseEvent) {
  if (!foreignPk.value) return
  showPostModal.value = true
  nextTick(() => postModalRef.value?.open(e))
}

function onPostSuccess() {
  showPostModal.value = false
  foreignRefreshKey.value += 1
}

defineExpose({ showModel, closeModel })
</script>

<template>
  <QhxModal v-model="show" :close-on-backdrop="true" @close="closeModel">
    <div class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50/90 to-orange-50/80 dark:from-gray-800 dark:to-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
          {{ info?.physical_name || '实体店' }}
        </h2>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          aria-label="关闭"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <div class="overflow-y-auto flex-1 p-4 space-y-4">
        <div
          v-if="info"
          class="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gradient-to-r from-white to-gray-50/60 dark:from-gray-800/80 dark:to-gray-800/40 p-3 flex gap-3 items-start"
        >
          <img
            :src="logoSrc"
            :alt="info.physical_name || '实体店'"
            class="w-[70px] h-[70px] rounded-xl object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0 shadow-sm"
            loading="lazy"
          />
          <p class="text-sm text-gray-600 dark:text-gray-300 flex-1 leading-relaxed">
            {{ info.physical_desc || '暂无简介' }}
          </p>
        </div>

        <div
          v-if="addressText"
          class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 px-1"
        >
          <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-qhx-primary shrink-0 mt-0.5" />
          <span class="flex-1">{{ addressText }}</span>
        </div>

        <div v-if="mapLink" class="flex justify-start px-1">
          <QhxJellyButton>
            <a
              :href="mapLink"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
            >
              <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
              打开地图导航
              <UIcon name="i-heroicons-arrow-up-right" class="w-3.5 h-3.5" />
            </a>
          </QhxJellyButton>
        </div>

        <div class="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
            分享你与这家实体店相关的返帖，或发布新帖关联
          </p>
          <div class="flex justify-center mb-4">
            <QhxJellyButton>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
                @click="openAddMemory"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                投稿返帖
              </button>
            </QhxJellyButton>
          </div>

          <CommunityForeignList
            v-if="info?.physical_id"
            :key="foreignRefreshKey"
            :pk_type="PHYSICAL_SHOP_FOREIGN_PK_TYPE"
            :pk_id="info.physical_id"
            :can_load="show"
            :single-column="true"
          />
        </div>
      </div>
    </div>
  </QhxModal>

  <CommunityPostModal
    ref="postModalRef"
    v-model="showPostModal"
    :foreign-pk="foreignPk"
    modal-title="投稿返帖"
    :skip-summary-link="true"
    :success-redirect="false"
    @success="onPostSuccess"
  />
</template>
