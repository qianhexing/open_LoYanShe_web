<template>
  <div class="time-ruler-wrapper" ref="wrapperRef">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import dayjs from 'dayjs';

const props = defineProps({
  modelValue: {
    type: [Date, String, Number],
    default: () => new Date()
  },
  pixelsPerDay: {
    type: Number,
    default: 80
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const wrapperRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;

// State
let width = 0;
let height = 0;
let currentTimestamp = dayjs(props.modelValue).valueOf();
let isDragging = false;
let lastY = 0;
let animationFrameId: number | null = null;
let velocity = 0;
let lastTime = 0;

// Config
const CONFIG = {
  dayHeight: props.pixelsPerDay,
  tickWidth: {
    day: 12,
    month: 25,
    year: 40
  },
  tickColor: {
    day: '#BBBBBB',
    month: '#666666',
    year: '#000000'
  },
  textColor: {
    day: '#999999',
    month: '#333333',
    year: '#000000'
  },
  fontSize: {
    day: 10,
    month: 12,
    year: 14
  },
  centerLineColor: '#ff4d4f'
};

watch(() => props.modelValue, (newVal) => {
  const newTimestamp = dayjs(newVal).valueOf();
  // Allow small threshold to prevent loop
  if (Math.abs(newTimestamp - currentTimestamp) > 100) {
    currentTimestamp = newTimestamp;
    requestDraw();
  }
});

watch(() => props.pixelsPerDay, (newVal) => {
  CONFIG.dayHeight = newVal;
  requestDraw();
});

const requestDraw = () => {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(draw);
  }
};

const initCanvas = () => {
  if (!wrapperRef.value || !canvasRef.value) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = wrapperRef.value.getBoundingClientRect();
  width = rect.width;
  height = rect.height;

  canvasRef.value.width = width * dpr;
  canvasRef.value.height = height * dpr;
  canvasRef.value.style.width = `${width}px`;
  canvasRef.value.style.height = `${height}px`;

  ctx = canvasRef.value.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  requestDraw();
};

const draw = () => {
  animationFrameId = null;
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const centerY = height / 2;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const msPerPixel = oneDayMs / CONFIG.dayHeight;
  
  // Calculate visible range
  const startMs = currentTimestamp + (-centerY - 100) * msPerPixel;
  const endMs = currentTimestamp + (height - centerY + 100) * msPerPixel;

  const startDate = dayjs(startMs);
  const endDate = dayjs(endMs);

  let iterDate = startDate.startOf('day');
  
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  while (iterDate.isBefore(endDate)) {
    const diffMs = iterDate.valueOf() - currentTimestamp;
    const y = centerY + (diffMs / oneDayMs) * CONFIG.dayHeight;

    const isYear = iterDate.month() === 0 && iterDate.date() === 1;
    const isMonth = iterDate.date() === 1;
    
    let tickW = CONFIG.tickWidth.day;
    let color = CONFIG.tickColor.day;

    if (isYear) {
      tickW = CONFIG.tickWidth.year;
      color = CONFIG.tickColor.year;
    } else if (isMonth) {
      tickW = CONFIG.tickWidth.month;
      color = CONFIG.tickColor.month;
    }

    // Draw Tick
    ctx.beginPath();
    ctx.moveTo(width, y);
    ctx.lineTo(width - tickW, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = isYear ? 2 : (isMonth ? 1.5 : 1);
    ctx.stroke();

    // Draw Text
    const textPadding = 4;
    if (isYear) {
      ctx.font = `bold ${CONFIG.fontSize.year}px sans-serif`;
      ctx.fillStyle = CONFIG.textColor.year;
      ctx.fillText(`${iterDate.year()}`, width - tickW - textPadding, y);
    } else if (isMonth) {
      ctx.font = `bold ${CONFIG.fontSize.month}px sans-serif`;
      ctx.fillStyle = CONFIG.textColor.month;
      ctx.fillText(`${iterDate.month() + 1}月`, width - tickW - textPadding, y);
    } else {
        // Draw day number if enough space
        // if dayHeight > 40, we can draw text for every 5 days or 1 day
        if (CONFIG.dayHeight >= 40) {
             // Only draw 5, 10, 15... or all if zoomed in
             if (iterDate.date() % 5 === 0) {
                 ctx.font = `${CONFIG.fontSize.day}px sans-serif`;
                 ctx.fillStyle = CONFIG.textColor.day;
                 ctx.fillText(`${iterDate.date()}日`, width - tickW - textPadding, y);
             }
        }
    }

    iterDate = iterDate.add(1, 'day');
  }

  // Center Line
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.strokeStyle = CONFIG.centerLineColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Indicator Triangle
  ctx.beginPath();
  ctx.moveTo(width, centerY);
  ctx.lineTo(width - 8, centerY - 5);
  ctx.lineTo(width - 8, centerY + 5);
  ctx.closePath();
  ctx.fillStyle = CONFIG.centerLineColor;
  ctx.fill();
};

const handleStart = (y: number) => {
  isDragging = true;
  lastY = y;
  velocity = 0;
  if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
};

const handleMove = (y: number) => {
  if (!isDragging) return;
  const deltaY = y - lastY;
  lastY = y;
  
  const msPerPixel = (24 * 60 * 60 * 1000) / CONFIG.dayHeight;
  const deltaTime = deltaY * msPerPixel;
  
  currentTimestamp -= deltaTime;
  
  const now = performance.now();
  const dt = now - lastTime;
  if (dt > 0) {
    velocity = deltaY / dt;
  }
  lastTime = now;

  requestDraw();
  emitUpdate();
};

const handleEnd = () => {
  isDragging = false;
  startInertia();
};

let inertiaFrame: number;

const startInertia = () => {
  if (Math.abs(velocity) < 0.05) return;
  
  const friction = 0.95;
  const step = () => {
    if (Math.abs(velocity) < 0.05 || isDragging) return;
    
    velocity *= friction;
    
    const deltaY = velocity * 16;
    const msPerPixel = (24 * 60 * 60 * 1000) / CONFIG.dayHeight;
    currentTimestamp -= deltaY * msPerPixel;
    
    requestDraw();
    emitUpdate();
    
    inertiaFrame = requestAnimationFrame(step);
  };
  inertiaFrame = requestAnimationFrame(step);
};

const emitUpdate = () => {
  emit('update:modelValue', new Date(currentTimestamp));
  emit('change', new Date(currentTimestamp));
};

// Events
const onMouseDown = (e: MouseEvent) => {
  handleStart(e.clientY);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const onMouseMove = (e: MouseEvent) => {
  handleMove(e.clientY);
};

const onMouseUp = () => {
  handleEnd();
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
};

const onTouchStart = (e: TouchEvent) => {
  e.preventDefault();
  handleStart(e.touches[0].clientY);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
};

const onTouchMove = (e: TouchEvent) => {
  e.preventDefault();
  handleMove(e.touches[0].clientY);
};

const onTouchEnd = () => {
  handleEnd();
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
};

const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const msPerPixel = (24 * 60 * 60 * 1000) / CONFIG.dayHeight;
    // Wheel down -> scroll down -> show future -> currentTimestamp increase
    currentTimestamp += e.deltaY * msPerPixel;
    requestDraw();
    emitUpdate();
};

onMounted(() => {
  initCanvas();
  window.addEventListener('resize', initCanvas);
  
  if (canvasRef.value) {
    canvasRef.value.addEventListener('mousedown', onMouseDown);
    canvasRef.value.addEventListener('touchstart', onTouchStart, { passive: false });
    canvasRef.value.addEventListener('wheel', onWheel, { passive: false });
  }
});

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
  
  window.removeEventListener('resize', initCanvas);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('mousedown', onMouseDown);
    canvasRef.value.removeEventListener('touchstart', onTouchStart);
    canvasRef.value.removeEventListener('wheel', onWheel);
  }
});
</script>

<style scoped>
.time-ruler-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #fcfcfc;
  user-select: none;
  touch-action: none;
  border-left: 1px solid #eee;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

canvas:active {
  cursor: grabbing;
}
</style>
