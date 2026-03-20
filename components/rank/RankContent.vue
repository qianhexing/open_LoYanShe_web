<template>
  <div>
    <!-- 提示信息 -->
    <div class="mb-6 text-center">
      <div 
        v-if="type === 'good'" 
        class="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm md:text-base"
      >
        七日内点赞排行榜
      </div>
      <div 
        v-else-if="type === 'contribute' || type === 'contribute7'" 
        class="inline-block px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm md:text-base"
      >
        Lo研社因你们的奉献而更美好
      </div>
      <div 
        v-else-if="type === 'exp'" 
        class="inline-block px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm md:text-base"
      >
        等级排行榜
      </div>
    </div>
    <!-- 排行榜列表 -->
    <RankLibraryRankingList 
      v-if="type === 'good' || type === 'collect'" 
      :list="list as RankItem[]" 
      :type="type"
    />
    <RankContributeRankingList 
      v-else-if="type === 'contribute' || type === 'contribute7'" 
      :list="list as RankItem[]" 
    />
    <RankUserRankingList 
      v-else-if="type === 'exp'" 
      :list="list as User[]" 
    />

    <!-- 加载更多 -->
    <QhxLoading 
      :loading="isLoading" 
      :page="page" 
      :total="total" 
      :page-size="pageSize" 
      @load-more="loadMore"
    />

    <!-- 空状态 -->
    <div v-if="!isLoading && total === 0" class="text-center text-gray-500 dark:text-gray-400 py-12">
      <div class="text-4xl mb-4">📊</div>
      <div class="text-lg">暂无数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RankItem } from '@/api/rank'
import type { User } from '@/types/api'
import { getRankList } from '@/api/rank'
import { BASE_IMG } from '@/utils/ipConfig'
import useScrollBottom from '@/composables/useScrollBottom'

interface Props {
  type: 'good' | 'collect' | 'contribute' | 'contribute7' | 'exp'
}

const props = defineProps<Props>()

const pageSize = 10
const page = ref(1)
const list = ref<(RankItem | User)[]>([])
const total = ref(0)
const isLoading = ref(false)

// 获取排行榜数据
const fetchRankList = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  try {
    const response = await getRankList({
      page: page.value,
      pageSize: pageSize,
      type: props.type
    })
    
    // 处理图片地址
    const processedData = response.rows.map((item) => {
      if (props.type === 'exp') {
        // 用户类型，只处理用户头像
        return {
          ...item,
          user_face: (item as User).user_face ? BASE_IMG + (item as User).user_face : null
        }
      } else {
        // 其他类型，处理所有图片字段
        return {
          ...item,
          cover: (item as RankItem).cover ? BASE_IMG + (item as RankItem).cover : null,
          square_cover: (item as RankItem).square_cover ? BASE_IMG + (item as RankItem).square_cover : null,
          shop_logo: (item as RankItem).shop_logo ? BASE_IMG + (item as RankItem).shop_logo : null,
          user_face: (item as RankItem).user_face ? BASE_IMG + (item as RankItem).user_face : null
        }
      }
    })
    
    if (page.value === 1) {
      list.value = processedData as (RankItem | User)[]
    } else {
      list.value = [...list.value, ...processedData as (RankItem | User)[]]
    }
    
    total.value = response.count
  } catch (error) {
    console.error('获取排行榜失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 加载更多
const loadMore = () => {
  if (isLoading.value) return
  
  const maxPage = Math.ceil(total.value / pageSize)
  if (page.value < maxPage) {
    page.value += 1
    fetchRankList()
  }
}

// 监听类型变化，重置数据
watch(() => props.type, () => {
  page.value = 1
  list.value = []
  total.value = 0
  fetchRankList()
}, { immediate: true })

// 滚动加载更多
useScrollBottom(
  async () => {
    if (page.value < Math.ceil(total.value / pageSize)) {
      loadMore()
    }
  },
  {
    distance: 300,
    immediate: false
  }
)
</script>

