<template>
  <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
  <QhxBottomDrawer 
    v-if="show" 
    :direction="isMobile ? 'bottom' : 'right'" 
    :default-size="isMobile ? 600 : 500"
  >
    <div class="flex flex-col h-full">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between mb-2 px-2 pt-2 flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-3">
        <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">{{ t('wardrobe.search.title') }}</h3>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 可滚动内容区域 -->
      <div class="flex-1 overflow-y-auto px-2 py-2">
        <!-- 所属衣柜 -->
        <div v-if="wardrobeList.length > 0" class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.belong') }}</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.wardrobe_id"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteArr(filter_list.wardrobe_id, index)" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <QhxTag class="cursor-pointer" @click="openWardrobeSelect">
              {{ t('wardrobe.search.select_wardrobe') }}
            </QhxTag>
          </div>
        </div>

        <!-- 搜索名称 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.name') }}</div>
          <UInput 
            v-model="filter_list.clothes_note" 
            :placeholder="t('wardrobe.search.name_placeholder')"
            class="flex-1"
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
          />
        </div>

        <!-- 搜索笔记 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.note') }}</div>
          <UInput 
            v-model="filter_list.note" 
            :placeholder="t('wardrobe.search.note_placeholder')"
            class="flex-1"
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
          />
        </div>

        <!-- 搜索尺码 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.size') }}</div>
          <UInput
            v-model="filter_list.size"
            :placeholder="t('wardrobe.search.size_placeholder')"
            class="flex-1"
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
          />
        </div>

        <!-- 来源搜索 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.origin') }}</div>
          <div class="flex-1 flex items-center">
            <USelectMenu
              v-model="origin_shop"
              :loading="loading"
              :searchable="fetchShopOptiosns"
              :placeholder="t('wardrobe.search.shop_placeholder')"
              option-attribute="shop_name"
              creatable
              :multiple="false"
              trailing
              by="shop_id"
              name="shop_name"
              class="flex-1"
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
            />
            <QhxJellyButton>
              <div class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                @click="origin_shop = undefined">
                <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
              </div>
            </QhxJellyButton>
          </div>
        </div>

        <!-- 筛选颜色 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.color') }}</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <div
              v-for="(color, index) in filter_list.color"
              :key="index"
              :style="{ background: color, width: '35px', height: '35px', borderRadius: '8px' }"
              class="relative cursor-pointer"
            >
              <button
                @click="deleteArr(filter_list.color, index)"
                class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
              >
                <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
              </button>
            </div>
            <QhxTag class="cursor-pointer" @click="showColorChoose = true">
              {{ t('wardrobe.search.select_color') }}
            </QhxTag>
          </div>
        </div>

        <!-- 拥有状态 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.status') }}</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.wardrobe_status"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteRemote(item.value, 'wardrobeStatus')" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <UButton
              size="xs"
              variant="outline"
              @click="openStatusSelect"
            >
              {{ t('wardrobe.search.select_status') }}
            </UButton>
          </div>
        </div>

        <!-- 版型部位 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.part') }}</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.clothes_part"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteRemote(item.value, 'clothesPart')" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <UButton
              size="xs"
              variant="outline"
              @click="openClothesPartSelect"
            >
              {{ t('wardrobe.search.select_part') }}
            </UButton>
          </div>
        </div>

        <!-- 价格区间 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.price') }}</div>
          <div class="flex-1 flex items-center gap-2">
            <UInput
              v-model="filter_list.price.start_price"
              type="number"
              :placeholder="t('wardrobe.search.price_start')"
              class="flex-1"
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
            />
            <span class="text-gray-600 dark:text-gray-400 text-sm">{{ t('wardrobe.search.price_to') }}</span>
            <UInput
              v-model="filter_list.price.end_price"
              type="number"
              :placeholder="t('wardrobe.search.price_end')"
              class="flex-1"
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
            />
          </div>
        </div>

        <!-- 原价：起末相同为精确值，不同为区间 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.original_price') }}</div>
          <div class="flex-1 flex items-center gap-2">
            <UInput
              v-model="filter_list.original_price.start"
              type="number"
              :placeholder="t('wardrobe.search.price_exact')"
              class="flex-1"
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
            />
            <span class="text-gray-600 dark:text-gray-400 text-sm">{{ t('wardrobe.search.price_to') }}</span>
            <UInput
              v-model="filter_list.original_price.end"
              type="number"
              :placeholder="t('wardrobe.search.price_end')"
              class="flex-1"
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
            />
          </div>
        </div>

        <!-- 出物价：起末相同为精确值，不同为区间 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.offer_price') }}</div>
          <div class="flex-1 flex items-center gap-2">
            <UInput
              v-model="filter_list.offer_price.start"
              type="number"
              :placeholder="t('wardrobe.search.price_exact')"
              class="flex-1"
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
            />
            <span class="text-gray-600 dark:text-gray-400 text-sm">{{ t('wardrobe.search.price_to') }}</span>
            <UInput
              v-model="filter_list.offer_price.end"
              type="number"
              :placeholder="t('wardrobe.search.price_end')"
              class="flex-1"
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
            />
          </div>
        </div>

        <!-- 穿着次数 -->
        <div class="mb-3 flex items-center gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.times') }}</div>
          <div class="flex-1 flex items-center gap-2">
            <UInput
              v-model="filter_list.times.start_times"
              type="number"
              :placeholder="t('wardrobe.search.price_start')"
              class="flex-1"
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
            />
            <span class="text-gray-600 dark:text-gray-400 text-sm">{{ t('wardrobe.search.price_to') }}</span>
            <UInput
              v-model="filter_list.times.end_times"
              type="number"
              :placeholder="t('wardrobe.search.price_end')"
              class="flex-1"
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
            />
          </div>
        </div>

        <!-- 适宜季节 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.season') }}</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.season"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteArr(filter_list.season, index)" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <QhxTag class="cursor-pointer" @click="openSeasonSelect">
              {{ t('wardrobe.search.select_season') }}
            </QhxTag>
          </div>
        </div>

        <!-- 搜索标签 -->
        <div class="mb-3 flex items-start gap-3">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 w-20">{{ t('wardrobe.search.tags') }}</div>
          <div class="flex-1 flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in filter_list.tags"
              :key="index"
              class="cursor-pointer"
            >
              <div class="flex items-center gap-1">
                {{ item.label }}
                <button @click="deleteRemote(item.value, 'tags')" class="ml-1">
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </QhxTag>
            <UButton
              size="xs"
              variant="outline"
              @click="openTagsSelect"
            >
              {{ t('wardrobe.search.select_tags') }}
            </UButton>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="mb-4 flex gap-2">
          <UButton
            color="primary"
            class="flex-1"
            :ui="capsuleBtnUi"
            @click="handleSearch"
          >
            {{ t('common.search') }}
          </UButton>
          <UButton
            color="gray"
            variant="outline"
            class="flex-1"
            :ui="capsuleBtnUi"
            @click="clearFilter"
          >
            {{ t('wardrobe.search.clear') }}
          </UButton>
        </div>

        <!-- 搜索结果列表 -->
        <div class="clothes-list-wrap">
          <div
            v-for="(item, index) in list"
            :key="index"
            class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="chooseClothes(item)"
          >
            <div class="flex gap-3">
              <div
                class="clothes-cover flex-shrink-0"
              >
                <img
                  :src="BASE_IMG + item.clothes_img"
                  :alt="item.clothes_note || t('wardrobe.search.clothes_alt')"
                  class="w-[100px] h-[100px] object-cover rounded-lg"
                  loading="lazy"
                />
              </div>
              <div class="flex-1 min-w-0" @click.stop="jumpToClothes(item)">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {{ item.clothes_note || t('wardrobe.search.no_note') }}
                </div>
                <div v-if="item.price" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {{ t('wardrobe.search.price_label') }}{{ item.price }}
                </div>
                <div v-if="item.original_price" class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('wardrobe.search.original_label') }}{{ item.original_price }}
                </div>
                <div v-if="item.offer_price" class="text-xs text-rose-500 dark:text-rose-400 mb-1">
                  {{ t('wardrobe.search.offer_label') }}{{ item.offer_price }}
                </div>
                <div v-if="item.times !== undefined && item.times !== null" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {{ t('wardrobe.search.times_label') }}{{ item.times }}
                </div>
                <div v-if="item.color" class="flex items-center gap-1 mb-1">
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('wardrobe.search.color_label') }}</span>
                  <div
                    v-for="(color, colorIndex) in item.color.split(',')"
                    :key="colorIndex"
                    :style="{ background: color, width: '20px', height: '20px', borderRadius: '4px' }"
                    class="inline-block"
                  />
                </div>
                <div v-if="item.season" class="flex flex-wrap gap-1 mb-1 items-center">
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('wardrobe.search.season_label') }}</span>
                  <QhxTag
                    v-for="(season, seasonIndex) in item.season.split(',')"
                    :key="seasonIndex"
                  >
                    {{ wardrobeSeasonLabel(t, season) }}
                  </QhxTag>
                </div>
                <div v-if="item.wardrobe_status" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {{ t('wardrobe.search.status_label') }}{{ wardrobeStatusLabel(t, item.wardrobe_status) }}
                </div>
                <div v-if="item.size" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {{ t('wardrobe.search.size_label') }}{{ item.size }}
                </div>
                <div v-if="item.clothes_part" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {{ t('wardrobe.search.part_label') }}{{ wardrobePartLabel(t, item.clothes_part) }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-500 mt-2 text-right">
                  {{ formatDate(item.date) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <QhxLoading
          :loading="loading"
          :page="page"
          :total="total"
          :page-size="pageSize"
          @load-more="loadMore"
        />
      </div>
    </div>

    <!-- 季节选择 -->
    <QhxOptionsChoose
      ref="seasonSelectRef"
      :title="t('wardrobe.search.choose_season_title')"
      :options="seasonOptions"
      :empty-confirm-message="t('wardrobe.search.choose_season_empty')"
      @select="confirmSeason"
    />

    <!-- 衣柜选择 -->
    <QhxSelect
      v-model="showWardrobeSelect"
      ref="wardrobeSelectRef"
      :options="wardrobeOptions"
      @select="confirmWardrobe"
    />

    <!-- 状态选择 -->
    <QhxOptionsChoose
      ref="statusSelectRef"
      :title="t('wardrobe.search.choose_status_title')"
      :options="wardrobeStatusOptions"
      :can-customize="true"
      :undeletable-values="['已拥有', '待补款', '已出']"
      :empty-confirm-message="t('wardrobe.search.choose_status_empty')"
      @select="confirmStatus"
      @delete="(item) => onDeleteConfigOption('wardrobe_status', item)"
    />

    <!-- 部位选择 -->
    <QhxOptionsChoose
      ref="clothesPartSelectRef"
      :title="t('wardrobe.search.choose_part_title')"
      :options="clothesPartOptions"
      :can-customize="true"
      :empty-confirm-message="t('wardrobe.search.choose_part_empty')"
      @select="confirmClothesPart"
      @delete="(item) => onDeleteConfigOption('clothes_part', item)"
    />

    <!-- 标签选择 -->
    <QhxOptionsChoose
      ref="tagsSelectRef"
      :title="t('wardrobe.search.choose_tags_title')"
      :options="tagsOptions"
      :can-customize="true"
      :empty-confirm-message="t('wardrobe.search.choose_tags_empty')"
      @select="confirmTags"
      @delete="(item) => onDeleteConfigOption('tags', item)"
    />

    <!-- 颜色选择弹窗 -->
    <UModal v-model="showColorChoose">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ t('wardrobe.search.choose_color_title') }}</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="showColorChoose = false"
            />
          </div>
        </template>
        <div class="p-2">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('wardrobe.search.choose_color_hint') }}</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(color, index) in wardrobeColors"
              :key="index"
              :style="{ background: color, width: '35px', height: '35px', borderRadius: '8px' }"
              class="cursor-pointer hover:opacity-80 transition-opacity"
              @click="colorChoose(color)"
            />
            <div v-if="wardrobeColors.length === 0" class="text-sm text-gray-500">
              {{ t('wardrobe.search.no_colors') }}
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </QhxBottomDrawer>
  </Transition>
</template>

<script setup lang="ts">
import type { Wardrobe, WardrobeClothes, Shop } from '@/types/api'
import { getClothesSearch } from '@/api/wardrobe'
import { getShopOptiosns } from '@/api/shop'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'
import type QhxOptionsChoose from '@/components/Qhx/OptionsChoose.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  clothesTermDeletedMessage,
  deleteClothesConfigOptionThenReload,
  type ClothesConfigOptionKind,
} from '@/utils/clothesConfigOption'
import {
  mapConfigStatusOptions,
  wardrobePartLabel,
  wardrobeSeasonLabel,
  wardrobeSeasonOptions,
  wardrobeStatusLabel,
} from '@/utils/wardrobeDisplayI18n'
import dayjs from 'dayjs'

const { t } = useI18n()
const capsuleBtnUi = { rounded: 'rounded-full' } as const

interface Props {
  wardrobeList?: Wardrobe[]
  needStatus?: boolean
  canChoose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  wardrobeList: () => [],
  needStatus: false,
  canChoose: false
})

const emit = defineEmits<{
  choose: [item: WardrobeClothes]
}>()

const show = ref(false)
const list = ref<WardrobeClothes[]>([])
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const toast = useToast()
const wardrobeStore = useWardrobeStore()
const configStore = useConfigStore()
let uni: any
const port = computed(() => configStore.getPort())

// 判断是否为移动端
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

// 季节选项（value 保持库内中文，label 随语言）
const seasonOptions = computed(() => wardrobeSeasonOptions(t))

// 衣柜选项
const wardrobeOptions = computed(() => {
  return props.wardrobeList.map((item) => ({
    value: item.wardrobe_id,
    label: item.wardrobe_name
  }))
})

// 衣柜状态选项
const wardrobeStatusOptions = computed(() => {
  if (!wardrobeStore.config?.wardrobe_status) return []
  return mapConfigStatusOptions(t, wardrobeStore.config.wardrobe_status)
})

// 版型部位选项
const clothesPartOptions = computed(() => {
  if (!wardrobeStore.config?.clothes_part) return []
  return wardrobeStore.config.clothes_part.map((part: string) => ({
    label: wardrobePartLabel(t, part),
    value: part
  }))
})

// 标签选项：优先用衣柜已有记忆
const tagsOptions = computed(() => {
  const raw = wardrobeStore.config?.tags
  if (!Array.isArray(raw) || raw.length === 0) return []
  const labels: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    for (const part of item.split(',')) {
      const label = part.trim()
      if (label) labels.push(label)
    }
  }
  return [...new Set(labels)].map((label) => ({ value: label, label }))
})

// 衣柜颜色列表（从配置中获取）
const wardrobeColors = computed(() => {
  if (!wardrobeStore.config?.color_list) return []
  return wardrobeStore.config.color_list
})

// 筛选条件
const filter_list = ref({
  wardrobe_id: [] as Array<{ value: number | string; label: string }>,
  color: [] as string[],
  times: {
    start_times: null as number | null,
    end_times: null as number | null
  },
  price: {
    start_price: null as number | null,
    end_price: null as number | null
  },
  original_price: {
    start: null as number | null,
    end: null as number | null
  },
  offer_price: {
    start: null as number | null,
    end: null as number | null
  },
  season: [] as Array<{ value: string; label: string }>,
  clothes_note: '',
  size: '',
  wardrobe_status: [] as Array<{ value: string; label: string }>,
  clothes_part: [] as Array<{ value: string; label: string }>,
  note: '',
  tags: [] as Array<{ value: string; label: string }>
})

const origin_shop = ref<Shop | undefined>(undefined)
const fetchShopOptiosns = async (keywords: string) => {
  const response = await getShopOptiosns({ shop_name: keywords || '' })
  const data: Shop[] = response.length > 20 ? response.slice(0, 19) : response
  return data
}

const filter_list1 = ref<Array<{ field: string; op: string; value: string | number | Record<string, unknown> }>>([])

/** 原价/出物价：仅填一侧或起末相等 → 精确值；起末不同 → 区间 `{ start, end }` */
function pushRangeOrExactFilter(
  list: Array<{ field: string; op: string; value: string | number | Record<string, unknown> }>,
  field: 'original_price' | 'offer_price',
  start: number | null | string,
  end: number | null | string
) {
  const hasStart = start !== null && start !== undefined && start !== ''
  const hasEnd = end !== null && end !== undefined && end !== ''
  if (!hasStart && !hasEnd) return
  const startNum = hasStart ? Number(start) : null
  const endNum = hasEnd ? Number(end) : null
  if (hasStart && hasEnd) {
    if (startNum === endNum) {
      list.push({ field, op: 'and', value: startNum as number })
    } else {
      list.push({ field, op: 'and', value: { start: startNum, end: endNum } })
    }
    return
  }
  if (hasStart) {
    list.push({ field, op: 'and', value: startNum as number })
  } else if (hasEnd) {
    list.push({ field, op: 'and', value: endNum as number })
  }
}

// 控制显示
const show_control = ref({
  color_choose: false,
  season: false,
  wardrobe: false
})

const showWardrobeSelect = ref(false)
const showColorChoose = ref(false)

// 选择器引用
const seasonSelectRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
const wardrobeSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const statusSelectRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
const clothesPartSelectRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)
const tagsSelectRef = ref<InstanceType<typeof QhxOptionsChoose> | null>(null)

// 打开选择器
const openStatusSelect = (e: MouseEvent) => {
  statusSelectRef.value?.showPicker(e, filter_list.value.wardrobe_status)
}

const openClothesPartSelect = (e: MouseEvent) => {
  clothesPartSelectRef.value?.showPicker(e, filter_list.value.clothes_part)
}

const openTagsSelect = (e: MouseEvent) => {
  tagsSelectRef.value?.showPicker(e, filter_list.value.tags)
}

const openSeasonSelect = (e: MouseEvent) => {
  seasonSelectRef.value?.showPicker(e, filter_list.value.season)
}

const openWardrobeSelect = (e: MouseEvent) => {
  showWardrobeSelect.value = true
  nextTick(() => {
    wardrobeSelectRef.value?.showPicker(e)
  })
}

// 删除数组项
const deleteArr = (arr: any[], index: number) => {
  arr.splice(index, 1)
}

// 删除远程选择项（按 value 匹配，避免翻译后的 label 对不上）
const deleteRemote = (str: string, type: 'wardrobeStatus' | 'clothesPart' | 'tags') => {
  if (type === 'wardrobeStatus') {
    const index = filter_list.value.wardrobe_status.findIndex(item => item.value === str)
    if (index !== -1) {
      filter_list.value.wardrobe_status.splice(index, 1)
    }
  } else if (type === 'clothesPart') {
    const index = filter_list.value.clothes_part.findIndex(item => item.value === str)
    if (index !== -1) {
      filter_list.value.clothes_part.splice(index, 1)
    }
  } else if (type === 'tags') {
    const index = filter_list.value.tags.findIndex(item => item.value === str)
    if (index !== -1) {
      filter_list.value.tags.splice(index, 1)
    }
  }
}

function pushUniqueOption(
  list: Array<{ value: string; label: string }>,
  item: optionsInterface,
) {
  const value = String(item.value)
  const hasValue = list.some((row) => row.value === value || row.label === item.label)
  if (!hasValue) list.push({ value, label: item.label })
}

// 确认选择
const confirmSeason = (list: optionsInterface[]) => {
  for (const v of list) pushUniqueOption(filter_list.value.season, v)
}

const confirmWardrobe = (v: { value: number | string; label: string }) => {
  const hasValue = filter_list.value.wardrobe_id.some(item => item.value === v.value)
  if (!hasValue) {
    filter_list.value.wardrobe_id.push(v)
  } else {
    toast.add({
      title: t('addShop.duplicate_add'),
      type: 'warning'
    })
  }
  showWardrobeSelect.value = false
}

const confirmStatus = (list: optionsInterface[]) => {
  for (const v of list) pushUniqueOption(filter_list.value.wardrobe_status, v)
}

const confirmClothesPart = (list: optionsInterface[]) => {
  for (const v of list) pushUniqueOption(filter_list.value.clothes_part, v)
}

const confirmTags = (list: optionsInterface[]) => {
  for (const v of list) pushUniqueOption(filter_list.value.tags, v)
}

async function onDeleteConfigOption(kind: ClothesConfigOptionKind, item: optionsInterface) {
  const term = String(item.value ?? item.label ?? '').trim()
  if (!term) return
  try {
    const { updated } = await deleteClothesConfigOptionThenReload(kind, term)
    if (kind === 'wardrobe_status') {
      filter_list.value.wardrobe_status = filter_list.value.wardrobe_status.filter(
        (row) => row.value.trim() !== term,
      )
    } else if (kind === 'clothes_part') {
      filter_list.value.clothes_part = filter_list.value.clothes_part.filter(
        (row) => row.value.trim() !== term,
      )
    } else if (kind === 'tags') {
      filter_list.value.tags = filter_list.value.tags.filter((row) => row.value.trim() !== term)
    }
    toast.add({ title: clothesTermDeletedMessage(updated), color: 'green', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({ title: t('wardrobe.toast.delete_failed'), color: 'red', icon: 'i-heroicons-exclamation-circle' })
  }
}

// 选择颜色
const colorChoose = (hex: string) => {
  const index = filter_list.value.color.findIndex(item => item === hex)
  if (index === -1) {
    filter_list.value.color.push(hex)
  } else {
    toast.add({
      title: t('addShop.duplicate_add'),
      type: 'warning'
    })
  }
  showColorChoose.value = false
}

// 选择服饰
const chooseClothes = (item: WardrobeClothes) => {
  if (props.canChoose) {
    emit('choose', item)
    closeModel()
  }
}

// 跳转到服饰详情
const jumpToClothes = (item: WardrobeClothes) => {
  if (!props.canChoose) {
    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus')
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
      // UniApp WebView 环境
      uni.navigateTo({
        url: `/pages/common/outerLink?url=https://lolitalibrary.com/clothes/detail/${item.clothes_id}`,
        fail: () => {
          console.log('跳转错误')
        }
      })
      return
    }

    // 鸿蒙壳：port 异步注入，不能只靠 port；statusBar / session 标记也视为 App WebView
    const harmonyMarked =
      import.meta.client &&
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('harmony_webview') === '1'
    const inHarmonyShell =
      !!port.value || configStore.statusBarHeight > 0 || !!harmonyMarked
    if (inHarmonyShell) {
      void navigateTo(`/clothes/detail/${item.clothes_id}`)
      return
    }

    // 普通网页环境
    window.open(`https://lolitalibrary.com/clothes/detail/${item.clothes_id}`, '_blank')
  }
}

// 格式化筛选列表
const formatFilterList = () => {
  const filterList: Array<{ field: string; op: string; value: string | number | Record<string, unknown> }> = []

  // 颜色
  if (filter_list.value.color.length > 0) {
    filterList.push({
      field: 'color',
      op: 'and',
      value: filter_list.value.color.join(',')
    })
  }

  // 穿着次数
  const { start_times, end_times } = filter_list.value.times
  if (start_times !== null && start_times !== undefined && start_times !== '') {
    filterList.push({
      field: 'start_times',
      op: 'and',
      value: start_times
    })
  }
  if (end_times !== null && end_times !== undefined && end_times !== '') {
    filterList.push({
      field: 'end_times',
      op: 'and',
      value: end_times
    })
  }

  // 价格
  const { start_price, end_price } = filter_list.value.price
  if (start_price !== null && start_price !== undefined && start_price !== '') {
    filterList.push({
      field: 'start_price',
      op: 'and',
      value: start_price
    })
  }
  if (end_price !== null && end_price !== undefined && end_price !== '') {
    filterList.push({
      field: 'end_price',
      op: 'and',
      value: end_price
    })
  }

  pushRangeOrExactFilter(
    filterList,
    'original_price',
    filter_list.value.original_price.start,
    filter_list.value.original_price.end
  )
  pushRangeOrExactFilter(
    filterList,
    'offer_price',
    filter_list.value.offer_price.start,
    filter_list.value.offer_price.end
  )

  // 名称
  if (filter_list.value.clothes_note && filter_list.value.clothes_note.trim() !== '') {
    filterList.push({
      field: 'clothes_note',
      op: 'and',
      value: filter_list.value.clothes_note
    })
  }

  // 笔记
  if (filter_list.value.note && filter_list.value.note.trim() !== '') {
    filterList.push({
      field: 'note',
      op: 'and',
      value: filter_list.value.note
    })
  }

  // 尺码
  if (filter_list.value.size && filter_list.value.size.trim() !== '') {
    filterList.push({
      field: 'size',
      op: 'and',
      value: filter_list.value.size.trim()
    })
  }

  // 来源
  if (origin_shop.value) {
    const val = origin_shop.value.shop_id ?? origin_shop.value.shop_name
    if (val != null && String(val).trim() !== '') {
      filterList.push({
        field: 'origin',
        op: 'and',
        value: val
      })
    }
  }

  // 状态（API 仍用库内中文 value）
  if (filter_list.value.wardrobe_status.length > 0) {
    filterList.push({
      field: 'wardrobe_status',
      op: 'and',
      value: filter_list.value.wardrobe_status.map(v => v.value).join(',')
    })
  }

  // 标签
  if (filter_list.value.tags.length > 0) {
    filterList.push({
      field: 'tags',
      op: 'and',
      value: filter_list.value.tags.map(v => v.value).join(',')
    })
  }

  // 部位
  if (filter_list.value.clothes_part.length > 0) {
    filterList.push({
      field: 'clothes_part',
      op: 'and',
      value: filter_list.value.clothes_part.map(v => v.value).join(',')
    })
  }

  // 季节
  if (filter_list.value.season.length > 0) {
    filterList.push({
      field: 'season',
      op: 'and',
      value: filter_list.value.season.map(v => v.value).join(',')
    })
  }

  return filterList
}

// 搜索
const handleSearch = () => {
  filter_list1.value = formatFilterList()
  page.value = 1
  getClothesSearchData()
}

// 清空筛选
const clearFilter = () => {
  filter_list.value = {
    wardrobe_id: [],
    color: [],
    times: {
      start_times: null,
      end_times: null
    },
    price: {
      start_price: null,
      end_price: null
    },
    original_price: {
      start: null,
      end: null
    },
    offer_price: {
      start: null,
      end: null
    },
    season: [],
    clothes_note: '',
    size: '',
    wardrobe_status: [],
    clothes_part: [],
    note: '',
    tags: []
  }
  origin_shop.value = undefined
  reload()
}

// 加载更多
const loadMore = () => {
  if (loading.value) {
    toast.add({
      title: t('wardrobe.square.loading_toast'),
      type: 'warning'
    })
    return
  }
  const maxLength = Math.ceil(total.value / pageSize.value)
  if (page.value < maxLength) {
    page.value += 1
    getClothesSearchData()
  } else {
    toast.add({
      title: t('wardrobe.square.no_more'),
      type: 'info'
    })
  }
}

// 获取搜索数据
const getClothesSearchData = async () => {
  const wardrobe_id: number[] = []
  if (filter_list.value.wardrobe_id.length > 0) {
    filter_list.value.wardrobe_id.forEach((item) => {
      wardrobe_id.push(Number(item.value))
    })
  }

  const params = {
    filter_list: filter_list1.value,
    page: page.value,
    pageSize: pageSize.value,
    wardrobe_id: wardrobe_id.length > 0 ? wardrobe_id : undefined
  }

  loading.value = true
  try {
    const res = await getClothesSearch(params)
    const data = res.rows
    total.value = res.count
    if (params.page === 1) {
      list.value = data
    } else {
      list.value.push(...data)
    }
  } catch (error) {
    console.error('搜索失败:', error)
    toast.add({
      title: '搜索失败',
      type: 'error'
    })
  } finally {
    loading.value = false
  }
}

// 重新加载
const reload = () => {
  page.value = 1
  filter_list1.value = formatFilterList()
  getClothesSearchData()
}

// 格式化日期
const formatDate = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  try {
    return dayjs(dateStr).format('YYYY-MM-DD')
  } catch {
    return String(dateStr)
  }
}

// 显示模态框
const showModel = () => {
  show.value = true
  if (props.canChoose) {
    handleSearch()
  }
}

// 关闭模态框
const closeModel = () => {
  show.value = false
  initData()
}

// 初始化数据
const initData = () => {
  list.value = []
  filter_list.value = {
    wardrobe_id: [],
    color: [],
    times: {
      start_times: null,
      end_times: null
    },
    price: {
      start_price: null,
      end_price: null
    },
    original_price: {
      start: null,
      end: null
    },
    offer_price: {
      start: null,
      end: null
    },
    season: [],
    clothes_note: '',
    size: '',
    wardrobe_status: [],
    clothes_part: [],
    note: '',
    tags: []
  }
  origin_shop.value = undefined
  filter_list1.value = []
  page.value = 1
  total.value = 0
}

// 暴露方法
defineExpose({
  showModel,
  closeModel
})

// 初始化 uni
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })
})

// 监听衣柜列表变化
watch(() => props.wardrobeList, () => {
  // 衣柜列表变化时的处理
}, { deep: true })
</script>

<style scoped>
.clothes-cover {
  width: 100px;
  height: 100px;
  overflow: hidden;
  border-radius: 10px;
  box-shadow: 1px 1px 10px rgba(0, 0, 0, 0.1);
}
</style>

