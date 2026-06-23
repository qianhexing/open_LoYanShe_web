<script setup lang="ts">
defineProps<{
  show3dToggle?: boolean
  iframeSrc?: string
  rootClass?: string
}>()

const show3d = defineModel<boolean>('show3d', { default: false })
</script>

<template>
  <div class="clothes-cover-frame relative" :class="rootClass">
    <button
      v-if="show3dToggle"
      type="button"
      class="clothes-cover-3d-toggle absolute left-1.5 top-1.5 z-20"
      :aria-pressed="show3d"
      @click.stop="show3d = !show3d"
    >
      {{ show3d ? '图片' : '3D' }}
    </button>
    <iframe
      v-if="show3d && iframeSrc"
      :src="iframeSrc"
      class="absolute inset-0 z-10 h-full w-full border-0"
      title="3D 人台预览"
      allow="fullscreen"
    />
    <div
      v-show="!show3d || !iframeSrc"
      class="h-full w-full"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.clothes-cover-3d-toggle {
  border-radius: 9999px;
  border: 2px solid color-mix(in srgb, var(--primary-color, #ec4899) 55%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ec4899) 5%, #fff);
  color: var(--primary-color, #ec4899);
  padding: 0.2rem 0.55rem;
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  line-height: 1.2;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 2px 8px rgba(0, 0, 0, 0.08);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.16s ease;
}

.clothes-cover-3d-toggle:hover {
  background: color-mix(in srgb, var(--primary-color, #ec4899) 9%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ec4899) 68%, transparent);
}

.clothes-cover-3d-toggle:active {
  transform: scale(0.97);
}

.dark .clothes-cover-3d-toggle {
  background: color-mix(in srgb, var(--primary-color, #ec4899) 10%, rgba(17, 24, 39, 0.72));
  border-color: color-mix(in srgb, var(--primary-color, #ec4899) 58%, rgba(255, 255, 255, 0.12));
  color: color-mix(in srgb, var(--primary-color, #ec4899) 78%, #fce7f3);
}
</style>
