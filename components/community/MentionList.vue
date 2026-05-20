<template>
  <div
    class="mention-panel"
    role="listbox"
    :aria-label="panelAriaLabel"
    @mousedown.prevent
  >
    <template v-if="!items.length">
      <div class="mention-panel__state mention-panel__state--muted">
        {{ emptyHint }}
      </div>
    </template>

    <template v-else>
      <button
        v-for="(item, index) in items"
        :key="itemKey(item, index)"
        type="button"
        role="option"
        :aria-selected="index === selectedIndex"
        class="mention-panel__row"
        :class="{ 'mention-panel__row--active': index === selectedIndex }"
        @click="selectItem(index)"
      >
        <span class="mention-panel__avatar" aria-hidden="true">
          <img
            v-if="avatarSrc(item)"
            :src="avatarSrc(item)!"
            :alt="''"
            class="mention-panel__avatar-img"
          >
          <UIcon
            v-else
            :name="
              variant === 'library'
                ? 'material-symbols:menu-book-rounded'
                : 'material-symbols:person-rounded'
            "
            class="mention-panel__avatar-fallback h-5 w-5"
          />
        </span>
        <span class="mention-panel__meta">
          <span class="mention-panel__name">{{ item.label }}</span>
          <span v-if="subtitle(item)" class="mention-panel__sub">{{ subtitle(item) }}</span>
        </span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { BASE_IMG } from '@/utils/ipConfig'

/** 与 Tiptap Mention 插入的 attrs（id / label）及展示用扩展字段一致 */
export interface MentionListItem {
  id: string
  label: string
  /** 远端用户 id；纯昵称回退时没有 */
  user_id?: number
  user_face?: string | null
  /** 若提供则覆盖自动副标题逻辑（如图鉴行） */
  subtitle?: string | null
  /** 列表缩略图：相对 OSS 路径或已是 http（如图鉴封面） */
  thumbnail?: string | null
}

const props = withDefaults(
  defineProps<{
    items: MentionListItem[]
    command: (item: MentionListItem) => void
    emptyHint?: string
    panelAriaLabel?: string
    /** library：列表仅主次两行中的主行（图鉴）；不自动展示「ID xxx」副标题 */
    variant?: 'user' | 'library'
  }>(),
  {
    emptyHint: '无匹配用户',
    panelAriaLabel: '选择要提及的用户',
    variant: 'user'
  }
)

const selectedIndex = ref(0)

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
  }
)

function itemKey(item: MentionListItem, index: number): string {
  const id = item.id || item.user_id
  return `${id ?? index}-${item.label}`
}

function subtitle(item: MentionListItem): string | null {
  const customRaw = item.subtitle
  if (
    customRaw !== undefined &&
    customRaw !== null &&
    String(customRaw).trim() !== ''
  ) {
    return String(customRaw).trim()
  }
  if (props.variant === 'library') return null
  if (item.user_id != null && Number.isFinite(item.user_id)) {
    return `ID ${item.user_id}`
  }
  if (/^\d+$/.test(item.id.trim())) return `ID ${item.id.trim()}`
  return null
}

function avatarSrc(item: MentionListItem): string | null {
  const thumb = item.thumbnail?.trim()
  if (thumb) {
    return mediaSrc(thumb)
  }
  const raw = item.user_face?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const base = BASE_IMG.endsWith('/') ? BASE_IMG.slice(0, -1) : BASE_IMG
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${base}${path}`
}

function mediaSrc(raw: string): string | null {
  const r = raw.trim()
  if (!r) return null
  if (/^https?:\/\//i.test(r)) return r
  const base = BASE_IMG.endsWith('/') ? BASE_IMG.slice(0, -1) : BASE_IMG
  const path = r.startsWith('/') ? r : `/${r}`
  return `${base}${path}`
}

function selectItem(index: number) {
  const item = props.items[index]
  if (item) {
    props.command({
      id: item.id,
      label: item.label,
    })
  }
}

const upHandler = () => {
  if (!props.items.length) return
  selectedIndex.value = ((selectedIndex.value + props.items.length) - 1) % props.items.length
}

const downHandler = () => {
  if (!props.items.length) return
  selectedIndex.value = (selectedIndex.value + 1) % props.items.length
}

const enterHandler = () => {
  if (!props.items.length) return
  selectItem(selectedIndex.value)
}

defineExpose({
  onKeyDown: ({ event }: { event: KeyboardEvent }) => {
    if (event.key === 'ArrowUp') {
      upHandler()
      return true
    }
    if (event.key === 'ArrowDown') {
      downHandler()
      return true
    }
    if (event.key === 'Enter') {
      enterHandler()
      return true
    }
    return false
  },
})
</script>

<style scoped>
.mention-panel {
  min-width: 220px;
  max-width: min(100vw - 2rem, 320px);
  max-height: min(260px, 40dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 0.75rem;
  padding: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
  background: #f5f8fc;
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow:
    8px 10px 28px rgba(163, 177, 198, 0.38),
    -4px -4px 14px rgba(255, 255, 255, 0.75),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

:root.dark .mention-panel,
.dark .mention-panel {
  color: #e5e7eb;
  background: #3a4250;
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow:
    8px 12px 26px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.mention-panel__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

:root.dark .mention-panel__state,
.dark .mention-panel__state {
  color: #9ca3af;
}

.mention-panel__state--muted {
  font-size: 0.75rem;
}

.mention-panel__row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
  margin: 0;
  padding: 0.48rem 0.5rem;
  text-align: left;
  cursor: pointer;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  transition:
    background-color 0.14s ease,
    box-shadow 0.14s ease;
}

.mention-panel__row:hover,
.mention-panel__row--active {
  background: rgba(236, 72, 153, 0.08);
  box-shadow:
    inset 2px 2px 5px rgba(163, 177, 198, 0.12),
    inset -1px -1px 4px rgba(255, 255, 255, 0.65);
}

:root.dark .mention-panel__row:hover,
:root.dark .mention-panel__row--active,
.dark .mention-panel__row:hover,
.dark .mention-panel__row--active {
  background: rgba(236, 72, 153, 0.14);
  box-shadow: inset 2px 2px 8px rgba(0, 0, 0, 0.25);
}

.mention-panel__avatar {
  display: flex;
  height: 2.25rem;
  width: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(148, 163, 184, 0.2);
}

:root.dark .mention-panel__avatar,
.dark .mention-panel__avatar {
  background: rgba(255, 255, 255, 0.06);
}

.mention-panel__avatar-img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.mention-panel__avatar-fallback {
  color: #64748b;
}

:root.dark .mention-panel__avatar-fallback,
.dark .mention-panel__avatar-fallback {
  color: #94a3b8;
}

.mention-panel__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  line-height: 1.25;
}

.mention-panel__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-panel__sub {
  font-size: 0.6875rem;
  color: #9ca3af;
}

:root.dark .mention-panel__sub,
.dark .mention-panel__sub {
  color: #cbd5e1;
}
</style>
