<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Teaparty } from '~/types/api'
import { insertTeaparty, updateTeaparty } from '@/api/teapart'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const teaCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import addressData from '~/public/address.json'

// 地址数据类型
interface AddressItem {
  label: string
  value: string
  children?: AddressItem[]
}

const emit = defineEmits(['success'])

const provinceSelectRef = ref<InstanceType<typeof QhxSelect>>()
const citySelectRef = ref<InstanceType<typeof QhxSelect>>()
const areaSelectRef = ref<InstanceType<typeof QhxSelect>>()
const teaTypeSelectRef = ref<InstanceType<typeof QhxSelect>>()
const joinWaySelectRef = ref<InstanceType<typeof QhxSelect>>()

const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑
const clickPosition = ref({ x: 0, y: 0 })

// 地址选择相关
const showAddressPicker = ref(false)
const selectedProvince = ref<{ label: string; value: string } | null>(null)
const selectedCity = ref<{ label: string; value: string } | null>(null)
const selectedArea = ref<{ label: string; value: string } | null>(null)

// 茶会类型选项
const teaTypeOptions = ref<optionsInterface[]>([
  { value: 1, label: '线下茶会' },
  { value: 2, label: '线上茶会' },
  { value: 3, label: '混合茶会' }
])

// 参与方式选项
const joinWayOptions = ref<optionsInterface[]>([
  { value: 1, label: '直接参与' },
  { value: 2, label: '需要审批' }
])

const form = ref<{
  tea_id: number | null
  tea_title: string
  tea_desc: string
  tea_cover: string | null
  start_time: string | null
  end_time: string | null
  limit_number: number | null
  address: string | null
  province: string | null
  city: string | null
  area: string | null
  tea_type: number | null
  join_way: number | null
  detail_image: string | null
  latitude: number | null
  longitude: number | null
}>({
  tea_id: null,
  tea_title: '',
  tea_desc: '',
  tea_cover: null,
  start_time: null,
  end_time: null,
  limit_number: null,
  address: null,
  province: null,
  city: null,
  area: null,
  tea_type: null,
  join_way: null,
  detail_image: null,
  latitude: null,
  longitude: null
})

// UInput 的 v-model 不接受 null，这里做一层适配（空字符串 <-> null）
const addressModel = computed({
  get: () => form.value.address ?? '',
  set: (val: string) => {
    form.value.address = val?.trim() ? val : null
  }
})

// 经纬度适配为字符串输入，再转换为 number | null
const latitudeModel = computed<string | number | undefined>({
  get: () => form.value.latitude ?? '',
  set: (val) => {
    const num = Number(val)
    form.value.latitude = Number.isFinite(num) ? num : null
  }
})

const longitudeModel = computed<string | number | undefined>({
  get: () => form.value.longitude ?? '',
  set: (val) => {
    const num = Number(val)
    form.value.longitude = Number.isFinite(num) ? num : null
  }
})

// 地址选项
const provinceOptions = computed(() => {
  return (addressData as AddressItem[]).map(item => ({
    label: item.label,
    value: item.value
  }))
})

const cityOptions = computed(() => {
  if (!selectedProvince.value) return []
  const province = (addressData as AddressItem[]).find(p => p.value === selectedProvince.value?.value)
  if (!province?.children) return []
  return province.children.map((item: AddressItem) => ({
    label: item.label,
    value: item.value
  }))
})

const areaOptions = computed(() => {
  if (!selectedCity.value || !selectedProvince.value) return []
  const province = (addressData as AddressItem[]).find(p => p.value === selectedProvince.value?.value)
  if (!province?.children) return []
  const city = province.children.find((c: AddressItem) => c.value === selectedCity.value?.value)
  if (!city?.children) return []
  return city.children.map((item: AddressItem) => ({
    label: item.label,
    value: item.value
  }))
})

const showModel = (item: Teaparty | null, isCopy = false, event?: MouseEvent) => {
  // 记录触发位置
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }

  // 设置类型：0=添加，1=编辑
  type.value = isCopy ? 0 : (item?.tea_id ? 1 : 0)

  // 初始化表单数据
  if (item) {
    form.value.tea_id = isCopy ? null : (item.tea_id || null)
    form.value.tea_title = item.tea_title || ''
    form.value.tea_desc = item.tea_desc || ''
    form.value.start_time = item.start_time ? formatDateForInput(item.start_time) : null
    form.value.end_time = item.end_time ? formatDateForInput(item.end_time) : null
    form.value.limit_number = item.limit_number || null
    form.value.address = (item as any).address || null
    form.value.province = item.province || null
    form.value.city = item.city || null
    form.value.area = item.area || null
    form.value.tea_type = item.tea_type || null
    form.value.join_way = item.join_way || null
    form.value.latitude = item.latitude ?? null
    form.value.longitude = item.longitude ?? null

    // 初始化地址选择状态
    if (item.province && item.city && item.area) {
      const province = (addressData as AddressItem[]).find(p => p.label === item.province)
      if (province) {
        selectedProvince.value = { label: province.label, value: province.value }
        const city = province.children?.find((c: AddressItem) => c.label === item.city)
        if (city) {
          selectedCity.value = { label: city.label, value: city.value }
          const area = city.children?.find((a: AddressItem) => a.label === item.area)
          if (area) {
            selectedArea.value = { label: area.label, value: area.value }
          }
        }
      }
    }

    // 处理封面图片
    setTimeout(() => {
      if (item.tea_cover && teaCoverRef.value) {
        teaCoverRef.value.previewImages = [{
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + item.tea_cover
        }]
      }
      // 处理详情图片
      if (item.detail_image && detailImageRef.value) {
        const detailImages = item.detail_image.split(',').filter((img: string) => img.trim() !== '')
        detailImageRef.value.previewImages = detailImages.map((img: string) => ({
          id: `img_${Date.now()}_${Math.random()}`,
          file: undefined as unknown as File,
          url: BASE_IMG + img
        }))
      }
    })
  } else {
    // 如果没有传入 item，重置表单
    initData()
  }

  show.value = true
}

// 格式化日期为 input[type="datetime-local"] 格式
const formatDateForInput = (date: Date | string): string => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const closeModel = () => {
  show.value = false
  initData()
}

const handleClose = () => {
  closeModel()
}

const initData = () => {
  form.value = {
    tea_id: null,
    tea_title: '',
    tea_desc: '',
    tea_cover: null,
    start_time: null,
    end_time: null,
    limit_number: null,
    address: null,
    province: null,
    city: null,
    area: null,
    tea_type: null,
    join_way: null,
    detail_image: null
  }
  selectedProvince.value = null
  selectedCity.value = null
  selectedArea.value = null
  
  // 清空图片选择器
  if (teaCoverRef.value) {
    teaCoverRef.value.previewImages = []
  }
  if (detailImageRef.value) {
    detailImageRef.value.previewImages = []
  }
}

const fetchUpload = async (file: { file: File; url: string }) => {
  try {
    let url: string
    if (file.file) {
      const res = await uploadImage(file.file)
      url = res.file_url
    } else {
      url = file.url.replace(BASE_IMG, '')
    }
    return url
  } catch (error) {
    throw error
  }
}

const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
}

// 打开地址选择器
const openAddressPicker = () => {
  // 如果有已选择的地址，初始化选择状态
  if (form.value.province && form.value.city && form.value.area) {
    const province = (addressData as AddressItem[]).find(p => p.label === form.value.province)
    if (province) {
      selectedProvince.value = { label: province.label, value: province.value }
      const city = province.children?.find((c: AddressItem) => c.label === form.value.city)
      if (city) {
        selectedCity.value = { label: city.label, value: city.value }
        const area = city.children?.find((a: AddressItem) => a.label === form.value.area)
        if (area) {
          selectedArea.value = { label: area.label, value: area.value }
        }
      }
    }
  } else {
    // 重置选择
    selectedProvince.value = null
    selectedCity.value = null
    selectedArea.value = null
  }
  showAddressPicker.value = true
}

// 打开省份选择器
const openProvincePicker = (e: MouseEvent) => {
  provinceSelectRef.value?.showPicker(e)
}

// 打开城市选择器
const openCityPicker = (e: MouseEvent) => {
  citySelectRef.value?.showPicker(e)
}

// 打开区县选择器
const openAreaPicker = (e: MouseEvent) => {
  areaSelectRef.value?.showPicker(e)
}

// 省份选择
const onProvinceSelect = (value: { label: string; value: string | number }) => {
  selectedProvince.value = { label: value.label, value: String(value.value) }
  selectedCity.value = null
  selectedArea.value = null
}

// 城市选择
const onCitySelect = (value: { label: string; value: string | number }) => {
  selectedCity.value = { label: value.label, value: String(value.value) }
  selectedArea.value = null
}

// 区县选择
const onAreaSelect = (value: { label: string; value: string | number }) => {
  selectedArea.value = { label: value.label, value: String(value.value) }
}

// 确认地址
const confirmAddress = () => {
  if (!selectedProvince.value || !selectedCity.value || !selectedArea.value) {
    const toast = useToast()
    toast.add({
      title: '请完整选择地址',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }
  
  form.value.province = selectedProvince.value.label
  form.value.city = selectedCity.value.label
  form.value.area = selectedArea.value.label
  showAddressPicker.value = false
}

// 删除地址
const deleteAddress = () => {
  form.value.province = null
  form.value.city = null
  form.value.area = null
  form.value.address = null
  selectedProvince.value = null
  selectedCity.value = null
  selectedArea.value = null
}

// 打开茶会类型选择器
const openTeaTypePicker = (e: MouseEvent) => {
  teaTypeSelectRef.value?.showPicker(e)
}

// 打开参与方式选择器
const openJoinWayPicker = (e: MouseEvent) => {
  joinWaySelectRef.value?.showPicker(e)
}

const insert = async () => {
  if (loading.value) {
    return
  }
  loading.value = true
  const toast = useToast()
  
  try {
    const params: any = {
      tea_title: form.value.tea_title || null,
      tea_desc: form.value.tea_desc || null,
      start_time: form.value.start_time || null,
      end_time: form.value.end_time || null,
      limit_number: form.value.limit_number || null,
      address: form.value.address || null,
      province: form.value.province || null,
      city: form.value.city || null,
      area: form.value.area || null,
      tea_type: form.value.tea_type || null,
      join_way: form.value.join_way || null,
      latitude: form.value.latitude ?? null,
      longitude: form.value.longitude ?? null
    }

    // 上传封面图片
    if (teaCoverRef.value && teaCoverRef.value.previewImages.length > 0) {
      try {
        const tea_cover = await fetchUpload(teaCoverRef.value.previewImages[0])
        params.tea_cover = tea_cover
      } catch (error) {
        console.log('上传封面失败', error)
        params.tea_cover = null
      }
    } else {
      params.tea_cover = null
    }

    // 上传详情图片
    if (detailImageRef.value && detailImageRef.value.previewImages.length > 0) {
      const detail_image = []
      for (let index = 0; index < detailImageRef.value.previewImages.length; index++) {
        const element = detailImageRef.value.previewImages[index]
        try {
          const url = await fetchUpload(element)
          detail_image.push(url)
        } catch (error) {
          console.log('上传详情图失败', error)
        }
      }
      params.detail_image = detail_image.length > 0 ? detail_image.join(',') : null
    } else {
      params.detail_image = null
    }

    if (type.value === 0) {
      // 添加
      await insertTeaparty(params)
      toast.add({
        title: '创建成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success')
      closeModel()
    } else {
      // 编辑
      params.tea_id = form.value.tea_id
      await updateTeaparty(params)
      toast.add({
        title: '更新成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success')
      closeModel()
    }
  } catch (error) {
    console.error('保存失败:', error)
    toast.add({
      title: '保存失败',
      description: '请检查输入信息',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

defineExpose({
  showModel
})
</script>

<template>
  <!-- Popup -->
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold">
          {{ type === 0 ? '新增茶会' : '编辑茶会' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <!-- 主要信息板块 -->
        <div class="space-y-6">
          <!-- 茶会标题 -->
          <UFormGroup label="茶会标题">
            <UInput
              v-model="form.tea_title"
              placeholder="请输入茶会标题"
              class="flex-1 focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>

          <!-- 茶会描述 -->
          <UFormGroup label="茶会描述">
            <UTextarea
              v-model="form.tea_desc"
              placeholder="请输入茶会描述"
              :rows="4"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>

          <!-- 封面图片 -->
          <UFormGroup label="封面图片" class="space-y-2">
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <QhxImagePicker :multiple="false" @update:files="onUpdateFiles" ref="teaCoverRef" />
            </div>
          </UFormGroup>
        </div>

        <!-- 时间信息板块 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-calendar" class="text-lg text-gray-500 dark:text-gray-400" />
            <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300">时间信息</h3>
          </div>

          <!-- 开始时间 -->
          <UFormGroup label="开始时间">
            <UInput
              v-model="form.start_time"
              type="datetime-local"
              placeholder="选择开始时间"
              class="flex-1 focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>

          <!-- 结束时间 -->
          <UFormGroup label="结束时间">
            <UInput
              v-model="form.end_time"
              type="datetime-local"
              placeholder="选择结束时间"
              class="flex-1 focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>

          <!-- 人数限制 -->
          <UFormGroup label="人数限制">
            <UInput
              v-model="form.limit_number"
              type="number"
              placeholder="请输入人数限制（可选）"
              class="flex-1 focus:ring-0"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>
        </div>

        <!-- 地点信息板块 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-map-pin" class="text-lg text-gray-500 dark:text-gray-400" />
            <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300">地点信息</h3>
          </div>

          <!-- 地址选择 -->
          <UFormGroup label="活动地址">
            <div v-if="form.province && form.city && form.area" class="inline-block mb-2">
              <QhxTag
                :active="true"
                class="transition-all duration-200 hover:scale-105"
              >
                <div class="flex items-center gap-2">
                  <QhxJellyButton class="cursor-pointer flex items-center justify-center w-5 h-5 text-white rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 transition-all" @click.stop="deleteAddress">
                    <UIcon name="ant-design:close-outlined" class="text-xs text-white" />
                  </QhxJellyButton>
                  <span class="font-medium">{{ form.province }} {{ form.city }} {{ form.area }}</span>
                </div>
              </QhxTag>
            </div>
            <UButton
              type="submit"
              size="sm"
              class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md shadow-pink-500/30 transition-all duration-200"
              :loading="loading"
              @click="openAddressPicker"
            >
              <UIcon name="i-heroicons-map-pin" class="mr-1" />
              {{ form.province ? '修改地址' : '选择地址' }}
            </UButton>

            <!-- 详细地址 -->
            <div class="mt-3">
              <UInput
                v-model="addressModel"
                placeholder="请输入详细地址（街道/门牌号等）"
                class="flex-1 focus:ring-0"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' },
                  color: {
                    white: {
                      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                    }
                  }
                }"
              />
            </div>
            <div class="my-1 text-sm ">
              <div class="text-red-500">填写经纬度后可以添加进地图</div>
              <div class="text-blue-500"><a href="https://lbs.baidu.com/maptool/getpoint" target="_blank">去获取经纬度</a></div>
            </div>
            <!-- 经纬度 -->
            <div class="mt-3 grid grid-cols-2 gap-3">
              <UInput
                v-model="latitudeModel"
                type="number"
                placeholder="纬度"
                class="flex-1 focus:ring-0"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' },
                  color: {
                    white: {
                      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                    }
                  }
                }"
              />
              <UInput
                v-model="longitudeModel"
                type="number"
                placeholder="经度"
                class="flex-1 focus:ring-0"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' },
                  color: {
                    white: {
                      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                    }
                  }
                }"
              />
            </div>
          </UFormGroup>
        </div>

        <!-- 其他信息板块 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="material-symbols:more-horiz-rounded" class="text-lg text-gray-500 dark:text-gray-400" />
            <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300">其他信息</h3>
          </div>

          <!-- 茶会类型 -->
          <!-- <UFormGroup label="茶会类型">
            <div v-if="form.tea_type" class="mb-2">
              <QhxTag>
                <div class="flex">
                  <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.tea_type = null">
                    <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                  </QhxJellyButton>
                  <div>{{ teaTypeOptions.find(opt => opt.value === form.tea_type)?.label || '未知类型' }}</div>
                </div>
              </QhxTag>
            </div>
            <UButton
              type="submit"
              size="xs"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
              :loading="loading"
              @click="(e: MouseEvent) => { openTeaTypePicker(e) }"
            >
              选择类型
            </UButton>
            <QhxSelect
              ref="teaTypeSelectRef"
              :options="teaTypeOptions"
              :default-value="teaTypeOptions[0]"
              @select="(select) => { 
                form.tea_type = select.value as number
              }"
            />
          </UFormGroup> -->

          <!-- 参与方式 -->
          <!-- <UFormGroup label="参与方式">
            <div v-if="form.join_way" class="mb-2">
              <QhxTag>
                <div class="flex">
                  <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.join_way = null">
                    <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                  </QhxJellyButton>
                  <div>{{ joinWayOptions.find(opt => opt.value === form.join_way)?.label || '未知方式' }}</div>
                </div>
              </QhxTag>
            </div>
            <UButton
              type="submit"
              size="xs"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
              :loading="loading"
              @click="(e: MouseEvent) => { openJoinWayPicker(e) }"
            >
              选择方式
            </UButton>
            <QhxSelect
              ref="joinWaySelectRef"
              :options="joinWayOptions"
              :default-value="joinWayOptions[0]"
              @select="(select) => { 
                form.join_way = select.value as number
              }"
            />
          </UFormGroup> -->

          <!-- 详情图片 -->
          <UFormGroup label="详情图片" class="space-y-2">
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
              <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" ref="detailImageRef" />
            </div>
          </UFormGroup>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton
          color="gray"
          variant="ghost"
          @click="closeModel"
          class="px-6"
        >
          取消
        </UButton>
        <UButton
          :loading="loading"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="insert"
        >
          {{ type === 1 ? '确认修改' : '确认添加' }}
        </UButton>
      </div>
    </div>

    <!-- 地址选择对话框 -->
    <QhxModal v-model="showAddressPicker">
      <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">选择地址</h3>
          <button
            @click="showAddressPicker = false"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="p-6 space-y-4">
          <!-- 省份选择 -->
          <UFormGroup label="省份">
            <UButton
              @click="openProvincePicker"
              variant="outline"
              block
              class="justify-start"
            >
              {{ selectedProvince?.label || '请选择省份' }}
            </UButton>
            <QhxSelect
              ref="provinceSelectRef"
              :options="provinceOptions"
              @select="onProvinceSelect"
            />
          </UFormGroup>

          <!-- 城市选择 -->
          <UFormGroup label="城市" v-if="selectedProvince">
            <UButton
              @click="openCityPicker"
              variant="outline"
              block
              class="justify-start"
            >
              {{ selectedCity?.label || '请选择城市' }}
            </UButton>
            <QhxSelect
              ref="citySelectRef"
              :options="cityOptions"
              @select="onCitySelect"
            />
          </UFormGroup>

          <!-- 区县选择 -->
          <UFormGroup label="区县" v-if="selectedCity">
            <UButton
              @click="openAreaPicker"
              variant="outline"
              block
              class="justify-start"
            >
              {{ selectedArea?.label || '请选择区县' }}
            </UButton>
            <QhxSelect
              ref="areaSelectRef"
              :options="areaOptions"
              @select="onAreaSelect"
            />
          </UFormGroup>

          <div class="flex gap-2 justify-end mt-4">
            <UButton
              color="gray"
              variant="ghost"
              @click="showAddressPicker = false"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              @click="confirmAddress"
            >
              确认
            </UButton>
          </div>
        </div>
      </div>
    </QhxModal>
  </QhxModal>
</template>

