<script setup lang="ts">
import { BASE_IMG } from '@/utils/ipConfig'
import { parseRichText } from '@/utils/public'
import type { RichNode } from '@/utils/public'
import type { Wiki, WikiForeign, Library, FilterList } from '@/types/api'
import type { WikiDetail, WikiSection } from '@/api/wiki'
import { 
  getWikiDetail, 
  getWikiSectionListById, 
  mergeWiki, 
  changeWikiSectionSort, 
  deleteWiki, 
  insertWikiForeignIds,
  type WikiDetailParams,
  type MergeWikiParams,
  type ChangeWikiSectionSortParams,
  type DeleteWikiParams,
  type InsertWikiForeignIdsParams
} from '@/api/wiki'
import { getLibraryList } from '@/api/library'
import type { PaginationResponse } from '@/types/api'
let uni: any;
// 禁用 SSR
definePageMeta({
  ssr: false
})

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const toast = useToast()
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const id = route.params.id as string
const wiki_name = route.query.wiki_name as string | undefined
const type_id = route.query.type_id ? Number.parseInt(route.query.type_id as string) : undefined

// 权限检查函数
const hasPermi = (permission: string): boolean => {
  if (!user.permission || user.permission.length === 0) return false
  return user.permission.some(p => p.permissions === permission)
}

// 数据
const wiki = ref<WikiDetail | null>(null)
const sectionList = ref<WikiSection[]>([])
const libraryList = ref<Library[]>([])
const libraryTotal = ref(0)
const libraryPage = ref(1)
const libraryPageSize = ref(10)
const loadingLibrary = ref(false)
const filterLibrary = ref<FilterList[]>([])

// 模态框状态
const showMerge = ref(false)
const showDeleteWiki = ref(false)
const showRelatedWiki = ref(false)
const showChildWiki = ref(false)
const chooseList = ref<WikiDetail[]>([])

// 组件引用
const chooseWikiRef = ref<{ showModel: (params: { type_id?: number | number[] }) => void } | null>(null)
const chooseWikiRelatedRef = ref<{ showModel: (params: { type_id?: number | null }) => void } | null>(null)
const chooseWikiChildRef = ref<{ showModel: (params: { type_id?: number | null }) => void } | null>(null)
const manageSubAndSupRef = ref<{ showModel: (params: { parent_list: WikiForeign[]; child_list: WikiForeign[] }) => void } | null>(null)

// 获取wiki详情
const fetchWikiDetail = async () => {
  try {
    const params: WikiDetailParams = {}
    if (id) {
      params.wiki_id = Number.parseInt(id)
    }
    if (wiki_name) {
      params.wiki_name = wiki_name
    }
    if (type_id) {
      params.type_id = type_id
    }
    
    const data = await getWikiDetail(params)
    wiki.value = data
    
    // 处理图鉴筛选相关
    let filter_list: FilterList[] = []
    const typeId = typeof data.type_id === 'string' ? Number.parseInt(data.type_id) : data.type_id
    if (typeId === 1) {
      filter_list.push({ field: 'library_pattern', op: 'and', value: data.wiki_name || '' })
    } else if (typeId === 2) {
      filter_list.push({ field: 'design_elements', op: 'and', value: data.wiki_name || '' })
    } else if (typeId === 3) {
      filter_list.push({ field: 'pattern_elements', op: 'and', value: data.wiki_name || '' })
    } else if (typeId === 4) {
      const wikiIdValue = typeof data.wiki_id === 'number' ? data.wiki_id : Number.parseInt(String(data.wiki_id))
      if (!Number.isNaN(wikiIdValue)) {
        filter_list.push({ field: 'main_style', op: 'and', value: wikiIdValue })
      }
    } else if (typeId === 5) {
      filter_list.push({ field: 'cloth_elements', op: 'or', value: data.wiki_name || '' })
      filter_list.push({ field: 'secondary_cloth', op: 'or', value: data.wiki_name || '' })
    } else if (typeId === 13) {
      filter_list.push({ field: 'color', op: 'and', value: data.wiki_name || '' })
    } else if (typeId === 14) {
      filter_list.push({ field: 'theme', op: 'and', value: data.wiki_name || '' })
    }
    
    if (data.filter_library) {
      filter_list = [...filter_list, ...data.filter_library]
    }
    if (filter_list.length > 0) {
      filterLibrary.value = filter_list
      fetchLibraryList(1, libraryPageSize.value)
    }
    
    // 获取段落列表
    await fetchWikiSectionList()
  } catch (error) {
    console.error('获取wiki详情失败:', error)
    toast.add({
      title: '获取详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 获取wiki段落列表
const fetchWikiSectionList = async () => {
  if (!wiki.value?.wiki_id) return
  try {
    const wikiIdValue = wiki.value.wiki_id
    const wikiId: number = typeof wikiIdValue === 'number' ? wikiIdValue : Number.parseInt(String(wikiIdValue))
    if (Number.isNaN(wikiId)) return
    const data = await getWikiSectionListById({ wiki_id: wikiId as number })
    sectionList.value = data
  } catch (error) {
    console.error('获取段落列表失败:', error)
  }
}

// 获取图鉴列表
const fetchLibraryList = async (page: number, pageSize: number) => {
  if (loadingLibrary.value) return
  loadingLibrary.value = true
  try {
    const params = {
      page,
      pageSize,
      filter_list: filterLibrary.value
    }
    const response = await getLibraryList(params)
    if (page === 1) {
      libraryList.value = response.rows
    } else {
      libraryList.value.push(...response.rows)
    }
    libraryTotal.value = response.count
    libraryPage.value = page
  } catch (error) {
    console.error('获取图鉴列表失败:', error)
  } finally {
    loadingLibrary.value = false
  }
}

// 加载更多图鉴
const loadMoreLibrary = () => {
  const maxLength = Math.ceil(libraryTotal.value / libraryPageSize.value)
  if (libraryPage.value < maxLength) {
    fetchLibraryList(libraryPage.value + 1, libraryPageSize.value)
  }
}

// 跳转到图鉴详情
const jumpToLibrary = (libraryId: number) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({
			url: `/pages/library/detail/${libraryId}`,
		});
	}
	else if (port.value) {
		port.value.postMessage(JSON.stringify({
			type: 'jump',
			path: 'LibraryDetail',
			params: {
				id: libraryId
			}
		}));
	}	
	else {
		window.open(`/library/detail/${libraryId}`, '_blank')
	}
}

// 跳转到wiki详情
const jumpToWiki = (wikiId: number) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({
			url: `/pages/lolitaWiki/detail/${wikiId}`,
		});
	}
	else if (port.value) {
		port.value.postMessage(JSON.stringify({
			type: 'jump',
			path: 'Outlink',
			params: {
				url: `https://lolitalibrary.com/lolitaWiki/detail/${wikiId}`
			}
		}));
	}
	else {
		navigateTo(`/lolitaWiki/detail/${wikiId}`)
		// window.open(`/lolitaWiki/detail/${wikiId}`, '_blank')
	}
}

// 显示选择上级wiki
const showParent = () => {
  if (chooseWikiRelatedRef.value) {
    chooseWikiRelatedRef.value.showModel({ type_id: null })
  }
}

// 显示选择下级wiki
const showChild = () => {
  if (chooseWikiChildRef.value) {
    chooseWikiChildRef.value.showModel({ type_id: null })
  }
}

// 显示管理关联
const showManage = () => {
  if (manageSubAndSupRef.value && wiki.value) {
    manageSubAndSupRef.value.showModel({
      parent_list: wiki.value.parent_list || [],
      child_list: wiki.value.child_list || []
    })
  }
}

// 显示选择合并wiki
const showChooseWiki = () => {
  if (!wiki.value) return
  const typeId = typeof wiki.value.type_id === 'string' ? Number.parseInt(wiki.value.type_id) : (wiki.value.type_id || 0)
  const params: { type_id: number | number[] } = {
    type_id: typeId
  }
  if (typeId === 1) {
    params.type_id = [1, 2]
  } else if (typeId === 2) {
    params.type_id = [2, 1]
  } else if (typeId === 14) {
    params.type_id = [14, 2]
  }
  if (chooseWikiRef.value) {
    chooseWikiRef.value.showModel(params)
  }
}

// 新增段落
const insertWikiSection = () => {
  router.push(`/lolitaWiki/insertWikiSection?id=${id}`)
}

// 确认合并wiki
const confirmMerge = async () => {
  if (!wiki.value || chooseList.value.length === 0) return
  try {
    const params: MergeWikiParams = {
      wiki_id: typeof wiki.value.wiki_id === 'number' ? wiki.value.wiki_id : Number.parseInt(String(wiki.value.wiki_id)),
      merge_id: chooseList.value.map((w: WikiDetail) => w.wiki_id || '').filter(Boolean).join(',')
    }
    await mergeWiki(params)
    toast.add({
      title: '合并成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    showMerge.value = false
  } catch (error) {
    console.error('合并失败:', error)
  }
}

// 确认关联上级
const confirmRelatedWiki = async () => {
  if (!wiki.value || chooseList.value.length === 0) return
  try {
    const params: InsertWikiForeignIdsParams = {
      ids: chooseList.value.map((w: WikiDetail) => w.wiki_id || '').filter(Boolean).join(','),
      pk_type: 0,
      pk_id: typeof wiki.value.wiki_id === 'number' ? wiki.value.wiki_id : Number.parseInt(String(wiki.value.wiki_id))
    }
    await insertWikiForeignIds(params)
    toast.add({
      title: '关联成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    showRelatedWiki.value = false
    await fetchWikiDetail()
  } catch (error) {
    console.error('关联失败:', error)
  }
}

// 确认关联下级
const confirmChildWiki = async () => {
  if (!wiki.value || chooseList.value.length === 0) return
  try {
    const params: InsertWikiForeignIdsParams = {
      ids: chooseList.value.map((w: WikiDetail) => w.wiki_id || '').filter(Boolean).join(','),
      pk_type: 0,
      wiki_id: typeof wiki.value.wiki_id === 'number' ? wiki.value.wiki_id : Number.parseInt(String(wiki.value.wiki_id))
    }
    await insertWikiForeignIds(params)
    toast.add({
      title: '关联成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    showChildWiki.value = false
    await fetchWikiDetail()
  } catch (error) {
    console.error('关联失败:', error)
  }
}

// 确认删除wiki
const confirmDeleteWiki = async () => {
  if (!wiki.value) return
  try {
    const params: DeleteWikiParams = {
      wiki_id: Number.parseInt(wiki.value.wiki_id as string)
    }
    await deleteWiki(params)
    router.back()
  } catch (error) {
    console.error('删除失败:', error)
  } finally {
    showDeleteWiki.value = false
  }
}

// 选择wiki回调
const chooseWiki = (list: { wiki_id?: number; wiki_name?: string }[]) => {
  chooseList.value = list as unknown as WikiDetail[]
  showMerge.value = true
}

// 选择关联wiki回调
const chooseWikiRelated = (list: { wiki_id?: number; wiki_name?: string }[]) => {
  chooseList.value = list as unknown as WikiDetail[]
  showRelatedWiki.value = true
}

// 选择子wiki回调
const chooseWikiChild = (list: { wiki_id?: number; wiki_name?: string }[]) => {
  chooseList.value = list as unknown as WikiDetail[]
  showChildWiki.value = true
}

// 修改段落排序
const changeSort = async (index: number, type: number) => {
  if (!wiki.value) return
  
  const params: ChangeWikiSectionSortParams = {
    wiki_id: typeof wiki.value.wiki_id === 'number' ? wiki.value.wiki_id : Number.parseInt(String(wiki.value.wiki_id)),
    sort: []
  }
  
  if (type === -1 && index > 0) {
    params.sort = sectionList.value.map((item: WikiSection, itemIndex: number) => {
      let sort = itemIndex
      if (index === itemIndex) {
        sort -= 1
      }
      if (index - 1 === itemIndex) {
        sort += 1
      }
      return {
        section_id: item.section_id,
        sort
      }
    })
  }
  
  if (type === 1 && index < sectionList.value.length - 1) {
    params.sort = sectionList.value.map((item: WikiSection, itemIndex: number) => {
      let sort = itemIndex
      if (index === itemIndex) {
        sort += 1
      }
      if (index + 1 === itemIndex) {
        sort -= 1
      }
      return {
        section_id: item.section_id,
        sort
      }
    })
  }
  
  if (params.sort.length === 0) return
  
  try {
    await changeWikiSectionSort(params)
    await fetchWikiSectionList()
  } catch (error) {
    console.error('修改排序失败:', error)
  }
}

// 解析富文本
const parseWikiContent = (content: string): RichNode[] => {
  if (!content) return []
  try {
    return parseRichText(content.replace(/\n/g, '<br>'))
  } catch (error) {
    console.error('解析富文本失败:', error)
    return []
  }
}

// 检查是否有显示的上级
const hasVisibleParents = computed(() => {
  return wiki.value?.parent_list?.some((child: WikiForeign) => child.is_show === 0) || false
})

// 检查是否有显示的下级
const hasVisibleChildren = computed(() => {
  return wiki.value?.child_list?.some((child: WikiForeign) => child.is_show === 0) || false
})

// 获取图片URL
const getImageUrl = (path: string): string => {
  if (!path) return ''
  return BASE_IMG + path
}

onMounted(async () => {
  await fetchWikiDetail()
})

useHead({
  title: wiki.value?.wiki_name || 'Wiki详情',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,Lolita百科,Wiki详情'
    },
    {
      name: 'description',
      content: wiki.value?.wiki_name || 'Lolita百科详情'
    }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
    <div class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <!-- Wiki名称 -->
      <div v-if="wiki" class="mb-4">
        <h1 class="text-center text-xl font-bold md:text-2xl mb-2">
          {{ wiki.wiki_name }}
        </h1>
        <div v-if="wiki.other_name" class="flex justify-center text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ wiki.other_name }}
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex flex-wrap gap-2 justify-center mb-6">
          <UButton
            v-if="hasPermi('wiki:admin:merge')"
            size="sm"
            color="primary"
            variant="outline"
            @click="showParent"
          >
            关联上级
          </UButton>
          <UButton
            v-if="hasPermi('wiki:admin:merge')"
            size="sm"
            color="primary"
            variant="outline"
            @click="showChild"
          >
            关联下级
          </UButton>
          <UButton
            v-if="hasPermi('wiki:admin:merge')"
            size="sm"
            color="primary"
            variant="outline"
            @click="showManage"
          >
            管理关联
          </UButton>
          <UButton
            v-if="hasPermi('wiki:admin:merge')"
            size="sm"
            color="primary"
            variant="outline"
            @click="showChooseWiki"
          >
            合并wiki
          </UButton>
          <UButton
            v-if="hasPermi('wiki:admin:merge')"
            size="sm"
            color="primary"
            variant="outline"
            @click="insertWikiSection"
          >
            新增段落
          </UButton>
          <UButton
            size="sm"
            color="red"
            variant="outline"
            @click="showDeleteWiki = true"
          >
            删除wiki
          </UButton>
        </div>
        
        <!-- 上级列表 -->
        <div v-if="hasVisibleParents" class="mb-6">
          <h2 class="text-lg font-semibold mb-3">上级</h2>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="item in wiki.parent_list"
              :key="item.foreign_id"
              v-show="item.is_show === 0"
              @click="jumpToWiki(item.wiki_id)"
              class="cursor-pointer px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              {{ item.wiki?.wiki_name }}
            </div>
          </div>
        </div>
        
        <!-- 下级列表 -->
        <div v-if="hasVisibleChildren" class="mb-6">
          <h2 class="text-lg font-semibold mb-3">下级</h2>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="item in wiki.child_list"
              :key="item.foreign_id"
              v-show="item.is_show === 0"
              @click="jumpToWiki(item.pk_id)"
              class="cursor-pointer px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
            >
              {{ item.wiki?.wiki_name }}
            </div>
          </div>
        </div>
        
        <!-- 词条描述 -->
        <div v-if="wiki.wiki_describe && wiki.wiki_describe !== ''" class="mb-6">
          <h2 class="text-lg font-semibold mb-3">词条描述</h2>
          <div class="prose dark:prose-invert max-w-none">
            <SafeRichText :nodes="parseWikiContent(wiki.wiki_describe)" />
          </div>
          <div v-if="wiki.wiki_illustration" class="mt-4">
            <img
              :src="getImageUrl(wiki.wiki_illustration)"
              :alt="wiki.wiki_name"
              class="w-full rounded-lg shadow-md"
            />
          </div>
        </div>
        
        <!-- 图鉴列表 -->
        <div v-if="libraryList.length > 0" class="mb-6">
          <div class="overflow-x-auto">
            <div class="flex gap-4 pb-4" :style="{ width: `${(libraryList.length + 1) * 120}px` }">
              <div
                v-for="item in libraryList"
                :key="item.library_id"
                @click="jumpToLibrary(item.library_id)"
                class="flex-shrink-0 w-[100px] cursor-pointer"
              >
                <div class="w-full h-[100px] rounded-lg overflow-hidden mb-2 shadow-md hover:shadow-lg transition-shadow">
                  <img
                    :src="getImageUrl(item.cover)"
                    :alt="item.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="text-xs text-center line-clamp-1 text-gray-700 dark:text-gray-300">
                  {{ item.name }}
                </div>
              </div>
              <!-- 加载更多 -->
              <div
                v-if="libraryPage * libraryPageSize < libraryTotal"
                class="flex-shrink-0 w-[100px] flex items-center justify-center"
                @click="loadMoreLibrary"
              >
                <UButton
                  :loading="loadingLibrary"
                  variant="ghost"
                  color="gray"
                  size="sm"
                >
                  加载更多
                </UButton>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 段落列表 -->
        <div class="space-y-6">
          <div
            v-for="(item, index) in sectionList"
            :key="item.section_id"
            class="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold flex-1">{{ item.section_title }}</h3>
              <div v-if="hasPermi('wiki:admin:merge')" class="flex gap-2">
                <UButton
                  :disabled="index === 0"
                  :style="{ opacity: index === 0 ? 0 : 1, pointerEvents: index === 0 ? 'none' : '' }"
                  size="xs"
                  color="primary"
                  icon="i-heroicons-arrow-up"
                  @click="changeSort(index, -1)"
                />
                <UButton
                  :disabled="index === sectionList.length - 1"
                  :style="{ opacity: index === sectionList.length - 1 ? 0 : 1, pointerEvents: index === sectionList.length - 1 ? 'none' : '' }"
                  size="xs"
                  color="primary"
                  icon="i-heroicons-arrow-down"
                  @click="changeSort(index, 1)"
                />
              </div>
            </div>
            <div class="prose dark:prose-invert max-w-none">
              <SafeRichText :nodes="parseWikiContent(item.section_content)" />
            </div>
          </div>
        </div>
      </div>
      
      <!-- 加载中 -->
      <div v-else class="flex items-center justify-center py-12">
        <div class="text-gray-500">加载中...</div>
      </div>
    </div>
    
    <!-- 合并wiki确认对话框 -->
    <UModal v-model="showMerge" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">是否确认合并wiki</h3>
        </template>
        <p class="text-gray-600 dark:text-gray-400 mb-4">注意合并会修改所有相关图鉴？</p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showMerge = false">取消</UButton>
            <UButton color="primary" @click="confirmMerge">确认</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
    
    <!-- 删除wiki确认对话框 -->
    <UModal v-model="showDeleteWiki" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">操作确认</h3>
        </template>
        <p class="text-gray-600 dark:text-gray-400 mb-4">确定要删除wiki吗?</p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showDeleteWiki = false">取消</UButton>
            <UButton color="red" @click="confirmDeleteWiki">确认</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
    
    <!-- 关联上级确认对话框 -->
    <UModal v-model="showRelatedWiki" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">操作确认</h3>
        </template>
        <p class="text-gray-600 dark:text-gray-400 mb-4">确定要关联吗</p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showRelatedWiki = false">取消</UButton>
            <UButton color="primary" @click="confirmRelatedWiki">确认</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
    
    <!-- 关联下级确认对话框 -->
    <UModal v-model="showChildWiki" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">操作确认</h3>
        </template>
        <p class="text-gray-600 dark:text-gray-400 mb-4">确定要关联吗</p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showChildWiki = false">取消</UButton>
            <UButton color="primary" @click="confirmChildWiki">确认</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
    
    <!-- Wiki选择组件 -->
    <WikiOptionsChoose ref="chooseWikiRef" @choose="chooseWiki" />
    <WikiOptionsChoose ref="chooseWikiRelatedRef" @choose="chooseWikiRelated" />
    <WikiOptionsChoose ref="chooseWikiChildRef" @choose="chooseWikiChild" />
    
    <!-- 管理关联组件（暂时注释，等组件完善后再启用） -->
    <!-- <ManageSubAndSup ref="manageSubAndSupRef" /> -->
  </div>
</template>

<style scoped>
/* 确保横向滚动流畅 */
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
