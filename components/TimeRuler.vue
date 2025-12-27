<template>
  <div class="time-ruler-container" ref="container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import dayjs from 'dayjs';

const props = defineProps<{
  modelValue?: Date | string | number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Date): void;
  (e: 'change', value: Date): void;
}>();

const container = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

// Configuration
const PIXELS_PER_DAY = 20; // Height of one day
const RULER_WIDTH = 50; // Narrower as requested
const MARK_LENGTH_DAY = 10;
const MARK_LENGTH_MONTH = 18;
const MARK_LENGTH_YEAR = 25;

// Colors
const COLOR_DAY = '#cccccc';
const COLOR_MONTH = '#7130ae'; // Using theme purple
const COLOR_YEAR = '#ff6b6b';
const COLOR_TEXT = '#333333';
const COLOR_INDICATOR = '#ff0000';

// State
let currentDate = props.modelValue ? dayjs(props.modelValue) : dayjs();
let isDragging = false;
let startY = 0;
let lastY = 0;
let currentTranslateY = 0; // Visual offset during drag before committing to date
let requestId: number | null = null;
let width = 0;
let height = 0;

// Initialize
onMounted(() => {
  if (!canvas.value || !container.value) return;
  
  ctx.value = canvas.value.getContext('2d', { alpha: true });
  
  resize();
  window.addEventListener('resize', resize);
  
  // Event Listeners
  const el = canvas.value;
  
  // Mouse
  el.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  
  // Touch
  el.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  
  draw();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  window.removeEventListener('mousemove', onMove);
  window.removeEventListener('mouseup', onEnd);
  window.removeEventListener('touchmove', onMove);
  window.removeEventListener('touchend', onEnd);
  if (requestId) cancelAnimationFrame(requestId);
});

// Watch for external prop changes
watch(() => props.modelValue, (val) => {
  if (val && !isDragging) {
    const newDate = dayjs(val);
    if (!newDate.isSame(currentDate, 'day')) {
      currentDate = newDate;
      draw();
    }
  }
});

const resize = () => {
  if (!container.value || !canvas.value) return;
  
  // Provide a fixed width, or adapt to container
  width = RULER_WIDTH;
  height = container.value.clientHeight;
  
  // Handle High DPI
  const dpr = window.devicePixelRatio || 1;
  canvas.value.width = width * dpr;
  canvas.value.height = height * dpr;
  canvas.value.style.width = `${width}px`;
  canvas.value.style.height = `${height}px`;
  
  ctx.value?.scale(dpr, dpr);
  draw();
};

const draw = () => {
  if (!ctx.value || !canvas.value) return;
  
  const context = ctx.value;
  context.clearRect(0, 0, width, height);
  
  const centerY = height / 2;
  
  // Background
  context.fillStyle = 'rgba(255, 255, 255, 0.8)';
  context.fillRect(0, 0, width, height);
  
  // Logic FLIPPED: Top is FUTURE (larger date), Bottom is PAST (smaller date)
  // Drag Down (positive deltaY) -> Go to Future (larger date)
  // Originally: currentDate.subtract(dayOffset). Now: currentDate.add(dayOffset)
  
  const totalPixelOffset = currentTranslateY;
  const dayOffset = totalPixelOffset / PIXELS_PER_DAY;
  
  // Center Date Calculation
  // Drag Down -> currentTranslateY > 0 -> dayOffset > 0 -> add -> future date
  const centerDate = currentDate.add(dayOffset, 'day');
  
  // Determine visible range
  const halfHeight = height / 2;
  const daysVisible = Math.ceil(halfHeight / PIXELS_PER_DAY);
  const buffer = 5;
  
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  
  // Loop through days
  for (let i = -daysVisible - buffer; i <= daysVisible + buffer; i++) {
    const baseDay = centerDate.startOf('day');
    
    // Target date
    const targetDate = baseDay.add(i, 'day');
    const diffDays = targetDate.diff(centerDate, 'day', true);
    
    // Y Calculation FLIPPED
    // If targetDate > centerDate (Future), diffDays > 0
    // We want Future at Top (smaller Y)
    // Y = centerY - diffDays * PIXELS_PER_DAY
    const y = centerY - diffDays * PIXELS_PER_DAY;
    
    // Determine Type
    const isYear = targetDate.date() === 1 && targetDate.month() === 0;
    const isMonth = targetDate.date() === 1 && !isYear;
    
    let length = MARK_LENGTH_DAY;
    let color = COLOR_DAY;
    let lineWidth = 1;
    
    if (isYear) {
      length = MARK_LENGTH_YEAR;
      color = COLOR_YEAR;
      lineWidth = 2;
    } else if (isMonth) {
      length = MARK_LENGTH_MONTH;
      color = COLOR_MONTH;
      lineWidth = 1.5;
    }
    
    // Draw Tick
    context.beginPath();
    context.moveTo(width, y);
    context.lineTo(width - length, y);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
    
    // Draw Text
    if (isYear) {
      context.fillStyle = COLOR_TEXT;
      context.font = 'bold 12px sans-serif';
      context.fillText(targetDate.format('YYYY'), width - length - 4, y);
    } else if (isMonth) {
      context.fillStyle = COLOR_TEXT;
      context.font = '10px sans-serif';
      context.fillText(targetDate.format('M月'), width - length - 4, y);
    } else {
       // Draw Day Number for every day
       context.fillStyle = '#999';
       context.font = '9px sans-serif';
       context.fillText(targetDate.format('DD'), width - length - 4, y);
    }
  }
  
  // Draw Center Indicator
  context.beginPath();
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.strokeStyle = COLOR_INDICATOR;
  context.lineWidth = 1.5;
  context.stroke();
};

// Interaction
const onStart = (e: MouseEvent | TouchEvent) => {
  isDragging = true;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  startY = clientY;
  lastY = clientY;
  currentTranslateY = 0;
};

const onMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging) return;
  e.preventDefault(); // Prevent page scroll
  
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  const deltaY = clientY - lastY;
  lastY = clientY;
  
  // Accumulate
  currentTranslateY += deltaY;
  
  // Emit change event in real-time
  const dayOffset = currentTranslateY / PIXELS_PER_DAY;
  const tempDate = currentDate.add(dayOffset, 'day');
  const dateObj = tempDate.toDate();
  emit('update:modelValue', dateObj);
  emit('change', dateObj);
  
  draw();
};

const onEnd = () => {
  if (!isDragging) return;
  isDragging = false;
  
  // Commit change
  const dayOffset = currentTranslateY / PIXELS_PER_DAY;
  // FLIPPED: Drag Down (positive) -> Future (add)
  currentDate = currentDate.add(dayOffset, 'day');
  currentTranslateY = 0;
  
  // Snap to nearest day?
  // currentDate = currentDate.startOf('day'); 
  // Let's keep it continuous for smoother feel or snap at end? 
  // User asked for "real-time update", usually implies continuous values.
  // But our tea party logic might depend on dates. 
  // Let's keep snapping at the end but emit continuous during move.
  
  currentDate = currentDate.startOf('day');
  
  draw();
  
  const dateObj = currentDate.toDate();
  emit('update:modelValue', dateObj);
  emit('change', dateObj);
};

</script>

<style scoped>
.time-ruler-container {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 50px; /* Match RULER_WIDTH */
  height: 100vh;
  z-index: 50; /* Above map */
  pointer-events: auto;
  cursor: ns-resize;
  background: transparent;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
