<script setup lang="ts">
import Draggable from 'vuedraggable'
import QhxModal from '~/components/Qhx/Modal.vue'
import FeatureNavIcon from '~/components/features/FeatureNavIcon.vue'
import {
  featuresNavManifest,
  featureNavFlat
} from '~/data/featuresNav'
import {
  featureNavToneClasses,
  useFeaturesPlatformNav
} from '~/composables/useFeaturesPlatformNav'
import { changeUserInfo } from '~/api/user'
import {
  parseFeatureMessageConfig,
  useFeaturePinnedMenu
} from '~/composables/useFeaturePinnedMenu'
import type { FeatureNavFlatItem } from '~/types/featuresNav'

const userStore = useUserStore()
const { go } = useFeaturesPlatformNav(featuresNavManifest)
const toast = useToast()

const { user, catalogFirstById, savedMenuRaw, visiblePinnedItems } =
  useFeaturePinnedMenu()

const manageOpen = ref(false)
/** 弹窗内已选顺序（拖拽仅改此项顺序） */
const draftPinnedRows = ref<{ id: string }[]>([])
const saving = ref(false)

/** 功能列表（去重，顺序同配置） */
const catalogPickList = computed(() => {
  const seenId = new Set<string>()
  const out: FeatureNavFlatItem[] = []
  for (const row of featureNavFlat) {
    if (seenId.has(row.id)) continue
    seenId.add(row.id)
    out.push(row)
  }
  return out
})

watch(manageOpen, (open) => {
  if (open) {
    const seen = new Set<string>()
    const rows: { id: string }[] = []
    for (const id of savedMenuRaw.value) {
      if (!catalogFirstById.value.has(id) || seen.has(id)) continue
      seen.add(id)
      rows.push({ id })
    }
    draftPinnedRows.value = rows
  }
})

const draftRowIdSet = computed(
  () => new Set(draftPinnedRows.value.map((r) => r.id))
)

/** 可选池：未加入顶置的入口 */
const poolItems = computed(() =>
  catalogPickList.value.filter((row) => !draftRowIdSet.value.has(row.id))
)

function catalogItem(id: string): FeatureNavFlatItem | undefined {
  return catalogFirstById.value.get(id)
}

/** 拖拽项展示用：避免模板非空断言 */
function pinnedTonePack(row: FeatureNavFlatItem | undefined) {
  const fallback =
    featureNavToneClasses.pink ?? Object.values(featureNavToneClasses)[0]
  if (!row) return fallback
  const k = row.tone in featureNavToneClasses ? row.tone : 'pink'
  return featureNavToneClasses[k] ?? fallback
}

function addPinned(id: string) {
  if (draftRowIdSet.value.has(id)) return
  draftPinnedRows.value = [...draftPinnedRows.value, { id }]
}

function removePinned(id: string) {
  draftPinnedRows.value = draftPinnedRows.value.filter((r) => r.id !== id)
}

async function saveDraft() {
  if (!import.meta.client) return
  saving.value = true
  try {
    const prev = parseFeatureMessageConfig(user.value)
    await changeUserInfo({
      message_config: {
        ...prev,
        menu: [...draftPinnedRows.value.map((r) => r.id)]
      }
    })
    await userStore.fetchUserInfo()
    manageOpen.value = false
    toast.add({ title: '顶置工具已保存', color: 'green' })
  } catch (e) {
    console.error(e)
    toast.add({ title: '保存失败，请稍后重试', color: 'red' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section
    v-if="user?.user_id != null"
    class="fp-neo-vars mb-10"
  >
    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
    >
      <h2
        class="fp-neo-section-title min-w-0 gap-2 py-2 pl-3 pr-3 font-semibold text-gray-800 dark:text-gray-100"
      >
        <FeatureNavIcon
          name="bookmark"
          icon-class="text-qhx-primary"
          class="!h-5 !w-5 shrink-0"
        />
        顶置工具
      </h2>
      <button
        type="button"
        class="fp-neo-aux-btn shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-700 outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neo-page)] active:scale-[0.98] dark:text-gray-200"
        @click="manageOpen = true"
      >
        管理顶置
      </button>
    </div>

    <p
      v-if="visiblePinnedItems.length === 0"
      class="text-sm text-gray-600 dark:text-gray-400"
    >
      暂未设置常用入口，点击「管理顶置」从功能列表中添加（已下架的入口不会显示）。
    </p>

    <div
      v-else
      class="grid grid-cols-4 gap-3 md:flex md:flex-wrap md:gap-4"
    >
      <button
        v-for="(item, pinIdx) in visiblePinnedItems"
        :key="`pin-${pinIdx}-${item.id}-${item.path}`"
        type="button"
        class="fp-neo-tile group flex min-w-0 w-full shrink-0 flex-col items-center gap-2 rounded-2xl p-2.5 text-center outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neo-page)] active:scale-[0.99] md:w-[5.75rem]"
        @click="go(item)"
      >
        <div
          class="fp-neo-icon-well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[box-shadow,transform] duration-200 group-hover:scale-[1.02] md:h-11 md:w-11"
        >
          <FeatureNavIcon
            :key="`${item.icon}-${item.id}-${item.path}`"
            class="scale-95 md:scale-100"
            :name="item.icon"
            :icon-class="featureNavToneClasses[item.tone]?.iconText ?? featureNavToneClasses.pink!.iconText"
          />
        </div>
        <span
          class="line-clamp-2 w-full break-words text-center text-[11px] font-medium leading-tight text-gray-800 dark:text-gray-100 md:text-xs"
        >
          {{ item.title }}
        </span>
      </button>
    </div>

    <QhxModal v-model="manageOpen">
      <div
        class="fp-neo-vars fp-neo-modal-shell flex h-[min(620px,calc(100dvh-8rem))] w-[95vw] max-w-2xl flex-col overflow-hidden rounded-2xl"
      >
        <div
          class="fp-neo-modal-header flex shrink-0 items-center justify-between px-4 py-3"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            管理顶置工具
          </h3>
          <button
            type="button"
            class="fp-neo-icon-btn flex size-9 items-center justify-center rounded-xl text-gray-600 outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 dark:text-gray-300"
            aria-label="关闭"
            @click="manageOpen = false"
          >
            <UIcon
              name="i-heroicons-x-mark-20-solid"
              class="size-5"
            />
          </button>
        </div>

        <!-- 上部：仅占剩余高度，超出纵向滚动 -->
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <!-- 上方：已选，可拖拽排序（与衣橱页同款 vuedraggable 参数） -->
          <div class="fp-neo-inset rounded-2xl p-3">
            <div class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
              已选顶置
            </div>
            <div
              class="fp-neo-hint-amber mb-3 flex items-start gap-1.5 rounded-xl px-2 py-1.5 text-xs leading-relaxed text-amber-900/95 dark:text-amber-100/95"
            >
              <UIcon
                name="i-heroicons-arrows-up-down-16-solid"
                class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <span>
                <span class="font-medium">排序提示：</span>
                长按卡片约 150ms后拖动即可调整顶置顺序；保存后即在首页生效。
              </span>
            </div>

            <ClientOnly>
              <div>
                <Draggable
                  v-if="draftPinnedRows.length > 0"
                  v-model="draftPinnedRows"
                  item-key="id"
                  class="pinned-drag-strip grid grid-cols-4 gap-3 md:flex md:flex-wrap md:gap-3"
                  :forceFallback="true"
                  :delay="150"
                  :animation="250"
                  ghost-class="drag-ghost"
                  chosen-class="drag-chosen"
                  drag-class="dragging"
                >
                  <template #item="{ element }">
                    <div
                      v-if="catalogItem(element.id)"
                      class="drag-handle fp-neo-tile fp-neo-drag-card relative flex min-w-0 w-full shrink-0 cursor-grab select-none flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-center active:cursor-grabbing md:w-[4.75rem]"
                    >
                      <button
                        type="button"
                        class="fp-neo-remove absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full text-red-600 outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-red-400/50 dark:text-red-400"
                        aria-label="移出顶置"
                        @pointerdown.stop
                        @mousedown.stop
                        @touchstart.stop
                        @click.stop="removePinned(element.id)"
                      >
                        <UIcon
                          name="i-heroicons-x-mark-20-solid"
                          class="size-3.5"
                        />
                      </button>
                      <div
                        class="fp-neo-icon-well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      >
                        <FeatureNavIcon
                          class="pointer-events-none scale-90"
                          :name="catalogItem(element.id)?.icon ?? 'sparkles'"
                          :icon-class="pinnedTonePack(catalogItem(element.id)).iconText"
                        />
                      </div>
                      <span
                        class="pointer-events-none line-clamp-2 w-full break-words text-[10px] leading-tight text-gray-800 dark:text-gray-100"
                      >
                        {{ catalogItem(element.id)?.title }}
                      </span>
                    </div>
                  </template>
                </Draggable>
                <div
                  v-else
                  class="fp-neo-dashed flex min-h-[5.25rem] items-center justify-center px-3 py-6 text-center text-xs text-gray-600 dark:text-gray-400"
                >
                  暂无已选，请从下方横向列表中点击添加
                </div>
              </div>
              <template #fallback>
                <div class="flex min-h-[5.25rem] items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                  加载排序组件中…
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- 底部：选择区固定高度条，始终在「保存」按钮栏上方 -->
        <div
          class="fp-neo-modal-panel shrink-0 overflow-hidden px-4 py-3"
        >
          <div class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            选择要顶置的功能
          </div>
          <p class="mb-2 text-xs text-gray-600 dark:text-gray-400">
            横向滑动浏览；点击卡片加入上方「已选顶置」。
          </p>
          <div
            class="feature-pinned-pool-scroll -mx-1 flex h-[124px] shrink-0 content-start items-start gap-3 overflow-x-auto overflow-y-hidden scroll-smooth px-1 pb-1 pt-0.5"
          >
            <button
              v-for="row in poolItems"
              :key="row.id"
              type="button"
              class="fp-neo-tile fp-neo-pool flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-center outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.98]"
              @click="addPinned(row.id)"
            >
              <div
                class="fp-neo-icon-well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              >
                <FeatureNavIcon
                  class="scale-90"
                  :name="row.icon"
                  :icon-class="
                    featureNavToneClasses[row.tone]?.iconText ??
                    featureNavToneClasses.pink!.iconText
                  "
                />
              </div>
              <span
                class="line-clamp-2 w-full break-words text-[10px] leading-tight text-gray-800 dark:text-gray-100"
              >
                {{ row.title }}
              </span>
            </button>
          </div>
          <p
            v-if="poolItems.length === 0 && draftPinnedRows.length > 0"
            class="mt-1.5 truncate text-xs text-gray-600 dark:text-gray-400"
          >
            已全部加入顶置
          </p>
        </div>

        <div
          class="fp-neo-modal-footer flex shrink-0 justify-end gap-3 px-4 py-3"
        >
          <button
            type="button"
            class="fp-neo-aux-btn rounded-xl px-4 py-2 text-sm font-medium text-gray-700 outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.98] dark:text-gray-200"
            @click="manageOpen = false"
          >
            取消
          </button>
          <button
            type="button"
            class="fp-neo-save-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-qhx-inverted outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="saving"
            @click="saveDraft"
          >
            <UIcon
              v-if="saving"
              name="i-heroicons-arrow-path-20-solid"
              class="size-4 shrink-0 animate-spin"
            />
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </QhxModal>
  </section>
</template>

<style scoped>
/* 与功能导航页一致的拟态变量（弹窗 Teleport 到 body，需在 .fp-neo-modal-shell 上重复定义） */
.fp-neo-vars {
  --neo-page: #e8ecf3;
  --neo-tile: #e8ecf3;
  --neo-shadow-dark: rgba(130, 145, 166, 0.38);
  --neo-shadow-light: rgba(255, 255, 255, 0.92);
  --neo-inset-dark: rgba(130, 145, 166, 0.28);
  --neo-inset-light: rgba(255, 255, 255, 0.85);
}

:global(.dark) .fp-neo-vars {
  --neo-page: #2a2d34;
  --neo-tile: #2a2d34;
  --neo-shadow-dark: rgba(0, 0, 0, 0.48);
  --neo-shadow-light: rgba(255, 255, 255, 0.07);
  --neo-inset-dark: rgba(0, 0, 0, 0.45);
  --neo-inset-light: rgba(255, 255, 255, 0.06);
}

.fp-neo-section-title {
  display: flex;
  align-items: center;
  border-radius: 0.875rem;
  background: var(--neo-tile);
  box-shadow:
    6px 6px 14px var(--neo-shadow-dark),
    -6px -6px 14px var(--neo-shadow-light);
}

.fp-neo-tile {
  background: var(--neo-tile);
  box-shadow:
    8px 8px 18px var(--neo-shadow-dark),
    -8px -8px 18px var(--neo-shadow-light);
}

.fp-neo-tile:hover {
  box-shadow:
    10px 10px 22px var(--neo-shadow-dark),
    -10px -10px 22px var(--neo-shadow-light);
}

.fp-neo-tile:active {
  box-shadow:
    inset 6px 6px 12px var(--neo-inset-dark),
    inset -6px -6px 12px var(--neo-inset-light);
}

.fp-neo-icon-well {
  background: var(--neo-tile);
  box-shadow:
    inset 4px 4px 8px var(--neo-inset-dark),
    inset -4px -4px 8px var(--neo-inset-light);
}

.fp-neo-tile:hover .fp-neo-icon-well,
.fp-neo-pool:hover .fp-neo-icon-well {
  box-shadow:
    inset 3px 3px 7px var(--neo-inset-dark),
    inset -3px -3px 7px var(--neo-inset-light);
}

.fp-neo-aux-btn {
  background: var(--neo-tile);
  box-shadow:
    5px 5px 12px var(--neo-shadow-dark),
    -5px -5px 12px var(--neo-shadow-light);
}

.fp-neo-aux-btn:hover {
  box-shadow:
    6px 6px 14px var(--neo-shadow-dark),
    -6px -6px 14px var(--neo-shadow-light);
}

.fp-neo-aux-btn:active {
  box-shadow:
    inset 4px 4px 8px var(--neo-inset-dark),
    inset -4px -4px 8px var(--neo-inset-light);
}

.fp-neo-icon-btn {
  background: var(--neo-tile);
  box-shadow:
    5px 5px 11px var(--neo-shadow-dark),
    -4px -4px 11px var(--neo-shadow-light);
}

.fp-neo-icon-btn:hover {
  box-shadow:
    6px 6px 13px var(--neo-shadow-dark),
    -5px -5px 13px var(--neo-shadow-light);
}

.fp-neo-icon-btn:active {
  box-shadow:
    inset 3px 3px 8px var(--neo-inset-dark),
    inset -3px -3px 8px var(--neo-inset-light);
}

.fp-neo-modal-shell {
  background: var(--neo-page);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 0 0 1px rgba(130, 145, 166, 0.06);
}

:global(.dark) .fp-neo-modal-shell {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.fp-neo-modal-header {
  box-shadow:
    inset 0 -1px 0 rgba(130, 145, 166, 0.12),
    0 6px 14px rgba(130, 145, 166, 0.06);
}

:global(.dark) .fp-neo-modal-header {
  box-shadow:
    inset 0 -1px 0 rgba(255, 255, 255, 0.05),
    0 8px 18px rgba(0, 0, 0, 0.25);
}

.fp-neo-modal-panel {
  background: var(--neo-page);
  box-shadow:
    inset 0 2px 6px var(--neo-inset-dark),
    inset 0 -1px 0 rgba(255, 255, 255, 0.04);
}

.fp-neo-modal-footer {
  background: var(--neo-tile);
  box-shadow:
    inset 0 2px 8px var(--neo-inset-dark),
    0 -4px 14px rgba(130, 145, 166, 0.08);
}

:global(.dark) .fp-neo-modal-footer {
  box-shadow:
    inset 0 2px 10px var(--neo-inset-dark),
    0 -4px 18px rgba(0, 0, 0, 0.3);
}

.fp-neo-inset {
  background: var(--neo-tile);
  box-shadow:
    inset 5px 5px 14px var(--neo-inset-dark),
    inset -5px -5px 14px var(--neo-inset-light);
}

.fp-neo-hint-amber {
  background: rgba(251, 191, 36, 0.12);
  box-shadow:
    inset 3px 3px 8px rgba(180, 120, 20, 0.12),
    inset -2px -2px 6px rgba(255, 255, 255, 0.45);
}

:global(.dark) .fp-neo-hint-amber {
  background: rgba(180, 83, 9, 0.22);
  box-shadow:
    inset 3px 3px 10px rgba(0, 0, 0, 0.35),
    inset -2px -2px 6px rgba(255, 200, 120, 0.06);
}

.fp-neo-dashed {
  border-radius: 0.875rem;
  background: var(--neo-tile);
  box-shadow:
    inset 4px 4px 10px var(--neo-inset-dark),
    inset -4px -4px 10px var(--neo-inset-light);
}

.fp-neo-remove {
  background: var(--neo-tile);
  box-shadow:
    3px 3px 8px var(--neo-shadow-dark),
    -2px -2px 6px var(--neo-shadow-light);
}

.fp-neo-remove:hover {
  box-shadow:
    4px 4px 10px var(--neo-shadow-dark),
    -3px -3px 8px var(--neo-shadow-light);
}

.fp-neo-remove:active {
  box-shadow:
    inset 2px 2px 5px var(--neo-inset-dark),
    inset -2px -2px 5px var(--neo-inset-light);
}

.fp-neo-save-btn {
  background: var(--primary-color);
  box-shadow:
    4px 4px 14px color-mix(in srgb, var(--primary-color) 42%, rgba(0, 0, 0, 0.28)),
    -3px -3px 10px rgba(255, 255, 255, 0.35);
}

:global(.dark) .fp-neo-save-btn {
  box-shadow:
    5px 5px 16px color-mix(in srgb, var(--primary-color) 22%, rgba(0, 0, 0, 0.65)),
    -2px -2px 8px color-mix(in srgb, var(--primary-color) 18%, rgba(255, 255, 255, 0.08));
}

.fp-neo-save-btn:hover:not(:disabled) {
  filter: brightness(1.06);
}

.fp-neo-save-btn:active:not(:disabled) {
  box-shadow:
    inset 3px 3px 8px color-mix(in srgb, var(--primary-color) 55%, rgba(0, 0, 0, 0.45)),
    inset -2px -2px 6px color-mix(in srgb, var(--primary-color) 25%, rgba(255, 255, 255, 0.15));
  filter: brightness(0.97);
}

/* 与衣橱页 vuedraggable 视觉一致 */
.drag-ghost {
  opacity: 0.45;
  transform: scale(0.95);
}
.drag-chosen {
  border-radius: 1rem;
}
.dragging {
  transform: scale(1.04);
  box-shadow:
    12px 14px 28px var(--neo-shadow-dark),
    -8px -8px 22px var(--neo-shadow-light);
}
.feature-pinned-pool-scroll {
  scrollbar-width: thin;
}
.feature-pinned-pool-scroll::-webkit-scrollbar {
  height: 6px;
}
.feature-pinned-pool-scroll::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: rgba(130, 145, 166, 0.45);
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.35);
}
:global(.dark) .feature-pinned-pool-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.35);
}
</style>