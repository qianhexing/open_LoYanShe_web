<script setup lang="ts">
import type { Comment, PaginationResponse } from '@/types/api';
import { getCommentList } from '@/api/comment'

interface Props {
  type: string,
  id: number,
  className?: string,
}
const props = withDefaults(defineProps<Props>(), {
})

const { type, id } = props
const user = useUserStore()
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(1)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
// 使用`use$Post`请求函数
const fetchList = async (): Promise<PaginationResponse<Comment>> => {
  if (import.meta.server) {
    console.log('在服务端运行并且没有token', user.token)
    if (!user.token) {
      isServer.value = true
    }
  }
  try {
    const response = await getCommentList({
      page: page.value,
      pageSize: pageSize,
      type,
      id
    })
    isLoading.value = false
    return response
  } catch (error) {
    if (process.client) {
      console.error('获取失败:', error)
    }
    return {
      rows: [],
      count: 0
    }
  }
}

const { data, refresh  } = await useAsyncData('commentList', fetchList, 
  {
    watch: [page]
  }
)
const list = ref<Comment[]>([])
list.value = data.value?.rows ?? []
watch(data, () => {
  if (page.value === 1) {
    list.value = data.value?.rows ?? []
  } else {
    list.value = [...list.value, ...(data.value?.rows ?? [])]
  }
})
const total = computed(() => data.value?.count ?? 0)
const refreshList = async () => {
  isLoading.value = true
  try {
    const response = await getCommentList({
      page: 1,
      pageSize: pageSize * page.value,
      type,
      id
    })
    isLoading.value = false
    list.value = response.rows
  } catch (error) {}
  isLoading.value = false
}
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
}

const loadMore = () => {
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
  console.log('加载更多')
}
const { isFinished, setFinished } = useScrollBottom(
  async () => {
    // 加载更多数据的逻辑
    if (page.value < Math.ceil(total.value / pageSize)) {
      console.log('触发加载更多')
      loadMore()
    }
  },
  {
    distance: 300, // 距离底部100px时触发
    immediate: false // 初始化时立即加载一次
  }
)


const emit = defineEmits(['load'])

const load = () => {
  emit('load')
}
</script>
<template>
  <div :class="props.className ? props.className :'w-full'">
    <div v-for="item in list">
      {{ item }}
    </div>
  </div>
</template>

<style scoped>
</style>