<script setup lang="ts">
import type { WardrobeClothes } from '@/types/api'
import { getClothesDetail } from '@/api/wardrobe'
const route = useRoute()
const config = useConfigStore()
const id = route.params.id as string
const fetchClothesDetail = async () => {
	const response = await getClothesDetail({ clothes_id: Number.parseInt(id) })
	const data = response
	if (data) {
		if (data.detail_image) {
			data.detail_image_list = data.detail_image.split(',')
		} else {
			data.detail_image_list = []
		}
		if (data.main_style && data.main_style !== '' && config.config?.main_style) {
			const mian_style_option = config.config?.main_style
			const main_style_list: { label: string; value: number }[] = []
			data.main_style.split(',').map((item) => {
				const index = mian_style_option.findIndex((element) => {
					return element.value === Number.parseInt(item)
				})
				if (index !== -1 && mian_style_option[index]) {
					main_style_list.push(mian_style_option[index] as { label: string; value: number })
				}
			})
			data.main_style_list = main_style_list
		} else {
			data.main_style_list = []
		}
		if (data.include_clothes && data.include_clothes !== '' && data.include && data.include.length > 0) {
			const include: WardrobeClothes[] = []
			// biome-ignore lint/complexity/noForEach: <explanation>
			data.include_clothes.split(',').forEach((id: string) => {
				console.log('关联的服饰ID', id)
				if (!data.include) return
				const index = data.include.findIndex((child) => {
					return child.clothes_id === Number.parseInt(id)
				})
				if (index !== -1) {
					include.push(data.include[index])
				}
			})
			data.include = include

		}
	}
	detail.value = data
}
const detail = ref<WardrobeClothes | null>(null)
onMounted(async () => {
	await fetchClothesDetail()
	console.log(detail.value, '服饰详情')
})
</script>
<template>
	<div>
	</div>
</template>
<style></style>