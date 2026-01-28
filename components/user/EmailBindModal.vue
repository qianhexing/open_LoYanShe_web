<template>
  <UModal :model-value="modelValue" @update:model-value="updateModelValue">
    <UCard>
      <template #header>
        <div class="text-lg font-semibold">{{ user?.email ? '换绑邮箱' : '绑定邮箱' }}</div>
      </template>
      <div class="space-y-4">
        <!-- 邮箱输入 -->
        <UFormGroup label="邮箱" name="email">
          <UInput
            v-model="emailForm.email"
            placeholder="请输入邮箱地址"
            type="email"
            icon="i-heroicons-envelope"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-lg',
            }"
          />
        </UFormGroup>

        <!-- 验证码输入 -->
        <UFormGroup label="验证码" name="email_code">
          <div class="flex gap-2">
            <UInput
              v-model="emailForm.email_code"
              placeholder="请输入验证码"
              class="flex-1"
              icon="i-heroicons-shield-check"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-lg',
              }"
            />
            <UButton
              @click="sendEmailVerificationCode"
              :disabled="!canSendEmailCode || emailCodeCountdown > 0"
              :loading="sendingEmailCode"
              variant="outline"
              class="px-4 whitespace-nowrap"
              :ui="{ rounded: 'rounded-lg' }"
            >
              {{ emailCodeCountdown > 0 ? `${emailCodeCountdown}s` : (emailCodeSent ? '重新发送' : '获取验证码') }}
            </UButton>
          </div>
        </UFormGroup>

        <div class="flex gap-2 justify-end mt-4">
          <UButton
            @click="handleCancel"
            variant="outline"
          >
            取消
          </UButton>
          <UButton
            @click="confirmBindEmail"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            :loading="bindingEmail"
            :disabled="!emailForm.email || !emailForm.email_code"
          >
            确认绑定
          </UButton>
        </div>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { sendEmailCode, bindEmail, changeUserInfo } from '@/api/user'
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

// 邮箱绑定相关
const emailForm = reactive({
  email: '',
  email_code: ''
})
const sendingEmailCode = ref(false)
const emailCodeSent = ref(false)
const emailCodeCountdown = ref(0)
const bindingEmail = ref(false)

// 邮箱验证码倒计时
const canSendEmailCode = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailForm.email && emailRegex.test(emailForm.email)
})

// 更新 modelValue
const updateModelValue = (value: boolean) => {
  emit('update:modelValue', value)
  if (!value) {
    // 弹窗关闭时重置表单
    resetForm()
  }
}

// 重置表单
const resetForm = () => {
  emailForm.email = props.user?.email || ''
  emailForm.email_code = ''
  emailCodeSent.value = false
  emailCodeCountdown.value = 0
}

// 取消操作
const handleCancel = () => {
  updateModelValue(false)
}

// 发送邮箱验证码
const sendEmailVerificationCode = async () => {
  if (!canSendEmailCode.value || emailCodeCountdown.value > 0) return

  sendingEmailCode.value = true
  try {
    await sendEmailCode({ email: emailForm.email })
    emailCodeSent.value = true
    emailCodeCountdown.value = 60
    
    // 开始倒计时
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

// 确认绑定邮箱
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
    // 验证并绑定邮箱（调用 /email/bind 接口）
    await bindEmail({
      email: emailForm.email,
      code: emailForm.email_code
    })

    // 绑定成功后，更新用户信息
    await useUserStore().updateUserInfo({
      email: emailForm.email
    })

    toast.add({
      title: '绑定成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    // 关闭弹窗并重置表单
    updateModelValue(false)
    resetForm()
    
    // 触发成功事件
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

// 监听 user 变化，初始化邮箱
watch(() => props.user, (newUser) => {
  if (newUser?.email) {
    emailForm.email = newUser.email
  }
}, { immediate: true })

// 监听 modelValue 变化，初始化表单
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    emailForm.email = props.user?.email || ''
    emailForm.email_code = ''
    emailCodeSent.value = false
    emailCodeCountdown.value = 0
  }
})
</script>

