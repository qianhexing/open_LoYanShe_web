 <script setup lang="ts">
  import type { Study } from '@/types/api';
  import { getStudyId, getStudyForeignList } from '@/api/study'
  import { BASE_IMG } from '@/utils/ipConfig'
  
  const route = useRoute()
  const router = useRouter()
  const id = route.params.id as string
  
  // 在这里定义状态
  const detail = ref<Study | null>(null)
  const activeTab = ref(0) 
  const currentListId = ref<number>(0) // 当前 ID，用于触发组件刷新
  
  // 在这里定义 SEO
  useHead({
    title: computed(() => detail.value ? `${detail.value.study_title} - Lo研社` : 'Lolita研习'),
  })
  
  // 在这里初始化：只负责获取 Tabs 信息
  const initData = async () => {
    try {
      const res = await getStudyId({ study_id: Number(id) })
      const data = (res as any).data || res 
      detail.value = data
      
      // 这里的逻辑是：如果有子分类，默认选第一个；否则选自己
      if (detail.value?.child && detail.value.child.length > 0) {
        activeTab.value = 0
        currentListId.value = detail.value.child[0].study_id
      } else {
        currentListId.value = Number(id)
      }
    } catch (e) {
      console.error('获取专题详情失败', e)
    }
  }
  
  // 在这里定义给组件调用的瀑布流函数
  const waterfallFetch = async (page: number, pageSize: number) => {
    try {
      const res = await getStudyForeignList({
        page: page,
        pageSize: pageSize,
        study_id: currentListId.value
      })
      
      const resData = (res as any).data || res
      const rawRows = resData.rows || []
  
      // 在这里进行数据清洗逻辑
      const processedRows = rawRows.map((item: any) => {
        let cover = item.foreign?.cover
        let title = item.foreign?.title
        let avatar = ''
        let username = ''
  
        if (item.pk_type === 0 && item.community) {
          if (item.community.img_list) {
             const imgs = item.community.img_list.split(',')
             if (imgs.length > 0) cover = imgs[0]
          }
          if (!title && item.community.content) {
             title = stripHtml(item.community.content)
          }
          avatar = item.community.user_avatar
          username = item.community.user_name
        } else if (item.pk_type === 1 && item.library) {
           cover = item.library.cover
           title = item.library.name
        }
  
        if (cover && !cover.startsWith('http')) cover = BASE_IMG + cover
        if (avatar && !avatar.startsWith('http')) avatar = BASE_IMG + avatar
  
        return {
          ...item,
          id: item.pk_id, 
          title: title || '无标题',
          cover: cover || '/placeholder.png',
          user: { avatar, nickname: username },
          type_name: getTypeName(item.pk_type)
        }
      })
  
      // 返回组件要求的格式
      return {
        rows: processedRows,
        count: resData.count || 0
      }
    } catch (e) {
      console.error('加载失败', e)
      return { rows: [], count: 0 }
    }
  }
  
  // 在这里定义交互逻辑
  const handleTabChange = (index: number) => {
    activeTab.value = index
    if (detail.value?.child?.[index]) {
      // 改变 ID，template 里的 :key 会监听到变化，自动重置组件。
      currentListId.value = detail.value.child[index].study_id
    }
  }
  
  const stripHtml = (html: string) => {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, '').substring(0, 40).trim()
  }
  
  const getTypeName = (type: number) => {
    const map: Record<number, string> = { 0: '帖子', 1: '图鉴', 2: '店铺', 3: '合集', 4: '研习', 6: '链接' }
    return map[type] || ''
  }
  
  onMounted(() => {
    initData()
  })
  </script>
  
  <template>
    <div class="container mx-auto p-4 min-h-screen">
      
      <div class="mb-6 bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button @click="router.back()" class="p-2 hover:bg-gray-100 rounded-full transition">
            <span class="i-heroicons-arrow-left text-gray-600"></span>
          </button>
          <h1 class="text-xl font-bold text-gray-800">{{ detail?.study_title || '研习专题' }}</h1>
        </div>
      </div>
  
      <div v-if="detail?.child && detail.child.length > 0" class="mb-4">
        <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button 
            v-for="(item, index) in detail.child" 
            :key="item.study_id"
            @click="handleTabChange(index)"
            class="px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border"
            :class="activeTab === index 
              ? 'bg-pink-500 text-white border-pink-500 shadow-md' 
              : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'"
          >
            {{ item.study_title }}
          </button>
        </div>
      </div>
  
      <ClientOnly>
        <div class="min-h-[300px]">
          <QhxWaterList 
            v-if="currentListId"
            :key="currentListId" 
            :fetch-data="waterfallFetch"
          />
        </div>
      </ClientOnly>
  
    </div>
  </template>
  
  <style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    height: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #eee;
    border-radius: 4px;
  }
  </style>