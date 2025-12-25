<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <!-- 背景遮罩 -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        
        <!-- 弹窗内容 -->
        <div class="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-[2rem] p-8 shadow-2xl border border-white/50 dark:border-gray-700 max-w-md w-full">
          <!-- 关闭按钮 -->
          <button
            @click="handleClose"
            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span class="text-xl">✕</span>
          </button>

          <!-- 标题 -->
          <div class="text-center mb-6">
            <div class="text-5xl mb-4">🔐</div>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">快速登录</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">登录后查看年度总结</p>
          </div>

          <!-- 登录表单 -->
          <form @submit.prevent="handleLogin" class="space-y-4">
            <!-- 手机号 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                手机号
              </label>
              <div class="flex gap-2">
                <select
                  v-model="loginForm.user_phone_code"
                  class="w-28 px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200"
                >
                  <option v-for="option in phoneCodeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <input
                  v-model="loginForm.user_phone"
                  type="tel"
                  placeholder="请输入手机号"
                  required
                  class="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200 placeholder-gray-400"
                />
              </div>
            </div>

            <!-- 密码 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                密码
              </label>
              <input
                v-model="loginForm.user_password"
                type="password"
                placeholder="请输入密码"
                required
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200 placeholder-gray-400"
              />
            </div>

            <!-- 记住我 -->
            <div class="flex items-center">
              <input
                v-model="loginForm.remember"
                type="checkbox"
                id="remember"
                class="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
              />
              <label for="remember" class="ml-2 text-sm text-gray-600 dark:text-gray-300">
                记住我
              </label>
            </div>

            <!-- 登录按钮 -->
            <button
              type="submit"
              :disabled="loginLoading"
              class="w-full px-6 py-3 bg-qhx-primary hover:bg-qhx-primaryHover text-white rounded-full font-bold transition-colors shadow-lg shadow-qhx-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="loginLoading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{{ loginLoading ? '登录中...' : '登录' }}</span>
            </button>

            <!-- 注册链接 -->
            <div class="text-center text-sm text-gray-500 dark:text-gray-400">
              还没有账号？
              <NuxtLink
                to="/register"
                class="text-pink-500 hover:text-pink-600 dark:text-pink-400 font-medium"
                @click="handleClose"
              >
                立即注册
              </NuxtLink>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

const toast = useToast()
const userStore = useUserStore()
const configStore = useConfigStore()

const loginLoading = ref(false)

// 登录表单
const loginForm = reactive({
  user_phone_code: '+86',
  user_phone: '',
  user_password: '',
  remember: false
})

// 手机区号选项
const phoneCodeOptions = computed(() => {
  const codeList: Array<{ label: string; value: string }> = []
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

// 错误处理函数
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybeObj = error as Record<string, unknown>
    if (typeof maybeObj.message === 'string') return maybeObj.message
  }
  return '操作失败，请稍后重试'
}

// 关闭弹窗
const handleClose = () => {
  emit('update:modelValue', false)
  // 重置表单
  loginForm.user_phone_code = '+86'
  loginForm.user_phone = ''
  loginForm.user_password = ''
  loginForm.remember = false
}

// 登录处理
const handleLogin = async () => {
  if (loginLoading.value) return
  
  loginLoading.value = true
  
  try {
    const fullPhone = (loginForm.user_phone_code === '+86' ? '' : loginForm.user_phone_code) + loginForm.user_phone
    
    await userStore.login(fullPhone, loginForm.user_password)
    
    // 登录成功
    toast.add({
      title: '登录成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    emit('success')
    handleClose()
  } catch (error) {
    toast.add({
      title: '登录失败',
      description: getErrorMessage(error) || '请检查手机号和密码',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loginLoading.value = false
  }
}
</script>

<style scoped>
/* 弹窗动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active > div:last-child,
.modal-fade-leave-active > div:last-child {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from > div:last-child,
.modal-fade-leave-to > div:last-child {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}
</style>

