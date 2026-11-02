<script setup lang="ts">
import { uploadImage } from '@/api/index'
import { BASE_IMG } from '@/utils/ipConfig'
import type { User } from '@/types/api'
import type { default as QhxSelect } from '@/components/Qhx/Select.vue'
import EmailBindModal from '@/components/user/EmailBindModal.vue'
import RenameModal from '@/components/user/RenameModal.vue'
import { formatFormerNamesLabel } from '@/utils/userName'
// biome-ignore lint/style/useImportType: Vue SFC 组件供模板与 InstanceType 使用
import CommunityCustomStyleForm from '@/components/community/CommunityCustomStyleForm.vue'
import {
  createDefaultCommunityCustomStyle,
  hasCommunityCustomStyle,
  parseCommunityCustomStyle,
  serializeCommunityCustomStyle,
  type CommunityCustomStyle,
} from '@/utils/communityCustomStyle'

let uni: any
const port = computed(() => configStore.getPort())

interface AddressItem {
  value: string
  label: string
  children?: AddressItem[]
}

useHead({
  title: '编辑个人信息 - Lo研社'
})

const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()
const router = useRouter()

const user = ref<User | null>(null)
const config = computed(() => configStore.config)
const loading = ref(false)
const uploadingAvatar = ref(false)
const showAddressPicker = ref(false)
const showEmailModal = ref(false)
const showRenameModal = ref(false)
const addressClickPosition = ref({ x: 0, y: 0 })
const avatarInput = ref<HTMLInputElement | null>(null)

const formerNamesLabel = computed(() =>
  formatFormerNamesLabel(user.value?.former_name)
)

const styleSelectRef = ref<InstanceType<typeof QhxSelect>>()
const provinceSelectRef = ref<InstanceType<typeof QhxSelect>>()
const citySelectRef = ref<InstanceType<typeof QhxSelect>>()
const areaSelectRef = ref<InstanceType<typeof QhxSelect>>()
const customStyleFormRef = ref<InstanceType<typeof CommunityCustomStyleForm> | null>(null)
const customStyle = ref<CommunityCustomStyle>(createDefaultCommunityCustomStyle())

const addressData = ref<AddressItem[]>([])
const selectedProvince = ref<{ label: string; value: string } | null>(null)
const selectedCity = ref<{ label: string; value: string } | null>(null)
const selectedArea = ref<{ label: string; value: string } | null>(null)

const formData = reactive({
  signature: '',
  main_style: [] as Array<{ label: string; value: number }>,
  province: '',
  city: '',
  area: '',
  show_area: false,
  is_achieve: false,
  user_face: '',
  email_notice: false,
  daily_news_subscribe: false
})

const provinceOptions = computed(() => {
  return addressData.value.map(item => ({
    label: item.label,
    value: item.value
  }))
})

const cityOptions = computed(() => {
  if (!selectedProvince.value) return []
  const province = addressData.value.find(p => p.value === selectedProvince.value?.value)
  if (!province?.children) return []
  return province.children.map((item: AddressItem) => ({
    label: item.label,
    value: item.value
  }))
})

const areaOptions = computed(() => {
  if (!selectedCity.value || !selectedProvince.value) return []
  const province = addressData.value.find(p => p.value === selectedProvince.value?.value)
  if (!province?.children) return []
  const city = province.children.find((c: AddressItem) => c.value === selectedCity.value?.value)
  if (!city?.children) return []
  return city.children.map((item: AddressItem) => ({
    label: item.label,
    value: item.value
  }))
})

const styleOptions = computed(() => {
  return config.value?.main_style || []
})

const addressLabel = computed(() => {
  if (!formData.province) return ''
  return `${formData.province} ${formData.city} ${formData.area}`.trim()
})

function parseMessageConfig(
  raw: string | Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return raw
}

async function fetchCustomStyleUpload(file: { file?: File; url: string }) {
  try {
    if (file.file) {
      const res = await uploadImage(file.file)
      return res.file_url.replace(BASE_IMG, '')
    }
    return file.url.replace(BASE_IMG, '')
  } catch (error) {
    console.error(error)
    toast.add({
      title: '背景图上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return null
  }
}

const fetchUserInfo = async () => {
  try {
    const data = await userStore.fetchUserInfo()
    user.value = data

    const userData = data as User & {
      signature?: string
      main_style?: Array<{ label: string; value: number }>
      province?: string
      city?: string
      area?: string
      show_area?: number | boolean
      is_achieve?: number | boolean
      message_config?: Record<string, unknown> | undefined
    }

    formData.signature = userData.signature || ''
    formData.main_style = userData.main_style || []
    formData.province = userData.province || ''
    formData.city = userData.city || ''
    formData.area = userData.area || ''
    formData.show_area = userData.show_area === 1 || userData.show_area === true
    formData.is_achieve = userData.is_achieve === 1 || userData.is_achieve === true
    formData.user_face = data.user_face || ''

    const messageConfig = parseMessageConfig(userData.message_config)
    formData.email_notice = messageConfig.email_notice === true
    formData.daily_news_subscribe = messageConfig.daily_news_subscribe === true
    customStyle.value = parseCommunityCustomStyle(
      messageConfig.custom_style as Record<string, unknown> | string | null | undefined
    )
  } catch (error) {
    toast.add({
      title: '获取用户信息失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  uploadingAvatar.value = true

  try {
    const result = await uploadImage(file)
    formData.user_face = result.file_url.replace(BASE_IMG, '')
    if (user.value) {
      user.value.user_face = formData.user_face
    }

    toast.add({
      title: '头像上传成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '头像上传失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    uploadingAvatar.value = false
    if (input) input.value = ''
  }
}

const deleteStyle = (index: number) => {
  formData.main_style.splice(index, 1)
}

const openStylePicker = (e: MouseEvent) => {
  styleSelectRef.value?.showPicker(e)
}

const confirmMainStyle = (value: { label: string; value: number | string }) => {
  if (!value) return

  const style = styleOptions.value.find((s) => s.value === value.value)
  if (!style) return

  const hasValue = formData.main_style.some((s) => s.value === style.value)
  if (!hasValue) {
    formData.main_style.push(style)
  } else {
    toast.add({
      title: '重复添加',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
  }
}

const openAddressPicker = (e?: MouseEvent) => {
  if (e) {
    addressClickPosition.value = { x: e.clientX, y: e.clientY }
  }

  if (formData.province && formData.city && formData.area) {
    const province = addressData.value.find(p => p.label === formData.province)
    if (province) {
      selectedProvince.value = { label: province.label, value: province.value }
      const city = province.children?.find((c: AddressItem) => c.label === formData.city)
      if (city) {
        selectedCity.value = { label: city.label, value: city.value }
        const area = city.children?.find((a: AddressItem) => a.label === formData.area)
        if (area) {
          selectedArea.value = { label: area.label, value: area.value }
        }
      }
    }
  } else {
    selectedProvince.value = null
    selectedCity.value = null
    selectedArea.value = null
  }
  showAddressPicker.value = true
}

const openProvincePicker = (e: MouseEvent) => {
  provinceSelectRef.value?.showPicker(e)
}

const openCityPicker = (e: MouseEvent) => {
  citySelectRef.value?.showPicker(e)
}

const openAreaPicker = (e: MouseEvent) => {
  areaSelectRef.value?.showPicker(e)
}

const onProvinceSelect = (value: { label: string; value: string | number }) => {
  selectedProvince.value = { label: value.label, value: String(value.value) }
  selectedCity.value = null
  selectedArea.value = null
}

const onCitySelect = (value: { label: string; value: string | number }) => {
  selectedCity.value = { label: value.label, value: String(value.value) }
  selectedArea.value = null
}

const onAreaSelect = (value: { label: string; value: string | number }) => {
  selectedArea.value = { label: value.label, value: String(value.value) }
}

const deleteArea = () => {
  formData.province = ''
  formData.city = ''
  formData.area = ''
  selectedProvince.value = null
  selectedCity.value = null
  selectedArea.value = null
}

const confirmAddress = () => {
  if (!selectedProvince.value || !selectedCity.value || !selectedArea.value) {
    toast.add({
      title: '请完整选择地址',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }

  formData.province = selectedProvince.value.label
  formData.city = selectedCity.value.label
  formData.area = selectedArea.value.label
  showAddressPicker.value = false
}

const toggleEmailNotice = () => {
  if (loading.value) return
  formData.email_notice = !formData.email_notice
  updateMessageConfig()
}

const toggleDailyNewsSubscribe = () => {
  if (loading.value) return
  formData.daily_news_subscribe = !formData.daily_news_subscribe
  updateMessageConfig()
}

const updateMessageConfig = async () => {
  if (loading.value) return

  loading.value = true

  try {
    const messageConfig = parseMessageConfig(
      (user.value as User & { message_config?: string | Record<string, unknown> })?.message_config
    )
    messageConfig.email_notice = formData.email_notice
    messageConfig.daily_news_subscribe = formData.daily_news_subscribe

    await userStore.updateUserInfo({
      message_config: messageConfig
    })

    user.value = userStore.user

    if (user.value?.message_config && typeof user.value.message_config === 'object') {
      formData.email_notice = user.value.message_config.email_notice as boolean || false
      formData.daily_news_subscribe = user.value.message_config.daily_news_subscribe as boolean || false
    }

    toast.add({
      title: '设置已更新',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    formData.email_notice = !formData.email_notice
    formData.daily_news_subscribe = !formData.daily_news_subscribe
    toast.add({
      title: '更新失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

const saveUserInfo = async () => {
  if (loading.value) {
    toast.add({
      title: '请求中请稍候',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }

  loading.value = true

  try {
    const params: User = {
      signature: formData.signature,
      province: formData.province || null,
      city: formData.city || null,
      area: formData.area || null,
      show_area: formData.show_area ? 1 : 0,
      is_achieve: formData.is_achieve ? 1 : 0,
    }

    if (formData.main_style && formData.main_style.length > 0) {
      params.main_style = formData.main_style.map((s) => s.value).join(',')
    } else {
      params.main_style = null
    }

    if (formData.user_face) {
      params.user_face = formData.user_face
    }

    const stylePayload = { ...customStyle.value }
    const bgPicker = customStyleFormRef.value?.getBackgroundPicker()
    if (bgPicker?.previewImages.length) {
      const bgImg = bgPicker.previewImages[0]
      if (bgImg && typeof bgImg === 'object' && 'url' in bgImg) {
        const background = await fetchCustomStyleUpload(bgImg as { file?: File; url: string })
        if (background === null) {
          loading.value = false
          return
        }
        stylePayload.background = background
      }
    } else {
      stylePayload.background = null
    }

    try {
      const messageConfig = parseMessageConfig(
        (user.value as User & { message_config?: string | Record<string, unknown> })?.message_config
      )
      messageConfig.email_notice = formData.email_notice
      messageConfig.daily_news_subscribe = formData.daily_news_subscribe
      messageConfig.custom_style = hasCommunityCustomStyle(stylePayload)
        ? serializeCommunityCustomStyle(stylePayload)
        : null
      params.message_config = messageConfig
    } catch (error) {
      console.error('更新 message_config 失败:', error)
    }

    await userStore.updateUserInfo(params)
    user.value = userStore.user

    toast.add({
      title: '保存成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus')

    if (isInUniApp && typeof uni !== 'undefined' && typeof uni.postMessage === 'function') {
      uni.postMessage({
        data: {
          type: 'updateUserInfo',
          navigateBack: true
        }
      })
    } else if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'back',
        params: { reload: true }
      }))
    } else {
      router.back()
    }
  } catch (error) {
    toast.add({
      title: '保存失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

const handleEmailBindSuccess = async () => {
  await fetchUserInfo()
}

const handleRenameSuccess = async () => {
  await fetchUserInfo()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybeObj = error as Record<string, unknown>
    if (typeof maybeObj.message === 'string') return maybeObj.message
  }
  return ''
}

const loadAddressData = async () => {
  try {
    const response = await fetch('/address.json')
    addressData.value = await response.json()
  } catch (error) {
    console.error('加载地址数据失败:', error)
    toast.add({
      title: '加载地址数据失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })
  await configStore.getConfig()
  await loadAddressData()
  await fetchUserInfo()
})
</script>

<template>
  <div
    v-if="user && config"
    class="min-h-screen bg-gradient-to-b from-pink-50/80 via-gray-50 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 pb-24 md:pb-10"
  >
    <div class="max-w-2xl mx-auto px-4 pt-5 md:pt-8">
      <!-- 头部 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          编辑个人信息
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          完善资料，让个人空间更有辨识度
        </p>
      </div>

      <!-- 基本信息 -->
      <section class="edit-section mb-4">
        <div class="edit-section__header">
          <span class="edit-section__dot" />
          <h2 class="edit-section__title">基本信息</h2>
        </div>

        <!-- 头像 -->
        <div class="mb-6">
          <label class="edit-label">头像</label>
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="relative group shrink-0"
              :disabled="uploadingAvatar"
              aria-label="更换头像"
              @click="triggerAvatarUpload"
            >
              <div class="relative h-20 w-20">
                <img
                  :src="user.user_face ? `${BASE_IMG}${user.user_face}` : '/default-avatar.png'"
                  :alt="user.user_name || '用户头像'"
                  class="h-20 w-20 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-md ring-2 ring-pink-100 dark:ring-pink-900/40"
                >
                <div
                  v-if="user.avatar?.avatar_frame"
                  class="pointer-events-none absolute inset-0 z-10 rounded-full"
                  :style="{
                    backgroundImage: `url(${BASE_IMG}${user.avatar.avatar_frame})`,
                    backgroundSize: '110%',
                    backgroundPosition: 'center',
                  }"
                />
                <div
                  class="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Icon
                    v-if="!uploadingAvatar"
                    name="i-heroicons-camera"
                    class="h-6 w-6 text-white"
                  />
                  <Icon
                    v-else
                    name="i-heroicons-arrow-path"
                    class="h-6 w-6 animate-spin text-white"
                  />
                </div>
              </div>
            </button>
            <div class="min-w-0 flex-1">
              <QhxJellyButton>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-full border border-qhx-primary/40 bg-white px-4 py-2 text-sm font-medium text-qhx-primary transition-colors hover:bg-qhx-primary/5 disabled:opacity-50 dark:bg-gray-800"
                  :disabled="uploadingAvatar"
                  @click="triggerAvatarUpload"
                >
                  <Icon name="i-heroicons-photo" class="h-4 w-4" />
                  {{ uploadingAvatar ? '上传中…' : '更换头像' }}
                </button>
              </QhxJellyButton>
              <p class="mt-1.5 text-xs text-gray-400">
                支持常见图片格式
              </p>
            </div>
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarChange"
            >
          </div>
        </div>

        <!-- 用户名 -->
        <div class="mb-5">
          <label class="edit-label">用户名</label>
          <div class="flex items-center gap-2">
            <input
              :value="user.user_name"
              type="text"
              disabled
              class="edit-input flex-1 disabled:cursor-not-allowed disabled:opacity-70"
            >
            <QhxJellyButton>
              <button
                type="button"
                class="shrink-0 rounded-full border border-qhx-primary/40 bg-white px-3.5 py-2 text-sm font-medium text-qhx-primary transition-colors hover:bg-qhx-primary/5 dark:bg-gray-800"
                @click="showRenameModal = true"
              >
                改名
              </button>
            </QhxJellyButton>
          </div>
          <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            改名消耗 100 经验；昵称唯一，1–6 字，不可含特殊字符
          </p>
          <p
            v-if="formerNamesLabel"
            class="mt-1 text-xs text-gray-400 dark:text-gray-500"
          >
            {{ formerNamesLabel }}
          </p>
        </div>

        <!-- 个人签名 -->
        <div class="mb-5">
          <label class="edit-label">个人签名</label>
          <textarea
            v-model="formData.signature"
            placeholder="介绍一下自己"
            rows="4"
            class="edit-textarea"
          />
        </div>

        <!-- 邮箱 -->
        <div>
          <label class="edit-label">邮箱</label>
          <div class="flex items-center gap-2">
            <input
              :value="user.email || '未绑定'"
              type="text"
              disabled
              class="edit-input flex-1 disabled:cursor-not-allowed disabled:opacity-70"
            >
            <QhxJellyButton>
              <button
                type="button"
                class="shrink-0 rounded-full border border-qhx-primary/40 bg-white px-3.5 py-2 text-sm font-medium text-qhx-primary transition-colors hover:bg-qhx-primary/5 dark:bg-gray-800"
                @click="showEmailModal = true"
              >
                {{ user.email ? '换绑邮箱' : '绑定邮箱' }}
              </button>
            </QhxJellyButton>
          </div>

          <div
            v-if="user.email"
            class="mt-3 space-y-3 rounded-2xl border border-pink-100/80 bg-pink-50/40 p-3.5 dark:border-pink-900/30 dark:bg-pink-950/20"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  邮件通知
                </div>
                <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  开启后，系统将通过邮件发送重要通知
                </div>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="formData.email_notice"
                :disabled="loading"
                class="edit-switch"
                :class="formData.email_notice ? 'bg-qhx-primary' : 'bg-gray-300 dark:bg-gray-600'"
                @click="toggleEmailNotice"
              >
                <span
                  class="edit-switch__thumb"
                  :class="formData.email_notice ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>

            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  订阅上新资讯
                </div>
                <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  开启后，系统将通过邮件发送上新资讯通知
                </div>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="formData.daily_news_subscribe"
                :disabled="loading"
                class="edit-switch"
                :class="formData.daily_news_subscribe ? 'bg-qhx-primary' : 'bg-gray-300 dark:bg-gray-600'"
                @click="toggleDailyNewsSubscribe"
              >
                <span
                  class="edit-switch__thumb"
                  :class="formData.daily_news_subscribe ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>
          </div>

          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            如果收不到邮件，请将 noreply@chaozj.com 添加至白名单
          </p>
        </div>
      </section>

      <!-- 风格标签 -->
      <section class="edit-section mb-4">
        <div class="edit-section__header">
          <span class="edit-section__dot" />
          <h2 class="edit-section__title">风格标签</h2>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <QhxTag
            v-for="(style, index) in formData.main_style"
            :key="index"
            :active="true"
          >
            <div class="flex items-center gap-1">
              <span># {{ style.label }}</span>
              <button
                type="button"
                class="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-white/20"
                aria-label="删除风格"
                @click="deleteStyle(index)"
              >
                <Icon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
              </button>
            </div>
          </QhxTag>
          <QhxJellyButton>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-dashed border-qhx-primary/50 bg-white px-3 py-1.5 text-xs font-medium text-qhx-primary transition-colors hover:bg-qhx-primary/5 dark:bg-gray-800"
              @click="openStylePicker"
            >
              <Icon name="i-heroicons-plus" class="h-3.5 w-3.5" />
              选择风格
            </button>
          </QhxJellyButton>
        </div>
      </section>

      <!-- 所在城市 -->
      <section class="edit-section mb-4">
        <div class="edit-section__header">
          <span class="edit-section__dot" />
          <h2 class="edit-section__title">所在城市</h2>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <QhxTag
            v-if="addressLabel"
            :active="true"
          >
            <div class="flex items-center gap-1">
              <Icon name="i-heroicons-map-pin" class="h-3.5 w-3.5" />
              <span>{{ addressLabel }}</span>
              <button
                type="button"
                class="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-white/20"
                aria-label="清除地址"
                @click="deleteArea"
              >
                <Icon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
              </button>
            </div>
          </QhxTag>
          <QhxJellyButton>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-dashed border-qhx-primary/50 bg-white px-3 py-1.5 text-xs font-medium text-qhx-primary transition-colors hover:bg-qhx-primary/5 dark:bg-gray-800"
              @click="openAddressPicker"
            >
              <Icon name="i-heroicons-plus" class="h-3.5 w-3.5" />
              选择地址
            </button>
          </QhxJellyButton>
        </div>
      </section>

      <!-- 显示设置 -->
      <section class="edit-section mb-4">
        <div class="edit-section__header">
          <span class="edit-section__dot" />
          <h2 class="edit-section__title">显示设置</h2>
        </div>

        <div class="space-y-1">
          <div class="edit-setting-row">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                是否显示所在城市
              </div>
              <div
                v-if="formData.show_area"
                class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
              >
                将在个人空间内展示位置
              </div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="formData.show_area"
              class="edit-switch"
              :class="formData.show_area ? 'bg-qhx-primary' : 'bg-gray-300 dark:bg-gray-600'"
              @click="formData.show_area = !formData.show_area"
            >
              <span
                class="edit-switch__thumb"
                :class="formData.show_area ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>

          <div class="edit-setting-row">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                是否展示成就簿
              </div>
              <div
                v-if="formData.is_achieve"
                class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
              >
                将在个人空间内展示成就簿
              </div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="formData.is_achieve"
              class="edit-switch"
              :class="formData.is_achieve ? 'bg-qhx-primary' : 'bg-gray-300 dark:bg-gray-600'"
              @click="formData.is_achieve = !formData.is_achieve"
            >
              <span
                class="edit-switch__thumb"
                :class="formData.is_achieve ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>
      </section>

      <!-- 自定义主题 -->
      <section class="edit-section mb-4">
        <CommunityCustomStyleForm
          ref="customStyleFormRef"
          v-model="customStyle"
          background-hint="个人空间背景"
        />
      </section>

      <!-- 保存按钮：移动端固定底栏，PC 端随内容流右对齐 -->
      <div
        class="fixed bottom-0 left-0 right-0 z-10 border-t border-pink-100/80 bg-white/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/90 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:pt-2 md:pb-0 md:backdrop-blur-none dark:md:bg-transparent"
      >
        <div class="w-full md:ml-auto md:w-auto md:inline-flex">
          <QhxJellyButton class="w-full md:w-auto">
            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-full bg-qhx-primary px-8 py-3 text-base font-semibold text-qhx-inverted shadow-lg shadow-pink-500/20 transition-colors hover:bg-qhx-primaryHover disabled:opacity-60 md:min-w-[200px]"
              :disabled="loading"
              @click="saveUserInfo"
            >
              <Icon
                v-if="loading"
                name="i-heroicons-arrow-path"
                class="h-5 w-5 animate-spin"
              />
              {{ loading ? '保存中…' : '保存信息' }}
            </button>
          </QhxJellyButton>
        </div>
      </div>
    </div>

    <!-- 风格选择器 -->
    <QhxSelect
      ref="styleSelectRef"
      :options="styleOptions"
      @select="confirmMainStyle"
    />

    <!-- 地址选择器 -->
    <QhxModal
      v-model="showAddressPicker"
      :trigger-position="addressClickPosition"
    >
      <div
        class="flex w-[92vw] max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-2xl dark:border-gray-700/50 dark:bg-gray-800"
      >
        <div
          class="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-pink-50/90 to-orange-50/70 px-5 py-4 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            选择地址
          </h3>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="关闭"
            @click="showAddressPicker = false"
          >
            <Icon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4 p-5">
          <div>
            <label class="edit-label">省份</label>
            <button
              type="button"
              class="edit-picker-btn"
              @click="openProvincePicker"
            >
              <span :class="selectedProvince ? 'text-gray-900 dark:text-white' : 'text-gray-400'">
                {{ selectedProvince?.label || '请选择省份' }}
              </span>
              <Icon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
            </button>
            <QhxSelect
              ref="provinceSelectRef"
              :options="provinceOptions"
              @select="onProvinceSelect"
            />
          </div>

          <div v-if="selectedProvince">
            <label class="edit-label">城市</label>
            <button
              type="button"
              class="edit-picker-btn"
              @click="openCityPicker"
            >
              <span :class="selectedCity ? 'text-gray-900 dark:text-white' : 'text-gray-400'">
                {{ selectedCity?.label || '请选择城市' }}
              </span>
              <Icon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
            </button>
            <QhxSelect
              ref="citySelectRef"
              :options="cityOptions"
              @select="onCitySelect"
            />
          </div>

          <div v-if="selectedCity">
            <label class="edit-label">区县</label>
            <button
              type="button"
              class="edit-picker-btn"
              @click="openAreaPicker"
            >
              <span :class="selectedArea ? 'text-gray-900 dark:text-white' : 'text-gray-400'">
                {{ selectedArea?.label || '请选择区县' }}
              </span>
              <Icon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400" />
            </button>
            <QhxSelect
              ref="areaSelectRef"
              :options="areaOptions"
              @select="onAreaSelect"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            class="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showAddressPicker = false"
          >
            取消
          </button>
          <QhxJellyButton>
            <button
              type="button"
              class="rounded-full bg-qhx-primary px-5 py-2 text-sm font-medium text-qhx-inverted transition-colors hover:bg-qhx-primaryHover disabled:opacity-50"
              :disabled="!selectedArea"
              @click="confirmAddress"
            >
              确认
            </button>
          </QhxJellyButton>
        </div>
      </div>
    </QhxModal>

    <EmailBindModal
      v-model="showEmailModal"
      :user="user"
      @success="handleEmailBindSuccess"
    />

    <RenameModal
      v-model="showRenameModal"
      :user="user"
      @success="handleRenameSuccess"
    />
  </div>
</template>

<style scoped>
.edit-section {
  @apply rounded-2xl border border-gray-100 bg-qhx-bg-card p-4 shadow-sm dark:border-gray-700 md:p-5;
}

.edit-section__header {
  @apply mb-4 flex items-center gap-2;
}

.edit-section__dot {
  @apply h-2 w-2 shrink-0 rounded-full bg-qhx-primary;
}

.edit-section__title {
  @apply text-base font-semibold text-gray-900 dark:text-white;
}

.edit-label {
  @apply mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.edit-input {
  @apply w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition-shadow dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100;
}

.edit-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.edit-textarea {
  @apply w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-shadow dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100;
}

.edit-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.edit-switch {
  @apply relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none disabled:opacity-50;
}

.edit-switch:focus-visible {
  box-shadow: 0 0 0 2px var(--primary-color);
}

.edit-switch__thumb {
  @apply inline-block h-5 w-5 rounded-full bg-white shadow transition-transform;
}

.edit-setting-row {
  @apply flex items-center justify-between gap-4 rounded-xl px-1 py-3;
}

.edit-picker-btn {
  @apply flex w-full items-center justify-between rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-sm transition-colors dark:border-gray-600 dark:bg-gray-800;
}

.edit-picker-btn:hover {
  border-color: var(--primary-color);
}
</style>
