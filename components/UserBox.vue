<template> 
  <UPopover ref="popover" v-model:open="open" :popper="{ placement: 'bottom-start' }" :ui="{ rounded: 'rounded-[18px]' }"" >
    <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name" v-if="user"
          class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" />
    <template #panel>
      <div class="p-6 w-[22rem]">
        <h3 class="text-lg font-semibold mb-4">登录账号</h3>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const popover = ref() // 模板引用
const open = ref(false)
const userStore = storeToRefs(useUserStore()) 
const { user } = userStore

const loading = ref(false)

const  onSubmit = async () => {
}

</script>

<style scoped>
/* 可以添加自定义样式 */
</style>