<script setup lang="ts">
import { getDecoList } from '@/api/deco';
import type { DecoItem } from '@/api/deco';
import { updateUserDisplayBadges } from '@/api/user';
import { updateCommunityDisplayBadge } from '@/api/community';
import { updateWardrobe } from '@/api/wardrobe';
import { BASE_IMG } from '@/utils/ipConfig';
import QhxModal from '@/components/Qhx/Modal.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    triggerPosition?: { x: number; y: number };
    /** 打开弹窗时预填的已选徽章 ID */
    initialSelectedIds?: number[];
    /** 若传入，则保存为该衣柜的 display_badge（逗号分隔 deco_id），不调用用户展示接口 */
    wardrobeId?: number | null;
    /** 若传入，则 POST /community/update/display_badge 仅更新帖子展示徽章 */
    communityId?: number | null;
  }>(),
  {
    initialSelectedIds: () => [],
    wardrobeId: null,
    communityId: null,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  /** 用户配置时不带参数；衣柜/帖子配置时带 display_badge（清空时可为 null） */
  (e: 'saved', payload?: { display_badge: string | null }): void;
}>();

const decoList = ref<DecoItem[]>([]);
const decoListLoading = ref(false);
const decoListTotal = ref(0);
const decoListPage = ref(1);
const decoListPageSize = 20;
const selectedDecoIds = ref<number[]>([]);
const decoSaveLoading = ref(false);

/** 获取徽章封面（优先 cover，否则 url） */
function getBadgeCover(item: DecoItem): string {
  return item.cover || item.url || 'static/plan_cover/default.jpg';
}

/** 获取徽章标题 */
function getBadgeTitle(item: DecoItem): string {
  if (item.title) return item.title;
  const jd = item.json_data as { name?: string } | null;
  return jd?.name ?? `徽章${item.deco_id}`;
}

/** 徽章描述（接口 desc） */
function getBadgeDesc(item: DecoItem): string | null {
  const d = item.desc?.trim();
  return d || null;
}

/** json_data.conditions 作为获取条件文案（若有则展示） */
function getBadgeConditionsFromJson(item: DecoItem): string | null {
  const jd = item.json_data as { conditions?: unknown } | null;
  if (!jd || jd.conditions == null) return null;
  const c = jd.conditions;
  if (typeof c === 'string') {
    const t = c.trim();
    return t || null;
  }
  if (Array.isArray(c)) {
    const parts = c.map((x) => String(x).trim()).filter(Boolean);
    return parts.length ? parts.join('、') : null;
  }
  if (typeof c === 'object') {
    try {
      return JSON.stringify(c);
    } catch {
      return String(c);
    }
  }
  return String(c);
}

/** 判断是否为 3D 模型 */
function is3DModel(url: string): boolean {
  const lower = String(url || '').toLowerCase();
  return lower.endsWith('.glb') || lower.endsWith('.gltf');
}

const fetchDecoList = async (page = 1, append = false) => {
  decoListLoading.value = true;
  try {
    const res = await getDecoList({ page, pageSize: decoListPageSize, type: 0 });
    if (append) decoList.value = [...decoList.value, ...res.rows];
    else decoList.value = res.rows;
    decoListTotal.value = res.count;
    decoListPage.value = page;
  } catch (e) {
    console.error('获取徽章列表失败:', e);
  } finally {
    decoListLoading.value = false;
  }
};

const toggleDecoSelect = (item: DecoItem) => {
  if (item.has_own !== 1) return;
  const decoId = item.deco_id;
  const idx = selectedDecoIds.value.indexOf(decoId);
  if (idx >= 0) {
    selectedDecoIds.value = selectedDecoIds.value.filter((id) => id !== decoId);
  } else {
    selectedDecoIds.value = [...selectedDecoIds.value, decoId];
  }
};

const isDecoSelected = (decoId: number) => selectedDecoIds.value.includes(decoId);

const userStore = useUserStore();

const save = async () => {
  if (!userStore.token) return;
  decoSaveLoading.value = true;
  try {
    const wid = props.wardrobeId;
    const cid = props.communityId;
    if (wid != null && wid > 0) {
      const displayBadge = selectedDecoIds.value.join(',');
      const updated = await updateWardrobe({
        wardrobe_id: wid,
        display_badge: displayBadge,
      });
      emit('saved', {
        display_badge: updated?.display_badge ?? displayBadge,
      });
    } else if (cid != null && cid > 0) {
      const joined = selectedDecoIds.value.join(',');
      const trimmed = joined.trim();
      const displayBadgeBody: string | null =
        trimmed === '' ? null : trimmed;
      const updated = await updateCommunityDisplayBadge({
        community_id: cid,
        display_badge: displayBadgeBody,
      });
      const next = updated?.display_badge;
      emit('saved', {
        display_badge:
          next == null || String(next).trim() === '' ? null : String(next).trim(),
      });
    } else {
      await updateUserDisplayBadges({ badge_ids: selectedDecoIds.value });
      emit('saved');
    }
    emit('update:modelValue', false);
  } catch (e) {
    console.error('保存徽章配置失败:', e);
  } finally {
    decoSaveLoading.value = false;
  }
};

const close = () => {
  emit('update:modelValue', false);
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedDecoIds.value = [...props.initialSelectedIds];
      decoList.value = [];
      fetchDecoList(1);
    }
  },
  { immediate: true }
);
</script>

<template>
  <QhxModal
    :model-value="modelValue"
    :trigger-position="triggerPosition"
    @update:model-value="emit('update:modelValue', $event)"
    @close="close"
  >
    <div class="deco-modal w-[95vw] max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/60 dark:border-gray-600/60">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-600/60 bg-qhx-bg-card dark:bg-gray-800/95 flex-shrink-0">
        <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span class="text-qhx-primary">✨</span>
          选择展示的徽章
        </h2>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          @click="close"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>
      <!-- 内容 -->
      <div class="flex-1 overflow-y-auto p-4 min-h-0">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">选择要展示的徽章（仅已拥有的可勾选）</p>
        <div v-if="decoListLoading && !decoList.length" class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-qhx-primary" />
        </div>
        <div v-else-if="!decoList.length" class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-star" class="w-12 h-12 mb-2" />
          <span class="text-sm">暂无徽章</span>
        </div>
        <div v-else class="deco-grid grid grid-cols-2 gap-2 sm:gap-3">
          <div
            v-for="item in decoList"
            :key="item.deco_id"
            class="deco-item rounded-2xl border-2 p-2 sm:p-3 flex gap-2 sm:gap-3 items-stretch transition-all touch-manipulation relative min-h-0 min-w-0"
            :class="[
              isDecoSelected(item.deco_id)
                ? 'deco-item-selected border-qhx-primary bg-qhx-primary/10 dark:bg-qhx-primary/15 ring-2 cursor-pointer active:scale-[0.98]'
                : item.has_own === 1
                  ? 'border-gray-200 dark:border-gray-600 hover:border-qhx-primary/50 cursor-pointer active:scale-[0.98]'
                  : 'deco-item-unowned border-gray-200 dark:border-gray-600 cursor-not-allowed',
            ]"
            @click="toggleDecoSelect(item)"
          >
            <div
              class="deco-cover-wrap w-14 sm:w-[4.5rem] shrink-0 aspect-[1/1] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700/50 relative self-center"
              :class="{ 'deco-cover-unowned': item.has_own !== 1 }"
            >
              <img
                v-if="!is3DModel(getBadgeCover(item))"
                :src="`${BASE_IMG}${getBadgeCover(item)}`"
                :alt="getBadgeTitle(item)"
                class="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="absolute inset-0 flex items-center justify-center text-qhx-primary">
                <UIcon name="i-heroicons-cube" class="w-8 h-8" />
              </div>
              <div
                v-if="item.has_own !== 1"
                class="deco-unowned-mask absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl"
              >
                <span class="text-[10px] font-medium text-white/95 px-1 text-center leading-tight">未拥有</span>
              </div>
            </div>
            <div class="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5 text-left">
              <div
                class="text-sm font-semibold leading-snug line-clamp-2"
                :class="item.has_own === 1 ? 'text-qhx-primary' : 'text-gray-600 dark:text-gray-400'"
              >
                {{ getBadgeTitle(item) }}
                <span v-if="item.has_own === 1" class="text-qhx-primary ml-0.5">✓</span>
              </div>
              <p
                v-if="getBadgeDesc(item)"
                class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3"
              >
                {{ getBadgeDesc(item) }}
              </p>
              <p
                v-if="getBadgeConditionsFromJson(item)"
                class="text-[11px] leading-relaxed text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-3"
              >
                <span class="text-gray-400 dark:text-gray-500">获取条件</span>
                <span class="mx-0.5 text-gray-400">·</span>
                <span>{{ getBadgeConditionsFromJson(item) }}</span>
              </p>
            </div>
          </div>
        </div>
        <div v-if="decoList.length < decoListTotal && !decoListLoading" class="text-center mt-4">
          <UButton
            size="sm"
            variant="soft"
            class="rounded-full px-6 bg-qhx-primary/10 text-qhx-primary hover:bg-qhx-primary/20 border-qhx-primary/30"
            @click="fetchDecoList(decoListPage + 1, true)"
          >
            加载更多
          </UButton>
        </div>
      </div>
      <!-- 底部 -->
      <div class="flex-shrink-0 flex justify-end gap-3 px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/95">
        <UButton variant="ghost" color="gray" class="rounded-xl" @click="close">
          取消
        </UButton>
        <UButton class="rounded-xl bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover" :loading="decoSaveLoading" @click="save">
          保存
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
.deco-modal {
  -webkit-overflow-scrolling: touch;
}

.deco-item-selected {
  --tw-ring-color: var(--primary-color);
  --tw-ring-offset-width: 0px;
  box-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--primary-color);
}

.deco-cover-unowned {
  filter: grayscale(100%);
  opacity: 0.7;
}

.deco-unowned-mask {
  pointer-events: none;
}
</style>
