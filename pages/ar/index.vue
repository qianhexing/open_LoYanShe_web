<template>
  <div class="w-full h-screen bg-black">
    <client-only>
      <MindARView />
      <template #fallback>
        <div class="flex items-center justify-center h-full text-white">
          正在加载 AR 模块...
        </div>
      </template>
    </client-only>
  </div>
</template>

<script setup lang="ts">
import MindARView from '@/components/AR/MindARView.client.vue';

// 禁用布局，因为是全屏 AR
definePageMeta({
  layout: false
});
</script>
