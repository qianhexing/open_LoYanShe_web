<script setup lang="ts">
import type { Comment, PaginationResponse } from '@/types/api';
import { getReplyList } from '@/api/comment'

interface Props {
  comment_id: number
  className?: string,
}
const props = withDefaults(defineProps<Props>(), {
})

const { comment_id} = props
const user = useUserStore()
const pageSize = 10
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
    const response = await getReplyList({
      page: page.value,
      pageSize: pageSize,
      comment_id
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

const { data, refresh } = await useAsyncData(`replyList${comment_id}`, fetchList,
  {
    watch: [page]
  }
)
const list = ref<Comment[]>([])
list.value = data.value?.rows.map((item) => { return {...item, isCheck: false} }) ?? []
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
    const response = await getReplyList({
      page: page.value,
      pageSize: pageSize,
      comment_id
    })
    isLoading.value = false
    list.value = response.rows
  } catch (error) { }
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
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize)) {
    isLoading.value = true
    handlePageChange(page.value + 1)
    console.log('加载更多')
  }
}

const emit = defineEmits(['load'])

const load = () => {
  emit('load')
}
const showReply = () => {

}
</script>
<template>
  <div :class="props.className ? props.className : 'w-full'">
    <div v-if="total > 0">
      <div v-for="item in list">
        <CommentItem :item="item"></CommentItem>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>
    <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore"></QhxLoading>
  </div>
</template>

<style scoped></style>