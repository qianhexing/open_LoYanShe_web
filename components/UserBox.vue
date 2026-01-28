<template> 
  <UPopover ref="popover" v-model:open="open" :popper="{ placement: 'bottom-start' }" :ui="{ rounded: 'rounded-[18px]' }" >
    <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name" v-if="user"
          class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2 cursor-pointer transition-transform hover:scale-105" loading="lazy" />
    <template #panel>
      <div class="w-[24rem] bg-white">
        <!-- 用户信息区域 -->
        <div class="p-5 bg-gradient-to-br from-pink-50 to-purple-50 border-b border-gray-100">
          <div class="flex items-center gap-4 mb-4">
            <img 
              :src="`${BASE_IMG}${user.user_face}`" 
              :alt="user.user_name" 
              v-if="user"
              class="w-16 h-16 object-cover rounded-full border-2 border-white shadow-md"
              loading="lazy" 
            />
            <div class="flex-1 min-w-0">
              <div class="text-lg font-semibold text-gray-800 truncate">{{ user?.user_name || '未登录' }}</div>
              <div class="text-sm text-gray-500 mt-1">ID: {{ user?.user_id || '-' }}</div>
            </div>
          </div>
          
          <!-- 经验值和等级显示 -->
          <div v-if="user?.exp !== undefined && levelConfig.length > 0" class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700">等级</span>
                <span class="text-lg font-bold text-pink-600">Lv.{{ user.level || 0 }}</span>
              </div>
              <!-- 星星币显示 -->
              <div v-if="user?.star_coin !== undefined" class="flex items-center gap-1.5 bg-yellow-50 rounded-md px-2 py-1 border border-yellow-200">
                <span class="text-sm font-bold text-yellow-600">星星币</span>
                <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span class="text-sm font-bold text-yellow-600">{{ user.star_coin || 0 }}</span>
              </div>
            </div>
            
            <!-- 经验值显示 -->
            
            <!-- 进度条 -->
            <div class="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                class="absolute inset-y-0 left-0 bg-qhx-primary rounded-full transition-all duration-500 ease-out"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-xs font-medium text-gray-700">{{ progressPercentage.toFixed(1) }}%</span>
              </div>
            </div>
            
            <!-- 当前等级经验范围 -->
            <div class="flex items-center justify-between mt-1">
              <div class="text-sm text-gray-600">
                <span class="font-medium">{{ user.exp || 0 }}</span>
                <span class="text-gray-400"> / {{ nextLevelExp }}</span>
              </div>
              <div class="text-xs text-gray-500" v-if="!isMaxLevel">
                距离下一级还需 {{ Math.max(0, nextLevelExp - (user.exp || 0)) }} 经验
              </div>
              <div class="text-xs text-pink-600 text-right font-medium" v-else>
                已满级！
              </div>
            </div>
          </div>
        </div>

        <!-- 功能菜单区域 -->
        <div class="p-4">
          <div class="grid grid-cols-2 gap-2">
            <button 
              @click="jumpToMySpace()"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-pink-50 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center group-hover:bg-pink-200 transition-colors">
                <svg class="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800">我的空间</div>
                <div class="text-xs text-gray-500">个人主页</div>
              </div>
            </button>

            <button 
              @click="jumpToMyWardrobe()"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-50 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <!-- <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg> -->
                <UIcon name="hugeicons:wardrobe-04" class="text-[20px]" />
              </div>
              <div>
                <div class="font-medium text-gray-800">我的衣柜</div>
                <div class="text-xs text-gray-500">服饰管理</div>
              </div>
            </button>

            <button 
              @click="jumpToAddLibrary()"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-blue-50 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800">补充图鉴</div>
                <div class="text-xs text-gray-500">添加图鉴</div>
              </div>
            </button>

            <button 
              @click="jumpToMyLibrary()"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-green-50 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800">我上传的图鉴</div>
                <div class="text-xs text-gray-500">图鉴管理</div>
              </div>
            </button>

            <button 
              @click="jumpToMyScene()"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-orange-50 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800">3D场景</div>
                <div class="text-xs text-gray-500">场景管理</div>
              </div>
            </button>

            <button 
              @click="jumpToAlbum()"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-yellow-50 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800">成就簿</div>
                <div class="text-xs text-gray-500">成就记录</div>
              </div>
            </button>
          </div>

          <!-- 退出登录按钮 -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <button 
              @click="logout()"
              class="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors font-medium"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'

const popover = ref() // 模板引用
const open = ref(false)
const userStore = storeToRefs(useUserStore()) 
const { user } = userStore
const configStore = useConfigStore()
const router = useRouter()

// 获取等级配置
const levelConfig = computed(() => {
  return configStore.config?.level || []
})

// 计算当前等级
const currentLevel = computed(() => {
  if (!user.value?.exp || levelConfig.value.length === 0) return 1
  const exp = user.value.exp
  for (let i = levelConfig.value.length - 1; i >= 0; i--) {
    if (exp >= levelConfig.value[i]) {
      return i + 1
    }
  }
  return 1
})

// 计算当前等级所需经验（当前等级的最低经验值）
const currentLevelExp = computed(() => {
  if (levelConfig.value.length === 0) return 0
  const level = currentLevel.value
  if (level === 1) return 0
  // level - 2 是因为数组索引从0开始，且等级1对应0经验
  return levelConfig.value[level - 2] || 0
})

// 计算下一级所需经验
const nextLevelExp = computed(() => {
  if (levelConfig.value.length === 0) return 0
  const level = currentLevel.value
  // 如果当前等级已经达到或超过最高等级
  if (level > levelConfig.value.length) {
    // 已满级，返回最高等级的经验值
    return levelConfig.value[levelConfig.value.length - 1]
  }
  // level - 1 是因为数组索引从0开始
  return levelConfig.value[level] || levelConfig.value[1] || 1500
})

// 判断是否已满级
const isMaxLevel = computed(() => {
  if (levelConfig.value.length === 0) return false
  return currentLevel.value > levelConfig.value.length
})

// 计算进度百分比
const progressPercentage = computed(() => {
  if (!user.value?.exp || levelConfig.value.length === 0) return 0
  if (isMaxLevel.value) return 100 // 已满级
  
  const exp = user.value.exp
  const currentExp = currentLevelExp.value
  const nextExp = nextLevelExp.value
  
  if (nextExp === currentExp) return 100 // 防止除零
  
  const progress = ((exp - currentExp) / (nextExp - currentExp)) * 100
  console.log(progress, 'progress')
  return Math.min(Math.max(progress, 0), 100)
})

const jumpToMySpace = () => {
  if (user.value) {
    navigateTo(`/userSpace/${user.value.user_id}`);
  }
  open.value = false
}
const jumpToMyWardrobe = () => {
  if (user.value) {
    navigateTo(`/wardrobe/detail/${user.value.user_id}`);
  }
  open.value = false
}
const jumpToAddLibrary = () => {
  if (user.value) {
    navigateTo('/addLibrary');
  }
  open.value = false
}
const jumpToNotification = () => {
  if (user.value) {
    navigateTo('/message/notification');
  }
  open.value = false
}
const jumpToMyLibrary = () => {
  if (user.value) {
    navigateTo('/library/my');
  }
  open.value = false
}
const jumpToAlbum = () => {
  if (user.value) {
    navigateTo('/album');
  }
  open.value = false
}
const logout = () => {
  useUserStore().clearToken()
  open.value = false
}
const jumpToMyScene = () => {
  if (user.value) {
    navigateTo('/user/sence');
  }
  open.value = false
}

</script>

<style scoped>
/* 可以添加自定义样式 */
</style>