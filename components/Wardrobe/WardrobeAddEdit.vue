<template>
  <UModal v-model="show" :ui="{ width: 'max-w-3xl' }" prevent-close>
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            {{ type === 0 ? '新增衣柜' : '编辑衣柜' }}
          </h2>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
        </div>
      </template>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-2">
        <!-- 衣柜名称 -->
        <UFormGroup label="衣柜名称">
          <UInput v-model="form.wardrobe_name" placeholder="请输入衣柜名称" class="flex-1 focus:ring-0" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
        </UFormGroup>

        <!-- 衣柜封面 -->
        <UFormGroup label="衣柜封面">
          <QhxImagePicker :multiple="false" @update:files="onUpdateCoverFiles" ref="wardrobeCoverRef" />
        </UFormGroup>

        <!-- 衣柜描述 -->
        <UFormGroup label="衣柜描述">
          <UTextarea v-model="form.wardrobe_desc" placeholder="请输入衣柜描述" :rows="3" class="flex-1 focus:ring-0" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
        </UFormGroup>

        <!-- 是否私密 -->
        <UFormGroup label="是否私密">
          <URadioGroup v-model="form.is_private" :options="[
            { label: '公开', value: 0 },
            { label: '私密', value: 1 }
          ]" />
          <p class="text-xs text-gray-500 mt-1" v-if="form.is_private === 0">非私有衣柜将对其他用户开放</p>
        </UFormGroup>

        <!-- 访问密码 -->
        <UFormGroup label="访问密码" v-if="form.is_private === 1">
          <UInput v-model="form.password" type="password" placeholder="设置密码后需要密码才能访问" class="flex-1 focus:ring-0" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
          <p class="text-xs text-gray-500 mt-1" v-if="form.password">可通过输入正确密码访问衣柜</p>
        </UFormGroup>

        <!-- 衣柜背景图 -->
        <UFormGroup label="衣柜背景图">
          <QhxImagePicker :multiple="false" @update:files="onUpdateBackgroundFiles" ref="wardrobeBackgroundRef" />
        </UFormGroup>

        <!-- 背景显示模式 -->
        <UFormGroup label="背景显示">
          <URadioGroup v-model="form.custom_style.back_mode" :options="[
            { label: '平铺背景', value: false },
            { label: '拉伸填充', value: true }
          ]" />
        </UFormGroup>

        <!-- 按钮颜色 -->
        <UFormGroup label="按钮颜色">
          <div class="flex items-center gap-2 flex-wrap">
            <div v-if="form.custom_style.btnColor" class="relative inline-block">
              <div class="w-10 h-10 rounded border-2 border-gray-300" :style="{ background: form.custom_style.btnColor }"></div>
              <UButton 
                icon="i-heroicons-x-mark" 
                size="2xs" 
                color="red" 
                variant="soft"
                class="absolute -top-1 -right-1"
                @click="form.custom_style.btnColor = null"
              />
            </div>
            <ClientOnly>
              <QhxColorPicker @choose="(color: string) => form.custom_style.btnColor = color" ref="btnColorPickerRef" />
            </ClientOnly>
            <UButton 
              size="xs" 
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="showColorPicker('btnColor')"
            >
              选择按钮颜色
            </UButton>
          </div>
        </UFormGroup>

        <!-- 按钮字体颜色 -->
        <UFormGroup label="按钮字体颜色">
          <div class="flex items-center gap-2 flex-wrap">
            <div v-if="form.custom_style.btnFontColor" class="relative inline-block">
              <div class="w-10 h-10 rounded border-2 border-gray-300" :style="{ background: form.custom_style.btnFontColor }"></div>
              <UButton 
                icon="i-heroicons-x-mark" 
                size="2xs" 
                color="red" 
                variant="soft"
                class="absolute -top-1 -right-1"
                @click="form.custom_style.btnFontColor = null"
              />
            </div>
            <ClientOnly>
              <QhxColorPicker @choose="(color: string) => form.custom_style.btnFontColor = color" ref="btnFontColorPickerRef" />
            </ClientOnly>
            <UButton 
              size="xs" 
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="showColorPicker('btnFontColor')"
            >
              选择字体颜色
            </UButton>
          </div>
        </UFormGroup>

        <!-- 字体颜色 -->
        <UFormGroup label="字体颜色">
          <div class="flex items-center gap-2 flex-wrap">
            <div v-if="form.custom_style.fontColor" class="relative inline-block">
              <div class="w-10 h-10 rounded border-2 border-gray-300" :style="{ background: form.custom_style.fontColor }"></div>
              <UButton 
                icon="i-heroicons-x-mark" 
                size="2xs" 
                color="red" 
                variant="soft"
                class="absolute -top-1 -right-1"
                @click="form.custom_style.fontColor = null"
              />
            </div>
            <ClientOnly>
              <QhxColorPicker @choose="(color: string) => form.custom_style.fontColor = color" ref="fontColorPickerRef" />
            </ClientOnly>
            <UButton 
              size="xs" 
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="showColorPicker('fontColor')"
            >
              选择字体颜色
            </UButton>
          </div>
        </UFormGroup>

        <!-- 背景颜色 -->
        <UFormGroup label="背景颜色">
          <div class="flex items-center gap-2 flex-wrap">
            <div v-if="form.custom_style.backColor" class="relative inline-block">
              <div class="w-10 h-10 rounded border-2 border-gray-300" :style="{ background: form.custom_style.backColor }"></div>
              <UButton 
                icon="i-heroicons-x-mark" 
                size="2xs" 
                color="red" 
                variant="soft"
                class="absolute -top-1 -right-1"
                @click="form.custom_style.backColor = null"
              />
            </div>
            <ClientOnly>
              <QhxColorPicker @choose="(color: string) => form.custom_style.backColor = color" ref="backColorPickerRef" />
            </ClientOnly>
            <UButton 
              size="xs" 
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="showColorPicker('backColor')"
            >
              选择背景颜色
            </UButton>
          </div>
        </UFormGroup>

        <!-- 背景透明度 -->
        <UFormGroup label="背景透明度">
          <div class="flex items-center gap-4">
            <input 
              type="range" 
              v-model.number="form.custom_style.back_opacity" 
              min="0" 
              max="1" 
              step="0.1"
              class="flex-1"
            />
            <span class="text-sm text-gray-600 w-12">{{ form.custom_style.back_opacity }}</span>
          </div>
        </UFormGroup>

        <!-- 排序类型 -->
        <UFormGroup label="排序类型">
          <USelect v-model="form.sort_type" :options="[
            { label: '自定义', value: 0 },
            { label: '购入倒叙', value: 1 },
            { label: '购入正序', value: 2 },
            { label: '价格倒叙', value: 3 },
            { label: '价格正序', value: 4 },
            { label: '穿着次数倒叙', value: 5 }
          ]" placeholder="请选择排序类型" class="flex-1 focus:ring-0" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
        </UFormGroup>

        <!-- 显示价格 -->
        <UFormGroup label="显示价格">
          <USelect v-model="form.show_price" :options="[
            { label: '显示总价', value: 1 },
            { label: '隐藏总价', value: 0 },
            { label: '隐藏所有', value: 2 }
          ]" placeholder="请选择价格显示模式" class="flex-1 focus:ring-0" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
        </UFormGroup>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="closeModel">取消</UButton>
          <UButton :loading="loading" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="insert">
            {{ type === 1 ? '确认修改' : '确认添加' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>


<script setup lang="ts">
import { insertWardrobe, updateWardrobe } from '@/api/wardrobe'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
import type { Wardrobe } from '@/types/api'
import { uploadImage } from '@/api'
import { useToast } from '#imports'
import { BASE_IMG } from '@/utils/ipConfig'

const show = ref<boolean>(false)
const emit = defineEmits(['success'])
const toast = useToast()
const wardrobe_id = ref<number | null>(null)
const type = ref<number>(0) // 0 添加 1 编辑
const loading = ref<boolean>(false)

// 图片选择器引用
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const wardrobeBackgroundRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

// 颜色选择器引用
const btnColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
const btnFontColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
const fontColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
const backColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)

// 表单数据
const form = ref<{
  wardrobe_name: string
  wardrobe_cover: string
  wardrobe_desc: string
  is_private: number
  sort_type: number
  show_price: number
  password: string
  background: string
  custom_style: {
    btnColor: string | null
    btnFontColor: string | null
    fontColor: string | null
    backColor: string | null
    back_mode: boolean
    back_opacity: number
  }
}>({
  wardrobe_name: '',
  wardrobe_cover: '',
  wardrobe_desc: '',
  is_private: 0,
  sort_type: 0,
  show_price: 1,
  password: '',
  background: '',
    custom_style: {
      btnColor: null,
      btnFontColor: null,
      fontColor: null,
      backColor: null,
      back_mode: false,
      back_opacity: 1
    }
})

// 显示模型
const showModel = (item: Wardrobe | null = null) => {
  if (item) {
    type.value = 1
    form.value.wardrobe_name = item.wardrobe_name || ''
    form.value.wardrobe_desc = item.wardrobe_desc || ''
    form.value.is_private = item.is_private ?? 0
    form.value.sort_type = item.sort_type ?? 0
    form.value.show_price = item.show_price ?? 1
    form.value.password = item.password || ''
    form.value.background = item.background || ''
    
    // 初始化自定义样式
    if (item.custom_style) {
      form.value.custom_style = {
      btnColor: item.custom_style.btnColor || null,
      btnFontColor: item.custom_style.btnFontColor || null,
      fontColor: item.custom_style.fontColor || null,
      backColor: item.custom_style.backColor || null,
        back_mode: item.custom_style.back_mode ?? false,
        back_opacity: item.custom_style.back_opacity ?? 1
      }
    }
    
    wardrobe_id.value = item.wardrobe_id || null
    
    // 设置封面图片预览
    nextTick(() => {
      if (item.wardrobe_cover && wardrobeCoverRef.value) {
        wardrobeCoverRef.value.previewImages = [{
          url: BASE_IMG + item.wardrobe_cover,
          file: undefined as unknown as File
        }]
      }
      // 设置背景图片预览
      if (item.background && wardrobeBackgroundRef.value) {
        wardrobeBackgroundRef.value.previewImages = [{
          url: BASE_IMG + item.background,
          file: undefined as unknown as File
        }]
      }
    })
  } else {
    type.value = 0
  }
  show.value = true
}

// 上传图片处理
const fetchUpload = async (file: { file?: File; url: string }) => {
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
    console.error(error)
    toast.add({
      title: '图片上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return ''
  }
}

// 封面图片更新
const onUpdateCoverFiles = (files: File[]) => {
  // 文件已通过 QhxImagePicker 处理
}

// 背景图片更新
const onUpdateBackgroundFiles = (files: File[]) => {
  // 文件已通过 QhxImagePicker 处理
}

// 显示颜色选择器
const showColorPicker = (type: 'btnColor' | 'btnFontColor' | 'fontColor' | 'backColor') => {
  switch (type) {
    case 'btnColor':
      btnColorPickerRef.value?.showModel()
      break
    case 'btnFontColor':
      btnFontColorPickerRef.value?.showModel()
      break
    case 'fontColor':
      fontColorPickerRef.value?.showModel()
      break
    case 'backColor':
      backColorPickerRef.value?.showModel()
      break
  }
}

// 提交表单
const insert = async () => {
  if (!form.value.wardrobe_name.trim()) {
    toast.add({
      title: '请输入衣柜名称',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  loading.value = true
  try {
    const params: Wardrobe = {
      wardrobe_name: form.value.wardrobe_name,
      wardrobe_desc: form.value.wardrobe_desc,
      is_private: form.value.is_private,
      sort_type: form.value.sort_type,
      show_price: form.value.show_price,
      custom_style: form.value.custom_style
    }

    // 处理密码
    if (form.value.password?.trim()) {
      params.password = form.value.password
    } else {
      params.password = undefined
    }

    // 处理封面图片
    if (wardrobeCoverRef.value?.previewImages.length) {
      const wardrobe_cover = await fetchUpload(wardrobeCoverRef.value.previewImages[0])
      if (wardrobe_cover) {
        params.wardrobe_cover = wardrobe_cover
      }
    } else {
      params.wardrobe_cover = undefined
    }

    // 处理背景图片
    if (wardrobeBackgroundRef.value?.previewImages.length) {
      const background = await fetchUpload(wardrobeBackgroundRef.value.previewImages[0])
      if (background) {
        params.background = background
      }
    } else {
      params.background = undefined
    }

    if (type.value === 0) {
      await insertWardrobe(params)
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success')
      closeModel()
    } else {
      if (!wardrobe_id.value) {
        toast.add({
          title: '衣柜ID不存在',
          icon: 'i-heroicons-exclamation-circle',
          color: 'red'
        })
        return
      }
      params.wardrobe_id = wardrobe_id.value
      await updateWardrobe(params)
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('success')
      closeModel()
    }
  } catch (error) {
    console.error('操作失败:', error)
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 关闭模型
const closeModel = () => {
  show.value = false
  initData()
}

// 初始化数据
const initData = () => {
  form.value = {
    wardrobe_name: '',
    wardrobe_cover: '',
    wardrobe_desc: '',
    is_private: 0,
    sort_type: 0,
    show_price: 1,
    password: '',
    background: '',
    custom_style: {
      btnColor: null,
      btnFontColor: null,
      fontColor: null,
      backColor: null,
      back_mode: false,
      back_opacity: 1
    }
  }
  wardrobe_id.value = null
  
  // 清空图片选择器
  nextTick(() => {
    if (wardrobeCoverRef.value) {
      wardrobeCoverRef.value.clear()
    }
    if (wardrobeBackgroundRef.value) {
      wardrobeBackgroundRef.value.clear()
    }
  })
}

defineExpose({
  showModel
})
</script>
