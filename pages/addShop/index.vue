<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
    <!-- 加载状态 -->
    <div v-if="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="text-white text-lg">加载中...</div>
    </div>

    <!-- 警告提示 -->
    <div class="container mx-auto px-4 max-w-4xl">
      <UAlert
        color="yellow"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        class="mb-6"
      >
        <template #title>
          注意！
        </template>
        <template #description>
          添加之前最好可以加群和我沟通一下基础规则QQ群号679654177，尽量使用已有词条
        </template>
      </UAlert>

      <!-- 权限检查 -->
      <div v-if="user && user.access_level >= (config?.min_add_library || 0)">
        <UForm ref="formRef" :state="form" class="space-y-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <!-- 店铺名字 -->
          <UFormGroup label="(必填)店铺名字" name="shop_name" required>
            <UInput
              v-model="form.shop_name"
              placeholder="请输入店铺名字"
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

          <!-- 店铺LOGO -->
          <UFormGroup label="(必填)店铺LOGO" name="shop_logo" required>
            <QhxImagePicker
              ref="logoImagePickerRef"
              :multiple="false"
              :max="1"
              @update:files="handleLogoFiles"
            />
          </UFormGroup>

          <!-- 淘宝地址 -->
          <UFormGroup label="淘宝地址" name="shop_url">
            <UInput
              v-model="form.shop_url"
              placeholder="淘宝电脑版的地址连接，如果是日牌，可以填官网地址"
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
            <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              淘宝电脑版的地址连接，如果是日牌，可以填官网地址
            </div>
          </UFormGroup>

          <!-- 微博名 -->
          <UFormGroup label="微博名" name="wb_name">
            <UInput
              v-model="form.wb_name"
              placeholder="请输入微博名"
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

          <!-- 微博地址 -->
          <UFormGroup label="微博地址" name="wb_url">
            <UInput
              v-model="form.wb_url"
              placeholder="请输入微博地址"
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

          <!-- 店铺描述 -->
          <UFormGroup label="店铺描述" name="shop_describe">
            <UTextarea
              v-model="form.shop_describe"
              placeholder="店铺简介，理念之类的，想写什么写什么"
              :rows="5"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-lg',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </UFormGroup>

          <!-- 所属国别 -->
          <UFormGroup label="所属国别" name="shop_country">
            <div class="flex flex-wrap items-center gap-2">
              <QhxTag v-if="form.shop_country" :active="true">
                {{ form.shop_country.label }}
                <UIcon
                  name="i-heroicons-x-mark"
                  class="ml-1 text-sm cursor-pointer"
                  @click="form.shop_country = null"
                />
              </QhxTag>
              <UButton
                color="primary"
                size="sm"
                variant="outline"
                @click="showShopCountrySelect = true"
              >
                选择国别
              </UButton>
            </div>
          </UFormGroup>

          <!-- 主营类型 -->
          <UFormGroup label="主营类型" name="shop_type">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <QhxTag
                v-for="(item, index) in form.shop_type"
                :key="index"
                :active="true"
              >
                {{ item.label }}
                <UIcon
                  name="i-heroicons-x-mark"
                  class="ml-1 text-sm cursor-pointer"
                  @click="deleteArr(form.shop_type, index)"
                />
              </QhxTag>
            </div>
            <UButton
              color="primary"
              size="sm"
              variant="outline"
              @click="showShopTypeSelect = true"
            >
              选择类型
            </UButton>
          </UFormGroup>

          <!-- 主营风格 -->
          <UFormGroup label="主营风格" name="shop_style">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <QhxTag
                v-for="(item, index) in form.shop_style"
                :key="index"
                :active="true"
              >
                {{ item.label }}
                <UIcon
                  name="i-heroicons-x-mark"
                  class="ml-1 text-sm cursor-pointer"
                  @click="deleteArr(form.shop_style, index)"
                />
              </QhxTag>
            </div>
            <UButton
              color="primary"
              size="sm"
              variant="outline"
              @click="showShopStyleSelect = true"
            >
              选择类型
            </UButton>
          </UFormGroup>

          <!-- 店铺状态 -->
          <UFormGroup label="店铺状态" name="shop_state">
            <div class="flex flex-wrap items-center gap-2">
              <QhxTag v-if="form.shop_state" :active="true">
                {{ form.shop_state.label }}
                <UIcon
                  name="i-heroicons-x-mark"
                  class="ml-1 text-sm cursor-pointer"
                  @click="form.shop_state = null"
                />
              </QhxTag>
              <UButton
                color="primary"
                size="sm"
                variant="outline"
                @click="showShopStateSelect = true"
              >
                选择状态
              </UButton>
            </div>
          </UFormGroup>

          <!-- 主体类型 -->
          <UFormGroup label="主体类型" name="main_type">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <QhxTag
                v-for="(item, index) in form.main_type"
                :key="index"
                :active="true"
              >
                {{ item.label }}
                <UIcon
                  name="i-heroicons-x-mark"
                  class="ml-1 text-sm cursor-pointer"
                  @click="deleteArr(form.main_type, index)"
                />
              </QhxTag>
            </div>
            <UButton
              color="primary"
              size="sm"
              variant="outline"
              @click="showMainTypeSelect = true"
            >
              选择类型
            </UButton>
          </UFormGroup>

          <!-- 提交按钮 -->
          <div class="flex justify-center pt-4">
            <UButton
              :color="shopId ? 'primary' : 'primary'"
              size="lg"
              :loading="submitting"
              @click="handleSubmit"
              class="w-full md:w-auto px-8"
            >
              {{ shopId ? '修改店铺' : '新增店铺' }}
            </UButton>
          </div>
        </UForm>
      </div>

      <!-- 无权限提示 -->
      <div v-else class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <UAlert
          color="yellow"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          class="mb-4"
        >
          <template #title>
            权限不足
          </template>
          <template #description>
            必须要正式会员才有新增店铺的权限。
          </template>
        </UAlert>
        <div class="flex justify-center">
          <NuxtLink to="/pages/user/invite/index">
            <UButton color="primary" variant="outline">
              成为正式居民
            </UButton>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 选择器弹窗 -->
    <!-- 所属国别选择 -->
    <UModal v-model="showShopCountrySelect">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">选择国别</h3>
        </template>
        <div class="space-y-2">
          <div
            v-for="item in option.shop_country"
            :key="item.value"
            class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            :class="{ 'bg-qhx-primary text-white': form.shop_country?.value === item.value }"
            @click="form.shop_country = item; showShopCountrySelect = false"
          >
            {{ item.label }}
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- 主营类型选择 -->
    <UModal v-model="showShopTypeSelect">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">选择主营类型</h3>
        </template>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
          <div
            v-for="item in option.shop_type"
            :key="item.value"
            class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            @click="confirmShopType(item)"
          >
            {{ item.label }}
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- 主营风格选择 -->
    <UModal v-model="showShopStyleSelect">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">选择主营风格</h3>
        </template>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
          <div
            v-for="item in option.shop_style"
            :key="item.value"
            class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            @click="confirmShopStyle(item)"
          >
            {{ item.label }}
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- 店铺状态选择 -->
    <UModal v-model="showShopStateSelect">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">选择店铺状态</h3>
        </template>
        <div class="space-y-2">
          <div
            v-for="item in option.shop_state"
            :key="item.value"
            class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            :class="{ 'bg-qhx-primary text-white': form.shop_state?.value === item.value }"
            @click="form.shop_state = item; showShopStateSelect = false"
          >
            {{ item.label }}
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- 主体类型选择 -->
    <UModal v-model="showMainTypeSelect">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">选择主体类型</h3>
        </template>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
          <div
            v-for="item in option.main_type"
            :key="item.value"
            class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            @click="confirmMainType(item)"
          >
            {{ item.label }}
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { getWikiOptionsByKeywords } from '@/api/wiki'
import { insertShop, getShopById, updateShop } from '@/api/shop'
import { uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'

definePageMeta({
  ssr: false
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const configStore = useConfigStore()

const user = computed(() => userStore.user)
const config = computed(() => configStore.config)

const loading = ref(false)
const submitting = ref(false)
const shopId = ref<number | null>(null)
const formRef = ref()
const logoImagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

// 表单数据
const form = reactive({
  shop_name: '',
  shop_url: '',
  wb_name: '',
  wb_url: '',
  shop_describe: '',
  shop_type: [] as Array<{ label: string; value: number }>,
  shop_style: [] as Array<{ label: string; value: number }>,
  shop_country: null as { label: string; value: number } | null,
  shop_state: null as { label: string; value: number } | null,
  main_type: [] as Array<{ label: string; value: number }>,
  shop_logo: '' as string
})

// 选项数据
const option = reactive({
  shop_type: [] as Array<{ label: string; value: number }>,
  shop_style: [] as Array<{ label: string; value: number }>,
  shop_country: [
    { label: '国牌', value: 0 },
    { label: '日牌', value: 1 },
    { label: '其他', value: 2 }
  ],
  shop_state: [
    { label: '经营中', value: 0 },
    { label: '闭店', value: 1 },
    { label: '永久闭店', value: 2 },
    { label: '仅作展示', value: 3 }
  ],
  main_type: [
    { label: '网店', value: 0 },
    { label: '实体店', value: 1 },
    { label: '手作店', value: 2 }
  ]
})

// 选择器显示状态
const showShopCountrySelect = ref(false)
const showShopTypeSelect = ref(false)
const showShopStyleSelect = ref(false)
const showShopStateSelect = ref(false)
const showMainTypeSelect = ref(false)


// 初始化选项数据
const initOptions = async () => {
  try {
    // 获取主营风格 (type_id: 4)
    const shopStyleRes = await getWikiOptionsByKeywords({ type_id: 4 })
    if (shopStyleRes && shopStyleRes.length > 0) {
      option.shop_style = shopStyleRes.map((item) => ({
        value: item.wiki_id as number,
        label: item.wiki_name
      }))
    }

    // 获取店铺类型 (type_id: 11)
    const shopTypeRes = await getWikiOptionsByKeywords({ type_id: 11 })
    if (shopTypeRes && shopTypeRes.length > 0) {
      option.shop_type = shopTypeRes.map((item) => ({
        value: item.wiki_id as number,
        label: item.wiki_name
      }))
    }

    // 从配置中获取国别选项
    if (config.value?.shop_country) {
      option.shop_country = config.value.shop_country.map((item) => ({
        label: item.label,
        value: item.value
      }))
    }
  } catch (error) {
    console.error('获取选项失败:', error)
  }
}

// 获取店铺详情
const fetchShopDetail = async (id: number) => {
  loading.value = true
  try {
    const res = await getShopById({ shop_id: id })
    form.shop_name = res.shop_name || ''
    form.shop_url = res.shop_url || ''
    form.shop_describe = res.shop_describe || ''
    form.shop_logo = res.shop_logo || ''

    // 设置LOGO预览
    if (res.shop_logo && logoImagePickerRef.value) {
      logoImagePickerRef.value.previewImages = [{
        id: 'existing',
        url: BASE_IMG + res.shop_logo
      }]
    }

    // 设置国别
    if (res.shop_country !== undefined) {
      const country = option.shop_country.find((item) => item.value === res.shop_country)
      if (country) {
        form.shop_country = country
      }
    }

    // 设置店铺状态
    if (res.shop_state !== undefined) {
      const state = option.shop_state.find((item) => item.value === res.shop_state)
      if (state) {
        form.shop_state = state
      }
    }

    // 设置主营类型
    if (res.type_list && res.type_list.length > 0) {
      form.shop_type = res.type_list.map((item) => ({
        value: item.wiki_id as number,
        label: item.wiki_name
      }))
    }

    // 设置主营风格
    if (res.style_list && res.style_list.length > 0) {
      form.shop_style = res.style_list.map((item) => ({
        value: item.wiki_id as number,
        label: item.wiki_name
      }))
    }

    // 设置主体类型
    if (res.main_type) {
      const mainTypeList = res.main_type.split(',').map((val) => {
        const type = option.main_type.find((item) => item.value === Number.parseInt(val))
        return type || { label: '', value: Number.parseInt(val) }
      }).filter((item) => item.label)
      form.main_type = mainTypeList
    }
  } catch (error) {
    console.error('获取店铺详情失败:', error)
    toast.add({
      title: '获取店铺详情失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// LOGO文件
const logoFiles = ref<File[]>([])

// 处理LOGO文件
const handleLogoFiles = (files: File[]) => {
  logoFiles.value = files
}

// 删除数组项
const deleteArr = (arr: Array<any>, index: number) => {
  arr.splice(index, 1)
}

// 确认选择主营类型
const confirmShopType = (value: { label: string; value: number }) => {
  const hasValue = form.shop_type.some((item) => item.value === value.value)
  if (!hasValue) {
    form.shop_type.push(value)
    showShopTypeSelect = false
  } else {
    toast.add({
      title: '重复添加',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
  }
}

// 确认选择主营风格
const confirmShopStyle = (value: { label: string; value: number }) => {
  const hasValue = form.shop_style.some((item) => item.value === value.value)
  if (!hasValue) {
    form.shop_style.push(value)
    showShopStyleSelect = false
  } else {
    toast.add({
      title: '重复添加',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
  }
}

// 确认选择主体类型
const confirmMainType = (value: { label: string; value: number }) => {
  const hasValue = form.main_type.some((item) => item.value === value.value)
  if (!hasValue) {
    form.main_type.push(value)
    showMainTypeSelect = false
  } else {
    toast.add({
      title: '重复添加',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!form.shop_name || form.shop_name.trim() === '') {
    toast.add({
      title: '店铺名不可为空',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  // 检查LOGO
  const logoPreviews = logoImagePickerRef.value?.previewImages || []
  const hasLogoFile = logoFiles.value.length > 0
  const hasLogoPreview = logoPreviews.length > 0 && logoPreviews[0].url
  const hasExistingLogo = form.shop_logo

  if (!hasLogoFile && !hasLogoPreview && !hasExistingLogo) {
    toast.add({
      title: '封面不可为空',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  submitting.value = true

  try {
    // 上传LOGO
    let shopLogo = form.shop_logo || ''
    if (logoFiles.value.length > 0) {
      const logoFile = logoFiles.value[0]
      const uploadResult = await uploadImageOSS({ file: logoFile })
      shopLogo = uploadResult
    } else if (hasLogoPreview) {
      // 如果是已有图片，提取路径
      const url = logoPreviews[0].url
      if (url.startsWith(BASE_IMG)) {
        shopLogo = url.replace(BASE_IMG, '')
      } else if (!url.startsWith('http')) {
        shopLogo = url
      }
    }

    // 准备提交数据
    const params: any = {
      shop_name: form.shop_name,
      user_id: user.value!.user_id,
      shop_url: form.shop_url || null,
      wb_name: form.wb_name || null,
      wb_url: form.wb_url || null,
      shop_describe: form.shop_describe || null,
      shop_type: form.shop_type.length > 0 ? form.shop_type.map((item) => item.value).join(',') : null,
      shop_style: form.shop_style.length > 0 ? form.shop_style.map((item) => item.value).join(',') : null,
      shop_country: form.shop_country ? form.shop_country.value : null,
      shop_state: form.shop_state ? form.shop_state.value : null,
      main_type: form.main_type.length > 0 ? form.main_type.map((item) => item.value).join(',') : null,
      shop_logo: shopLogo || null
    }

    if (shopId.value) {
      params.shop_id = shopId.value
      await updateShop(params)
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      await insertShop(params)
      toast.add({
        title: '新增成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      // 重置表单
      Object.assign(form, {
        shop_name: '',
        shop_url: '',
        wb_name: '',
        wb_url: '',
        shop_describe: '',
        shop_type: [],
        shop_style: [],
        shop_country: null,
        shop_state: null,
        main_type: [],
        shop_logo: ''
      })
      logoFiles.value = []
      if (logoImagePickerRef.value) {
        logoImagePickerRef.value.clear()
      }
    }

    // 延迟返回
    setTimeout(() => {
      router.back()
    }, 1000)
  } catch (error) {
    console.error('提交失败:', error)
    toast.add({
      title: '提交失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(async () => {
  await initOptions()

  // 检查是否有shop_id参数（编辑模式）
  const shopIdParam = route.query.shop_id
  if (shopIdParam && user.value && user.value.access_level > 0) {
    shopId.value = Number.parseInt(shopIdParam as string)
    await fetchShopDetail(shopId.value)
  }
})
</script>

