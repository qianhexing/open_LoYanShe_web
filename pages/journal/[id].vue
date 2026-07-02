<template>
  <div class="journal-page journal-book-page relative min-h-screen w-full overflow-x-hidden font-serif">
    <!-- 日式书页背景 -->
    <div class="journal-paper-bg fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <div class="journal-paper-gradient" />
      <div class="journal-paper-texture" />
      <div class="journal-paper-vignette" />
      <div class="journal-paper-spine" />
      <div class="journal-paper-margin" />
      <div class="journal-paper-rules" />
    </div>

    <div class="relative z-[1]">
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
      aria-hidden="true"
    />
    <div class="container journal-sheet mx-auto px-3 py-2 pb-20 max-w-4xl">
    <!-- 功能栏：登录用户显示；自己手账可关联 / 写新帖 -->
    <div
      v-if="layoutReady && userStore.user"
      class="journal-neu-toolbar flex justify-between items-center sticky z-10 mb-4 rounded-2xl px-2 py-2"
      :style="{ top: `${10 + (configStore.statusBarHeight || 0)}px` }"
    >
      <div class="flex flex-wrap items-center gap-2">
        <template v-if="isOwnJournal">
          <QhxJellyButton>
            <div
              class="text-center px-1 cursor-pointer"
              @click="(e: MouseEvent) => goNewJournalPost(e)"
            >
              <div
                class="journal-fab-add m-[5px] text-white rounded-full h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary"
              >
                <UIcon name="i-heroicons-pencil-square" class="text-[18px] text-[#ffffff]" />
              </div>
              <div class="text-[10px] leading-tight text-[#6b4f5f] dark:text-[var(--ink-muted)]">新增</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div
              class="text-center px-1 cursor-pointer"
              @click="(e: MouseEvent) => openLinkJournal(e)"
            >
              <div
                class="journal-fab-add m-[5px] text-white rounded-full h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary"
              >
                <UIcon name="i-heroicons-link" class="text-[18px] text-[#ffffff]" />
              </div>
              <div class="text-[10px] leading-tight text-[#6b4f5f] dark:text-[var(--ink-muted)]">关联</div>
            </div>
          </QhxJellyButton>
        </template>
        <!-- 按月 / 按日切换 -->
        <div class="journal-tab-rail flex rounded-xl p-0.5 gap-0.5 flex-wrap">
          <button
            type="button"
            class="journal-tab-btn flex-1 min-w-[4.5rem] rounded-lg px-2 py-1.5 text-xs font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/45"
            :class="
              viewMode === 'day'
                ? 'journal-tab-btn--active'
                : 'journal-tab-btn--idle active:scale-[0.99]'
            "
            @click="switchToDayView()"
          >
            按日
          </button>
          <button
            type="button"
            class="journal-tab-btn flex-1 min-w-[4.5rem] rounded-lg px-2 py-1.5 text-xs font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/45"
            :class="
              viewMode === 'month'
                ? 'journal-tab-btn--active'
                : 'journal-tab-btn--idle active:scale-[0.99]'
            "
            @click="viewMode = 'month'; fetchYearMonthData()"
          >
            按月
          </button>
        </div>
      </div>
      <button
        type="button"
        class="journal-neu-icon-btn flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-[#6b4f5f] dark:text-[var(--ink-muted)] disabled:opacity-50"
        :disabled="journalShareGenerating"
        @click="generateJournalShare()"
      >
        <UIcon
          :name="journalShareGenerating ? 'i-heroicons-arrow-path' : 'i-heroicons-photo-20-solid'"
          class="w-4 h-4"
          :class="{ 'animate-spin': journalShareGenerating }"
        />
        <span>{{ journalShareGenerating ? '生成中' : '分享图' }}</span>
      </button>
    </div>

    <!-- 按月视图：12个月块，点击进入该月按日视图 -->
    <div v-if="layoutReady && userId && viewMode === 'month'" class="space-y-2">
      <!-- 年份切换 + 筛选 -->
      <div class="mb-3 px-1">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="yearSelect = yearSelect - 1; fetchYearMonthData()"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
            </button>
            <span class="text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)] min-w-[60px] text-center">{{ yearSelect }}年</span>
            <button
              type="button"
              class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="yearSelect = yearSelect + 1; fetchYearMonthData()"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
            </button>
          </div>
          <button
            v-if="filterTagOptions.length > 0"
            type="button"
            class="journal-neu-icon-btn flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-[#6b4f5f] dark:text-[var(--ink-muted)]"
            @click="openFilterModal($event)"
          >
            <UIcon name="i-heroicons-funnel" class="w-4 h-4" />
            <span>筛选</span>
            <span
              v-if="filterTags.length > 0"
              class="journal-neu-badge min-w-[16px] h-4 flex items-center justify-center rounded-full text-white text-[10px] font-semibold px-1 leading-none"
            >
              {{ filterTags.length }}
            </span>
          </button>
        </div>
        <div
          v-if="filterTags.length > 0"
          class="flex flex-wrap items-center gap-2 mt-2"
        >
          <QhxJellyButton v-for="tag in filterTags" :key="`echo-month-${tag}`">
            <QhxTag
              :active="true"
              class="cursor-pointer"
              @click="toggleFilterTag(tag)"
            >
              {{ tag }}
            </QhxTag>
          </QhxJellyButton>
          <button
            type="button"
            class="text-xs text-[#8a7355] dark:text-[var(--accent-warm)] underline underline-offset-2"
            @click="clearFilterTags"
          >
            清除
          </button>
        </div>
      </div>
      <div
        v-if="monthViewLoading && !hasMonthViewCache"
        class="journal-neu-well text-center py-8 rounded-3xl text-sm text-[#7a5f6f] dark:text-[var(--ink-muted)]"
      >
        加载中...
      </div>
      <div v-else class="grid grid-cols-4 gap-2 relative">
        <div
          v-if="monthViewLoading"
          class="absolute inset-0 z-[1] rounded-3xl bg-[var(--paper-bg)]/40 dark:bg-[#1a1218]/30 pointer-events-none"
          aria-hidden="true"
        />
        <button
          v-for="m in all12Months"
          :key="m.month"
          type="button"
          class="journal-neu-tile relative aspect-[1/1] cursor-pointer overflow-hidden rounded-xl text-center min-w-0 min-h-[48px] transition-transform active:scale-[0.98]"
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
            class="journal-neu-badge absolute top-[-2px] right-[-2px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white text-[10px] font-semibold px-1 leading-none z-[1]"
          >
            {{ m.count > 99 ? '99+' : m.count }}
          </span>
        </button>
      </div>
    </div>

    <!-- 按日视图：年月选择 + 每日网格 -->
    <div v-if="layoutReady && userId && viewMode === 'day'" class="space-y-2">
      <!-- 年月切换 + 筛选 -->
      <div class="mb-3 px-1">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
                @click="prevYear"
              >
                <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
              </button>
              <span class="text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)] min-w-[50px] text-center">
                {{ yearSelect }}年
              </span>
              <button
                type="button"
                class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
                @click="nextYear"
              >
                <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
              </button>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
                @click="prevMonth"
              >
                <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
              </button>
              <span class="text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)] min-w-[40px] text-center">
                {{ monthSelect }}月
              </span>
              <button
                type="button"
                class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
                @click="nextMonth"
              >
                <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            v-if="filterTagOptions.length > 0"
            type="button"
            class="journal-neu-icon-btn flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-[#6b4f5f] dark:text-[var(--ink-muted)]"
            @click="openFilterModal($event)"
          >
            <UIcon name="i-heroicons-funnel" class="w-4 h-4" />
            <span>筛选</span>
            <span
              v-if="filterTags.length > 0"
              class="journal-neu-badge min-w-[16px] h-4 flex items-center justify-center rounded-full text-white text-[10px] font-semibold px-1 leading-none"
            >
              {{ filterTags.length }}
            </span>
          </button>
        </div>
        <div
          v-if="filterTags.length > 0"
          class="flex flex-wrap items-center gap-2 mt-2"
        >
          <QhxJellyButton v-for="tag in filterTags" :key="`echo-day-${tag}`">
            <QhxTag
              :active="true"
              class="cursor-pointer"
              @click="toggleFilterTag(tag)"
            >
              {{ tag }}
            </QhxTag>
          </QhxJellyButton>
          <button
            type="button"
            class="text-xs text-[#8a7355] dark:text-[var(--accent-warm)] underline underline-offset-2"
            @click="clearFilterTags"
          >
            清除
          </button>
        </div>
      </div>

      <!-- 日块：4列网格，一排4个 -->
      <div
        v-if="dayCountLoading && !hasDayGridCache"
        class="journal-neu-well text-center py-8 rounded-3xl text-sm text-[#7a5f6f] dark:text-[var(--ink-muted)]"
      >
        加载中...
      </div>
      <div v-else class="space-y-2 relative">
        <div
          v-if="dayCountLoading"
          class="absolute inset-0 z-[1] rounded-3xl bg-[var(--paper-bg)]/40 dark:bg-[#1a1218]/30 pointer-events-none"
          aria-hidden="true"
        />
        <div class="grid grid-cols-7 gap-2">
          <div
            v-for="d in allDaysInMonth"
            :key="d.day"
            class="journal-neu-tile relative aspect-[1/1] cursor-pointer overflow-hidden rounded-xl text-center min-w-0 min-h-[48px] transition-all active:scale-[0.98]"
            :class="{ 'journal-neu-tile--active': expandedDay === d.day }"
            @click="toggleDaySelect(d.day)"
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
              class="journal-neu-badge absolute top-[-2px] right-[-2px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white text-[10px] font-semibold px-1 leading-none z-[1]"
            >
              {{ d.count > 99 ? '99+' : d.count }}
            </span>
          </div>
        </div>
      </div>

      <!-- 下方列表：未选日期显示全部，选中日期只显示当日 -->
      <div class="mt-4 space-y-4 relative">
        <div
          v-if="showFullList && listModeLoading && !hasListCache"
          class="journal-neu-well text-center py-8 rounded-3xl text-sm text-[#7a5f6f] dark:text-[var(--ink-muted)]"
        >
          加载中...
        </div>
        <template v-else>
          <div
            v-if="showFullList && listModeLoading"
            class="absolute inset-x-0 top-0 h-1 z-[1] overflow-hidden rounded-full opacity-60 pointer-events-none"
            aria-hidden="true"
          >
            <div class="h-full w-1/3 bg-[var(--accent-warm)] animate-pulse rounded-full" />
          </div>
          <div
            v-if="!displayJournalGroups.some((g) => g.items.length > 0)"
            class="journal-neu-well text-center py-12 rounded-3xl text-sm text-[#9d8090] dark:text-[var(--ink-faint)]"
          >
            暂无记录
          </div>
          <div v-else class="space-y-5">
            <section
              v-for="group in displayJournalGroups"
              :key="group.dateKey"
              class="space-y-2"
            >
              <div
                v-if="group.items.length > 0"
                class="px-1 py-1 border-b border-[var(--border-light)]"
              >
                <h2 class="text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)]">
                  {{ group.title }}
                </h2>
              </div>
              <div class="space-y-3">
                <div
                  v-for="j in group.items"
                  :key="j.journal_id"
                  class="journal-neu-entry rounded-2xl overflow-hidden"
                  :class="{ 'journal-neu-entry--clickable': canJumpJournalItem(j) }"
                  @click="onJournalItemClick(j, $event)"
                >
                  <div class="journal-neu-entry-head flex items-center justify-between px-3 py-2">
                    <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">
                      {{ getPkTypeLabel(j.pk_type) }}
                      <span v-if="j.create_time" class="ml-1">{{ formatTime(j.create_time) }}</span>
                    </div>
                    <button
                      v-if="isOwnJournal && j.pk_type !== 0"
                      type="button"
                      class="journal-neu-icon-btn w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
                      @click.stop="openJournalEntryMoreMenu(j, $event)"
                    >
                      <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4" />
                    </button>
                  </div>
                  <div class="p-3">
                    <CommentItem
                      v-if="j.pk_type === 0 && j.comment"
                      :item="j.comment"
                      :ui="'p-0'"
                      :need_bottom="false"
                    />
                    <p v-else-if="j.pk_type === 0" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                    <CommunityItem
                      v-else-if="j.pk_type === 1 && j.community"
                      :item="j.community"
                      size="big"
                      :need-jump="false"
                      class="!m-0 !shadow-none border-0"
                    />
                    <p v-else-if="j.pk_type === 1" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                    <div v-else-if="j.pk_type === 2 && j.wardrobe_clothes" class="flex gap-3">
                      <div class="journal-neu-thumb w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          :src="`${BASE_IMG}${j.wardrobe_clothes.clothes_img || ''}${getImageParams()}`"
                          :alt="j.wardrobe_clothes.clothes_note"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)] truncate">
                          {{ j.wardrobe_clothes.clothes_note || '暂无笔记' }}
                        </div>
                        <div v-if="j.wardrobe_clothes.wardrobe_status" class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)] mt-0.5">
                          状态：{{ j.wardrobe_clothes.wardrobe_status }}
                        </div>
                        <div v-if="j.wardrobe_clothes.clothes_part" class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">
                          部位：{{ j.wardrobe_clothes.clothes_part }}
                        </div>
                      </div>
                    </div>
                    <p v-else-if="j.pk_type === 2" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                    <div v-else-if="j.pk_type === 3 && j.matching_list" class="flex gap-3">
                      <div
                        v-if="j.matching_list.cover"
                        class="journal-neu-thumb w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                      >
                        <img
                          :src="`${BASE_IMG}${j.matching_list.cover}${getImageParams()}`"
                          :alt="j.matching_list.note || '搭配'"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)] truncate">
                          {{ j.matching_list.note || '未命名搭配' }}
                        </div>
                        <div v-if="j.matching_list.main_style" class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)] mt-0.5">
                          风格：{{ j.matching_list.main_style }}
                        </div>
                      </div>
                    </div>
                    <p v-else-if="j.pk_type === 3" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                    <LibraryItem
                      v-else-if="j.pk_type === 4 && j.library"
                      :need-jump="false"
                      :size="'mini-list'"
                      :item="j.library"
                    />
                    <p v-else-if="j.pk_type === 4" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                    <div v-else-if="j.pk_type === 5 && j.plan" class="flex gap-3">
                      <div class="journal-neu-thumb w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--paper-dent)]">
                        <img
                          :src="getPlanCoverSrc(j.plan)"
                          :alt="j.plan.plan_name || '计划'"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)] truncate">
                          {{ j.plan.plan_name || '未命名计划' }}
                        </div>
                        <div v-if="j.plan.plan_note" class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)] mt-0.5 truncate">
                          {{ j.plan.plan_note }}
                        </div>
                        <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)] mt-0.5">
                          ￥{{ formatPlanMoney(j.plan.have_money) }}/￥{{ formatPlanMoney(j.plan.need_money) }}
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                          <div class="journal-neu-progress-track flex-1 rounded-full h-1.5 max-w-24">
                            <div class="bg-[var(--accent-warm)] h-1.5 rounded-full shadow-sm" :style="{ width: `${getPlanProgress(j.plan)}%` }" />
                          </div>
                          <span class="text-[10px] text-[#8a6f7d] dark:text-[var(--ink-muted)]">{{ Math.ceil(getPlanProgress(j.plan)) }}%</span>
                        </div>
                      </div>
                    </div>
                    <p v-else-if="j.pk_type === 5" class="text-sm text-amber-600 dark:text-amber-400">关联已失效</p>
                    <p v-else class="text-sm text-[#4a2f3d] dark:text-[var(--ink-secondary)]">
                      {{ j.note || '无笔记' }}
                    </p>
                  </div>
                  <div
                    v-if="parseJournalTags(j.tags).length"
                    class="px-3 pb-2 flex flex-wrap gap-0.5"
                  >
                    <QhxTag v-for="tag in parseJournalTags(j.tags)" :key="tag">
                      {{ tag }}
                    </QhxTag>
                  </div>
                  <div v-if="j.note && (j.community || j.comment || j.wardrobe_clothes || j.matching_list || j.library || j.plan)" class="px-3 pb-3 pt-0">
                    <div class="journal-neu-note text-xs text-[#7a5f6a] dark:text-[var(--ink-muted)] rounded-xl px-2 py-1.5">
                      <span class="font-medium text-amber-700 dark:text-amber-400"></span>
                      {{ j.note }}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
      </div>
    </div>

    <!-- 未登录或无效用户ID -->
    <div
      v-if="layoutReady && (!userStore.user || !userId)"
      class="journal-neu-well text-center py-12 rounded-3xl"
    >
      <div class="text-[#8a6f7d] dark:text-[var(--ink-muted)]">
        {{ !userStore.user ? '请先登录后使用手账功能' : '无效的手账页' }}
      </div>
    </div>

    <!-- 添加/编辑手账弹窗（参考 ClothesAdd 使用 QhxModal） -->
    <QhxModal v-model="addEditModal" :trigger-position="addEditClickPosition" @close="addEditModal = false">
      <div class="journal-neu-modal w-[95vw] max-w-md max-h-[90vh] rounded-2xl overflow-hidden flex flex-col">
        <!-- 头部 -->
        <div class="journal-neu-modal-head flex items-center justify-between px-6 py-4 flex-shrink-0">
          <h3 class="text-lg font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)]">{{ editingJournal ? '编辑手账' : '关联手账' }}</h3>
          <button
            type="button"
            @click="addEditModal = false"
            class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-full group"
          >
            <UIcon name="i-heroicons-x-mark" class="text-[#7a5f6f] dark:text-[var(--ink-muted)] group-hover:text-[#4a2f3d] dark:group-hover:text-[var(--ink-primary)] transition-colors" />
          </button>
        </div>
        <!-- 内容区域 -->
        <div class="journal-neu-modal-body flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-[#c4b8c0] dark:scrollbar-thumb-[#5c4a55] scrollbar-track-transparent">
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              日期
            </label>
            <QhxDateTimePicker
              v-if="journalDateEditable"
              v-model="form.journal_time"
              placeholder="选择日期"
              mode="date"
              format="YYYY-MM-DD"
              :enable-time-picker="false"
              class="w-full"
            />
            <template v-else>
              <div
                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 text-sm"
              >
                {{ form.journal_time }}
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                新增默认为今日；切换到「按日」后可选择其它日期。
              </p>
            </template>
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
              标签
            </label>
            <div v-if="visibleTagOptions.length > 0" class="flex flex-wrap gap-2 mb-2">
              <QhxJellyButton v-for="tag in visibleTagOptions" :key="tag">
                <QhxTag
                  :active="isJournalTagSelected(tag)"
                  class="cursor-pointer"
                  @click="toggleJournalTag(tag)"
                >
                  <div class="flex items-center gap-1">
                    <QhxJellyButton
                      v-if="isConfigCustomTag(tag)"
                      class="cursor-pointer flex items-center text-white rounded-full w-[18px] h-[18px] justify-center bg-qhx-primary shrink-0"
                      @click.stop="openDeleteTagConfirm(tag, $event)"
                    >
                      <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                    </QhxJellyButton>
                    <span>{{ tag }}</span>
                  </div>
                </QhxTag>
              </QhxJellyButton>
            </div>
            <customInput ref="tagInputRef" @insert="addJournalTag" />
            <button
              type="button"
              class="journal-neu-icon-btn mt-2 rounded-lg px-3 py-1.5 text-xs text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="openTagInput($event)"
            >
              添加自定义标签
            </button>
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
        <div class="journal-neu-modal-foot flex-shrink-0 px-6 py-4 flex gap-2 justify-end">
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

    <CommunityPostModal
      ref="journalPostModalRef"
      v-model="showJournalPostModal"
      modal-title="写新手账"
      :skip-summary-link="true"
      :success-redirect="false"
      @success="onJournalPostSuccess"
    />

    <!-- 手账日历分享图（点击后直接生成，成功后弹出预览） -->
    <JournalCalendarShareImage
      ref="journalShareRef"
      :payload="journalSharePayload"
      panelless
    />

    <!-- 标签筛选弹窗 -->
    <QhxModal
      v-model="filterModalShow"
      :trigger-position="filterModalPosition"
      @close="filterModalShow = false"
    >
      <div class="journal-neu-type-pop journal-neu-filter-pop p-4 w-[95vw] max-w-sm rounded-2xl max-h-[70vh] overflow-y-auto">
        <h3 class="text-sm font-bold mb-1 text-[#4a2f3d] dark:text-[var(--ink-primary)]">标签筛选</h3>
        <p class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)] mb-3">
          选中任一标签即展示匹配记录（可多选）
        </p>
        <div v-if="filterTagOptions.length > 0" class="flex flex-wrap gap-2">
          <QhxJellyButton v-for="tag in filterTagOptions" :key="`filter-modal-${tag}`">
            <QhxTag
              :active="filterTags.includes(tag)"
              class="cursor-pointer"
              @click="toggleFilterTag(tag)"
            >
              {{ tag }}
            </QhxTag>
          </QhxJellyButton>
        </div>
        <p v-else class="text-xs text-[#9d8090] dark:text-[var(--ink-faint)] py-4 text-center">
          暂无可筛选标签
        </p>
        <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[var(--border-light)]">
          <button
            type="button"
            class="text-xs text-[#8a7355] dark:text-[var(--accent-warm)] underline underline-offset-2 disabled:opacity-40"
            :disabled="filterTags.length === 0"
            @click="clearFilterTags"
          >
            清除全部
          </button>
          <UButton
            size="xs"
            color="primary"
            @click="filterModalShow = false"
          >
            完成
          </UButton>
        </div>
      </div>
    </QhxModal>

    <!-- 类型选择弹框（参考 scene detail 样式，选择后直接弹出对应选择器） -->
    <QhxModal v-model="typeModalShow" :trigger-position="typeModalPosition" @close="typeModalShow = false">
      <div class="journal-neu-type-pop p-4 w-[220px] rounded-2xl">
        <h3 class="text-sm font-bold mb-3 text-[#4a2f3d] dark:text-[var(--ink-primary)]">选择类型</h3>

        <!-- 帖子选项 -->
        <button
          type="button"
          class="journal-neu-type-row w-full flex items-center gap-3 p-3 rounded-xl text-left group transition-transform active:scale-[0.99]"
          @click="selectTypeAndOpenChooser(1)"
        >
          <div
            class="w-8 h-8 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:article-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)]">帖子</div>
            <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">添加帖子记录</div>
          </div>
        </button>

        <!-- 服饰选项 -->
        <button
          type="button"
          class="journal-neu-type-row w-full flex items-center gap-3 p-3 rounded-xl text-left group mt-2 transition-transform active:scale-[0.99]"
          @click="selectTypeAndOpenChooser(2)"
        >
          <div
            class="w-8 h-8 bg-purple-500 dark:bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:checkroom-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)]">服饰</div>
            <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">添加服饰记录</div>
          </div>
        </button>

        <!-- 搭配选项 -->
        <button
          type="button"
          class="journal-neu-type-row w-full flex items-center gap-3 p-3 rounded-xl text-left group mt-2 transition-transform active:scale-[0.99]"
          @click="selectTypeAndOpenChooser(3)"
        >
          <div
            class="w-8 h-8 bg-rose-500 dark:bg-rose-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:style-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)]">搭配</div>
            <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">添加搭配记录</div>
          </div>
        </button>

        <!-- 图鉴选项 -->
        <button
          type="button"
          class="journal-neu-type-row w-full flex items-center gap-3 p-3 rounded-xl text-left group mt-2 transition-transform active:scale-[0.99]"
          @click="selectTypeAndOpenChooser(4)"
        >
          <div
            class="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="material-symbols:menu-book-rounded" class="text-base text-white" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)]">图鉴</div>
            <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">添加图鉴记录</div>
          </div>
        </button>
      </div>
    </QhxModal>

    <!-- 手账条目更多（编辑 / 删除） -->
    <QhxModal
      v-model="journalEntryMoreModal"
      :trigger-position="journalEntryMorePosition"
      @close="closeJournalEntryMoreMenu"
    >
      <div class="journal-neu-type-pop p-4 w-[200px] rounded-2xl">
        <h3 class="text-sm font-bold mb-3 text-[#4a2f3d] dark:text-[var(--ink-primary)]">更多选项</h3>

        <button
          type="button"
          class="journal-neu-type-row w-full flex items-center gap-3 p-3 rounded-xl text-left group transition-transform active:scale-[0.99]"
          @click="onJournalEntryMoreEdit($event)"
        >
          <div
            class="w-8 h-8 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="i-heroicons-pencil-square" class="text-base text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)]">编辑</div>
            <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">修改手账记录</div>
          </div>
        </button>

        <button
          type="button"
          class="journal-neu-type-row w-full flex items-center gap-3 p-3 rounded-xl text-left group mt-2 transition-transform active:scale-[0.99]"
          @click="onJournalEntryMoreDelete"
        >
          <div
            class="w-8 h-8 bg-red-500 dark:bg-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <UIcon name="i-heroicons-trash" class="text-base text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[#3d2833] dark:text-[var(--ink-primary)]">删除</div>
            <div class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]">移除此条手账</div>
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

    <!-- 删除自定义标签确认（QhxModal） -->
    <QhxModal
      v-model="deleteTagModal"
      :trigger-position="deleteTagModalPosition"
      @close="closeDeleteTagConfirm"
    >
      <div class="p-6 w-[320px] max-w-[90vw] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg border border-gray-200/50 dark:border-gray-700/50">
        <h3 class="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">
          删除标签
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          确定删除标签「{{ pendingDeleteTag }}」？将从你的标签库中移除，已选手账中的该标签也会被取消选中。
        </p>
        <div class="flex justify-end gap-2 mt-6">
          <UButton
            type="button"
            color="gray"
            variant="soft"
            :disabled="deleteTagLoading"
            @click.stop="closeDeleteTagConfirm"
          >
            取消
          </UButton>
          <UButton
            type="button"
            color="red"
            :loading="deleteTagLoading"
            @click.stop="confirmDeleteJournalTag"
          >
            确认删除
          </UButton>
        </div>
      </div>
    </QhxModal>

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, computed, watch, nextTick } from 'vue'
import {
  journalList,
  journalListByDate,
  journalInsert,
  journalUpdate,
  journalDelete
} from '@/api/journal'
import type { Journal, User } from '@/types/api'
import { getUserSpace } from '@/api/user'
import JournalCalendarShareImage from '@/components/journal/JournalCalendarShareImage.vue'
import type { JournalCalendarSharePayload } from '@/utils/journalShareCanvas'
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
import customInput from '@/components/Clothes/customInput.vue'
import CommunityPostModal from '@/components/community/CommunityPostModal.vue'
import { getCommunityDetail } from '@/api/community'
import { getClothesDetail } from '@/api/wardrobe'
import { getMatchingDetail } from '@/api/matching_list'
import { getLibraryDetail } from '@/api/library'
import type { MatchingListItem } from '@/api/matching_list'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import {
  openLibraryWebPath,
  openLibraryDetailTab,
  isHtml5PlusWebview
} from '@/composables/useLibraryDetailNavigation'
import {
  JOURNAL_SIGN_IN_FILTER_TAG,
  JOURNAL_DEFAULT_TAGS,
  JOURNAL_TAGS_CONFIG_KEY,
  getJournalCustomTagsFromUser,
  mergeJournalTagOptions,
  isJournalDefaultTag
} from '@/composables/useJournalTagConfig'

definePageMeta({
  ssr: false
})

const route = useRoute()
const layoutReady = inject('layoutReady') as Ref<boolean>
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()

const getImageParams = () => configStore.config?.image_params || ''

const port = computed(() => configStore.getPort())

const SITE_ORIGIN = 'https://lolitalibrary.com'

function canJumpJournalItem(j: Journal): boolean {
  if (j.pk_type === 1) return !!j.community?.community_id
  if (j.pk_type === 2) return !!j.wardrobe_clothes?.clothes_id
  if (j.pk_type === 3) return !!j.matching_list?.matching_id
  if (j.pk_type === 4) return !!j.library?.library_id
  if (j.pk_type === 5) return !!j.plan?.list_id
  return false
}

function openCommunityDetail(communityId: number) {
  if (!import.meta.client) return
  const uniApi = configStore.uniWebviewJs
  const fullUrl = `${SITE_ORIGIN}/community/detail/${communityId}`

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/common/outerLink2?url=${fullUrl}`,
      fail: () => console.warn('[journal] uni community 跳转失败', fullUrl)
    })
    return
  }

  if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'CommunityDetail',
        params: { id: communityId }
      })
    )
    return
  }

  openLibraryWebPath(`/community/detail/${communityId}`)
}

function onJournalItemClick(j: Journal, event: MouseEvent) {
  if (!canJumpJournalItem(j)) return
  const target = event.target as HTMLElement
  if (target.closest('button, a, [role="button"]')) return

  if (j.pk_type === 1 && j.community?.community_id) {
    openCommunityDetail(j.community.community_id)
  } else if (j.pk_type === 2 && j.wardrobe_clothes?.clothes_id) {
    openLibraryWebPath(`/clothes/detail/${j.wardrobe_clothes.clothes_id}`)
  } else if (j.pk_type === 3 && j.matching_list?.matching_id) {
    openLibraryWebPath(`/matching/detail/${j.matching_list.matching_id}`)
  } else if (j.pk_type === 4 && j.library?.library_id) {
    openLibraryDetailTab(j.library.library_id)
  } else if (j.pk_type === 5 && j.plan?.list_id) {
    openLibraryWebPath('/user/plan')
  }
}

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
/** 是否已有日网格缓存（用于静默刷新时不闪白屏） */
const hasDayGridCache = computed(() => Object.keys(journalMapByDay.value).length > 0)
/** 视图模式：按月(12月块) | 按日(日网格+下方列表) */
const viewMode = ref<'month' | 'day'>('day')
const monthViewLoading = ref(false)
const hasMonthViewCache = computed(() => Object.keys(monthViewData.value).length > 0)
/** 列表模式：聚合拉取的手账（按 journal_time 分组展示） */
const listModeLoading = ref(false)
const hasListCache = computed(() => listModeJournals.value.length > 0)
const listModeJournals = ref<Journal[]>([])
/** 按月视图：12个月的数据 { month, count, firstImage } */
const monthViewData = ref<Record<number, { count: number; firstImage: string | null }>>({})
/** 按日期(日)分组的手账数据，切换月份时预分组，切换日时直接取用 */
const journalMapByDay = ref<Record<number, Journal[]>>({})
/** 按月视图：各月原始手账列表（供标签筛选重算 count/封面） */
const monthJournalsByMonth = ref<Record<number, Journal[]>>({})
const expandedDay = ref<number | null>(null)
/** 标签筛选（OR：命中任一选中标签即展示） */
const filterTags = ref<string[]>([])

function parseJournalTags(tags?: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

function journalMatchesTagFilter(j: Journal): boolean {
  if (filterTags.value.length === 0) return true
  const tags = parseJournalTags(j.tags)
  return filterTags.value.some((ft) => {
    if (ft === JOURNAL_SIGN_IN_FILTER_TAG) {
      return j.pk_type === 0 || tags.includes(ft)
    }
    return tags.includes(ft)
  })
}

function filterJournalList(list: Journal[]): Journal[] {
  if (filterTags.value.length === 0) return list
  return list.filter(journalMatchesTagFilter)
}

function toggleFilterTag(tag: string) {
  const idx = filterTags.value.indexOf(tag)
  if (idx === -1) filterTags.value.push(tag)
  else filterTags.value.splice(idx, 1)
}

function clearFilterTags() {
  filterTags.value = []
}

const filterModalShow = ref(false)
const filterModalPosition = ref({ x: 0, y: 0 })
const journalShareRef = ref<{
  generateAndUpload: () => Promise<void>
} | null>(null)
const journalShareGenerating = ref(false)
const journalOwnerProfile = ref<User | null>(null)

const journalDisplayName = computed(() => {
  if (isOwnJournal.value) {
    return userStore.user?.user_name?.trim() || '我的手账'
  }
  return journalOwnerProfile.value?.user_name?.trim() || '手账'
})

const journalSharePayload = computed((): JournalCalendarSharePayload | null => {
  if (!userId.value || viewMode.value !== 'day') return null
  const days = allDaysInMonth.value.map((d) => ({
    day: d.day,
    count: d.count,
    firstImage: d.firstImage
  }))
  const totalCount = days.reduce((sum, d) => sum + d.count, 0)
  return {
    userName: journalDisplayName.value,
    year: yearSelect.value,
    month: monthSelect.value,
    tags: [...filterTags.value],
    totalCount,
    days
  }
})

function openFilterModal(event: MouseEvent) {
  filterModalPosition.value = { x: event.clientX, y: event.clientY }
  filterModalShow.value = true
}

async function generateJournalShare() {
  if (journalShareGenerating.value) return
  if (viewMode.value !== 'day') {
    toast.add({
      title: '请切换到「按日」视图后生成分享图',
      icon: 'i-heroicons-information-circle',
      color: 'amber'
    })
    return
  }
  journalShareGenerating.value = true
  try {
    await nextTick()
    await journalShareRef.value?.generateAndUpload()
  } finally {
    journalShareGenerating.value = false
  }
}

async function loadJournalOwnerProfile() {
  const uid = userId.value
  if (!uid) {
    journalOwnerProfile.value = null
    return
  }
  if (isOwnJournal.value) {
    journalOwnerProfile.value = userStore.user
    return
  }
  try {
    journalOwnerProfile.value = await getUserSpace({ user_id: uid })
  } catch {
    journalOwnerProfile.value = null
  }
}

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
    const list = filterJournalList(map[day] ?? [])
    let firstImage: string | null = null
    for (const j of list) {
      firstImage = getFirstImageFromJournal(j)
      if (firstImage) break
    }
    return { day, count: list.length, firstImage }
  })
})

/** 列表模式：YYYY-MM-DD → 当日记录（日期降序，日内按创建时间降序） */
const journalGroupsByDay = computed(() => {
  const map = new Map<string, Journal[]>()
  for (const j of filterJournalList(listModeJournals.value)) {
    const key = dateKeyFromJournalTime(j.journal_time)
    if (!key) continue
    const arr = map.get(key)
    if (arr) arr.push(j)
    else map.set(key, [j])
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((dateKey) => {
    const items = (map.get(dateKey) ?? []).slice().sort((a, b) => {
      const ta = a.create_time ? dayjs(a.create_time).valueOf() : 0
      const tb = b.create_time ? dayjs(b.create_time).valueOf() : 0
      return tb - ta
    })
    return {
      dateKey,
      title: dayjs(dateKey).format('YYYY年M月D日'),
      items
    }
  })
})

/** 未选日期显示全量列表，选中日期只显示当日 */
const showFullList = computed(() => expandedDay.value === null)

const displayJournalGroups = computed(() => {
  if (expandedDay.value !== null) {
    const items = filterJournalList(journalMapByDay.value[expandedDay.value] ?? []).slice().sort((a, b) => {
      const ta = a.create_time ? dayjs(a.create_time).valueOf() : 0
      const tb = b.create_time ? dayjs(b.create_time).valueOf() : 0
      return tb - ta
    })
    const dateKey = dayjs(
      `${yearSelect.value}-${String(monthSelect.value).padStart(2, '0')}-${String(expandedDay.value).padStart(2, '0')}`
    ).format('YYYY-MM-DD')
    return [{
      dateKey,
      title: `${yearSelect.value}年${monthSelect.value}月${expandedDay.value}日`,
      items
    }]
  }
  return journalGroupsByDay.value
})

/** 按月视图：12个月块，无数据补 0（受标签筛选影响） */
const all12Months = computed(() => {
  const raw = monthJournalsByMonth.value
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const list = filterJournalList(raw[month] ?? [])
    let firstImage: string | null = null
    for (const j of list) {
      firstImage = getFirstImageFromJournal(j)
      if (firstImage) break
    }
    return {
      month,
      count: list.length,
      firstImage
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
const journalEntryMoreModal = ref(false)
const journalEntryMorePosition = ref({ x: 0, y: 0 })
const pendingMoreJournal = ref<Journal | null>(null)
const journalPostModalRef = ref<InstanceType<typeof CommunityPostModal> | null>(null)
const showJournalPostModal = ref(false)

/** 新增时在「按日」下可选日期；编辑时任意视图均可改日期 */
const journalDateEditable = computed(
  () => viewMode.value === 'day' || editingJournal.value !== null
)

const form = ref<{
  journal_time: string
  pk_type: number
  pk_id: number
  note: string
  tags: string[]
}>({
  journal_time: '',
  pk_type: 0,
  pk_id: 0,
  note: '',
  tags: []
})

const tagInputRef = ref<InstanceType<typeof customInput>>()
/** 当前用户 message_config.journal_tags 中的自定义标签 */
const savedCustomJournalTags = ref<string[]>([])
const deleteTagModal = ref(false)
const deleteTagModalPosition = ref({ x: 0, y: 0 })
const pendingDeleteTag = ref<string | null>(null)
const deleteTagLoading = ref(false)

const journalTagOptions = computed(() => {
  if (isOwnJournal.value) {
    return mergeJournalTagOptions(JOURNAL_DEFAULT_TAGS, savedCustomJournalTags.value)
  }
  const extras = new Set<string>()
  for (const j of listModeJournals.value) {
    for (const t of parseJournalTags(j.tags)) {
      if (!isJournalDefaultTag(t)) extras.add(t)
    }
  }
  return mergeJournalTagOptions(JOURNAL_DEFAULT_TAGS, [...extras])
})

/** 筛选栏可选标签（与编辑弹窗快捷项一致） */
const filterTagOptions = journalTagOptions

/** 预设 + 当前表单内自定义标签，统一展示与切换 */
const visibleTagOptions = computed(() => {
  const options = [...journalTagOptions.value]
  for (const tag of form.value.tags) {
    if (!options.includes(tag)) options.push(tag)
  }
  return options
})

function serializeJournalTags(tags: string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(',')
}

function openTagInput(e: MouseEvent) {
  tagInputRef.value?.showModel(e)
}

function syncJournalTagsFromUser() {
  if (!isOwnJournal.value) {
    savedCustomJournalTags.value = []
    return
  }
  savedCustomJournalTags.value = getJournalCustomTagsFromUser(userStore.user)
}

async function saveJournalTagsConfig(tags: string[]) {
  if (!isOwnJournal.value) return
  const customOnly = tags.filter((t) => !isJournalDefaultTag(t))
  savedCustomJournalTags.value = customOnly
  try {
    await userStore.updateUserInfo({
      message_config: {
        [JOURNAL_TAGS_CONFIG_KEY]: customOnly
      }
    })
  } catch (error) {
    console.error('保存手账标签配置失败:', error)
  }
}

function ensureCustomTagInConfig(tag: string) {
  if (!isOwnJournal.value || isJournalDefaultTag(tag)) return
  if (savedCustomJournalTags.value.includes(tag)) return
  void saveJournalTagsConfig([...savedCustomJournalTags.value, tag])
}

function addJournalTag(tag: string) {
  const trimmed = tag.trim()
  if (!trimmed) return
  if (!form.value.tags.includes(trimmed)) {
    form.value.tags.push(trimmed)
  }
  ensureCustomTagInConfig(trimmed)
}

function toggleJournalTag(tag: string) {
  const idx = form.value.tags.indexOf(tag)
  if (idx === -1) {
    form.value.tags.push(tag)
  } else {
    form.value.tags.splice(idx, 1)
  }
}

function isJournalTagSelected(tag: string) {
  return form.value.tags.includes(tag)
}

/** 配置中保存的自定义标签（显示 × 删除入口） */
function isConfigCustomTag(tag: string) {
  return savedCustomJournalTags.value.includes(tag)
}

function openDeleteTagConfirm(tag: string, event: MouseEvent) {
  if (!isOwnJournal.value || !isConfigCustomTag(tag)) return
  pendingDeleteTag.value = tag
  deleteTagModalPosition.value = { x: event.clientX, y: event.clientY }
  deleteTagModal.value = true
}

function closeDeleteTagConfirm() {
  deleteTagModal.value = false
  pendingDeleteTag.value = null
}

async function confirmDeleteJournalTag() {
  const tag = pendingDeleteTag.value
  if (!tag || !isOwnJournal.value) return
  deleteTagLoading.value = true
  try {
    const formIdx = form.value.tags.indexOf(tag)
    if (formIdx !== -1) form.value.tags.splice(formIdx, 1)
    const filterIdx = filterTags.value.indexOf(tag)
    if (filterIdx !== -1) filterTags.value.splice(filterIdx, 1)
    await saveJournalTagsConfig(savedCustomJournalTags.value.filter((t) => t !== tag))
    closeDeleteTagConfirm()
  } catch (error) {
    console.error('删除手账标签失败:', error)
  } finally {
    deleteTagLoading.value = false
  }
}

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
async function fetchMonthData(options?: { silent?: boolean }) {
  const uid = userId.value
  if (!uid) {
    journalMapByDay.value = {}
    return
  }
  const silent = options?.silent ?? false
  if (!silent || !hasDayGridCache.value) {
    dayCountLoading.value = true
  }
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
async function fetchYearMonthData(options?: { silent?: boolean }) {
  const uid = userId.value
  if (!uid) {
    monthViewData.value = {}
    monthJournalsByMonth.value = {}
    return
  }
  const silent = options?.silent ?? false
  if (!silent || !hasMonthViewCache.value) {
    monthViewLoading.value = true
  }
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
    const byMonth: Record<number, Journal[]> = {}
    results.forEach((list, i) => {
      const month = i + 1
      byMonth[month] = list
      let firstImage: string | null = null
      for (const j of list) {
        firstImage = getFirstImageFromJournal(j)
        if (firstImage) break
      }
      data[month] = { count: list.length, firstImage }
    })
    monthJournalsByMonth.value = byMonth
    monthViewData.value = data
  } catch (error) {
    console.error('获取年度手账失败:', error)
    toast.add({
      title: '获取年度手账失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    monthViewData.value = {}
    monthJournalsByMonth.value = {}
  } finally {
    monthViewLoading.value = false
  }
}

/** 列表模式：走 `/journal/list`，分页拉全量后在本地按日分组 */
const LIST_PAGE_SIZE = 40
const LIST_MAX_PAGES = 500

async function fetchListModeData(options?: { silent?: boolean }) {
  const uid = userId.value
  if (!uid) {
    listModeJournals.value = []
    return
  }
  const silent = options?.silent ?? false
  if (!silent || !hasListCache.value) {
    listModeLoading.value = true
  }
  try {
    const merged: Journal[] = []
    let page = 1
    while (page <= LIST_MAX_PAGES) {
      const { rows, count } = await journalList({
        user_id: uid,
        page,
        pageSize: LIST_PAGE_SIZE
      })
      merged.push(...rows)
      if (merged.length >= count || rows.length === 0) break
      page++
    }
    listModeJournals.value = merged
  } catch (error) {
    console.error('获取手账列表失败:', error)
    toast.add({
      title: '获取手账列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    listModeJournals.value = []
  } finally {
    listModeLoading.value = false
  }
}

/** 按月视图中点击某月：切换到按日视图并选中该月 */
function goToMonth(month: number) {
  monthSelect.value = month
  expandedDay.value = null
  viewMode.value = 'day'
  fetchMonthData()
  fetchListModeData()
}

function switchToDayView() {
  viewMode.value = 'day'
  expandedDay.value = null
  fetchMonthData()
  fetchListModeData()
}

/** 根据当前视图模式刷新数据（增删改后调用） */
async function refreshCurrentView(options?: { silent?: boolean }) {
  const silent = options?.silent ?? false
  if (viewMode.value === 'month') {
    await fetchYearMonthData({ silent })
  } else {
    await Promise.all([
      fetchMonthData({ silent }),
      fetchListModeData({ silent })
    ])
  }
}

function journalInCurrentMonthView(journalTime: string): boolean {
  const d = dayjs(journalTime.slice(0, 10))
  return d.isValid()
    && d.year() === yearSelect.value
    && d.month() + 1 === monthSelect.value
}

function journalMonthFromTime(journalTime: string): number | null {
  const d = dayjs(journalTime.slice(0, 10))
  if (!d.isValid() || d.year() !== yearSelect.value) return null
  return d.month() + 1
}

function buildPatchedJournalFromForm(apiJournal: Journal, base: Journal | null): Journal {
  const merged: Journal = {
    ...(base ?? apiJournal),
    ...apiJournal,
    journal_time: form.value.journal_time?.slice(0, 10) || apiJournal.journal_time,
    pk_type: form.value.pk_type,
    pk_id: form.value.pk_id,
    note: form.value.note,
    tags: serializeJournalTags(form.value.tags)
  }
  merged.community = undefined
  merged.wardrobe_clothes = undefined
  merged.matching_list = undefined
  merged.library = undefined
  merged.comment = undefined
  merged.plan = undefined

  const pkType = form.value.pk_type
  if (pkType === 1 && selectedCommunity.value) merged.community = selectedCommunity.value
  else if (pkType === 2 && selectedClothes.value) merged.wardrobe_clothes = selectedClothes.value
  else if (pkType === 3 && selectedMatching.value) merged.matching_list = selectedMatching.value
  else if (pkType === 4 && selectedLibrary.value) merged.library = selectedLibrary.value
  else if (pkType === 5 && base?.plan) merged.plan = base.plan

  return merged
}

function upsertJournalInLocal(journal: Journal, previous: Journal | null) {
  const list = [...listModeJournals.value]
  const listIdx = list.findIndex((j) => j.journal_id === journal.journal_id)
  if (listIdx === -1) list.unshift(journal)
  else list[listIdx] = journal
  listModeJournals.value = list

  const map = { ...journalMapByDay.value }
  if (previous && journalInCurrentMonthView(previous.journal_time)) {
    const prevDay = dayFromJournalTime(previous.journal_time)
    if (prevDay && map[prevDay]) {
      const filtered = map[prevDay].filter((j) => j.journal_id !== journal.journal_id)
      if (filtered.length) map[prevDay] = filtered
      else delete map[prevDay]
    }
  }
  if (journalInCurrentMonthView(journal.journal_time)) {
    const day = dayFromJournalTime(journal.journal_time)
    if (day) {
      const arr = [...(map[day] ?? [])]
      const dayIdx = arr.findIndex((j) => j.journal_id === journal.journal_id)
      if (dayIdx === -1) arr.push(journal)
      else arr[dayIdx] = journal
      map[day] = arr
    }
  }
  journalMapByDay.value = map

  const byMonth = { ...monthJournalsByMonth.value }
  if (previous) {
    const prevMonth = journalMonthFromTime(previous.journal_time)
    if (prevMonth && byMonth[prevMonth]) {
      byMonth[prevMonth] = byMonth[prevMonth].filter((j) => j.journal_id !== journal.journal_id)
    }
  }
  const nextMonth = journalMonthFromTime(journal.journal_time)
  if (nextMonth) {
    const arr = [...(byMonth[nextMonth] ?? [])]
    const monthIdx = arr.findIndex((j) => j.journal_id === journal.journal_id)
    if (monthIdx === -1) arr.push(journal)
    else arr[monthIdx] = journal
    byMonth[nextMonth] = arr
  }
  monthJournalsByMonth.value = byMonth
}

function removeJournalFromLocal(journalId: number) {
  const target = listModeJournals.value.find((j) => j.journal_id === journalId)
  listModeJournals.value = listModeJournals.value.filter((j) => j.journal_id !== journalId)
  if (!target) return

  const map = { ...journalMapByDay.value }
  if (journalInCurrentMonthView(target.journal_time)) {
    const day = dayFromJournalTime(target.journal_time)
    if (day && map[day]) {
      const filtered = map[day].filter((j) => j.journal_id !== journalId)
      if (filtered.length) map[day] = filtered
      else delete map[day]
    }
  }
  journalMapByDay.value = map

  const byMonth = { ...monthJournalsByMonth.value }
  const month = journalMonthFromTime(target.journal_time)
  if (month && byMonth[month]) {
    byMonth[month] = byMonth[month].filter((j) => j.journal_id !== journalId)
  }
  monthJournalsByMonth.value = byMonth
}

/** 从 journal_time 解析日历日期键 YYYY-MM-DD（用于列表分组） */
function dateKeyFromJournalTime(journalTime: string): string | null {
  if (!journalTime) return null
  const slice = journalTime.slice(0, 10)
  const d = dayjs(slice)
  return d.isValid() ? slice : null
}

/** 从 journal_time (YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss) 解析日 */
function dayFromJournalTime(journalTime: string): number | null {
  if (!journalTime) return null
  const parts = journalTime.split(/[-T\s]/)
  const day = Number.parseInt(parts[2], 10)
  return Number.isNaN(day) ? null : day
}

function toggleDaySelect(day: number) {
  expandedDay.value = expandedDay.value === day ? null : day
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
        fetchListModeData()
      }
    }
  },
  { immediate: true }
)

watch(
  [userId, isOwnJournal, () => userStore.user?.user_name],
  () => {
    void loadJournalOwnerProfile()
  },
  { immediate: true }
)

watch(filterTags, () => {
  if (expandedDay.value === null) return
  const items = filterJournalList(journalMapByDay.value[expandedDay.value] ?? [])
  if (items.length === 0) expandedDay.value = null
})

watch(
  isOwnJournal,
  async (own) => {
    if (!own) {
      savedCustomJournalTags.value = []
      return
    }
    syncJournalTagsFromUser()
    if (userStore.token) {
      try {
        await userStore.fetchUserInfo()
        syncJournalTagsFromUser()
      } catch {
        // 忽略，沿用本地缓存
      }
    }
  },
  { immediate: true }
)

watch(
  () => userStore.user?.message_config,
  () => syncJournalTagsFromUser(),
  { deep: true }
)

function setAddEditClickPosition(event?: MouseEvent) {
  if (event) {
    addEditClickPosition.value = { x: event.clientX, y: event.clientY }
  } else {
    addEditClickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
}

function resolveJournalInsertDate(): string {
  if (viewMode.value === 'day' && expandedDay.value != null) {
    return `${yearSelect.value}-${String(monthSelect.value).padStart(2, '0')}-${String(expandedDay.value).padStart(2, '0')}`
  }
  return dayjs().format('YYYY-MM-DD')
}

function openLinkJournal(event?: MouseEvent) {
  setAddEditClickPosition(event)
  editingJournal.value = null
  selectedCommunity.value = null
  selectedClothes.value = null
  selectedMatching.value = null
  selectedLibrary.value = null
  form.value = {
    journal_time: resolveJournalInsertDate(),
    pk_type: 0,
    pk_id: 0,
    note: '',
    tags: []
  }
  addEditModal.value = true
}

function goNewJournalPost(event?: MouseEvent) {
  if (!userStore.user) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (!isOwnJournal.value) return
  journalPostModalRef.value?.open(event)
}

async function onJournalPostSuccess(community: Community) {
  const communityId = community.community_id
  if (!communityId || !isOwnJournal.value) return
  try {
    await journalInsert({
      journal_time: resolveJournalInsertDate(),
      pk_type: 1,
      pk_id: communityId
    })
    toast.add({
      title: '已写入手账',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    void refreshCurrentView({ silent: true })
  } catch (error: unknown) {
    console.error('写入手账失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后在关联中手动添加'
    toast.add({
      title: '帖子已发布，但写入手账失败',
      description: msg,
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange'
    })
  }
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
    note: item.note || '',
    tags: parseJournalTags(item.tags)
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
  const tags = serializeJournalTags(form.value.tags)

  addEditLoading.value = true
  const previous = editingJournal.value
  try {
    let apiJournal: Journal
    if (previous) {
      apiJournal = await journalUpdate({
        journal_id: previous.journal_id,
        journal_time: journalTime,
        pk_type: form.value.pk_type,
        pk_id: form.value.pk_id,
        note: form.value.note,
        tags
      })
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      apiJournal = await journalInsert({
        journal_time: journalTime,
        pk_type: form.value.pk_type,
        pk_id: form.value.pk_id,
        note: form.value.note,
        tags
      })
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    const patched = buildPatchedJournalFromForm(apiJournal, previous)
    upsertJournalInLocal(patched, previous)
    addEditModal.value = false
    editingJournal.value = null
    void refreshCurrentView({ silent: true })
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

function openJournalEntryMoreMenu(j: Journal, e: MouseEvent) {
  pendingMoreJournal.value = j
  journalEntryMorePosition.value = { x: e.clientX + 50, y: e.clientY }
  journalEntryMoreModal.value = true
}

function closeJournalEntryMoreMenu() {
  journalEntryMoreModal.value = false
  pendingMoreJournal.value = null
}

function onJournalEntryMoreEdit(e: MouseEvent) {
  const item = pendingMoreJournal.value
  journalEntryMoreModal.value = false
  pendingMoreJournal.value = null
  if (item) void editJournal(item, e)
}

function onJournalEntryMoreDelete() {
  const item = pendingMoreJournal.value
  journalEntryMoreModal.value = false
  pendingMoreJournal.value = null
  if (item) confirmDelete(item.journal_id)
}

async function handleDelete() {
  if (!deleteId.value) return
  const removedId = deleteId.value
  deleteLoading.value = true
  try {
    await journalDelete({ journal_id: removedId })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    deleteModal.value = false
    deleteId.value = null
    removeJournalFromLocal(removedId)
    void refreshCurrentView({ silent: true })
  } catch (error) {
    console.error('删除失败:', error)
  } finally {
    deleteLoading.value = false
  }
}

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

/* 日式极简书页风 */
.journal-book-page {
  --paper-bg: #f7f0e8;
  --paper-sheet: #fefcf9;
  --paper-raised: #fffefb;
  --paper-dent: #f5efe6;
  --ink-primary: #3d3429;
  --ink-secondary: #5c4f42;
  --ink-muted: #8a7b6a;
  --ink-faint: #b5a898;
  --border-paper: rgba(120, 95, 70, 0.14);
  --border-light: rgba(120, 95, 70, 0.08);
  --shadow-paper: 0 1px 0 rgba(255, 255, 255, 0.85), 0 8px 32px rgba(110, 88, 62, 0.06);
  --shadow-soft: 0 2px 8px rgba(110, 88, 62, 0.05);
  --seal-red: #b85c48;
  --accent-warm: #8a7355;
  color: var(--ink-primary);
}

.dark .journal-book-page {
  --paper-bg: #1a1612;
  --paper-sheet: #221e19;
  --paper-raised: #2a2520;
  --paper-dent: #1e1a16;
  --ink-primary: #e8dfd0;
  --ink-secondary: #c9bfb0;
  --ink-muted: #9a8f80;
  --ink-faint: #6b6258;
  --border-paper: rgba(200, 180, 150, 0.12);
  --border-light: rgba(200, 180, 150, 0.06);
  --shadow-paper: 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 32px rgba(0, 0, 0, 0.35);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.25);
  --seal-red: #c46a55;
  --accent-warm: #a89070;
}

.journal-paper-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, #fefcf9 0%, #faf6f2 48%, var(--paper-bg) 100%);
}

.dark .journal-paper-gradient {
  background: linear-gradient(145deg, #252018 0%, #1e1a16 48%, var(--paper-bg) 100%);
}

.journal-paper-texture {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
}

.journal-paper-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 70% at 50% 45%, transparent 0%, rgba(110, 88, 62, 0.03) 100%);
}

.dark .journal-paper-vignette {
  background: radial-gradient(ellipse 80% 70% at 50% 45%, transparent 0%, rgba(0, 0, 0, 0.2) 100%);
}

.journal-paper-spine {
  position: absolute;
  top: 0;
  left: 0;
  width: min(48px, 8vw);
  height: 100%;
  background: linear-gradient(90deg, rgba(120, 95, 70, 0.06) 0%, transparent 100%);
}

.dark .journal-paper-spine {
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.25) 0%, transparent 100%);
}

.journal-paper-margin {
  position: absolute;
  top: 0;
  left: min(52px, 9vw);
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, transparent 0%, rgba(184, 160, 130, 0.22) 8%, rgba(184, 160, 130, 0.22) 92%, transparent 100%);
}

.dark .journal-paper-margin {
  background: linear-gradient(180deg, transparent 0%, rgba(160, 140, 110, 0.15) 8%, rgba(160, 140, 110, 0.15) 92%, transparent 100%);
}

.journal-paper-rules {
  position: absolute;
  inset: 0;
  opacity: 0.45;
  background-image: repeating-linear-gradient(
    180deg,
    transparent,
    transparent 27px,
    rgba(200, 180, 160, 0.18) 27px,
    rgba(200, 180, 160, 0.18) 28px
  );
  background-position: 0 80px;
  mask-image: linear-gradient(180deg, transparent 0%, black 12%, black 88%, transparent 100%);
}

.dark .journal-paper-rules {
  background-image: repeating-linear-gradient(
    180deg,
    transparent,
    transparent 27px,
    rgba(120, 100, 80, 0.12) 27px,
    rgba(120, 100, 80, 0.12) 28px
  );
}

.journal-sheet {
  position: relative;
}

@media (min-width: 480px) {
  .journal-sheet {
    padding-left: 3.25rem;
  }
}

.journal-neu-tile,
.journal-neu-entry,
.journal-neu-well {
  border-radius: 0.375rem;
}

.journal-neu-toolbar {
  background: rgba(254, 252, 249, 0.82);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-soft);
}

.dark .journal-neu-toolbar {
  background: rgba(34, 30, 25, 0.88);
}

.journal-tab-rail {
  background: var(--paper-dent);
  border: 1px solid var(--border-light);
}

.journal-tab-btn {
  border: none;
  background: transparent;
  color: var(--ink-muted);
}

.journal-tab-btn--idle:hover {
  color: var(--ink-secondary);
}

.journal-tab-btn--active {
  font-weight: 600;
  color: var(--ink-primary);
  background: var(--paper-sheet);
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--border-paper);
}

.journal-neu-icon-btn {
  border: 1px solid var(--border-paper);
  background: var(--paper-sheet);
  color: var(--ink-muted);
  box-shadow: none;
}

.journal-neu-icon-btn:hover {
  color: var(--ink-secondary);
  border-color: rgba(120, 95, 70, 0.22);
}

.journal-neu-icon-btn:active {
  background: var(--paper-dent);
}

.journal-fab-add {
  box-shadow: 0 2px 8px rgba(110, 88, 62, 0.18);
}

.journal-neu-well {
  background: var(--paper-dent);
  border: 1px dashed var(--border-paper);
  box-shadow: none;
  color: var(--ink-muted);
}

.journal-neu-tile {
  background: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-soft);
}

.journal-neu-tile:hover {
  border-color: rgba(120, 95, 70, 0.28);
}

.journal-neu-tile--active {
  border: 2px solid var(--accent-warm);
  outline: 2px solid rgba(138, 115, 85, 0.5);
  outline-offset: 1px;
  box-shadow: var(--shadow-soft);
  z-index: 2;
}

.dark .journal-neu-tile--active {
  outline-color: rgba(168, 144, 112, 0.55);
}

.journal-neu-badge {
  background: var(--seal-red);
  box-shadow: 0 1px 3px rgba(110, 88, 62, 0.2);
}

.journal-neu-panel {
  background: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-paper);
}

.journal-neu-panel-head {
  background: var(--paper-dent);
  border-bottom: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-panel-body {
  background: var(--paper-sheet);
}

.journal-neu-entry {
  background: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-soft);
}

.journal-neu-entry--clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.journal-neu-entry--clickable:hover {
  border-color: rgba(120, 95, 70, 0.28);
  box-shadow: 0 3px 12px rgba(110, 88, 62, 0.08);
}

.journal-neu-entry-head {
  background: var(--paper-dent);
  border-bottom: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-thumb {
  border: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-progress-track {
  background: var(--paper-dent);
  border: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-note {
  background: var(--paper-dent);
  border-left: 2px solid var(--accent-warm);
  box-shadow: none;
}

.journal-neu-modal {
  --paper-sheet: #fefcf9;
  --paper-dent: #f5efe6;
  --border-paper: rgba(120, 95, 70, 0.14);
  --border-light: rgba(120, 95, 70, 0.08);
  --shadow-paper: 0 1px 0 rgba(255, 255, 255, 0.85), 0 12px 40px rgba(110, 88, 62, 0.1);
  background-color: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-paper);
}

.dark .journal-neu-modal {
  --paper-sheet: #221e19;
  --paper-dent: #1e1a16;
  --border-paper: rgba(200, 180, 150, 0.12);
  --border-light: rgba(200, 180, 150, 0.06);
  --shadow-paper: 0 12px 40px rgba(0, 0, 0, 0.45);
  background-color: var(--paper-sheet);
}

.journal-neu-modal-head {
  background: var(--paper-dent);
  border-bottom: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-modal-body {
  background: var(--paper-sheet);
}

.journal-neu-modal-foot {
  background: var(--paper-dent);
  border-top: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-type-pop {
  --paper-sheet: #fefcf9;
  --paper-dent: #f5efe6;
  --border-paper: rgba(120, 95, 70, 0.14);
  --border-light: rgba(120, 95, 70, 0.08);
  --shadow-paper: 0 8px 28px rgba(110, 88, 62, 0.1);
  background: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-paper);
}

.dark .journal-neu-type-pop {
  --paper-sheet: #221e19;
  --paper-dent: #1e1a16;
  --border-paper: rgba(200, 180, 150, 0.12);
  --border-light: rgba(200, 180, 150, 0.06);
  --shadow-paper: 0 8px 28px rgba(0, 0, 0, 0.4);
  background: var(--paper-sheet);
}

.journal-neu-type-row {
  background: var(--paper-dent);
  border: 1px solid var(--border-light);
  box-shadow: none;
}

.journal-neu-type-row:hover {
  border-color: var(--border-paper);
  background: var(--paper-sheet);
}
</style>
