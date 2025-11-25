<template>
  <UPopover ref="popover1" v-model:open="open" :popper="{ placement: 'bottom-start' }" :ui="{ rounded: 'rounded-[18px]' }"" >
    <UButton class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover" variant="ghost" icon="i-heroicons-user-circle">{{ $t('login.login') }}</UButton>
    <template #panel>
      <div class="p-6 w-[400px]">
        <h3 class="text-lg font-semibold mb-4">{{ $t('login.account') }}</h3>
        
        <UForm :state="state" class="space-y-4" @submit="onSubmit">
          <!-- <UFormGroup :label="$t('login.phone')" :ui="{ label: { base: 'my-1' } }" name="username">
            <UInput
              v-model="state.user_phone"
              :placeholder="$t('login.enter_phone')"
              class="flex-1 focus:ring-0"
              icon="i-heroicons-user"
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
          </UFormGroup> -->
          <!-- 手机号 -->
          <UFormGroup :label="$t('register.phone')" name="phone">
            <div class="flex gap-2">
              <USelectMenu 
                v-model="state.user_phone_code"
                value-attribute="value"
                :options="phoneCodeOptions" 
                class="w-32"
                :ui="{
                  rounded: 'rounded-full',
                  padding: { xs: 'px-3 py-2' }
                }"
              />
              <UInput
                v-model="state.user_phone"
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

          <UFormGroup :label="$t('login.password')" :ui="{ label: { base: 'my-1' } }"  name="password">
            <UInput
              v-model="state.user_password"
              :placeholder="$t('login.enter_password') "
              type="password"
              class="flex-1 focus:ring-0"
              icon="i-heroicons-lock-closed"
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

          <div class="flex items-center justify-between">
            <UCheckbox 
            :ui="{ 
              rounded: 'text-qhx-primary',
              color: 'qhx-primary'
            }"
              v-model="state.remember" 
              :label="$t('login.remember')"
              name="remember"
            />
            <!-- <NuxtLink 
              to="/forgot-password" 
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              忘记密码?
            </NuxtLink> -->
          </div>

          <UButton 
            type="submit" 
            block 
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
            :loading="loading"
          >
            {{ $t('login.login')}}
          </UButton>

          <div class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            还没有账号?
            <NuxtLink 
              to="/register" 
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              立即注册
            </NuxtLink>
          </div>
        </UForm>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const popover1 = ref() // 模板引用
const open = ref(false)
const userStore = useUserStore()
const config = useConfigStore()
const state = reactive({
  user_phone_code: '+86',
  user_phone: '',
  user_password: '',
  remember: false
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

onMounted(() => {
  // state.user_phone_code = localStorage.getItem('user_phone_code') || '+86'
  state.user_phone_code = '+86'
})
const loading = ref(false)

const  onSubmit = async () => {
  loading.value = true
  if (process.client && typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem('user_phone_code', state.user_phone_code)
  }
  if (!state.user_phone_code) {
    return
  }
  // 这里添加登录逻辑
  try {
    await userStore.login((state.user_phone_code && state.user_phone_code === '+86' ? '' : state.user_phone_code) + state.user_phone, state.user_password)
    open.value = false
    const toast = useToast()
    toast.add({
      title: '登录成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    // 登录成功，跳转到首页或其他页面
  } catch (error) {
  }
  loading.value = false
}

</script>

<style scoped>
/* 可以添加自定义样式 */
</style>