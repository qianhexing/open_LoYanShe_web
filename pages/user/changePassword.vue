<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- 修改密码卡片 -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
        <!-- 头部 -->
        <div class="text-center mb-6 md:mb-8">
          <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            修改密码
          </h1>
          <p class="text-sm md:text-base text-gray-600 dark:text-gray-400">
            通过手机验证码修改密码
          </p>
        </div>

        <!-- 修改密码表单 -->
        <UForm :state="form" :validate="validate" class="space-y-4 md:space-y-6" @submit="onSubmit">
          <!-- 手机号 -->
          <UFormGroup label="手机号" name="phone">
            <UInput
              v-model="form.phone"
              placeholder="请输入手机号"
              icon="i-heroicons-device-phone-mobile"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2.5 md:py-2' }
              }"
            />
          </UFormGroup>

          <!-- 新密码 -->
          <UFormGroup label="新密码" name="password">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="请输入新密码"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2.5 md:py-2' }
              }"
            />
          </UFormGroup>

          <!-- 确认密码 -->
          <UFormGroup label="再次输入新密码" name="confirmPassword">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2.5 md:py-2' }
              }"
            />
          </UFormGroup>

          <!-- 验证码 -->
          <UFormGroup label="验证码" name="verification_code">
            <div class="flex gap-2">
              <UInput
                v-model="form.verification_code"
                :maxlength="4"
                placeholder="请输入验证码"
                icon="i-heroicons-shield-check"
                class="flex-1"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2.5 md:py-2' }
                }"
              />
              <UButton
                @click="sendVerificationCode"
                :disabled="!canSendCode || codeCountdown > 0"
                :loading="sendingCode"
                variant="outline"
                class="px-4 md:px-6 whitespace-nowrap flex-shrink-0"
                :ui="{ rounded: 'rounded-full' }"
              >
                {{ codeCountdown > 0 ? `倒计时 ${codeCountdown}s` : '获取验证码' }}
              </UButton>
            </div>
          </UFormGroup>

          <!-- 修改密码按钮 -->
          <UButton
            type="submit"
            block
            size="lg"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-4 md:mt-6"
            :loading="loading"
            :ui="{ rounded: 'rounded-full' }"
          >
            修改密码
          </UButton>

          <!-- 返回登录链接 -->
          <!-- <div class="text-center text-sm text-gray-500 dark:text-gray-400">
            <NuxtLink 
              to="/" 
              class="text-qhx-primary hover:underline"
            >
              返回登录
            </NuxtLink>
          </div> -->
        </UForm>
      </div>

      <!-- 装饰性元素 -->
      <div class="mt-6 md:mt-8 text-center">
        <div class="flex items-center justify-center space-x-4 text-gray-400 dark:text-gray-600">
          <div class="w-16 h-px bg-gray-300 dark:bg-gray-600"></div>
          <span class="text-sm">Lo研社</span>
          <div class="w-16 h-px bg-gray-300 dark:bg-gray-600"></div>
        </div>
      </div>
    </div>

    <!-- 背景装饰 -->
    <div class="fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl"></div>
      <div class="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-pink-400/20 to-orange-600/20 blur-3xl"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getSmsCode, changePassword } from '@/api/user'
import { onUnmounted } from 'vue'

// 设置页面标题
useHead({
  title: 'Lo研社 - 修改密码'
})

let uni: any
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const toast = useToast()
const router = useRouter()

// 表单数据
interface ChangePasswordFormState {
  phone: string
  password: string
  confirmPassword: string
  verification_code: string
}

const form = reactive({
  phone: '',
  password: '',
  confirmPassword: '',
  verification_code: ''
}) as ChangePasswordFormState

// 验证码相关状态
const sendingCode = ref(false)
const codeCountdown = ref(0)
const loading = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 是否可以发送验证码
const canSendCode = computed(() => {
  return form.phone && form.phone.length === 11 && /^1[3-9]\d{9}$/.test(form.phone)
})

// 发送验证码
const sendVerificationCode = async () => {
  if (!canSendCode.value) {
    toast.add({
      title: '请输入正确的手机号',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }

  if (sendingCode.value) {
    toast.add({
      title: '请求中请稍候',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning'
    })
    return
  }

  sendingCode.value = true
  try {
    await getSmsCode({
      user_phone: form.phone,
      type: 'password'
    })
    
    toast.add({
      title: '验证码已发送',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    // 清除之前的倒计时
    if (countdownTimer) {
      clearInterval(countdownTimer)
    }
    
    // 开始倒计时
    codeCountdown.value = 60
    countdownTimer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) {
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
      }
    }, 1000)
  } catch (error: unknown) {
    toast.add({
      title: '发送失败',
      description: getErrorMessage(error) || '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
  sendingCode.value = false
}

// 组件卸载时清理倒计时
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

// 表单验证规则
type ValidationError = { path: string; message: string }
const validate = (state: ChangePasswordFormState) => {
  const errors: ValidationError[] = []
  
  if (!state.phone) {
    errors.push({ path: 'phone', message: '请输入手机号' })
  } else if (!/^1[3-9]\d{9}$/.test(state.phone)) {
    errors.push({ path: 'phone', message: '请输入正确的手机号' })
  }
  
  if (!state.password) {
    errors.push({ path: 'password', message: '请输入新密码' })
  } else if (state.password.length < 6) {
    errors.push({ path: 'password', message: '密码至少6个字符' })
  }
  
  if (!state.confirmPassword) {
    errors.push({ path: 'confirmPassword', message: '请再次输入新密码' })
  } else if (state.password !== state.confirmPassword) {
    errors.push({ path: 'confirmPassword', message: '密码输入不一致' })
  }
  
  if (!state.verification_code) {
    errors.push({ path: 'verification_code', message: '请输入验证码' })
  } else if (state.verification_code.length !== 4) {
    errors.push({ path: 'verification_code', message: '验证码为4位数字' })
  }
  
  return errors
}

// 提交修改密码
const onSubmit = async () => {
  if (loading.value) {
    toast.add({
      title: '请求中请稍候',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning'
    })
    return
  }

  loading.value = true
  
  try {
    await changePassword({
      user_phone: form.phone,
      user_password: form.password,
      sms_code: form.verification_code
    })
    
    toast.add({
      title: '修改密码成功',
      description: '请使用新密码登录',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    // 修改成功后跳转到登录页
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'back'
      }));
    } else {
      await router.push('/')
    }
  } catch (error: unknown) {
    toast.add({
      title: '修改失败',
      description: getErrorMessage(error) || '请检查输入信息',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
  
  loading.value = false
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
</script>

<style scoped>
/* 自定义样式 */
.bg-qhx-primary {
  background-color: var(--qhx-primary, #3b82f6);
}

.text-qhx-primary {
  color: var(--qhx-primary, #3b82f6);
}

.text-qhx-inverted {
  color: var(--qhx-inverted, #ffffff);
}

.hover\:bg-qhx-primaryHover:hover {
  background-color: var(--qhx-primary-hover, #2563eb);
}

/* 响应式调整 - 适配手机端、网页端和鸿蒙端口 */
@media (max-width: 640px) {
  .min-h-screen {
    min-height: 100vh;
    min-height: 100dvh;
  }
}

/* 鸿蒙端口适配 */
@supports (-webkit-touch-callout: none) {
  .min-h-screen {
    min-height: -webkit-fill-available;
  }
}
</style>

