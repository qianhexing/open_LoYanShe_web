<script setup lang="ts">
  
  import { BASE_IMG } from '@/utils/ipConfig'
  import CommentItem from '@/components/Xl/CommentItem.vue'
  import SimpleCarousel from '@/components/Xl/SimpleCarousel.vue'
  import { getCommunityDetail } from '@/api/community'
  import { getCommentList } from '@/api/comment'
  import { formatRich, parseRichText, type RichNode } from '@/utils/public'
  import SafeRichText from '@/components/SafeRichText.vue'
  import dayjs from 'dayjs'
  
  // ---引入 Pinia 相关 ---
  import { useUserStore } from '@/stores/user' // 如果你的文件名是 user.ts，请改为 '@/stores/user'
  import { storeToRefs } from 'pinia'
  
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const id = route.params.id as string
  
  const loading = ref(true)
  
  // --- 获取当前登录用户状态 ---
  const authStore = useUserStore()
  const { user } = storeToRefs(authStore) // 解构出响应式的 user 对象

  // ---计算当前用户的头像 ---
  const myAvatar = computed(() => {
    // 如果没登录 或 用户对象为空 或 没有头像字段 -> 显示随机游客头像
    if (!user.value || !user.value.user_face) {
      return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'
    }
    // 有头像 -> 使用 joinUrl 处理 (自动拼接 BASE_IMG)
    return joinUrl(BASE_IMG, user.value.user_face)
  })
  
  // 定义接口
  interface NoteDetail {
    id: string | number
    title: string
    content: string
    richContent?: RichNode[]
    date: string
    location?: string
    images: string[]
    user: {
      nickname: string
      avatar: string
      isFollowing: boolean
    }
    stats: {
      likes: number
      collects: number
      comments: number
    }
    commentList: any[]
  }
  
  const detail = ref<NoteDetail | null>(null)
  
  useHead({
    title: computed(() => detail.value ? `${detail.value.title} - 帖子详情` : '加载中...'),
    meta: [{ name: 'referrer', content: 'no-referrer' }]
  })
  
  // 工具函数：安全拼接 URL
  const joinUrl = (base: string, path: string) => {
    if (!path) return ''
    if (path.startsWith('http') || path.startsWith('data:')) return path
    const cleanBase = base.replace(/\/+$/, '')
    const cleanPath = path.replace(/^\/+/, '')
    return `${cleanBase}/${cleanPath}`
  }
  
  const handleImageError = (e: Event) => {
    const target = e.target as HTMLImageElement
    target.src = 'https://placehold.co/600x800/e2e8f0/94a3b8?text=Image+Lost'
  }
  
  const fetchDetail = async () => {
    loading.value = true
    try {
      const communityData = await getCommunityDetail({ community_id: Number(id) })
      
      // --- 图片处理 ---
      let images: string[] = []
      if (communityData.img_list) {
        images = communityData.img_list
          .split(',')
          .filter(i => i && i.trim())
          .map(i => joinUrl(BASE_IMG, i.trim()))
      }
  
      // --- 内容处理 ---
      let content = ''
      let richContent: RichNode[] | undefined = undefined
      if (communityData.content) {
        const richResult = formatRich(communityData.content)
        content = richResult.text.replace(/<[^>]*>/g, '').trim()
        richContent = parseRichText(communityData.content)
        
        if (images.length === 0 && richResult.image.length > 0) {
          images = richResult.image.map(img => {
            let p = img.trim()
            if (!p.startsWith('http') && (p.includes('lolitalibrary.com') || p.includes('ali/'))) {
               const m = p.match(/ali\/(.+)/)
               p = m && m[1] ? m[1] : p.replace(/^.*?ali\//, '')
            }
            return joinUrl(BASE_IMG, p)
          })
        }
      }
  
      // --- 评论处理 ---
      let commentList: any[] = []
      try {
        const cRes = await getCommentList({ type: 'community', id: communityData.community_id, page: 1, pageSize: 20 })
        if (cRes.rows) {
          commentList = cRes.rows.map((c: any) => ({
            id: c.comment_id || c.id,
            username: c.user?.user_name || '匿名',
            avatar: c.user?.user_face ? joinUrl(BASE_IMG, c.user.user_face) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
            content: c.comment_content ? formatRich(c.comment_content).text.replace(/<[^>]*>/g, '').trim() : '',
            time: c.date ? dayjs(c.date).format('MM-DD') : '',
            location: c.ip_location,
            likes: c.good_num || 0
          }))
        }
      } catch (e) { console.error('评论加载失败', e) }
  
      // --- 组装数据 ---
      detail.value = {
        id: communityData.community_id,
        title: communityData.title || '',
        content: content || '无内容',
        richContent,
        date: communityData.date ? dayjs(communityData.date).format('MM-DD') : '',
        images,
        user: {
          nickname: communityData.user?.user_name || '匿名',
          avatar: communityData.user?.user_face ? joinUrl(BASE_IMG, communityData.user.user_face) : '',
          isFollowing: false
        },
        stats: {
          likes: communityData.good_num || 0,
          collects: communityData.collection_number || 0,
          comments: commentList.length
        },
        commentList
      }
  
    } catch (e) {
      console.error(e)
      toast.add({ title: '加载失败', color: 'red' })
    } finally {
      loading.value = false
    }
  }
  
  onMounted(() => {
    // 尝试初始化用户信息
    if (!user.value) {
      authStore.loadToken()
    }
    fetchDetail()
  })
  </script>
  
  <template>
    <div class="bg-white min-h-screen max-w-[480px] mx-auto shadow-2xl relative pb-24 border-x border-gray-50">
      <div v-if="loading" class="flex justify-center items-center h-[50vh]">
        <span class="text-gray-400">加载中...</span>
      </div>
  
      <div v-else-if="detail">
        <div class="sticky top-0 z-50 bg-white/95 backdrop-blur-md px-3 h-14 flex items-center justify-between border-b border-gray-100">
          <button @click="router.back()" class="p-2 -ml-2 hover:bg-gray-100 rounded-full transition">
            <span class="i-heroicons-chevron-left w-6 h-6 text-gray-600"></span>
          </button>
          <div class="flex items-center gap-2">
            <UAvatar :src="detail.user.avatar" size="xs" />
            <span class="text-sm font-medium text-gray-800">{{ detail.user.nickname }}</span>
          </div>
          <UButton size="2xs" color="rose" variant="outline" :ui="{ rounded: 'rounded-full' }">关注</UButton>
          <UButton icon="i-heroicons-share" color="gray" variant="ghost" class="-mr-2" />
        </div>
  
        <div class="w-full h-[55vh] bg-gray-100 relative">
          <SimpleCarousel :images="detail.images" />
        </div>
  
        <div class="p-4 pb-0">
          <h1 class="text-lg font-bold text-gray-900 mb-2">{{ detail.title }}</h1>
          <div v-if="detail.richContent">
            <SafeRichText :nodes="detail.richContent" />
          </div>
          <p v-else class="text-gray-800 whitespace-pre-wrap">{{ detail.content }}</p>
          
          <div class="mt-4 mb-6 flex items-center gap-3 text-xs text-gray-400">
            <span>{{ detail.date }}</span>
          </div>
  
          <div class="flex items-center gap-3 mb-2">
             <UAvatar 
               :src="myAvatar" 
               :alt="user?.user_name || '未登录'" 
               size="sm" 
               class="bg-gray-100 flex-shrink-0" 
             />
             
             <div class="flex-1 bg-gray-100 rounded-full h-10 flex items-center px-4 text-gray-400 text-sm cursor-text hover:bg-gray-200 transition">
                <span class="i-heroicons-pencil w-4 h-4 mr-2"></span>
                说点什么...
             </div>
          </div>
          </div>
  
        <UDivider class="my-4" />
  
        <div class="px-4 py-2 mb-10">
          <div class="mb-4 text-sm font-bold text-gray-700">共 {{ detail.commentList.length }} 条评论</div>
          <div class="space-y-6">
            <CommentItem v-for="c in detail.commentList" :key="c.id" :comment="c" />
          </div>
          
          <div class="text-center text-xs text-gray-300 py-8">
              - 没有更多了 -
          </div>
        </div>
        
      </div>
    </div>
  </template>