<template>
  <div class="calendar-container">
    <!-- 顶部导航 -->
    <div class="calendar-header">
      <button @click="prevMonth" class="nav-btn">‹</button>
      <div class="calendar-title">
        {{ currentYear }} 年 {{ currentMonth + 1 }} 月
      </div>
      <button @click="nextMonth" class="nav-btn">›</button>
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
import { ref, computed, onMounted, watch, nextTick } from "vue";

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
  nextTick(scrollToSelected);
}

// 滚动到选中日期居中
function scrollToSelected() {
  const container = scrollContainer.value;
  if (!container) return;
  const items = container.querySelectorAll(".day");
  const index = days.value.findIndex((d) => isSelected(d.date));
  if (index >= 0) {
    const item = items[index] as HTMLElement;
    const offset = item.offsetLeft - container.clientWidth / 2 + item.clientWidth / 2;
    container.scrollTo({
      left: offset,
      behavior: "smooth",
    });
  }
}

// 拖动滚动逻辑
function startDrag(e: MouseEvent | TouchEvent) {
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
  nextTick(scrollToSelected);
});

// 监听月份变化 → 自动滚动到选中
watch([currentMonth, currentYear], () => {
  nextTick(scrollToSelected);
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
      nextTick(scrollToSelected);
    }
  }
);
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
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-weight: bold;
  font-size: 16px;
  padding: 6px 0;
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

.calendar-scroll {
  overflow-x: auto;
  scroll-behavior: smooth;
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
  transition: all 0.2s ease;
  background: #f6f6f6;
}
.day.active {
  background: var(--primary-color);
  color: white;
  transform: scale(1.05);
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
