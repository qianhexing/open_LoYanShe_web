<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- 注册卡片 -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <!-- 头部 -->
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {{ $t('register.title') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('register.subtitle') }}
          </p>
        </div>

        <!-- 注册表单 -->
        <UForm :state="form" :validate="validate" class="space-y-6" @submit="onSubmit">
          <!-- 手机号 -->
          <UFormGroup :label="$t('register.phone')" name="phone">
            <div class="flex gap-2">
              <USelectMenu 
                v-model="form.phone_code" 
                :options="phoneCodeOptions" 
                class="w-32"
                :ui="{
                  rounded: 'rounded-full',
                  padding: { xs: 'px-3 py-2' }
                }"
              />
              <UInput
                v-model="form.phone"
                :placeholder="$t('register.enter_phone')"
                class="flex-1"
                icon="i-heroicons-device-phone-mobile"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' }
                }"
              />
            </div>
          </UFormGroup>

          <!-- 验证码 -->
          <UFormGroup :label="$t('register.verification_code')" name="verification_code">
            <div class="flex gap-2">
              <UInput
                v-model="form.verification_code"
                :placeholder="$t('register.enter_code')"
                class="flex-1"
                icon="i-heroicons-shield-check"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' }
                }"
              />
              <UButton
                @click="sendVerificationCode"
                :disabled="!canSendCode || codeCountdown > 0"
                :loading="sendingCode"
                variant="outline"
                class="px-4 whitespace-nowrap"
                :ui="{ rounded: 'rounded-full' }"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}s` : (codeSent ? $t('register.resend_code') : $t('register.send_code')) }}
              </UButton>
            </div>
          </UFormGroup>

          <!-- 用户名 -->
          <UFormGroup :label="$t('register.username')" name="username">
            <UInput
              v-model="form.username"
              :placeholder="$t('register.enter_username')"
              icon="i-heroicons-user"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' }
              }"
            />
          </UFormGroup>

          <!-- 密码 -->
          <UFormGroup :label="$t('register.password')" name="password">
            <UInput
              v-model="form.password"
              type="password"
              :placeholder="$t('register.enter_password')"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' }
              }"
            />
          </UFormGroup>

          <!-- 确认密码 -->
          <UFormGroup :label="$t('register.confirm_password')" name="confirmPassword">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              :placeholder="$t('register.enter_confirm_password')"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' }
              }"
            />
          </UFormGroup>

          <!-- 用户协议 -->
          <div class="flex items-start gap-3">
            <UCheckbox
              v-model="form.agreeTerms"
              :ui="{ 
                rounded: 'text-qhx-primary',
                color: 'qhx-primary'
              }"
              class="mt-1"
            />
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('register.agreement') }}
              <NuxtLink to="/terms" class="text-qhx-primary hover:underline">
                {{ $t('register.terms') }}
              </NuxtLink>
              和
              <NuxtLink to="/privacy" class="text-qhx-primary hover:underline">
                {{ $t('register.privacy') }}
              </NuxtLink>
            </div>
          </div>

          <!-- 注册按钮 -->
          <UButton
            type="submit"
            block
            size="lg"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            :loading="loading"
            :ui="{ rounded: 'rounded-full' }"
          >
            {{ $t('register.register') }}
          </UButton>

          <!-- 登录链接 -->
          <div class="text-center text-sm text-gray-500 dark:text-gray-400">
            {{ $t('register.login_link') }}
            <NuxtLink 
              to="/" 
              class="text-qhx-primary hover:underline ml-1"
            >
              {{ $t('login.login') }}
            </NuxtLink>
          </div>
        </UForm>
      </div>

      <!-- 装饰性元素 -->
      <div class="mt-8 text-center">
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
// 设置页面标题
useHead({
  title: 'Lo研社 - 注册'
})

const userStore = useUserStore()
const config = useConfigStore()
const toast = useToast()
const router = useRouter()

// 表单数据
const form = reactive({
  phone_code: '+86',
  phone: '',
  verification_code: '',
  username: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false
})

// 手机区号选项
const phoneCodeOptions = computed(() => {
  const codeList = []
  if (config.config?.phone_code) {
    for (const item of config.config.phone_code) {
      if (item.children) {
        for (const child of item.children) {
          codeList.push({
            label: `${child.label} ${child.value}`,
            value: child.value
          })
        }
      }
    }
  }
  // 默认选项
  if (codeList.length === 0) {
    codeList.push(
      { label: '中国 +86', value: '+86' },
      { label: '美国 +1', value: '+1' },
      { label: '日本 +81', value: '+81' }
    )
  }
  return codeList
})

// 验证码相关状态
const codeSent = ref(false)
const sendingCode = ref(false)
const codeCountdown = ref(0)
const loading = ref(false)

// 是否可以发送验证码
const canSendCode = computed(() => {
  return form.phone && form.phone_code && form.phone.length >= 8
})

// 发送验证码
const sendVerificationCode = async () => {
  if (!canSendCode.value) {
    toast.add({
      title: '请先输入有效的手机号',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }

  sendingCode.value = true
  try {
    await userStore.sendCode(form.phone, form.phone_code)
    codeSent.value = true
    toast.add({
      title: '验证码已发送',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    // 开始倒计时
    codeCountdown.value = 60
    const timer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error: any) {
    toast.add({
      title: '发送失败',
      description: error.message || '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
  sendingCode.value = false
}

// 表单验证规则
const validate = (state: any) => {
  const errors: any[] = []
  
  if (!state.phone) {
    errors.push({ path: 'phone', message: '请输入手机号' })
  } else if (!/^1[3-9]\d{9}$/.test(state.phone) && state.phone_code === '+86') {
    errors.push({ path: 'phone', message: '请输入有效的手机号' })
  }
  
  if (!state.verification_code) {
    errors.push({ path: 'verification_code', message: '请输入验证码' })
  }
  
  if (!state.username) {
    errors.push({ path: 'username', message: '请输入用户名' })
  } else if (state.username.length < 2) {
    errors.push({ path: 'username', message: '用户名至少2个字符' })
  }
  
  if (!state.password) {
    errors.push({ path: 'password', message: '请输入密码' })
  } else if (state.password.length < 6) {
    errors.push({ path: 'password', message: '密码至少6个字符' })
  }
  
  if (!state.confirmPassword) {
    errors.push({ path: 'confirmPassword', message: '请确认密码' })
  } else if (state.password !== state.confirmPassword) {
    errors.push({ path: 'confirmPassword', message: '两次输入的密码不一致' })
  }
  
  if (!state.agreeTerms) {
    errors.push({ path: 'agreeTerms', message: '请同意用户协议和隐私政策' })
  }
  
  return errors
}

// 提交注册
const onSubmit = async () => {
  loading.value = true
  
  try {
    await userStore.register({
      user_phone: form.phone,
      user_name: form.username,
      user_password: form.password,
      phone_code: form.phone_code,
      verification_code: form.verification_code
    })
    
    toast.add({
      title: '注册成功',
      description: '欢迎加入Lo研社！',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    // 注册成功后跳转到首页
    await router.push('/')
  } catch (error: any) {
    toast.add({
      title: '注册失败',
      description: error.message || '请检查输入信息',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
  
  loading.value = false
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

/* 响应式调整 */
@media (max-width: 640px) {
  .min-h-screen {
    min-height: 100vh;
    min-height: 100dvh;
  }
}
</style>