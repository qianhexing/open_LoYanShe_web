<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
    <!-- 加载状态 -->
    <div v-if="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="text-white text-lg">{{ t('addShop.loading') }}</div>
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
          {{ t('addShop.notice_title') }}
        </template>
        <template #description>
          {{ t('addShop.notice_desc') }}
        </template>
      </UAlert>

      <UAlert
        color="red"
        variant="soft"
        icon="i-heroicons-exclamation-circle"
        class="mb-6"
      >
        <template #title>
          {{ t('addShop.restrict_notice_title') }}
        </template>
        <template #description>
          {{ t('addShop.restrict_notice_desc') }}
        </template>
      </UAlert>

      <!-- 权限检查 -->
      <div v-if="user && user.access_level >= (config?.min_add_library || 0)">
        <UForm ref="formRef" :state="form" class="space-y-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <!-- 店铺名字 -->
          <UFormGroup :label="t('addShop.shop_name')" name="shop_name" required>
            <UInput
              v-model="form.shop_name"
              :placeholder="t('addShop.shop_name_placeholder')"
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
            <div v-if="shopNameMaybeExists && !shopId" class="mt-2 text-sm text-red-500">
              请注意该店名可能已经存在
            </div>
          </UFormGroup>

          <!-- 店铺LOGO -->
          <UFormGroup :label="t('addShop.shop_logo')" name="shop_logo" required>
            <QhxImagePicker
              ref="logoImagePickerRef"
              :multiple="false"
              :max="1"
              @update:files="handleLogoFiles"
            />
          </UFormGroup>

          <!-- 淘宝地址 -->
          <UFormGroup :label="t('addShop.taobao_url')" name="shop_url">
            <UInput
              v-model="form.shop_url"
              :placeholder="t('addShop.taobao_url_placeholder')"
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
              {{ t('addShop.taobao_url_placeholder') }}
            </div>
          </UFormGroup>

          <!-- 微博名 -->
          <UFormGroup :label="t('addShop.weibo_name')" name="wb_name">
            <UInput
              v-model="form.wb_name"
              :placeholder="t('addShop.weibo_name_placeholder')"
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
          <UFormGroup :label="t('addShop.weibo_url')" name="wb_url">
            <UInput
              v-model="form.wb_url"
              :placeholder="t('addShop.weibo_url_placeholder')"
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
          <UFormGroup :label="t('addShop.shop_describe')" name="shop_describe">
            <UTextarea
              v-model="form.shop_describe"
              :placeholder="t('addShop.shop_describe_placeholder')"
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
          <UFormGroup :label="t('addShop.shop_country')" name="shop_country">
            <div class="flex flex-wrap items-center gap-2">
              <QhxTag v-if="form.shop_country" :active="true">
                {{ shopCountryOptions.find(o => o.value === form.shop_country?.value)?.label ?? form.shop_country?.label }}
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
                {{ t('addShop.select_country') }}
              </UButton>
            </div>
          </UFormGroup>

          <!-- 主营类型 -->
          <UFormGroup :label="t('addShop.shop_type')" name="shop_type">
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
              {{ t('addShop.select_type') }}
            </UButton>
          </UFormGroup>

          <!-- 主营风格 -->
          <UFormGroup :label="t('addShop.shop_style')" name="shop_style">
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
              {{ t('addShop.select_type') }}
            </UButton>
          </UFormGroup>

          <!-- 店铺状态 -->
          <UFormGroup :label="t('addShop.shop_state')" name="shop_state">
            <div class="flex flex-wrap items-center gap-2">
              <QhxTag v-if="form.shop_state" :active="true">
                {{ shopStateOptions.find(o => o.value === form.shop_state?.value)?.label ?? form.shop_state?.label }}
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
                {{ t('addShop.select_state') }}
              </UButton>
            </div>
          </UFormGroup>

          <!-- 主体类型 -->
          <UFormGroup :label="t('addShop.main_type')" name="main_type">
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
              {{ t('addShop.select_type') }}
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
              {{ shopId ? t('addShop.update_shop') : t('addShop.add_shop') }}
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
            {{ t('addShop.no_permission') }}
          </template>
          <template #description>
            {{ t('addShop.no_permission_desc') }}
          </template>
        </UAlert>
        <div class="flex justify-center">
          <NuxtLink to="/pages/user/invite/index">
            <UButton color="primary" variant="outline">
              {{ t('addShop.become_member') }}
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
          <h3 class="text-lg font-semibold">{{ t('addShop.select_country_modal') }}</h3>
        </template>
        <div class="space-y-2">
          <div
            v-for="item in shopCountryOptions"
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
          <h3 class="text-lg font-semibold">{{ t('addShop.select_shop_type_modal') }}</h3>
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
          <h3 class="text-lg font-semibold">{{ t('addShop.select_shop_style_modal') }}</h3>
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
          <h3 class="text-lg font-semibold">{{ t('addShop.select_shop_state_modal') }}</h3>
        </template>
        <div class="space-y-2">
          <div
            v-for="item in shopStateOptions"
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
          <h3 class="text-lg font-semibold">{{ t('addShop.select_main_type_modal') }}</h3>
        </template>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
          <div
            v-for="item in mainTypeOptions"
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
import { insertShop, getShopById, updateShop, cheackShopName } from '@/api/shop'
import { uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'

definePageMeta({
  ssr: false
})

const { t } = useI18n()
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
  shop_style: [] as Array<{ label: string; value: number }>
})

// 多语言选项（随语言切换更新）
const shopCountryOptions = computed(() => {
  if (config.value?.shop_country?.length) {
    return config.value.shop_country.map((item: { label: string; value: number }) => ({
      label: item.label,
      value: item.value
    }))
  }
  return [
    { label: t('addShop.country_domestic'), value: 0 },
    { label: t('addShop.country_japanese'), value: 1 },
    { label: t('addShop.country_other'), value: 2 }
  ]
})

const shopStateOptions = computed(() => [
  { label: t('addShop.state_operating'), value: 0 },
  { label: t('addShop.state_closed'), value: 1 },
  { label: t('addShop.state_permanently_closed'), value: 2 },
  { label: t('addShop.state_display_only'), value: 3 }
])

const mainTypeOptions = computed(() => [
  { label: t('addShop.main_type_online'), value: 0 },
  { label: t('addShop.main_type_physical'), value: 1 },
  { label: t('addShop.main_type_handmade'), value: 2 }
])

// 选择器显示状态
const showShopCountrySelect = ref(false)
const showShopTypeSelect = ref(false)
const showShopStyleSelect = ref(false)
const showShopStateSelect = ref(false)
const showMainTypeSelect = ref(false)

// 店名是否可能已存在
const shopNameMaybeExists = ref(false)
const checkingShopName = ref(false)

// 检查店名是否已存在
watch(
  () => form.shop_name,
  async (shopName) => {
    if (!shopName || shopName.trim() === '' || shopId.value) {
      shopNameMaybeExists.value = false
      return
    }

    try {
      checkingShopName.value = true
      const exists = await cheackShopName({ shop_name: shopName.trim() })
      shopNameMaybeExists.value = exists
    } catch (error) {
      console.error('检查店名是否已存在失败:', error)
      shopNameMaybeExists.value = false
    } finally {
      checkingShopName.value = false
    }
  }
)

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

    // 国别选项从 shopCountryOptions 计算属性获取（支持 config 覆盖）
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
      const country = shopCountryOptions.value.find((item) => item.value === res.shop_country)
      if (country) {
        form.shop_country = country
      }
    }

    // 设置店铺状态
    if (res.shop_state !== undefined) {
      const state = shopStateOptions.value.find((item) => item.value === res.shop_state)
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
        const type = mainTypeOptions.value.find((item) => item.value === Number.parseInt(val))
        return type || { label: '', value: Number.parseInt(val) }
      }).filter((item) => item.label)
      form.main_type = mainTypeList
    }
  } catch (error) {
    console.error('获取店铺详情失败:', error)
    toast.add({
      title: t('addShop.fetch_failed'),
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
    showShopTypeSelect.value = false
  } else {
    toast.add({
      title: t('addShop.duplicate_add'),
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
    showShopStyleSelect.value = false
  } else {
    toast.add({
      title: t('addShop.duplicate_add'),
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
    showMainTypeSelect.value = false
  } else {
    toast.add({
      title: t('addShop.duplicate_add'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!form.shop_name || form.shop_name.trim() === '') {
    toast.add({
      title: t('addShop.shop_name_required'),
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
      title: t('addShop.cover_required'),
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
        title: t('addShop.update_success'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      await insertShop(params)
      toast.add({
        title: t('addShop.add_success'),
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
      title: t('addShop.submit_failed'),
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

