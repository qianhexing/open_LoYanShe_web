<script setup lang="ts">
import { sendEmailCode, bindEmail } from '@/api/user'
import type { User } from '@/types/api'

interface Props {
  modelValue: boolean
  user?: User | null
}

const props = withDefaults(defineProps<Props>(), {
  user: null
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

const toast = useToast()

const emailForm = reactive({
  email: '',
  email_code: ''
})
const sendingEmailCode = ref(false)
const emailCodeSent = ref(false)
const emailCodeCountdown = ref(0)
const bindingEmail = ref(false)

const canSendEmailCode = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailForm.email && emailRegex.test(emailForm.email)
})

const updateModelValue = (value: boolean) => {
  emit('update:modelValue', value)
  if (!value) {
    resetForm()
  }
}

const resetForm = () => {
  emailForm.email = props.user?.email || ''
  emailForm.email_code = ''
  emailCodeSent.value = false
  emailCodeCountdown.value = 0
}

const handleCancel = () => {
  updateModelValue(false)
}

const sendEmailVerificationCode = async () => {
  if (!canSendEmailCode.value || emailCodeCountdown.value > 0) return

  sendingEmailCode.value = true
  try {
    await sendEmailCode({ email: emailForm.email })
    emailCodeSent.value = true
    emailCodeCountdown.value = 60

    const timer = setInterval(() => {
      emailCodeCountdown.value--
      if (emailCodeCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)

    toast.add({
      title: '验证码已发送',
      description: '请查看您的邮箱',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '发送失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    sendingEmailCode.value = false
  }
}

const confirmBindEmail = async () => {
  if (!emailForm.email || !emailForm.email_code) {
    toast.add({
      title: '请填写完整信息',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
    return
  }

  bindingEmail.value = true
  try {
    await bindEmail({
      email: emailForm.email,
      code: emailForm.email_code
    })

    await useUserStore().updateUserInfo({
      email: emailForm.email
    })

    toast.add({
      title: '绑定成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    updateModelValue(false)
    resetForm()
    emit('success')
  } catch (error) {
    toast.add({
      title: '绑定失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    bindingEmail.value = false
  }
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

watch(() => props.user, (newUser) => {
  if (newUser?.email) {
    emailForm.email = newUser.email
  }
}, { immediate: true })

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    emailForm.email = props.user?.email || ''
    emailForm.email_code = ''
    emailCodeSent.value = false
    emailCodeCountdown.value = 0
  }
})
</script>

<template>
  <QhxModal :model-value="modelValue" @update:model-value="updateModelValue">
    <div
      class="flex w-[92vw] max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-2xl dark:border-gray-700/50 dark:bg-gray-800"
    >
      <div
        class="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-pink-50/90 to-orange-50/70 px-5 py-4 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800"
      >
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ user?.email ? '换绑邮箱' : '绑定邮箱' }}
        </h3>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          aria-label="关闭"
          @click="handleCancel"
        >
          <Icon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <div class="space-y-4 p-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            邮箱
          </label>
          <div class="relative">
            <Icon
              name="i-heroicons-envelope"
              class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <input
              v-model="emailForm.email"
              type="email"
              placeholder="请输入邮箱地址"
              class="w-full rounded-full border border-gray-200 bg-gray-50/90 py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition-shadow focus:border-qhx-primary/40 focus:ring-2 focus:ring-qhx-primary/30 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-100"
            >
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            验证码
          </label>
          <div class="flex gap-2">
            <div class="relative min-w-0 flex-1">
              <Icon
                name="i-heroicons-shield-check"
                class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
              <input
                v-model="emailForm.email_code"
                type="text"
                placeholder="请输入验证码"
                class="w-full rounded-full border border-gray-200 bg-gray-50/90 py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition-shadow focus:border-qhx-primary/40 focus:ring-2 focus:ring-qhx-primary/30 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-100"
              >
            </div>
            <button
              type="button"
              class="shrink-0 rounded-full border border-qhx-primary/40 bg-white px-3.5 py-2 text-sm font-medium text-qhx-primary transition-colors hover:bg-qhx-primary/5 disabled:opacity-50 dark:bg-gray-800"
              :disabled="!canSendEmailCode || emailCodeCountdown > 0 || sendingEmailCode"
              @click="sendEmailVerificationCode"
            >
              <span v-if="sendingEmailCode" class="inline-flex items-center gap-1">
                <Icon name="i-heroicons-arrow-path" class="h-3.5 w-3.5 animate-spin" />
                发送中
              </span>
              <span v-else>
                {{ emailCodeCountdown > 0 ? `${emailCodeCountdown}s` : (emailCodeSent ? '重新发送' : '获取验证码') }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
        <button
          type="button"
          class="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="handleCancel"
        >
          取消
        </button>
        <QhxJellyButton>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full bg-qhx-primary px-5 py-2 text-sm font-medium text-qhx-inverted transition-colors hover:bg-qhx-primaryHover disabled:opacity-50"
            :disabled="!emailForm.email || !emailForm.email_code || bindingEmail"
            @click="confirmBindEmail"
          >
            <Icon
              v-if="bindingEmail"
              name="i-heroicons-arrow-path"
              class="h-4 w-4 animate-spin"
            />
            确认绑定
          </button>
        </QhxJellyButton>
      </div>
    </div>
  </QhxModal>
</template>
