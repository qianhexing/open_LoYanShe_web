<template>
  <div class="container mx-auto p-2 pb-20 max-w-4xl">
    <!-- 功能栏：登录用户显示，新增按钮仅自己手账显示 -->
    <div
      v-if="layoutReady && userStore.user"
      class="flex justify-between items-center sticky top-[10px] z-10 mb-4"
    >
      <div class="flex flex-wrap items-center gap-2">
        <QhxJellyButton v-if="isOwnJournal">
          <div
            class="text-center px-1 cursor-pointer"
            @click="(e: MouseEvent) => openAddJournal(e)"
          >
            <div
              class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary"
            >
              <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
            </div>
          </div>
        </QhxJellyButton>
        <!-- 按月/按日切换 -->
        <div class="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'month' ? 'bg-qhx-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
            @click="viewMode = 'month'; fetchYearMonthData()"
          >
            按月
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'day' ? 'bg-qhx-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
            @click="viewMode = 'day'; fetchMonthData()"
          >
            按日
          </button>
        </div>
      </div>
    </div>

    <!-- 按月视图：12个月块，点击进入该月按日视图 -->
    <div v-if="layoutReady && userId && viewMode === 'month'" class="space-y-2">
      <!-- 年份切换 -->
      <div class="flex items-center gap-2 mb-3 px-1">
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          @click="yearSelect = yearSelect - 1; fetchYearMonthData()"
        >
          <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[60px] text-center">{{ yearSelect }}年</span>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          @click="yearSelect = yearSelect + 1; fetchYearMonthData()"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      <div v-if="monthViewLoading" class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">加载中...</div>
      <div v-else class="grid grid-cols-4 gap-2">
        <button
          v-for="m in all12Months"
          :key="m.month"
          type="button"
          class="relative aspect-[1/1] cursor-pointer overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all text-center min-w-0 min-h-[48px]"
          @click="goToMonth(m.month)"
        >
          <img
            v-if="m.firstImage"
            :src="`${BASE_IMG}${m.firstImage}${getImageParams()}`"
            alt=""
            class="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <span
            class="absolute inset-0 flex flex-col items-center justify-center text-xs font-medium gap-0.5"
            :class="m.firstImage ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-gray-500 dark:text-gray-400'"
          >
            {{ m.month }}月
            <span v-if="m.count > 0" class="text-[10px] opacity-90">{{ m.count }}条</span>
          </span>
          <span
            v-if="m.count > 0"
            class="absolute top-[-2px] right-[-2px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-qhx-primary text-white text-[10px] font-semibold px-1 leading-none z-[1]"
          >
            {{ m.count > 99 ? '99+' : m.count }}
          </span>
        </button>
      </div>
    </div>

    <!-- 按日视图：年月选择 + 每日网格 -->
    <div v-if="layoutReady && userId && viewMode === 'day'" class="space-y-2">
      <!-- 年月切换 -->
      <div class="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            @click="prevYear"
          >
            <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[50px] text-center">
            {{ yearSelect }}年
          </span>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            @click="nextYear"
          >
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            @click="prevMonth"
          >
            <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[40px] text-center">
            {{ monthSelect }}月
          </span>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            @click="nextMonth"
          >
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <!-- 日块：4列网格，一排4个 -->
      <div v-if="dayCountLoading" class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        加载中...
      </div>
      <div v-else class="space-y-2">
        <div class="grid grid-cols-7 gap-2">
          <div
            v-for="d in allDaysInMonth"
            :key="d.day"
            class="relative aspect-[1/1] cursor-pointer overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all text-center min-w-0 min-h-[48px]"
            :class="{
              'ring-2 ring-qhx-primary border-qhx-primary':
                expandedDay === d.day || collapsingDay === d.day
            }"
            @click="toggleDayExpand(d.day)"
          >
            <!-- 图片铺满方格 -->
            <img
              v-if="d.firstImage"
              :src="`${BASE_IMG}${d.firstImage}${getImageParams()}`"
              alt=""
              class="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <!-- 日期悬浮叠在图片上（有图时白字+阴影，无图时灰字） -->
            <span
              class="absolute inset-0 flex items-center justify-center text-xs font-medium"
              :class="d.firstImage ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ d.day }}日
            </span>
            <!-- 角标：右上角显示条数 -->
            <span
              v-if="d.count > 0"
              class="absolute top-[-2px] right-[-2px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-qhx-primary text-white text-[10px] font-semibold px-1 leading-none z-[1]"
            >
              {{ d.count > 99 ? '99+' : d.count }}
            </span>
          </div>
        </div>

        <!-- 展开的当日手账列表 -->
        <div
          class="month-slot grid overflow-hidden"
          :style="{ gridTemplateRows: daySlotExpanded ? '1fr' : '0fr' }"
          @transitionend.self="onDaySlotTransitionEnd"
        >
          <div class="min-h-0 overflow-hidden">
            <div
              v-if="displayDay !== null"
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div
                class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {{ yearSelect }}年{{ monthSelect }}月{{ displayDay }}日 手账记录
                <div v-if="isOwnJournal" class="mt-1">
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    @click="(e: MouseEvent) => openAddJournalForDay(displayDay!, e)"
                  >
                    添加记录
                  </UButton>
                </div>
              </div>
              <div class="px-3 py-2">
                <div
                  v-if="journalListForDay.length === 0"
                  class="text-center py-6 text-gray-400 text-xs"
                >
                  暂无记录
                </div>
                <div v-else class="space-y-3">
                  <div
                    v-for="j in journalListForDay"
                    :key="j.journal_id"
                    class="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden"
                  >
                    <!-- 手账信息：类型、时间、操作 -->
                    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getPkTypeLabel(j.pk_type) }}
                        <span v-if="j.create_time" class="ml-1">{{ formatTime(j.create_time) }}</span>
                      </div>
                      <div v-if="isOwnJournal && j.pk_type !== 0" class="flex items-center gap-1">
                        <UButton size="2xs" color="gray" variant="ghost" icon="i-heroicons-pencil-square" @click="(e: MouseEvent) => editJournal(j, e)" />
                        <UButton size="2xs" color="red" variant="ghost" icon="i-heroicons-trash" :loading="deleteId === j.journal_id" @click="confirmDelete(j.journal_id)" />
                      </div>
                    </div>
                    <!-- 根据类型展示：使用现有组件 -->
                    <div class="p-3">
                      <!-- pk_type 0: 评论/签到 → CommentItem（评论无独立详情页，不显示查看详情按钮） -->
                      <CommentItem
                        v-if="j.pk_type === 0 && j.comment"
                        :item="j.comment"
                        :ui="'p-0'"
                        :need_bottom="false"
                      />
                      <p v-else-if="j.pk_type === 0" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                      <!-- pk_type 1: 帖子 → CommunityItem -->
                      <div v-else-if="j.pk_type === 1 && j.community" class="space-y-2">
                        <CommunityItem
                          :item="j.community"
                          size="big"
                          :need-jump="false"
                          class="!m-0 !shadow-none border-0"
                        />
                          <UButton size="xs" color="primary" variant="soft" @click="jumpToCommunity(j.community!)">
                          查看详情
                        </UButton>
                      </div>
                      <p v-else-if="j.pk_type === 1" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                      <!-- pk_type 2: 服饰 → 参考 WardrobeClothesChoose 的列表项结构（无独立组件） -->
                      <div v-else-if="j.pk_type === 2 && j.wardrobe_clothes" class="flex gap-3">
                        <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">
                          <img
                            :src="`${BASE_IMG}${j.wardrobe_clothes.clothes_img || ''}${getImageParams()}`"
                            :alt="j.wardrobe_clothes.clothes_note"
                            class="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {{ j.wardrobe_clothes.clothes_note || '暂无笔记' }}
                          </div>
                          <div v-if="j.wardrobe_clothes.wardrobe_status" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            状态：{{ j.wardrobe_clothes.wardrobe_status }}
                          </div>
                          <div v-if="j.wardrobe_clothes.clothes_part" class="text-xs text-gray-500 dark:text-gray-400">
                            部位：{{ j.wardrobe_clothes.clothes_part }}
                          </div>
                          <UButton size="xs" color="primary" variant="soft" class="mt-2" @click="jumpToClothes(j.wardrobe_clothes!)">
                            查看详情
                          </UButton>
                        </div>
                      </div>
                      <p v-else-if="j.pk_type === 2" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                      <!-- pk_type 3: 搭配 -->
                      <div v-else-if="j.pk_type === 3 && j.matching_list" class="flex gap-3">
                        <div
                          v-if="j.matching_list.cover"
                          class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600"
                        >
                          <img
                            :src="`${BASE_IMG}${j.matching_list.cover}${getImageParams()}`"
                            :alt="j.matching_list.note || '搭配'"
                            class="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {{ j.matching_list.note || '未命名搭配' }}
                          </div>
                          <div v-if="j.matching_list.main_style" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            风格：{{ j.matching_list.main_style }}
                          </div>
                          <UButton size="xs" color="primary" variant="soft" class="mt-2" @click="jumpToMatching(j.matching_list!)">
                            查看详情
                          </UButton>
                        </div>
                      </div>
                      <p v-else-if="j.pk_type === 3" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                      <!-- pk_type 4: 图鉴 -->
                      <div v-else-if="j.pk_type === 4 && j.library" class="space-y-2">
                        <LibraryItem :need-jump="false" :size="'mini-list'" :item="j.library" />
                        <UButton size="xs" color="primary" variant="soft" @click="jumpToLibrary(j.library!)">
                          查看详情
                        </UButton>
                      </div>
                      <p v-else-if="j.pk_type === 4" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                      <!-- pk_type 5: 计划 -->
                      <div v-else-if="j.pk_type === 5 && j.plan" class="flex gap-3">
                        <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-600">
                          <img
                            :src="getPlanCoverSrc(j.plan)"
                            :alt="j.plan.plan_name || '计划'"
                            class="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {{ j.plan.plan_name || '未命名计划' }}
                          </div>
                          <div v-if="j.plan.plan_note" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {{ j.plan.plan_note }}
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            ￥{{ formatPlanMoney(j.plan.have_money) }}/￥{{ formatPlanMoney(j.plan.need_money) }}
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-24">
                              <div class="bg-qhx-primary h-1.5 rounded-full" :style="{ width: `${getPlanProgress(j.plan)}%` }"></div>
                            </div>
                            <span class="text-[10px] text-gray-500">{{ Math.ceil(getPlanProgress(j.plan)) }}%</span>
                          </div>
                          <UButton size="xs" color="primary" variant="soft" class="mt-2" @click="jumpToPlan(j.plan!)">
                            查看详情
                          </UButton>
                        </div>
                      </div>
                      <p v-else-if="j.pk_type === 5" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                      <!-- 无关联数据：仅显示笔记 -->
                      <p v-else class="text-sm text-gray-800 dark:text-gray-200">
                        {{ j.note || '无笔记' }}
                      </p>
                    </div>
                    <!-- 手账笔记（独立于关联内容） -->
                    <div v-if="j.note && (j.community || j.comment || j.wardrobe_clothes || j.matching_list || j.library || j.plan)" class="px-3 pb-3 pt-0">
                      <div class="text-xs text-gray-500 dark:text-gray-400 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg px-2 py-1.5 border border-amber-200/50 dark:border-amber-800/30">
                        <span class="font-medium text-amber-700 dark:text-amber-400"></span>
                        {{ j.note }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 未登录或无效用户ID -->
    <div
      v-if="layoutReady && (!userStore.user || !userId)"
      class="text-center py-12"
    >
      <div class="text-gray-400 dark:text-gray-500">
        {{ !userStore.user ? '请先登录后使用手账功能' : '无效的手账页' }}
      </div>
    </div>

    <!-- 添加/编辑手账弹窗（参考 ClothesAdd 使用 QhxModal） -->
    <QhxModal v-model="addEditModal" :trigger-position="addEditClickPosition" @close="addEditModal = false">
      <div class="w-[95vw] max-w-md max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ editingJournal ? '编辑手账' : '新增手账' }}</h3>
          <button
            type="button"
            @click="addEditModal = false"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>
        <!-- 内容区域 -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              日期
            </label>
            <QhxDateTimePicker
              v-model="form.journal_time"
              placeholder="选择日期"
              mode="date"
              format="YYYY-MM-DD"
              :enable-time-picker="false"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              类型
            </label>
            <!-- 计划类型编辑时不可切换 -->
            <div
              v-if="form.pk_type === 5"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400"
            >
              计划（不可更改）
            </div>
            <div
              v-else
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer flex items-center justify-between"
              @click="openTypeModal"
            >
              <span class="text-gray-500 dark:text-gray-400">
                {{ form.pk_type ? pkTypeLabel : '请选择类型' }}
              </span>
              <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div v-if="form.pk_type && form.pk_type !== 5" class="space-y-1">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              选择{{ form.pk_type === 1 ? '帖子' : form.pk_type === 2 ? '服饰' : form.pk_type === 3 ? '搭配' : '图鉴' }}
            </label>
            <!-- 已选帖子：使用 CommunityItem 风格回显 -->
            <div
              v-if="form.pk_type === 1 && selectedCommunity"
              class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 overflow-hidden"
            >
              <CommunityItem
                :item="selectedCommunity"
                size="big"
                :need-jump="true"
                class="!m-0 !shadow-none"
              />
              <div class="px-3 py-2 border-t border-gray-200 dark:border-gray-600 flex justify-end">
                <UButton size="xs" color="gray" variant="ghost" @click="openChooseModal">
                  更换
                </UButton>
              </div>
            </div>
            <!-- 已选服饰：使用服饰卡片回显 -->
            <div
              v-else-if="form.pk_type === 2 && selectedClothes"
              class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-3"
            >
              <div class="flex gap-3">
                <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    :src="`${BASE_IMG}${selectedClothes.clothes_img || ''}${getImageParams()}`"
                    :alt="selectedClothes.clothes_note"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {{ selectedClothes.clothes_note || '暂无笔记' }}
                  </div>
                  <div v-if="selectedClothes.wardrobe_status" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    状态：{{ selectedClothes.wardrobe_status }}
                  </div>
                  <div v-if="selectedClothes.clothes_part" class="text-xs text-gray-500 dark:text-gray-400">
                    部位：{{ selectedClothes.clothes_part }}
                  </div>
                </div>
              </div>
              <div class="mt-2 flex justify-end">
                <UButton size="xs" color="gray" variant="ghost" @click="openChooseModal">
                  更换
                </UButton>
              </div>
            </div>
            <!-- 已选搭配：使用搭配卡片回显 -->
            <div
              v-else-if="form.pk_type === 3 && selectedMatching"
              class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-3"
            >
              <div class="flex gap-3">
                <div
                  v-if="selectedMatching.cover"
                  class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
                >
                  <img
                    :src="`${BASE_IMG}${selectedMatching.cover}${getImageParams()}`"
                    :alt="selectedMatching.note || '搭配图片'"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {{ selectedMatching.note || '未命名搭配' }}
                  </div>
                  <div v-if="selectedMatching.main_style" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    风格：{{ selectedMatching.main_style }}
                  </div>
                </div>
              </div>
              <div class="mt-2 flex justify-end">
                <UButton size="xs" color="gray" variant="ghost" @click="openChooseModal">
                  更换
                </UButton>
              </div>
            </div>
            <!-- 已选图鉴：使用 LibraryItem 回显 -->
            <div
              v-else-if="form.pk_type === 4 && selectedLibrary"
              class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-3"
            >
              <LibraryItem :need-jump="false" :size="'mini-list'" :item="selectedLibrary" />
              <div class="mt-2 flex justify-end">
                <UButton size="xs" color="gray" variant="ghost" @click="openChooseModal">
                  更换
                </UButton>
              </div>
            </div>
            <!-- 未选择：显示选择按钮 -->
            <div
              v-else
              class="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer flex items-center justify-between hover:border-qhx-primary transition-colors"
              @click="openChooseModal"
            >
              <span class="text-gray-500 dark:text-gray-400">
                点击选择{{ form.pk_type === 1 ? '帖子' : form.pk_type === 2 ? '服饰' : form.pk_type === 3 ? '搭配' : '图鉴' }}
              </span>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <!-- 计划类型：只读展示，不可切换 -->
          <div v-if="form.pk_type === 5 && editingJournal?.plan" class="space-y-1">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              关联计划
            </label>
            <div class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-3">
              <div class="flex gap-3">
                <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-600">
                  <img
                    :src="getPlanCoverSrc(editingJournal.plan)"
                    :alt="editingJournal.plan.plan_name || '计划'"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {{ editingJournal.plan.plan_name || '未命名计划' }}
                  </div>
                  <div v-if="editingJournal.plan.plan_note" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {{ editingJournal.plan.plan_note }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    ￥{{ formatPlanMoney(editingJournal.plan.have_money) }}/￥{{ formatPlanMoney(editingJournal.plan.need_money) }}
                  </div>
                </div>
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">计划类型不可更换</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              笔记内容
            </label>
            <UTextarea
              v-model="form.note"
              :rows="3"
              placeholder="今日搭配记录、心情笔记..."
              class="w-full"
            />
          </div>
        </div>
        <!-- 底部按钮 -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
          <UButton color="gray" variant="outline" @click="addEditModal = false">
            取消
          </UButton>
          <UButton
            color="primary"
            :loading="addEditLoading"
            @click="handleAddEditSubmit"
          >
            {{ editingJournal ? '保存' : '添加' }}
          </UButton>
        </div>
      </div>
    </QhxModal>

    <!-- 类型选择弹框（参考 scene detail 样式，选择后直接弹出对应选择器） -->
    <QhxModal v-model="typeModalShow" :trigger-position="typeModalPosition" @close="typeModalShow = false">
      <div class="p-4 w-[220px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择类型</h3>

        <!-- 帖子选项 -->
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
          @click="selectTypeAndOpenChooser(1)"
        >
          <div
            class="w-8 h-8 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:article-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">帖子</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">添加帖子记录</div>
          </div>
        </button>

        <!-- 服饰选项 -->
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
          @click="selectTypeAndOpenChooser(2)"
        >
          <div
            class="w-8 h-8 bg-purple-500 dark:bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:checkroom-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">服饰</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">添加服饰记录</div>
          </div>
        </button>

        <!-- 搭配选项 -->
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
          @click="selectTypeAndOpenChooser(3)"
        >
          <div
            class="w-8 h-8 bg-rose-500 dark:bg-rose-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:style-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">搭配</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">添加搭配记录</div>
          </div>
        </button>

        <!-- 图鉴选项 -->
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
          @click="selectTypeAndOpenChooser(4)"
        >
          <div
            class="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:menu-book-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">图鉴</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">添加图鉴记录</div>
          </div>
        </button>
      </div>
    </QhxModal>

    <!-- 帖子选择 -->
    <CommunityChoose
      ref="communityChooseRef"
      :only-mine="true"
      @choose="onCommunityChoose"
    />
    <!-- 服饰选择 -->
    <WardrobeClothesChoose ref="wardrobeClothesChooseRef" @choose="onClothesChoose" />
    <!-- 搭配选择 -->
    <MatchingChoose
      ref="matchingChooseRef"
      :filter-list="matchingFilterList"
      @choose="onMatchingChoose"
    />
    <!-- 图鉴选择 -->
    <LibraryChoose
      ref="libraryChooseRef"
      :multiple="false"
      @choose="onLibraryChoose"
    />

    <!-- 删除确认弹窗 -->
    <UModal v-model="deleteModal" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">操作确认</h3>
        </template>
        <div class="py-4">
          <p class="text-gray-600 dark:text-gray-400">确定要删除该手账记录吗？</p>
        </div>
        <template #footer>
          <div class="flex gap-2 justify-end">
            <UButton color="gray" variant="outline" @click="deleteModal = false">
              取消
            </UButton>
            <UButton color="red" :loading="deleteLoading" @click="handleDelete">
              确认删除
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, computed, watch, nextTick } from 'vue'
import {
  journalListByDate,
  journalInsert,
  journalUpdate,
  journalDelete
} from '@/api/journal'
import type { Journal } from '@/types/api'
import type { Community, Library, PlanList } from '@/types/api'
import type { WardrobeClothes } from '@/types/api'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import CommunityChoose from '@/components/community/CommunityChoose.vue'
import CommentItem from '@/components/comment/CommentItem.vue'
import CommunityItem from '@/components/community/CommunityItem.vue'
import WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import MatchingChoose from '@/components/matching/MatchingChoose.vue'
import LibraryChoose from '@/components/library/LibraryChoose.vue'
import LibraryItem from '@/components/library/LibraryItem.vue'
import { getCommunityDetail } from '@/api/community'
import { getClothesDetail } from '@/api/wardrobe'
import { getMatchingDetail } from '@/api/matching_list'
import { getLibraryDetail } from '@/api/library'
import type { MatchingListItem } from '@/api/matching_list'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'

definePageMeta({
  ssr: false
})

const route = useRoute()
const layoutReady = inject('layoutReady') as Ref<boolean>
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()

const getImageParams = () => configStore.config?.image_params || ''

// [id] 为用户 ID
const userId = computed(() => {
  const id = route.params.id as string
  const num = Number(id)
  return Number.isNaN(num) ? null : num
})

const isOwnJournal = computed(
  () => userId.value !== null && userId.value === userStore.user?.user_id
)

const now = new Date()
const yearSelect = ref(now.getFullYear())
const monthSelect = ref(now.getMonth() + 1)
const dayCountLoading = ref(false)
/** 视图模式：按月(12月块) | 按日(日网格) */
const viewMode = ref<'month' | 'day'>('day')
const monthViewLoading = ref(false)
/** 按月视图：12个月的数据 { month, count, firstImage } */
const monthViewData = ref<Record<number, { count: number; firstImage: string | null }>>({})
/** 按日期(日)分组的手账数据，切换月份时预分组，切换日时直接取用 */
const journalMapByDay = ref<Record<number, Journal[]>>({})
const expandedDay = ref<number | null>(null)
const collapsingDay = ref<number | null>(null)
const daySlotForceCollapse = ref(false)
const journalListForDay = ref<Journal[]>([])

const daysInCurrentMonth = computed(
  () => new Date(yearSelect.value, monthSelect.value, 0).getDate()
)

/** 从单条手账中提取第一张图片路径：community=img_list(逗号分割)，comment=mount_img，wardrobe_clothes=clothes_img */
function getFirstImageFromJournal(j: Journal): string | null {
  if (j.pk_type === 1 && j.community?.img_list) {
    const first = j.community.img_list.split(',')[0]?.trim()
    return first || null
  }
  if (j.pk_type === 0 && j.comment?.mount_img) {
    const first = j.comment.mount_img.split(',')[0]?.trim()
    return first || null
  }
  if (j.pk_type === 2 && j.wardrobe_clothes?.clothes_img) {
    return j.wardrobe_clothes.clothes_img.trim() || null
  }
  if (j.pk_type === 3 && j.matching_list?.cover) {
    return j.matching_list.cover.trim() || null
  }
  if (j.pk_type === 4 && j.library?.cover) {
    return j.library.cover.trim() || null
  }
  if (j.pk_type === 5 && j.plan) {
    const cover = j.plan.plan_cover || j.plan.parent_plan?.plan_cover
    if (cover) return cover.trim()
    if (j.plan.wardrobe_clothes?.clothes_img) return j.plan.wardrobe_clothes.clothes_img.trim()
    return null
  }
  return null
}

const allDaysInMonth = computed(() => {
  const map = journalMapByDay.value
  return Array.from({ length: daysInCurrentMonth.value }, (_, i) => {
    const day = i + 1
    const list = map[day] ?? []
    let firstImage: string | null = null
    for (const j of list) {
      firstImage = getFirstImageFromJournal(j)
      if (firstImage) break
    }
    return { day, count: list.length, firstImage }
  })
})

const displayDay = computed(() => expandedDay.value ?? collapsingDay.value)
const daySlotExpanded = computed(
  () =>
    expandedDay.value !== null ||
    (collapsingDay.value !== null && !daySlotForceCollapse.value)
)

/** 按月视图：12个月块，无数据补 0 */
const all12Months = computed(() => {
  const data = monthViewData.value
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const d = data[month]
    return {
      month,
      count: d?.count ?? 0,
      firstImage: d?.firstImage ?? null
    }
  })
})

// 弹窗
const addEditModal = ref(false)
const addEditClickPosition = ref({ x: 0, y: 0 })
const addEditLoading = ref(false)
const editingJournal = ref<Journal | null>(null)
const deleteModal = ref(false)
const deleteId = ref<number | null>(null)
const deleteLoading = ref(false)

const form = ref<{
  journal_time: string
  pk_type: number
  pk_id: number
  note: string
}>({
  journal_time: '',
  pk_type: 0,
  pk_id: 0,
  note: ''
})

const pkTypeOptions = [
  { label: '帖子', value: 1 },
  { label: '服饰', value: 2 },
  { label: '搭配', value: 3 },
  { label: '图鉴', value: 4 },
  { label: '计划', value: 5 }
]

// 类型选择弹框
const typeModalShow = ref(false)
const typeModalPosition = ref({ x: 0, y: 0 })
const communityChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const wardrobeClothesChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const matchingChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const libraryChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const selectedCommunity = ref<Community | null>(null)
const selectedClothes = ref<WardrobeClothes | null>(null)
const selectedMatching = ref<MatchingListItem | null>(null)
const selectedLibrary = ref<Library | null>(null)

const matchingFilterList = computed(() => {
  const uid = userStore.user?.user_id
  if (!uid) return []
  return [{ field: 'user_id', op: 'eq', value: uid }]
})

const pkTypeLabel = computed(() =>
  pkTypeOptions.find((o) => o.value === form.value.pk_type)?.label || ''
)

function openTypeModal(e?: MouseEvent) {
  if (e) {
    typeModalPosition.value = { x: e.clientX, y: e.clientY }
  } else {
    typeModalPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  typeModalShow.value = true
}

/** 选择类型后直接打开对应选择器 */
function selectTypeAndOpenChooser(value: number) {
  form.value = { ...form.value, pk_type: value, pk_id: 0 }
  selectedCommunity.value = null
  selectedClothes.value = null
  selectedMatching.value = null
  selectedLibrary.value = null
  typeModalShow.value = false
  nextTick(() => {
    if (value === 1) {
      communityChooseRef.value?.showModel()
    } else if (value === 2) {
      wardrobeClothesChooseRef.value?.showModel()
    } else if (value === 3) {
      matchingChooseRef.value?.showModel()
    } else if (value === 4) {
      libraryChooseRef.value?.showModel()
    }
  })
}

function openChooseModal() {
  if (form.value.pk_type === 1) {
    communityChooseRef.value?.showModel()
  } else if (form.value.pk_type === 2) {
    wardrobeClothesChooseRef.value?.showModel()
  } else if (form.value.pk_type === 3) {
    matchingChooseRef.value?.showModel()
  } else if (form.value.pk_type === 4) {
    libraryChooseRef.value?.showModel()
  }
}

function onCommunityChoose(item: Community) {
  const id = item.community_id ?? 0
  form.value = { ...form.value, pk_type: 1, pk_id: id }
  selectedCommunity.value = item
}

function onClothesChoose(item: WardrobeClothes) {
  const id = item.clothes_id ?? 0
  form.value = { ...form.value, pk_type: 2, pk_id: id }
  selectedClothes.value = item
}

function onMatchingChoose(item: MatchingListItem) {
  const id = item.matching_id ?? 0
  form.value = { ...form.value, pk_type: 3, pk_id: id }
  selectedMatching.value = item
}

function onLibraryChoose(list: Library[]) {
  const item = list[0]
  if (!item) return
  const id = item.library_id ?? 0
  form.value = { ...form.value, pk_type: 4, pk_id: id }
  selectedLibrary.value = item
}

function jumpToClothes(clothes: WardrobeClothes) {
  if (clothes?.clothes_id) {
    navigateTo(`/clothes/detail/${clothes.clothes_id}`)
  }
}

function jumpToCommunity(community: Community) {
  if (community?.community_id) {
    navigateTo(`/community/detail/${community.community_id}`)
  }
}

function jumpToMatching(matching: MatchingListItem) {
  if (matching?.matching_id) {
    navigateTo(`/matching/detail/${matching.matching_id}`)
  }
}

function jumpToLibrary(library: Library) {
  if (library?.library_id) {
    navigateTo(`/library/detail/${library.library_id}`)
  }
}

function jumpToPlan(plan: PlanList) {
  if (plan?.list_id) {
    navigateTo('/user/plan')
  }
}

function getPlanCoverSrc(plan: PlanList): string {
  const cover = plan.plan_cover || plan.parent_plan?.plan_cover
  if (cover) return `${BASE_IMG}${cover}${getImageParams()}`
  const clothes = plan.wardrobe_clothes
  if (clothes?.clothes_img) return `${BASE_IMG}${clothes.clothes_img}${getImageParams()}`
  return `${BASE_IMG}static/plan_cover/default.jpg`
}

function formatPlanMoney(money: number | undefined): string {
  if (money === undefined || money === null) return '0'
  return Number(money).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function getPlanProgress(plan: PlanList): number {
  const needMoney = plan.need_money || 0
  const haveMoney = plan.have_money || 0
  if (needMoney === 0) return 0
  const progress = (haveMoney / needMoney) * 100
  return Math.min(Math.max(Math.round(progress), 0), 100)
}

function getPkTypeLabel(pkType: number): string {
  const labels: Record<number, string> = {
    0: '签到',
    1: '帖子',
    2: '服饰',
    3: '搭配',
    4: '图鉴',
    5: '计划'
  }
  return labels[pkType] ?? '其他'
}

/** 去除 HTML 标签，取纯文本 */

function formatTime(iso: string): string {
  try {
    return dayjs(iso).format('HH:mm')
  } catch {
    return ''
  }
}

/** 切换月份时请求一次当月所有数据，按 journal_time 日期分组便于快速切换日获取数据 */
async function fetchMonthData() {
  const uid = userId.value
  if (!uid) {
    journalMapByDay.value = {}
    return
  }
  dayCountLoading.value = true
  try {
    const list = await journalListByDate({
      year: String(yearSelect.value),
      month: String(monthSelect.value),
      user_id: uid
    })
    const map: Record<number, Journal[]> = {}
    for (const j of list) {
      const day = dayFromJournalTime(j.journal_time)
      if (day) {
        if (!map[day]) map[day] = []
        map[day].push(j)
      }
    }
    journalMapByDay.value = map
  } catch (error) {
    console.error('获取当月手账失败:', error)
    toast.add({
      title: '获取当月手账失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    journalMapByDay.value = {}
  } finally {
    dayCountLoading.value = false
  }
}

/** 按月视图：拉取当年12个月的数据 */
async function fetchYearMonthData() {
  const uid = userId.value
  if (!uid) {
    monthViewData.value = {}
    return
  }
  monthViewLoading.value = true
  try {
    const year = yearSelect.value
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        journalListByDate({
          year: String(year),
          month: String(i + 1),
          user_id: uid
        })
      )
    )
    const data: Record<number, { count: number; firstImage: string | null }> = {}
    results.forEach((list, i) => {
      const month = i + 1
      let firstImage: string | null = null
      for (const j of list) {
        firstImage = getFirstImageFromJournal(j)
        if (firstImage) break
      }
      data[month] = { count: list.length, firstImage }
    })
    monthViewData.value = data
  } catch (error) {
    console.error('获取年度手账失败:', error)
    toast.add({
      title: '获取年度手账失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    monthViewData.value = {}
  } finally {
    monthViewLoading.value = false
  }
}

/** 按月视图中点击某月：切换到按日视图并选中该月 */
function goToMonth(month: number) {
  monthSelect.value = month
  viewMode.value = 'day'
  fetchMonthData()
}

/** 根据当前视图模式刷新数据（增删改后调用） */
async function refreshCurrentView() {
  if (viewMode.value === 'month') {
    await fetchYearMonthData()
  } else {
    await fetchMonthData()
    if (expandedDay.value !== null) {
      filterJournalListForDay(expandedDay.value)
    }
  }
}

/** 从 journal_time (YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss) 解析日 */
function dayFromJournalTime(journalTime: string): number | null {
  if (!journalTime) return null
  const parts = journalTime.split(/[-T\s]/)
  const day = Number.parseInt(parts[2], 10)
  return Number.isNaN(day) ? null : day
}

/** 从按日分组缓存中取指定日的手账列表（无需请求） */
function filterJournalListForDay(day: number) {
  journalListForDay.value = journalMapByDay.value[day] ?? []
}

function prevYear() {
  yearSelect.value -= 1
  expandedDay.value = null
  fetchMonthData()
}

function nextYear() {
  yearSelect.value += 1
  expandedDay.value = null
  fetchMonthData()
}

function prevMonth() {
  if (monthSelect.value <= 1) {
    yearSelect.value -= 1
    monthSelect.value = 12
  } else {
    monthSelect.value -= 1
  }
  expandedDay.value = null
  fetchMonthData()
}

function nextMonth() {
  if (monthSelect.value >= 12) {
    yearSelect.value += 1
    monthSelect.value = 1
  } else {
    monthSelect.value += 1
  }
  expandedDay.value = null
  fetchMonthData()
}

async function toggleDayExpand(day: number) {
  if (expandedDay.value === day) {
    collapsingDay.value = day
    expandedDay.value = null
    await nextTick()
    daySlotForceCollapse.value = true
    return
  }
  collapsingDay.value = null
  daySlotForceCollapse.value = false
  expandedDay.value = day
  filterJournalListForDay(day)
}

function onDaySlotTransitionEnd() {
  if (collapsingDay.value !== null) {
    collapsingDay.value = null
    daySlotForceCollapse.value = false
  }
}

function setAddEditClickPosition(event?: MouseEvent) {
  if (event) {
    addEditClickPosition.value = { x: event.clientX, y: event.clientY }
  } else {
    addEditClickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
}

function openAddJournal(event?: MouseEvent) {
  setAddEditClickPosition(event)
  editingJournal.value = null
  selectedCommunity.value = null
  selectedClothes.value = null
  selectedMatching.value = null
  selectedLibrary.value = null
  form.value = {
    journal_time: dayjs().format('YYYY-MM-DD'),
    pk_type: 0,
    pk_id: 0,
    note: ''
  }
  addEditModal.value = true
}

function openAddJournalForDay(day: number, event?: MouseEvent) {
  setAddEditClickPosition(event)
  editingJournal.value = null
  selectedCommunity.value = null
  selectedClothes.value = null
  selectedMatching.value = null
  selectedLibrary.value = null
  const pad = (n: number) => String(n).padStart(2, '0')
  form.value = {
    journal_time: `${yearSelect.value}-${pad(monthSelect.value)}-${pad(day)}`,
    pk_type: 0,
    pk_id: 0,
    note: ''
  }
  addEditModal.value = true
}

async function editJournal(item: Journal, event?: MouseEvent) {
  setAddEditClickPosition(event)
  editingJournal.value = item
  selectedCommunity.value = null
  selectedClothes.value = null
  selectedMatching.value = null
  selectedLibrary.value = null
  form.value = {
    journal_time: item.journal_time,
    pk_type: item.pk_type,
    pk_id: item.pk_id,
    note: item.note || ''
  }
  addEditModal.value = true
  // 回显：根据类型请求详情
  if (item.pk_type === 1 && item.pk_id) {
    try {
      selectedCommunity.value = await getCommunityDetail({
        community_id: item.pk_id
      })
    } catch {
      // 忽略
    }
  } else if (item.pk_type === 2 && item.pk_id) {
    try {
      selectedClothes.value = await getClothesDetail({
        clothes_id: item.pk_id
      })
    } catch {
      // 忽略
    }
  } else if (item.pk_type === 3 && item.pk_id) {
    try {
      selectedMatching.value = await getMatchingDetail({
        matching_id: item.pk_id
      })
    } catch {
      // 忽略
    }
  } else if (item.pk_type === 4 && item.pk_id) {
    try {
      const res = await getLibraryDetail({
        library_id: item.pk_id
      })
      selectedLibrary.value = res?.library ?? null
    } catch {
      // 忽略
    }
  }
}

async function handleAddEditSubmit() {
  const uid = userStore.user?.user_id
  if (!uid || !isOwnJournal.value) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (!form.value.journal_time) {
    toast.add({
      title: '请选择日期',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (!form.value.pk_type || !form.value.pk_id) {
    toast.add({
      title: '请选择类型并选择关联的帖子、服饰、搭配或图鉴',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  const journalTime = form.value.journal_time?.slice(0, 10) || form.value.journal_time

  addEditLoading.value = true
  try {
    if (editingJournal.value) {
      await journalUpdate({
        journal_id: editingJournal.value.journal_id,
        journal_time: journalTime,
        pk_type: form.value.pk_type,
        pk_id: form.value.pk_id,
        note: form.value.note
      })
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      await journalInsert({
        journal_time: journalTime,
        pk_type: form.value.pk_type,
        pk_id: form.value.pk_id,
        note: form.value.note
      })
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    addEditModal.value = false
    await refreshCurrentView()
  } catch (error) {
    console.error('操作失败:', error)
  } finally {
    addEditLoading.value = false
  }
}

function confirmDelete(id: number) {
  deleteId.value = id
  deleteModal.value = true
}

async function handleDelete() {
  if (!deleteId.value) return
  deleteLoading.value = true
  try {
    await journalDelete({ journal_id: deleteId.value })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    deleteModal.value = false
    deleteId.value = null
    await refreshCurrentView()
  } catch (error) {
    console.error('删除失败:', error)
  } finally {
    deleteLoading.value = false
  }
}

// 监听路由 id 或 layoutReady 变化，加载数据
watch(
  [() => userId.value, layoutReady],
  ([uid, ready]) => {
    if (ready && uid) {
      const now = new Date()
      yearSelect.value = now.getFullYear()
      monthSelect.value = now.getMonth() + 1
      if (viewMode.value === 'month') {
        fetchYearMonthData()
      } else {
        fetchMonthData()
      }
    }
  },
  { immediate: true }
)

useHead({
  title: '手账',
  meta: [
    { name: 'keywords', content: '手账,Lo研社,每日记录' },
    { name: 'description', content: '记录每日搭配与生活' }
  ]
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.month-slot {
  transition: grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
</style>
