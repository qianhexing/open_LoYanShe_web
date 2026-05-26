<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {{ $t('login.title') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('login.subtitle') }}
          </p>
        </div>

        <UForm :state="form" :validate="validate" class="space-y-6" @submit="onSubmit">
          <UFormGroup :label="$t('login.phone')" name="phone">
            <div class="flex gap-2">
              <USelectMenu
                v-model="form.phone_code"
                value-attribute="value"
                :options="phoneCodeOptions"
                class="w-32"
                :ui="{
                  rounded: 'rounded-full',
                  padding: { xs: 'px-3 py-2' }
                }"
              />
              <UInput
                v-model="form.phone"
                :placeholder="$t('login.enter_phone')"
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

          <UFormGroup :label="$t('login.password')" name="password">
            <UInput
              v-model="form.password"
              type="password"
              :placeholder="$t('login.enter_password')"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' }
              }"
            />
          </UFormGroup>

          <div class="flex items-center">
            <UCheckbox
              v-model="form.remember"
              :ui="{
                rounded: 'text-qhx-primary',
                color: 'qhx-primary'
              }"
              :label="$t('login.remember')"
              name="remember"
            />
          </div>

          <UButton
            type="submit"
            block
            size="lg"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            :loading="loading"
            :ui="{ rounded: 'rounded-full' }"
          >
            {{ $t('login.login') }}
          </UButton>

          <div class="text-center text-sm text-gray-500 dark:text-gray-400">
            {{ $t('login.register_link') }}
            <NuxtLink
              :to="registerTo"
              class="text-qhx-primary hover:underline ml-1"
            >
              {{ $t('register.register') }}
            </NuxtLink>
          </div>
        </UForm>
      </div>

      <div class="mt-8 text-center">
        <div class="flex items-center justify-center space-x-4 text-gray-400 dark:text-gray-600">
          <div class="w-16 h-px bg-gray-300 dark:bg-gray-600"></div>
          <span class="text-sm">Lo研社</span>
          <div class="w-16 h-px bg-gray-300 dark:bg-gray-600"></div>
        </div>
      </div>
    </div>

    <div class="fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl"></div>
      <div class="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-pink-400/20 to-orange-600/20 blur-3xl"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Lo研社 - 登录'
})

const userStore = useUserStore()
const config = useConfigStore()
const toast = useToast()
const { buildRegisterTo, navigateAfterLogin } = useLoginRedirect()

const registerTo = computed(() => buildRegisterTo())

interface LoginFormState {
  phone_code: string
  phone: string
  password: string
  remember: boolean
}

const form = reactive({
  phone_code: '+86',
  phone: '',
  password: '',
  remember: false
}) as LoginFormState

const phoneCodeOptions = computed(() => {
  const codeList: { label: string; value: string }[] = []
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
  if (codeList.length === 0) {
    codeList.push(
      { label: '中国 +86', value: '+86' },
      { label: '美国 +1', value: '+1' },
      { label: '日本 +81', value: '+81' }
    )
  }
  return codeList
})

const loading = ref(false)

const fullPhone = computed(() => {
  return (form.phone_code === '+86' ? '' : form.phone_code) + form.phone
})

type ValidationError = { path: string; message: string }

const validate = (state: LoginFormState) => {
  const errors: ValidationError[] = []

  if (!state.phone) {
    errors.push({ path: 'phone', message: '请输入手机号' })
  } else if (!/^1[3-9]\d{9}$/.test(state.phone) && state.phone_code === '+86') {
    errors.push({ path: 'phone', message: '请输入有效的手机号' })
  }

  if (!state.password) {
    errors.push({ path: 'password', message: '请输入密码' })
  }

  return errors
}

const onSubmit = async () => {
  loading.value = true
  try {
    if (process.client && typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('user_phone_code', form.phone_code)
    }
    await userStore.login(fullPhone.value, form.password)
    toast.add({
      title: '登录成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    await navigateAfterLogin()
  } catch (error: unknown) {
    toast.add({
      title: '登录失败',
      description: getErrorMessage(error) || '请检查账号和密码',
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

onMounted(async () => {
  await userStore.loadToken()
  if (userStore.token) {
    await navigateAfterLogin()
  }
})
</script>

<style scoped>
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

@media (max-width: 640px) {
  .min-h-screen {
    min-height: 100vh;
    min-height: 100dvh;
  }
}
</style>
