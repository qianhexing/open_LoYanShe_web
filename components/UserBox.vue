<template> 
  <UPopover ref="popover" v-model:open="open" :popper="{ placement: 'bottom-start' }" :ui="{ rounded: 'rounded-[18px]' }"" >
    <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name" v-if="user"
          class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" />
    <template #panel>
      <div class="p-6 w-[22rem] text-center">
        <div class="p-3 cursor-pointer" @click="jumpToMyWardrobe()">我的衣柜</div>
        <div class="p-3 cursor-pointer" @click="jumpToAddLibrary()">补充图鉴</div>

        <div class="p-3 cursor-pointer" @click="jumpToMyLibrary()">我上传的图鉴</div>
        
        <!-- <div class="p-3 cursor-pointer" @click="jumpToMyWardrobe()">工作流</div> -->
        <!-- <div class="p-3 cursor-pointer" @click="jumpToNotification()">通知</div> -->


        <div class="p-3 cursor-pointer" @click="logout()">退出登录</div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const popover = ref() // 模板引用
const open = ref(false)
const userStore = storeToRefs(useUserStore()) 
const { user } = userStore
const router = useRouter();

const jumpToMyWardrobe = () => {
  if (user.value) {
    navigateTo(`/wardrobe/detail/${user.value.user_id}`);
  }
}
const jumpToAddLibrary = () => {
  if (user.value) {
    navigateTo('/addLibrary');
  }
}
const jumpToNotification = () => {
  if (user.value) {
    navigateTo('/message/notification');
  }
}
const jumpToMyLibrary = () => {
  if (user.value) {
    navigateTo('/library/my');
  }
}
const logout = () => {
  useUserStore().clearToken()
}
const loading = ref(false)

const  onSubmit = async () => {
}

</script>

<style scoped>
/* 可以添加自定义样式 */
</style>