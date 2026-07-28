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
    class="fp-panel mb-8"
  >
    <div
      class="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1"
    >
      <h2 class="fp-section-title min-w-0 flex items-center gap-2">
        <span class="fp-section-icon">
          <FeatureNavIcon
            name="bookmark"
            icon-class="text-qhx-primary"
            class="!h-4 !w-4 shrink-0"
          />
        </span>
        顶置工具
      </h2>
      <button
        type="button"
        class="fp-chip-btn shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-[#4f3f43] outline-none transition-all duration-200 hover:bg-qhx-primary/10 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.98]"
        @click="manageOpen = true"
      >
        管理顶置
      </button>
    </div>

    <p
      v-if="visiblePinnedItems.length === 0"
      class="px-1 text-xs text-[#9a858a]"
    >
      暂未设置常用入口，点击「管理顶置」从功能列表中添加（已下架的入口不会显示）。
    </p>

    <div
      v-else
      class="grid grid-cols-4 gap-2.5 md:flex md:flex-wrap md:gap-3"
    >
      <button
        v-for="(item, pinIdx) in visiblePinnedItems"
        :key="`pin-${pinIdx}-${item.id}-${item.path}`"
        type="button"
        class="fp-tile group flex min-w-0 w-full shrink-0 flex-col items-center gap-2 p-2.5 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.99] md:w-[5.75rem]"
        @click="go(item)"
      >
        <div
          class="fp-icon-well flex h-10 w-10 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-[1.03] md:h-11 md:w-11"
        >
          <FeatureNavIcon
            :key="`${item.icon}-${item.id}-${item.path}`"
            class="scale-95 md:scale-100"
            :name="item.icon"
            :icon-class="featureNavToneClasses[item.tone]?.iconText ?? featureNavToneClasses.pink!.iconText"
          />
        </div>
        <span
          class="line-clamp-2 w-full break-words text-center text-[11px] font-medium leading-tight text-[#4f3f43] md:text-xs"
        >
          {{ item.title }}
        </span>
      </button>
    </div>

    <QhxModal v-model="manageOpen">
      <div
        class="fp-modal-shell flex h-[min(620px,calc(100dvh-8rem))] w-[95vw] max-w-2xl flex-col overflow-hidden rounded-2xl"
      >
        <div
          class="fp-modal-header flex shrink-0 items-center justify-between px-4 py-3"
        >
          <h3 class="fp-modal-title">
            管理顶置工具
          </h3>
          <button
            type="button"
            class="fp-icon-btn flex size-8 items-center justify-center rounded-lg text-[#9a858a] outline-none transition-all duration-200 hover:bg-qhx-primary/10 hover:text-[#4f3f43] focus-visible:ring-2 focus-visible:ring-qhx-primary/40"
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
          <div class="fp-inset rounded-2xl p-3">
            <div class="mb-1 text-sm font-medium text-[#4f3f43]">
              已选顶置
            </div>
            <div
              class="fp-hint mb-3 flex items-start gap-1.5 rounded-xl px-2 py-1.5 text-xs leading-relaxed text-[#9a858a]"
            >
              <UIcon
                name="i-heroicons-arrows-up-down-16-solid"
                class="mt-0.5 size-4 shrink-0 text-qhx-primary"
              />
              <span>
                <span class="font-medium text-[#4f3f43]">排序提示：</span>
                长按卡片约 150ms 后拖动即可调整顶置顺序；保存后即在首页生效。
              </span>
            </div>

            <ClientOnly>
              <div>
                <Draggable
                  v-if="draftPinnedRows.length > 0"
                  v-model="draftPinnedRows"
                  item-key="id"
                  class="pinned-drag-strip grid grid-cols-4 gap-2.5 md:flex md:flex-wrap md:gap-3"
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
                      class="drag-handle fp-tile fp-drag-card relative flex min-w-0 w-full shrink-0 cursor-grab select-none flex-col items-center gap-1 px-1.5 py-2 text-center active:cursor-grabbing md:w-[4.75rem]"
                    >
                      <button
                        type="button"
                        class="fp-remove absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full text-red-500 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-red-400/50"
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
                        class="fp-icon-well flex h-10 w-10 shrink-0 items-center justify-center"
                      >
                        <FeatureNavIcon
                          class="pointer-events-none scale-90"
                          :name="catalogItem(element.id)?.icon ?? 'sparkles'"
                          :icon-class="pinnedTonePack(catalogItem(element.id)).iconText"
                        />
                      </div>
                      <span
                        class="pointer-events-none line-clamp-2 w-full break-words text-[10px] leading-tight text-[#4f3f43]"
                      >
                        {{ catalogItem(element.id)?.title }}
                      </span>
                    </div>
                  </template>
                </Draggable>
                <div
                  v-else
                  class="fp-dashed flex min-h-[5.25rem] items-center justify-center px-3 py-6 text-center text-xs text-[#9a858a]"
                >
                  暂无已选，请从下方横向列表中点击添加
                </div>
              </div>
              <template #fallback>
                <div class="flex min-h-[5.25rem] items-center justify-center text-xs text-[#9a858a]">
                  加载排序组件中…
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- 底部：选择区固定高度条，始终在「保存」按钮栏上方 -->
        <div
          class="fp-modal-panel shrink-0 overflow-hidden px-4 py-3"
        >
          <div class="mb-1 text-sm font-medium text-[#4f3f43]">
            选择要顶置的功能
          </div>
          <p class="mb-2 text-xs text-[#9a858a]">
            横向滑动浏览；点击卡片加入上方「已选顶置」。
          </p>
          <div
            class="feature-pinned-pool-scroll -mx-1 flex h-[124px] shrink-0 content-start items-start gap-2.5 overflow-x-auto overflow-y-hidden scroll-smooth px-1 pb-1 pt-0.5"
          >
            <button
              v-for="row in poolItems"
              :key="row.id"
              type="button"
              class="fp-tile fp-pool flex w-[4.75rem] shrink-0 flex-col items-center gap-1 px-1.5 py-2 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.98]"
              @click="addPinned(row.id)"
            >
              <div
                class="fp-icon-well flex h-10 w-10 shrink-0 items-center justify-center"
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
                class="line-clamp-2 w-full break-words text-[10px] leading-tight text-[#4f3f43]"
              >
                {{ row.title }}
              </span>
            </button>
          </div>
          <p
            v-if="poolItems.length === 0 && draftPinnedRows.length > 0"
            class="mt-1.5 truncate text-xs text-[#9a858a]"
          >
            已全部加入顶置
          </p>
        </div>

        <div
          class="fp-modal-footer flex shrink-0 justify-end gap-3 px-4 py-3"
        >
          <button
            type="button"
            class="fp-chip-btn rounded-lg px-4 py-2 text-sm font-medium text-[#4f3f43] outline-none transition-all duration-200 hover:bg-qhx-primary/10 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.98]"
            @click="manageOpen = false"
          >
            取消
          </button>
          <button
            type="button"
            class="fp-save-btn inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
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
.fp-section-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.35rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
}

.fp-section-icon {
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 0.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--primary-color) 14%, white);
}

.fp-chip-btn {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.fp-tile {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 1.15rem;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-color) 9%, transparent);
}

.fp-tile:hover {
  border-color: color-mix(in srgb, var(--primary-color) 36%, transparent);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--primary-color) 14%, transparent);
  background: linear-gradient(165deg, #ffffff 0%, #fff8fa 100%);
}

.fp-icon-well {
  border-radius: 0.7rem;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, white);
}

.fp-modal-shell {
  color: #4f3f43;
  background:
    radial-gradient(ellipse 70% 40% at 0% 0%, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 55%),
    linear-gradient(180deg, #fffbfc 0%, #fff5f8 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 16px 40px color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.fp-modal-header {
  border-bottom: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.fp-modal-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: #4f3f43;
}

.fp-modal-panel {
  border-top: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
  background: color-mix(in srgb, var(--primary-color) 5%, #fffbfc);
}

.fp-modal-footer {
  border-top: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
  background: #fffbfc;
}

.fp-inset {
  background: color-mix(in srgb, var(--primary-color) 4%, #fffbfc);
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.fp-hint {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.fp-dashed {
  border-radius: 0.875rem;
  border: 1px dashed color-mix(in srgb, var(--primary-color) 28%, transparent);
  background: rgba(255, 255, 255, 0.55);
}

.fp-remove {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, #e05353 35%, transparent);
  box-shadow: 0 2px 8px color-mix(in srgb, #e05353 12%, transparent);
}

.fp-remove:hover {
  background: color-mix(in srgb, #e05353 8%, white);
}

.fp-save-btn {
  background: var(--primary-color);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--primary-color) 35%, transparent);
}

.fp-save-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.fp-save-btn:active:not(:disabled) {
  filter: brightness(0.97);
}

.drag-ghost {
  opacity: 0.45;
  transform: scale(0.95);
}
.drag-chosen {
  border-radius: 1rem;
}
.dragging {
  transform: scale(1.04);
  box-shadow: 0 14px 28px color-mix(in srgb, var(--primary-color) 22%, transparent);
}
.feature-pinned-pool-scroll {
  scrollbar-width: thin;
}
.feature-pinned-pool-scroll::-webkit-scrollbar {
  height: 6px;
}
.feature-pinned-pool-scroll::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: color-mix(in srgb, var(--primary-color) 35%, transparent);
}
</style>
