<script setup lang="ts">
import type { Comment } from '@/types/api';
import { getCommentList, insertComment, deleteComment } from '@/api/comment';
import { formatRich } from '@/utils/public';
import { BASE_IMG } from '@/utils/ipConfig';
import { onMounted, onBeforeUnmount, ref, shallowRef, watch, nextTick } from 'vue';
import UserInfo from '@/components/user/UserInfo.vue';

interface Props {
  type: string;
  id?: number | number[];
  width?: string;
  height?: string;
  pageSize?: number;
  speed?: number; // 弹幕穿过屏幕的基准时间（秒）
  fontSize?: string;
  className?: string;
  /** 是否拥有删除权限：true 时可删除任意弹幕（如衣柜创建者），默认为 false 时仅能删除自己的弹幕 */
  canDeleteAll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '100vh',
  pageSize: 50,
  speed: 28, // 进一步降低默认速度 (原来是20)
  fontSize: '14px',
  canDeleteAll: false,
});

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isLoading = ref(false);
const danmakuList = ref<Comment[]>([]);
const isVisible = ref(true); // 控制弹幕显示隐藏
const selectedDanmaku = shallowRef<Danmaku | null>(null); // 当前选中的弹幕（shallowRef 避免深度响应化 Danmaku 内含的 cacheCanvas 等导致卡死）
const isPaused = ref(false); // 动画是否暂停
const showSendDialog = ref(false); // 显示发送弹幕对话框
const showMessageBoard = ref(false); // 显示留言板
const DANMAKU_CONTROLS_KEY = 'danmaku-controls-expanded';
const controlsExpanded = ref(true); // 默认展开，onMounted 时从 localStorage 恢复
const sendContent = ref(''); // 发送内容
const isSending = ref(false); // 是否正在发送
const latestSentCommentId = ref<number | null>(null); // 最近发送的评论ID
const isDeleting = ref(false); // 是否正在删除
const user = useUserStore();
const configStore = useConfigStore();
const port = computed(() => configStore.getPort());

// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any;

// Canvas 上下文与状态
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;
let screenWidth = 0;
let screenHeight = 0;
let dpr = 1;

// 弹幕配置
const config = {
  trackHeight: 46, // 轨道高度
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
  width = 0;
  height: number;
  cacheCanvas: HTMLCanvasElement | null = null;
  isReady = false;
  isHighlighted = false; // 是否高亮（刚刚发送的）

  constructor(comment: Comment, trackIndex: number, speed: number, isHighlighted = false) {
    this.comment = comment;
    this.text = this.processText(comment.comment_content);
    this.userFace = comment.user?.user_face ? `${BASE_IMG}${comment.user.user_face}` : '';
    this.isHighlighted = isHighlighted;
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

    // 绘制背景 (胶囊形状) - 根据是否高亮选择不同颜色
    if (this.isHighlighted) {
      // 高亮背景 - 使用更亮的颜色，比如蓝色或绿色
      oCtx.fillStyle = 'rgba(59, 130, 246, 0.7)'; // 蓝色高亮
    } else {
      // 普通背景 - 半透明黑色
      oCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    }
    drawRoundedPath(oCtx, 1, 1, this.width, this.height, this.height / 2);
    oCtx.fill();

    // 绘制边框 - 高亮时使用更亮的边框
    if (this.isHighlighted) {
      oCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    } else {
      oCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    }
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
  let minInterval = Math.max(100, 50000 / (lastDanmakuOnTracks.length || 1));
  
  // 如果弹幕数量很少，增加间隔以避免重复感
  if (danmakuList.value.length <= 5) {
    minInterval = 8000; // 3秒
  } else if (danmakuList.value.length <= 10) {
    minInterval = 5000;
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

  // 判断是否高亮（刚刚发送的）
  const isHighlighted = latestSentCommentId.value === comment.comment_id;
  const danmaku = new Danmaku(comment, trackIndex, speed, isHighlighted);
  danmaku.x = screenWidth; // 设置起始位置
  
  activeDanmakus.push(danmaku);
  lastDanmakuOnTracks[trackIndex] = danmaku;
  lastEmitTime = now;
  
  // 如果这是高亮的弹幕，5秒后清除高亮标记
  if (isHighlighted) {
    setTimeout(() => {
      latestSentCommentId.value = null;
    }, 5000);
  }
};

// 渲染循环
const render = () => {
  if (!isRunning) return;
  
  // 如果容器大小变化
  if (containerRef.value && Math.abs(containerRef.value.clientWidth - screenWidth) > 10) {
    resizeCanvas();
  }

  if (ctx && screenWidth > 0) {
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

// 鼠标位置监测，用于动态切换 pointer-events
const handleMouseMove = (e: MouseEvent) => {
  if (!isVisible.value || !canvasRef.value) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  let isHoveringDanmaku = false;

  // 检查是否悬停在任意弹幕上
  for (let i = activeDanmakus.length - 1; i >= 0; i--) {
    const d = activeDanmakus[i];
    if (mouseX >= d.x && mouseX <= d.x + d.width &&
        mouseY >= d.y && mouseY <= d.y + d.height) {
      isHoveringDanmaku = true;
      break;
    }
  }

  // 只有当鼠标悬停在弹幕上时，Canvas 才接收点击事件
  // 否则让点击穿透到底层元素
  if (isHoveringDanmaku) {
    canvasRef.value.style.pointerEvents = 'auto';
    canvasRef.value.style.cursor = 'pointer';
  } else {
    canvasRef.value.style.pointerEvents = 'none';
    canvasRef.value.style.cursor = 'default';
  }
};

// 跳转到用户空间（区分 UniApp、鸿蒙、普通网页）
const jumpToUserSpace = (userId?: number) => {
  if (!userId) return;

  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/userSpace/userSpace?id=${userId}`,
      fail: () => {
        console.log('跳转用户空间失败');
      },
    });
  } else if (port.value) {
    // 鸿蒙系统
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'UserSpace',
      params: { id: userId },
    }));
  } else {
    // 普通网页环境
    navigateTo(`/userSpace/${userId}`);
  }
};

// 点击处理
const handleCanvasClick = (e: MouseEvent) => {
  if (!isVisible.value || !canvasRef.value) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // 查找被点击的弹幕
  for (let i = activeDanmakus.length - 1; i >= 0; i--) {
    const d = activeDanmakus[i];
    if (clickX >= d.x && clickX <= d.x + d.width &&
        clickY >= d.y && clickY <= d.y + d.height) {
      // 点击弹幕任意区域 -> 显示弹窗
      selectedDanmaku.value = d;
      isPaused.value = true;
      return;
    }
  }

  // 如果已选中弹幕但点击了非弹幕区域，且该点击事件被 canvas 捕获了
  // (通常不会发生，因为 handleMouseMove 会把 pointerEvents 设为 none)
  if (selectedDanmaku.value) {
    closePopup();
  }
};

const closePopup = () => {
  selectedDanmaku.value = null;
  isPaused.value = false;
};

// 是否可删除当前选中弹幕：自己的弹幕 或 拥有删除权限（如衣柜创建者）
const canDeleteSelected = computed(() => {
  const d = selectedDanmaku.value;
  if (!d?.comment?.comment_id) return false;
  if (props.canDeleteAll) return true;
  const uid = user.user?.user_id;
  return !!(d?.comment?.user?.user_id && uid && d.comment.user.user_id === uid);
});

// 删除弹幕
const handleDeleteComment = async () => {
  const d = selectedDanmaku.value;
  if (!d?.comment?.comment_id || isDeleting.value) return;
  if (!canDeleteSelected.value) return;

  isDeleting.value = true;
  try {
    const ok = await deleteComment({ comment_id: d.comment.comment_id });
    if (ok) {
      danmakuList.value = danmakuList.value.filter((c) => c.comment_id !== d.comment.comment_id);
      const idx = activeDanmakus.findIndex((item) => item.comment.comment_id === d.comment.comment_id);
      if (idx >= 0) activeDanmakus.splice(idx, 1);
      closePopup();
      useToast().add({ title: '已删除', icon: 'i-heroicons-check-circle', color: 'green' });
    }
  } catch (e) {
    useToast().add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' });
  } finally {
    isDeleting.value = false;
  }
};

const toggleVisibility = () => {
  isVisible.value = !isVisible.value;
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

// 打开发送弹幕对话框
const openSendDialog = () => {
  showSendDialog.value = true;
  sendContent.value = '';
};

// 关闭发送弹幕对话框
const closeSendDialog = () => {
  showSendDialog.value = false;
  sendContent.value = '';
};

// 打开/关闭留言板
const toggleMessageBoard = () => {
  showMessageBoard.value = !showMessageBoard.value;
};

const closeMessageBoard = () => {
  showMessageBoard.value = false;
};

// 格式化留言内容用于列表展示
const formatCommentContent = (content: string) => {
  if (!content) return '...';
  try {
    const richRes = formatRich(content);
    const text = richRes.text || content;
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    return plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText;
  } catch {
    return content.replace(/<[^>]*>/g, '').trim().substring(0, 100);
  }
};

// 留言板中点击某条留言 -> 显示用户弹窗
const openCommentPopup = (comment: Comment) => {
  const d = new Danmaku(comment, 0, 0, latestSentCommentId.value === comment.comment_id);
  selectedDanmaku.value = d;
  isPaused.value = true;
  closeMessageBoard();
};

// 发送弹幕
const sendDanmaku = async () => {
  if (!sendContent.value.trim() || isSending.value) return;
  
  isSending.value = true;
  try {
    const targetId = Array.isArray(props.id) ? props.id[props.id.length - 1] : props.id;
    const response = await insertComment({
      page: 1,
      pageSize: 1,
      type: props.type,
      id: targetId,
      comment_content: sendContent.value.trim(),
    });
    
    if (response) {
      const newComment = { ...response };
      // 若接口未返回用户信息，用当前登录用户补全
      if ((!newComment.user || !newComment.user.user_id) && user.user) {
        newComment.user = {
          user_id: user.user.user_id,
          user_name: user.user.user_name,
          user_face: user.user.user_face,
          ...user.user,
        };
      }
      // 添加到弹幕列表
      danmakuList.value.unshift(newComment);
      // 记录最新发送的评论ID
      latestSentCommentId.value = newComment.comment_id;
      
      // 立即发射这条弹幕
      if (isVisible.value && !isPaused.value) {
        resizeCanvas(); // 确保画布尺寸正确（首次发弹幕时可能尚未初始化）
        const trackCount = Math.floor((screenHeight - 20) / config.trackHeight);
        if (trackCount > 0) {
          // 随机选择一个轨道
          const trackIndex = Math.floor(Math.random() * trackCount);
          const baseSpeed = (screenWidth + 200) / (props.speed * 60);
          const speed = baseSpeed * (0.9 + Math.random() * 0.2);
          const danmaku = new Danmaku(newComment, trackIndex, speed, true);
          danmaku.x = screenWidth;
          activeDanmakus.push(danmaku);
          lastDanmakuOnTracks[trackIndex] = danmaku;
          
          // 5秒后清除高亮
          setTimeout(() => {
            latestSentCommentId.value = null;
          }, 5000);
          
          // 若渲染循环未启动（如初始无评论），启动以立即显示新弹幕
          start();
        }
      }
      
      closeSendDialog();
    }
  } catch (error) {
    console.error('发送弹幕失败:', error);
  } finally {
    isSending.value = false;
  }
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

onMounted(async () => {
  // 加载 uni-webview-js（UniApp WebView 环境跳转用）
  try {
    // @ts-expect-error uni-webview-js 类型定义问题
    uni = await import('@dcloudio/uni-webview-js').catch(() => null);
  } catch {}

  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d');
    canvasRef.value.addEventListener('click', handleCanvasClick);
  }

  // 从缓存恢复展开/收起状态
  try {
    const v = localStorage.getItem(DANMAKU_CONTROLS_KEY);
    if (v !== null) controlsExpanded.value = v === '1';
  } catch {}

  // 监听 Resize
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resizeCanvas);
    // 监听全局鼠标移动以实现精确的点击穿透
    window.addEventListener('mousemove', handleMouseMove);
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
    window.removeEventListener('mousemove', handleMouseMove);
  }
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('click', handleCanvasClick);
  }
  activeDanmakus.length = 0;
});

watch([() => props.width, () => props.height], () => {
  nextTick(resizeCanvas);
});

// 展开/收起状态持久化
watch(controlsExpanded, (v) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DANMAKU_CONTROLS_KEY, v ? '1' : '0');
  } catch {}
}, { immediate: false });
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
           <div class="flex items-center gap-2">
             <button
               v-if="canDeleteSelected"
               type="button"
               class="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
               :disabled="isDeleting"
               @click="handleDeleteComment"
             >
               {{ isDeleting ? '删除中...' : '删除' }}
             </button>
             <button class="close-btn" @click="closePopup">&times;</button>
           </div>
        </div>
        <div
          v-if="selectedDanmaku.comment?.user"
          class="popup-user-info cursor-pointer hover:opacity-90 transition-opacity"
          @click="jumpToUserSpace(selectedDanmaku.comment?.user?.user_id); closePopup()"
        >
          <UserInfo :user="selectedDanmaku.comment.user" size="mini" />
        </div>
        <div v-else class="popup-user-fallback text-sm text-gray-500 py-2">用户信息加载中</div>
        <div class="popup-comment">
          {{ (selectedDanmaku.comment?.comment_content || '').replace(/<[^>]*>/g, '') }}
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
      <!-- <span>暂无弹幕</span> -->
    </div>

    <!-- 发送弹幕对话框 -->
    <div v-if="showSendDialog" class="send-dialog-overlay" @click="closeSendDialog">
      <div class="send-dialog" @click.stop>
        <div class="dialog-header">
          <span class="dialog-title">发送弹幕</span>
          <button class="close-btn" @click="closeSendDialog">&times;</button>
        </div>
        <div class="dialog-content">
          <textarea
            v-model="sendContent"
            class="send-textarea"
            placeholder="输入弹幕内容..."
            rows="4"
            maxlength="200"
          ></textarea>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn cancel-btn" @click="closeSendDialog">取消</button>
          <button 
            class="dialog-btn send-btn" 
            @click="sendDanmaku"
            :disabled="!sendContent.trim() || isSending"
          >
            {{ isSending ? '发送中...' : '发送' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 控制按钮：左下角可展开/收起 -->
    <div
      class="danmaku-controls flex flex-col rounded-l-xl bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 overflow-hidden transition-all duration-300 ease-out"
      :class="controlsExpanded
        ? 'bottom-5 right-0 max-h-[50vh] w-[110px] sm:w-[120px]'
        : 'bottom-5 right-0 w-[36px] sm:w-[40px]'"
    >
      <button
        type="button"
        class="flex items-center justify-center gap-1 py-2 px-1.5 shrink-0 text-qhx-primary hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors"
        :class="controlsExpanded ? 'border-b border-gray-100 dark:border-gray-600' : 'min-h-[40px]'"
        :title="controlsExpanded ? '收起' : '展开'"
        @click="controlsExpanded = !controlsExpanded"
      >
        <UIcon
          :name="controlsExpanded ? 'material-symbols:chevron-right' : 'material-symbols:chat-bubble-outline'"
          class="text-lg sm:text-xl transition-transform"
        />
        <span v-if="controlsExpanded" class="text-xs font-medium hidden sm:inline">弹幕</span>
      </button>
      <div
        class="danmaku-controls-content flex flex-col gap-2 min-h-0 overflow-hidden"
        :class="controlsExpanded ? 'expanded' : 'collapsed'"
      >
        <div class="p-1.5 pt-0 flex flex-col gap-1">
          <button
            type="button"
            class="danmaku-control-btn flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors text-left text-gray-700 dark:text-gray-200"
            :title="isVisible ? '隐藏弹幕' : '显示弹幕'"
            @click="toggleVisibility"
          >
            <div class="w-6 h-6 rounded-full bg-qhx-primary flex items-center justify-center shrink-0">
              <UIcon v-if="isVisible" name="i-heroicons-eye" class="text-xs text-white" />
              <UIcon v-else name="i-heroicons-eye-slash" class="text-xs text-white" />
            </div>
            <span class="text-xs font-medium">{{ isVisible ? '隐藏' : '显示' }}</span>
          </button>
          <button
            type="button"
            class="danmaku-control-btn flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors text-left text-gray-700 dark:text-gray-200"
            title="留言板"
            @click="toggleMessageBoard"
          >
            <div class="w-6 h-6 rounded-full bg-qhx-primary flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-clipboard-document-list" class="text-xs text-white" />
            </div>
            <span class="text-xs font-medium">留言板</span>
          </button>
          <button
            type="button"
            class="danmaku-control-btn flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors text-left text-gray-700 dark:text-gray-200"
            title="发送弹幕"
            @click="openSendDialog"
          >
            <div class="w-6 h-6 rounded-full bg-qhx-primary flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-paper-airplane" class="text-xs text-white" />
            </div>
            <span class="text-xs font-medium">发弹幕</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 留言板弹窗 -->
    <div v-if="showMessageBoard" class="message-board-overlay" @click="closeMessageBoard">
      <div class="message-board" @click.stop>
        <div class="message-board-header">
          <span class="message-board-title">留言板</span>
          <span class="message-board-count">共 {{ danmakuList.length }} 条</span>
          <button class="close-btn" @click="closeMessageBoard">&times;</button>
        </div>
        <div class="message-board-list">
          <div
            v-for="c in danmakuList"
            :key="c.comment_id"
            class="message-board-item"
            @click="openCommentPopup(c)"
          >
            <img
              v-if="c.user?.user_face"
              :src="`${BASE_IMG}${c.user.user_face}`"
              class="message-board-avatar"
              alt=""
            />
            <div v-else class="message-board-avatar message-board-avatar-placeholder">
              <UIcon name="i-heroicons-user" class="text-gray-400" />
            </div>
            <div class="message-board-content">
              <div class="message-board-user">{{ c.user?.user_name || '匿名' }}</div>
              <div class="message-board-text">{{ formatCommentContent(c.comment_content) }}</div>
            </div>
          </div>
          <div v-if="!isLoading && danmakuList.length === 0" class="message-board-empty">
            暂无留言
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.danmaku-container {
  position: relative;
  overflow: hidden;
  user-select: none;
  background: transparent;
  pointer-events: none; /* 关键：允许点击穿透整个容器 */
}

.danmaku-canvas {
  display: block;
  pointer-events: none; /* 默认不接收点击，由 JS 动态开启 */
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

/* 控制按钮 - 左下角，可展开/收起 */
.danmaku-controls {
  position: absolute;
  z-index: 30;
  pointer-events: auto;
}

/* 展开/收起内容区：用 max-height + opacity 实现平滑动画，避免 v-show 导致的突变 */
.danmaku-controls-content {
  transition: max-height 0.3s ease-out, opacity 0.25s ease-out;
}
.danmaku-controls-content.collapsed {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}
.danmaku-controls-content.expanded {
  max-height: 160px;
  opacity: 1;
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
  pointer-events: auto; /* 关键：弹窗层允许交互 */
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

/* 发送弹幕对话框 */
.send-dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.send-dialog {
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  animation: popup-enter 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.dialog-content {
  margin-bottom: 16px;
}

.send-textarea {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}

.send-textarea:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.send-textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dialog-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.send-btn {
  background: rgba(59, 130, 246, 0.8);
  color: #fff;
}

.send-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 1);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 留言板弹窗 */
.message-board-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 150;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.message-board {
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0;
  width: 90%;
  max-width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  animation: popup-enter 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.message-board-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.message-board-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.message-board-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.message-board-header .close-btn {
  margin-left: auto;
}

.message-board-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.message-board-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.message-board-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.message-board-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.message-board-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
}

.message-board-content {
  flex: 1;
  min-width: 0;
}

.message-board-user {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.message-board-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.4;
  word-break: break-word;
}

.message-board-empty {
  padding: 32px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}
</style>
