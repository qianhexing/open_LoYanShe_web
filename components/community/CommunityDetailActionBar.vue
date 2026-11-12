<script setup lang="ts">
import UserGoodBtn from '@/components/user/GoodBtn.vue'
import UserCollectBtn from '@/components/user/CollectBtn.vue'

/** 社区帖互动：pk_type = 3 */
const PK_TYPE_COMMUNITY = 3

defineProps<{
  communityId: number
  goodCount: number
  collectCount: number
  viewCount: number
}>()

const emit = defineEmits<{
  comment: []
  share: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="community-detail-action-dock pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3"
    role="toolbar"
    aria-label="帖子互动"
  >
    <div
      class="community-detail-action-capsule pointer-events-auto flex max-w-full items-stretch gap-0.5 overflow-x-auto"
    >
      <UserGoodBtn
        :pk_type="PK_TYPE_COMMUNITY"
        :pk_id="communityId"
        :good_count="goodCount"
        :need_judge="true"
      >
        <template #default="{ childData }">
          <div class="community-detail-action-item" role="button" aria-label="点赞">
            <UIcon
              name="weui:like-filled"
              class="community-detail-action-item__icon"
              :class="childData.is_good ? 'text-[#409EFF]' : ''"
            />
            <span class="community-detail-action-item__label tabular-nums">
              {{ childData.good_count }}
            </span>
          </div>
        </template>
      </UserGoodBtn>

      <UserCollectBtn
        :collect_count="collectCount"
        :pk_type="PK_TYPE_COMMUNITY"
        :pk_id="communityId"
        :need_judge="true"
      >
        <template #default="collectSlot">
          <div class="community-detail-action-item" role="button" aria-label="收藏">
            <UIcon
              name="ant-design:star-filled"
              class="community-detail-action-item__icon"
              :class="collectSlot.childData?.is_collect ? 'text-[#FFD166]' : ''"
            />
            <span class="community-detail-action-item__label tabular-nums">
              {{ collectSlot.childData?.collect_count ?? collectCount }}
            </span>
          </div>
        </template>
      </UserCollectBtn>

      <div
        class="community-detail-action-item community-detail-action-item--static"
        title="浏览"
        aria-label="浏览数"
      >
        <UIcon name="i-heroicons-eye" class="community-detail-action-item__icon" />
        <span class="community-detail-action-item__label tabular-nums">{{ viewCount }}</span>
      </div>

      <button
        type="button"
        class="community-detail-action-item"
        title="复制链接"
        aria-label="分享：复制当前页链接"
        @click="emit('share')"
      >
        <UIcon name="ic:round-share" class="community-detail-action-item__icon" />
        <span class="community-detail-action-item__label">分享</span>
      </button>

      <button
        type="button"
        class="community-detail-action-item"
        :aria-label="t('comment.write')"
        @click="emit('comment')"
      >
        <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="community-detail-action-item__icon" />
        <span class="community-detail-action-item__label">{{ t('comment.write') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.community-detail-action-dock {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
}

.community-detail-action-capsule {
  height: 3.2rem;
  min-height: 3.2rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 55%, transparent);
  background: color-mix(in srgb, var(--background-color-card, #fff) 62%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  padding: 0.28rem 0.4rem;
  scrollbar-width: none;
}

.community-detail-action-capsule::-webkit-scrollbar {
  display: none;
}

.dark .community-detail-action-capsule {
  border-color: color-mix(in srgb, #fff 12%, transparent);
  background: color-mix(in srgb, #111827 58%, transparent);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.community-detail-action-item {
  box-sizing: border-box;
  display: inline-flex;
  width: 3.25rem;
  height: 2.625rem;
  min-width: 3.25rem;
  min-height: 2.625rem;
  flex: 0 0 3.25rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.28rem 0.35rem;
  border-radius: 9999px;
  color: color-mix(in srgb, var(--text-color, #374151) 88%, transparent);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
  user-select: none;
  overflow: hidden;
}

.community-detail-action-item--static {
  cursor: default;
}

.community-detail-action-item:not(.community-detail-action-item--static):hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, transparent);
}

.community-detail-action-item:not(.community-detail-action-item--static):active {
  transform: scale(0.96);
}

.community-detail-action-item__icon {
  display: block;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  flex-shrink: 0;
  line-height: 0;
}

.community-detail-action-item__icon :deep(svg) {
  width: 18px !important;
  height: 18px !important;
}

.community-detail-action-item__label {
  display: block;
  width: 100%;
  height: 10px;
  font-size: 10px;
  line-height: 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

:deep(.cursor-pointer.inline-block) {
  display: inline-flex;
  align-items: stretch;
  width: 3.25rem;
  height: 2.625rem;
  flex: 0 0 3.25rem;
}
</style>
