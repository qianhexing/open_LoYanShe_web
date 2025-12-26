<template>
  <div class="time-ruler-container" ref="container">
    <canvas ref="canvas"></canvas>
    <!-- Center Indicator Line (can also be drawn in canvas, but CSS is easier for some things, though canvas is requested for the ruler) -->
    <!-- We will draw the indicator in canvas as per requirement "red scale mark in the middle" -->
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
const RULER_WIDTH = 80;
const MARK_LENGTH_DAY = 15;
const MARK_LENGTH_MONTH = 25;
const MARK_LENGTH_YEAR = 35;

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
  
  // Calculate range
  // We offset by currentTranslateY which simulates dragging
  // Real logic: current date is at center. 
  // Dragging changes the "effective" center.
  
  // To implement smooth scrolling, we can adjust the `currentDate` slightly or use a pixel offset.
  // Using pixel offset `currentTranslateY` relative to `currentDate`.
  // When drag ends, we commit `currentTranslateY` to `currentDate`.
  
  const totalPixelOffset = currentTranslateY;
  const dayOffset = totalPixelOffset / PIXELS_PER_DAY;
  
  // The temporary date we are looking at (center)
  // Dragging DOWN (positive Y) means looking at EARLIER dates (moving content down)
  // So we SUBTRACT the day offset
  const centerDate = currentDate.subtract(dayOffset, 'day');
  
  // Determine visible range
  const halfHeight = height / 2;
  const daysVisible = Math.ceil(halfHeight / PIXELS_PER_DAY);
  const buffer = 5;
  
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.font = '12px sans-serif';
  
  // Loop through days
  for (let i = -daysVisible - buffer; i <= daysVisible + buffer; i++) {
    // Determine the date for this tick
    // We iterate integer offsets from the rounded center date to avoid jitter?
    // Let's stick to relative integer offsets from the `currentDate` (anchored)
    // The `centerDate` is floating point.
    
    // We need to draw lines at integer day intervals relative to the Unix Epoch or similar absolute reference.
    // `currentDate` might be 12:00. We want lines at 00:00.
    
    // Let's find the "base" day (00:00 of centerDate)
    const baseDay = centerDate.startOf('day');
    const diffFromBase = centerDate.diff(baseDay, 'day', true); // e.g. 0.5 if noon
    
    // We want to draw `targetDate = baseDay.add(i, 'day')`
    // Its position Y:
    // center is at `centerY`.
    // center corresponds to `centerDate`.
    // Y = centerY + (targetDate - centerDate) * PIXELS_PER_DAY
    
    const targetDate = baseDay.add(i, 'day');
    const diffDays = targetDate.diff(centerDate, 'day', true);
    const y = centerY + diffDays * PIXELS_PER_DAY;
    
    // Skip if out of bounds (should be covered by loop limits but safety first)
    // if (y < -50 || y > height + 50) continue;
    
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
      lineWidth = 2;
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
      context.font = 'bold 14px sans-serif';
      context.fillText(targetDate.format('YYYY'), width - length - 5, y);
    } else if (isMonth) {
      context.fillStyle = COLOR_TEXT;
      context.font = '12px sans-serif';
      context.fillText(targetDate.format('M月'), width - length - 5, y);
    } else if (Math.abs(diffDays) < 0.1) {
       // Optional: Highlight current day text if close to center?
       // Requirement says "red scale in middle", we draw text for major ticks. 
       // Maybe we can draw day numbers for every 5 days?
       if (targetDate.date() % 5 === 0) {
           context.fillStyle = '#999';
           context.font = '10px sans-serif';
           context.fillText(targetDate.format('D'), width - length - 5, y);
       }
    }
  }
  
  // Draw Center Indicator
  context.beginPath();
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.strokeStyle = COLOR_INDICATOR;
  context.lineWidth = 2;
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
  
  draw();
};

const onEnd = () => {
  if (!isDragging) return;
  isDragging = false;
  
  // Commit change
  const dayOffset = currentTranslateY / PIXELS_PER_DAY;
  // Dragging DOWN (positive) -> Move to EARLIER date (subtract)
  currentDate = currentDate.subtract(dayOffset, 'day');
  currentTranslateY = 0;
  
  // Snap to nearest day
  // Round to nearest start of day
  // If we are at 12:00, we want to stay at 12:00 or snap to 00:00?
  // Requirement: "Precise to day"
  // Let's snap to 12:00 (midday) or just 00:00. 
  // Usually dates are just dates. Let's snap to start of day.
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
  width: 80px; /* Match RULER_WIDTH */
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
