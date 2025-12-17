<script setup lang="ts">
import { getAlbumList } from '@/api/album';
import type { PaginationResponse, Album } from '@/types/api';
import { BASE_IMG } from '@/utils/ipConfig';
import useScrollBottom from '@/composables/useScrollBottom';

const router = useRouter();
const route = useRoute();
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())

// 分页参数
const pageSize = 10;
const page = ref(Number(route.query.page) || 1);
const keywords = ref('');
const value = ref('');
const current = ref(0); // 当前选中的标签页

// 列表数据
const list = ref<Album[]>([]);
const total = ref(0);
const isLoading = ref(false);

// 获取相册列表
const fetchList = async (page: number, pageSize: number): Promise<PaginationResponse<Album>> => {
  try {
    isLoading.value = true;
		const params = {
			page: page,
      pageSize: pageSize,
      parent_id: 0,
		}
    const response = await getAlbumList(params);
		if (params.page === 1) {
			list.value = response.rows;
			total.value = response.count;
		} else {
			list.value = [...list.value, ...response.rows];
			total.value = response.count;
		}
  } catch (error) {
    console.error('获取相册列表失败:', error);
  } finally {
    isLoading.value = false;
  }
	return {
		rows: list.value,
		count: total.value,
	}
};

// const { data, refresh } = await useAsyncData('albums', fetchList, {
//   watch: [page, keywords]
// });

// watch(data, () => {
//   if (page.value === 1) {
//     list.value = data.value?.rows ?? [];
//   } else {
//     list.value = [...list.value, ...(data.value?.rows ?? [])];
//   }
//   total.value = data.value?.count ?? 0;
// }, { immediate: true });

// 页码改变处理函数
const handlePageChange = (currentPage: number) => {
  page.value = currentPage;
};

// 加载更多
const loadMore = () => {
  if (isLoading.value) {
    return;
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize)) {
    isLoading.value = true;
    handlePageChange(page.value + 1);
  }
};

// 使用滚动到底部自动加载更多
const { isFinished } = useScrollBottom(
  async () => {
    // 加载更多数据的逻辑
    if (page.value < Math.ceil(total.value / pageSize)) {
      loadMore();
    }
  },
  {
    distance: 300, // 距离底部300px时触发
    immediate: false // 初始化时立即加载一次
  }
);

// 标签页切换
const tabsChange = (index: number) => {
  current.value = index;
  // 切换标签页时可以重新加载数据
  if (index === 0) {
    page.value = 1;
    fetchList(page.value, pageSize);
  }
};

// 搜索
const handleSearch = () => {
  keywords.value = value.value.trim();
  if (keywords.value) {
    page.value = 1;
		fetchList(page.value, pageSize);
  }
};

// 返回上一页
const goBack = () => {
  router.back();
};

// SEO 配置
useHead({
  title: '成就相册',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,成就相册,Lolita相册'
    },
    {
      name: 'description',
      content: 'Lolita成就相册'
    }
  ]
});
onMounted(async () => {
	uni = await import('@dcloudio/uni-webview-js').catch((err) => {
		console.error('Failed to load uni-webview-js:', err);
	});
	setTimeout(async () => {
		await fetchList(page.value, pageSize);
	});
});
const handleJump = (item: Album) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({
			url: `/pages/album/detail/${item.album_id}`,
		});
	}
	else if (port.value) {
		port.value.postMessage(JSON.stringify({
			type: 'jump',
			path: 'Outlink',
			params: {
				url: `https://lolitalibrary.com/album/detail/${item.album_id}`
			}
		}));
	} else {
		navigateTo(`/album/detail/${item.album_id}`);
	}
};
</script>

<template>
  <div class="album-page bg-qhx-bg">
    <!-- 顶部导航栏 -->
    <div class="qhx-tab sticky top-0 z-10 shadow-sm">
      <!-- <div class="qhx-back cursor-pointer p-2" @click="goBack()">
        <UIcon name="i-heroicons-arrow-left" class="text-xl" />
      </div> -->
      <div class="flex-1">
        <div class="flex">
          <button
            v-for="(tab, i) in ['成就相册']"
            :key="i"
            @click="tabsChange(i)"
            class="py-2 px-4 text-center transition whitespace-nowrap flex-1"
            :class="{
              'text-qhx-primary border-b-2 border-qhx-primary font-semibold': current === i,
              'text-gray-500': current !== i
            }"
          >
            {{ tab }}
          </button>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="album-content">
      <!-- 第一个标签页：成就相册 -->
      <div v-if="current === 0" class="album-list">
        <div v-if="list.length > 0" class="album-items">
          <div
            v-for="item in list"
            :key="item.album_id"
            :to="`/album/detail/${item.album_id}`"
            class="comp-list"
						@click="handleJump(item)"
          >
            <div class="comp-cover">
              <img 
                :src="`${BASE_IMG}${item.album_cover || 'static/plan_cover/default.jpg'}`" 
                :alt="item.album_title"
                class="w-full"
                loading="lazy"
              />
            </div>
            <div class="comp-det">
              <div class="comp-head">
                <div class="comp-name">{{ item.album_title }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="!isLoading" class="text-center text-gray-500 py-8">
          暂无数据
        </div>
        
        <!-- 加载更多组件 -->
        <QhxLoading 
          :loading="isLoading" 
          :page="page" 
          :total="total" 
          :page-size="pageSize" 
          @load-more="loadMore"
        />
      </div>

      <!-- 第二个标签页（预留） -->
      <div v-if="current === 1" class="album-list">
        <div class="text-center text-gray-500 py-8">
          暂无内容
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album-page {
  /* min-height: 100vh; */
}

.qhx-tab {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.qhx-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-left: 8px;
}

.album-content {
  padding: 15px;
}

.album-list {
  min-height: calc(100vh - 60px);
}

.comp-list {
  position: relative;
  height: calc(100vw * 1080 / 1920);
  max-height: 400px;
  margin-bottom: 15px;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 1px 1px 10px #DCDFE6;
  display: block;
  text-decoration: none;
}

.comp-cover {
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
}

.comp-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comp-det {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comp-head {
  height: 30px;
  font-size: 16px;
  font-weight: bolder;
  line-height: 30px;
  color: #000000;
  margin: 0 2vw;
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.comp-name {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  flex: 1;
  text-align: center;
}

@media (min-width: 768px) {
  .comp-list {
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
}
</style>
