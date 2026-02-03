<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <div class="container mx-auto px-4 py-6 max-w-6xl">
      <!-- 标题 -->
      <div class="text-center mb-6">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          排行榜
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          发现最受欢迎的图鉴和贡献者
        </p>
      </div>

      <!-- 标签页 -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden mb-6">
        <QhxTabs 
          :tabs="navList" 
          :need_swipe="true"
          @change="changeNav"
        >
          <QhxTabPanel :index="0">
            <template #default="{ isActive }">
              <div v-if="isActive" class="p-4 md:p-6">
                <RankContent key="exp" type="exp" />
              </div>
            </template>
          </QhxTabPanel>
          <QhxTabPanel :index="1">
            <template #default="{ isActive }">
              <div v-if="isActive" class="p-4 md:p-6">
                <RankContent key="contribute7" type="contribute7" />
              </div>
            </template>
          </QhxTabPanel>
          <QhxTabPanel :index="2">
            <template #default="{ isActive }">
              <div v-if="isActive" class="p-4 md:p-6">
                <RankContent key="good" type="good" />
              </div>
            </template>
          </QhxTabPanel>
          <QhxTabPanel :index="3">
            <template #default="{ isActive }">
              <div v-if="isActive" class="p-4 md:p-6">
                <RankContent key="collect" type="collect" />
              </div>
            </template>
          </QhxTabPanel>
          <QhxTabPanel :index="4">
            <template #default="{ isActive }">
              <div v-if="isActive" class="p-4 md:p-6">
                <RankContent key="contribute" type="contribute" />
              </div>
            </template>
          </QhxTabPanel>
        </QhxTabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 设置页面标题
useHead({
  title: 'Lo研社 - 排行榜',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,排行榜,图鉴排行榜,贡献排行榜'
    },
    {
      name: 'description',
      content: 'Lo研社排行榜，发现最受欢迎的图鉴和贡献者'
    }
  ]
})

const navList = [
  '等级排行',
  '七日图鉴贡献',
  '点赞排行',
  '收藏排行',
  '图鉴贡献'
]

const currentType = ref<'good' | 'collect' | 'contribute' | 'contribute7' | 'exp'>('exp')

const changeNav = (index: number) => {
  if (index === 0) {
    currentType.value = 'exp'
  } else if (index === 1) {
    currentType.value = 'contribute7'
  } else if (index === 2) {
    currentType.value = 'good'
  } else if (index === 3) {
    currentType.value = 'collect'
  } else if (index === 4) {
    currentType.value = 'contribute'
  }
}
</script>

<style scoped>
/* 响应式调整 */
@media (max-width: 640px) {
  .min-h-screen {
    min-height: 100vh;
    min-height: 100dvh;
  }
}
</style>

