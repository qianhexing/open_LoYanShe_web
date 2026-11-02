<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'
import { showToast } from '@/utils/qhxToast'

const props = withDefaults(
  defineProps<{
    title?: string
    options?: optionsInterface[]
    multiple?: boolean
    canCustomize?: boolean
    maxLength?: number
    emptyConfirmMessage?: string
    searchPlaceholder?: string
    customizePlaceholder?: string
    confirmText?: string
    zIndex?: number
    /** 不可删除的词条 value / label（如默认拥有状态） */
    undeletableValues?: Array<string | number>
  }>(),
  {
    title: '请选择',
    options: () => [],
    multiple: true,
    canCustomize: false,
    maxLength: 8,
    emptyConfirmMessage: '请先选择',
    searchPlaceholder: '搜索词条',
    customizePlaceholder: '自定义词条',
    confirmText: '确认选择',
    zIndex: 220,
    undeletableValues: () => [],
  },
)

const emit = defineEmits<{
  select: [list: optionsInterface[]]
  delete: [item: optionsInterface]
}>()

const show = shallowRef(false)
const keywords = shallowRef('')
const customize = shallowRef('')
const chooseList = ref<optionsInterface[]>([])
const clickPosition = ref({ x: 0, y: 0 })
const showDeleteConfirm = shallowRef(false)
const pendingDelete = ref<optionsInterface | null>(null)
const deleteClickPosition = ref({ x: 0, y: 0 })

function isDeletable(item: optionsInterface) {
  if (!props.canCustomize) return false
  return !(props.undeletableValues ?? []).some(
    (value) => String(value) === String(item.value) || String(value) === item.label,
  )
}

function isSame(a: optionsInterface, b: optionsInterface) {
  return String(a.value) === String(b.value) || a.label === b.label
}

function isChosen(item: optionsInterface) {
  return chooseList.value.some((chosen) => isSame(chosen, item))
}

const filteredOptions = computed(() => {
  const kw = keywords.value.trim().toLowerCase()
  return (props.options ?? []).filter((opt) => {
    if (!kw) return true
    return opt.label.toLowerCase().includes(kw)
  })
})

const canAddKeywordsAsCustom = computed(() => {
  if (!props.canCustomize) return false
  const kw = keywords.value.trim()
  if (!kw) return false
  const existsInOptions = (props.options ?? []).some((opt) => opt.label === kw)
  const existsInChosen = chooseList.value.some((item) => item.label === kw)
  return !existsInOptions && !existsInChosen
})

function resetState() {
  keywords.value = ''
  customize.value = ''
  chooseList.value = []
  closeDeleteConfirm()
}

function showPicker(event?: MouseEvent, selected: optionsInterface[] = []) {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }
  chooseList.value = selected.map((item) => ({ ...item }))
  keywords.value = ''
  customize.value = ''
  show.value = true
}

function closeModel() {
  show.value = false
  resetState()
}

function handleClose() {
  resetState()
}

function choose(item: optionsInterface) {
  if (!props.multiple) {
    chooseList.value = [{ ...item }]
    return
  }
  if (!chooseList.value.some((chosen) => isSame(chosen, item))) {
    chooseList.value.push({ ...item })
  }
}

function removeChosen(item: optionsInterface) {
  const index = chooseList.value.findIndex((chosen) => isSame(chosen, item))
  if (index !== -1) chooseList.value.splice(index, 1)
}

function addCustomLabel(raw: string) {
  const label = raw.trim()
  if (!label) return false
  const item: optionsInterface = { value: label, label }
  if (!props.multiple) {
    chooseList.value = [item]
    return true
  }
  if (!chooseList.value.some((chosen) => chosen.label === label)) {
    chooseList.value.push(item)
  }
  return true
}

function addCustomize() {
  if (!customize.value.trim()) {
    showToast('请输入自定义词条', { color: 'amber' })
    return
  }
  if (!addCustomLabel(customize.value)) return
  customize.value = ''
}

function addKeywordsAsCustom() {
  if (!addCustomLabel(keywords.value)) return
  keywords.value = ''
}

function onSearchEnter() {
  const kw = keywords.value.trim()
  if (!kw) return
  const exact = filteredOptions.value.find((opt) => opt.label === kw)
    ?? (props.options ?? []).find((opt) => opt.label === kw)
  if (exact) {
    choose(exact)
    keywords.value = ''
    return
  }
  if (props.canCustomize) addKeywordsAsCustom()
}

function confirm() {
  if (customize.value.trim()) addCustomize()
  if (chooseList.value.length === 0) {
    showToast(props.emptyConfirmMessage, { color: 'red' })
    return
  }
  emit('select', chooseList.value.map((item) => ({ ...item })))
  closeModel()
}

function askDelete(item: optionsInterface, event: MouseEvent) {
  event.stopPropagation()
  if (!isDeletable(item)) return
  pendingDelete.value = item
  deleteClickPosition.value = { x: event.clientX, y: event.clientY }
  showDeleteConfirm.value = true
}

function closeDeleteConfirm() {
  showDeleteConfirm.value = false
  pendingDelete.value = null
}

function confirmDelete() {
  const item = pendingDelete.value
  if (!item) return
  emit('delete', { ...item })
  removeChosen(item)
  closeDeleteConfirm()
}

defineExpose({
  showPicker,
  closeModel,
})
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :z-index="zIndex" @close="handleClose">
    <div class="w-[95vw] max-w-3xl h-[60vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
          </h2>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            @click="closeModel"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>
        <div class="flex items-center gap-2 mb-4">
          <UInput
            v-model="keywords"
            :placeholder="searchPlaceholder"
            class="flex-1 focus:ring-0"
            :autofocus="false"
            @keyup.enter="onSearchEnter"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
          <button
            v-if="keywords"
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group flex-shrink-0"
            @click="keywords = ''"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>
        <div class="flex justify-end items-center gap-2">
          <div v-if="canCustomize" class="flex-1 min-w-0 flex items-center gap-2">
            <UInput
              v-model="customize"
              :placeholder="customizePlaceholder"
              :maxlength="maxLength"
              class="flex-1 min-w-0 focus:ring-0"
              @keyup.enter="addCustomize"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
            <UButton
              type="button"
              color="primary"
              variant="soft"
              class="shrink-0"
              @click="addCustomize"
            >
              添加
            </UButton>
          </div>
          <UButton
            color="primary"
            class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md shadow-pink-500/30 transition-all duration-200 shrink-0"
            @click="confirm"
          >
            {{ confirmText }}
          </UButton>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-6 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div v-if="chooseList.length" class="flex flex-wrap gap-2 mb-4">
          <QhxTag
            v-for="item in chooseList"
            :key="`chosen-${item.value}`"
            :active="true"
          >
            <div class="flex items-center">
              <UIcon
                name="ant-design:close-outlined"
                class="text-[16px] cursor-pointer"
                @click="removeChosen(item)"
              />
              <div class="ml-1">{{ item.label }}</div>
              <UIcon
                v-if="isDeletable(item)"
                name="i-heroicons-trash"
                class="ml-1 text-[16px] cursor-pointer"
                @click.stop="askDelete(item, $event)"
              />
            </div>
          </QhxTag>
        </div>
        <div class="flex flex-wrap gap-2">
          <QhxTag
            v-for="item in filteredOptions"
            :key="`opt-${item.value}`"
            class="cursor-pointer"
            :active="isChosen(item)"
            @click="choose(item)"
          >
            <div class="flex items-center">
              <div>{{ item.label }}</div>
              <UIcon
                v-if="isDeletable(item)"
                name="ant-design:close-outlined"
                class="ml-1 text-[16px]"
                @click.stop="askDelete(item, $event)"
              />
            </div>
          </QhxTag>
          <QhxTag
            v-if="canAddKeywordsAsCustom"
            class="cursor-pointer"
            @click="addKeywordsAsCustom"
          >
            添加「{{ keywords.trim() }}」
          </QhxTag>
        </div>
        <div
          v-if="!filteredOptions.length && !canAddKeywordsAsCustom"
          class="text-center text-gray-400 py-10 text-sm"
        >
          {{ keywords.trim() ? '没有匹配的词条' : '暂无词条' }}
        </div>
      </div>
    </div>
  </QhxModal>
  <QhxModal
    v-model="showDeleteConfirm"
    :trigger-position="deleteClickPosition"
    :z-index="zIndex + 20"
    @close="closeDeleteConfirm"
  >
    <div class="p-6 w-[min(94vw,360px)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">删除词条</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        确定从词表中删除「{{ pendingDelete?.label }}」？
      </p>
      <p class="text-sm text-amber-600 dark:text-amber-400 mt-2">
        衣柜所有相关词条都会删除。
      </p>
      <div class="flex justify-end gap-2 mt-6">
        <UButton color="gray" variant="outline" @click="closeDeleteConfirm">
          取消
        </UButton>
        <UButton color="red" @click="confirmDelete">
          删除
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>
