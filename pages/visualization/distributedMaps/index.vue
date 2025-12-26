<template>
  <div class="distributed-maps-page">
    <div class="content-area">
      <div class="info-card">
        <h1 class="title">时间轴选择演示</h1>
        <div class="date-display">
          <span class="label">当前日期</span>
          <span class="value">{{ formatDate(currentDate) }}</span>
        </div>
        <p class="hint">请在右侧滑动时间尺以选择日期</p>
      </div>
    </div>
    
    <div class="ruler-area">
      <TimeRuler v-model="currentDate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TimeRuler from '~/components/TimeRuler.vue';
import dayjs from 'dayjs';

// 设置网页标题
useHead({
  title: '时间轴选择器'
});

const currentDate = ref(new Date());

const formatDate = (date: Date) => {
  return dayjs(date).format('YYYY-MM-DD');
};
</script>

<style scoped>
.distributed-maps-page {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f7fa;
  position: relative;
}

.content-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.info-card {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.title {
  font-size: 20px;
  color: #666;
  margin-bottom: 30px;
}

.date-display {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-display .label {
  font-size: 14px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.date-display .value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

.hint {
  font-size: 14px;
  color: #999;
  margin-top: 20px;
}

.ruler-area {
  width: 80px;
  height: 100%;
  background: white;
  box-shadow: -1px 0 0 rgba(0,0,0,0.05);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .ruler-area {
    width: 60px;
  }
  
  .info-card {
    padding: 20px;
  }
  
  .date-display .value {
    font-size: 24px;
  }
}
</style>
