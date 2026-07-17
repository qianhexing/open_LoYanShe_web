<script setup lang="ts">
/**
 * 展馆「留下讯息」入口按钮；实际发评走 CommunityCommentModal。
 */
defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="leave-fab"
    aria-label="写下讯息"
    @click="$emit('click')"
  >
    <span class="leave-fab__mark" aria-hidden="true" />
    <span>写下讯息</span>
  </button>
</template>

<style scoped>
.leave-fab {
  position: fixed;
  right: 28px;
  bottom: 36px;
  z-index: 28;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 11px 18px;
  border-radius: 2px;
  border: 1px solid rgba(255, 140, 40, 0.5);
  background: linear-gradient(180deg, rgba(40, 22, 12, 0.92), rgba(16, 10, 8, 0.94));
  color: #ffc078;
  font-size: 12px;
  letter-spacing: 0.18em;
  cursor: pointer;
  backdrop-filter: blur(12px);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.4),
    0 0 18px rgba(255, 110, 20, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.leave-fab:hover {
  transform: translateY(-1px);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.45),
    0 0 22px rgba(255, 110, 20, 0.28);
}

.leave-fab__mark {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe2a8 0%, #ff7a18 50%, transparent 75%);
  box-shadow: 0 0 10px rgba(255, 130, 30, 0.9);
}

@media (max-width: 767px) {
  .leave-fab {
    right: 16px;
    bottom: 72px;
  }
}
</style>
