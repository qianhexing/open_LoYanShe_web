<!-- 场景关联详情：拟态玻璃风格 + 按类型拉取详情 + 跨平台跳转 -->
<template>
  <QhxModal v-model="visible" :trigger-position="clickPosition">
    <div class="scene-page-neu scene-link-detail-shell">
      <header class="scene-link-detail-head">
        <div class="scene-link-detail-head__icon scene-neu-icon-orb scene-neu-icon-orb--violet">
          <UIcon name="i-heroicons-link" class="text-[#fff] text-base" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="scene-link-detail-head__title">关联详情</h3>
          <p class="scene-link-detail-head__sub">
            {{ loading ? '加载中…' : `共 ${rows.length} 项` }}
          </p>
        </div>
        <button
          type="button"
          class="scene-link-detail-close"
          aria-label="关闭"
          @click="visible = false"
        >
          <UIcon name="i-heroicons-x-mark" class="text-lg" />
        </button>
      </header>

      <div class="scene-link-detail-body">
        <div v-if="loading" class="scene-link-detail-loading">
          <div class="scene-neu-icon-orb scene-neu-icon-orb--violet">
            <UIcon name="i-heroicons-arrow-path" class="text-white text-xl animate-spin" />
          </div>
          <span class="text-sm text-gray-600 dark:text-gray-300 mt-4">正在获取详情</span>
        </div>

        <template v-else-if="rows.length">
          <article
            v-for="(row, index) in rows"
            :key="sceneObjectLinkKey(row.link) + '-' + index"
            class="scene-link-detail-card"
          >
            <div class="scene-link-detail-card__badge">
              <span
                class="scene-neu-icon-orb shrink-0"
                :class="linkTypeOrbClass(row.link.type)"
              >
                <UIcon :name="linkTypeIcon(row.link.type)" class="text-white text-sm" />
              </span>
              <span class="scene-link-detail-card__type">
                {{ sceneObjectLinkTypeLabel(row.link.type) }}
              </span>
            </div>

            <div v-if="row.error" class="scene-link-detail-card__error">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 shrink-0" />
              <span>{{ row.error }}</span>
            </div>

            <template v-else-if="row.wardrobe">
              <div class="scene-link-detail-card__polaroid">
                <img
                  :src="`${BASE_IMG}${row.wardrobe.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
                  :alt="row.wardrobe.wardrobe_name || '衣柜'"
                  class="scene-link-detail-card__cover"
                  loading="lazy"
                />
                <div class="scene-link-detail-card__meta">
                  <h4 class="scene-link-detail-card__name">
                    {{ row.wardrobe.wardrobe_name || '未命名衣柜' }}
                  </h4>
                  <p
                    v-if="row.wardrobe.wardrobe_desc"
                    class="scene-link-detail-card__desc"
                  >
                    {{ row.wardrobe.wardrobe_desc }}
                  </p>
                  <div class="scene-link-detail-card__tags">
                    <span class="scene-link-detail-tag">
                      服饰 {{ formatCount(row.wardrobe.count_clothes ?? row.wardrobe.total_count) }}
                    </span>
                    <span
                      v-if="row.wardrobe.is_private"
                      class="scene-link-detail-tag scene-link-detail-tag--amber"
                    >
                      隐私
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="row.library">
              <div class="scene-link-detail-card__polaroid">
                <img
                  :src="`${BASE_IMG}${row.library.cover}`"
                  :alt="row.library.name"
                  class="scene-link-detail-card__cover"
                  loading="lazy"
                />
                <div class="scene-link-detail-card__meta">
                  <h4 class="scene-link-detail-card__name">{{ row.library.name }}</h4>
                  <p
                    v-if="row.library.shop?.shop_name"
                    class="scene-link-detail-card__desc"
                  >
                    {{ row.library.shop.shop_name }}
                  </p>
                  <div class="scene-link-detail-card__tags">
                    <span
                      v-if="row.library.library_type"
                      class="scene-link-detail-tag"
                    >
                      {{ row.library.library_type }}
                    </span>
                    <span
                      v-if="row.library.library_price != null"
                      class="scene-link-detail-tag scene-link-detail-tag--price"
                    >
                      ¥{{ row.library.library_price }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <p v-else class="scene-link-detail-card__empty">暂无预览数据</p>

            <button
              v-if="canNavigateSceneObjectLink(row)"
              type="button"
              class="scene-neu-opera-chip scene-neu-opera-chip--violet scene-link-detail-card__action w-full justify-center"
              @click="goDetail(row)"
            >
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="mr-1" />
              {{ linkDetailButtonLabel(row.link.type) }}
            </button>
          </article>
        </template>

        <p v-else class="scene-link-detail-empty">暂无关联内容</p>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import {
  type SceneObjectLink,
  type SceneObjectLinkType,
  normalizeSceneObjectLinks,
  sceneObjectLinkKey,
  sceneObjectLinkTypeLabel
} from '@/utils/sceneObjectLink'
import {
  fetchSceneObjectLinkDetails,
  type SceneObjectLinkDetailRow
} from '@/utils/sceneObjectLinkDetails'
import {
  canNavigateSceneObjectLink,
  linkDetailButtonLabel,
  linkTypeOrbClass,
  navigateSceneObjectLink,
  type SceneObjectLinkNavigateContext
} from '@/utils/sceneObjectLinkNavigate'
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig'

const props = defineProps<{
  defaultUserId?: number
  harmonyPort?: { postMessage: (msg: string) => void } | null
}>()

const toast = useToast()
const visible = ref(false)
const loading = ref(false)
const rows = ref<SceneObjectLinkDetailRow[]>([])
const clickPosition = ref({ x: 0, y: 0 })

const navigateCtx = computed((): SceneObjectLinkNavigateContext => ({
  defaultUserId: props.defaultUserId,
  port: props.harmonyPort ?? null
}))

function linkTypeIcon(type: SceneObjectLinkType): string {
  switch (type) {
    case 'wardrobe':
      return 'i-heroicons-archive-box'
    case 'library':
      return 'i-heroicons-book-open'
    case 'text':
      return 'i-heroicons-document-text'
    case 'url':
      return 'i-heroicons-link'
    default:
      return 'i-heroicons-cube'
  }
}

function formatCount(v: number | undefined | null): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return String(v)
}

function goDetail(row: SceneObjectLinkDetailRow) {
  if (navigateSceneObjectLink(row, navigateCtx.value)) {
    visible.value = false
    return
  }
  toast.add({
    title: '无法跳转',
    color: 'amber',
    icon: 'i-heroicons-information-circle'
  })
}

async function open(
  links: SceneObjectLink[],
  position?: { x: number; y: number }
) {
  const normalized = normalizeSceneObjectLinks(links)
  if (!normalized.length) return

  clickPosition.value = position ?? {
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0
  }
  visible.value = true
  loading.value = true
  rows.value = []

  try {
    rows.value = await fetchSceneObjectLinkDetails(normalized)
  } finally {
    loading.value = false
  }
}

watch(visible, (v) => {
  if (!v) {
    rows.value = []
    loading.value = false
  }
})

defineExpose({ open })
</script>
