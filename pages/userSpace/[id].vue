<template>
  <div
    ref="pageRoot"
    class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif"
  >
    <!-- 动态背景（带视差层） -->
    <div ref="bgLayer" class="fixed inset-0 pointer-events-none z-0 will-change-transform">
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
        <div class="max-w-4xl mx-auto px-2 md:px-8 pt-2 flex flex-col gap-3">
          <div
            v-if="configStore.statusBarHeight > 0"
            :style="{ height: `${configStore.statusBarHeight}px` }"
          />

          <!-- ===== Hero 个人信息卡 ===== -->
          <section
            ref="heroRef"
            class="hero-card relative rounded-3xl overflow-hidden shadow-xl border border-white/60 dark:border-gray-700/70 bg-white/55 dark:bg-gray-800/55 backdrop-blur-xl"
          >
            <!-- 顶部 Banner：有徽章时展示徽章物理动画，否则渐变装饰 -->
            <div
              class="hero-banner relative w-full overflow-hidden"
              :class="hasDisplayBadges ? 'h-[120px] md:h-[150px]' : 'h-[96px] md:h-[120px]'"
            >
              <template v-if="hasDisplayBadges">
                <div class="absolute inset-0 hero-banner-bg">
                  <AchievementBadgePhysics
                    :key="displayBadgesKey"
                    :badges="displayBadges"
                    :badge-size="40"
                    :spawn-interval="400"
                    motion-preset="wallBounce"
                  />
                </div>
              </template>
              <template v-else>
                <div class="absolute inset-0 bg-gradient-to-br from-pink-300/70 via-rose-200/60 to-purple-300/70 dark:from-pink-800/40 dark:via-rose-900/30 dark:to-purple-800/40"></div>
                <div class="absolute inset-0 bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.08]"></div>
                <span class="hero-spark absolute left-[12%] top-[28%] text-2xl select-none">✨</span>
                <span class="hero-spark absolute right-[16%] top-[20%] text-xl select-none">🎀</span>
                <span class="hero-spark absolute right-[34%] bottom-[18%] text-lg select-none">💗</span>
              </template>

              <!-- 渐隐遮罩，保证头像/文字可读 -->
              <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/70 dark:from-gray-800/70 to-transparent pointer-events-none"></div>

              <!-- 配置徽章按钮 -->
              <button
                v-if="isCurrentUser"
                type="button"
                class="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 bg-white/85 dark:bg-gray-800/85 shadow-md border border-gray-200/60 dark:border-gray-600/60 text-pink-500 hover:bg-pink-50 dark:hover:bg-gray-700/85 transition-colors backdrop-blur-sm"
                @click="openDecoConfig"
              >
                <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 flex-shrink-0" />
                <span class="text-sm font-medium">配置徽章</span>
              </button>
            </div>

            <!-- 卡片主体 -->
            <div class="relative px-4 md:px-7 pb-5">
              <!-- 头像（叠在 banner 上） -->
              <div class="flex items-end justify-between gap-3 -mt-10 md:-mt-12 mb-3">
                <div class="hero-avatar relative flex-shrink-0">
                  <div class="w-20 h-20 md:w-24 md:h-24 rounded-full ring-4 ring-white dark:ring-gray-800 shadow-lg bg-white dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                    <UserFace :user="userInfo" size="mini" class="scale-[2] md:scale-[2.4]" />
                  </div>
                  <span
                    v-if="userInfo.level"
                    class="absolute -bottom-1 -right-1 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-pink-500 to-purple-500 shadow"
                  >
                    Lv.{{ userInfo.level }}
                  </span>
                </div>

                <!-- 操作区 -->
                <div
                  v-if="showUserSpaceHeaderActions"
                  class="flex items-center gap-2 pb-1"
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
                    class="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm bg-white/70 dark:bg-gray-700/70 hover:bg-pink-100 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-100 shadow-sm border border-white/60 dark:border-gray-600/60"
                    @click="openUserSpaceMoreMenu"
                  >
                    <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4 text-pink-500 dark:text-pink-400" />
                    <span>更多</span>
                  </button>
                </div>
              </div>

              <!-- 昵称 + 身份 -->
              <div class="hero-headline">
                <div class="flex items-center gap-2 min-w-0 flex-wrap">
                  <h1 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate max-w-full">
                    {{ userInfo.user_name || '未设置昵称' }}
                  </h1>
                  <QhxTag
                    :active="isFormalResident"
                    class="text-xs flex-shrink-0 whitespace-nowrap"
                  >
                    {{ isFormalResident ? '正式居民' : '临时居民' }}
                  </QhxTag>
                </div>

                <!-- 签名 -->
                <div v-if="userInfo.signature" class="signature-preview mt-1.5">
                  <div
                    class="text-gray-600 dark:text-gray-300 text-sm italic line-clamp-2 cursor-pointer hover:bg-white/30 dark:hover:bg-gray-700/30 rounded px-1 -mx-1 py-0.5 transition-colors"
                    @click="showSignatureModal = true"
                  >
                    <SafeRichText :nodes="signatureNodes" />
                  </div>
                </div>
                <p v-else class="text-gray-400 dark:text-gray-500 text-xs mt-1.5">
                  这位 Lo 娘还没有留下签名~
                </p>
              </div>

              <!-- 风格标签 + 地区 -->
              <div
                v-if="userInfo.main_style?.length || (userInfo.show_area && (userInfo.province || userInfo.city)) || isCurrentUser"
                class="flex flex-wrap items-center gap-2 mt-3"
              >
                <QhxTag
                  v-for="(style, idx) in userInfo.main_style || []"
                  :key="idx"
                  class="hero-tag text-xs"
                ># {{ getStyleLabel(style) }}</QhxTag>
                <span
                  v-if="userInfo.show_area && (userInfo.province || userInfo.city)"
                  class="hero-tag text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-0.5"
                >📍 {{ [userInfo.province, userInfo.city].filter(Boolean).join(' ') }}</span>
                <span
                  v-else-if="isCurrentUser && !userInfo.main_style?.length"
                  class="hero-tag text-xs text-gray-400 dark:text-gray-500"
                >未设置风格与地区</span>
              </div>

              <!-- 数据统计 -->
              <div class="mt-4 grid gap-2" :class="spaceStats.length >= 4 ? 'grid-cols-4' : 'grid-cols-3'">
                <div
                  v-for="stat in spaceStats"
                  :key="stat.key"
                  class="stat-item flex flex-col items-center justify-center rounded-2xl py-2.5 px-1 bg-white/45 dark:bg-gray-700/40 border border-white/50 dark:border-gray-600/40"
                >
                  <span class="text-base md:text-lg font-bold text-pink-600 dark:text-pink-300 tabular-nums">
                    {{ formatStat(displayedStats[stat.key] ?? 0) }}
                  </span>
                  <span class="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ stat.label }}</span>
                </div>
              </div>

              <!-- 功能栏：快捷入口，横向滚动隐藏滚动条 -->
              <div class="hero-action-bar mt-3 -mx-1 px-1">
                <div class="hero-action-bar__scroll flex gap-2 overflow-x-auto overscroll-x-contain">
                  <button
                    type="button"
                    class="hero-action-bar__item hero-action-bar__action flex-shrink-0 inline-flex items-center gap-2 rounded-2xl py-2 px-4 border border-pink-200/70 dark:border-pink-700/50 bg-gradient-to-br from-pink-50/90 to-purple-50/90 dark:from-pink-900/35 dark:to-purple-900/35 hover:from-pink-100 dark:hover:from-pink-900/50 hover:to-purple-100 dark:hover:to-purple-900/50 transition-colors active:scale-[0.98]"
                    @click="openCareerStatsModal"
                  >
                    <UIcon name="i-heroicons-chart-bar-square" class="w-5 h-5 text-pink-500 dark:text-pink-300 flex-shrink-0" />
                    <span class="text-sm font-medium text-pink-600 dark:text-pink-300 whitespace-nowrap">生涯统计</span>
                  </button>
                  <button
                    v-if="!isCurrentUser && spaceUserId"
                    type="button"
                    class="hero-action-bar__item hero-action-bar__action flex-shrink-0 inline-flex items-center gap-2 rounded-2xl py-2 px-4 border border-pink-200/70 dark:border-pink-700/50 bg-gradient-to-br from-pink-50/90 to-purple-50/90 dark:from-pink-900/35 dark:to-purple-900/35 hover:from-pink-100 dark:hover:from-pink-900/50 hover:to-purple-100 dark:hover:to-purple-900/50 transition-colors active:scale-[0.98]"
                    @click="openWardrobeCompareModal"
                  >
                    <UIcon name="i-heroicons-arrows-right-left-20-solid" class="w-5 h-5 text-pink-500 dark:text-pink-300 flex-shrink-0" />
                    <span class="text-sm font-medium text-pink-600 dark:text-pink-300 whitespace-nowrap">衣柜对比</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- ===== Tab 区 ===== -->
          <div class="space-tabs mt-2">
            <QhxTabs :tabs="spaceTabs" :need_swipe="false" class="bg-transparent">
              <QhxTabPanel :index="0">
                <template #default="{ isActive }">
                  <!-- 帖子列表 -->
                  <div v-show="isActive" ref="postsListRef" class="space-tab-panel mt-4 space-y-4">
                    <div v-if="postsLoading" class="flex justify-center py-12">
                      <div class="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></div>
                    </div>
                    <div v-else-if="postList.length > 0" class="space-y-4">
                      <div
                        v-for="post in postList"
                        :key="post.community_id"
                        class="post-reveal bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg border border-white/50 dark:border-gray-700"
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
                  <div v-show="isActive" class="space-tab-panel mt-4">
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
                          <div class="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg border border-white/50 dark:border-gray-700 p-2 transition-transform duration-300 hover:-translate-y-1">
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
                  <div v-show="isActive" ref="achieveListRef" class="space-tab-panel mt-4 space-y-4">
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
                              ref="achieveProgressBar"
                              class="h-full bg-gradient-to-r from-pink-500 to-purple-500 dark:from-pink-400 dark:to-purple-400 rounded-full"
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
                        class="album-reveal cursor-pointer rounded-2xl overflow-hidden border border-white/50 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 shadow-lg hover:-translate-y-1 transition-transform duration-300"
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

    <!-- 生涯统计弹窗 -->
    <QhxModal v-model="showCareerStatsModal" @close="showCareerStatsModal = false">
      <div class="w-[95vw] max-w-lg max-h-[88vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span class="text-pink-500">📊</span>
            生涯统计
          </h3>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="showCareerStatsModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div class="career-stats-body flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div v-if="careerStatsLoading" class="career-stats-loading flex flex-col items-center justify-center py-20">
            <div class="career-stats-loading-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <p class="mt-4 text-sm text-[#8a6f7d] dark:text-pink-300/80">加载统计数据…</p>
          </div>

          <template v-else-if="careerStats">
            <div class="career-stats-intro mb-5">
              <div v-if="userInfo" class="career-stats-intro__avatar-wrap mx-auto mb-3">
                <div class="career-stats-intro__avatar-inner">
                  <UserFace :user="userInfo" size="mini" class="scale-[1.55]" />
                </div>
                <span
                  v-if="userInfo.level"
                  class="career-stats-intro__level"
                >
                  Lv.{{ userInfo.level }}
                </span>
              </div>
              <p class="text-center text-sm text-[#8a6f7d] dark:text-pink-300/75">
                <span class="font-semibold text-[#5e3a4b] dark:text-pink-200">{{ userInfo?.user_name || 'Lo娘' }}</span>
                在 Lo研社的足迹
              </p>
              <div class="career-stats-intro__line mx-auto mt-2.5" aria-hidden="true" />
            </div>

            <div class="career-stats-hero relative mb-5 overflow-hidden rounded-2xl p-5 text-center">
              <div class="career-stats-hero__glow career-stats-hero__glow--left" aria-hidden="true" />
              <div class="career-stats-hero__glow career-stats-hero__glow--right" aria-hidden="true" />
              <span class="career-stats-hero__spark career-stats-hero__spark--1" aria-hidden="true">✨</span>
              <span class="career-stats-hero__spark career-stats-hero__spark--2" aria-hidden="true">🎀</span>
              <div class="relative z-10">
                <div class="mb-1 inline-flex items-center gap-1 rounded-full bg-white/50 px-2.5 py-0.5 text-[11px] font-medium text-[#9d6080] dark:bg-pink-950/40 dark:text-pink-300/90">
                  <span aria-hidden="true">🌸</span>
                  入住Lo星天数
                </div>
                <div class="career-stats-hero__value tabular-nums">
                  {{ formatCareerNumber(careerStats.days_in_lolita) }}
                  <span class="text-lg font-semibold text-[#927084] dark:text-pink-400/80">天</span>
                </div>
              </div>
            </div>

            <div class="space-y-3.5">
              <div
                v-for="(group, groupIndex) in careerStatGroups"
                :key="group.title"
                class="career-stats-group"
                :style="{ animationDelay: `${groupIndex * 0.07}s` }"
              >
                <div class="career-stats-group__head">
                  <span class="career-stats-group__icon" aria-hidden="true">{{ group.icon }}</span>
                  <span>{{ group.title }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div
                    v-for="item in group.items"
                    :key="item.key"
                    class="career-stats-metric"
                  >
                    <div class="career-stats-metric__value tabular-nums">
                      {{ item.display }}
                    </div>
                    <div class="career-stats-metric__label">{{ item.label }}</div>
                  </div>
                </div>
              </div>

              <div class="career-stats-achievement">
                <div class="mb-3 flex items-center justify-between gap-2">
                  <span class="flex items-center gap-1.5 text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">
                    <span class="text-base" aria-hidden="true">🏆</span>
                    成就进度
                  </span>
                  <span class="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[11px] text-[#8a6f7d] dark:bg-pink-950/35 dark:text-pink-300/85">
                    {{ careerStats.achievement_count }}/{{ careerStats.achievement_total }} · {{ careerStats.achievement_points }} 点
                  </span>
                </div>
                <div class="career-stats-progress-track">
                  <div
                    class="career-stats-progress-fill"
                    :style="{ width: `${Math.min(100, careerStats.achievement_progress ?? 0)}%` }"
                  />
                </div>
                <div class="mt-2 text-center text-xs font-medium text-[#9d6080] dark:text-pink-300/80">
                  {{ careerStats.achievement_progress ?? 0 }}% 完成
                </div>
              </div>
            </div>
          </template>

          <div v-else class="career-stats-empty flex flex-col items-center justify-center py-16 text-center">
            <div class="career-stats-empty__icon mb-3 text-4xl" aria-hidden="true">📭</div>
            <p class="text-sm font-medium text-[#8a6f7d] dark:text-pink-300/80">暂无统计数据</p>
            <p class="mt-1 text-xs text-[#b09aa8] dark:text-pink-400/50">稍后再来看看吧</p>
          </div>
        </div>

        <div
          v-if="careerStats && !careerStatsLoading"
          class="career-stats-footer flex-shrink-0"
        >
          <CareerStatisticsShareImage :payload="careerSharePayload" fixed-footer />
        </div>
      </div>
    </QhxModal>

    <WardrobeCompareModal
      v-if="spaceUserId"
      v-model="showWardrobeCompareModal"
      :owner-user-id="spaceUserId"
    />

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
import { ref, reactive, onMounted, onUnmounted, computed, watch, inject, nextTick, type Ref } from 'vue'
import {
  getUserSpace,
  getUserDecoBadges,
  getUserCareerStats,
  adminUpgradeUserFormalResident,
  type UserDecoBadgeItem,
  type UserCareerStats,
} from '@/api/user'
import CareerStatisticsShareImage from '@/components/user/CareerStatisticsShareImage.vue'
import WardrobeCompareModal from '@/components/Wardrobe/WardrobeCompareModal.vue'
import type { CareerSharePayload } from '@/components/user/CareerStatisticsShareImage.vue'
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
const { $gsap, $ScrollTrigger } = useNuxtApp()
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
    if (userInfo.value) {
      await nextTick()
      playHeroIntro()
    }
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

// 衣柜数量（用于统计展示，轻量请求获取 count）
const wardrobeCount = ref(0)
const fetchWardrobeCount = async () => {
  const uid = spaceUserId.value
  if (!uid) {
    wardrobeCount.value = 0
    return
  }
  try {
    const res = await getWardrobeList({ user_id: uid, page: 1, pageSize: 1 })
    wardrobeCount.value = res.count ?? 0
  } catch (e) {
    console.error('获取衣柜数量失败:', e)
    wardrobeCount.value = 0
  }
}

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
    fetchWardrobeCount()
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
    wardrobeCount.value = 0
    resetAchievementTab()
  }
}, { immediate: true })

/* ============================================================
 * 统计数据 + GSAP 动画
 * ========================================================== */

const spaceStats = computed(() => {
  const list: Array<{ key: string; label: string; value: number }> = [
    { key: 'posts', label: '帖子', value: postsTotal.value },
    { key: 'wardrobe', label: '衣柜', value: wardrobeCount.value },
  ]
  if (showAchieveTab.value) {
    list.push({ key: 'points', label: '成就点', value: achievementStats.value?.points ?? 0 })
  }
  list.push({ key: 'fans', label: '粉丝', value: userInfo.value?.collect_count ?? 0 })
  return list
})

const displayedStats = reactive<Record<string, number>>({})

const formatStat = (n: number): string => {
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}w`
  return n.toLocaleString('zh-CN')
}

const formatCareerNumber = (num: number | null | undefined): string => {
  if (num == null || Number.isNaN(num)) return '0'
  return num.toLocaleString('zh-CN')
}

const formatCareerMoney = (num: number | null | undefined): string => {
  if (num == null || Number.isNaN(num)) return '0'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

const showCareerStatsModal = ref(false)
const showWardrobeCompareModal = ref(false)
const careerStats = ref<UserCareerStats | null>(null)
const careerStatsLoading = ref(false)

const openWardrobeCompareModal = () => {
  if (userStore.user?.user_id == null) {
    toast.add({ title: '请先登录后再对比', color: 'amber' })
    return
  }
  showWardrobeCompareModal.value = true
}

const openCareerStatsModal = async () => {
  const uid = spaceUserId.value
  if (!uid) return
  showCareerStatsModal.value = true
  careerStatsLoading.value = true
  careerStats.value = null
  try {
    careerStats.value = await getUserCareerStats({ user_id: uid })
  } catch (error) {
    console.error('获取生涯统计失败:', error)
    toast.add({
      title: '获取生涯统计失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
    showCareerStatsModal.value = false
  } finally {
    careerStatsLoading.value = false
  }
}

type CareerStatItem = { key: string; label: string; display: string }

const careerStatGroups = computed(() => {
  const s = careerStats.value
  if (!s) return []
  return [
    {
      title: '收藏与生活',
      icon: '👗',
      items: [
        { key: 'wardrobe', label: '衣柜', display: formatCareerNumber(s.wardrobe_count) },
        { key: 'clothes', label: '服饰', display: formatCareerNumber(s.clothes_count) },
        { key: 'wear', label: '穿着次数', display: formatCareerNumber(s.total_wear_times) },
        { key: 'spending', label: '总花费', display: `¥${formatCareerMoney(s.total_spending)}` },
      ] as CareerStatItem[],
    },
    {
      title: '创作与分享',
      icon: '✨',
      items: [
        { key: 'community', label: '发帖', display: formatCareerNumber(s.community_count) },
        { key: 'journal', label: '手账', display: formatCareerNumber(s.journal_count) },
        { key: 'matching', label: '搭配', display: formatCareerNumber(s.matching_count) },
        { key: 'achievement', label: '已达成成就', display: formatCareerNumber(s.achievement_count) },
      ] as CareerStatItem[],
    },
  ]
})

const careerSharePayload = computed((): CareerSharePayload | null => {
  const s = careerStats.value
  const info = userInfo.value
  const name = info?.user_name?.trim() || 'Lo娘'
  if (!s) return null

  const showArea = info?.show_area === true || info?.show_area === 1
  const location =
    showArea && (info?.province || info?.city)
      ? [info.province, info.city].filter(Boolean).join(' ')
      : undefined

  return {
    userName: name,
    userFace: info?.user_face || 'static/plan_cover/default.jpg',
    avatarFrame: info?.avatar?.avatar_frame,
    userId: spaceUserId.value ?? undefined,
    tags: (info?.main_style || []).map(getStyleLabel).filter(Boolean),
    location,
    daysInLolita: s.days_in_lolita ?? 0,
    totalSpending: formatCareerMoney(s.total_spending),
    achievementProgress: Math.min(100, s.achievement_progress ?? 0),
    achievementSummary: `${s.achievement_count}/${s.achievement_total} · ${formatCareerNumber(s.achievement_points)} 点`,
    metrics: [
      { label: '衣柜', value: formatCareerNumber(s.wardrobe_count), emoji: '👗' },
      { label: '服饰', value: formatCareerNumber(s.clothes_count), emoji: '🎀' },
      { label: '穿着', value: formatCareerNumber(s.total_wear_times), emoji: '💫' },
      { label: '发帖', value: formatCareerNumber(s.community_count), emoji: '📝' },
      { label: '手账', value: formatCareerNumber(s.journal_count), emoji: '📔' },
      { label: '搭配', value: formatCareerNumber(s.matching_count), emoji: '✨' },
    ],
  }
})

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// DOM 引用
const pageRoot = ref<HTMLElement | null>(null)
const bgLayer = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const postsListRef = ref<HTMLElement | null>(null)
const achieveListRef = ref<HTMLElement | null>(null)
const achieveProgressBar = ref<HTMLElement | null>(null)

let heroIntroPlayed = false
let parallaxTween: gsap.core.Tween | null = null
const revealTriggers: any[] = []

// 数字滚动动画：值变化时平滑增长
const animateStats = () => {
  const stats = spaceStats.value
  if (!$gsap || prefersReducedMotion()) {
    for (const s of stats) displayedStats[s.key] = s.value
    return
  }
  for (const s of stats) {
    const from = displayedStats[s.key] ?? 0
    if (from === s.value) {
      displayedStats[s.key] = s.value
      continue
    }
    const obj = { v: from }
    $gsap.to(obj, {
      v: s.value,
      duration: 1.1,
      ease: 'power2.out',
      onUpdate: () => {
        displayedStats[s.key] = Math.round(obj.v)
      },
    })
  }
}

watch(
  spaceStats,
  () => {
    nextTick(animateStats)
  },
  { deep: true },
)

// Hero 入场动画（仅首屏播放一次）
const playHeroIntro = () => {
  if (heroIntroPlayed) {
    setupParallax()
    return
  }
  if (!$gsap || !heroRef.value) {
    heroIntroPlayed = true
    return
  }
  heroIntroPlayed = true

  if (prefersReducedMotion()) {
    setupParallax()
    return
  }

  const scope = pageRoot.value || undefined
  $gsap.context(() => {
    const tl = $gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from(heroRef.value, { y: 40, autoAlpha: 0, duration: 0.7 })
      .from('.hero-banner', { autoAlpha: 0, scale: 1.06, duration: 0.8 }, '<')
      .from('.hero-avatar', { scale: 0.5, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.7)' }, '-=0.45')
      .from('.hero-headline > *', { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.5 }, '-=0.3')
      .from('.hero-tag', { y: 10, autoAlpha: 0, stagger: 0.05, duration: 0.4 }, '-=0.25')
      .from('.stat-item', { y: 14, autoAlpha: 0, stagger: 0.07, duration: 0.45 }, '-=0.2')
      .from('.hero-action-bar__item', { y: 12, autoAlpha: 0, stagger: 0.06, duration: 0.4 }, '-=0.15')
      .from('.space-tabs', { y: 16, autoAlpha: 0, duration: 0.5 }, '-=0.15')
  }, scope)

  setupParallax()
}

// 背景视差（仅桌面端且未开启减弱动效时）
const setupParallax = () => {
  if (!$gsap || !$ScrollTrigger || !bgLayer.value || !pageRoot.value) return
  if (prefersReducedMotion()) return
  if (typeof window === 'undefined' || window.innerWidth < 768) return
  if (parallaxTween) return
  parallaxTween = $gsap.to(bgLayer.value, {
    yPercent: 10,
    ease: 'none',
    scrollTrigger: {
      trigger: pageRoot.value,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  })
}

// 列表滚动渐显：使用 ScrollTrigger.batch，仅处理尚未处理过的元素
const revealItems = (root: HTMLElement | null, selector: string) => {
  if (!$gsap || !$ScrollTrigger || !root) return
  if (prefersReducedMotion()) return
  const els = Array.from(
    root.querySelectorAll(`${selector}:not([data-revealed])`),
  ) as HTMLElement[]
  if (!els.length) return
  for (const el of els) el.setAttribute('data-revealed', '1')
  $gsap.set(els, { autoAlpha: 0, y: 28 })
  const triggers = $ScrollTrigger.batch(els, {
    start: 'top bottom-=40',
    once: true,
    onEnter: (batch: Element[]) => {
      $gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power2.out',
        overwrite: true,
      })
    },
  })
  if (Array.isArray(triggers)) revealTriggers.push(...triggers)
}

// 帖子变化后触发渐显
watch(
  () => postList.value.length,
  () => {
    nextTick(() => {
      revealItems(postsListRef.value, '.post-reveal')
      $ScrollTrigger?.refresh()
    })
  },
)

// 成就相册变化后触发渐显
watch(
  () => achieveAlbumList.value.length,
  () => {
    nextTick(() => {
      revealItems(achieveListRef.value, '.album-reveal')
      $ScrollTrigger?.refresh()
    })
  },
)

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

onUnmounted(() => {
  parallaxTween?.scrollTrigger?.kill()
  parallaxTween?.kill()
  parallaxTween = null
  for (const t of revealTriggers) t?.kill?.()
  revealTriggers.length = 0
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

/* Hero 卡片 */
.hero-card {
  isolation: isolate;
}

/* 徽章 banner 背景：与卡片主题统一 */
.hero-banner-bg {
  background: linear-gradient(180deg, rgba(255, 248, 248, 0.95) 0%, rgba(254, 242, 242, 0.85) 50%, rgba(255, 250, 250, 0.95) 100%);
}
.dark .hero-banner-bg {
  background: linear-gradient(180deg, rgba(30, 30, 30, 0.95) 0%, rgba(40, 35, 40, 0.85) 50%, rgba(35, 30, 35, 0.95) 100%);
}

/* banner 装饰 emoji 漂浮 */
.hero-spark {
  animation: floatSpark 4s ease-in-out infinite;
}
.hero-spark:nth-child(4) { animation-delay: 0.8s; }
.hero-spark:nth-child(5) { animation-delay: 1.6s; }
@keyframes floatSpark {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(6deg); }
}

/* 签名预览 */
.signature-preview {
  min-height: 1.5rem;
}

/* Hero 功能栏：横向滚动，隐藏滚动条 */
.hero-action-bar__scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.hero-action-bar__scroll::-webkit-scrollbar {
  display: none;
}

.hero-action-bar__action {
  box-shadow: 0 2px 8px rgba(236, 72, 153, 0.12);
}

.dark .hero-action-bar__action {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

/* Tab 面板最低高度，避免切换时内容区高度骤变 */
.space-tabs :deep(.panels-container) {
  min-height: min(56vh, 520px);
}

.space-tabs :deep(.panels-container > *) {
  min-height: inherit;
}

.space-tab-panel {
  min-height: min(56vh, 520px);
}

@media (prefers-reduced-motion: reduce) {
  .animate-blob,
  .hero-spark,
  .career-stats-group,
  .career-stats-hero__spark,
  .career-stats-loading-dots span {
    animation: none !important;
  }
}

/* 生涯统计弹窗内容区 */
.career-stats-body {
  background: linear-gradient(180deg, rgba(255, 250, 252, 0.6) 0%, rgba(255, 255, 255, 0) 28%);
}

.dark .career-stats-body {
  background: linear-gradient(180deg, rgba(45, 35, 42, 0.45) 0%, rgba(31, 41, 55, 0) 28%);
}

.career-stats-intro__avatar-wrap {
  position: relative;
  width: 4.25rem;
  height: 4.25rem;
}

.career-stats-intro__avatar-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  background: #fff;
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.95),
    0 0 0 5px rgba(236, 72, 153, 0.28),
    0 8px 20px rgba(236, 72, 153, 0.18);
}

.dark .career-stats-intro__avatar-inner {
  background: rgb(31 41 55);
  box-shadow:
    0 0 0 3px rgba(31, 41, 55, 0.95),
    0 0 0 5px rgba(244, 114, 182, 0.22),
    0 8px 22px rgba(0, 0, 0, 0.32);
}

.career-stats-intro__level {
  position: absolute;
  right: -0.35rem;
  bottom: -0.2rem;
  z-index: 10;
  padding: 0.125rem 0.45rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
  box-shadow: 0 2px 8px rgba(236, 72, 153, 0.35);
}

.career-stats-intro__line {
  width: 3rem;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(236, 72, 153, 0.55), transparent);
}

.career-stats-hero {
  border: 1px solid rgba(236, 72, 153, 0.22);
  background: linear-gradient(135deg, rgba(252, 231, 243, 0.95) 0%, rgba(237, 233, 254, 0.9) 55%, rgba(255, 241, 242, 0.92) 100%);
  box-shadow:
    0 8px 24px rgba(236, 72, 153, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.dark .career-stats-hero {
  border-color: rgba(244, 114, 182, 0.2);
  background: linear-gradient(135deg, rgba(80, 30, 55, 0.55) 0%, rgba(55, 35, 70, 0.5) 55%, rgba(70, 35, 50, 0.45) 100%);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 200, 220, 0.06);
}

.career-stats-hero__glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(28px);
  pointer-events: none;
}

.career-stats-hero__glow--left {
  top: -1.5rem;
  left: -1rem;
  width: 6rem;
  height: 6rem;
  background: rgba(244, 114, 182, 0.35);
}

.career-stats-hero__glow--right {
  right: -0.75rem;
  bottom: -1.25rem;
  width: 5rem;
  height: 5rem;
  background: rgba(167, 139, 250, 0.32);
}

.career-stats-hero__spark {
  position: absolute;
  font-size: 0.95rem;
  opacity: 0.75;
  pointer-events: none;
  animation: floatSpark 4.5s ease-in-out infinite;
}

.career-stats-hero__spark--1 {
  top: 0.65rem;
  right: 1.1rem;
}

.career-stats-hero__spark--2 {
  bottom: 0.75rem;
  left: 1rem;
  animation-delay: 1.2s;
}

.career-stats-hero__value {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.15;
  background: linear-gradient(135deg, #db2777 0%, #9333ea 55%, #ec4899 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.dark .career-stats-hero__value {
  background: linear-gradient(135deg, #f9a8d4 0%, #d8b4fe 55%, #fbcfe8 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.career-stats-group {
  --neu-raised: #f5eef2;
  --neu-shadow-d: rgba(150, 110, 130, 0.18);
  --neu-shadow-l: rgba(255, 252, 254, 0.92);
  padding: 0.875rem;
  border-radius: 1rem;
  border: 1px solid rgba(236, 72, 153, 0.12);
  background: var(--neu-raised);
  box-shadow:
    6px 6px 16px var(--neu-shadow-d),
    -5px -5px 14px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
  animation: career-stat-in 0.42s ease-out backwards;
}

.dark .career-stats-group {
  --neu-raised: #2a2229;
  --neu-shadow-d: rgba(0, 0, 0, 0.42);
  --neu-shadow-l: rgba(100, 70, 90, 0.08);
  border-color: rgba(244, 114, 182, 0.14);
  box-shadow:
    5px 5px 14px var(--neu-shadow-d),
    -4px -4px 12px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 210, 230, 0.04);
}

.career-stats-group__head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9d6080;
}

.dark .career-stats-group__head {
  color: rgba(251, 207, 232, 0.92);
}

.career-stats-group__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 0.45rem;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.65);
  box-shadow: 0 2px 6px rgba(236, 72, 153, 0.12);
}

.dark .career-stats-group__icon {
  background: rgba(60, 40, 52, 0.65);
}

.career-stats-metric {
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.85);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dark .career-stats-metric {
  background: rgba(35, 28, 34, 0.72);
  border-color: rgba(244, 114, 182, 0.08);
}

.career-stats-metric:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.1);
}

.career-stats-metric__value {
  font-size: 1rem;
  font-weight: 700;
  color: #4a2f3d;
}

.dark .career-stats-metric__value {
  color: rgba(253, 242, 248, 0.95);
}

.career-stats-metric__label {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: #8a6f7d;
}

.dark .career-stats-metric__label {
  color: rgba(251, 207, 232, 0.65);
}

.career-stats-achievement {
  --neu-raised: #f5eef2;
  --neu-shadow-d: rgba(150, 110, 130, 0.18);
  --neu-shadow-l: rgba(255, 252, 254, 0.92);
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(236, 72, 153, 0.12);
  background: var(--neu-raised);
  box-shadow:
    6px 6px 16px var(--neu-shadow-d),
    -5px -5px 14px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
  animation: career-stat-in 0.42s ease-out 0.14s backwards;
}

.dark .career-stats-achievement {
  --neu-raised: #2a2229;
  --neu-shadow-d: rgba(0, 0, 0, 0.42);
  --neu-shadow-l: rgba(100, 70, 90, 0.08);
  border-color: rgba(244, 114, 182, 0.14);
  box-shadow:
    5px 5px 14px var(--neu-shadow-d),
    -4px -4px 12px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 210, 230, 0.04);
}

.career-stats-progress-track {
  height: 0.625rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(214, 170, 190, 0.35);
  box-shadow: inset 0 2px 4px rgba(130, 95, 115, 0.12);
}

.dark .career-stats-progress-track {
  background: rgba(60, 40, 52, 0.75);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.28);
}

.career-stats-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #f472b6 100%);
  background-size: 200% 100%;
  transition: width 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  animation: career-progress-shimmer 2.8s ease-in-out infinite;
}

.career-stats-footer {
  border-top: 1px dashed rgba(236, 72, 153, 0.22);
  background: linear-gradient(180deg, rgba(255, 250, 252, 0.98) 0%, rgba(255, 255, 255, 1) 100%);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.dark .career-stats-footer {
  border-top-color: rgba(244, 114, 182, 0.18);
  background: linear-gradient(180deg, rgba(45, 35, 42, 0.98) 0%, rgb(31 41 55) 100%);
}

.career-stats-loading-dots {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.career-stats-loading-dots span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: #ec4899;
  opacity: 0.85;
  animation: career-dot-bounce 0.75s ease-in-out infinite alternate;
}

.career-stats-loading-dots span:nth-child(2) {
  animation-delay: 0.12s;
}

.career-stats-loading-dots span:nth-child(3) {
  animation-delay: 0.24s;
}

.career-stats-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 1.25rem;
  background: rgba(252, 231, 243, 0.55);
  box-shadow: inset 0 2px 8px rgba(236, 72, 153, 0.08);
}

.dark .career-stats-empty__icon {
  background: rgba(60, 40, 52, 0.55);
}

@keyframes career-stat-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes career-dot-bounce {
  to {
    transform: translateY(-5px);
    opacity: 0.45;
  }
}

@keyframes career-progress-shimmer {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
</style>
