<!-- 场景模型关联编辑：links[] = { type, id } -->
<template>
  <QhxModal v-model="open">
    <div class="scene-page-neu scene-link-detail-shell">
      <header class="scene-link-detail-head">
        <div class="scene-link-detail-head__icon scene-neu-icon-orb scene-neu-icon-orb--violet">
          <UIcon name="i-heroicons-link" class="text-[#fff] text-base" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="scene-link-detail-head__title">模型关联</h3>
          <p class="scene-link-detail-head__sub">
            浏览时点击模型可查看关联；已添加 {{ draftLinks.length }} 项
          </p>
        </div>
        <button
          type="button"
          class="scene-link-detail-close"
          aria-label="关闭"
          @click="open = false"
        >
          <UIcon name="i-heroicons-x-mark" class="text-lg" />
        </button>
      </header>

      <div class="scene-link-detail-body">
        <p class="scene-link-edit-hint">
          当前支持衣柜，后续可扩展图鉴、文本等。
        </p>

        <ul v-if="draftLinks.length" class="scene-link-edit-list">
          <li
            v-for="(link, index) in draftLinks"
            :key="sceneObjectLinkKey(link) + '-' + index"
            class="scene-link-edit-row"
          >
            <span
              class="scene-neu-icon-orb shrink-0 scene-neu-icon-orb--violet scene-link-edit-row__orb"
            >
              <UIcon
                :name="link.type === 'library' ? 'i-heroicons-book-open' : 'i-heroicons-archive-box'"
                class="text-white text-xs"
              />
            </span>
            <span class="scene-link-detail-tag shrink-0">
              {{ sceneObjectLinkTypeLabel(link.type) }}
            </span>
            <span class="scene-link-edit-row__id">#{{ link.id }}</span>
            <button
              type="button"
              class="scene-link-edit-row__remove"
              aria-label="移除"
              @click="removeLink(index)"
            >
              <UIcon name="i-heroicons-trash" class="text-base" />
            </button>
          </li>
        </ul>
        <p v-else class="scene-link-detail-empty py-6">暂无关联</p>

        <button
          type="button"
          class="scene-neu-opera-chip scene-neu-opera-chip--violet w-full justify-center"
          @click="pickWardrobe"
        >
          <UIcon name="i-heroicons-plus" class="mr-1" />
          关联衣柜
        </button>
      </div>

      <footer class="scene-link-edit-foot">
        <button
          type="button"
          class="scene-neu-opera-chip flex-1 justify-center"
          @click="open = false"
        >
          取消
        </button>
        <button
          type="button"
          class="scene-neu-opera-chip scene-neu-opera-chip--violet flex-1 justify-center"
          @click="confirm"
        >
          保存
        </button>
      </footer>
    </div>
  </QhxModal>

  <WardrobeChoose
    ref="wardrobeChooseRef"
    :multiple="false"
    :user_id="pickerUserId"
    @choose="onWardrobeChosen"
  />
</template>

<script setup lang="ts">
import type { Wardrobe } from '@/types/api'
import type WardrobeChoose from '@/components/Wardrobe/WardrobeChoose.vue'
import {
  type SceneObjectLink,
  sceneObjectLinkKey,
  sceneObjectLinkTypeLabel,
  normalizeSceneObjectLinks
} from '@/utils/sceneObjectLink'

const props = defineProps<{
  /** 衣柜选择器用户 id（通常为场景作者） */
  pickerUserId: number
}>()

const emit = defineEmits<{
  save: [links: SceneObjectLink[]]
}>()

const open = defineModel<boolean>({ default: false })
const draftLinks = ref<SceneObjectLink[]>([])
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChoose> | null>(null)
const toast = useToast()

watch(open, (v) => {
  if (!v) draftLinks.value = []
})

function show(links: SceneObjectLink[]) {
  draftLinks.value = normalizeSceneObjectLinks(links)
  open.value = true
}

function pickWardrobe() {
  wardrobeChooseRef.value?.showModel()
}

function onWardrobeChosen(wards: Wardrobe[]) {
  const w = wards[0]
  if (!w?.wardrobe_id) return
  const link: SceneObjectLink = {
    type: 'wardrobe',
    id: w.wardrobe_id
  }
  const key = sceneObjectLinkKey(link)
  if (draftLinks.value.some(l => sceneObjectLinkKey(l) === key)) {
    toast.add({
      title: '该衣柜已关联',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    return
  }
  draftLinks.value = [...draftLinks.value, link]
}

function removeLink(index: number) {
  draftLinks.value = draftLinks.value.filter((_, i) => i !== index)
}

function confirm() {
  emit('save', normalizeSceneObjectLinks(draftLinks.value))
  open.value = false
}

defineExpose({ show })
</script>
