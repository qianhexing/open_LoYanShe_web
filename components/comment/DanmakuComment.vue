<script setup lang="ts">
import type { Comment } from '@/types/api';
import { getCommentList } from '@/api/comment';
import { formatRich } from '@/utils/public';
import { BASE_IMG } from '@/utils/ipConfig';
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import UserInfo from '@/components/user/UserInfo.vue';

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
  speed: 20, // 降低默认速度
  fontSize: '14px',
});

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isLoading = ref(false);
const danmakuList = ref<Comment[]>([]);
const isVisible = ref(true); // 控制弹幕显示隐藏
const selectedDanmaku = ref<Danmaku | null>(null); // 当前选中的弹幕
const isPaused = ref(false); // 动画是否暂停

// Canvas 上下文与状态
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;
let screenWidth = 0;
let screenHeight = 0;
let dpr = 1;

// 弹幕配置
const config = {
  trackHeight: 46, // 轨道高度，稍微增加一点
  margin: 10,       // 轨道间距
  avatarSize: 28,  // 头像大小
  padding: 10,     // 左右内边距
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
  comment: Comment; // 保存原始数据以便弹窗使用
  width: number = 0;
  height: number;
  cacheCanvas: HTMLCanvasElement | null = null;
  isReady: boolean = false;

  constructor(comment: Comment, trackIndex: number, speed: number) {
    this.comment = comment;
    this.text = this.processText(comment.comment_content);
    this.userFace = comment.user?.user_face ? `${BASE_IMG}${comment.user.user_face}` : '';
    // 计算 Y 坐标：垂直居中于轨道
    this.height = 36; // 弹幕胶囊的高度
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
    offscreen.width = this.width + 4; 
    offscreen.height = this.height + 4;

    // 绘制阴影 (虽然在离屏Canvas绘制阴影可能被裁剪，我们留一点边距)
    // 但为了性能，简单背景+边框即可，阴影可以通过CSS给容器加，或者在这里画
    
    // 绘制背景 (胶囊形状) - 半透明黑色
    oCtx.fillStyle = 'rgba(0, 0, 0, 0.5)'; 
    drawRoundedPath(oCtx, 1, 1, this.width, this.height, this.height / 2);
    oCtx.fill();

    // 绘制边框 - 淡淡的白色
    oCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    oCtx.lineWidth = 1;
    oCtx.stroke();

    // 绘制文本
    oCtx.fillStyle = '#ffffff';
    oCtx.font = `${config.fontSize}px sans-serif`;
    oCtx.textBaseline = 'middle';
    const textX = config.padding + avatarAreaWidth;
    oCtx.fillText(this.text, textX + 1, this.height / 2 + 1); // +1 微调垂直居中

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
        ctx.drawImage(img, avatarX + 1, avatarY + 1, config.avatarSize, config.avatarSize);
        ctx.restore();
      };
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
  if (danmakuList.value.length === 0 || !isVisible.value || isPaused.value) return;

  const now = Date.now();
  // 发射间隔控制
  let minInterval = Math.max(100, 1500 / (lastDanmakuOnTracks.length || 1));
  
  // 如果弹幕数量很少，增加间隔以避免重复感
  if (danmakuList.value.length <= 5) {
    minInterval = 3000; // 3秒
  } else if (danmakuList.value.length <= 10) {
    minInterval = 2000;
  }

  if (now - lastEmitTime < minInterval) return;

  // 寻找可用轨道
  const availableTracks: number[] = [];
  for (let i = 0; i < lastDanmakuOnTracks.length; i++) {
    const last = lastDanmakuOnTracks[i];
    // 规则：轨道为空，或者上一条弹幕已经完全进入屏幕一段距离
    const minDistance = 50 + Math.random() * 80;
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
  // 降低速度：props.speed 增大，速度减小
  const baseSpeed = (screenWidth + 200) / (props.speed * 60); 
  const speed = baseSpeed * (0.9 + Math.random() * 0.2); // 减小随机波动

  const danmaku = new Danmaku(comment, trackIndex, speed);
  danmaku.x = screenWidth; // 设置起始位置
  
  activeDanmakus.push(danmaku);
  lastDanmakuOnTracks[trackIndex] = danmaku;
  lastEmitTime = now;
};

// 渲染循环
const render = () => {
  if (!isRunning) return;
  
  // 如果容器大小变化
  if (containerRef.value && Math.abs(containerRef.value.clientWidth - screenWidth) > 10) {
    resizeCanvas();
  }

  if (ctx && screenWidth > 0) {
    // 只有在弹幕显示时才清空和绘制
    // 如果不显示，可以清空后不绘制，或者保留当前帧（根据需求，这里选择清空）
    ctx.clearRect(0, 0, screenWidth, screenHeight);

    if (isVisible.value) {
      // 倒序遍历
      for (let i = activeDanmakus.length - 1; i >= 0; i--) {
        const d = activeDanmakus[i];
        
        // 如果未暂停，更新位置
        if (!isPaused.value) {
          d.x -= d.speed;
        }

        // 绘制
        if (d.cacheCanvas && d.isReady) {
          ctx.drawImage(d.cacheCanvas, d.x, d.y, d.width, d.height);
        }

        // 移除
        if (d.x + d.width < -100) {
          activeDanmakus.splice(i, 1);
        }
      }
    }
  }

  tryEmitDanmaku();
  animationFrameId = requestAnimationFrame(render);
};

// 点击处理
const handleCanvasClick = (e: MouseEvent) => {
  if (!isVisible.value || !canvasRef.value) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // 查找被点击的弹幕（倒序查找，因为后绘制的在上面）
  // 简单的矩形碰撞检测
  for (let i = activeDanmakus.length - 1; i >= 0; i--) {
    const d = activeDanmakus[i];
    // d.x, d.y 是逻辑坐标，clickX, clickY 也是逻辑坐标（相对于元素尺寸）
    if (clickX >= d.x && clickX <= d.x + d.width &&
        clickY >= d.y && clickY <= d.y + d.height) {
      
      // 选中了弹幕
      selectedDanmaku.value = d;
      isPaused.value = true; // 暂停所有动画
      return;
    }
  }
  
  // 如果点击空白处，关闭弹窗并恢复
  if (selectedDanmaku.value) {
    closePopup();
  }
};

const closePopup = () => {
  selectedDanmaku.value = null;
  isPaused.value = false;
};

const toggleVisibility = () => {
  isVisible.value = !isVisible.value;
  // 如果关闭可见性，也关闭弹窗
  if (!isVisible.value) {
    closePopup();
  }
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
    canvasRef.value.addEventListener('click', handleCanvasClick);
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
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('click', handleCanvasClick);
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

    <!-- 用户信息弹窗 -->
    <div v-if="selectedDanmaku" class="user-popup-overlay" @click="closePopup">
      <div class="user-popup" @click.stop>
        <div class="popup-header">
           <span class="popup-title">用户信息</span>
           <button class="close-btn" @click="closePopup">&times;</button>
        </div>
        <UserInfo :user="selectedDanmaku.comment.user" size="mini" class="popup-user-info" />
        <div class="popup-comment">
          {{ selectedDanmaku.comment.comment_content.replace(/<[^>]*>/g, '') }}
        </div>
      </div>
    </div>

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
        class="control-btn"
        @click="toggleVisibility"
        :title="isVisible ? '隐藏弹幕' : '显示弹幕'"
      >
        <svg v-if="isVisible" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      </button>

      <button
        class="control-btn"
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
  cursor: pointer; /* 提示可点击 */
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

/* 控制按钮 - 移动到左下角 */
.danmaku-controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 30;
  display: flex;
  gap: 10px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.control-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 用户信息弹窗 */
.user-popup-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-popup {
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  width: 280px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  animation: popup-enter 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

@keyframes popup-enter {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.popup-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #fff;
}

.popup-user-info {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
}

.popup-comment {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
}
</style>
