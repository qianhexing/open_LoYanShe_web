<template>
  <div class="calendar-container">
    <!-- 顶部导航 -->
    <div class="calendar-header">
      <button type="button" @click="prevMonth" class="nav-btn" aria-label="上一月">‹</button>
      <div class="calendar-title">
        {{ currentYear }} 年 {{ currentMonth + 1 }} 月
      </div>
      <button type="button" @click="nextMonth" class="nav-btn" aria-label="下一月">›</button>
      <button
        type="button"
        class="today-btn"
        :class="{ 'today-btn--active': isTodaySelected }"
        @click="goToday"
      >
        今日
      </button>
    </div>

    <!-- 日期滚动区域 -->
    <div
      ref="scrollContainer"
      class="calendar-scroll"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
      @touchstart="startDrag"
      @touchmove="onDrag"
      @touchend="endDrag"
    >
      <div class="calendar-days">
        <div
          v-for="day in days"
          :key="day.date"
          class="day"
          :class="{ active: isSelected(day.date) }"
          @click="selectDate(day.date)"
        >
          <div class="day-num">{{ day.day }}</div>
          <div class="day-week">{{ day.week }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";

interface Props {
  modelValue?: Date | string | number; // 接受 Date 或字符串或时间戳
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:modelValue", value: Date): void;
  (e: "change", value: Date): void;
}>();

// 初始化
const today = new Date();
const selectedDate = ref<Date>(
  props.modelValue ? new Date(props.modelValue) : today
);
const currentYear = ref(selectedDate.value.getFullYear());
const currentMonth = ref(selectedDate.value.getMonth());

const scrollContainer = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const startX = ref(0);
const scrollLeft = ref(0);

const weekNames = ["日", "一", "二", "三", "四", "五", "六"];

// 当月天数
const days = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const date = new Date(year, month, 1);
  const result = [];
  while (date.getMonth() === month) {
    result.push({
      date: new Date(date),
      day: date.getDate(),
      week: weekNames[date.getDay()],
    });
    date.setDate(date.getDate() + 1);
  }
  return result;
});

function isSelected(date: Date) {
  return (
    selectedDate.value.getFullYear() === date.getFullYear() &&
    selectedDate.value.getMonth() === date.getMonth() &&
    selectedDate.value.getDate() === date.getDate()
  );
}

const isTodaySelected = computed(() => {
  const now = new Date();
  return isSelected(now);
});

function goToday() {
  const now = new Date();
  currentYear.value = now.getFullYear();
  currentMonth.value = now.getMonth();
  selectDate(now);
}

// 切换月份
function prevMonth() {
  if (currentMonth.value === 0) {
    currentYear.value -= 1;
    currentMonth.value = 11;
  } else {
    currentMonth.value -= 1;
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentYear.value += 1;
    currentMonth.value = 0;
  } else {
    currentMonth.value += 1;
  }
}

// 选择日期
function selectDate(date: Date) {
  selectedDate.value = new Date(date);
  emit("update:modelValue", selectedDate.value);
  emit("change", selectedDate.value);
  nextTick(() => scrollToSelected(true));
}

let scrollAnimFrame = 0;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** 带动画滚动到目标位置 */
function animateScrollLeft(container: HTMLElement, targetLeft: number, duration = 420) {
  if (scrollAnimFrame) {
    cancelAnimationFrame(scrollAnimFrame);
    scrollAnimFrame = 0;
  }
  const startLeft = container.scrollLeft;
  const delta = targetLeft - startLeft;
  if (Math.abs(delta) < 1) {
    container.scrollLeft = targetLeft;
    return;
  }
  const startTime = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startTime) / duration);
    container.scrollLeft = startLeft + delta * easeOutCubic(progress);
    if (progress < 1) {
      scrollAnimFrame = requestAnimationFrame(step);
    } else {
      scrollAnimFrame = 0;
    }
  };
  scrollAnimFrame = requestAnimationFrame(step);
}

// 滚动到选中日期居中
function scrollToSelected(animated = true) {
  const container = scrollContainer.value;
  if (!container) return;
  const items = container.querySelectorAll(".day");
  const index = days.value.findIndex((d) => isSelected(d.date));
  if (index < 0) return;
  const item = items[index] as HTMLElement | undefined;
  if (!item) return;
  const offset = item.offsetLeft - container.clientWidth / 2 + item.clientWidth / 2;
  if (animated) {
    animateScrollLeft(container, offset);
  } else {
    if (scrollAnimFrame) {
      cancelAnimationFrame(scrollAnimFrame);
      scrollAnimFrame = 0;
    }
    container.scrollLeft = offset;
  }
}

// 拖动滚动逻辑
function startDrag(e: MouseEvent | TouchEvent) {
  if (scrollAnimFrame) {
    cancelAnimationFrame(scrollAnimFrame);
    scrollAnimFrame = 0;
  }
  isDragging.value = true;
  startX.value = "touches" in e ? e.touches[0].pageX : e.pageX;
  scrollLeft.value = scrollContainer.value!.scrollLeft;
}

function onDrag(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return;
  e.preventDefault();
  const x = "touches" in e ? e.touches[0].pageX : e.pageX;
  const walk = x - startX.value;
  scrollContainer.value!.scrollLeft = scrollLeft.value - walk;
}

function endDrag() {
  isDragging.value = false;
}

// 初始化滚动位置
onMounted(() => {
  nextTick(() => scrollToSelected(false));
});

// 监听月份变化 → 自动滚动到选中
watch([currentMonth, currentYear], () => {
  nextTick(() => scrollToSelected(true));
});

// 监听外部 v-model 变化
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      const newDate = new Date(val);
      selectedDate.value = newDate;
      currentYear.value = newDate.getFullYear();
      currentMonth.value = newDate.getMonth();
      nextTick(() => scrollToSelected(true));
    }
  }
);

onBeforeUnmount(() => {
  if (scrollAnimFrame) {
    cancelAnimationFrame(scrollAnimFrame);
    scrollAnimFrame = 0;
  }
});
</script>

<style scoped>
.calendar-container {
  width: 100%;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  padding: 10px 0;
  user-select: none;
}

.calendar-header {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-weight: bold;
  font-size: 16px;
  padding: 6px 12px;
}

.nav-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #555;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.nav-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.today-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  border: 1.5px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 8%, #fff);
  color: var(--primary-color, #ff9eb5);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.today-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 14%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 70%, transparent);
}

.today-btn:active {
  transform: translateY(-50%) scale(0.97);
}

.today-btn--active,
.today-btn--active:hover,
.today-btn--active:active {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 18%, #fff);
  border-color: var(--primary-color, #ff9eb5);
  color: var(--primary-color, #ff9eb5);
}

.calendar-scroll {
  overflow-x: auto;
  /* 自定义 rAF 缓动，避免与原生 smooth 抢滚动 */
  scroll-behavior: auto;
  padding: 10px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.calendar-scroll::-webkit-scrollbar {
  display: none;
}

.calendar-days {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  padding: 0 8px;
}

.day {
  flex: 0 0 auto;
  text-align: center;
  cursor: pointer;
  min-width: 60px;
  padding: 8px 0;
  border-radius: 12px;
  border: 1.5px solid transparent;
  color: #374151;
  transition:
    background 0.28s ease,
    border-color 0.28s ease,
    color 0.28s ease,
    transform 0.28s ease,
    box-shadow 0.28s ease;
  background: #f6f6f6;
}
.day.active {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 18%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 65%, transparent);
  color: var(--primary-color, #ff9eb5);
  transform: scale(1.05);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, transparent);
}
.day-num {
  font-size: 18px;
  font-weight: bold;
}
.day-week {
  font-size: 12px;
  opacity: 0.8;
}

/* 响应式适配移动端 */
@media (max-width: 768px) {
  .day {
    min-width: 50px;
    padding: 6px 0;
  }
  .day-num {
    font-size: 16px;
  }
}
</style>
