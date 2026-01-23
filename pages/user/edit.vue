<template>
  <div v-if="user && config" class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
    <div class="max-w-2xl mx-auto p-4">
      <!-- 头部 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">编辑个人信息</h1>
      </div>

      <!-- 表单 -->
      <UCard class="mb-4">
        <template #header>
          <div class="text-lg font-semibold">基本信息</div>
        </template>

        <!-- 用户头像 -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            头像
          </label>
          <div class="flex items-center gap-4">
            <div class="relative">
              <img 
                :src="user.user_face ? `${BASE_IMG}${user.user_face}` : '/default-avatar.png'" 
                :alt="user.user_name || '用户头像'"
                class="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
              />
              <div 
                v-if="user.avatar?.avatar_frame" 
                class="absolute inset-0 rounded-full"
                :style="{
                  backgroundImage: `url(${BASE_IMG}${user.avatar.avatar_frame})`,
                  backgroundSize: '110%',
                  backgroundPosition: 'center',
                  zIndex: 10
                }"
              ></div>
            </div>
            <UButton
              @click="triggerAvatarUpload"
              variant="outline"
              icon="i-heroicons-photo"
              :loading="uploadingAvatar"
            >
              更换头像
            </UButton>
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarChange"
            />
          </div>
        </div>

        <!-- 用户名 -->
        <UFormGroup label="用户名" class="mb-4">
          <div class="flex items-center gap-2">
            <UInput
              :model-value="user.user_name"
              disabled
              class="flex-1"
            />
            <span class="text-xs text-gray-500 dark:text-gray-400">
              昵称是唯一且不重复的，暂不支持修改
            </span>
          </div>
        </UFormGroup>

        <!-- 个人签名 -->
        <UFormGroup label="个人签名" class="mb-4">
          <UTextarea
            v-model="formData.signature"
            placeholder="介绍一下自己"
            :rows="4"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-lg',
            }"
          />
        </UFormGroup>

        <!-- 邮箱 -->
        <UFormGroup label="邮箱" class="mb-4">
          <div class="flex items-center gap-2">
            <UInput
              :model-value="user.email || '未绑定'"
              disabled
              class="flex-1"
            />
            <UButton
              @click="showEmailModal = true"
              variant="outline"
              size="sm"
            >
              {{ user.email ? '换绑邮箱' : '绑定邮箱' }}
            </UButton>
          </div>
          <!-- 邮件通知开关 -->
          <div v-if="user.email" class="mt-3 flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">邮件通知</span>
              <span class="text-xs text-gray-500">开启后，系统将通过邮件发送重要通知</span>
            </div>
            <UToggle
              v-model="formData.email_notice"
              :disabled="loading"
              @update:model-value="updateMessageConfig"
            />
          </div>
          <!-- 订阅上新资讯开关 -->
          <div v-if="user.email" class="mt-3 flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">订阅上新资讯</span>
              <span class="text-xs text-gray-500">开启后，系统将通过邮件发送上新资讯通知</span>
            </div>
            <UToggle
              v-model="formData.daily_news_subscribe"
              :disabled="loading"
              @update:model-value="updateMessageConfig"
            />
          </div>
          <div class="text-xs text-gray-500">如果收不到邮件,请将 noreply@chaozj.com 添加至白名单</div>
        </UFormGroup>
      </UCard>

      <!-- 风格标签 -->
      <UCard class="mb-4">
        <template #header>
          <div class="text-lg font-semibold">风格标签</div>
        </template>
        <div class="flex flex-wrap gap-2 mb-4">
          <QhxTag
            v-for="(style, index) in formData.main_style"
            :key="index"
            
          >
            <div class="flex items-center">
              # {{ style.label }}
              <Icon @click="deleteStyle(index)" name="i-heroicons-x-mark" class="w-4 h-4 cursor-pointer" />

            </div>
          </QhxTag>
          <UButton
            @click="openStylePicker"
            variant="outline"
            size="sm"
          >
            选择风格
          </UButton>
        </div>
      </UCard>

      <!-- 所在城市 -->
      <UCard class="mb-4">
        <template #header>
          <div class="text-lg font-semibold">所在城市</div>
        </template>
        <div class="flex flex-wrap gap-2 mb-4">
          <UTag
            v-if="formData.province"
            color="blue"
            variant="soft"
            size="md"
            class="cursor-pointer"
          >
            {{ `${formData.province} ${formData.city} ${formData.area}` }}
            <button
              @click="deleteArea"
              class="ml-2 hover:text-red-500"
            >
              <Icon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </UTag>
          <UButton
            @click="openAddressPicker"
            variant="outline"
            size="sm"
          >
            选择地址
          </UButton>
        </div>
      </UCard>

      <!-- 显示设置 -->
      <UCard class="mb-4">
        <template #header>
          <div class="text-lg font-semibold">显示设置</div>
        </template>
        
        <!-- 是否显示所在城市 -->
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="font-medium text-gray-900 dark:text-white">是否显示所在城市</div>
            <div v-if="formData.show_area" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              将在个人空间内展示位置
            </div>
          </div>
          <UToggle
            v-model="formData.show_area"
            color="primary"
          />
        </div>

        <!-- 是否展示成就簿 -->
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium text-gray-900 dark:text-white">是否展示成就簿</div>
            <div v-if="formData.is_achieve" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              将在个人空间内展示成就簿
            </div>
          </div>
          <UToggle
            v-model="formData.is_achieve"
            color="primary"
          />
        </div>
      </UCard>

      <!-- 保存按钮 -->
      <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-10">
        <UButton
          @click="saveUserInfo"
          block
          size="lg"
          :loading="loading"
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          :ui="{ rounded: 'rounded-full' }"
        >
          保存信息
        </UButton>
      </div>
    </div>

    <!-- 风格选择器 -->
    <QhxSelect
      ref="styleSelectRef"
      :options="styleOptions"
      @select="confirmMainStyle"
    />

    <!-- 地址选择器 - 三级联动 -->
    <UModal v-model="showAddressPicker">
      <UCard>
        <template #header>
          <div class="text-lg font-semibold">选择地址</div>
        </template>
        <div class="space-y-4">
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
              @click="showAddressPicker = false"
              variant="outline"
            >
              取消
            </UButton>
            <UButton
              @click="confirmAddress"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              :disabled="!selectedArea"
            >
              确认
            </UButton>
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- 邮箱绑定弹窗 -->
    <EmailBindModal
      v-model="showEmailModal"
      :user="user"
      @success="handleEmailBindSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { getUserMy } from '@/api/user'
import { uploadImage } from '@/api/index'
import { BASE_IMG } from '@/utils/ipConfig'
import type { User } from '@/types/api'
import type { default as QhxSelect } from '@/components/Qhx/Select.vue'
import EmailBindModal from '@/components/user/EmailBindModal.vue'
let uni: any;
const port = computed(() => configStore.getPort())

// 地址数据类型
interface AddressItem {
  value: string
  label: string
  children?: AddressItem[]
}

// 设置页面标题
useHead({
  title: '编辑个人信息 - Lo研社'
})

const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()
const router = useRouter()

// 数据
const user = ref<User | null>(null)
const config = computed(() => configStore.config)
const loading = ref(false)
const uploadingAvatar = ref(false)
const showAddressPicker = ref(false)
const showEmailModal = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)

// 选择器引用
const styleSelectRef = ref<InstanceType<typeof QhxSelect>>()
const provinceSelectRef = ref<InstanceType<typeof QhxSelect>>()
const citySelectRef = ref<InstanceType<typeof QhxSelect>>()
const areaSelectRef = ref<InstanceType<typeof QhxSelect>>()

// 地址数据
const addressData = ref<AddressItem[]>([])
const selectedProvince = ref<{ label: string; value: string } | null>(null)
const selectedCity = ref<{ label: string; value: string } | null>(null)
const selectedArea = ref<{ label: string; value: string } | null>(null)

// 表单数据
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

// 地址选项
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

// 风格选项
const styleOptions = computed(() => {
  return config.value?.main_style || []
})

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    // 使用 store 中的方法获取用户信息并更新缓存
    const data = await userStore.fetchUserInfo()
    user.value = data
    
    // 填充表单数据
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
    
    // 解析 message_config JSON，获取 email_notice 和 daily_news_subscribe 设置
    if (userData.message_config) {
      try {
        const messageConfig = userData.message_config
        formData.email_notice = messageConfig.email_notice as boolean || false
        formData.daily_news_subscribe = messageConfig.daily_news_subscribe as boolean || false
        console.log(formData.email_notice, formData.daily_news_subscribe, '配置项')
      } catch (error) {
        console.error('解析 message_config 失败:', error)
        formData.email_notice = false
        formData.daily_news_subscribe = false
      }
    } else {
      formData.email_notice = false
      formData.daily_news_subscribe = false
    }
  } catch (error) {
    toast.add({
      title: '获取用户信息失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

// 触发头像上传
const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

// 处理头像选择
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

// 删除风格标签
const deleteStyle = (index: number) => {
  formData.main_style.splice(index, 1)
}

// 打开风格选择器
const openStylePicker = (e: MouseEvent) => {
  styleSelectRef.value?.showPicker(e)
}

// 确认选择风格
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

// 打开地址选择器
const openAddressPicker = () => {
  // 如果有已选择的地址，初始化选择状态
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

// 删除地址
const deleteArea = () => {
  formData.province = ''
  formData.city = ''
  formData.area = ''
  selectedProvince.value = null
  selectedCity.value = null
  selectedArea.value = null
}

// 确认地址
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

// 更新消息配置（仅更新 message_config）
const updateMessageConfig = async () => {
  if (loading.value) return

  loading.value = true

  try {
    // 使用 store 中的方法更新消息配置并重新拉取数据缓存
    await userStore.updateUserInfo({
      message_config: {
        email_notice: formData.email_notice,
        daily_news_subscribe: formData.daily_news_subscribe
      }
    })

    // 更新本地 user 引用
    user.value = userStore.user

    // 更新表单数据（从 store 中获取最新值）
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
    // 如果更新失败，恢复开关状态
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

// 保存用户信息
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

    // 更新 message_config JSON
    try {
      // 获取现有的 message_config
      const userWithConfig = user.value as User & { message_config?: string | Record<string, unknown> }
      let messageConfig: Record<string, boolean> = {}
      if (userWithConfig?.message_config) {
        try {
          messageConfig = typeof userWithConfig.message_config === 'string'
            ? JSON.parse(userWithConfig.message_config)
            : userWithConfig.message_config
        } catch (error) {
          console.error('解析现有 message_config 失败:', error)
          messageConfig = {}
        }
      }
      // 更新 email_notice 和 daily_news_subscribe 字段
      messageConfig.email_notice = formData.email_notice
      messageConfig.daily_news_subscribe = formData.daily_news_subscribe
      
      params.message_config = messageConfig
      console.log(params, '配置项')
    } catch (error) {
      console.error('更新 message_config 失败:', error)
    }

    // 使用 store 中的方法更新用户信息并重新拉取数据缓存
    await userStore.updateUserInfo(params)

    // 更新本地 user 引用
    user.value = userStore.user

    toast.add({
      title: '保存成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    // 返回上一页
    if (port.value) {
      // 鸿蒙环境
      port.value.postMessage(JSON.stringify({
        type: 'back',
        params: { reload: true }
      }));
    } else {
      router.back()
    }
    router.back()
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

// 邮箱绑定成功回调
const handleEmailBindSuccess = async () => {
  // 重新获取用户信息以显示最新数据
  await fetchUserInfo()
}

// 错误信息处理
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybeObj = error as Record<string, unknown>
    if (typeof maybeObj.message === 'string') return maybeObj.message
  }
  return ''
}

// 加载地址数据
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

// 初始化
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  await configStore.getConfig()
  await loadAddressData()
  await fetchUserInfo()
})

</script>

