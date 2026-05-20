<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      <div class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-pink-200/30 to-purple-200/30 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full blur-3xl animate-blob"></div>
      <div class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/20 to-pink-200/20 dark:from-blue-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-purple-200/20 to-pink-200/30 dark:from-purple-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
    </div>

    <!-- 加载状态 -->
    <template v-if="loading">
      <div class="relative z-10 flex flex-col items-center justify-center min-h-screen">
        <div class="relative">
          <div class="w-16 h-16 border-4 border-pink-100 rounded-full"></div>
          <div class="absolute top-0 left-0 w-16 h-16 border-4 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">加载中...</p>
      </div>
    </template>
    <template v-else-if="userInfo">
      <div class="relative z-10 pb-32">
      <!-- 徽章区（有徽章时缩小）+ 用户信息（始终完整显示在下方） -->
      <div class="max-w-4xl mx-auto px-1 md:px-8 pt-2 flex flex-col gap-2">
        <div
          v-if="configStore.statusBarHeight > 0":style="{ height: `${configStore.statusBarHeight}px` }"
        />
        <!-- 徽章物理展示：有徽章时显示（缩小区域） -->
        <div
          v-if="hasDisplayBadges"
          class="badge-showcase badge-showcase--has-badges rounded-2xl overflow-hidden relative"
        >
          <AchievementBadgePhysics :key="displayBadgesKey" :badges="displayBadges" :badge-size="40" :spawn-interval="400" motion-preset="wallBounce" />
          <!-- 悬浮在徽章区右上角的配置按钮 -->
          <button
            v-if="isCurrentUser"
            type="button"
            class="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 bg-white/80 dark:bg-gray-800/80 shadow-md border border-gray-200/60 dark:border-gray-600/60 text-pink-500 hover:bg-pink-50 dark:hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
            @click="openDecoConfig"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 flex-shrink-0" />
            <span class="text-sm font-medium">配置徽章</span>
          </button>
        </div>

        <!-- 用户信息卡片：始终完整显示（参考下方帖子卡片样式） -->
        <div class="user-info-card rounded-2xl overflow-hidden backdrop-blur-md shadow-lg border border-white/50 dark:border-gray-700 bg-white/45 dark:bg-gray-800/45 flex flex-col px-4 py-4 md:px-6 md:py-5">
          <div class="flex items-center gap-4 md:gap-5">
            <UserFace :user="userInfo" size="mini" class="flex-shrink-0 scale-125" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <h1 class="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
                    {{ userInfo.user_name || '未设置昵称' }}
                  </h1>
                  <QhxTag
                    :active="isFormalResident"
                    class="text-xs flex-shrink-0 whitespace-nowrap"
                  >
                    {{ isFormalResident ? '正式居民' : '临时居民' }}
                  </QhxTag>
                </div>
                <div
                  v-if="showUserSpaceHeaderActions"
                  class="flex items-center gap-2 flex-shrink-0"
                >
                  <div v-if="!isCurrentUser && spaceUserId">
                    <UserCollectBtn
                      variant="follow"
                      :pk_type="PK_TYPE_USER_COLLECT"
                      :pk_id="spaceUserId"
                      :collect_count="userInfo.collect_count ?? 0"
                      :is_collect="userCollectIsCollect"
                      :need_judge="true"
                    />
                  </div>
                  <button
                    v-if="userSpaceMoreMenuItems.length"
                    type="button"
                    class="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm hover:bg-pink-100 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-100"
                    @click="openUserSpaceMoreMenu"
                  >
                    <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4 text-pink-500 dark:text-pink-400" />
                    <span>更多</span>
                  </button>
                </div>
              </div>
                  <div v-if="userInfo.signature" class="signature-preview">
                    <div
                      class="text-gray-600 dark:text-gray-300 text-sm italic line-clamp-3 cursor-pointer hover:bg-white/20 dark:hover:bg-gray-700/20 rounded px-1 -mx-1 py-0.5 -my-0.5 transition-colors"
                      @click="showSignatureModal = true"
                    >
                      <SafeRichText :nodes="signatureNodes" />
                    </div>
                  </div>
                  <p v-else class="text-gray-400 dark:text-gray-500 text-xs">
                    暂无签名
                  </p>
                  <!-- 主风格标签 -->
                  <div v-if="userInfo.main_style?.length" class="flex flex-nowrap gap-2 mt-2 overflow-x-auto min-w-0 scrollbar-thin">
                    <QhxTag v-for="(style, idx) in userInfo.main_style" :key="idx" class="text-xs flex-shrink-0"># {{ getStyleLabel(style) }}</QhxTag>
                  </div>
                  <!-- 位置 -->
                  <div v-if="(userInfo.show_area && (userInfo.province || userInfo.city)) || (isCurrentUser && !userInfo.main_style?.length)" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span v-if="userInfo.show_area && (userInfo.province || userInfo.city)">📍 {{ [userInfo.province, userInfo.city].filter(Boolean).join(' ') }}</span>
                    <span v-else-if="isCurrentUser">未设置</span>
                  </div>
                </div>
              </div>
            </div>

        <!-- Tab 栏 -->
        <div class="mt-2">
          <QhxTabs :tabs="spaceTabs" :need_swipe="false" class="bg-transparent">
            <QhxTabPanel :index="0">
              <template #default="{ isActive }">
                <!-- 帖子列表 -->
                <div v-show="isActive" class="mt-4 space-y-4">
                  <div v-if="postsLoading" class="flex justify-center py-12">
                    <div class="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></div>
                  </div>
                  <div v-else-if="postList.length > 0" class="space-y-4">
                    <div
                      v-for="post in postList"
                      :key="post.community_id"
                      class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg border border-white/50 dark:border-gray-700"
                    >
                      <CommunityItem :item="post" :size="'big'" />
                    </div>
                    <div v-if="hasMorePosts" class="flex justify-center py-4">
                      <button
                        @click="loadMorePosts"
                        :disabled="postsLoadingMore"
                        class="px-6 py-2 rounded-full bg-pink-100 dark:bg-gray-700 text-pink-600 dark:text-pink-300 text-sm font-medium hover:bg-pink-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        {{ postsLoadingMore ? '加载中...' : '加载更多' }}
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-center py-16 text-gray-500 dark:text-gray-400">
                    <div class="text-5xl mb-4">📝</div>
                    <p>暂无帖子</p>
                  </div>
                </div>
              </template>
            </QhxTabPanel>
            <QhxTabPanel :index="1">
              <template #default="{ isActive }">
                <!-- 衣柜列表 -->
                <div v-show="isActive" class="mt-4">
                  <QhxWaterList
                    v-if="layoutReady && isActive"
                    :fetch-data="async (page, pageSize) => {
                      const userId = spaceUserId
                      if (!userId) {
                        return { rows: [], count: 0 }
                      }
                      try {
                        const res = await getWardrobeList({
                          user_id: userId,
                          page,
                          pageSize,
                        })
                        const rows = (res.rows ?? []).map((w) => ({ ...w, user_id: w.user_id ?? userId }))
                        return { rows, count: res.count ?? 0 }
                      } catch (error) {
                        console.error('获取衣柜列表失败:', error)
                        toast.add({
                          title: '获取衣柜失败',
                          description: getErrorMessage(error),
                          icon: 'i-heroicons-x-circle',
                          color: 'red',
                        })
                        return { rows: [], count: 0 }
                      }
                    }"
                    :columns="4"
                    :item-key="1"
                    :columns_768="2"
                    :enable-waterfall="true"
                    :enable-load-more="true"
                  >
                    <template #default="{ item, debouncedApplyLayout }">
                      <div class="px-2 pb-4">
                        <div class="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg border border-white/50 dark:border-gray-700 p-2">
                          <template v-if="!isCurrentUser && (item.is_private === 1 || item.password)">
                            <!-- 隐私衣柜：点击弹出密码弹窗；封面加载后触发瀑布流重算（WaterList 内已 debounce） -->
                            <div
                              class="relative cursor-pointer"
                              @click="openWardrobePasswordModal(item, $event)"
                            >
                              <img
                                :src="`${BASE_IMG}${item.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
                                :alt="item.wardrobe_name"
                                class="w-full rounded-[10px] border border-gray-200 dark:border-gray-600 my-2 opacity-60"
                                loading="lazy"
                                @load="debouncedApplyLayout"
                              />
                              <div class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 dark:bg-gray-900/60 rounded-[10px]">
                                <UIcon name="i-heroicons-lock-closed" class="w-10 h-10 text-white/95 mb-1" />
                                <span class="text-xs text-white/95">隐私衣柜</span>
                              </div>
                              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full">
                                {{ item.wardrobe_name }}
                              </h3>
                            </div>
                          </template>
                          <WardrobeItem
                            v-else
                            :item="item"
                            :size="'big'"
                            :need-jump="true"
                            @image-load="debouncedApplyLayout"
                          />
                        </div>
                      </div>
                    </template>
                    <template #empty>
                      <div class="text-center py-16 text-gray-500 dark:text-gray-400">
                        <div class="text-5xl mb-4">👗</div>
                        <p>暂无衣柜</p>
                      </div>
                    </template>
                  </QhxWaterList>
                </div>
              </template>
            </QhxTabPanel>
            <QhxTabPanel v-if="showAchieveTab" :index="2">
              <template #default="{ isActive }">
                <div v-show="isActive" class="mt-4 space-y-4">
                  <div v-if="achievementStatsLoading" class="flex justify-center py-8">
                    <div class="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
                  </div>
                  <div
                    v-else-if="achievementStats"
                    class="rounded-2xl border border-white/50 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-4 shadow-lg"
                  >
                    <div class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <span>✨</span>
                      成就进度
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <div class="text-lg font-bold text-pink-600 dark:text-pink-300">
                          {{ achievementStats.points }}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">成就点</div>
                      </div>
                      <div>
                        <div class="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {{ achievementStats.achieved_count }}<span class="text-gray-400">/</span>{{ achievementStats.total_count }}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">已达成</div>
                      </div>
                      <div class="col-span-2">
                        <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                          <div
                            class="h-full bg-pink-500 dark:bg-pink-400 rounded-full transition-all"
                            :style="{ width: `${achievementStats.progress}%` }"
                          />
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                          {{ achievementStats.progress }}% 完成
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="achieveAlbumsLoading" class="flex justify-center py-12">
                    <div class="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
                  </div>
                  <div v-else-if="achieveAlbumList.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div
                      v-for="item in achieveAlbumList"
                      :key="item.album_id"
                      class="cursor-pointer rounded-2xl overflow-hidden border border-white/50 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 shadow-lg hover:opacity-90 transition-opacity"
                      @click="goUserSpaceAlbumDetail(item)"
                    >
                      <img
                        :src="`${BASE_IMG}${item.album_cover || 'static/plan_cover/default.jpg'}`"
                        :alt="item.album_title"
                        class="w-full aspect-[4/3] object-cover"
                        loading="lazy"
                      />
                      <div class="p-2 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {{ item.album_title }}
                      </div>
                    </div>
                  </div>
                  <div v-if="hasMoreAchieveAlbums && !achieveAlbumsLoading" class="flex justify-center py-4">
                    <button
                      type="button"
                      :disabled="achieveAlbumsLoadingMore"
                      class="px-6 py-2 rounded-full bg-pink-100 dark:bg-gray-700 text-pink-600 dark:text-pink-300 text-sm font-medium hover:bg-pink-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                      @click="loadMoreAchieveAlbums"
                    >
                      {{ achieveAlbumsLoadingMore ? '加载中...' : '加载更多' }}
                    </button>
                  </div>
                  <div
                    v-if="!achieveAlbumsLoading && achieveAlbumList.length === 0"
                    class="text-center py-16 text-gray-500 dark:text-gray-400"
                  >
                    <div class="text-5xl mb-4">🏆</div>
                    <p>暂无成就相册</p>
                  </div>
                </div>
              </template>
            </QhxTabPanel>
          </QhxTabs>
        </div>
      </div>
    </div>
    </template>
    <template v-else-if="!loading && !userInfo">
    <div class="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-700 max-w-md w-full">
        <div class="text-6xl mb-6">😕</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">用户不存在</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-8">抱歉，找不到该用户信息。</p>
        <button 
          @click="router.back()"
          class="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
        >
          返回
        </button>
      </div>
    </div>
    </template>
    <!-- 配置徽章弹窗 -->
    <AchievementDecoConfigModal
      v-if="isCurrentUser"
      v-model="decoConfigModalOpen"
      :trigger-position="decoModalPosition"
      :initial-selected-ids="decoInitialSelectedIds"
      @saved="onDecoSaved"
    />

    <!-- 签名完整内容弹窗 -->
    <QhxModal v-model="showSignatureModal" @close="showSignatureModal = false">
      <div class="w-[95vw] max-w-md max-h-[70vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span class="text-pink-500">✍️</span>
            个人签名
          </h3>
          <button
            type="button"
            @click="showSignatureModal = false"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <!-- 内容区 -->
        <div class="flex-1 overflow-y-auto p-5">
          <div v-if="signatureNodes.length" class="text-gray-600 dark:text-gray-300 text-sm italic leading-relaxed">
            <SafeRichText :nodes="signatureNodes" />
          </div>
          <p v-else class="text-gray-400 dark:text-gray-500 text-sm">暂无签名</p>

          <!-- 标签与地区完整展示：分两行 -->
          <div v-if="userInfo && (userInfo.main_style?.length || (userInfo.show_area && (userInfo.province || userInfo.city)) || (isCurrentUser && !(userInfo.show_area && (userInfo.province || userInfo.city))))" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <!-- 主风格标签 -->
            <div v-if="userInfo.main_style?.length" class="flex flex-wrap gap-2">
              <QhxTag v-for="(style, idx) in userInfo.main_style" :key="idx" class="text-xs"># {{ getStyleLabel(style) }}</QhxTag>
            </div>
            <!-- 位置 -->
            <div v-if="(userInfo.show_area && (userInfo.province || userInfo.city)) || (isCurrentUser && !(userInfo.show_area && (userInfo.province || userInfo.city)))" class="text-xs text-gray-500 dark:text-gray-400">
              <span v-if="userInfo.show_area && (userInfo.province || userInfo.city)">📍 {{ [userInfo.province, userInfo.city].filter(Boolean).join(' ') }}</span>
              <span v-else-if="isCurrentUser">未设置</span>
            </div>
          </div>
        </div>
        <!-- 底部 -->
        <!-- <div class="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <UButton class="w-full" color="gray" variant="soft" size="sm" @click="showSignatureModal = false">
            关闭
          </UButton>
        </div> -->
      </div>
    </QhxModal>

    <!-- 隐私衣柜密码弹窗 -->
    <QhxModal
      v-model="showWardrobePasswordModal"
      :trigger-position="wardrobePasswordModalPosition"
      @close="onWardrobePasswordModalClose"
    >
      <div class="p-6 w-[400px] bg-white dark:bg-gray-800 rounded-[10px] max-h-[50vh] overflow-y-auto">
        <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">请输入衣柜密码</h3>
        <p v-if="pendingWardrobe" class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {{ pendingWardrobe.wardrobe_name }}
        </p>
        <UInput
          v-model="wardrobePassword"
          type="password"
          placeholder="请输入密码"
          class="flex-1 focus:ring-0 mb-4"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }"
          @keyup.enter="confirmWardrobePassword"
        />
        <UButton
          type="button"
          block
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          :loading="wardrobePasswordChecking"
          :disabled="!wardrobePassword.trim()"
          @click="confirmWardrobePassword"
        >
          确定
        </UButton>
      </div>
    </QhxModal>

    <!-- 更多选项（与衣柜详情页 QhxModal 样式一致） -->
    <QhxModal v-model="showUserSpaceMoreMenu" :trigger-position="userSpaceMoreMenuPosition">
      <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">更多选项</h3>

        <button
          v-for="(item, index) in userSpaceMoreMenuItems"
          :key="item.key"
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
          :class="index > 0 ? 'mt-2' : ''"
          @click="onUserSpaceMoreItemClick(item, $event)"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform bg-gradient-to-br"
            :class="item.iconBgClass"
          >
            <UIcon :name="item.icon" class="text-base text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ item.label }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ item.desc }}</div>
          </div>
        </button>
      </div>
    </QhxModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, inject, type Ref } from 'vue'
import { getUserSpace, getUserDecoBadges, adminUpgradeUserFormalResident } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import { getCommunityList } from '@/api/community'
import { getAlbumList, getAlbumAchievementStats, type AlbumAchievementStats } from '@/api/album'
import { getWardrobeList, checkWadrobePassword } from '@/api/wardrobe'
import { parseRichText } from '@/utils/public'
import SafeRichText from '@/components/SafeRichText.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import { useUserStore } from '@/stores/user'
import type { User, Community, UserDeco, Wardrobe, Album } from '@/types/api'
import WardrobeItem from '@/components/Wardrobe/WardrobeItem.vue'
import UserCollectBtn from '@/components/user/CollectBtn.vue'

/** 收藏/关注用户：与后端 collect 表 pk_type 约定为 0 */
const PK_TYPE_USER_COLLECT = 0

/** 将 UserDecoBadgeItem 转为 UserDeco */
function badgeToUserDeco(item: UserDecoBadgeItem): UserDeco {
  const cover = item.cover || item.url || 'static/plan_cover/default.jpg'
  const name = item.title ?? `徽章${item.deco_id}`
  return {
    deco_id: item.deco_id,
    pk_type: 1,
    pk_id: item.deco_id,
    foreign: { cover, name },
  }
}

// 用户空间徽章数据
const userBadges = ref<UserDecoBadgeItem[]>([])
const userBadgesLoading = ref(false)
const displayBadgeStr = ref('')

const fetchUserBadges = async () => {
  const userId = spaceUserId.value
  if (!userId) {
    userBadges.value = []
    displayBadgeStr.value = ''
    return
  }
  userBadgesLoading.value = true
  try {
    const res = await getUserDecoBadges({ user_id: userId })
    userBadges.value = res.rows ?? []
    displayBadgeStr.value = res.display_badge ?? ''
  } catch (e) {
    console.error('获取用户徽章失败:', e)
    userBadges.value = []
    displayBadgeStr.value = ''
  } finally {
    userBadgesLoading.value = false
  }
}

// 展示的徽章：从用户数据中取 is_displayed=1 的，转为 UserDeco
const displayBadges = computed<UserDeco[]>(() => {
  const list = userBadges.value
  const displayed = list.filter((d) => d.is_displayed === 1)
  return displayed.map(badgeToUserDeco)
})

const hasDisplayBadges = computed(() => displayBadges.value.length > 0)
const displayBadgesKey = computed(() => displayBadgeStr.value || (displayBadges.value.length ? displayBadges.value.map((b) => b.deco_id).join(',') : 'empty'))
const badgesLoaded = computed(() => !userBadgesLoading.value)

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()
const configStore = useConfigStore()
const loading = ref(true)
const userInfo = ref<(User & {
  signature?: string
  main_style?: Array<{ label: string; value: number }>
  province?: string
  city?: string
  area?: string
  show_area?: number | boolean
  is_achieve?: number | boolean
  collect_count?: number
  is_collect?: number | boolean
}) | null>(null)

// 个人签名富文本节点
const signatureNodes = computed(() => {
  const sig = userInfo.value?.signature
  if (!sig) return []
  try {
    return parseRichText((sig || '').replace(/\n/g, '<br>'))
  } catch {
    return []
  }
})

// 签名弹窗
const showSignatureModal = ref(false)
const openSignatureModal = () => {
  if (userInfo.value?.signature) showSignatureModal.value = true
}

// 判断是否是当前用户
const isCurrentUser = computed(() => {
  const userId = route.params.id ? Number.parseInt(route.params.id as string) : null
  const currentUserId = userStore.user?.user_id
  return userId && currentUserId && userId === currentUserId
})

/** 个人空间标题栏：他人页显示关注；本人或管理员菜单显示「更多」 */
const showUserSpaceHeaderActions = computed(
  () =>
    Boolean(
      (!isCurrentUser.value && spaceUserId.value) ||
        userSpaceMoreMenuItems.value.length,
    ),
)

/** 用户空间接口若返回 is_collect（0/1），供收藏按钮初始态；need_judge 仍会拉取最新状态 */
const userCollectIsCollect = computed(() => {
  const v = userInfo.value?.is_collect
  return v === true || v === 1
})

/** 与后端约定：拥有此项权限才可执行「升级为正式居民」 */
const USER_SPACE_PERM_UPGRADE_FORMAL = 'admin:user:upgrade'

const spaceUserNeedsFormalUpgrade = computed(() => {
  const level = userInfo.value?.access_level ?? 0
  return level < 1
})

/** 与升级菜单同一判定：access_level >= 1 为正式居民 */
const isFormalResident = computed(() => !spaceUserNeedsFormalUpgrade.value)

function isUserAchieveVisible(v: unknown): boolean {
  return v === 1 || v === true
}

/** 用户资料「展示成就簿」开启时，个人空间显示成就 Tab */
const showAchieveTab = computed(() => isUserAchieveVisible(userInfo.value?.is_achieve))

const spaceTabs = computed((): string[] =>
  showAchieveTab.value ? ['帖子', '衣柜', '成就'] : ['帖子', '衣柜'],
)

type UserSpaceMoreMenuItem = {
  key: string
  label: string
  desc: string
  icon: string
  /** Tailwind gradient 色向，与 `bg-gradient-to-br` 组合 */
  iconBgClass: string
  run: (e?: MouseEvent) => void
}

const showUserSpaceMoreMenu = ref(false)
const userSpaceMoreMenuPosition = ref({ x: 0, y: 0 })

const openUserSpaceMoreMenu = (e: MouseEvent) => {
  userSpaceMoreMenuPosition.value = {
    x: e.clientX + 50,
    y: e.clientY,
  }
  showUserSpaceMoreMenu.value = true
}

/** 个人空间右上角「更多」动态菜单：本人操作时含编辑/配置徽章；管理员在满足条件时含升级正式居民（含代他人升级） */
const userSpaceMoreMenuItems = computed((): UserSpaceMoreMenuItem[] => {
  if (!userInfo.value) return []
  const uid = spaceUserId.value
  if (!uid) return []

  const items: UserSpaceMoreMenuItem[] = []

  if (isCurrentUser.value) {
    if (!hasDisplayBadges.value) {
      items.push({
        key: 'deco',
        label: '配置徽章',
        desc: '选择要展示的成就徽章',
        icon: 'i-heroicons-cog-6-tooth',
        iconBgClass: 'from-purple-500 to-pink-500',
        run: (e) => openDecoConfig(e),
      })
    }
    items.push({
      key: 'edit',
      label: '编辑',
      desc: '修改昵称、签名与个人资料',
      icon: 'i-heroicons-pencil-square',
      iconBgClass: 'from-amber-500 to-orange-500',
      run: () => handleEdit(),
    })
  }

  if (
    userStore.hasPermi(USER_SPACE_PERM_UPGRADE_FORMAL) &&
    spaceUserNeedsFormalUpgrade.value
  ) {
    items.push({
      key: 'upgradeFormal',
      label: '升级为正式居民',
      desc: '为该用户开通正式居民权限',
      icon: 'i-heroicons-arrow-trending-up',
      iconBgClass: 'from-blue-500 to-cyan-500',
      run: () => void handleUpgradeFormalResident(),
    })
  }

  return items
})

const onUserSpaceMoreItemClick = (item: UserSpaceMoreMenuItem, e: MouseEvent) => {
  showUserSpaceMoreMenu.value = false
  item.run(e)
}

const upgradeFormalLoading = ref(false)

const handleUpgradeFormalResident = async () => {
  const uid = spaceUserId.value
  if (!uid || upgradeFormalLoading.value) return
  if (typeof window !== 'undefined' && !window.confirm('确认为该用户升级为正式居民？')) return
  upgradeFormalLoading.value = true
  try {
    await adminUpgradeUserFormalResident({ user_id: uid })
    toast.add({
      title: '已升级为正式居民',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    await loadUserInfo()
    if (isCurrentUser.value) {
      await userStore.fetchUserInfo()
    }
  } catch (error) {
    console.error('升级正式居民失败:', error)
    toast.add({
      title: '操作失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    upgradeFormalLoading.value = false
  }
}

const formatImg = (url: string) => {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

// 主风格标签展示：支持 { label, value } 或 string
const getStyleLabel = (s: unknown) =>
  typeof s === 'object' && s && 'label' in s ? (s as { label: string }).label : String(s ?? '')

// 编辑按钮点击事件
const handleEdit = () => {
  router.push('/user/edit')
}

// 配置徽章弹窗
const decoConfigModalOpen = ref(false)
const decoModalPosition = ref({ x: 0, y: 0 })
const decoInitialSelectedIds = computed(() =>
  displayBadgeStr.value
    ? displayBadgeStr.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : []
)
const openDecoConfig = (e?: MouseEvent) => {
  if (e) decoModalPosition.value = { x: e.clientX, y: e.clientY }
  else if (typeof window !== 'undefined') decoModalPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  decoConfigModalOpen.value = true
}
const onDecoSaved = () => fetchUserBadges()

// 隐私衣柜密码弹窗
const showWardrobePasswordModal = ref(false)
const wardrobePassword = ref('')
const pendingWardrobe = ref<Wardrobe | null>(null)
const wardrobePasswordModalPosition = ref({ x: 0, y: 0 })
const wardrobePasswordChecking = ref(false)

const openWardrobePasswordModal = (wardrobe: Wardrobe, e: MouseEvent) => {
  if (!wardrobe?.wardrobe_id || !wardrobe?.user_id) return
  pendingWardrobe.value = wardrobe
  wardrobePassword.value = ''
  wardrobePasswordModalPosition.value = { x: e.clientX, y: e.clientY }
  showWardrobePasswordModal.value = true
}

const onWardrobePasswordModalClose = () => {
  wardrobePassword.value = ''
  pendingWardrobe.value = null
}

const confirmWardrobePassword = async () => {
  const w = pendingWardrobe.value
  const pwd = wardrobePassword.value.trim()
  if (!w?.wardrobe_id || !w?.user_id || !pwd) return

  wardrobePasswordChecking.value = true
  try {
    const ok = await checkWadrobePassword({
      wardrobe_id: w.wardrobe_id,
      password: pwd,
    })
    if (ok) {
      showWardrobePasswordModal.value = false
      onWardrobePasswordModalClose()
      router.push({
        path: `/wardrobe/detail/${w.user_id}`,
        query: { wardrobe_id: String(w.wardrobe_id), password: pwd },
      })
    } else {
      toast.add({
        title: '密码错误',
        description: '请输入正确的衣柜密码',
        icon: 'i-heroicons-x-circle',
        color: 'red',
      })
    }
  } catch (error) {
    console.error('校验衣柜密码失败:', error)
    toast.add({
      title: '校验失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    wardrobePasswordChecking.value = false
  }
}

// 加载用户信息
const loadUserInfo = async () => {
  try {
    loading.value = true
    
    const userId = route.params.id ? Number.parseInt(route.params.id as string) : null
    
    if (!userId || Number.isNaN(userId)) {
      toast.add({
        title: '参数错误',
        description: '缺少用户ID参数',
        icon: 'i-heroicons-x-circle',
        color: 'red'
      })
      loading.value = false
      return
    }

    const data = await getUserSpace({ user_id: userId })
    userInfo.value = data as typeof userInfo.value
  } catch (error) {
    console.error('获取用户信息失败:', error)
    toast.add({
      title: '获取用户信息失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
    userInfo.value = null
  } finally {
    loading.value = false
  }
}

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

// 帖子列表相关
const postList = ref<Community[]>([])
const postsLoading = ref(false)
const postsLoadingMore = ref(false)
const postsPage = ref(1)
const postsPageSize = 10
const postsTotal = ref(0)

const spaceUserId = computed(() => {
  const id = route.params.id ? Number.parseInt(route.params.id as string) : null
  return id && !Number.isNaN(id) ? id : null
})

const hasMorePosts = computed(() => postList.value.length < postsTotal.value)

const achievementStats = ref<AlbumAchievementStats | null>(null)
const achievementStatsLoading = ref(false)
const achieveAlbumList = ref<Album[]>([])
const achieveAlbumsLoading = ref(false)
const achieveAlbumsLoadingMore = ref(false)
const achieveAlbumPage = ref(1)
const achieveAlbumPageSize = 10
const achieveAlbumTotal = ref(0)

const hasMoreAchieveAlbums = computed(
  () => achieveAlbumList.value.length < achieveAlbumTotal.value,
)

const resetAchievementTab = () => {
  achievementStats.value = null
  achievementStatsLoading.value = false
  achieveAlbumList.value = []
  achieveAlbumsLoading.value = false
  achieveAlbumsLoadingMore.value = false
  achieveAlbumPage.value = 1
  achieveAlbumTotal.value = 0
}

const loadAchievementStats = async () => {
  const uid = spaceUserId.value
  if (!uid) return
  achievementStatsLoading.value = true
  try {
    achievementStats.value = await getAlbumAchievementStats({ user_id: uid })
  } catch (e) {
    console.error('获取成就统计失败:', e)
    achievementStats.value = null
  } finally {
    achievementStatsLoading.value = false
  }
}

const loadAchieveAlbums = async (isLoadMore = false) => {
  const uid = spaceUserId.value
  if (!uid) return
  if (isLoadMore) {
    if (achieveAlbumsLoadingMore.value || achieveAlbumList.value.length >= achieveAlbumTotal.value) return
    achieveAlbumsLoadingMore.value = true
  } else {
    achieveAlbumsLoading.value = true
    achieveAlbumPage.value = 1
    achieveAlbumList.value = []
  }
  try {
    const res = await getAlbumList({
      page: achieveAlbumPage.value,
      pageSize: achieveAlbumPageSize,
      parent_id: 0,
      user_id: uid,
    })
    achieveAlbumTotal.value = res.count ?? 0
    const rows = res.rows ?? []
    if (isLoadMore) {
      achieveAlbumList.value.push(...rows)
    } else {
      achieveAlbumList.value = rows
    }
  } catch (error) {
    console.error('获取成就相册列表失败:', error)
    toast.add({
      title: '获取成就相册失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
    if (!isLoadMore) {
      achieveAlbumList.value = []
      achieveAlbumTotal.value = 0
    }
  } finally {
    achieveAlbumsLoading.value = false
    achieveAlbumsLoadingMore.value = false
  }
}

const loadMoreAchieveAlbums = async () => {
  if (!hasMoreAchieveAlbums.value || achieveAlbumsLoadingMore.value) return
  achieveAlbumPage.value += 1
  await loadAchieveAlbums(true)
}

const goUserSpaceAlbumDetail = (album: Album) => {
  const uid = spaceUserId.value
  if (!album.album_id) return
  if (uid) {
    router.push({ path: `/album/detail/${album.album_id}`, query: { user_id: String(uid) } })
  } else {
    router.push(`/album/detail/${album.album_id}`)
  }
}

// 加载帖子列表
const loadPosts = async (isLoadMore = false) => {
  const userId = spaceUserId.value
  if (!userId) return

  if (isLoadMore) {
    if (postsLoadingMore.value || !hasMorePosts.value) return
    postsLoadingMore.value = true
  } else {
    postsLoading.value = true
    postsPage.value = 1
    postList.value = []
  }

  try {
    const res = await getCommunityList({
      user_id: userId,
      page: postsPage.value,
      pageSize: postsPageSize,
    })
    postsTotal.value = res.count ?? 0
    const rows = res.rows ?? []
    if (isLoadMore) {
      postList.value.push(...rows)
    } else {
      postList.value = rows
    }
  } catch (error) {
    console.error('获取帖子列表失败:', error)
    toast.add({
      title: '获取帖子失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    postsLoading.value = false
    postsLoadingMore.value = false
  }
}

// 加载更多帖子
const loadMorePosts = async () => {
  postsPage.value += 1
  await loadPosts(true)
}

// 用户信息加载完成后加载帖子和徽章（衣柜由 QhxWaterList 按需加载）
watch(userInfo, (info) => {
  if (info?.user_id) {
    loadPosts()
    fetchUserBadges()
    if (isUserAchieveVisible(info.is_achieve)) {
      void loadAchievementStats()
      void loadAchieveAlbums(false)
    } else {
      resetAchievementTab()
    }
  } else {
    postList.value = []
    postsTotal.value = 0
    userBadges.value = []
    displayBadgeStr.value = ''
    resetAchievementTab()
  }
}, { immediate: true })

onMounted(() => {
  if (layoutReady.value) {
    loadUserInfo()
  }
})
const layoutReady = inject('layoutReady') as Ref<boolean>
watch(layoutReady, (newVal) => {
  if (newVal) {
    loadUserInfo()
  }
})
// 监听路由参数变化，当 id 改变时重新加载数据
watch(() => route.params.id, () => {
  loadUserInfo()
})


useHead({
  title: computed(() => {
    if (userInfo.value?.user_name) {
      return `${userInfo.value.user_name} - 用户空间 - Lo研社`
    }
    return '用户空间 - Lo研社'
  }),
})
</script>

<style scoped>
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}

/* 徽章展示区 - 用户信息悬浮其上，缩减高度 */
.badge-showcase {
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 140px;
  background: linear-gradient(180deg, rgba(255, 248, 248, 0.95) 0%, rgba(254, 242, 242, 0.85) 50%, rgba(255, 250, 250, 0.95) 100%);
  overflow: hidden;
}
/* 签名预览：预留 3 行以上空间，内层 div 已有 line-clamp-3 */
.signature-preview {
  min-height: 4.5rem;
}

.dark .badge-showcase {
  background: linear-gradient(180deg, rgba(30, 30, 30, 0.95) 0%, rgba(40, 35, 40, 0.85) 50%, rgba(35, 30, 35, 0.95) 100%);
}

/* 有徽章时：缩小徽章展示区域 */
.badge-showcase--has-badges {
  aspect-ratio: 4 / 1;
  min-height: 100px;
}

/* 有徽章时：缩小徽章展示区域 */
.badge-showcase--has-badges {
  aspect-ratio: 16 / 6;
  min-height: 100px;
}
</style>
