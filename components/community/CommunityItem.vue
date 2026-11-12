<script setup lang="ts">
import type { Community } from '@/types/api'
import { ContentI18nPkType } from '@/api/content_i18n'
import { openCommunityDetailTab } from '@/composables/useLibraryDetailNavigation'
import { useContentTranslate } from '@/composables/useContentTranslate'
import {
  normalizeRawImgPath,
  parseCommunityImgList,
  withOssImageProcess,
} from '@/utils/communityLiveMedia'
import { formatRich, parseRichText, type RichNode } from '@/utils/public'

interface Props {
  item: Community
  className?: string
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}

const { t } = useI18n()
const text = ref('')
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true,
})
const { size, needJump } = props
const item = props.item

const {
  needsTranslate,
  runTranslate,
  translating,
  applyTranslateMeta,
  resolveSourceLang,
} = useContentTranslate()

function applyCommunityContent(content: string | null | undefined) {
  text.value = ''
  if (!content) return
  const rich_res = formatRich(content)
  text.value = rich_res.text
}

watch(
  () => props.item.content,
  (content) => {
    applyCommunityContent(content)
  },
  { immediate: true },
)

/** 列表缩略：封面 jpg + LIVE；preview 带 videoSrc 供 Lightbox 播放 */
const previewMediaList = computed(() => {
  const alt = item.title || t('common.brand')
  const fromContent = (item?.content ? formatRich(item.content).image : []).map((img) => ({
    src: withOssImageProcess(normalizeRawImgPath(img), 'image/quality,q_100/resize,w_200,h_200'),
    alt,
  }))
  const fromImgList = parseCommunityImgList(item?.img_list).map((m) => ({
    src: withOssImageProcess(m.displayPath, 'image/quality,q_100/resize,w_200,h_200'),
    alt,
    videoSrc: m.videoPath,
  }))
  return [...fromContent, ...fromImgList]
})

const previewLightboxList = computed(() => {
  const alt = item.title || t('common.brand')
  const fromContent = (item?.content ? formatRich(item.content).image : []).map((img) => ({
    src: normalizeRawImgPath(img),
    alt,
  }))
  const fromImgList = parseCommunityImgList(item?.img_list).map((m) => ({
    src: m.displayPath,
    videoSrc: m.videoPath,
    alt,
  }))
  return [...fromContent, ...fromImgList]
})

const handleJump = (id: number) => {
  if (!needJump) return
  openCommunityDetailTab(id)
}
const emit = defineEmits(['load'])

const load = () => {
  emit('load')
}

/** 将 HTML 中的 iframe 替换为「进入详情页查看」占位符 */
function filterIframePlaceholder(html: string): string {
  if (!html) return ''
  const label = t('community.enter_detail_placeholder')
  const placeholder = `<span class="community-iframe-placeholder inline-block px-2 py-1 rounded bg-pink-100 dark:bg-gray-700 text-pink-600 dark:text-pink-400 text-sm cursor-pointer my-1">${label}</span>`
  return html
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, placeholder)
    .replace(/<iframe[^>]*\/?>/gi, placeholder)
    .replace('60vh', '500px')
}

/** 列表预览：走 SafeRichText，避免 v-html 执行用户载荷 */
const previewNodes = computed<RichNode[]>(() => {
  if (!text.value) return []
  return parseRichText(filterIframePlaceholder(text.value))
})

const showTranslateBtn = computed(() => needsTranslate(props.item))

async function onTranslate(e: MouseEvent) {
  e.stopPropagation()
  const pkId = Number(props.item.community_id)
  if (!pkId) return
  try {
    const result = await runTranslate({
      pkType: ContentI18nPkType.Community,
      pkId,
      sourceLang: resolveSourceLang(props.item),
    })
    if (!result?.payload) return
    if (typeof result.payload.title === 'string') {
      props.item.title = result.payload.title
    }
    if (typeof result.payload.content === 'string') {
      props.item.content = result.payload.content
    }
    applyTranslateMeta(props.item, result.lang)
  } catch (err) {
    console.error(err)
  }
}
</script>
<template>
  <div :class="props.className ? props.className :'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" class="py-3">
      <div class="mx-4">
        <UserInfo v-if="item.user" :user="item.user" :size="'mini'" class="pb-2"></UserInfo>
        <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300" @click="handleJump(item.community_id)">
          {{ item.title }}
        </h3>
        <div class="community-content m-1" @click="handleJump(item.community_id)">
          <SafeRichText :nodes="previewNodes" />
        </div>
        <div
          v-if="showTranslateBtn"
          class="mt-1 mb-1 flex justify-end"
        >
          <button
            type="button"
            class="text-xs text-qhx-primary hover:underline disabled:opacity-60"
            :disabled="translating"
            @click.stop="onTranslate($event)"
          >
            {{ translating ? t('contentI18n.translating') : t('contentI18n.translate') }}
          </button>
        </div>
        <div class="flex flex-wrap w-full">
          <QhxPreviewImage
            @load="load"
            :list="previewMediaList"
            :preview="previewLightboxList"
            :className="'w-[calc(100%/3-8px)] shadow-lg m-1 object-cover aspect-[1/1] rounded-[10px] overflow-hidden'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.community-content {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.img-mask {
  background: rgba(0, 0, 0, 0.3);
  width: calc(100% - 8px);
  left: 4px;
  top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
}
</style>
