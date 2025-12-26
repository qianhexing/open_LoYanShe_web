<template>
  <div>
    <!-- 新增图鉴 -->
    <div class="head-seat"></div>
    <div class="add-library">
      <UForm ref="libraryForm" :state="library" :rules="rules" class="space-y-6">
        <UFormGroup label="图鉴名字" name="name" required>
          <UInput v-model="library.name" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" placeholder="请输入图鉴名" />
        </UFormGroup>

        <UFormGroup label="图鉴类型" name="library_type" required>
          <USelectMenu v-model="library.library_type" :options="library_type_options" placeholder="请选择图鉴类型" searchable
            :loading="loading" value-attribute="label" @search="getLibraryType" option-attribute="label" :ui="{
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

        <UFormGroup label="上级图鉴" name="parent_id" v-if="library.library_type !== '系列'">
          <div class="flex items-center gap-2">
            <QhxTag v-if="library.parent_id">
              {{ library.parent_id.name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.parent_id = undefined" />
            </QhxTag>
            <UButton color="primary" size="sm" @click="showSelectLibrary()">选择图鉴</UButton>
          </div>
        </UFormGroup>

        <UFormGroup label="售卖状态" name="state" required>
          <USelectMenu v-model="library.state" :options="config?.library_state" placeholder="请选择售卖状态" searchable
            class="w-1/2 min-w-[200px]" value-attribute="label" option-attribute="label" :ui="{
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
        <UFormGroup label="预约时间" name="start_time" v-if="library.state === '预约中'" required>
          <!-- <UInput
            v-model="library.start_time"
            type="text"
            placeholder="开始日期"
          /> -->
          <VueDatePicker v-model="library.start_time" :enable-time-picker="true" :range="true" format="MM/dd/yyyy" />
        </UFormGroup>

        <UFormGroup label="尾款时间" name="arrears_start" v-if="library.state === '尾款中'" required>
          <VueDatePicker v-model="library.arrears_start" :enable-time-picker="true" :range="true" format="MM/dd/yyyy" />
        </UFormGroup>
        <UFormGroup label="图鉴封面">
          <QhxImagePicker :multiple="false" ref="coverRef" />
        </UFormGroup>

        <UFormGroup label="所属店铺" name="shop_id" required>
          <div class="flex items-center">
            <USelectMenu v-model="library.shop_id" :loading="loading" :searchable="fetchShopOptiosns"
              placeholder="搜索店铺..." option-attribute="shop_name" :multiple="false" trailing by="shop_id"
              name="shop_name" class="flex-1" :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }" />
            <QhxJellyButton>
              <div
                class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                @click="library.shop_id = undefined">
                <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
              </div>
            </QhxJellyButton>
          </div>
        </UFormGroup>

        <UFormGroup label="主要风格" name="main_style" required>
          <div class="flex items-center m-1" v-if="library.main_style && library.main_style.length > 0">
            <QhxTag v-for="(item, index) in library.main_style" :key="item">
              {{main_style_options.find((child) => { return child.value === item })?.label}}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.main_style.splice(index, 1)" />
            </QhxTag>
          </div>
          <USelectMenu v-model="library.main_style" :options="main_style_options" placeholder="请选择主要风格" multiple
            class="w-1/2 min-w-[200px]" value-attribute="value" option-attribute="label" :ui="{
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

        <UFormGroup label="价格">
          <UInput v-model="library.library_price" type="number" placeholder="请输入价格" class="w-36" :ui="{
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

        <UFormGroup label="主题">
          <div class="flex items-center m-1" v-if="library.theme && library.theme.length > 0">
            <QhxTag v-for="(item, index) in library.theme" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.theme.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('theme')">选择主题</UButton>
        </UFormGroup>
        <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="chooseWiki" />
        <UFormGroup label="版型/部位">
          <div class="flex items-center m-1" v-if="library.library_pattern && library.library_pattern.length > 0">
            <QhxTag v-for="(item, index) in library.library_pattern" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.library_pattern.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('library_pattern')">选择版型/部位</UButton>
        </UFormGroup>

        <UFormGroup label="颜色">
          <div class="flex items-center m-1" v-if="library.color && library.color.length > 0">
            <QhxTag v-for="(item, index) in library.color" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.color.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('color')">选择颜色</UButton>
        </UFormGroup>

        <UFormGroup label="尺码表">
          <QhxImagePicker :multiple="true" ref="sizeImageRef" />
        </UFormGroup>

        <UFormGroup label="柄图元素">
          <div class="flex items-center m-1" v-if="library.pattern_elements && library.pattern_elements.length > 0">
            <QhxTag v-for="(item, index) in library.pattern_elements" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.pattern_elements.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('pattern_elements')">选择柄图元素</UButton>
        </UFormGroup>

        <UFormGroup label="设计元素">
          <div class="flex items-center m-1" v-if="library.design_elements && library.design_elements.length > 0">
            <QhxTag v-for="(item, index) in library.design_elements" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.design_elements.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('design_elements')">选择设计元素</UButton>
        </UFormGroup>

        <UFormGroup label="面料成分">
          <div class="flex flex-wrap gap-2 mb-2">
            <QhxTag v-for="(item, index) in library.fabric_composition" :key="index">
              {{ item.value + '%' + item.name.label }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.fabric_composition.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showComposition = true">选择成分</UButton>
        </UFormGroup>

        <UFormGroup label="布料/材质">
          <div class="flex items-center m-1" v-if="library.cloth_elements && library.cloth_elements.length > 0">
            <QhxTag v-for="(item, index) in library.cloth_elements" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.cloth_elements.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('cloth_elements')">选择布料/材质</UButton>
        </UFormGroup>

        <UFormGroup label="辅料">
          <div class="flex items-center m-1" v-if="library.secondary_cloth && library.secondary_cloth.length > 0">
            <QhxTag v-for="(item, index) in library.secondary_cloth" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.secondary_cloth.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton color="primary" size="sm" @click="showChooseWiki('secondary_cloth')">选择辅料</UButton>
        </UFormGroup>

        <UFormGroup label="笔记">
          <UTextarea v-model="library.notes" placeholder="笔记就是设计灵感,小故事什么的,想写什么写什么" :rows="3" :ui="{
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

        <UFormGroup label="贩售年份">
          <div class="w-1/2 min-w-[200px]">
            <VueDatePicker v-model="library.sale_time" :enable-time-picker="false" :range="false" format="MM/yyyy"
              MenuView="month" month-picker type="month" mode="month" :locale="zhCN" />
          </div>
        </UFormGroup>

        <UFormGroup label="适宜季节">
          <USelectMenu v-model="library.season" :options="season_options" placeholder="请选择季节" multiple
            class="w-1/2 min-w-[200px]" value-attribute="value" option-attribute="label" :ui="{
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

        <UFormGroup label="淘宝连接">
          <UInput v-model="library.link" placeholder="直连淘宝电脑版的连接" :ui="{
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

        <UFormGroup label="详情图片">
          <QhxImagePicker :multiple="true" ref="detailImageRef" />
        </UFormGroup>

        <UFormGroup label="质检报告" v-if="library.library_type === '系列'">
          <QhxImagePicker :multiple="true" ref="qualityImageRef" />
        </UFormGroup>

        <LibraryChoose ref="chooseLibraryRef" @choose="chooseLibrary"
          :filter_list="[{ field: 'library_type', value: '系列', op: 'and' }]" />

        <UModal v-model="showComposition" :ui="{ width: 'max-w-4xl' }">
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">添加成分</h3>
            </template>

            <UForm :state="fabric_composition" class="space-y-4">
              <UFormGroup label="面料成分">
                <USelectMenu v-model="fabric_composition.name" by="value" name="label" placeholder="请选择面料成分"
                  :searchable="getFabricComposition" :loading="loading" class="w-1/2 min-w-[200px]" :ui="{
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

              <UFormGroup label="面料占比">
                <div class="space-y-2">
                  <URange v-model="fabric_composition.value" :max="100" />
                  <div class="text-center">{{ fabric_composition.value }}</div>
                  <div class="text-sm text-gray-500 text-center">不知道含量的填0</div>
                </div>
              </UFormGroup>
            </UForm>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton @click="showComposition = false">取消</UButton>
                <UButton color="primary" @click="addFabricComposition()">确定</UButton>
              </div>
            </template>
          </UCard>
        </UModal>

        <div class="flex justify-center pt-6">
          <UButton v-if="!loading" color="primary" size="lg" @click="add()">
            {{ library_id ? '修改图鉴' : '上传图鉴' }}
          </UButton>
          <UButton v-else color="red" size="lg" disabled>请求中</UButton>
        </div>
      </UForm>
    </div>
    <!-- 操作确认 -->
    <UModal v-model="showConfirmLibrary" :ui="{ width: 'max-w-4xl' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">是否代入图鉴信息？</h3>
        </template>
        <div class="flex justify-end gap-2">
          <UButton @click="showConfirmLibrary = false">取消</UButton>
          <UButton color="primary" @click="copyLibraryInfo()">确定</UButton>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Library, Shop, Wiki } from '~/types/api'
// 导入API函数（需要您自己实现）
// import { getShopOptionsByKeywords } from '@/api/shop'
import { getWikiOptions, getWikiOptionsByKeywords } from '@/api/wiki'
import { insertLibrary, type InsertParams, getLibraryById, updateLibrary } from '@/api/library'
// updateLibrary, 
// import compressImage from '@/utils/compressImage'
// import uploadImage from '@/utils/uploadImage'
// import { formatDate } from '@/plugins/public'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { getShopOptiosns } from '@/api/shop'
import { zhCN } from "date-fns/locale"
import { uploadImageUrl } from '@/api'
import { uploadFileToOSS, uploadImageOSS } from '@/utils/ossUpload'
import dayjs from 'dayjs'
const showConfirmLibrary = ref(false)
// 定义组件
const LibraryChoose = defineAsyncComponent(() => import('~/components/library/LibraryChoose.vue'))

interface FileItem {
  file?: File
  url: string
  uid: number
}

interface FabricComposition {
  name: {
    label: string
    value: number
  }
  value: number
}

interface LibraryItem {
  library_id: number
  name: string
}

// 响应式数据
const fabric_composition = ref<FabricComposition>({
  name: {
    label: '',
    value: 0
  },
  value: 0
}) // 成分表格
interface OptionItem { value: number; label: string }
const showComposition = ref(false) // 显示选择布料
const library_id = ref<number | null>(null) // 初始化的图鉴ID用于修改
const loading = ref(false)
const shop_options = ref<Shop[]>([])
const library_type_options = ref<Wiki[]>([])
const fabric_composition_options = ref<Wiki[]>([])
const state_options = ['预约中', '现货在售', '完售展示', '上新图透']
const season_options = [{ value: '春', label: '春' }, { value: '夏', label: '夏' }, { value: '秋', label: '秋' }, { value: '冬', label: '冬' }]
const main_style_options = ref<OptionItem[]>([])
const pattern_elements_options = ref<Wiki[]>([])
const design_elements_options = ref<Wiki[]>([])
const cloth_elements_options = ref<Wiki[]>([])
const color_options = ref<Wiki[]>([])
const library_pattern_options = ref<Wiki[]>([])
const theme_options = ref<Wiki[]>([])
const fileList = ref<FileItem[]>([])
const cover = ref<FileItem[]>([])
const size_image = ref<FileItem[]>([])
const disabled = ref(false)
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const wikiOptionsChooseRef = ref()
const wiki_type = ref<string | null>(null)

const library = ref({
  name: '',
  shop_id: undefined as Shop | undefined,
  main_style: undefined as number[] | undefined,
  library_type: undefined as string | undefined,
  size: '',
  pattern_elements: [] as Wiki[],
  design_elements: [] as Wiki[],
  cloth_elements: [] as Wiki[],
  state: undefined as string | undefined,
  start_time: undefined as string[] | undefined,
  arrears_start: undefined as string | undefined,
  secondary_cloth: [] as Wiki[],
  sale_time: undefined as { year: number, month: number } | undefined,
  notes: '',
  season: undefined as string[] | undefined,
  library_price: undefined as number | undefined,
  color: [] as Wiki[],
  link: undefined as string | undefined,
  parent_id: undefined as Library | undefined,
  theme: [] as Wiki[],
  library_pattern: [] as Wiki[],
  fabric_composition: [] as FabricComposition[] // 成分
})

const rules = {
  name: [
    { required: true, message: '请输入图鉴名' }
  ],
  library_type: [
    { required: true, message: '请选择图鉴类型' }
  ],
  shop_id: [
    { required: true, message: '请选择店铺' }
  ],
  main_style: [
    { required: true, message: '请选择主要风格' }
  ],
  state: [
    { required: true, message: '请选择售卖状态' }
  ],
  start_time: [
    { required: true, message: '请选择预约时间' }
  ]
}

// 模板引用
const libraryForm = ref()
const chooseLibraryRef = ref()
const sizeImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const coverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const qualityImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

// 路由和toast
const route = useRoute()
const toast = useToast()

// 生命周期
onMounted(() => {
  if (route.query?.library_id) {
    library_id.value = Number.parseInt(route.query.library_id as string)
    fetchLibraryById()
  }

  getLibraryType()
  getMainStyle()
})
const showChooseWiki = (type: string) => {
  let type_id = 0
  wiki_type.value = type
  const params: { type_id: number } = { type_id: 0 }
  if (type === 'design_elements') {
    type_id = 2
  } else if (type === 'cloth_elements') {
    type_id = 5
  } else if (type === 'secondary_cloth') {
    type_id = 5
  } else if (type === 'theme') {
    type_id = 14
  } else if (type === 'library_pattern') {
    type_id = 1
    // console.log(option.library_type, this.form.library_type)
    // if (this.form.library_type && this.form.library_type !== '系列') {
    // 	const index = this.option.library_type.findIndex((child) => {
    // 		return child.label === this.form.library_type
    // 	})
    // 	if (index !== -1) {
    // 		params.parent_id = this.option.library_type[index].value
    // 	}
    // }
  } else if (type === 'color') {
    type_id = 13
  } else if (type === 'pattern_elements') {
    type_id = 3
  }
  params.type_id = type_id
  wikiOptionsChooseRef.value?.showModel(params)
}
const chooseWiki = (wiki_list: Wiki[]) => {
  // biome-ignore lint/complexity/noForEach: <explanation>
  wiki_list.forEach((item: Wiki) => {
    if (wiki_type.value === 'theme') {
      const index = library.value.theme.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.theme.push(item)
      }
    } else if (wiki_type.value === 'library_pattern') {
      const index = library.value.library_pattern.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.library_pattern.push(item)
      }
    } else if (wiki_type.value === 'color') {
      const index = library.value.color.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.color.push(item)
      }
    } else if (wiki_type.value === 'pattern_elements') {
      const index = library.value.pattern_elements.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.pattern_elements.push(item)
      }
    } else if (wiki_type.value === 'design_elements') {
      const index = library.value.design_elements.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.design_elements.push(item)
      }
    } else if (wiki_type.value === 'cloth_elements') {
      const index = library.value.cloth_elements.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.cloth_elements.push(item)
      }
    } else if (wiki_type.value === 'secondary_cloth') {
      const index = library.value.secondary_cloth.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.secondary_cloth.push(item)
      }
    }
  })
}
const shop_options_loading = ref(false)
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
    data = response
  }
  return data
}
// 方法定义
const removeFabricComposition = (index: number) => {
  library.value.fabric_composition.splice(index, 1)
}

const addFabricComposition = () => {
  const { name, value } = fabric_composition.value
  if (name.label === '') {
    return false
  }
  const index = library.value.fabric_composition.findIndex((item) => {
    return item.name.label === name.label
  })
  if (index === -1) {
    library.value.fabric_composition.push({
      name, value
    })
  }
  fabric_composition.value.name = {
    label: '',
    value: 0
  }
  fabric_composition.value.value = 0
  showComposition.value = false
}
const fetchLibraryById = async () => {
  if (!library_id.value) {
    return false
  }
  loading.value = true
  const params = {
    library_id: library_id.value
  }
  try {
    const res = await getLibraryById(params)
    console.log(res, '图鉴数据')
    const { theme, style_list, name, library_type, state, shop, parent, library_price, library_pattern, detail_image, color, size, pattern_elements, design_elements, cloth_elements, secondary_cloth, notes, sale_time, season, link, cover, end_time, start_time, size_image, fabric_composition, quality_test } = res
    library.value.name = name

    library.value.library_type = library_type
    library.value.state = state
    library.value.shop_id = shop
    if (style_list && style_list.length > 0) {
      library.value.main_style = style_list.map((item: Wiki) => Number(item.wiki_id))
    } else {
      library.value.main_style = []
    }
    if (theme) {
      library.value.theme = theme.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    library.value.parent_id = parent
    library.value.library_price = library_price
    if (library_pattern) {
      library.value.library_pattern = library_pattern.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (color) {
      library.value.color = color.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    library.value.size = size || ''
    if (pattern_elements) {
      library.value.pattern_elements = pattern_elements.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (design_elements) {
      library.value.design_elements = design_elements.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (cloth_elements) {
      library.value.cloth_elements = cloth_elements.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (secondary_cloth) {
      library.value.secondary_cloth = secondary_cloth.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    library.value.notes = notes || ''
    if (sale_time) {
      library.value.sale_time = {
        year: dayjs(sale_time).year(),
        month: dayjs(sale_time).month()
      }
    }
    if (season) {
      library.value.season = season.split(',')
    }
    library.value.link = link
    library.value.start_time = [start_time || '', end_time || '']
    console.log(library.value.start_time, '预约时间')
    if (fabric_composition) {
      library.value.fabric_composition = fabric_composition.split(',').map((item: string): FabricComposition => {
        const child = item.split('%')
        if (child.length > 1) {
          return {
            name: {
              label: child[1],
              value: Number(child[0])
            },
            value: Number(child[0])
          }
        }
        return {
          name: {
            label: '',
            value: 0
          },
          value: 0
        }
      })
    }

    if (cover && coverRef.value) {
      coverRef.value.previewImages = [{ file: undefined, url: BASE_IMG + cover }]
    }
    if (size_image && sizeImageRef.value) {
      sizeImageRef.value.previewImages = size_image.split(',').map((item: string) => {
        return { file: undefined, url: BASE_IMG + item }
      })
    }
    if (detail_image && detailImageRef.value) {
      detailImageRef.value.previewImages = detail_image.split(',').map((item: string) => {
        return { file: undefined, url: BASE_IMG + item }
      })
    }
    if (quality_test && qualityImageRef.value) {
      qualityImageRef.value.previewImages = quality_test.split(',').map((item: string) => {
        return { file: undefined, url: BASE_IMG + item }
      })
    }
  } catch (error) {
    console.log(error)
    toast.add({
      title: '错误',
      description: '获取图鉴失败5秒后重试',
      color: 'red'
    })
    setTimeout(() => {
      fetchLibraryById()
    }, 5000)
  } finally {
    loading.value = false
  }
}
const chooseLibrary = (item: Library[]) => {
  console.log('选择的图鉴', item)
  library.value.parent_id = item[0]
  showConfirmLibrary.value = true
}
const copyLibraryInfo = () => {
  console.log(library.value, '图鉴信息')
  if (!library.value.parent_id) {
    toast.add({
      title: '警告',
      description: '请选择图鉴',
      color: 'orange'
    })
    return false
  }
  const item: Library = library.value.parent_id
  showConfirmLibrary.value = false
  library.value.name = `${item.name} ${ library.value.library_type ? library.value.library_type : ''}`

  if (item.theme) {
    library.value.theme = item.theme.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.library_pattern) {
    library.value.library_pattern = item.library_pattern.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.color) {
    library.value.color = item.color.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.pattern_elements) {
    library.value.pattern_elements = item.pattern_elements.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.design_elements) {
    library.value.design_elements = item.design_elements.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.cloth_elements) {
    library.value.cloth_elements = item.cloth_elements.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.secondary_cloth) {
    library.value.secondary_cloth = item.secondary_cloth.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.sale_time) {
    library.value.sale_time = {
      year: dayjs(item.sale_time).year(),
      month: dayjs(item.sale_time).month()
    }
  }
  if (item.season) {
    library.value.season = item.season.split(',')
  }
  if (item.notes) {
    library.value.notes = item.notes
  }
  if (item.link) {
    library.value.link = item.link
  }
}
const showSelectLibrary = () => {
  chooseLibraryRef.value?.showModel()
}

const init = () => {
  coverRef.value?.clear()
  sizeImageRef.value?.clear()
  detailImageRef.value?.clear()
  qualityImageRef.value?.clear()
  library.value = {
    name: '',
    shop_id: undefined as Shop | undefined,
    main_style: undefined,
    library_type: undefined,
    size: '',
    pattern_elements: [],
    design_elements: [],
    cloth_elements: [],
    state: undefined,
    start_time: undefined as string[] | undefined,
    arrears_start: undefined,
    secondary_cloth: [],
    sale_time: undefined,
    notes: '',
    season: undefined,
    library_price: undefined,
    color: [],
    link: undefined,
    parent_id: undefined,
    theme: [],
    library_pattern: [],
    fabric_composition: []
  }
}
const getShopOptions = async (query: string) => {
  if (query !== '') {
    loading.value = true
    const params = {
      shop_name: query
    }
    try {
      // const results = await getShopOptionsByKeywords(params)
      // 这里需要您自己实现API调用
      // let data = results.data
      // if (data.length > 0) {
      //   data = data.map((value) => {
      //     return {
      //       value: value.shop_id,
      //       label: value.shop_name
      //     }
      //   })
      // }
      // shop_options.value = data
    } catch (error) {
      console.error('获取店铺选项失败:', error)
    } finally {
      loading.value = false
    }
  } else {
    shop_options.value = []
  }
}

// 获取主要风格
const getMainStyle = async () => {
  const params = {
    type_id: 4
  }
  try {
    const res = await getWikiOptionsByKeywords(params)
    const data = res
    if (data.length > 0) {
      main_style_options.value = data.map((value: Wiki) => {
        return {
          value: value.wiki_id,
          label: value.wiki_name
        }
      })
    }
  } catch (error) {
    console.error('获取主要风格失败:', error)
  }
}
const query = async (type_id: number, queryString: string) => {
  const params = {
    type_id,
    wiki_name: queryString
  }
  try {
    const results = await getWikiOptionsByKeywords(params)
    let data = results
    if (data.length > 0) {
      data = data.map((value: Wiki) => {
        return {
          value: value.wiki_id,
          label: value.wiki_name
        }
      })
    }
    return data
  } catch (error) {
    console.error('查询失败:', error)
    return []
  }
}

const getPatternElements = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(3, queryString)
  pattern_elements_options.value = options
}

const getLibraryPattern = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(1, queryString)
  library_pattern_options.value = options
}

const getColor = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(13, queryString)
  console.log('颜色选项', options)
  color_options.value = options
}

const getTheme = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(14, queryString)
  theme_options.value = options
}

const getFabricComposition = async (queryString: string) => {
  const options = await query(15, queryString)
  console.log('面料成分选项', options)
  fabric_composition_options.value = options
  return options
}

const getLibraryType = async (queryString?: string) => {
  const options = await query(10, queryString || '')
  library_type_options.value = options
}

const getDesignElements = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(2, queryString)
  design_elements_options.value = options
}

const getClothElements = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(5, queryString)
  cloth_elements_options.value = options
}


const handleExceed = () => {
  toast.add({
    title: '警告',
    description: '最多选18张图片',
    color: 'orange'
  })
}

const handleRemove = (file: FileItem) => {
  const index = fileList.value.findIndex((value) => {
    return file.uid === value.uid
  })
  if (index !== -1) {
    fileList.value.splice(index, 1)
  }
  console.log(fileList.value, index)
}


const sizeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files?.[0]) {
    const file = target.files[0]
    const url = URL.createObjectURL(file)
    size_image.value = [{
      file,
      url,
      uid: Date.now() + Math.random()
    }]
  }
}

const coverChange = (file: File[]) => {
  console.log(file)
  // if (file.length > 0) {
  //   const fileItem = file[0]
  //   const url = URL.createObjectURL(file)
  //   cover.value = [{
  //     file: fileItem,
  //     url,
  //     uid: Date.now() + Math.random()
  //   }]
  // }
}

const coverExceed = () => {
  toast.add({
    title: '警告',
    description: '最多选1张图片',
    color: 'orange'
  })
}

const sizeRemove = (file: FileItem) => {
  const index = size_image.value.findIndex((value) => {
    return file.uid === value.uid
  })
  if (index !== -1) {
    size_image.value.splice(index, 1)
  }
}

const coverRemove = (file: FileItem) => {
  const index = cover.value.findIndex((value) => {
    return file.uid === value.uid
  })
  if (index !== -1) {
    cover.value.splice(index, 1)
  }
  console.log(fileList.value, index)
}

/**
 * 上传所有图片（并行上传）
 * @returns 返回上传结果对象，包含 coverImage, square_cover, sizeImage, detail_image, quality_test
 */
const uploadAllImages = async () => {
  // 收集所有需要上传的图片
  const uploadTasks: Array<{
    type: 'cover' | 'size' | 'detail' | 'quality'
    index?: number
    image: { file?: File; url: string }
  }> = []

  // 封面图
  if (coverRef.value && coverRef.value.previewImages.length > 0) {
    uploadTasks.push({
      type: 'cover',
      image: coverRef.value.previewImages[0]
    })
  }

  // 尺寸图
  if (sizeImageRef.value && sizeImageRef.value.previewImages.length > 0) {
    sizeImageRef.value.previewImages.forEach((img, index) => {
      uploadTasks.push({
        type: 'size',
        index,
        image: img
      })
    })
  }

  // 详情图
  if (detailImageRef.value && detailImageRef.value.previewImages.length > 0) {
    detailImageRef.value.previewImages.forEach((img, index) => {
      uploadTasks.push({
        type: 'detail',
        index,
        image: img
      })
    })
  }

  // 质检图
  if (qualityImageRef.value && qualityImageRef.value.previewImages.length > 0) {
    qualityImageRef.value.previewImages.forEach((img, index) => {
      uploadTasks.push({
        type: 'quality',
        index,
        image: img
      })
    })
  }

  // 如果没有需要上传的图片，直接返回
  if (uploadTasks.length === 0) {
    return {
      coverImage: null,
      square_cover: null,
      sizeImage: [],
      detail_image: [],
      quality_test: []
    }
  }

  // 使用 Promise.allSettled 并行上传所有图片
  const uploadPromises = uploadTasks.map((task) =>
    uploadImageOSS(task.image).then((url) => ({
      type: task.type,
      index: task.index,
      url,
      success: true
    })).catch((error) => {
      console.error(`上传${task.type}图片失败:`, error)
      return {
        type: task.type,
        index: task.index,
        url: null,
        success: false
      }
    })
  )

  const results = await Promise.allSettled(uploadPromises)

  // 处理上传结果
  let coverImage: string | null = null
  let square_cover: string | null = null
  const sizeImageMap = new Map<number, string>()
  const detailImageMap = new Map<number, string>()
  const qualityTestMap = new Map<number, string>()

  results.forEach((result, idx) => {
    const task = uploadTasks[idx]
    if (result.status === 'fulfilled' && result.value.success && result.value.url) {
      const { type, index, url } = result.value

      switch (type) {
        case 'cover':
          coverImage = url
          square_cover = url
          break
        case 'size':
          if (index !== undefined) {
            sizeImageMap.set(index, url)
          }
          break
        case 'detail':
          if (index !== undefined) {
            detailImageMap.set(index, url)
          }
          break
        case 'quality':
          if (index !== undefined) {
            qualityTestMap.set(index, url)
          }
          break
      }
    }
  })

  // 将 Map 转换为有序数组（只包含成功上传的图片）
  const sizeImage = Array.from(sizeImageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url)
  const detail_image = Array.from(detailImageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url)
  const quality_test = Array.from(qualityTestMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url)

  return {
    coverImage,
    square_cover,
    sizeImage,
    detail_image,
    quality_test
  }
}

const add = async () => {
  try {
    const valid = await libraryForm.value?.validate()
    if (!valid) {
      toast.add({
        title: '警告',
        description: '表单填写不完整',
        color: 'orange'
      })
      return false
    }

    if (loading.value) {
      toast.add({
        title: '警告',
        description: '请求中，请稍后',
        color: 'orange'
      })
      return false
    }

    loading.value = true
    const {
      name,
      shop_id,
      main_style,
      library_type,
      size,
      color,
      pattern_elements,
      design_elements,
      cloth_elements,
      state,
      start_time,
      secondary_cloth,
      sale_time,
      notes,
      season,
      library_price,
      library_pattern,
      link,
      theme,
      parent_id,
      fabric_composition,
      arrears_start
    } = library.value
    console.log(start_time, '预约时间')
    
    // 并行上传所有图片
    const {
      coverImage,
      square_cover,
      sizeImage,
      detail_image,
      quality_test
    } = await uploadAllImages()

    const params: InsertParams = {
      name,
      shop_id: null,
      size,
      state,
      library_price,
      library_type,
      link
    }
    if (shop_id) {
      params.shop_id = shop_id.shop_id
    } else {
      params.shop_id = null
    }
    if (sale_time) {
      const year = sale_time.year
      const month = String(sale_time.month + 1).padStart(2, '0')
      params.sale_time = `${year}-${month}-01`
    } else {
      params.sale_time = null
    }
    // 添加可选参数
    if (coverImage) params.cover = coverImage
    if (sizeImage && sizeImage.length > 0) params.size_image = sizeImage.join(',')
    if (notes && notes !== '') {
      params.notes = notes
    } else {
      params.notes = null
    }
    if (theme && theme.length > 0) {
      params.theme = theme.map((item) => item.wiki_name).join(',')
    } else {
      params.theme = null
    }

    if (parent_id) {
      params.parent_id = parent_id.library_id
    } else {
      params.parent_id = null
    }
    if (square_cover) params.square_cover = square_cover
    if (detail_image && detail_image.length > 0) {
      params.detail_image = detail_image.join(',')
    } else {
      params.detail_image = null
    }
    if (quality_test && quality_test.length > 0) {
      params.quality_test = quality_test.join(',')
    } else {
      params.quality_test = null
    }
    if (cloth_elements && cloth_elements.length > 0) {
      params.cloth_elements = cloth_elements.map((item) => item.wiki_name).join(',')
    } else {
      params.cloth_elements = null
    }
    if (design_elements && design_elements.length > 0) {
      params.design_elements = design_elements.map((item) => item.wiki_name).join(',')
    } else {
      params.design_elements = null
    }
    if (fabric_composition && fabric_composition.length > 0) {
      params.fabric_composition = fabric_composition.map((item) =>
        item.value === 0 ? item.name.label : `${item.value}%${item.name.label}`
      ).join(',')
    } else {
      params.fabric_composition = null
    }
    if (color && color.length > 0) {
      params.color = color.map((item) => item.wiki_name).join(',')
    } else {
      params.color = null
    }
    if (main_style && main_style.length > 0) {
      params.main_style = main_style.join(',')
    } else {
      params.main_style = null
    }
    if (pattern_elements && pattern_elements.length > 0) {
      params.pattern_elements = pattern_elements.map((item) => item.wiki_name).join(',')
    } else {
      params.pattern_elements = null
    }
    if (season && season.length > 0) {
      params.season = season.join(',')
    } else {
      params.season = null
    }
    if (secondary_cloth && secondary_cloth.length > 0) {
      params.secondary_cloth = secondary_cloth.map((item) => item.wiki_name).join(',')
    } else {
      params.secondary_cloth = null
    }
    if (start_time) {
      if (start_time[0] !== '' && start_time[1] !== '') {
        params.start_time = start_time[0]
        params.end_time = start_time[1]
      } else {
        params.start_time = null
        params.end_time = null
      }
    }
    if (arrears_start) {
      if (arrears_start[0] !== '' && arrears_start[1] !== '') {
        params.arrears_start = arrears_start[0]
        params.arrears_end = arrears_start[1]
      } else {
        params.arrears_start = null
        params.arrears_end = null
      }
    }
    if (library_pattern && library_pattern.length > 0) {
      params.library_pattern = library_pattern.map((item) => item.wiki_name).join(',')
    } else {
      params.library_pattern = null
    }

    console.log(params, main_style, '最终参数')

    if (library_id.value !== null) {
      params.library_id = library_id.value
      await updateLibrary(params)
      toast.add({
        title: '成功',
        description: '修改成功',
        color: 'green'
      })
      await navigateTo(`/library/detail/${library_id.value}`)
    } else {
      const res = await insertLibrary(params)
      toast.add({
        title: '成功',
        description: '上传成功',
        color: 'green'
      })
      init()
    }
  } catch (error) {
    console.error('提交失败:', error)
    // toast.add({
    //   title: '错误',
    //   description: '提交失败，请重试',
    //   color: 'red'
    // })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.add-library {
  max-width: 1040px;
  padding: 20px;
  margin: 20px auto;
  background: #fff;
  box-shadow: 1px 1px 10px #ccc;
  border-radius: 4px;
}

.vue-datepicker {
  --vp-background-color: var(--qhx-bg);
  --vp-accent-color: var(--qhx-primary);
  --vp-text-color: var(--qhx-text);
}
</style>
