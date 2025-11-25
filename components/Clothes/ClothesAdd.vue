<script setup lang="ts">
import { ref } from 'vue'
import type { Library, Shop, Wardrobe } from '~/types/api'
import { getShopOptiosns } from '@/api/shop'
import { insertClothes, updateClothes } from '@/api/wardrobe'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
const LibraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import type QhxColorPicker from '@/components/Qhx/ColorPicker.vue'
const ColorPickerRef = ref<InstanceType<typeof QhxColorPicker> | null>(null)
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
import customInput from './customInput.vue'
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
import { uploadImage } from '@/api';

const emit = defineEmits(['success'])


const qhxSelectRef = ref<InstanceType<typeof QhxSelect>>()
const mainStyleRef = ref<InstanceType<typeof QhxSelect>>()
const clothesPartRef = ref<InstanceType<typeof QhxSelect>>()
const tagRef = ref<InstanceType<typeof customInput>>()
  
const openPicker = (e: MouseEvent) => {
    qhxSelectRef.value?.showPicker(e)
}
const openMainStyle = (e: MouseEvent) => {
  mainStyleRef.value?.showPicker(e)
}
const openClothesPart = (e: MouseEvent) => {
  clothesPartRef.value?.showPicker(e)
}
const openTag = (e: MouseEvent) => {
  tagRef.value?.showModel(e)
}

const wardrobe = ref<Wardrobe | null>(null) // 衣柜信息
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
console.log(wardrobeStore, '衣柜配置')
const wardrobe_status_options = ref<optionsInterface[]>([])
const main_style_options = ref<optionsInterface[]>([])
const clothes_part_options = ref<optionsInterface[]>([])
const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑

const form = ref({
  wardrobe_id: null,
  clothes_id: null,
  clothes_note: '',
  is_have: true,
  wardrobe_status: null,
  color: [] as string[],
  tags: [] as string[],
  price: 0,
  season: [] as any[],
  clothes_part: [] as optionsInterface[],
  note: '',
  sum_price: 1,
  origin: null,
  size: '',
  add_time: null,
  position: '',
  main_style: [] as optionsInterface[],
  plan_id: null,
  times: 0
})
const shop_options_loading = ref(false)
const shop_options = ref<Shop[]>([])
const origin_shop = ref()
const fetchShopOptiosns = async (keywords: string) => {
  const params: any = {}
  if (keywords !== '') {
    params.shop_name = keywords
  }
  shop_options_loading.value = true
  const response = await getShopOptiosns(params)
  shop_options.value = response
  let data = []
  if (response.length > 20) {
    data = response.slice(0, 19);
  } else {
    data =  response
  }
  return data
}
const showChooseLibrary = () => {
  if (LibraryChooseRef.value) {
    LibraryChooseRef.value.showModel()
  }
}
const showModel = (item) => {
  if (item?.wardrobe_id) {
    form.value.wardrobe_id = item?.wardrobe_id
  }
  if (item.type) {
    type.value = item.type
  }
  wardrobe.value = item
  show.value = true
  const config = configStore.config
  if (wardrobeStore.config) {
    wardrobe_status_options.value = wardrobeStore.config?.wardrobe_status.map((child) => {
      return {
        value: child,
        label: child
      }
    })
    clothes_part_options.value = wardrobeStore.config?.clothes_part.map((child) => {
      return {
        value: child,
        label: child
      }
    })
  }
  if (config) {
    main_style_options.value = config?.main_style.map((child) => {
      return {
        value: child.value,
        label: child.label
      }
    })
  }
}

const showColorPicker = () => {
  if (ColorPickerRef.value) {
    ColorPickerRef.value.showModel()
  }
}
const wardrobeName = ref('')
const library = ref<Library | null>(null)

const showControl = ref({
  color_choose: false,
  wardrobe_status: false,
  main_style: false,
  clothes_part: false,
  add_time: false,
  season: false,
  tags_custom: false,
})
const chooseLibrary = (list: Library[]) => {
  if (list.length > 0) {
    library.value = list[0]
  }
}
const chooseColor = (color: string) => {
  if (form.value.color.findIndex((child: string) => {
    return child === color
  }) === -1) {
    form.value.color.push(color)
  }
}
const closeModel = () => {
  show.value = false
  initData()
}
const initData = () => {
			form.value = {
				clothes_note: '',
				note: '',
				is_have: true,
				wardrobe_status: null,
				color: [],
				price: 0,
				season: [],
				clothes_part: [],
				sum_price: 1,
				origin: null,
				size: '',
				add_time: null,
				position: '',
				tags: [],
				main_style: [],
				plan_id: null,
        wardrobe_id: null,
        clothes_id: null,
        times: 0
			}
			// this.plan = null
			library.value = null
			wardrobe.value = null
		}
const fetchUpload = async (file: { file: { readonly lastModified: number; readonly name: string; readonly webkitRelativePath: string; readonly size: number; readonly type: string; arrayBuffer: { (): Promise<ArrayBuffer>; (): Promise<ArrayBuffer> }; bytes: { (): Promise<Uint8Array<ArrayBuffer>>; (): Promise<Uint8Array<ArrayBuffer>> }; slice: { (start?: number, end?: number, contentType?: string): Blob; (start?: number, end?: number, contentType?: string): Blob }; stream: { (): ReadableStream<Uint8Array<ArrayBuffer>>; (): ReadableStream<Uint8Array<ArrayBuffer>> }; text: { (): Promise<string>; (): Promise<string> } }; url: string }) => {
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
    throw error;
  }
}
const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  // uploadImage(file[0])
  //   .then(async (res) => {
  //     console.log('上传返回', res)
  //     if ( imageType.value === 0) {
  //       emit('addImage', res)

  //     } else {
  //       emit('addBackgroun', res)

  //     }
      
  //     if (imagePicker.value) {
  //       imagePicker.value.clear()
  //     }
  //   })
}
const insert = async () => {
  if (loading.value) {
    return
  }
  loading.value = true
  const { clothes_note, wardrobe_id, clothes_id, add_time, position, size, is_have, wardrobe_status, clothes_part, note, sum_price } = form.value
	let { color, season, price, times, tags, main_style, plan_id } = form.value
  const params: any = {
    wardrobe_id,
    wardrobe_status,
    sum_price
  }
  if (size !== '') {
    params.size = size
  } else {
    params.size = null
  }
  if (position !== '') {
    params.position = position
  } else {
    params.position = null
  }
  if (clothes_note !== '') {
    params.clothes_note = clothes_note
  } else {
    params.clothes_note = null
  }
  if (note !== '') {
    params.note = note
  } else {
    params.note = null
  }
  if (origin_shop.value) {
    if (origin_shop.value.shop_id) {
      params.origin = origin_shop.value.shop_id
    } else {
      params.origin = origin_shop.value.shop_name
    }
  } else {
    params.origin = null
  }
  if (clothes_part.length > 0) {
    params.clothes_part = clothes_part.join()
  } else {
    params.clothes_part = null
  }
  if (library.value) {
    params.library_id = library.value.library_id
  } else {
    params.library_id = null
  }

  if (color && color.length > 0) {
    params.color = color.join()
  } else {
    params.color = null
  }

  if (price && price !== '') {
    params.price = price
  } else {
    params.price = null
  }

  if (times && times !== '') {
    params.times = times
  } else {
    params.times = 0
  }
  if (tags && tags.length > 0) {
    params.tags = tags.join()
  } else {
    params.tags = null
  }

  if (main_style && main_style.length > 0) {
    params.main_style = main_style.map((child) => { return child.value }).join()
  } else {
    params.main_style = null
  }
  if (wardrobeCoverRef.value && wardrobeCoverRef.value.previewImages.length > 0) {
    console.log(wardrobeCoverRef.value.previewImages, '图片')
    try {
      const clothes_img = await fetchUpload(wardrobeCoverRef.value.previewImages[0])
      params.clothes_img = clothes_img
    } catch (error) {
      params.clothes_img = null
    }
  } else {
    params.clothes_img = null
  }

  if (detailImageRef.value && detailImageRef.value.previewImages.length > 0) {
    const detail_image = []
    for (let index = 0; index < detailImageRef.value.previewImages.length; index++) {
      const element = detailImageRef.value.previewImages[index];
      try {
        const url = await fetchUpload(element)
        detail_image.push(url)
      } catch (error) {
        
      }
    }
    params.detail_image = detail_image.join()
  } else {
    params.clothes_img = null
  }
  if (type.value === 0) {
      insertClothes(params)
        .then((res) => {
          emit('success')
          closeModel()
        })
        .finally(() => {
          loading.value = false
        })
    } else {
      params.clothes_id = clothes_id
      updateClothes(params)
        .then((res) => {
          emit('success')
          closeModel()
        })
        .finally(() => {
          loading.value = false
        })
    }


}

defineExpose({
  showModel
})
</script>

<template>
  <!-- Popup -->
  <UModal v-model="show" :ui="{ width: 'max-w-3xl'  }" prevent-close>
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            {{ type === 0 ? '新增服饰' : '编辑服饰' }}
          </h2>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="show = false"
          />
        </div>
      </template>

      <!-- 内容区域 -->
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-2">

        <!-- 衣柜名称 -->
        <div class="grid grid-cols-12 gap-4 items-center">
          <div class="col-span-3 font-medium">衣柜名称</div>
          <div class="col-span-9">{{ wardrobeName }}</div>
        </div>

        <!-- 关联图鉴 -->
        <UFormGroup label="关联图鉴">
          <div class="col-span-9 space-y-2">
            <QhxTag
              v-if="library"
              :active="true"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] bg-qhx-primary" @click="library = null">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ library.name }}</div>
              </div>
            </QhxTag>
            <p v-else class="text-xs text-gray-500">
              <UButton 
                type="submit" 
                size="xs"
                class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
                :loading="loading"
                @click="showChooseLibrary()"
                v-show="!library"
              >
                选择图鉴
              </UButton>
              <div class="mt-2">
                关联图鉴自动填入信息
              </div>
            </p>
          </div>
        </UFormGroup>

        <!-- 服饰图片 -->
        <UFormGroup label="服饰图片">
          <QhxImagePicker :multiple="false" @update:files="onUpdateFiles" ref="wardrobeCoverRef" />
        </UFormGroup>

        <!-- 名称 -->
        <UFormGroup label="名称">
          <UInput
              v-model="form.clothes_note"
              placeholder="名称(原笔记)"
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
        <UFormGroup label="来源">
          <div class="flex items-center">
            <USelectMenu
              v-model="origin_shop"
              :loading="loading"
              :searchable="fetchShopOptiosns"
              placeholder="搜索店铺..."
              option-attribute="shop_name"
              creatable
              :multiple="false"
              trailing
              by="shop_id"
              name="shop_name"
              class="flex-1"
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
            <QhxJellyButton>
              <div class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                @click="origin_shop = null">
                <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
              </div>
            </QhxJellyButton>
          </div>
        </UFormGroup>
        <!-- 价格 -->
        <UFormGroup label="价格">
          <UInput
              v-model="form.price"
              type="number"
              placeholder="价格"
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
        <UFormGroup label="尾款计划">
          
        </UFormGroup>
        <UFormGroup label="尺码">
          <UInput
            v-model="form.size"
            type="number"
            placeholder="价格"
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
        <!-- 计入总价 -->
        <UFormGroup label="计入总价">
          <URadioGroup v-model="form.sum_price"
            class=" ring-qhx-primary text-qhx-primary"
            :ui="{
              // 外层容器样式
              wrapper: 'p-2',
            }"
            :uiRadio="{
                wrapper: 'p-2',
                border: 'text-qhx-primary cursor-pointer',
                color: 'qhx-primary',
            }"
           :options="[
            { value: 1, label: '是' },
            { value: 0, label: '否' }
          ]" />
        </UFormGroup>

        <!-- 笔记 -->
        <UFormGroup label="笔记">
          <UTextarea 
            v-model="form.note" placeholder="笔记" :rows="3" 
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
        <UFormGroup label="穿着次数">
          <UInput
            v-model="form.times"
            type="number"
            placeholder="穿着次数"
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
        <!-- 收纳位置 -->
        <UFormGroup label="收纳位置">
          <UInput v-model="form.position"
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
           placeholder="收纳位置" />
        </UFormGroup>
        <!-- 颜色选择 -->
        <UFormGroup label="颜色">
          <div class="gap-2">
            <ClientOnly>
              <QhxColorPicker @choose="chooseColor" ref="ColorPickerRef"></QhxColorPicker>
            </ClientOnly>
            <div v-if="form.color.length > 0">
              <QhxTag
                v-for="(tag, index) in form.color"
                :style="{ background: tag }"
              >
                <div class="flex">
                  <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.color.splice(index, 1)">
                    <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                  </QhxJellyButton>
                  <div>{{ tag }}</div>
                </div>
              </QhxTag>
            </div>
            <UButton
              size="xs"
              color="primary"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
              @click="showColorPicker"
            >
              选择颜色
            </UButton>
          </div>
        </UFormGroup>
        <UFormGroup label="拥有状态">
          <div v-if="form.wardrobe_status">
            <QhxTag>
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.wardrobe_status = null">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ form.wardrobe_status }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openPicker(e) }"
          >
            选择状态
          </UButton>
          <QhxSelect 
            ref="qhxSelectRef"
            :options="wardrobe_status_options"
            :default-value="wardrobe_status_options[0]"
            :canCustomize="true"
            @select="(select) => { 
              form.wardrobe_status = select.label
             } "
          />
        </UFormGroup>
        <UFormGroup label="主要风格">
          <div v-if="form.main_style.length > 0">
            <QhxTag
              v-for="(tag, index) in form.main_style"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.main_style.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag.label }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openMainStyle(e) }"
          >
            选择风格
          </UButton>
          <QhxSelect 
            ref="mainStyleRef"
            :options="main_style_options"
            :default-value="main_style_options[0]"
            @select="(select) => { 
              if (form.main_style.findIndex((child) => { return select.label === child.label }) === -1) {
                form.main_style.push(select)
              }
             } "
          />
        </UFormGroup>
        <UFormGroup label="版型部位">
          <div v-if="form.clothes_part.length > 0">
            <QhxTag
              v-for="(tag, index) in form.clothes_part"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.clothes_part.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag.label }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openClothesPart(e) }"
          >
            选择版型
          </UButton>
          <QhxSelect 
            ref="clothesPartRef"
            :options="clothes_part_options"
            :default-value="clothes_part_options[0]"
            :canCustomize="true"
            @select="(select) => { 
              if (form.clothes_part.findIndex((child) => { return select.label === child.label }) === -1) {
                form.clothes_part.push(select)
              }
             } "
          />
        </UFormGroup>
        <UFormGroup label="自定义标签">
          <div>
            <QhxTag
              v-for="(tag, index) in form.tags"
            >
              <div class="flex">
                <QhxJellyButton class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary" @click="form.tags.splice(index, 1)">
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ tag }}</div>
              </div>
            </QhxTag>
          </div>
          <customInput @insert="(select) => { 
              if (form.tags.findIndex((child) => { return select === child }) === -1) {
                form.tags.push(select)
              }
             }" ref="tagRef"></customInput>
          <UButton 
            type="submit" 
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            :loading="loading"
            @click="(e: MouseEvent) => { openTag(e) }"
          >
            添加tag
          </UButton>
        </UFormGroup>
        <UFormGroup label="适宜季节">
          
        </UFormGroup>
        <UFormGroup label="购入时间">
          
        </UFormGroup>
        <UFormGroup label="详情图">
          <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" ref="detailImageRef" />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="show = false">取消</UButton>
          <UButton
            :loading="loading"
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="insert"
          >
            {{ type === 1 ? '确认修改' : '确认添加' }}
          </UButton>
        </div>
      </template>
    </UCard>
    <LibraryChoose ref="LibraryChooseRef" @choose="chooseLibrary"></LibraryChoose>
  </UModal>
</template>
