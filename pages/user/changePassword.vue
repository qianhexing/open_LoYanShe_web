<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
        <div class="text-center mb-6 md:mb-8">
          <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {{ $t('change_password.title') }}
          </h1>
          <p class="text-sm md:text-base text-gray-600 dark:text-gray-400">
            {{ $t('change_password.subtitle') }}
          </p>
        </div>

        <UForm :state="form" :validate="validate" class="space-y-4 md:space-y-6" @submit="onSubmit">
          <UFormGroup :label="$t('change_password.phone')" name="phone">
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
                :placeholder="$t('change_password.enter_phone')"
                class="flex-1"
                icon="i-heroicons-device-phone-mobile"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2.5 md:py-2' }
                }"
              />
            </div>
          </UFormGroup>

          <UFormGroup :label="$t('change_password.new_password')" name="password">
            <UInput
              v-model="form.password"
              type="password"
              :placeholder="$t('change_password.enter_password')"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2.5 md:py-2' }
              }"
            />
          </UFormGroup>

          <UFormGroup :label="$t('change_password.confirm_password')" name="confirmPassword">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              :placeholder="$t('change_password.enter_confirm_password')"
              icon="i-heroicons-lock-closed"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2.5 md:py-2' }
              }"
            />
          </UFormGroup>

          <UFormGroup :label="$t('change_password.verification_code')" name="verification_code">
            <div class="flex gap-2">
              <UInput
                v-model="form.verification_code"
                :maxlength="4"
                :placeholder="$t('change_password.enter_code')"
                icon="i-heroicons-shield-check"
                class="flex-1"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2.5 md:py-2' }
                }"
              />
              <UButton
                :disabled="!canSendCode || codeCountdown > 0"
                :loading="sendingCode"
                variant="outline"
                class="px-4 md:px-6 whitespace-nowrap flex-shrink-0"
                :ui="{ rounded: 'rounded-full' }"
                @click="sendVerificationCode"
              >
                {{ codeCountdown > 0 ? $t('change_password.countdown', { n: codeCountdown }) : $t('change_password.send_code') }}
              </UButton>
            </div>
          </UFormGroup>

          <UButton
            type="submit"
            block
            size="lg"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-4 md:mt-6"
            :loading="loading"
            :ui="{ rounded: 'rounded-full' }"
          >
            {{ $t('change_password.submit') }}
          </UButton>

          <div class="text-center text-sm text-gray-500 dark:text-gray-400">
            <NuxtLink
              to="/login"
              class="text-qhx-primary hover:underline"
            >
              {{ $t('change_password.back_to_login') }}
            </NuxtLink>
          </div>
        </UForm>
      </div>

      <div class="mt-6 md:mt-8 text-center">
        <div class="flex items-center justify-center space-x-4 text-gray-400 dark:text-gray-600">
          <div class="w-16 h-px bg-gray-300 dark:bg-gray-600"></div>
          <span class="text-sm">{{ $t('common.brand') }}</span>
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
import { getSmsCode, changePassword } from '@/api/user'
import { LOGIN_PATH } from '@/utils/loginRedirect'

const { t } = useI18n()

useHead({
  title: () => t('change_password.page_title')
})

const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const toast = useToast()
const router = useRouter()

interface ChangePasswordFormState {
  phone_code: string
  phone: string
  password: string
  confirmPassword: string
  verification_code: string
}

const form = reactive({
  phone_code: '+86',
  phone: '',
  password: '',
  confirmPassword: '',
  verification_code: ''
}) as ChangePasswordFormState

const sendingCode = ref(false)
const codeCountdown = ref(0)
const loading = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 与登录一致：国内不加前缀，国际号带 + 区号 */
const fullPhone = computed(() => {
  return (form.phone_code === '+86' ? '' : form.phone_code) + form.phone
})

const phoneCodeOptions = computed(() => {
  const codeList: { label: string; value: string }[] = []
  if (configStore.config?.phone_code) {
    for (const item of configStore.config.phone_code) {
      if (item.children) {
        for (const child of item.children) {
          codeList.push({
            label: `${child.label} ${child.value}`,
            value: String(child.value)
          })
        }
      }
    }
  }
  if (codeList.length === 0) {
    codeList.push(
      { label: t('login.phone_code_cn'), value: '+86' },
      { label: t('login.phone_code_us'), value: '+1' },
      { label: t('login.phone_code_jp'), value: '+81' }
    )
  }
  return codeList
})

const canSendCode = computed(() => {
  if (!form.phone || !form.phone_code) return false
  if (form.phone_code === '+86') {
    return /^1[3-9]\d{9}$/.test(form.phone)
  }
  return form.phone.length >= 6
})

const sendVerificationCode = async () => {
  if (!canSendCode.value) {
    toast.add({
      title: t('change_password.invalid_phone'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }

  if (sendingCode.value) {
    toast.add({
      title: t('change_password.requesting'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning'
    })
    return
  }

  sendingCode.value = true
  try {
    // 后端：type=password 时写入 password_{phone}，供 /user/change/password 校验
    await getSmsCode({
      user_phone: fullPhone.value,
      type: 'password'
    })

    toast.add({
      title: t('change_password.code_sent'),
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    if (countdownTimer) {
      clearInterval(countdownTimer)
    }

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
      title: t('change_password.send_failed'),
      description: getErrorMessage(error) || t('common.retry'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
  sendingCode.value = false
}

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

type ValidationError = { path: string; message: string }
const validate = (state: ChangePasswordFormState) => {
  const errors: ValidationError[] = []

  if (!state.phone) {
    errors.push({ path: 'phone', message: t('change_password.enter_phone') })
  } else if (state.phone_code === '+86' && !/^1[3-9]\d{9}$/.test(state.phone)) {
    errors.push({ path: 'phone', message: t('change_password.invalid_phone') })
  } else if (state.phone_code !== '+86' && state.phone.length < 6) {
    errors.push({ path: 'phone', message: t('change_password.invalid_phone') })
  }

  if (!state.password) {
    errors.push({ path: 'password', message: t('change_password.enter_password') })
  } else if (state.password.length < 6) {
    errors.push({ path: 'password', message: t('change_password.password_min') })
  }

  if (!state.confirmPassword) {
    errors.push({ path: 'confirmPassword', message: t('change_password.enter_confirm_password') })
  } else if (state.password !== state.confirmPassword) {
    errors.push({ path: 'confirmPassword', message: t('change_password.password_mismatch') })
  }

  if (!state.verification_code) {
    errors.push({ path: 'verification_code', message: t('change_password.enter_code_required') })
  } else if (state.verification_code.length !== 4) {
    errors.push({ path: 'verification_code', message: t('change_password.code_length') })
  }

  return errors
}

const onSubmit = async () => {
  if (loading.value) {
    toast.add({
      title: t('change_password.requesting'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning'
    })
    return
  }

  loading.value = true

  try {
    await changePassword({
      user_phone: fullPhone.value,
      user_password: form.password,
      sms_code: form.verification_code
    })

    toast.add({
      title: t('change_password.success'),
      description: t('change_password.success_desc'),
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'back'
      }))
    } else {
      await router.push(LOGIN_PATH)
    }
  } catch (error: unknown) {
    toast.add({
      title: t('change_password.failed'),
      description: getErrorMessage(error) || t('change_password.check_input'),
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

@supports (-webkit-touch-callout: none) {
  .min-h-screen {
    min-height: -webkit-fill-available;
  }
}
</style>
