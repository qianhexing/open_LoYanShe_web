<!--
  按 journal.pk_type 调度类型内容组件，便于列表/轮播等场景复用。
-->
<script setup lang="ts">
import type { Component } from 'vue'
import type { Journal } from '@/types/api'
import TypeNote from '@/components/journal/carousel/TypeNote.vue'
import TypePost from '@/components/journal/carousel/TypePost.vue'
import TypeClothes from '@/components/journal/carousel/TypeClothes.vue'
import TypeMatching from '@/components/journal/carousel/TypeMatching.vue'
import TypeLibrary from '@/components/journal/carousel/TypeLibrary.vue'
import TypePlan from '@/components/journal/carousel/TypePlan.vue'
import TypeScene from '@/components/journal/carousel/TypeScene.vue'
import TypeNoteFallback from '@/components/journal/carousel/TypeNoteFallback.vue'

const props = withDefaults(
  defineProps<{
    journal: Journal
    imageParams?: string
    /** 透传给需要按激活态懒加载的类型（如 3D iframe） */
    active?: boolean
  }>(),
  { active: true }
)

const TYPE_MAP: Record<number, Component> = {
  0: TypeNote,
  1: TypePost,
  2: TypeClothes,
  3: TypeMatching,
  4: TypeLibrary,
  5: TypePlan,
  6: TypeScene
}

const typeComponent = computed(() => TYPE_MAP[props.journal.pk_type] ?? null)
</script>

<template>
  <div class="journal-carousel-type-body contents">
    <component
      :is="typeComponent"
      v-if="typeComponent"
      :journal="journal"
      :image-params="imageParams"
      :active="active"
      class="min-h-0 h-full w-full flex-1"
    />
    <TypeNoteFallback v-else :journal="journal" />
  </div>
</template>
