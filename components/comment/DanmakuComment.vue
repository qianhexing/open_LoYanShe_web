<script setup lang="ts">
import type { Comment, PaginationResponse } from '@/types/api';
import { getCommentList } from '@/api/comment';
import { formatRich } from '@/utils/public';
import UserInfo from '@/components/user/UserInfo.vue';

interface Props {
  type: string;
  id?: number;
  width?: string;
  height?: string;
  pageSize?: number;
  speed?: number; // 弹幕速度，单位：秒
  fontSize?: string;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '100vh',
  pageSize: 50,
  speed: 15, // 默认15秒完成滚动
  fontSize: '14px',
});

// 弹幕数据
const danmakuList = ref<Comment[]>([]);
const isLoading = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const containerHeight = ref(0);

// 弹幕轨道管理
interface DanmakuTrack {
  id: number;
  top: number;
  isAvailable: boolean;
}

const tracks = ref<DanmakuTrack[]>([]);
const trackHeight = 50; // 每条轨道的高度
const minTrackSpacing = 10; // 轨道之间的最小间距

// 计算可用轨道
const calculateTracks = () => {
  if (!containerHeight.value) return;
  
  const trackCount = Math.floor((containerHeight.value - 20) / (trackHeight + minTrackSpacing));
  const newTracks = Array.from({ length: trackCount }, (_, i) => ({
    id: i,
    top: 20 + i * (trackHeight + minTrackSpacing),
    isAvailable: true,
  }));
  
  // 更新现有弹幕的轨道位置缓存
  if (tracks.value.length > 0 && activeDanmakus.value.length > 0) {
    for (const danmaku of activeDanmakus.value) {
      const newTrack = newTracks.find(t => t.id === danmaku.trackId);
      if (newTrack) {
        danmaku.trackTop = newTrack.top;
      }
    }
  }
  
  tracks.value = newTracks;
};

// 防抖函数
const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// 监听窗口大小变化
const updateContainerSize = () => {
  if (containerRef.value) {
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    containerWidth.value = width;
    containerHeight.value = height;
    calculateTracks();
    // 调试信息
    if (process.client && width === 0) {
      console.warn('弹幕容器宽度为0，可能导致动画无法显示');
    }
  }
};

// 防抖后的更新函数
const debouncedUpdateContainerSize = debounce(updateContainerSize, 150);

// 获取弹幕数据
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
      // 等待容器尺寸和轨道计算完成后再启动
      nextTick(() => {
        updateContainerSize(); // 确保容器尺寸已更新
        if (tracks.value.length > 0 && containerWidth.value > 0) {
          startDanmaku();
        } else {
          // 如果轨道未计算，延迟启动
          setTimeout(() => {
            updateContainerSize(); // 再次更新容器尺寸
            if (tracks.value.length > 0 && containerWidth.value > 0) {
              startDanmaku();
            }
          }, 300);
        }
      });
    }
  } catch (error) {
    console.error('获取弹幕失败:', error);
  } finally {
    isLoading.value = false;
  }
};

// 弹幕项接口
interface DanmakuItem {
  id: number;
  comment: Comment;
  trackId: number;
  trackTop: number; // 缓存轨道位置，避免模板中频繁查找
  left: number;
  animationDuration: number;
  delay: number;
  text: string; // 缓存处理后的文本
  translateX: string; // 缓存的 translateX 值，避免模板中计算
}

const activeDanmakus = ref<DanmakuItem[]>([]);
let danmakuIndex = 0;
let sendTimer: ReturnType<typeof setTimeout> | null = null;
let isDanmakuRunning = false;
const releaseTimers = new Set<ReturnType<typeof setTimeout>>(); // 保存所有释放定时器

// 启动弹幕
const startDanmaku = () => {
  if (danmakuList.value.length === 0 || tracks.value.length === 0 || containerWidth.value === 0) {
    // 如果数据或轨道未准备好，延迟启动
    setTimeout(() => {
      if (danmakuList.value.length > 0 && tracks.value.length > 0 && containerWidth.value > 0) {
        startDanmaku();
      }
    }, 500);
    return;
  }
  
  // 清空现有弹幕和定时器
  stopDanmaku();
  
  isDanmakuRunning = true;
  danmakuIndex = 0;
  
  // 开始发送弹幕
  sendNextDanmaku();
};

// 停止弹幕
const stopDanmaku = () => {
  isDanmakuRunning = false;
  if (sendTimer) {
    clearTimeout(sendTimer);
    sendTimer = null;
  }
  // 清理所有释放定时器
  for (const timer of releaseTimers) {
    clearTimeout(timer);
  }
  releaseTimers.clear();
};

// 发送下一条弹幕
const sendNextDanmaku = () => {
  if (!isDanmakuRunning) return;
  
  if (danmakuList.value.length === 0 || tracks.value.length === 0) {
    stopDanmaku();
    return;
  }
  
  if (danmakuIndex >= danmakuList.value.length) {
    // 循环播放
    danmakuIndex = 0;
  }
  
  const comment = danmakuList.value[danmakuIndex];
  if (!comment) {
    danmakuIndex++;
    sendTimer = setTimeout(() => sendNextDanmaku(), 100);
    return;
  }
  
  // 找到可用轨道（随机选择，避免总是从第一条开始）
  const availableTracks = tracks.value.filter(track => track.isAvailable);
  if (availableTracks.length === 0) {
    // 如果没有可用轨道，延迟重试
    sendTimer = setTimeout(() => sendNextDanmaku(), 300);
    return;
  }
  
  const availableTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  
  // 确保容器宽度有效
  if (containerWidth.value === 0) {
    console.warn('容器宽度为0，跳过弹幕创建');
    sendTimer = setTimeout(() => sendNextDanmaku(), 100);
    return;
  }
  
  // 计算动画时长（根据速度和容器宽度）
  const baseDuration = props.speed;
  const randomDuration = Math.max(8, baseDuration + (Math.random() * 4 - 2)); // 随机变化 ±2秒，最少8秒
  
  // 计算动画结束位置的 translateX 值（容器宽度 + 弹幕自身宽度，使用负值）
  // 由于弹幕宽度是动态的，我们使用一个足够大的值确保完全移出屏幕
  const translateXEnd = `-${containerWidth.value + 500}px`; // 500px 作为弹幕最大宽度的估算值
  
  // 创建弹幕项
  const danmakuItem: DanmakuItem = {
    id: Date.now() + Math.random(),
    comment,
    trackId: availableTrack.id,
    trackTop: availableTrack.top, // 缓存轨道位置
    left: containerWidth.value,
    animationDuration: randomDuration,
    delay: Math.random() * 1, // 随机延迟0-1秒
    text: getDanmakuText(comment.comment_content), // 预处理文本
    translateX: translateXEnd, // 缓存 translateX 值
  };
  
  activeDanmakus.value.push(danmakuItem);
  
  // 标记轨道为不可用
  availableTrack.isAvailable = false;
  
  // 弹幕结束后释放轨道
  const releaseTimeout = setTimeout(() => {
    const track = tracks.value.find(t => t.id === availableTrack.id);
    if (track) {
      track.isAvailable = true;
    }
    // 移除弹幕
    const index = activeDanmakus.value.findIndex(d => d.id === danmakuItem.id);
    if (index > -1) {
      activeDanmakus.value.splice(index, 1);
    }
    releaseTimers.delete(releaseTimeout);
  }, (randomDuration + danmakuItem.delay) * 1000);
  releaseTimers.add(releaseTimeout);
  
  danmakuIndex++;
  
  // 计算下一条弹幕的发送时间（根据轨道数量和速度动态调整）
  const interval = Math.max(200, (props.speed * 1000) / tracks.value.length / 3);
  sendTimer = setTimeout(() => sendNextDanmaku(), interval);
};

// 重新加载弹幕
const reloadDanmaku = async () => {
  stopDanmaku();
  activeDanmakus.value = [];
  danmakuIndex = 0;
  textCache.clear(); // 清空文本缓存
  // 重置所有轨道为可用
  for (const track of tracks.value) {
    track.isAvailable = true;
  }
  await fetchDanmakuData();
};

// 缓存文本处理结果
const textCache = new Map<string, string>();

// 处理弹幕文本内容
const getDanmakuText = (content?: string): string => {
  if (!content) return '评论';
  
  // 检查缓存
  const cached = textCache.get(content);
  if (cached !== undefined) {
    return cached;
  }
  
  let result: string;
  // 使用 formatRich 提取纯文本
  try {
    const richRes = formatRich(content);
    const text = richRes.text || content;
    // 移除 HTML 标签
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    // 限制长度
    result = plainText.length > 40 ? `${plainText.substring(0, 40)}...` : plainText;
  } catch (error) {
    // 如果格式化失败，直接移除 HTML 标签
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    result = plainText.length > 40 ? `${plainText.substring(0, 40)}...` : plainText;
  }
  
  // 缓存结果（限制缓存大小，避免内存泄漏）
  if (textCache.size > 100) {
    const firstKey = textCache.keys().next().value;
    if (firstKey !== undefined) {
      textCache.delete(firstKey);
    }
  }
  textCache.set(content, result);
  return result;
};

// 暴露重新加载方法
defineExpose({
  reload: reloadDanmaku,
});

// 生命周期
onMounted(() => {
  // 等待 DOM 渲染完成后再更新容器尺寸
  nextTick(() => {
    updateContainerSize();
    fetchDanmakuData();
  });
  
  // 监听窗口大小变化（使用防抖）
  if (process.client) {
    window.addEventListener('resize', debouncedUpdateContainerSize);
  }
});

onBeforeUnmount(() => {
  stopDanmaku();
  textCache.clear(); // 清理缓存
  if (process.client) {
    window.removeEventListener('resize', debouncedUpdateContainerSize);
  }
});

// 监听容器尺寸变化
watch([() => props.width, () => props.height], () => {
  nextTick(() => {
    updateContainerSize();
    // 如果弹幕正在运行但轨道未初始化，重新启动
    if (isDanmakuRunning && tracks.value.length === 0 && danmakuList.value.length > 0) {
      startDanmaku();
    }
  });
});

// 监听轨道变化，如果弹幕数据已加载但未启动，则启动
watch([() => tracks.value.length, () => danmakuList.value.length], ([trackLen, listLen]) => {
  if (trackLen > 0 && listLen > 0 && !isDanmakuRunning) {
    nextTick(() => {
      startDanmaku();
    });
  }
});
</script>

<template>
  <div
    ref="containerRef"
    :class="['danmaku-container', props.className]"
    :style="{
      width: props.width,
      height: props.height,
      position: 'relative',
      overflow: 'hidden',
    }"
  >
    <!-- 弹幕列表 -->
    <TransitionGroup
      name="danmaku"
      tag="div"
      class="danmaku-wrapper"
    >
      <div
        v-for="danmaku in activeDanmakus"
        :key="danmaku.id"
        class="danmaku-item"
        :style="{
          top: `${danmaku.trackTop}px`,
          fontSize: props.fontSize,
          left: `${containerWidth}px`,
          '--animation-duration': `${danmaku.animationDuration}s`,
          '--animation-delay': `${danmaku.delay}s`,
          '--translate-x': danmaku.translateX,
          animation: containerWidth > 0 ? `danmakuMove ${danmaku.animationDuration}s linear ${danmaku.delay}s forwards` : 'none',
        }"
        :class="{ 'danmaku-moving': containerWidth > 0 }"
      >
        <div class="danmaku-content">
          <div class="danmaku-user">
            <!-- <UserInfo :user="danmaku.comment.user" size="mini" /> -->
            <UserFace :user="danmaku.comment.user" :size="'mini'"></UserFace>
          </div>
          <div class="danmaku-text">
            {{ danmaku.text }}
          </div>
        </div>
      </div>
    </TransitionGroup>

    <!-- 加载状态 -->
    <div
      v-if="isLoading"
      class="danmaku-loading"
    >
      <div class="loading-spinner"></div>
      <span class="loading-text">加载弹幕中...</span>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!isLoading && danmakuList.length === 0"
      class="danmaku-empty"
    >
      <span>暂无弹幕</span>
    </div>

    <!-- 控制按钮 -->
    <div class="danmaku-controls">
      <button
        class="reload-btn"
        @click="reloadDanmaku"
        :disabled="isLoading"
        title="重新加载弹幕"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.danmaku-container {
  background: transparent;
  user-select: none;
}

.danmaku-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.danmaku-item {
  position: absolute;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  will-change: transform;
  backface-visibility: hidden; /* 优化渲染性能 */
  /* 注意：不在这里设置 transform，让动画控制 transform */
}

.danmaku-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  max-width: 400px;
}

.danmaku-user {
  flex-shrink: 0;
  font-size: 12px;
}

.danmaku-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: inherit;
}

/* 弹幕动画 - 使用 GPU 加速 */
@keyframes danmakuMove {
  from {
    transform: translateX(0) translateZ(0);
  }
  to {
    /* 使用 CSS 变量传递 translateX 值 */
    transform: translateX(var(--translate-x, -100vw)) translateZ(0);
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .danmaku-content {
    max-width: 280px;
    padding: 4px 10px;
    font-size: 12px;
  }

  .danmaku-user {
    font-size: 10px;
  }
}

/* 加载状态 */
.danmaku-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 20;
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
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

/* 空状态 */
.danmaku-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  z-index: 20;
}

/* 控制按钮 */
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
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.reload-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
  transform: rotate(180deg);
}

.reload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reload-btn:active:not(:disabled) {
  transform: scale(0.95) rotate(180deg);
}

/* 弹幕进入动画 */
.danmaku-enter-active {
  transition: opacity 0.3s ease;
}

.danmaku-enter-from {
  opacity: 0;
}

.danmaku-enter-to {
  opacity: 1;
}

.danmaku-leave-active {
  transition: opacity 0.3s ease;
}

.danmaku-leave-from {
  opacity: 1;
}

.danmaku-leave-to {
  opacity: 0;
}
</style>
