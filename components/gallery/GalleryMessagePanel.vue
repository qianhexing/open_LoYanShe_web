<script setup lang="ts">
import QhxModal from '@/components/Qhx/Modal.vue'
import QhxJellyButton from '@/components/Qhx/JellyButton.vue'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import SafeRichText from '@/components/SafeRichText.vue'
import type { GalleryMessageMarker } from '@/types/gallery'
import { BASE_IMG } from '@/utils/ipConfig'
import { formatRich, parseRichText } from '@/utils/public'

const props = defineProps<{
  open: boolean
  message: GalleryMessageMarker | null
  nearby: boolean
}>()

const emit = defineEmits<{
  close: []
  openNearby: []
}>()

const visible = computed({
  get: () => props.open && !!props.message,
  set: (value: boolean) => {
    if (!value) emit('close')
  }
})

const displayName = computed(() => props.message?.userName?.trim() || '旅人')

const faceUrl = computed(() => {
  const face = props.message?.userFace?.trim()
  if (!face) return ''
  if (/^https?:\/\//i.test(face)) return face
  return `${BASE_IMG}${face.replace(/^\/+/, '')}`
})

const dateText = computed(() => {
  const raw = props.message?.date
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const richNodes = computed(() => {
  const raw = props.message?.content?.trim()
  if (!raw) return null
  const { text } = formatRich(raw)
  const nodes = parseRichText(text)
  return nodes?.length ? nodes : null
})

const imageList = computed(() => {
  const list: string[] = []
  const raw = props.message?.content?.trim()
  if (raw) {
    const { image } = formatRich(raw)
    for (const src of image) {
      list.push(src.replace('https://www.lolitalibrary.com/ali/', ''))
    }
  }
  const mount = props.message?.mountImg?.trim()
  if (mount) {
    for (const part of mount.split(',')) {
      const p = part.trim()
      if (p) list.push(p)
    }
  }
  return list
})

const onHintClick = () => {
  if (props.nearby) emit('openNearby')
}
</script>

<template>
  <Transition name="fade">
    <button
      v-if="nearby && !open"
      type="button"
      class="message-hint"
      @click="onHintClick"
    >
      <span class="message-hint__mark" aria-hidden="true" />
      <span class="message-hint__text">检查讯息</span>
    </button>
  </Transition>

  <QhxModal v-model="visible">
    <div class="message-modal">
      <div class="message-modal__frame" aria-hidden="true" />

      <button
        class="message-modal__close"
        type="button"
        aria-label="关闭"
        @click="emit('close')"
      >
        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
      </button>

      <p class="message-modal__eyebrow">— 讯息 —</p>

      <div class="message-modal__user">
        <img
          v-if="faceUrl"
          :src="faceUrl"
          :alt="displayName"
          class="message-modal__face"
        >
        <span v-else class="message-modal__face-fallback">{{ displayName.charAt(0) }}</span>
        <div class="message-modal__meta">
          <p class="message-modal__name">{{ displayName }}</p>
          <p v-if="dateText" class="message-modal__date">{{ dateText }}</p>
        </div>
      </div>

      <div class="message-modal__content">
        <SafeRichText v-if="richNodes" :nodes="richNodes" />
        <p v-else class="message-modal__empty">……</p>

        <div v-if="imageList.length" class="message-modal__images">
          <QhxPreviewImage
            :list="imageList.map((img) => ({
              src: `${img}?x-oss-process=image/quality,q_100/resize,w_200,h_200`,
              alt: '讯息图片'
            }))"
            :preview="imageList"
            :className="'message-modal__thumb'"
          />
        </div>
      </div>

      <div class="message-modal__actions">
        <QhxJellyButton>
          <button type="button" class="message-modal__btn" @click="emit('close')">
            关闭
          </button>
        </QhxJellyButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
.message-hint {
  position: fixed;
  bottom: 168px;
  left: 50%;
  z-index: 30;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 11px 22px;
  border: 1px solid rgba(255, 140, 40, 0.55);
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(40, 22, 12, 0.92), rgba(16, 10, 8, 0.94));
  color: #ffc078;
  font-size: 13px;
  letter-spacing: 0.18em;
  cursor: pointer;
  box-shadow:
    0 0 18px rgba(255, 110, 20, 0.22),
    inset 0 0 20px rgba(255, 120, 30, 0.08);
  backdrop-filter: blur(8px);
}

.message-hint__mark {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe2a8 0%, #ff7a18 45%, transparent 72%);
  box-shadow: 0 0 12px rgba(255, 130, 30, 0.95);
  animation: soapstone-pulse 1.6s ease-in-out infinite;
}

.message-hint__text {
  text-shadow: 0 0 10px rgba(255, 140, 40, 0.35);
}

.message-modal {
  position: relative;
  width: min(420px, calc(100vw - 32px));
  padding: 28px 24px 20px;
  border-radius: 6px;
  background:
    linear-gradient(165deg, rgba(42, 28, 18, 0.98) 0%, rgba(18, 12, 10, 0.98) 100%);
  border: 1px solid rgba(255, 140, 40, 0.35);
  color: #f3e6d4;
  box-shadow:
    0 22px 55px rgba(0, 0, 0, 0.55),
    0 0 28px rgba(255, 110, 20, 0.12);
  overflow: hidden;
}

.message-modal__frame {
  pointer-events: none;
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(255, 160, 60, 0.18);
  border-radius: 3px;
}

.message-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(255, 160, 60, 0.25);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 210, 160, 0.75);
  cursor: pointer;
}

.message-modal__eyebrow {
  position: relative;
  margin: 0 0 16px;
  font-size: 12px;
  color: #ff9a3c;
  letter-spacing: 0.28em;
  text-align: center;
  text-shadow: 0 0 12px rgba(255, 120, 30, 0.35);
}

.message-modal__user {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.message-modal__face,
.message-modal__face-fallback {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  flex-shrink: 0;
}

.message-modal__face {
  object-fit: cover;
  border: 1px solid rgba(255, 150, 50, 0.4);
}

.message-modal__face-fallback {
  display: grid;
  place-items: center;
  background: rgba(255, 120, 30, 0.18);
  color: #ffb86a;
  font-weight: 600;
}

.message-modal__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffe2c0;
}

.message-modal__date {
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(255, 220, 180, 0.4);
}

.message-modal__content {
  position: relative;
  margin: 0;
  padding: 16px 18px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 150, 50, 0.18);
  font-size: 15px;
  line-height: 1.75;
  letter-spacing: 0.04em;
  word-break: break-word;
  min-height: 72px;
  color: #f6e8d4;
  box-shadow: inset 0 0 24px rgba(255, 100, 20, 0.05);
}

.message-modal__empty {
  margin: 0;
  color: rgba(255, 220, 180, 0.45);
}

.message-modal__images {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12px;
}

.message-modal__images :deep(.message-modal__thumb) {
  width: calc(100% / 3 - 8px);
  margin: 4px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.message-modal__actions {
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.message-modal__btn {
  padding: 8px 22px;
  border-radius: 4px;
  border: 1px solid rgba(255, 150, 50, 0.45);
  background: rgba(255, 120, 30, 0.16);
  color: #ffd7a8;
  font-size: 13px;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@keyframes soapstone-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.28);
  }
}

@media (max-width: 767px) {
  .message-hint {
    bottom: 200px;
    font-size: 12px;
  }
}
</style>
