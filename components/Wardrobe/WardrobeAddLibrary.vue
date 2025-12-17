<template>
	<!--
	* 点击收藏与关注 - 添加图鉴到衣柜
	* @param library_id 图鉴ID
	-->
	<QhxDrawer v-model="show" direction="bottom" size="60vh">
		<div class="bg-white dark:bg-gray-800 rounded-t-lg overflow-hidden flex flex-col h-full max-h-[60vh]">
			<!-- 标题 -->
			<div class="flex-shrink-0 px-4 py-3 md:py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 class="text-base md:text-lg font-bold text-center text-gray-900 dark:text-gray-100">
					添加到
				</h3>
			</div>

			<!-- 衣柜列表 -->
			<div class="flex-1 overflow-y-auto px-2 md:px-4 py-2">
				<div class="space-y-1 md:space-y-2">
					<div
						v-for="item in list"
						:key="item.wardrobe_id"
						:class="[
							'px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-all duration-300 cursor-pointer flex items-center justify-between',
							active === item.wardrobe_id
								? 'bg-[#ffaa7f] text-white'
								: 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
						]"
						@click="chooseWardrobe(item.wardrobe_id)"
					>
						<div class="flex-1 text-sm md:text-base font-medium">
							{{ item.wardrobe_name }}
						</div>
						<div
							v-if="item.checked"
							class="ml-2 text-xs md:text-sm text-gray-500 dark:text-gray-400"
							:class="active === item.wardrobe_id ? 'text-white/80' : ''"
						>
							已存在
						</div>
					</div>
				</div>

				<!-- 空状态 -->
				<div v-if="!list.length && !loading" class="text-center text-gray-400 dark:text-gray-500 py-8 md:py-12">
					<p class="text-sm md:text-base">暂无衣柜</p>
				</div>

				<!-- 加载状态 -->
				<div v-if="loading" class="text-center text-gray-400 dark:text-gray-500 py-8 md:py-12">
					<p class="text-sm md:text-base">加载中...</p>
				</div>
			</div>

			<!-- 底部按钮 -->
			<div class="flex-shrink-0 px-4 py-3 md:py-4 border-t border-gray-200 dark:border-gray-700">
				<div class="flex justify-center">
					<UButton
						:loading="is_load"
						@click="add"
						class="w-full md:w-1/2 bg-[#007aff] hover:bg-[#007aff]/90 text-white font-medium py-2.5 md:py-3 text-sm md:text-base"
					>
						确定
					</UButton>
				</div>
			</div>
		</div>
	</QhxDrawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Library } from '@/types/api'
import { getWardrobeListOptions, insertClothes, type WardrobeListOption } from '@/api/wardrobe'
import { BASE_IMG } from '@/utils/ipConfig'
import { useToast } from '#imports'

const emit = defineEmits(['close', 'change'])

const show = ref(false)
const list = ref<WardrobeListOption[]>([])
const is_load = ref(false)
const loading = ref(false)
const active = ref<number | null>(null)
const library = ref<Library | null>(null)
const clothes_img = ref<string | null>(null) // 自选的封面
const toast = useToast()

const chooseWardrobe = (id: number) => {
	if (active.value === id) {
		active.value = null
		return
	}
	active.value = id
}

const close = () => {
	emit('close')
}

const closeModel = () => {
	show.value = false
	active.value = null
	library.value = null
	clothes_img.value = null
	list.value = []
}

const showModel = (libraryData: Library | { library: Library; clothes_img: string }) => {
	if ('clothes_img' in libraryData && libraryData.clothes_img) {
		library.value = libraryData.library
		clothes_img.value = libraryData.clothes_img
	} else {
		library.value = libraryData as Library
		clothes_img.value = null
	}
	
	getWardrobeListOptionsData()
	show.value = true
}

/* 获取用户衣柜列表 */
const getWardrobeListOptionsData = async () => {
	if (!library.value?.library_id) return
	
	loading.value = true
	try {
		const params = {
			library_id: library.value.library_id
		}
		const data = await getWardrobeListOptions(params)
		const formattedList = data.map((v) => {
			return {
				...v,
				checked: v.is_wardrobe !== 0 && !!v.is_wardrobe
			}
		})
		list.value = formattedList
	} catch (error) {
		console.error('获取衣柜列表失败:', error)
		toast.add({
			title: '获取衣柜列表失败',
			icon: 'i-heroicons-exclamation-circle',
			color: 'red'
		})
	} finally {
		loading.value = false
	}
}

const add = async () => {
	if (is_load.value) {
		toast.add({
			title: '请求中请稍候',
			icon: 'i-heroicons-exclamation-circle',
			color: 'warning'
		})
		return
	}
	if (active.value === null) {
		toast.add({
			title: '请选择衣柜',
			icon: 'i-heroicons-exclamation-circle',
			color: 'warning'
		})
		return
	}
	
	if (!library.value) {
		toast.add({
			title: '图鉴信息不存在',
			icon: 'i-heroicons-exclamation-circle',
			color: 'red'
		})
		return
	}

	const params = {
		wardrobe_id: active.value,
		clothes_note: library.value.name || '',
		clothes_img: clothes_img.value || library.value.cover?.replace(BASE_IMG, '') || '',
		library_id: library.value.library_id
	}
	
	is_load.value = true
	try {
		const data = await insertClothes(params)
		toast.add({
			title: '添加成功',
			icon: 'i-heroicons-check-circle',
			color: 'green'
		})
		active.value = null
		closeModel()
		emit('change', data)
	} catch (error) {
		console.error('添加失败:', error)
		toast.add({
			title: '添加失败',
			icon: 'i-heroicons-exclamation-circle',
			color: 'red'
		})
	} finally {
		is_load.value = false
	}
}

defineExpose({
	showModel,
	closeModel
})
</script>

<style scoped>
/* 使用tailwind，不需要额外的样式 */
</style>
