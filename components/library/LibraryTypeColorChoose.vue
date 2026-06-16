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

				<!-- 图鉴列表（横向滚动，多选） -->

				<div v-if="typeOptions.length > 1" class="mb-4 overflow-x-auto py-1">

					<div class="text-xs text-gray-500 dark:text-gray-400 px-0.5 mb-1.5">

						{{ typeSelectHint }}

					</div>

					<div 

						class="flex gap-1.5 md:gap-2.5 px-0.5" 

						:style="{ width: `${typeOptions.length * 70}px` }"

					>

						<div

							v-for="option in typeOptions"

							:key="option.key"

							class="group relative w-[60px] h-[60px] flex-shrink-0 cursor-pointer"

							@click="toggleType(option)"

						>

							<div class="absolute inset-0 overflow-hidden rounded-md">

								<img 

									:src="coverImageUrl(option.cover)"

									:alt="option.library.name || '图鉴封面'"

									class="w-full h-full object-cover"

								/>

							</div>

							<!-- 类型标签 -->

							<div 

								v-if="option.label"

								class="absolute top-0 right-0 z-10 bg-[#faa2ae] text-white text-[10px] px-1 py-0.5 rounded"

							>

								{{ option.label }}

							</div>

							<div

								:class="[

									'absolute inset-0 rounded-md border-2 pointer-events-none z-20 transition-colors',

									selectedTypeKeys.has(option.key)

										? 'border-[#f56c6c]'

										: 'border-transparent group-hover:border-gray-300 dark:group-hover:border-gray-500'

								]"

							/>

						</div>

					</div>

				</div>



				<!-- 图片选择区域 -->

				<div class="space-y-4 pb-4">

					<h4 class="text-base font-bold text-gray-900 dark:text-gray-100 my-1 md:my-2.5">

						选封面

					</h4>

					

					<div v-for="(image, index) in image_list" :key="index" class="space-y-2">

						<!-- 标题 -->

						<div class="text-sm text-gray-600 dark:text-gray-400 px-1">

							{{ image.title }}

						</div>

						

						<!-- 图片横向滚动列表 -->

						<div class="overflow-x-auto py-1">

							<div 

								class="flex gap-1.5 md:gap-2.5 px-0.5"

								:style="{ width: `${image.image.length * 70}px` }"

							>

								<div

									v-for="(imgUrl, imgIndex) in image.image"

									:key="imgIndex"

									class="group relative w-[60px] h-[60px] flex-shrink-0 cursor-pointer"

									@click="chooseClothesImg(normalizeCoverPath(imgUrl))"

								>

									<div class="absolute inset-0 overflow-hidden rounded-md">

										<img 

											:src="coverImageUrl(imgUrl)"

											:alt="`${image.title} - ${imgIndex + 1}`"

											class="w-full h-full object-cover"

										/>

									</div>

									<div

										:class="[

											'absolute inset-0 rounded-md border-2 pointer-events-none z-10 transition-colors',

											active.clothes_img === normalizeCoverPath(imgUrl)

												? 'border-[#f56c6c]'

												: 'border-transparent group-hover:border-gray-300 dark:group-hover:border-gray-500'

										]"

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

import type { LibraryTypeColorChooseResult } from '@/utils/libraryClothesSeed'

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



const emit = defineEmits<{

	choose: [payload: LibraryTypeColorChooseResult]

}>()



const DEFAULT_LIBRARY_COVER = 'static/plan_cover/default.jpg'



interface LibrarySkuItem {

	library_pattern: string

	library_price?: number

	cover?: string

}



interface TypeOption {

	key: string

	label: string

	cover: string

	library: Library

	kind: 'library' | 'sku'

}



const parseLibraryJsonData = (jsonData: unknown): Record<string, unknown> => {

	if (jsonData == null) return {}

	if (typeof jsonData === 'string') {

		try {

			const parsed = JSON.parse(jsonData)

			return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)

				? (parsed as Record<string, unknown>)

				: {}

		} catch {

			return {}

		}

	}

	if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {

		return jsonData as Record<string, unknown>

	}

	return {}

}



const extractSkuListFromJsonData = (jsonData: unknown): LibrarySkuItem[] => {

	const data = parseLibraryJsonData(jsonData)

	const raw = data.sku

	let list: unknown[] = []

	if (Array.isArray(raw)) {

		list = raw

	} else if (typeof raw === 'string') {

		try {

			const parsed = JSON.parse(raw)

			if (Array.isArray(parsed)) list = parsed

		} catch {

			return []

		}

	}

	return list

		.map((item): LibrarySkuItem | null => {

			if (!item || typeof item !== 'object' || !('library_pattern' in item)) return null

			const record = item as LibrarySkuItem

			const pattern = String(record.library_pattern ?? '').trim()

			if (!pattern) return null

			const cover = record.cover != null ? String(record.cover).trim() : undefined

			return {

				library_pattern: pattern,

				library_price: record.library_price != null ? Number(record.library_price) : undefined,

				cover: cover || undefined

			}

		})

		.filter((item): item is LibrarySkuItem => item != null)

}



const normalizeCoverPath = (cover?: string | null): string => {

	if (!cover?.trim()) return DEFAULT_LIBRARY_COVER

	return cover

		.trim()

		.replace(BASE_IMG, '')

		.replace(/^https?:\/\/[^/]+\//i, '')

		.replace(/^\//, '')

}



const resolveCoverPath = (cover?: string | null, fallback?: string | null): string => {

	if (cover?.trim()) return normalizeCoverPath(cover)

	if (fallback?.trim()) return normalizeCoverPath(fallback)

	return DEFAULT_LIBRARY_COVER

}



const coverImageUrl = (path?: string | null) =>

	`${BASE_IMG}${normalizeCoverPath(path)}?x-oss-process=image/quality,q_60/resize,w_150`



const buildTypeOptions = (libraryList: Library[], primaryItem: Library): TypeOption[] => {

	const childLibraries = libraryList.filter((lib) => lib.library_id !== primaryItem.library_id)

	if (childLibraries.length) {

		return childLibraries.map((item) => ({

			key: `lib-${item.library_id}`,

			label: item.library_type || item.name || '图鉴',

			cover: resolveCoverPath(item.cover),

			library: item,

			kind: 'library' as const

		}))

	}



	const skuItems = extractSkuListFromJsonData(primaryItem.json_data)

	if (!skuItems.length) return []



	const patternNames = primaryItem.library_pattern

		? primaryItem.library_pattern.split(',').map((s) => s.trim()).filter(Boolean)

		: skuItems.map((item) => item.library_pattern)

	const uniquePatterns = patternNames.filter((name, index, arr) => arr.indexOf(name) === index)

	const skuByPattern = new Map(skuItems.map((item) => [item.library_pattern, item]))



	return uniquePatterns.map((pattern) => {

		const sku = skuByPattern.get(pattern)

		return {

			key: `sku-${pattern}`,

			label: pattern,

			cover: resolveCoverPath(sku?.cover, primaryItem.cover),

			library: primaryItem,

			kind: 'sku' as const

		}

	})

}



const show = ref(false)

const loading = ref(false)

const primaryLibrary = ref<Library | null>(null)

const typeOptions = ref<TypeOption[]>([])

const typeOptionKind = ref<'library' | 'sku' | null>(null)

const image_list = ref<Array<{ title: string; image: string[] }>>([])

const selectedTypeKeys = ref<Set<string>>(new Set())

const active = ref<{ clothes_img: string | null }>({

	clothes_img: null

})



const typeSelectHint = computed(() => {

	if (typeOptionKind.value === 'library') return '选择子图鉴（可多选）'

	if (typeOptionKind.value === 'sku') return '选择版型（可多选）'

	return '选择类型（可多选）'

})



const toggleType = (option: TypeOption) => {

	const next = new Set(selectedTypeKeys.value)

	if (next.has(option.key)) {

		next.delete(option.key)

	} else {

		next.add(option.key)

	}

	selectedTypeKeys.value = next

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

	primaryLibrary.value = item

	if (props.needHiddenTabbar) {

		// 在Nuxt中不需要隐藏tabbar，这是uni-app的特性

	}

	

	loading.value = true

	let libraryList: Library[] = [item]

	const imageList: Array<{ title: string; image: string[] }> = []

	const libraryCover = resolveCoverPath(item.cover)

	selectedTypeKeys.value = new Set()

	

	// 添加详情图

	if (item.detail_image) {

		imageList.push({

			title: '详情图',

			image: [

				libraryCover,

				...item.detail_image.split(',').filter(Boolean).map((img) => resolveCoverPath(img, item.cover))

			]

		})

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

				title: child.title || '人台图',

				image: (child.addr ?? '').split(',').filter(Boolean).map((img) => resolveCoverPath(img, item.cover))

			})

		}

	} catch (e) {

		console.error('获取图片列表失败:', e)

	}



	const hasChildLibraries = libraryList.length > 1

	const hasDetailImage = Boolean(item.detail_image?.trim())

	if (!hasChildLibraries && !hasDetailImage) {

		const coverInList = imageList.some((group) =>

			group.image.some((img) => normalizeCoverPath(img) === libraryCover)

		)

		if (!coverInList) {

			imageList.unshift({

				title: '图鉴封面',

				image: [libraryCover]

			})

		}

	}

	

	const options = buildTypeOptions(libraryList, item)

	typeOptions.value = options

	typeOptionKind.value = options[0]?.kind ?? null

	image_list.value = imageList



	active.value = {

		clothes_img: !hasChildLibraries && !hasDetailImage && options.length <= 1

			? libraryCover

			: null

	}

	loading.value = false

}



const init = () => {

	active.value = { clothes_img: null }

	primaryLibrary.value = null

	selectedTypeKeys.value = new Set()

	typeOptions.value = []

	typeOptionKind.value = null

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

	if (!primaryLibrary.value) return



	const selectedOptions = typeOptions.value
		.filter((option) => selectedTypeKeys.value.has(option.key))

	emit('choose', {
		library: primaryLibrary.value,
		clothes_img: active.value.clothes_img,
		selected_type_labels: selectedOptions.map((option) => option.label).filter(Boolean),
		selected_type_covers: selectedOptions.map((option) => normalizeCoverPath(option.cover))
	})

	closeModel()

}



defineExpose({

	showModel

})

</script>



<style scoped>

/* 使用tailwind，不需要额外的样式 */

</style>


