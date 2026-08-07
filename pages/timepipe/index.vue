<template>
  <div class="container mx-auto min-h-screen timepipe-wrapper">
    <!-- WebView 状态栏占位：layouts/default 中 ?statusbar= -->
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />
    <!-- 弹幕组件 - 一直存在，只在"上新日历"标签页时显示 -->
    <!-- Wiki选择组件 -->
    <div class="fixed top-0 left-0 w-full h-full pointer-events-none z-40" style="pointer-events: none;">
      <CommentDanmakuComment
        v-show="currentTab === 0"
        ref="danmakuRef"
        type="library_pipe"
        :id="dateIds"
        width="100%"
        height="100vh"
        :pageSize="50"
        :speed="danmakuSpeed"
        fontSize="14px"
        class="pointer-events-none"
      />
    </div>
    <QhxTabs sticky :sticky_offset="0" :tabs="['上新日历', '图表版总览', '实体店', '手作娘','出物']" :need_swipe="false" @change="onChangeTab">
      <QhxTabPanel :index="0">
        <template #default="{ isActive }">
          <div>
            <!-- 用户信息（已隐藏）
            <div class=" flex items-center justify-between px-2">
              <div class="">
                技术支持 <a href="https://xhslink.com/m/7NBq8fikmnB">@千河星星</a>
              </div>
              <div class="flex items-center gap-4" v-show="!user">
                <LoginBox />
              </div>
              <div class="flex items-center gap-4" v-show="user">
                <UserBox></UserBox>
              </div>
            </div>
            -->
            <QhxDatePicker v-model="picked" @change="onChange" />
            <!-- <HorizontalDatePicker v-model="picked" :compact="isCompact" @change="onChange" /> -->
            <div class="timepipe-toolbar px-2 pt-1 pb-2 space-y-2">
              <!-- 当前选择日期（单独一行） -->
              <div class="text-sm text-gray-600 whitespace-nowrap">
                当前选择：{{ dayjs(formatted).format('YY-MM-DD') }}
              </div>

              <!-- 左侧：布局/投稿/分享；右侧：筛选 -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    class="timepipe-icon-btn shrink-0"
                    :title="layoutLabel"
                    :aria-label="layoutLabel"
                    @click="layout = layout === '0' ? '1' : layout === '1' ? '2' : '0'"
                  >
                    <UIcon :name="layoutIcon" class="text-[18px]" />
                  </button>
                  <button
                    v-if="userStore.token"
                    type="button"
                    class="modal-capsule-btn modal-capsule-btn--sm shrink-0"
                    @click="showLibraryPipeAdd()"
                  >
                    投稿
                  </button>
                  <button
                    type="button"
                    class="modal-capsule-btn modal-capsule-btn--sm modal-capsule-btn--soft shrink-0"
                    @click="copyUrl()"
                  >
                    <UIcon name="ic:round-share" class="h-3.5 w-3.5" />
                    <span>分享</span>
                  </button>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    class="modal-capsule-btn modal-capsule-btn--sm shrink-0"
                    @click="openFilterModal"
                  >
                    {{ filterButtonLabel }}
                  </button>
                  <button
                    v-if="hasFilter"
                    type="button"
                    class="modal-capsule-btn modal-capsule-btn--sm modal-capsule-btn--danger shrink-0"
                    @click="clearFilter"
                  >
                    重置
                  </button>
                </div>
              </div>

              <!-- 统计 + 排序 + 开关 -->
              <div
                v-if="waterList"
                class="flex flex-wrap items-center gap-x-3 gap-y-2"
              >
                <div class="flex items-center gap-3 text-sm text-gray-600 whitespace-nowrap shrink-0">
                  <span>总数：{{ waterList.total }}</span>
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="h-4 w-4 text-gray-500" />
                    <span>{{ todayVisit }}</span>
                  </span>
                </div>
                <button
                  type="button"
                  class="modal-capsule-btn modal-capsule-btn--sm shrink-0"
                  @click="(e: MouseEvent) => { openSortPicker(e) }"
                >
                  {{ `排序:${sortOptions.find(item => item.value === sortMode)?.label}` || '排序模式' }}
                </button>
                <QhxSelect
                  ref="sortSelectRef"
                  :options="sortOptions"
                  :default-value="sortOptions[0]"
                  :canCustomize="false"
                  @select="(select) => {
                    sortMode = select.value
                    waterList?.refresh()
                  }"
                />
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 ml-auto">
                  <label
                    v-if="user"
                    class="timepipe-toggle shrink-0"
                  >
                    <UToggle
                      v-model="subscribeNews"
                      color="primary"
                      @update:model-value="handleSubscribeNewsChange"
                    />
                    <span>订阅</span>
                  </label>
                  <label class="timepipe-toggle shrink-0">
                    <UToggle
                      v-model="onlyNewToday"
                      color="primary"
                      @update:model-value="waterList?.refresh()"
                    />
                    <span>只看新增</span>
                  </label>
                  <label
                    v-if="user"
                    class="timepipe-toggle shrink-0"
                  >
                    <UToggle
                      v-model="plantGrassMode"
                      color="primary"
                    />
                    <span>种草模式</span>
                  </label>
                </div>
              </div>
            </div>
            <QhxWaterList v-if="layoutReady" ref="waterList" :fetch-data="async (page, pageSize) => {
              const response = await getLibraryPipeList({ 
                page, 
                pageSize, 
                time: formatted, 
                state: filterState === -1 ? undefined : filterState, 
                examin: 0, 
                sort: sortMode === 0 ? undefined : sortMode,
                filter_list: filterList.length > 0 ? filterList : undefined,
                create_time: onlyNewToday ? formatted : undefined
              })
              return {
                rows: response.rows,
                count: response.count
              }
            }" :columns="columns" :itemKey="0" :columns_768="layout === '0' ? 2 : 1" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <div
                  class="custom-item timepipe-pipe-item"
                  :class="{
                    'timepipe-pipe-item--grid': layout === '0',
                    'timepipe-pipe-item--list': layout === '1',
                    'timepipe-pipe-item--text': layout === '2',
                  }"
                  :key="item.pipe_id"
                >
                  <div class="timepipe-pipe-card polaroid-card relative">
                    <div
                      v-if="plantGrassMode && item.item?.library_id"
                      class="timepipe-pipe-plant"
                      @click.stop="handlePlantGrassToggle(item.item, $event)"
                    >
                      <div
                        class="timepipe-pipe-plant__btn"
                        :class="plantGrassCartStore.hasLibrary(item.item.library_id) ? 'timepipe-pipe-plant__btn--remove' : 'timepipe-pipe-plant__btn--add'"
                      >
                        <UIcon
                          :name="plantGrassCartStore.hasLibrary(item.item.library_id) ? 'i-heroicons-trash' : 'material-symbols:add-2'"
                          class="text-[14px]"
                        />
                      </div>
                    </div>

                    <div
                      class="timepipe-pipe-meta"
                      :class="{ 'timepipe-pipe-meta--compact': layout === '2' }"
                    >
                      <template v-if="layout === '2'">
                        <span
                          class="timepipe-pipe-state-dot"
                          :style="{ backgroundColor: getStateColor(item.state) }"
                        />
                        <span class="timepipe-pipe-meta__state">{{ formateState(item.state) }}</span>
                        <span class="timepipe-pipe-meta__range">
                          {{ dayjs(item.start_time).format('YY-MM-DD') }}~{{ dayjs(item.end_time).format('YY-MM-DD') }}
                        </span>
                        <span
                          class="timepipe-pipe-remain"
                          :class="getPipeRemainClass(getPipeRemainDays(item.end_time))"
                        >
                          {{ formatPipeRemain(getPipeRemainDays(item.end_time)) }}
                        </span>
                      </template>
                      <template v-else>
                        <QhxTag :active="true" :backgroundColor="getStateColor(item.state)">
                          <div class="text-xs">{{ formateState(item.state) }}</div>
                        </QhxTag>
                        <div class="timepipe-pipe-meta__right">
                          <span
                            v-show="layout !== '0'"
                            class="timepipe-pipe-meta__range"
                          >
                            {{ dayjs(item.start_time).format('YY-MM-DD') }}
                            <span class="timepipe-pipe-meta__sep">~</span>
                            {{ dayjs(item.end_time).format('YY-MM-DD') }}
                          </span>
                          <span
                            class="timepipe-pipe-remain"
                            :class="getPipeRemainClass(getPipeRemainDays(item.end_time))"
                          >
                            {{ formatPipeRemain(getPipeRemainDays(item.end_time)) }}
                          </span>
                        </div>
                      </template>
                    </div>

                    <div v-if="item.note" class="timepipe-pipe-note">
                      <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="timepipe-pipe-note__icon" />
                      <span>{{ item.note }}</span>
                    </div>

                    <div v-if="item.item" class="timepipe-pipe-body">
                      <LibraryItem
                        :className="layout === '0' ? 'p-1.5' : 'p-1'"
                        :size="layout === '0' ? 'big' : layout === '1' ? 'mini-list' : 'text-only'"
                        :item="item.item"
                        :need-jump="!plantGrassMode"
                        @image-load="debouncedApplyLayout"
                      >
                        <template #tagInfo v-if="layout !== '0'">
                          <div
                            v-if="item.library_list && item.library_list.length > 0"
                            class="timepipe-pipe-prices"
                          >
                            <span
                              v-for="(library, idx) in item.library_list"
                              :key="`${library.library_id || idx}-${library.library_type}`"
                              class="timepipe-pipe-price-chip"
                            >
                              ￥{{ library.library_price }}
                              {{ formatLabel(library.shop_country || 0, config?.money_type) }}
                              <template v-if="library.library_type"> · {{ library.library_type }}</template>
                            </span>
                          </div>
                        </template>
                      </LibraryItem>

                      <div v-show="layout !== '2'" class="timepipe-pipe-actions">
                        <div class="timepipe-pipe-action">
                          <UserGoodBtn
                            :pk_type="2"
                            :pk_id="item.item.library_id"
                            :is_good="item.is_good === 1"
                            :good_count="item.item.good_count"
                            :need_judge="false"
                          />
                        </div>
                        <div class="timepipe-pipe-action">
                          <UserCollectBtn
                            :collect_count="item.item.collect_count"
                            :pk_type="2"
                            :pk_id="item.item.library_id"
                            :is_collect="item.is_collect === 1"
                            :need_judge="false"
                            :need_axios="false"
                          />
                        </div>
                        <button
                          type="button"
                          class="timepipe-pipe-action timepipe-pipe-wardrobe"
                          :class="{ 'timepipe-pipe-wardrobe--active': item.is_wardrobe === 1 }"
                          @click="handleAddToWardrobe(item.item)"
                        >
                          <UIcon name="hugeicons:wardrobe-04" class="text-[20px]" />
                          <span>{{ item.item.wardrobe_count || 0 }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
          </div>
        </template>

      </QhxTabPanel>
      <QhxTabPanel :index="1">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div v-if="library_pipe_chart.length > 0">
              <div class="flex flex-wrap gap-2" style="touch-action: none;">
                <QhxTimePipe :timePipe="[...library_pipe_chart]"></QhxTimePipe>
              </div>
            </div>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="2">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div>
              <QhxWaterList v-if="layoutReady && isActive" :fetch-data="async (page, pageSize) => {
                const response = await getDisplayCabinetList({ page, pageSize, pk_type: 0 })
                return {
                  rows: response.rows,
                  count: response.count,
                }
              }" :columns="2" :itemKey="1" :columns_768="1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item m-2" :key="item.cabinet_id">
                  <div class="polaroid-card rounded-[5px]">
                    <div class="flex justify-center items-center cursor-pointer" @click="jumpToShop(item.item?.shop)">
                      <img :src="`${BASE_IMG}${item.item?.shop?.shop_logo || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-full m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.item?.physical_name }}</h3>
                        <div class="text-sm text-gray-600">{{ item.item?.address }}</div>
                      </div>
                    </div>
                    <div class="flex items-center pb-2 flex-wrap cursor-pointer" @click="jumpToWardrobe(item.wardrobe)">
                      <div v-for="clothes in item.wardrobe_clothes" :key="clothes.clothes_id" class="md:w-1/6 w-1/3">
                        <img :src="`${BASE_IMG}${clothes.clothes_img}`" class="w-full aspect-[1/1] object-cover rounded-[20px] p-1"></img>
                      </div>
                    </div>
                    <div class="flex justify-center items-center">
                      <img :src="`${BASE_IMG}${item.wardrobe?.wardrobe_cover || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-[20px] m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.wardrobe?.wardrobe_name }}</h3>
                        <div class="text-sm text-gray-600" @click="coptText(item.wardrobe?.wardrobe_desc)">{{ item.wardrobe?.wardrobe_desc }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
            </div>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="3">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div>
              <QhxWaterList v-if="layoutReady && isActive" :fetch-data="async (page, pageSize) => {
                const response = await getDisplayCabinetList({ page, pageSize, pk_type: 2 })
                return {
                  rows: response.rows,
                  count: response.count,
                }
              }" :columns="2" :itemKey="1" :columns_768="1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item m-2" :key="item.cabinet_id">
                  <div class="polaroid-card">
                    <div class="flex justify-center items-center cursor-pointer" @click="jumpToShop(item.item)">
                      <img :src="`${BASE_IMG}${item.item?.shop_logo || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[40px] h-[40px] object-cover rounded-full m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.item?.shop_name }}</h3>
                      </div>
                    </div>
                    <div class="flex items-center pb-2 flex-wrap cursor-pointer" @click="jumpToWardrobe(item.wardrobe)">
                      <div v-for="clothes in item.wardrobe_clothes" :key="clothes.clothes_id" class="md:w-1/6 w-1/3">
                        <img :src="`${BASE_IMG}${clothes.clothes_img}`" class="w-full aspect-[1/1] object-cover rounded-[20px] p-1"></img>
                      </div>
                    </div>
                    <div class="flex justify-center items-center">
                      <img :src="`${BASE_IMG}${item.wardrobe?.wardrobe_cover || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-[20px] m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.wardrobe?.wardrobe_name }}</h3>
                        <div class="text-sm text-gray-600" @click="coptText(item.wardrobe?.wardrobe_desc)">{{ item.wardrobe?.wardrobe_desc }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
            </div>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="4">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div>
              <QhxWaterList ref="waterList4" v-if="layoutReady && isActive" :fetch-data="async (page, pageSize) => {
                const response = await getDisplayCabinetList({ page, pageSize, pk_type: 1 })
                return {
                  rows: response.rows,
                  count: response.count,
                }
              }" :columns="2" :itemKey="1" :columns_768="1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item m-2" :key="item.cabinet_id">
                  <div class="polaroid-card">
                    <div class="flex justify-center items-center cursor-pointer" @click="jumpToUser(item.item?.user_id)">
                      <img :src="`${BASE_IMG}${item.item?.user_face || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[40px] h-[40px] object-cover rounded-full m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.item?.user_name }}</h3>
                      </div>
                    </div>
                    <div class="flex items-center pb-2 flex-wrap cursor-pointer" @click="jumpToWardrobe(item.wardrobe)">
                      <div v-for="clothes in item.wardrobe_clothes" :key="clothes.clothes_id" class="md:w-1/6 w-1/3">
                        <img :src="`${BASE_IMG}${clothes.clothes_img}`" class="w-full aspect-[1/1] object-cover rounded-[20px] p-1"></img>
                      </div>
                    </div>
                    <div class="flex justify-center items-center">
                      <img :src="`${BASE_IMG}${item.wardrobe?.wardrobe_cover || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-[20px] m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.wardrobe?.wardrobe_name }}</h3>
                        <div class="text-sm text-gray-600" @click="coptText(item.wardrobe?.wardrobe_desc)">{{ item.wardrobe?.wardrobe_desc }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
            </div>
          </div>
        </template>
      </QhxTabPanel>
    </QhxTabs>
    <!-- 悬浮按钮 -->
    <div class="fixed bottom-4 right-4" v-show="currentTab === 4" v-if="user?.user_id">
      <button
        type="button"
        class="timepipe-icon-btn timepipe-icon-btn--lg"
        aria-label="添加衣柜"
        @click="showChooseWardrobe"
      >
        <UIcon name="i-heroicons-plus" class="text-[22px]" />
      </button>
    </div>
    <WardrobeChoose ref="wardrobeChooseRef" :user_id="user?.user_id" v-if="user?.user_id" @choose="chooseWardrobe"/>
    <!-- 确认框 -->
    <QhxModal v-model="showConfirm">
      <div class="w-[95vw] max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold">确认添加该衣柜?</h3>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4">
          <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost" @click="showConfirm = false">取消</button>
          <button type="button" class="modal-capsule-btn" @click="addWardrobeToDisplay">确认</button>
        </div>
      </div>
    </QhxModal>
    <LibraryPipeAdd ref="libraryPipeAddRef" />
    <!-- <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore">
    </QhxLoading> -->
    <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
    <ClothesAdd ref="clothesAddRef" enable-wardrobe-picker @success="handleClothesAddSuccess" />
    
    <!-- 筛选弹窗 -->
    <QhxModal v-model="showFilterModal" :close-on-backdrop="false">
      <div class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 class="text-lg font-semibold">筛选条件</h3>
        </div>
        <div class="space-y-4 p-6 overflow-y-auto flex-1">
          <!-- 上新状态（原筛选状态） -->
          <div class="flex items-start gap-2">
            <span class="text-sm font-medium min-w-[80px] pt-1.5">上新状态：</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <button
                v-for="opt in filterStateOptions"
                :key="opt.value"
                type="button"
                class="timepipe-filter-chip"
                :class="{ 'timepipe-filter-chip--active': draftFilterState === opt.value }"
                @click="draftFilterState = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- 主要风格 -->
          <div class="flex items-start gap-2">
            <span class="text-sm font-medium min-w-[80px] pt-2">主要风格：</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <QhxTag
                v-for="(item, index) in filterForm.main_style"
                :key="index"
                :active="true"
                class="cursor-pointer"
                :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'"
              >
                <div class="flex items-center gap-1">
                  <span @click="changeFilterType(index, 'main_style')">{{ item.label }}</span>
                  <UIcon
                    name="i-heroicons-x-mark"
                    class="text-xs cursor-pointer"
                    @click="deleteArrayItem(filterForm.main_style, index)"
                  />
                </div>
              </QhxTag>
              <QhxTag
                class="cursor-pointer"
                @click="mainStyleSelectRef?.showPicker($event)"
              >
                选择风格
              </QhxTag>
            </div>
          </div>

          <!-- 设计元素 -->
          <div class="flex items-start gap-2">
            <span class="text-sm font-medium min-w-[80px] pt-2">设计元素：</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <QhxTag
                v-for="(item, index) in filterForm.design_elements"
                :key="index"
                :active="true"
                class="cursor-pointer"
                :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'"
              >
                <div class="flex items-center gap-1">
                  <span @click="changeFilterType(index, 'design_elements')">{{ item.label }}</span>
                  <UIcon
                    name="i-heroicons-x-mark"
                    class="text-xs cursor-pointer"
                    @click="deleteArrayItem(filterForm.design_elements, index)"
                  />
                </div>
              </QhxTag>
              <QhxTag
                class="cursor-pointer"
                @click="chooseWiki('design_elements')"
              >
                选择设计元素
              </QhxTag>
            </div>
          </div>

          <!-- 柄图元素 -->
          <div class="flex items-start gap-2">
            <span class="text-sm font-medium min-w-[80px] pt-2">柄图元素：</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <QhxTag
                v-for="(item, index) in filterForm.pattern_elements"
                :key="index"
                :active="true"
                class="cursor-pointer"
                :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'"
              >
                <div class="flex items-center gap-1">
                  <span @click="changeFilterType(index, 'pattern_elements')">{{ item.label }}</span>
                  <UIcon
                    name="i-heroicons-x-mark"
                    class="text-xs cursor-pointer"
                    @click="deleteArrayItem(filterForm.pattern_elements, index)"
                  />
                </div>
              </QhxTag>
              <QhxTag
                class="cursor-pointer"
                @click="chooseWiki('pattern_elements')"
              >
                选择柄图元素
              </QhxTag>
            </div>
          </div>

          <!-- 主题 -->
          <div class="flex items-start gap-2">
            <span class="text-sm font-medium min-w-[80px] pt-2">主题：</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <QhxTag
                v-for="(item, index) in filterForm.theme"
                :key="index"
                :active="true"
                class="cursor-pointer"
                :backgroundColor="item.type === 'and' ? '#317e10' : item.type === 'or' ? '#0788dc' : '#e11031'"
              >
                <div class="flex items-center gap-1">
                  <span @click="changeFilterType(index, 'theme')">{{ item.label }}</span>
                  <UIcon
                    name="i-heroicons-x-mark"
                    class="text-xs cursor-pointer"
                    @click="deleteArrayItem(filterForm.theme, index)"
                  />
                </div>
              </QhxTag>
              <QhxTag
                class="cursor-pointer"
                @click="chooseWiki('theme')"
              >
                选择主题
              </QhxTag>
            </div>
          </div>
          <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="onWikiChoose" />

          <!-- 提示信息 -->
          <div class="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400">
            <div class="flex items-center gap-1.5">
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4 flex-shrink-0" />
              <span class="font-medium">标签逻辑：</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded" style="background-color: #317e10;"></span>
              <span>与（and）</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded" style="background-color: #0788dc;"></span>
              <span>或（or）</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded" style="background-color: #e11031;"></span>
              <span>非（not）</span>
            </div>
            <span class="text-qhx-primary">点击标签文字切换</span>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost" @click="showFilterModal = false">取消</button>
          <button type="button" class="modal-capsule-btn modal-capsule-btn--soft" @click="clearFilter">清空</button>
          <button type="button" class="modal-capsule-btn" @click="applyFilter">确定</button>
        </div>
      </div>
    </QhxModal>

    <!-- 选择器组件 -->
    <QhxSelect
      ref="mainStyleSelectRef"
      :options="filterOptions.main_style"
      @select="confirmMainStyle"
    />
    
    <!-- 邮箱绑定弹窗 -->
    <EmailBindModal
      v-model="showEmailModal"
      :user="user"
      @success="handleEmailBindSuccess"
    />

    <!-- 种草车悬浮按钮 -->
    <QhxFloatingButton
      v-show="currentTab === 0 && plantGrassMode && plantGrassCartStore.count > 0"
      initial-position="bottom-left"
      :bottom-offset="plantGrassFabBottomOffset"
    >
      <div
        ref="plantGrassBtnRef"
        class="relative w-12 h-12 rounded-full bg-qhx-primary text-white flex items-center justify-center shadow-lg cursor-pointer"
        @click="showPlantGrassDrawer = true"
      >
        <UIcon name="material-symbols:grass-rounded" class="text-2xl" />
        <span
          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white"
        >
          {{ plantGrassCartStore.count > 99 ? '99+' : plantGrassCartStore.count }}
        </span>
      </div>
    </QhxFloatingButton>

    <QhxBottomDrawer
      v-if="showPlantGrassDrawer"
      :direction="isMobile ? 'bottom' : 'right'"
      :default-size="isMobile ? 480 : 420"
      :content-padding="false"
    >
      <div class="flex flex-col h-full">
        <div class="flex items-center justify-between mb-2 px-4 pt-3 flex-shrink-0">
          <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">
            种草车 ({{ plantGrassCartStore.count }})
          </h3>
          <button
            type="button"
            class="modal-capsule-btn modal-capsule-btn--ghost modal-capsule-btn--icon-sm"
            aria-label="关闭"
            @click="showPlantGrassDrawer = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-4 w-4" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          <div v-if="plantGrassCartStore.list.length === 0" class="text-center py-12 text-gray-500">
            暂无图鉴，开启种草模式后点击加号添加
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="cartItem in plantGrassCartStore.list"
              :key="cartItem.library_id"
              class="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-2"
            >
              <div class="flex items-center gap-3">
                <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700 self-center">
                  <img
                    :src="`${BASE_IMG}${cartItem.cover || cartItem.square_cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                    class="h-full w-full object-cover"
                    loading="lazy"
                    draggable="false"
                  />
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                    {{ cartItem.name }}
                  </div>
                  <div v-if="cartItem.library_type" class="text-xs text-gray-500">
                    {{ cartItem.library_type }}
                  </div>
                  <TimepipePlantGrassScorePicker
                    :model-value="cartItem.score"
                    @update:model-value="plantGrassCartStore.setScore(cartItem.library_id, $event)"
                  />
                </div>
                <button
                  type="button"
                  class="modal-capsule-btn modal-capsule-btn--danger modal-capsule-btn--icon-sm shrink-0 self-center"
                  aria-label="移除"
                  @click="plantGrassCartStore.remove(cartItem.library_id)"
                >
                  <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="plant-grass-drawer-footer flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-3 pt-2 pb-2 bg-white/95 dark:bg-gray-900/95">
          <button
            type="button"
            class="modal-capsule-btn w-full"
            :disabled="plantGrassCartStore.count === 0 || plantGrassCollectLoading || plantGrassShareLoading"
            @click="openPlantGrassShare"
          >
            <UIcon
              v-if="plantGrassShareLoading"
              name="i-heroicons-arrow-path"
              class="h-4 w-4 shrink-0 animate-spin"
            />
            <span>生成分享图</span>
          </button>
          <div class="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              class="modal-capsule-btn modal-capsule-btn--ghost min-w-0 w-full"
              :disabled="plantGrassCartStore.count === 0 || plantGrassShareLoading || plantGrassCollectLoading"
              @click="clearPlantGrassCart"
            >
              清空
            </button>
            <button
              type="button"
              class="modal-capsule-btn min-w-0 w-full"
              :disabled="plantGrassCartStore.count === 0 || plantGrassShareLoading || plantGrassCollectLoading"
              @click="collectAllPlantGrass"
            >
              <UIcon
                v-if="plantGrassCollectLoading"
                name="i-heroicons-arrow-path"
                class="h-4 w-4 shrink-0 animate-spin"
              />
              <span>全部收藏</span>
            </button>
          </div>
        </div>
      </div>
    </QhxBottomDrawer>

    <QhxModal v-model="showPlantGrassShareModal">
      <div class="flex max-h-[90vh] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl bg-[#ebe3e8] shadow-2xl dark:bg-[#241d26]">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-pink-200/40 px-4 py-3 dark:border-pink-900/35">
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">种草分享图</span>
          <button
            type="button"
            class="modal-capsule-btn modal-capsule-btn--ghost modal-capsule-btn--icon-sm"
            aria-label="关闭"
            @click="showPlantGrassShareModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-4 w-4" />
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <TimepipePlantGrassShare
            v-if="shareCartSnapshot.length > 0"
            ref="plantGrassShareRef"
            :items="shareCartSnapshot"
            :title="plantGrassShareTitle"
            :date-label="plantGrassShareDateLabel"
            :user-name="user?.user_name"
            :user-face="user?.user_face"
          />
        </div>
      </div>
    </QhxModal>
    
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount, reactive } from 'vue'
import HorizontalDatePicker from '@/components/Qhx/HorizontalDatePicker.vue'
import { getLibraryPipeList } from '@/api/library'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import type { LibraryPipe, Shop, Wardrobe, WardrobeClothes, FilterList, Library } from '@/types/api'
import { getUserMy } from '@/api/user'
import type { User } from '@/types/api'
import { getBrowTimeOne, insertBrowTime } from '@/api/brow_time'
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
import type LibraryPipeAdd from '@/components/library/LibraryPipeAdd.vue'
const libraryPipeAddRef = ref<InstanceType<typeof LibraryPipeAdd> | null>(null)
import { getLibraryPipeListAll } from '@/api/library'
import { getDisplayCabinetList, insertDisplayCabinet } from '@/api/display_cabinet'
import type WardrobeChoose from '@/components/Wardrobe/WardrobeChoose.vue'
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import type FavoriteOptionsModal from '@/components/Favorite/OptionsModal.vue'
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import { librarySeedFromTypeColorChoose, type LibraryTypeColorChooseResult } from '@/utils/libraryClothesSeed'
import type DanmakuComment from '@/components/comment/DanmakuComment.vue'
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import type WikiOptionsChooseType from '@/components/wiki/wikiOptionsChoose.vue'
import { getWikiOptionsByKeywords } from '@/api/wiki'
import EmailBindModal from '@/components/user/EmailBindModal.vue'
import QhxBottomDrawer from '@/components/Qhx/BottomDrawer.vue'
import QhxFloatingButton from '@/components/Qhx/FloatingButton.vue'
import TimepipePlantGrassScorePicker from '@/components/timepipe/TimepipePlantGrassScorePicker.vue'
import type TimepipePlantGrassShare from '@/components/timepipe/TimepipePlantGrassShare.vue'
import { batchInsertCollect, insertCollect, insertFavorite } from '@/api/collect'
import { usePlantGrassCartStore, type PlantGrassCartItem } from '@/stores/plantGrassCart'
import { useFlyToButton } from '@/composables/useFlyToButton'
import { BASE_IMG } from '@/utils/ipConfig'
const clothesAddRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const favoriteOptionsModalRef = ref<InstanceType<typeof FavoriteOptionsModal> | null>(null)
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const danmakuRef = ref<InstanceType<typeof DanmakuComment> | null>(null)
const route = useRoute()
const token = ref<string | null>(null) // 传入的token
// 窗口宽度响应式变量
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const columns = computed(() => {
  if (layout.value === '0') return windowWidth.value > 768 && windowWidth.value < 1920 ? 4 : 5
  if (layout.value === '2') return 1 // 纯文本单列
  return 3
})
// 根据窗口宽度计算弹幕速度
// 速度值越小，弹幕移动越快。窗口越宽，需要的时间应该相应增加
// 基准：1920px 宽度对应速度 40，按比例计算
const danmakuSpeed = computed(() => {
  const baseWidth = 1920 // 基准宽度（像素）
  const baseSpeed = 40 // 基准速度
  // 根据窗口宽度按比例调整速度
  // 窗口越宽，速度值越大（移动越慢），以保持视觉一致性
  return Math.round((windowWidth.value / baseWidth) * baseSpeed)
})

// 监听窗口大小变化
const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
  }
}
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const library_pipe_chart = ref<LibraryPipe[]>([])
const fetchLibraryPipeAll = () => {
  getLibraryPipeListAll({ end_time: dayjs().format('YYYY-MM-DD'), pk_type: 0, cache: true })
    .then((res) => {
      library_pipe_chart.value = res
    })
}
import dayjs from 'dayjs'
let uni: any;
const showConfirm = ref(false)
const toast = useToast()
const plantGrassCartStore = usePlantGrassCartStore()
const { flyToTarget } = useFlyToButton()
const plantGrassMode = ref(false)
const showPlantGrassDrawer = ref(false)
const showPlantGrassShareModal = ref(false)
const plantGrassShareLoading = ref(false)
const plantGrassCollectLoading = ref(false)
const plantGrassBtnRef = ref<HTMLElement | null>(null)
const plantGrassShareRef = ref<InstanceType<typeof TimepipePlantGrassShare> | null>(null)
const shareCartSnapshot = ref<PlantGrassCartItem[]>([])
const plantGrassShareTitle = ref('种草单')
const plantGrassShareDateLabel = ref('')

const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return windowWidth.value < 768
})

const plantGrassFabBottomOffset = computed(() => {
  if (configStore.uniWebviewJs) return 88
  if (isMobile.value) return 20
  return 0
})

const handlePlantGrassToggle = (lib: Library, e?: MouseEvent) => {
  if (!userStore.token.value) {
    toast.add({ title: '请先登录', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  const id = lib.library_id
  if (plantGrassCartStore.hasLibrary(id)) {
    plantGrassCartStore.remove(id)
    return
  }
  const sourceEl = e?.currentTarget as HTMLElement | null
  const sourceRect = sourceEl?.getBoundingClientRect()
  const imgSrc = lib.cover ? `${BASE_IMG}${lib.cover}` : ''
  plantGrassCartStore.addFromLibrary(lib)
  if (sourceRect && imgSrc) {
    nextTick(() => {
      flyToTarget(sourceRect, imgSrc, plantGrassBtnRef)
    })
  }
}

const snapshotPlantGrassCart = () => {
  const dateLabel = dayjs(formatted.value).format('YYYY-MM-DD')
  shareCartSnapshot.value = plantGrassCartStore.list.map((item) => ({ ...item }))
  plantGrassShareTitle.value = `种草单 ${dayjs(formatted.value).format('YY-MM-DD')}`
  plantGrassShareDateLabel.value = `上新日期 ${dateLabel} · 共 ${shareCartSnapshot.value.length} 件`
}

/** 仅生成分享图，不写入收藏夹、不清空种草车 */
const openPlantGrassShare = async () => {
  if (plantGrassCartStore.count === 0) return
  if (plantGrassShareLoading.value) return
  snapshotPlantGrassCart()
  showPlantGrassShareModal.value = true
  plantGrassShareLoading.value = true
  try {
    await nextTick()
    await plantGrassShareRef.value?.generateAndUpload()
  } finally {
    plantGrassShareLoading.value = false
  }
}

const clearPlantGrassCart = () => {
  if (plantGrassCartStore.count === 0) return
  plantGrassCartStore.clear()
  toast.add({
    title: '已清空种草车',
    icon: 'i-heroicons-check-circle',
    color: 'green',
  })
}

/** 全部收藏至新收藏夹，成功后清空种草车 */
const collectAllPlantGrass = async () => {
  if (!userStore.token.value) {
    toast.add({ title: '请先登录', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  if (plantGrassCartStore.count === 0) return
  if (plantGrassCollectLoading.value) return

  plantGrassCollectLoading.value = true
  const dateLabel = dayjs(formatted.value).format('YYYY-MM-DD')
  const favoriteName = `种草单 ${dayjs(formatted.value).format('YY-MM-DD')}`
  try {
    const favorite = await insertFavorite({
      favorite_name: favoriteName,
      collect_type: 2,
      favorite_desc: `${dateLabel} 上新日历种草`,
    })
    const libraryIds = plantGrassCartStore.list.map((item) => item.library_id)
    await batchInsertCollect({
      favorite_id: favorite.id,
      collect_type: 2,
      ids: libraryIds,
    })
    await Promise.all(
      plantGrassCartStore.list.map((item) =>
        insertCollect({
          ids: [favorite.id],
          pk_id: item.library_id,
          collect_type: 2,
          json_data: { score: item.score },
        })
      )
    )
    plantGrassCartStore.clear()
    toast.add({
      title: '已全部收藏',
      description: `图鉴已加入收藏夹「${favoriteName}」`,
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
  } catch (error) {
    console.error(error)
    toast.add({
      title: '收藏失败',
      description: '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    plantGrassCollectLoading.value = false
  }
}

const userStore = storeToRefs(useUserStore())
const { user } = userStore
if (route.query?.token) {
  useUserStore().setToken(route.query.token.toString())
}
const opear_item = ref<Wardrobe[]>([])

const addWardrobeToDisplay = async () => {
  if (opear_item.value.length === 0) {
    toast.add({
      title: '错误',
      description: '请选择衣柜',
      color: 'red'
    })
    return
  }
  const params = {
    wardrobe_id: opear_item.value[0].wardrobe_id,
    pk_type: 1,
    pk_id: opear_item.value[0].user_id,
  }
  const response = await insertDisplayCabinet(params)
  if (response) {
    toast.add({
      title: '成功',
      description: '添加成功',
      color: 'green'
    })
  }
  waterList4.value?.refresh()
  showConfirm.value = false
  opear_item.value = []
}
const layout = ref('0')
const layoutIcon = computed(() => {
  if (layout.value === '0') return 'i-heroicons-squares-2x2'
  if (layout.value === '1') return 'i-heroicons-bars-3'
  return 'i-heroicons-document-text'
})
const layoutLabel = computed(() => {
  if (layout.value === '0') return '列表:大图'
  if (layout.value === '1') return '列表:简洁'
  return '列表:纯文本'
})
watch(layout, (val) => {
  if (val === '2') {
    nextTick(() => {
      waterList.value?.debouncedApplyLayout()
    })
  }
})
const todayVisit = ref(0)
const filterState = ref(0)
const draftFilterState = ref(0)
const sortMode = ref(2)
// 从 user 的 message_config 获取订阅资讯初始值
const getSubscribeNewsInitialValue = () => {
  if (user.value?.message_config && typeof user.value.message_config === 'object') {
    return user.value.message_config.daily_news_subscribe === true
  }
  return false
}
const subscribeNews = ref(getSubscribeNewsInitialValue())
const onlyNewToday = ref(false)
const filterStateOptions = [
  { label: '全部', value: -1 },
  { label: '预约中', value: 0 },
  { label: '尾款中', value: 1 },
  { label: '截团制作', value: 2 },
  { label: '现货在售', value: 3 },
  { label: '上新图透', value: 4 }
]
const sortOptions = [
  { label: '预约开始', value: 0 },
  // { label: '随机排序', value: 1 },
  { label: '最新上新', value: 2 },
  { label: '衣柜数', value: 3 },
  { label: '收藏数', value: 4 },
  { label: '点赞数', value: 5 }
]
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChoose> | null>(null)
const showChooseWardrobe = () => {
  wardrobeChooseRef.value?.showModel()
}
// 图鉴颜色选择完成 → 打开新增服饰
const handleLibraryTypeColorChoose = async (data: LibraryTypeColorChooseResult) => {
  await clothesAddRef.value?.showModel(librarySeedFromTypeColorChoose(data))
}
const handleClothesAddSuccess = (data?: WardrobeClothes) => {
  toast.add({
    title: '添加成功',
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })
  
  // 更新对应 item 的状态
  if (waterList.value && data?.library_id) {
    const currentItem = waterList.value.list?.find((item: LibraryPipe) => item.item?.library_id === data.library_id)
    if (currentItem) {
      const updates: Partial<LibraryPipe> = {
        is_wardrobe: 1,
        item: {
          ...currentItem.item,
          is_wardrobe: 1,
          wardrobe_count: (currentItem.item?.wardrobe_count || 0) + 1
        }
      }
      console.log(updates, '刷新item')
      waterList.value.updateItem('pk_id', data.library_id, updates)
    }
  } else {
    // 如果没有传递 library_id，刷新整个列表
    waterList.value?.refresh()
  }
}
// 处理加衣柜点击
const handleAddToWardrobe = (data: Library) => {
  if (!userStore.token.value) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  if (!data) {
    toast.add({
      title: '衣柜信息不存在',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  // 打开图鉴颜色选择
  libraryTypeColorChooseRef.value?.showModel(data)
}
const chooseWardrobe = (wardrobe: Wardrobe[]) => {
  console.log(wardrobe, '选择衣柜')
  showConfirm.value = true
  opear_item.value = wardrobe
}
const sortSelectRef = ref<InstanceType<typeof QhxSelect>>()
const currentTab = ref(0)

// 筛选相关
const showFilterModal = ref(false)
const showEmailModal = ref(false)
const filterList = ref<FilterList[]>([])
const filterForm = reactive({
  main_style: [] as Array<{ label: string; value: number; type?: string }>,
  design_elements: [] as Array<{ label: string; value: number; type?: string }>,
  pattern_elements: [] as Array<{ label: string; value: number; type?: string }>,
  theme: [] as Array<{ label: string; value: number; type?: string }>
})
const filterOptions = reactive({
  main_style: [] as Array<{ label: string; value: number }>
})
const mainStyleSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChooseType> | null>(null)
const currentWikiType = ref<string>('')

// 初始化筛选选项
const initFilterOptions = async () => {
  try {
    // 获取主要风格
    const mainStyleRes = await getWikiOptionsByKeywords({ type_id: 4 })
    filterOptions.main_style = mainStyleRes.map(item => ({
      label: item.wiki_name,
      value: item.wiki_id as number
    }))
  } catch (error) {
    console.error('初始化筛选选项失败:', error)
  }
}

// 选择wiki
const chooseWiki = (type: string) => {
  currentWikiType.value = type
  let typeId = 0
  const params: { type_id: number; parent_id?: number } = { type_id: typeId }

  if (type === 'design_elements') {
    typeId = 2
  } else if (type === 'pattern_elements') {
    typeId = 3
  } else if (type === 'theme') {
    typeId = 14
  }

  params.type_id = typeId
  // @ts-ignore
  wikiOptionsChooseRef.value?.showModel(params)
}

// Wiki选择回调
const onWikiChoose = (list: Array<{ wiki_id?: number; wiki_name?: string }>) => {
  const type = currentWikiType.value
  if (type && filterForm[type as keyof typeof filterForm]) {
    const arr = filterForm[type as keyof typeof filterForm] as Array<{ label: string; value: number; type?: string }>
    for (const child of list) {
      if (child.wiki_name && child.wiki_id) {
        const index = arr.findIndex((element) => element.label === child.wiki_name)
        if (index === -1) {
          arr.push({
            label: child.wiki_name,
            value: child.wiki_id as number,
            type: 'and'
          })
        }
      }
    }
  }
}

// 确认主要风格
const confirmMainStyle = (selected: { label: string; value: number }) => {
  if (selected) {
    const hasValue = filterForm.main_style.some(item => item.value === selected.value)
    if (!hasValue) {
      filterForm.main_style.push({ ...selected, type: 'and' })
    }
  }
}


// 删除数组项
const deleteArrayItem = <T,>(arr: T[], index: number) => {
  arr.splice(index, 1)
}

// 应用筛选
const applyFilter = () => {
  filterState.value = draftFilterState.value
  const temp: FilterList[] = []

  // 主要风格
  if (filterForm.main_style.length > 0) {
    const mainStyleValueAnd: number[] = []
    const mainStyleValueOr: number[] = []

    for (const v of filterForm.main_style) {
      if (v.type === 'and') {
        mainStyleValueAnd.push(v.value)
      } else if (v.type === 'or') {
        mainStyleValueOr.push(v.value)
      } else {
        temp.push({
          field: 'main_style',
          op: 'not',
          value: v.value
        })
      }
    }
    if (mainStyleValueAnd.length > 0) {
      temp.push({
        field: 'main_style',
        op: 'and',
        value: mainStyleValueAnd.join(',')
      })
    }
    if (mainStyleValueOr.length > 0) {
      temp.push({
        field: 'main_style',
        op: 'or',
        value: mainStyleValueOr.join(',')
      })
    }
  }

  // 设计元素
  if (filterForm.design_elements.length > 0) {
    const designElementsValueAnd: string[] = []
    const designElementsValueOr: string[] = []
    for (const v of filterForm.design_elements) {
      if (v.type === 'and') {
        designElementsValueAnd.push(v.label)
      } else if (v.type === 'or') {
        designElementsValueOr.push(v.label)
      } else {
        temp.push({
          field: 'design_elements',
          op: 'not',
          value: v.label
        })
      }
    }
    if (designElementsValueAnd.length > 0) {
      temp.push({
        field: 'design_elements',
        op: 'and',
        value: designElementsValueAnd.join(',')
      })
    }
    if (designElementsValueOr.length > 0) {
      temp.push({
        field: 'design_elements',
        op: 'or',
        value: designElementsValueOr.join(',')
      })
    }
  }

  // 柄图元素
  if (filterForm.pattern_elements.length > 0) {
    const patternElementsValueAnd: string[] = []
    const patternElementsValueOr: string[] = []
    for (const v of filterForm.pattern_elements) {
      if (v.type === 'and') {
        patternElementsValueAnd.push(v.label)
      } else if (v.type === 'or') {
        patternElementsValueOr.push(v.label)
      } else {
        temp.push({
          field: 'pattern_elements',
          op: 'not',
          value: v.label
        })
      }
    }
    if (patternElementsValueAnd.length > 0) {
      temp.push({
        field: 'pattern_elements',
        op: 'and',
        value: patternElementsValueAnd.join(',')
      })
    }
    if (patternElementsValueOr.length > 0) {
      temp.push({
        field: 'pattern_elements',
        op: 'or',
        value: patternElementsValueOr.join(',')
      })
    }
  }

  // 主题
  if (filterForm.theme.length > 0) {
    const themeValueAnd: string[] = []
    const themeValueOr: string[] = []
    for (const v of filterForm.theme) {
      if (v.type === 'and') {
        themeValueAnd.push(v.label)
      } else if (v.type === 'or') {
        themeValueOr.push(v.label)
      } else {
        temp.push({
          field: 'theme',
          op: 'not',
          value: v.label
        })
      }
    }
    if (themeValueAnd.length > 0) {
      temp.push({
        field: 'theme',
        op: 'and',
        value: themeValueAnd.join(',')
      })
    }
    if (themeValueOr.length > 0) {
      temp.push({
        field: 'theme',
        op: 'or',
        value: themeValueOr.join(',')
      })
    }
  }

  filterList.value = temp
  showFilterModal.value = false
  waterList.value?.refresh()
}

// 清空筛选
const clearFilter = () => {
  filterForm.main_style = []
  filterForm.design_elements = []
  filterForm.pattern_elements = []
  filterForm.theme = []
  filterList.value = []
  draftFilterState.value = 0
  filterState.value = 0
  showFilterModal.value = false
  waterList.value?.refresh()
}

// 切换筛选类型
const changeFilterType = (index: number, type: 'main_style' | 'design_elements' | 'pattern_elements' | 'theme') => {
  const field = filterForm[type]
  if (!field[index].type || field[index].type === 'and') {
    field[index].type = 'or'
  } else if (field[index].type === 'or') {
    field[index].type = 'not'
  } else {
    field[index].type = 'and'
  }
}

// 是否有筛选条件
const hasFilter = computed(() => {
  return filterList.value.length > 0 || filterState.value !== 0
})

// 筛选条件数量
const filterCount = computed(() => {
  return filterForm.main_style.length + 
         filterForm.design_elements.length + 
         filterForm.pattern_elements.length + 
         filterForm.theme.length
})

const filterButtonLabel = computed(() => {
  const stateLabel = filterStateOptions.find(item => item.value === filterState.value)?.label || '筛选'
  if (filterCount.value > 0) {
    return `筛选·${stateLabel}(${filterCount.value})`
  }
  return `筛选·${stateLabel}`
})

const openFilterModal = () => {
  draftFilterState.value = filterState.value
  showFilterModal.value = true
}

const openSortPicker = (e: MouseEvent) => {
  sortSelectRef.value?.showPicker(e)
}

// 处理订阅资讯状态变化
const handleSubscribeNewsChange = async (value: boolean) => {
  // 如果开启订阅，需要检查是否绑定邮箱
  if (value) {
    // 获取用户缓存
    const currentUser = user.value || useUserStore().user
    
    // 如果没有绑定邮箱，显示绑定邮箱弹窗
    if (!currentUser?.email) {
      // 先恢复开关状态
      subscribeNews.value = false
      // 显示绑定邮箱弹窗
      showEmailModal.value = true
      return
    }
    
    // 如果已绑定邮箱，更新订阅状态并保存
    try {
      // 调用 updateMessageConfig 保存订阅状态
      // message_config 可能不存在，updateMessageConfig 会处理这种情况
      await useUserStore().updateUserInfo({
        message_config: {
          daily_news_subscribe: value
        }
      })
      subscribeNews.value = value
      toast.add({
        title: '已开启订阅资讯',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } catch (error) {
      console.error('保存订阅状态失败:', error)
      // 恢复开关状态
      subscribeNews.value = false
      toast.add({
        title: '保存订阅状态失败',
        description: error instanceof Error ? error.message : '未知错误',
        icon: 'i-heroicons-x-circle',
        color: 'red'
      })
    }
  } else {
    // 关闭订阅并保存
    try {
      // 调用 updateMessageConfig 保存订阅状态
      await useUserStore().updateUserInfo({
        message_config: {
          daily_news_subscribe: false
        }
      })
      subscribeNews.value = value
      toast.add({
        title: '已关闭订阅资讯',
        icon: 'i-heroicons-information-circle',
        color: 'gray'
      })
    } catch (error) {
      console.error('保存订阅状态失败:', error)
      // 恢复开关状态
      subscribeNews.value = !value
      toast.add({
        title: '保存订阅状态失败',
        description: error instanceof Error ? error.message : '未知错误',
        icon: 'i-heroicons-x-circle',
        color: 'red'
      })
    }
  }
}

// 邮箱绑定成功回调
const handleEmailBindSuccess = async () => {
  try {
    // user 是响应式的，会自动更新
    // 如果用户已经绑定邮箱，自动开启订阅
    if (user.value?.email && !subscribeNews.value) {
      // 调用 updateMessageConfig 保存订阅状态
      // message_config 可能不存在，updateMessageConfig 会处理这种情况
      await useUserStore().updateUserInfo({
        message_config: {
          daily_news_subscribe: true
        }
      })
      // 更新本地订阅状态
      subscribeNews.value = true
      toast.add({
        title: '已开启订阅资讯',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
  } catch (error) {
    console.error('保存订阅状态失败:', error)
    toast.add({
      title: '保存订阅状态失败',
      description: error instanceof Error ? error.message : '未知错误',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}
const onChangeTab = (index: number) => {
  if (index === 0) {
    waterList.value?.debouncedApplyLayout()
    // 切换到上新日历 tab 时，如果弹幕未加载则加载弹幕
    nextTick(() => {
      if (danmakuRef.value) {
        danmakuRef.value.reload()
      }
    })
  }
  currentTab.value = index
}
const onChangeFilterState = () => {

}
const formateState = (state: number) => {
  // 0 预约中 1尾款中 2截团制作 3现货在售
  switch (state) {
    case 0:
      return '预约中'
    case 1:
      return '尾款中'
    case 2:
      return '截团制作'
    case 3:
      return '现货在售'
    case 4:
      return '上新图透'
    default:
      return '未知'
  }
}

// 根据状态返回对应的背景颜色
const getStateColor = (state: number): string => {
  switch (state) {
    case 0: // 预约中
      return '#096e00' // 蓝色
    case 1: // 尾款中
      return '#f59e0b' // 橙色
    case 2: // 截团制作
      return '#8b5cf6' // 紫色
    case 3: // 现货在售
      return '#10b981' // 绿色
    case 4: // 上新图透
      return '#ff9eb5' // 粉色
    default:
      return '#6b7280' // 灰色（未知状态）
  }
}

const getPipeRemainDays = (endTime: string | number | Date) =>
  dayjs(endTime).diff(dayjs(), 'day')

const formatPipeRemain = (days: number) => {
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今日截止'
  return `剩 ${days} 天`
}

const getPipeRemainClass = (days: number) => {
  if (days < 0) return 'timepipe-pipe-remain--expired'
  if (days <= 3) return 'timepipe-pipe-remain--urgent'
  if (days <= 7) return 'timepipe-pipe-remain--soon'
  return ''
}
const coptText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
const copyUrl = async () => {
  const { copyCurrentUrl } = useCopyCurrentUrl();
  try {
    await copyCurrentUrl()
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
const jumpToUser = (user_id: number) => {
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    console.log('走UniApp环境')
    uni.navigateTo({
      url: `/pages/userSpace/userSpace?id=${user_id}`,
    })
  }
  else {
    console.log('走普通网页环境')
    window.open(`/user/detail/${user_id}`, '_blank')
    // navigateTo(`/user/detail/${user_id}`)
  }
}
const jumpToShop = (item: Shop) => {
  const shop_id = item.shop_id
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    console.log('走UniApp环境')
    uni.navigateTo({
      url: `/pages/shop/shopDetail/shopDetail?id=${shop_id}`,
    })
  }
  else {
    console.log('走普通网页环境')
    window.open(`/shop/detail/${shop_id}`, '_blank')
    // navigateTo(`/shop/detail/${shop_id}`)
  }
}
const jumpToWardrobe = (item: Wardrobe) => {
  const user_id = item.user_id
  const wardrobe_id = item.wardrobe_id
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    console.log('走UniApp环境')
    uni.navigateTo({
      url: `/pages/wardrobe/wardrobe?user_id=${user_id}&wardrobe_id=${wardrobe_id}`,
    })
  } else {
    console.log('走普通网页环境')
    window.open(`/wardrobe/detail/${user_id}?wardrobe_id=${wardrobe_id}`, '_blank')
    // navigateTo(`/wardrobe/detail/${user_id}?wardrobe_id=${wardrobe_id}`)
  }
}
const getBrowTime = async () => {
  const response = await getBrowTimeOne({ id: dayjs(new Date()).format('YYYYMMDD'), type: 'library_pipe' })
  todayVisit.value = response.count_times
}
const picked = ref<Date | undefined>(undefined)
const pageSize = 20
const isLoading = ref(false)
const page = ref(1)
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const waterList4 = ref<InstanceType<typeof QhxWaterList> | null>(null)
const loadMore = () => {
  console.log('是否在加载', isLoading.value)
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
}
const isCompact = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})
const handlePageChange = async (current: number) => {
  page.value = current
  try {
    await fetchLibraryPipeList()
  } catch (error) {
    page.value -= 1
  }
}
const formatted = computed(() => {
  const d = picked.value ?? new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

// 将日期转为 YYMMDD 格式的 ID
function dateToId(d: Date) {
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return Number.parseInt(`${yy}${mm}${dd}`, 10)
}

// 选择日期往前7天的日期ID数组（含选择日，共7天）
const dateIds = computed(() => {
  const base = picked.value ?? new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() - (6 - i))
    return dateToId(d)
  })
})

// 监听日期ID数组变化，自动重新加载弹幕
watch(dateIds, () => {
  if (currentTab.value === 0 && danmakuRef.value) {
    nextTick(() => {
      danmakuRef.value?.reload()
    })
  }
})
const reload = () => {
  fetchLibraryPipeList(1, pageSize * page.value)
}
useHead({
  title: 'Lolita上新资讯平台',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,Lolita上新资讯平台'
    },
    {
      name: 'description',
      content: 'Lolita上新资讯汇总'
    }
  ]
})

function onChange(d: Date) {
  // 可在此处发起接口或过滤数据
  // console.log('changed', d)
  // page.value = 1
  // reload()
  waterList.value?.refresh()
  // 切换日期时重新加载弹幕
  if (currentTab.value === 0 && danmakuRef.value) {
    nextTick(() => {
      danmakuRef.value?.reload()
    })
  }
}
const list = ref<LibraryPipe[]>([])
const total = ref(0)
const showLibraryPipeAdd = () => {
  libraryPipeAddRef.value?.showModel({})
}
// const jumpToAddLibrary = () => {
//   navigateTo('/addLibrary')
// }
const fetchLibraryPipeList = async (Ipage: number | null = null, IpageSize: number | null = null) => {
  const params = {
    page: Ipage || page.value,
    pageSize: IpageSize || pageSize,
    time: dayjs(picked.value).format('YYYY-MM-DD')
  }
  try {
    const response = await getLibraryPipeList(params)
    if (page.value === 1) {
      list.value = response.rows
    } else {
      list.value = [...list.value, ...(response.rows ?? [])]
    }
    total.value = response.count
    return response
  } catch (error) {
    if (process.client) {
      console.error('获取店铺列表失败:', error)
    }
    return {
      rows: [],
      count: 0
    }
  }
}
const layoutReady = inject('layoutReady') as Ref<boolean>

watch(
  () => layoutReady.value,
  (val) => {
    if (val) {
      fetchLibraryPipeAll()
    } else {
    }
  },
  { immediate: true }
)

// 监听 user 变化，更新订阅资讯状态
watch(
  () => user.value?.message_config,
  (messageConfig) => {
    if (messageConfig && typeof messageConfig === 'object') {
      subscribeNews.value = messageConfig.daily_news_subscribe === true
    } else {
      subscribeNews.value = false
    }
  },
  { immediate: true, deep: true }
)

onMounted(async () => {
  plantGrassCartStore.loadFromStorage()
  picked.value = new Date()
  getBrowTime()
  // 初始化筛选选项
  await initFilterOptions()
  if (userStore.token.value) {
    getUserMy().then((res: User) => {
      console.log(res, '用户信息')
      useUserStore().setUserInfo(res)
    })
  }
  setTimeout(() => {
    handleResize()
    if (user.value?.user_id === 1) {
      return
    }
    insertBrowTime({ id: dayjs(new Date()).format('YYYYMMDD'), type: 'library_pipe' })
  }, 5000)
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  // fetchLibraryPipeList()
  
  // 监听窗口大小变化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})

onBeforeUnmount(() => {
  // 移除窗口大小监听器
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})
</script>

<style scoped>
.timepipe-wrapper {
  overscroll-behavior: none;
  /* touch-action: none; */
  -webkit-user-select: none;
  user-select: none;
}

.timepipe-toolbar {
  min-width: 0;
}

.timepipe-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
  font-size: 0.75rem;
  line-height: 1;
  color: #4b5563;
  cursor: pointer;
  user-select: none;
}

.dark .timepipe-toggle {
  color: #9ca3af;
}

/* 纯圆图标按钮（对齐衣服详情 fab） */
.timepipe-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: 9999px;
  border: 2px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 5%, #fff);
  color: var(--primary-color, #ff9eb5);
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.65),
    0 2px 8px rgb(0 0 0 / 0.06);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.16s ease;
}

.timepipe-icon-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 9%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, transparent);
}

.timepipe-icon-btn:active {
  transform: scale(0.97);
}

.dark .timepipe-icon-btn {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, rgb(17 24 39 / 0.72));
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, rgb(255 255 255 / 0.12));
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 78%, #fce7f3);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 2px 10px rgb(0 0 0 / 0.28);
}

.dark .timepipe-icon-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, rgb(17 24 39 / 0.78));
}

.timepipe-icon-btn--lg {
  width: 3rem;
  height: 3rem;
}

.timepipe-filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgb(209 213 219 / 0.95);
  background: rgb(249 250 251 / 0.95);
  color: #4b5563;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.timepipe-filter-chip:hover {
  background: rgb(243 244 246);
  border-color: rgb(156 163 175 / 0.7);
}

.timepipe-filter-chip--active {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, #fff);
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 75%, #831843);
}

.dark .timepipe-filter-chip {
  border-color: rgb(75 85 99 / 0.75);
  background: rgb(31 41 55 / 0.82);
  color: #d1d5db;
}

.dark .timepipe-filter-chip--active {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 50%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, #1f2937);
  color: #fce7f3;
}

/* —— 上新日历管道卡片 —— */
.timepipe-pipe-item {
  margin: 0 4px 10px;
  min-width: 0;
}

.timepipe-pipe-item--text {
  margin-bottom: 6px;
}

.timepipe-pipe-card {
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 14%, #f3f4f6);
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--primary-color, #ff9eb5) 6%, #fff) 0%,
      #fff 42%,
      #fff 100%
    );
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.8) inset,
    0 4px 16px rgb(0 0 0 / 0.05),
    0 1px 3px rgb(0 0 0 / 0.04);
  transition:
    transform 0.18s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.timepipe-pipe-card:hover {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 28%, #e5e7eb);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.85) inset,
    0 8px 22px rgb(0 0 0 / 0.07),
    0 2px 6px color-mix(in srgb, var(--primary-color, #ff9eb5) 12%, transparent);
}

.dark .timepipe-pipe-card {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 18%, rgb(55 65 81 / 0.9));
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, #1f2937) 0%,
      #111827 48%,
      #111827 100%
    );
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.04) inset,
    0 6px 18px rgb(0 0 0 / 0.35);
}

.dark .timepipe-pipe-card:hover {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 32%, rgb(75 85 99));
}

.timepipe-pipe-plant {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  cursor: pointer;
}

.timepipe-pipe-plant__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 9999px;
  color: #fff;
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.35) inset,
    0 2px 8px rgb(0 0 0 / 0.12);
  transition: transform 0.15s ease;
}

.timepipe-pipe-plant__btn:active {
  transform: scale(0.94);
}

.timepipe-pipe-plant__btn--add {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 92%, #fff),
    color-mix(in srgb, var(--primary-color, #ff9eb5) 72%, #f472b6)
  );
}

.timepipe-pipe-plant__btn--remove {
  background: linear-gradient(135deg, #f87171, #ef4444);
}

.timepipe-pipe-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem 0.35rem;
  min-width: 0;
}

.timepipe-pipe-meta--compact {
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  padding: 0.45rem 0.7rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.dark .timepipe-pipe-meta--compact {
  color: #9ca3af;
}

.timepipe-pipe-state-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 9999px;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.7);
}

.timepipe-pipe-meta__state {
  font-weight: 600;
  color: #374151;
}

.dark .timepipe-pipe-meta__state {
  color: #e5e7eb;
}

.timepipe-pipe-meta__right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.timepipe-pipe-meta__range {
  font-size: 0.6875rem;
  line-height: 1.2;
  color: #9ca3af;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.dark .timepipe-pipe-meta__range {
  color: #6b7280;
}

.timepipe-pipe-meta__sep {
  margin: 0 0.15rem;
  opacity: 0.55;
}

.timepipe-pipe-remain {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  color: #6b7280;
  background: rgb(243 244 246 / 0.95);
  border: 1px solid rgb(229 231 235 / 0.9);
}

.dark .timepipe-pipe-remain {
  color: #d1d5db;
  background: rgb(55 65 81 / 0.65);
  border-color: rgb(75 85 99 / 0.7);
}

.timepipe-pipe-remain--soon {
  color: #b45309;
  background: rgb(255 247 237 / 0.95);
  border-color: rgb(253 186 116 / 0.55);
}

.timepipe-pipe-remain--urgent {
  color: #be123c;
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 18%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 42%, transparent);
}

.timepipe-pipe-remain--expired {
  color: #6b7280;
  background: rgb(243 244 246 / 0.9);
  border-color: rgb(209 213 219 / 0.8);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.dark .timepipe-pipe-remain--soon {
  color: #fdba74;
  background: rgb(120 53 15 / 0.35);
  border-color: rgb(180 83 9 / 0.45);
}

.dark .timepipe-pipe-remain--urgent {
  color: #fda4af;
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, #1f2937);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 40%, transparent);
}

.dark .timepipe-pipe-remain--expired {
  color: #9ca3af;
  background: rgb(31 41 55 / 0.8);
  border-color: rgb(75 85 99 / 0.6);
}

.timepipe-pipe-note {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0 0.7rem 0.35rem;
  padding: 0.35rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  line-height: 1.35;
  color: #6b7280;
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 7%, #f9fafb);
  border: 1px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 12%, #f3f4f6);
}

.dark .timepipe-pipe-note {
  color: #9ca3af;
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, #1f2937);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, #374151);
}

.timepipe-pipe-note__icon {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  margin-top: 0.1rem;
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 80%, #9ca3af);
}

.timepipe-pipe-body {
  min-width: 0;
}

.timepipe-pipe-prices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.15rem;
}

.timepipe-pipe-price-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.35;
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 72%, #831843);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, transparent);
}

.dark .timepipe-pipe-price-chip {
  color: #fce7f3;
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 18%, #1f2937);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 28%, transparent);
}

.timepipe-pipe-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 0.25rem;
  margin: 0 0.55rem 0.55rem;
  padding: 0.2rem 0.15rem;
  border-radius: 12px;
  background: rgb(249 250 251 / 0.92);
  border: 1px solid rgb(243 244 246 / 0.95);
}

.dark .timepipe-pipe-actions {
  background: rgb(31 41 55 / 0.55);
  border-color: rgb(55 65 81 / 0.8);
}

.timepipe-pipe-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  transform: scale(0.88);
  transform-origin: center;
}

.timepipe-pipe-wardrobe {
  gap: 0.2rem;
  padding: 0.15rem 0.35rem;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s ease, background 0.15s ease;
}

.timepipe-pipe-wardrobe:hover {
  color: #409eff;
  background: rgb(64 158 255 / 0.08);
}

.timepipe-pipe-wardrobe--active {
  color: #409eff;
}

.dark .timepipe-pipe-wardrobe {
  color: #9ca3af;
}

.dark .timepipe-pipe-wardrobe--active,
.dark .timepipe-pipe-wardrobe:hover {
  color: #60a5fa;
}

.p-4 {
  padding: 16px;
}

.mt-4 {
  margin-top: 16px;
}

.text-sm {
  font-size: 14px;
}

.text-gray-600 {
  color: #4b5563;
}

.plant-grass-drawer-footer {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
}

/* 胶囊按钮（对齐衣服详情等页） */
.modal-capsule-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1.35rem;
  border-radius: 9999px;
  border: 1.5px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, transparent);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 90%, #fff) 0%,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, #f472b6) 100%
  );
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.38),
    0 2px 8px color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, transparent);
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease,
    border-color 0.2s ease;
}

.modal-capsule-btn:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.4),
    0 4px 14px color-mix(in srgb, var(--primary-color, #ff9eb5) 34%, transparent);
}

.modal-capsule-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.modal-capsule-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.dark .modal-capsule-btn {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, rgb(255 255 255 / 0.15));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 75%, #831843) 0%,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, #4c0519) 100%
  );
  color: #fce7f3;
}

.modal-capsule-btn--ghost {
  border-color: rgb(209 213 219 / 0.95);
  background: rgb(249 250 251 / 0.95);
  color: #4b5563;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.8),
    0 1px 4px rgb(0 0 0 / 0.05);
}

.modal-capsule-btn--ghost:hover:not(:disabled) {
  filter: none;
  background: rgb(243 244 246 / 0.98);
  border-color: rgb(156 163 175 / 0.55);
}

.dark .modal-capsule-btn--ghost {
  border-color: rgb(75 85 99 / 0.75);
  background: rgb(31 41 55 / 0.82);
  color: #d1d5db;
}

.dark .modal-capsule-btn--ghost:hover:not(:disabled) {
  background: rgb(55 65 81 / 0.88);
  border-color: rgb(107 114 128 / 0.75);
}

.modal-capsule-btn--soft {
  border-color: rgb(229 231 235 / 0.95);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.98) 0%, rgb(249 250 251 / 0.96) 100%);
  color: #6b7280;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 1px 4px rgb(0 0 0 / 0.04);
}

.modal-capsule-btn--soft:hover:not(:disabled) {
  filter: none;
  color: #4b5563;
  border-color: rgb(209 213 219 / 0.95);
  background: linear-gradient(180deg, rgb(255 255 255) 0%, rgb(243 244 246) 100%);
}

.dark .modal-capsule-btn--soft {
  border-color: rgb(75 85 99 / 0.7);
  background: linear-gradient(180deg, rgb(55 65 81 / 0.72) 0%, rgb(31 41 55 / 0.82) 100%);
  color: #d1d5db;
}

.dark .modal-capsule-btn--soft:hover:not(:disabled) {
  background: linear-gradient(180deg, rgb(75 85 99 / 0.78) 0%, rgb(55 65 81 / 0.88) 100%);
  color: #f3f4f6;
}

.modal-capsule-btn--danger {
  border-color: color-mix(in srgb, #ef4444 62%, transparent);
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.28),
    0 2px 10px rgb(239 68 68 / 0.28);
}

.modal-capsule-btn--danger:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.32),
    0 4px 14px rgb(239 68 68 / 0.34);
}

.dark .modal-capsule-btn--danger {
  border-color: color-mix(in srgb, #f87171 55%, rgb(255 255 255 / 0.12));
  background: linear-gradient(135deg, rgb(185 28 28 / 0.92) 0%, rgb(127 29 29 / 0.95) 100%);
  color: #fecaca;
}

.modal-capsule-btn--sm {
  padding: 0.28rem 0.85rem;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

.modal-capsule-btn--icon {
  width: 3rem;
  height: 3rem;
  padding: 0;
  border-radius: 9999px;
}

.modal-capsule-btn--icon-sm {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  padding: 0;
  border-radius: 9999px;
}
</style>
