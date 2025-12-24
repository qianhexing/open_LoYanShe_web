<template>
	<QhxDrawer v-model="show" :direction="drawerDirection" :size="drawerSize">
		<div class="bg-white dark:bg-gray-800 rounded-t-lg md:rounded-l-lg overflow-hidden flex flex-col h-full max-h-[80vh] md:max-h-full">
			<!-- 头部 -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">选择图鉴型色</h3>
				<UButton 
					color="primary" 
					@click="choose"
					class="bg-[#2979ff] hover:bg-[#2979ff]/90 text-white"
				>
					确认选择
				</UButton>
			</div>

			<!-- 内容区域 -->
			<div class="flex-1 overflow-y-auto px-2.5 md:px-4">
				<!-- 图鉴列表（横向滚动） -->
				<div v-if="list.length > 1" class="mb-4 overflow-x-auto">
					<div 
						class="flex gap-1.5 md:gap-2.5 pb-2" 
						:style="{ width: `${list.length * 70}px` }"
					>
						<div
							v-for="item in list"
							:key="item.library_id"
							:class="[
								'relative w-[60px] h-[60px] rounded-md overflow-hidden flex-shrink-0 cursor-pointer transition-all duration-300',
								active.library && active.library.library_id === item.library_id 
									? 'ring-2 ring-[#f56c6c] ring-offset-2' 
									: 'hover:ring-2 hover:ring-gray-300'
							]"
							@click="choodeType(item)"
						>
							<!-- 类型标签 -->
							<div 
								v-if="item.library_type"
								class="absolute top-0 right-0 z-10 bg-[#faa2ae] text-white text-[10px] px-1 py-0.5 rounded"
							>
								{{ item.library_type }}
							</div>
							<img 
								:src="`${BASE_IMG}${item.cover.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_60/resize,w_150`"
								:alt="item.name || '图鉴封面'"
								class="w-full h-full object-cover"
							/>
						</div>
					</div>
				</div>

				<!-- 图片选择区域 -->
				<div class="space-y-4 pb-4">
					<h4 class="text-base font-bold text-gray-900 dark:text-gray-100 my-1 md:my-2.5">
						选图
					</h4>
					
					<div v-for="(image, index) in image_list" :key="index" class="space-y-2">
						<!-- 标题 -->
						<div class="text-sm text-gray-600 dark:text-gray-400 px-1">
							{{ image.title }}
						</div>
						
						<!-- 图片横向滚动列表 -->
						<div class="overflow-x-auto">
							<div 
								class="flex gap-1.5 md:gap-2.5 pb-2"
								:style="{ width: `${image.image.length * 70}px` }"
							>
								<div
									v-for="(imgUrl, imgIndex) in image.image"
									:key="imgIndex"
									:class="[
										'relative w-[60px] h-[60px] rounded-md overflow-hidden flex-shrink-0 cursor-pointer transition-all duration-300',
										active.clothes_img === imgUrl.replace(BASE_IMG, '') 
											? 'ring-2 ring-[#f56c6c] ring-offset-2' 
											: 'hover:ring-2 hover:ring-gray-300'
									]"
									@click="chooseClothesImg(imgUrl.replace(BASE_IMG, ''))"
								>
									<img 
										:src="`${BASE_IMG}${imgUrl.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_60/resize,w_150`"
										:alt="`${image.title} - ${imgIndex + 1}`"
										class="w-full h-full object-cover"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</QhxDrawer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getLibraryList, getLibraryVideo } from '@/api/library'
import type { Library, LibraryVideo } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

// 响应式检测屏幕尺寸
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isDesktop = computed(() => windowWidth.value >= 768) // md breakpoint

// 根据屏幕尺寸动态设置抽屉方向和大小
const drawerDirection = computed(() => {
  return isDesktop.value ? 'right' : 'bottom'
})

const drawerSize = computed(() => {
  return isDesktop.value ? '400px' : '80vh'
})

// 监听窗口大小变化
const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    windowWidth.value = window.innerWidth
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})

const props = defineProps({
	needStatus: {
		type: Boolean,
		default: true
	},
	needHiddenTabbar: {
		type: Boolean,
		default: false
	},
	filter_list: {
		type: Array as () => Array<Record<string, unknown>>,
		default: () => []
	},
	multiple: {
		type: Boolean,
		default: false
	},
	need_parent: {
		type: Boolean,
		default: true
	}
})

const emit = defineEmits(['choose'])

const show = ref(false)
const loading = ref(false)
const list = ref<Library[]>([])
const image_list = ref<Array<{ title: string; image: string[] }>>([])
const active = ref<{
	clothes_img: string | null
	library: Library | null
}>({
	clothes_img: null,
	library: null
})

const choodeType = (item: Library) => {
	active.value.library = item
	active.value.clothes_img = item.cover.replace(BASE_IMG, '')
}

const chooseClothesImg = (url: string) => {
	active.value.clothes_img = url
}

const getLibraryVideoAll = async (pk_id: number): Promise<LibraryVideo[]> => {
	const params = {
		pk_id: Number.parseInt(String(pk_id), 10)
	}
	const res = await getLibraryVideo(params)
	return res
}

const showModel = async (item: Library) => {
	show.value = true
	if (props.needHiddenTabbar) {
		// 在Nuxt中不需要隐藏tabbar，这是uni-app的特性
		// 如果需要，可以在这里添加相应的逻辑
	}
	
	loading.value = true
	let libraryList: Library[] = [item]
	const imageList: Array<{ title: string; image: string[] }> = []
	
	// 添加详情图
	if (item.detail_image) {
		imageList.push({
			title: '详情图',
			image: [item.cover, ...item.detail_image.split(',')]
		})
	}
	
	// 设置初始选中状态
	active.value = {
		library: item,
		clothes_img: item.cover.replace(BASE_IMG, '')
	}
	
	// 如果是系列类型，获取子图鉴
	if (item.library_type === '系列') {
		try {
			const result = await getLibraryList({
				page: 1,
				pageSize: 999,
				filter_list: [{
					field: 'parent_id',
					value: item.library_id,
					op: 'and'
				}]
			})
			if (result.rows && result.rows.length > 0) {
				libraryList = [item, ...result.rows]
			}
		} catch (e) {
			console.error('获取子图鉴失败:', e)
		}
	}
	
	// 获取视频图片列表
	try {
		const video = await getLibraryVideoAll(item.library_id)
		for (const child of video) {
			imageList.push({
				title: child.title,
				image: child.addr.split(',')
			})
		}
	} catch (e) {
		console.error('获取图片列表失败:', e)
	}
	
	image_list.value = imageList
	list.value = libraryList
	loading.value = false
}

const init = () => {
	active.value = {
		clothes_img: null,
		library: null
	}
	list.value = []
	image_list.value = []
}

const closeModel = () => {
	show.value = false
	if (props.needHiddenTabbar) {
		// 在Nuxt中不需要显示tabbar，这是uni-app的特性
	}
	init()
}

const choose = () => {
	console.log(active.value, '选择的图鉴')
	emit('choose', active.value)
	closeModel()
}

defineExpose({
	showModel
})
</script>

<style scoped>
/* 使用tailwind，不需要额外的样式 */
</style>
