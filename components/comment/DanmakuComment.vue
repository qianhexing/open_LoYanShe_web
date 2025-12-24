<script setup lang="ts">
import type { Comment } from '@/types/api';
import { getCommentList } from '@/api/comment';
import { formatRich } from '@/utils/public';
import { BASE_IMG } from '@/utils/ipConfig';
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';

interface Props {
  type: string;
  id?: number;
  width?: string;
  height?: string;
  pageSize?: number;
  speed?: number; // 弹幕穿过屏幕的基准时间（秒）
  fontSize?: string;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '100vh',
  pageSize: 50,
  speed: 15,
  fontSize: '14px',
});

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isLoading = ref(false);
const danmakuList = ref<Comment[]>([]);

// Canvas 上下文与状态
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;
let screenWidth = 0;
let screenHeight = 0;
let dpr = 1;

// 弹幕配置
const config = {
  trackHeight: 44, // 轨道高度
  margin: 8,       // 轨道间距
  avatarSize: 26,  // 头像大小
  padding: 8,      // 左右内边距
  fontSize: 14,    // 字体大小
  gap: 8           // 头像与文字间距
};

// 辅助函数：绘制圆角矩形
const drawRoundedPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();
};

// 弹幕类
class Danmaku {
  x: number;
  y: number;
  speed: number;
  text: string;
  userFace: string;
  width: number = 0;
  height: number;
  cacheCanvas: HTMLCanvasElement | null = null;
  isReady: boolean = false;

  constructor(comment: Comment, trackIndex: number, speed: number) {
    this.text = this.processText(comment.comment_content);
    this.userFace = comment.user?.user_face ? `${BASE_IMG}${comment.user.user_face}` : '';
    // 计算 Y 坐标：垂直居中于轨道
    this.height = 34; // 弹幕胶囊的高度
    const trackTop = trackIndex * config.trackHeight;
    const offset = (config.trackHeight - this.height) / 2;
    this.y = trackTop + offset;
    this.x = 0; // 将在初始化后被设置为 screenWidth
    this.speed = speed;
    
    // 立即进行预渲染
    this.preRender();
  }

  processText(content: string): string {
    if (!content) return '...';
    try {
      const richRes = formatRich(content);
      const text = richRes.text || content;
      const plainText = text.replace(/<[^>]*>/g, '').trim();
      return plainText.length > 50 ? `${plainText.substring(0, 50)}...` : plainText;
    } catch {
      return content.replace(/<[^>]*>/g, '').trim().substring(0, 50);
    }
  }

  preRender() {
    if (typeof document === 'undefined') return;

    const offscreen = document.createElement('canvas');
    const oCtx = offscreen.getContext('2d');
    if (!oCtx) return;

    // 设置字体以测量宽度
    oCtx.font = `${config.fontSize}px sans-serif`;
    const textMetrics = oCtx.measureText(this.text);
    const textWidth = textMetrics.width;
    
    // 计算总宽度
    const hasAvatar = !!this.userFace;
    const avatarAreaWidth = hasAvatar ? config.avatarSize + config.gap : 0;
    this.width = config.padding * 2 + avatarAreaWidth + textWidth;
    
    // 增加一点宽度容错，防止文字被截断
    offscreen.width = this.width + 2; 
    offscreen.height = this.height + 2;

    // 绘制背景 (胶囊形状)
    oCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    drawRoundedPath(oCtx, 0, 0, this.width, this.height, this.height / 2);
    oCtx.fill();

    // 绘制文本
    oCtx.fillStyle = '#ffffff';
    oCtx.font = `${config.fontSize}px sans-serif`;
    oCtx.textBaseline = 'middle';
    const textX = config.padding + avatarAreaWidth;
    oCtx.fillText(this.text, textX, this.height / 2 + 1); // +1 微调垂直居中

    this.cacheCanvas = offscreen;
    this.isReady = true;

    // 异步加载头像
    if (this.userFace) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = this.userFace;
      img.onload = () => {
        // 重绘以包含头像
        if (!this.cacheCanvas) return;
        const ctx = this.cacheCanvas.getContext('2d');
        if (!ctx) return;
        
        ctx.save();
        ctx.beginPath();
        const avatarX = config.padding;
        const avatarY = (this.height - config.avatarSize) / 2;
        ctx.arc(avatarX + config.avatarSize / 2, avatarY + config.avatarSize / 2, config.avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, config.avatarSize, config.avatarSize);
        ctx.restore();
      };
      // 错误处理：如果图片加载失败，就保持原样（只有背景和文字）
      img.onerror = () => {
         // console.warn('头像加载失败', this.userFace);
      };
    }
  }
}

// 运行时状态管理
const activeDanmakus: Danmaku[] = [];
const lastDanmakuOnTracks: (Danmaku | null)[] = [];
let currentIndex = 0;
let lastEmitTime = 0;
let isRunning = false;

// 更新 Canvas 尺寸
const resizeCanvas = () => {
  if (!containerRef.value || !canvasRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  if (rect.width === 0) return;

  screenWidth = rect.width;
  screenHeight = rect.height;
  dpr = window.devicePixelRatio || 1;

  canvasRef.value.width = screenWidth * dpr;
  canvasRef.value.height = screenHeight * dpr;
  canvasRef.value.style.width = `${screenWidth}px`;
  canvasRef.value.style.height = `${screenHeight}px`;

  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  
  // 重置轨道状态
  const trackCount = Math.floor((screenHeight - 20) / config.trackHeight);
  if (lastDanmakuOnTracks.length !== trackCount) {
    lastDanmakuOnTracks.length = trackCount;
    lastDanmakuOnTracks.fill(null);
  }
};

// 尝试发射弹幕
const tryEmitDanmaku = () => {
  if (danmakuList.value.length === 0) return;

  const now = Date.now();
  // 发射间隔控制，根据轨道数量动态调整，避免过于密集或稀疏
  const minInterval = Math.max(100, 1500 / (lastDanmakuOnTracks.length || 1));
  if (now - lastEmitTime < minInterval) return;

  // 寻找可用轨道
  const availableTracks: number[] = [];
  for (let i = 0; i < lastDanmakuOnTracks.length; i++) {
    const last = lastDanmakuOnTracks[i];
    // 规则：轨道为空，或者上一条弹幕已经完全进入屏幕一段距离
    // 增加间距：min(50px, random)
    const minDistance = 50 + Math.random() * 50;
    if (!last || (last.x + last.width + minDistance < screenWidth)) {
      availableTracks.push(i);
    }
  }

  if (availableTracks.length === 0) return;

  // 随机选择一个可用轨道
  const trackIndex = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  
  // 获取数据
  const comment = danmakuList.value[currentIndex];
  currentIndex = (currentIndex + 1) % danmakuList.value.length;

  // 计算速度：像素/帧
  // 基准速度：screenWidth / (props.speed * 60)
  // 加上随机波动 (0.8 ~ 1.2 倍)
  const baseSpeed = (screenWidth + 200) / (props.speed * 60); 
  const speed = baseSpeed * (0.8 + Math.random() * 0.4);

  const danmaku = new Danmaku(comment, trackIndex, speed);
  danmaku.x = screenWidth; // 设置起始位置
  
  activeDanmakus.push(danmaku);
  lastDanmakuOnTracks[trackIndex] = danmaku;
  lastEmitTime = now;
};

// 渲染循环
const render = () => {
  if (!isRunning) return;
  
  // 如果容器大小变化（简单检测）
  if (containerRef.value && Math.abs(containerRef.value.clientWidth - screenWidth) > 10) {
    resizeCanvas();
  }

  if (ctx && screenWidth > 0) {
    ctx.clearRect(0, 0, screenWidth, screenHeight);

    // 倒序遍历以便安全删除
    for (let i = activeDanmakus.length - 1; i >= 0; i--) {
      const d = activeDanmakus[i];
      d.x -= d.speed;

      // 绘制
      if (d.cacheCanvas && d.isReady) {
        ctx.drawImage(d.cacheCanvas, d.x, d.y, d.width, d.height);
      } else {
        // 如果离屏 Canvas 还没准备好（虽然构造函数是同步的，但 Image 是异步的，这里主要防止异常）
        // 也可以选择在这里直接 fillText 作为 fallback
      }

      // 移除
      if (d.x + d.width < -100) {
        activeDanmakus.splice(i, 1);
        // 如果它是轨道上最后一条，需要更新轨道状态吗？
        // 不需要，lastDanmakuOnTracks 引用的是对象，只要对象还在内存中就可以读取属性
        // 但为了防止内存泄漏，lastDanmakuOnTracks 里的引用应该被新弹幕覆盖，或者无需手动清理
      }
    }
  }

  tryEmitDanmaku();
  animationFrameId = requestAnimationFrame(render);
};

// 启动/停止
const start = () => {
  if (isRunning) return;
  isRunning = true;
  render();
};

const stop = () => {
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const reloadDanmaku = async () => {
  stop();
  activeDanmakus.length = 0;
  lastDanmakuOnTracks.fill(null);
  ctx?.clearRect(0, 0, screenWidth, screenHeight);
  await fetchDanmakuData();
};

const fetchDanmakuData = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const response = await getCommentList({
      page: 1,
      pageSize: props.pageSize,
      type: props.type,
      id: props.id,
    });
    if (response?.rows && response.rows.length > 0) {
      danmakuList.value = response.rows;
      currentIndex = 0;
      nextTick(() => {
        resizeCanvas();
        start();
      });
    }
  } catch (error) {
    console.error('获取弹幕失败:', error);
  } finally {
    isLoading.value = false;
  }
};

defineExpose({
  reload: reloadDanmaku
});

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d');
  }
  
  // 监听 Resize
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resizeCanvas);
  }

  nextTick(() => {
    resizeCanvas();
    fetchDanmakuData();
  });
});

onBeforeUnmount(() => {
  stop();
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', resizeCanvas);
  }
  activeDanmakus.length = 0;
});

watch([() => props.width, () => props.height], () => {
  nextTick(resizeCanvas);
});
</script>

<template>
  <div
    ref="containerRef"
    :class="['danmaku-container', props.className]"
    :style="{
      width: props.width,
      height: props.height,
    }"
  >
    <canvas ref="canvasRef" class="danmaku-canvas"></canvas>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="danmaku-loading">
      <div class="loading-spinner"></div>
      <span class="loading-text">加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-if="!isLoading && danmakuList.length === 0" class="danmaku-empty">
      <span>暂无弹幕</span>
    </div>

    <!-- 控制按钮 -->
    <div class="danmaku-controls">
      <button
        class="reload-btn"
        @click="reloadDanmaku"
        :disabled="isLoading"
        title="重新加载"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 21h5v-5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.danmaku-container {
  position: relative;
  overflow: hidden;
  user-select: none;
  background: transparent;
}

.danmaku-canvas {
  display: block;
  pointer-events: none; /* 穿透点击 */
}

.danmaku-loading,
.danmaku-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 20;
  pointer-events: none;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text, .danmaku-empty {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.danmaku-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 30;
}

.reload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reload-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.7);
  transform: rotate(180deg);
}

.reload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
