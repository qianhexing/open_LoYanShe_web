<script setup lang="ts">
import { useSceneCore } from '@/composables/useSceneCore';
import type { DiaryInterface, LibraryInterface } from '@/types/sence';

const route = useRoute();
const id = route.params.id as string;
const configStore = useConfigStore();
const port = computed(() => configStore.getPort());
const showDiary = ref(false);
const activeDiary = ref<DiaryInterface | null>(null);
const clickPosition = ref({ x: 0, y: 0 });

const {
  threeCore,
  sceneLoading,
  sceneLoadProgress,
  sceneLoadError,
  diaryList,
  libraryList,
  initScene,
  disposeScene
} = useSceneCore();

let uni: any;

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  
  const sceneElement = document.getElementById('scene-ar');
  if (sceneElement) {
    await initScene(sceneElement, id, {
      editMode: false,
      baseUrl: BASE_IMG,
      enableAR: true
    });
  }
});

onUnmounted(() => {
  const sceneElement = document.getElementById('scene-ar');
  disposeScene(sceneElement || undefined);
});

// 日记点击处理
const handleClickDiary = (e: MouseEvent, item: DiaryInterface) => {
  showDiary.value = true;
  clickPosition.value = {
    x: e.clientX,
    y: e.clientY
  };
  activeDiary.value = item;
};

// 图书馆点击处理
const handleClickLibrary = (item: LibraryInterface) => {
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  if (!item.library_id) return;
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/library/libraryDetail/libraryDetail?id=${item.library_id}`,
      fail: () => {
        console.log('跳转错误');
      }
    });
  } else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'LibraryDetail',
        params: {
          id: item.library_id
        }
      }));
    } else {
      window.open(`/library/detail/${item.library_id}`, '_blank');
    }
  }
};

useHead({
  title: 'AR场景展示',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no' }
  ]
});
</script>

<template>
  <div class="relative w-full h-screen overflow-hidden select-none touch-callout-none bg-transparent">
    <!-- 场景加载状态 -->
    <div 
      v-if="sceneLoading || sceneLoadError" 
      class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-50"
    >
      <template v-if="sceneLoading && !sceneLoadError">
        <div class="w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin"></div>
        <p class="mt-4 text-purple-600 tracking-widest font-bold">
          <span v-if="sceneLoadProgress.total > 0">
            正在加载场景... {{ sceneLoadProgress.current }} / {{ sceneLoadProgress.total }}
          </span>
          <span v-else>
            正在初始化...
          </span>
        </p>
      </template>
      
      <template v-else-if="sceneLoadError">
        <div class="flex flex-col items-center gap-4">
          <div class="w-16 h-16 flex items-center justify-center">
            <UIcon name="material-symbols:error-outline" class="text-6xl text-red-500" />
          </div>
          <p class="text-red-600 font-bold text-lg">加载失败</p>
          <p class="text-gray-600 text-sm max-w-md text-center px-4">{{ sceneLoadError }}</p>
          <UButton 
            color="purple" 
            @click="() => {
              const el = document.getElementById('scene-ar');
              if(el) initScene(el, id, { editMode: false, baseUrl: BASE_IMG });
            }"
            class="mt-2"
          >
            重试
          </UButton>
        </div>
      </template>
    </div>

    <!-- AR 场景容器 -->
    <!-- 注意：背景透明，以便允许下层视频流（如果是在原生APP中覆盖WebView）或者 webRTC 视频流 -->
    <div id="scene-ar" class="w-full h-full"></div>

    <!-- 日记点列表 -->
    <div 
      v-for="diary in diaryList" 
      :key="diary.id"
      @click.stop="(e) => handleClickDiary(e, diary)" 
      class="fixed p-3 cursor-pointer bg-white/80 backdrop-blur-sm rounded-[30px] shadow-lg z-10 h-[60px] flex items-center whitespace-nowrap overflow-hidden" 
      :style="{ left: diary.position?.x + 'px', top: diary.position?.y - 30 + 'px' }"
    >
      {{ diary.title }}
    </div>

    <!-- 图书馆列表 -->
    <div 
      v-for="library in libraryList" 
      :key="library.id"
      @click.stop="handleClickLibrary(library)" 
      class="fixed cursor-pointer bg-white/80 backdrop-blur-sm rounded-[30px] shadow-lg z-10 h-[60px] flex items-center whitespace-nowrap overflow-hidden" 
      :style="{ left: library.position?.x + 'px', top: library.position?.y - 30 + 'px' }"
    >
      <div class="flex items-center">
        <div>
          <img 
            :src="`${BASE_IMG}${library.cover}`"
            class="w-16 h-16 object-cover rounded-[60px] border border-gray-200 my-2 cursor-pointer" 
            loading="lazy" 
          />
        </div>
        <div class="p-2">{{ library.title }}</div>
      </div>
    </div>

    <!-- 日记详情弹窗 -->
    <QhxModal v-model="showDiary" :trigger-position="clickPosition">
      <div class="p-6 w-[300px] md:w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
        <div class="font-bold mb-2">{{ activeDiary?.title }}</div>
        <div class="text-sm text-gray-600">{{ activeDiary?.content }}</div>
      </div>
    </QhxModal>
  </div>
</template>

<style scoped>
/* 确保背景透明 */
:deep(canvas) {
  outline: none;
}
</style>
