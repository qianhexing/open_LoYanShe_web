<!-- 注册页面  -->
<template>
  <div class="container mx-auto p-4 pb-20">
    <h1>注册页面</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="w-full">
        <UFormGroup label="手机号">
          <div class="flex items-center">
            <USelectMenu class="w-[150px]" v-model="form.phone_code" :options="phoneCodeOptions" />
            <UInput v-model="form.phone" placeholder="请输入手机号" />
          </div>
        </UFormGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Config } from '@/types/api'
const config = useConfigStore()
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
  return codeList
})
const form = reactive({
  phone_code: '',
  phone: '',
  password: '',
  confirmPassword: ''
})
</script>

