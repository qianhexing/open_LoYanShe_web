<template>
  <div>
    <!-- 新增图鉴 -->
    <div class="head-seat"></div>
    <div class="add-library">
      <div class="mb-6 flex justify-center">
        <UButton color="primary" size="lg" icon="i-heroicons-chat-bubble-left-right" @click="joinQQGroup"
          class="rounded-full">
          加入交流QQ群
        </UButton>
      </div>
      <UForm ref="libraryForm" :state="library" :rules="rules" class="space-y-6">
        <UFormGroup :label="t('addLibrary.parent_id')" name="parent_id"
          v-if="library.library_type !== '系列' && shouldShowField('parent_id')" :class="getHighlightClass('parent_id')">
          <div class="flex items-center gap-2">
            <QhxTag v-if="library.parent_id">
              {{ library.parent_id.name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.parent_id = undefined" />
            </QhxTag>
            <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showSelectLibrary()">{{
              t('addLibrary.select_library') }}</UButton>
          </div>
          <div v-if="isReviewMode && isFieldChanged('parent_id')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('parent_id')
              || t('addLibrary.empty') }}
          </div>
        </UFormGroup>
        <clientOnly>
          <UFormGroup :label="t('addLibrary.shop_id')" name="shop_id" required v-if="shouldShowField('shop_id')"
            :class="getHighlightClass('shop_id')">
            <div class="flex items-center">
              <USelectMenu v-model="library.shop_id" :disabled="isReviewMode" :loading="loading"
                :searchable="fetchShopOptiosns" :placeholder="t('addLibrary.search_shop_placeholder')"
                option-attribute="shop_name" :multiple="false" trailing by="shop_id" name="shop_name" class="flex-1"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' },
                  color: {
                    white: {
                      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                    }
                  }
                }" />
              <QhxJellyButton v-if="!isReviewMode">
                <div
                  class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                  @click="library.shop_id = undefined">
                  <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
                </div>
              </QhxJellyButton>
            </div>
            <div v-if="isReviewMode && isFieldChanged('shop_id')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('shop_id')
                || t('addLibrary.empty') }}
            </div>
          </UFormGroup>
        </clientOnly>
        <UFormGroup :label="t('addLibrary.name')" name="name" required v-if="shouldShowField('name')"
          :class="getHighlightClass('name')">
          <UInput v-model="library.name" :disabled="isReviewMode" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" :placeholder="t('addLibrary.name_placeholder')" />
          <div v-if="!isReviewMode && nameMaybeExists && !library_id" class="mt-2 text-sm text-red-500">
            请注意该图鉴可能已经收录过
          </div>
          <div v-if="isReviewMode && isFieldChanged('name')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('name') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.library_type')" name="library_type" required
          v-if="shouldShowField('library_type')" :class="getHighlightClass('library_type')">
          <div v-if="!isReviewMode">
            <div v-if="library.library_type" class="mb-2">
              <QhxTag>
                {{ library.library_type }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                  @click="library.library_type = undefined" />
              </QhxTag>
            </div>
            <UButton type="button" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-1"
              :loading="loading" @click="(e: MouseEvent) => openLibraryTypeSelect(e)">
              {{ library.library_type ? t('addLibrary.reselect') : t('addLibrary.library_type_placeholder') }}
            </UButton>
          </div>
          <div v-else
            class="px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-h-[38px] flex items-center">
            <span class="text-sm text-gray-900 dark:text-gray-100">
              {{ library.library_type || t('addLibrary.library_type_placeholder') }}
            </span>
          </div>
          <QhxSelect ref="libraryTypeSelectRef" :options="libraryTypeQhxOptions" @select="onLibraryTypeSelect" />
          <div v-if="isReviewMode && isFieldChanged('library_type')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('library_type') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.state')" name="state" required v-if="shouldShowField('state')"
          :class="getHighlightClass('state')">
          <div v-if="!isReviewMode">
            <div v-if="library.state" class="mb-2">
              <QhxTag>
                {{ library.state }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                  @click="library.state = undefined" />
              </QhxTag>
            </div>
            <UButton type="button" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-1"
              @click="(e: MouseEvent) => openStateSelect(e)">
              {{ library.state ? t('addLibrary.reselect') : t('addLibrary.state_placeholder') }}
            </UButton>
          </div>
          <div v-else
            class="px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-h-[38px] flex items-center">
            <span class="text-sm text-gray-900 dark:text-gray-100">
              {{ library.state || t('addLibrary.state_placeholder') }}
            </span>
          </div>
          <QhxSelect ref="stateSelectRef" :options="stateQhxOptions" @select="onStateSelect" />
          <div v-if="isReviewMode && isFieldChanged('state')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('state') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>
        <UFormGroup :label="t('addLibrary.start_time')" name="start_time"
          v-if="library.state === '预约中' && shouldShowField('start_time')" required
          :class="getHighlightClass('start_time')">
          <!-- <UInput
            v-model="library.start_time"
            type="text"
            placeholder="开始日期"
          /> -->
          <VueDatePicker v-model="library.start_time" :disabled="isReviewMode" :enable-time-picker="true" :range="true"
            format="MM/dd/yyyy" />
          <div v-if="isReviewMode && isFieldChanged('start_time')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('start_time')
              || t('addLibrary.empty') }} {{ originalLibrary?.end_time ? ' - ' +
              dayjs(originalLibrary.end_time).format('YYYY-MM-DD HH:mm') : '' }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.arrears_start')" name="arrears_start"
          v-if="library.state === '尾款中' && shouldShowField('arrears_start')" required
          :class="getHighlightClass('arrears_start')">
          <VueDatePicker v-model="library.arrears_start" :disabled="isReviewMode" :enable-time-picker="true"
            :range="true" format="MM/dd/yyyy" />
          <div v-if="isReviewMode && isFieldChanged('arrears_start')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('arrears_start') || t('addLibrary.empty') }} {{ originalLibrary?.arrears_end ? ' - ' +
              dayjs(originalLibrary.arrears_end).format('YYYY-MM-DD HH:mm') : '' }}
          </div>
        </UFormGroup>
        <UFormGroup :label="t('addLibrary.cover')" v-if="shouldShowField('cover')" :class="getHighlightClass('cover')">
          <QhxImagePicker :multiple="false" ref="coverRef" :disabled="isReviewMode" />
          <div v-if="isReviewMode && isFieldChanged('cover')" class="mt-2">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              <div v-for="(img, index) in getOriginalImages('cover')" :key="index" class="relative">
                <img :src="BASE_IMG + img" :alt="t('addLibrary.original_cover')"
                  class="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600" />
              </div>
              <div v-if="getOriginalImages('cover').length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('addLibrary.empty') }}
              </div>
            </div>
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.main_style')" name="main_style" required v-if="shouldShowField('main_style')"
          :class="getHighlightClass('main_style')">
          <div class="flex items-center m-1" v-if="library.main_style && library.main_style.length > 0">
            <QhxTag v-for="(item, index) in library.main_style" :key="item">
              {{main_style_options.find((child) => { return child.value === item })?.label}}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.main_style.splice(index, 1)" />
            </QhxTag>
          </div>
          <div class="flex items-center m-1" v-if="library.theme && library.theme.length > 0">
            <QhxTag v-for="(item, index) in library.theme" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.theme.splice(index, 1)" />
            </QhxTag>
          </div>

          <!-- <USelectMenu v-model="library.main_style" :disabled="isReviewMode" :options="main_style_options"
            :placeholder="t('addLibrary.main_style_placeholder')" multiple class="w-1/2 min-w-[200px]"
            value-attribute="value" option-attribute="label" :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }" /> -->
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showChooseWiki('main_style')">{{
            t('addLibrary.main_style') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('main_style')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('main_style')
              || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.price')" v-if="shouldShowField('library_price')"
          :class="getHighlightClass('library_price')">
          <UInput v-model="library.library_price" :disabled="isReviewMode" type="number"
            :placeholder="t('addLibrary.price_placeholder')" class="w-36" :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }" />
          <div v-if="isReviewMode && isFieldChanged('library_price')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('library_price') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.theme')" v-if="shouldShowField('theme')" :class="getHighlightClass('theme')">
          <div class="flex items-center m-1" v-if="library.theme && library.theme.length > 0">
            <QhxTag v-for="(item, index) in library.theme" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.theme.splice(index, 1)" />
            </QhxTag>
          </div>
          <div v-if="!isReviewMode" class="flex gap-2">
            <UButton color="primary" size="sm" @click="showChooseWiki('theme')">{{
              t('addLibrary.select_theme') }}</UButton>
            <customInput @insert="(tag) => { 
              if (!library.theme) {
                library.theme = []
              }
              const index = library.theme.findIndex((child: Wiki) => { return child.wiki_name === tag })
              if (index === -1) {
                library.theme.push({
                  wiki_name: tag,
                  wiki_id: tag
                })
              }
            }" ref="themeCustomInputRef"></customInput>
            <UButton color="primary" size="sm" @click="(e: MouseEvent) => { openThemeCustomInput(e) }">
              添加自定义标签
            </UButton>
          </div>
          <div v-if="isReviewMode && isFieldChanged('theme')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('theme') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>
        <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="chooseWiki" />
        <UFormGroup :label="t('addLibrary.library_pattern')" v-if="shouldShowField('library_pattern')"
          :class="getHighlightClass('library_pattern')">
          <div class="flex items-center m-1" v-if="library.library_pattern && library.library_pattern.length > 0">
            <QhxTag v-for="(item, index) in library.library_pattern" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.library_pattern.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showChooseWiki('library_pattern')">{{
            t('addLibrary.select_pattern') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('library_pattern')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('library_pattern') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.color')" v-if="shouldShowField('color')" :class="getHighlightClass('color')">
          <div class="flex items-center m-1" v-if="library.color && library.color.length > 0">
            <QhxTag v-for="(item, index) in library.color" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.color.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showChooseWiki('color')">{{
            t('addLibrary.select_color') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('color')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('color') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.size_image')" v-if="shouldShowField('size_image')"
          :class="getHighlightClass('size_image')">
          <QhxImagePicker :multiple="true" ref="sizeImageRef" :disabled="isReviewMode" />
          <div v-if="isReviewMode && isFieldChanged('size_image')" class="mt-2">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              <div v-for="(img, index) in getOriginalImages('size_image')" :key="index" class="relative">
                <img :src="BASE_IMG + img" :alt="t('addLibrary.original_size')"
                  class="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600" />
              </div>
              <div v-if="getOriginalImages('size_image').length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('addLibrary.empty') }}
              </div>
            </div>
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.pattern_elements')" v-if="shouldShowField('pattern_elements')"
          :class="getHighlightClass('pattern_elements')">
          <div class="flex items-center m-1" v-if="library.pattern_elements && library.pattern_elements.length > 0">
            <QhxTag v-for="(item, index) in library.pattern_elements" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.pattern_elements.splice(index, 1)" />
            </QhxTag>
          </div>
          <div v-if="!isReviewMode" class="flex gap-2">
            <UButton color="primary" size="sm" @click="showChooseWiki('pattern_elements')">{{
              t('addLibrary.select_pattern_elements') }}</UButton>
            <customInput @insert="(tag) => { 
              if (!library.pattern_elements) {
                library.pattern_elements = []
              }
              const index = library.pattern_elements.findIndex((child: Wiki) => { return child.wiki_name === tag })
              if (index === -1) {
                library.pattern_elements.push({
                  wiki_name: tag,
                  wiki_id: tag
                })
              }
            }" ref="patternElementsCustomInputRef"></customInput>
            <UButton color="primary" size="sm" @click="(e: MouseEvent) => { openPatternElementsCustomInput(e) }">
              添加自定义标签
            </UButton>
          </div>
          <div v-if="isReviewMode && isFieldChanged('pattern_elements')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('pattern_elements') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.design_elements')" v-if="shouldShowField('design_elements')"
          :class="getHighlightClass('design_elements')">
          <div class="flex items-center m-1" v-if="library.design_elements && library.design_elements.length > 0">
            <QhxTag v-for="(item, index) in library.design_elements" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.design_elements.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showChooseWiki('design_elements')">{{
            t('addLibrary.select_design_elements') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('design_elements')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('design_elements') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.fabric_composition')" v-if="shouldShowField('fabric_composition')"
          :class="getHighlightClass('fabric_composition')">
          <div class="flex flex-wrap gap-2 mb-2">
            <QhxTag v-for="(item, index) in library.fabric_composition" :key="index">
              {{ item.value + '%' + item.name.label }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.fabric_composition.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showComposition = true">{{
            t('addLibrary.select_fabric_composition') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('fabric_composition')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('fabric_composition') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.cloth_elements')" v-if="shouldShowField('cloth_elements')"
          :class="getHighlightClass('cloth_elements')">
          <div class="flex items-center m-1" v-if="library.cloth_elements && library.cloth_elements.length > 0">
            <QhxTag v-for="(item, index) in library.cloth_elements" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.cloth_elements.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showChooseWiki('cloth_elements')">{{
            t('addLibrary.select_cloth_elements') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('cloth_elements')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('cloth_elements') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.secondary_cloth')" v-if="shouldShowField('secondary_cloth')"
          :class="getHighlightClass('secondary_cloth')">
          <div class="flex items-center m-1" v-if="library.secondary_cloth && library.secondary_cloth.length > 0">
            <QhxTag v-for="(item, index) in library.secondary_cloth" :key="item.wiki_id">
              {{ item.wiki_name }}
              <UIcon v-if="!isReviewMode" name="i-heroicons-x-mark" class="ml-1 text-sm cursor-pointer"
                @click="library.secondary_cloth.splice(index, 1)" />
            </QhxTag>
          </div>
          <UButton v-if="!isReviewMode" color="primary" size="sm" @click="showChooseWiki('secondary_cloth')">{{
            t('addLibrary.select_secondary_cloth') }}</UButton>
          <div v-if="isReviewMode && isFieldChanged('secondary_cloth')"
            class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{
              getOriginalValueText('secondary_cloth') || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.notes')" v-if="shouldShowField('notes')" :class="getHighlightClass('notes')">
          <UTextarea v-model="library.notes" :disabled="isReviewMode" :placeholder="t('addLibrary.notes_placeholder')"
            :rows="3" :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }" />
          <div v-if="isReviewMode && isFieldChanged('notes')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('notes') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.sale_time')" v-if="shouldShowField('sale_time')"
          :class="getHighlightClass('sale_time')">
          <div class="w-1/2 min-w-[200px]">
            <VueDatePicker v-model="library.sale_time" :disabled="isReviewMode" :enable-time-picker="false"
              :range="false" format="MM/yyyy" MenuView="month" month-picker type="month" mode="month" :locale="zhCN" />
          </div>
          <div v-if="isReviewMode && isFieldChanged('sale_time')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('sale_time')
              || t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.season')" v-if="shouldShowField('season')"
          :class="getHighlightClass('season')">
          <USelectMenu v-model="library.season" :disabled="isReviewMode" :options="season_options"
            :placeholder="t('addLibrary.season_placeholder')" multiple class="w-1/2 min-w-[200px]"
            value-attribute="value" option-attribute="label" :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }" />
          <div v-if="isReviewMode && isFieldChanged('season')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('season') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.link')" v-if="shouldShowField('link')" :class="getHighlightClass('link')">
          <UInput v-model="library.link" :disabled="isReviewMode" :placeholder="t('addLibrary.link_placeholder')" :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }" />
          <div v-if="isReviewMode && isFieldChanged('link')" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>{{ getOriginalValueText('link') ||
              t('addLibrary.empty') }}
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.detail_image')" v-if="shouldShowField('detail_image')"
          :class="getHighlightClass('detail_image')">
          <QhxImagePicker :multiple="true" ref="detailImageRef" :disabled="isReviewMode" />
          <div v-if="isReviewMode && isFieldChanged('detail_image')" class="mt-2">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              <div v-for="(img, index) in getOriginalImages('detail_image')" :key="index" class="relative">
                <img :src="BASE_IMG + img" :alt="t('addLibrary.original_detail')"
                  class="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600" />
              </div>
              <div v-if="getOriginalImages('detail_image').length === 0"
                class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('addLibrary.empty') }}
              </div>
            </div>
          </div>
        </UFormGroup>

        <UFormGroup :label="t('addLibrary.quality_test')" v-if="shouldShowField('quality_test')"
          :class="getHighlightClass('quality_test')">
          <QhxImagePicker :multiple="true" ref="qualityImageRef" :disabled="isReviewMode" />
          <div v-if="isReviewMode && isFieldChanged('quality_test')" class="mt-2">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span class="font-semibold">{{ t('addLibrary.original_value') }}</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              <div v-for="(img, index) in getOriginalImages('quality_test')" :key="index" class="relative">
                <img :src="BASE_IMG + img" :alt="t('addLibrary.original_quality')"
                  class="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600" />
              </div>
              <div v-if="getOriginalImages('quality_test').length === 0"
                class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('addLibrary.empty') }}
              </div>
            </div>
          </div>
        </UFormGroup>

        <LibraryChoose ref="chooseLibraryRef" @choose="chooseLibrary" />
        <!-- :filter_list="[{ field: 'library_type', value: '系列', op: 'and' }]" -->

        <UModal v-model="showComposition" :ui="{ width: 'max-w-4xl' }">
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">{{ t('addLibrary.add_composition') }}</h3>
            </template>

            <UForm :state="fabric_composition" class="space-y-4">
              <UFormGroup :label="t('addLibrary.fabric_composition')">
                <USelectMenu v-model="fabric_composition.name" by="value" name="label"
                  :placeholder="t('addLibrary.fabric_composition_placeholder')" :searchable="getFabricComposition"
                  :loading="loading" class="w-1/2 min-w-[200px]" :ui="{
                    base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                    rounded: 'rounded-full',
                    padding: { xs: 'px-4 py-2' },
                    color: {
                      white: {
                        outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                      }
                    }
                  }" />
              </UFormGroup>

              <UFormGroup :label="t('addLibrary.fabric_percentage')">
                <div class="space-y-2">
                  <URange v-model="fabric_composition.value" :max="100" />
                  <div class="text-center">{{ fabric_composition.value }}</div>
                  <div class="text-sm text-gray-500 text-center">{{ t('addLibrary.unknown_percentage') }}</div>
                </div>
              </UFormGroup>
            </UForm>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton @click="showComposition = false">{{ t('addLibrary.cancel') }}</UButton>
                <UButton color="primary" @click="addFabricComposition()">{{ t('addLibrary.confirm') }}</UButton>
              </div>
            </template>
          </UCard>
        </UModal>

        <div class="flex justify-center pt-6">
          <template v-if="isReviewMode">
            <UButton v-if="!loading" color="primary" size="lg" @click="showReviewModal = true">
              {{ t('addLibrary.review') }}
            </UButton>
            <UButton v-else color="red" size="lg" disabled>{{ t('addLibrary.requesting') }}</UButton>
          </template>
          <template v-else>
            <UButton v-if="!loading" color="primary" size="lg" @click="add()">
              {{ library_id ? t('addLibrary.update') : t('addLibrary.upload') }}
            </UButton>
            <UButton v-else color="red" size="lg" disabled>{{ t('addLibrary.requesting') }}</UButton>
          </template>
        </div>
      </UForm>
    </div>
    <!-- 操作确认 -->
    <UModal v-model="showConfirmLibrary" :ui="{ width: 'max-w-4xl' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">{{ t('addLibrary.confirm_copy_title') }}</h3>
        </template>
        <div class="flex justify-end gap-2">
          <UButton @click="showConfirmLibrary = false">{{ t('addLibrary.cancel') }}</UButton>
          <UButton color="primary" @click="copyLibraryInfo()">{{ t('addLibrary.confirm') }}</UButton>
        </div>
      </UCard>
    </UModal>

    <!-- 审核弹窗 -->
    <UModal v-model="showReviewModal" :ui="{ width: 'max-w-2xl' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">{{ t('addLibrary.review_title') }}</h3>
        </template>

        <UForm :state="reviewForm" class="space-y-4">
          <UFormGroup :label="t('addLibrary.review_result')" required>
            <div class="flex gap-4">
              <UButton :color="reviewForm.status === 'approved' ? 'green' : 'gray'"
                :variant="reviewForm.status === 'approved' ? 'solid' : 'outline'"
                @click="reviewForm.status = 'approved'">
                {{ t('addLibrary.review_approved') }}
              </UButton>
              <UButton :color="reviewForm.status === 'rejected' ? 'red' : 'gray'"
                :variant="reviewForm.status === 'rejected' ? 'solid' : 'outline'"
                @click="reviewForm.status = 'rejected'">
                {{ t('addLibrary.review_rejected') }}
              </UButton>
            </div>
          </UFormGroup>

          <UFormGroup :label="t('addLibrary.review_suggestion')">
            <UTextarea v-model="reviewForm.suggestion" :placeholder="t('addLibrary.review_suggestion_placeholder')"
              :rows="4" :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }" />
          </UFormGroup>
        </UForm>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton @click="showReviewModal = false">{{ t('addLibrary.cancel') }}</UButton>
            <UButton color="primary" :disabled="!reviewForm.status || reviewLoading" @click="submitReview()">
              {{ reviewLoading ? t('addLibrary.submitting') : t('addLibrary.confirm') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Library, Shop, Wiki } from '~/types/api'
// 导入API函数（需要您自己实现）
// import { getShopOptionsByKeywords } from '@/api/shop'
import { getWikiOptions, getWikiOptionsByKeywords } from '@/api/wiki'
import { insertLibrary, type InsertParams, getLibraryById, type LibraryHistoryNew, updateLibrary, getLibraryReviewData, type ReviewData, submitLibraryReview, cheackLibraryName } from '@/api/library'
// updateLibrary, 
// import compressImage from '@/utils/compressImage'
// import uploadImage from '@/utils/uploadImage'
// import { formatDate } from '@/plugins/public'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import { getShopOptiosns, getShopDetail } from '@/api/shop'
import { zhCN } from "date-fns/locale"
import { uploadImageUrl } from '@/api'
import { uploadFileToOSS, uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
const { t } = useI18n()
let uni: any;
const showConfirmLibrary = ref(false)
// 定义组件
const LibraryChoose = defineAsyncComponent(() => import('~/components/library/LibraryChoose.vue'))
const customInput = defineAsyncComponent(() => import('~/components/Clothes/customInput.vue'))

interface FileItem {
  file?: File
  url: string
  uid: number
}

interface FabricComposition {
  name: {
    label: string
    value: number
  }
  value: number
}

interface LibraryItem {
  library_id: number
  name: string
}

// 响应式数据
const fabric_composition = ref<FabricComposition>({
  name: {
    label: '',
    value: 0
  },
  value: 0
}) // 成分表格
interface OptionItem { value: number; label: string }
const showComposition = ref(false) // 显示选择布料
const library_id = ref<number | null>(null) // 初始化的图鉴ID用于修改
const loading = ref(false)
const showReviewModal = ref(false) // 显示审核弹窗
const reviewLoading = ref(false) // 审核提交中
const reviewForm = ref({
  status: '' as 'approved' | 'rejected' | '',
  suggestion: ''
})
const shop_options = ref<Shop[]>([])
const library_type_options = ref<Wiki[]>([])
const fabric_composition_options = ref<Wiki[]>([])
const state_options = ['预约中', '现货在售', '完售展示', '上新图透']
const season_options = [{ value: '春', label: '春' }, { value: '夏', label: '夏' }, { value: '秋', label: '秋' }, { value: '冬', label: '冬' }]
const main_style_options = ref<OptionItem[]>([])
const pattern_elements_options = ref<Wiki[]>([])
const design_elements_options = ref<Wiki[]>([])
const cloth_elements_options = ref<Wiki[]>([])
const color_options = ref<Wiki[]>([])
const library_pattern_options = ref<Wiki[]>([])
const theme_options = ref<Wiki[]>([])
const fileList = ref<FileItem[]>([])
const cover = ref<FileItem[]>([])
const size_image = ref<FileItem[]>([])
const disabled = ref(false)
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const wikiOptionsChooseRef = ref()
const wiki_type = ref<string | null>(null)
const layoutReady = ref(false)
provide('layoutReady', layoutReady)

// 图鉴名称是否可能已存在
const nameMaybeExists = ref(false)
const checkingName = ref(false)

// 审核模式相关
const isReviewMode = ref(false) // 是否为审核模式
const reviewData = ref<Library | null>(null) // 修改后的数据
const originalLibrary = ref<Library | null>(null) // 原始图鉴数据
const changedFields = ref<Set<string>>(new Set()) // 被修改的字段集合

// 检查字段是否应该显示（审核模式下只显示被修改的字段）
const shouldShowField = (fieldName: string) => {
  if (!isReviewMode.value) return true
  return changedFields.value.has(fieldName)
}

// 检查字段是否被修改（用于高亮显示）
const isFieldChanged = (fieldName: string) => {
  return isReviewMode.value && changedFields.value.has(fieldName)
}

// 获取高亮样式类
const getHighlightClass = (fieldName: string) => {
  if (isFieldChanged(fieldName)) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-lg border-2 border-yellow-400 dark:border-yellow-600'
  }
  return ''
}

// 获取字段的原始值显示文本（用于标注）
const getOriginalValueText = (fieldName: string): string => {
  if (!isReviewMode.value || !originalLibrary.value) return ''

  const original = originalLibrary.value

  switch (fieldName) {
    case 'name':
      return original.name || ''
    case 'library_type':
      return original.library_type || ''
    case 'state':
      return original.state || ''
    case 'shop_id':
      return original.shop?.shop_name || ''
    case 'library_price':
      return original.library_price ? `¥${original.library_price}` : ''
    case 'size':
      return original.size || ''
    case 'link':
      return original.link || ''
    case 'notes':
      return original.notes || ''
    case 'sale_time':
      return original.sale_time ? dayjs(original.sale_time).format('YYYY-MM') : ''
    case 'season':
      return original.season || ''
    case 'start_time':
      return original.start_time ? dayjs(original.start_time).format('YYYY-MM-DD HH:mm') : ''
    case 'end_time':
      return original.end_time ? dayjs(original.end_time).format('YYYY-MM-DD HH:mm') : ''
    case 'arrears_start':
      return original.arrears_start ? dayjs(original.arrears_start).format('YYYY-MM-DD HH:mm') : ''
    case 'arrears_end':
      return original.arrears_end ? dayjs(original.arrears_end).format('YYYY-MM-DD HH:mm') : ''
    case 'parent_id':
      return original.parent?.name || ''
    case 'theme':
      return original.theme || ''
    case 'color':
      return original.color || ''
    case 'pattern_elements':
      return original.pattern_elements || ''
    case 'design_elements':
      return original.design_elements || ''
    case 'cloth_elements':
      return original.cloth_elements || ''
    case 'secondary_cloth':
      return original.secondary_cloth || ''
    case 'library_pattern':
      return original.library_pattern || ''
    case 'fabric_composition':
      return original.fabric_composition || ''
    case 'main_style':
      return original.style_list ? original.style_list.map((item: Wiki) => item.wiki_name).join(', ') : ''
    default:
      return ''
  }
}

// 获取图片字段的原始图片列表
const getOriginalImages = (fieldName: string): string[] => {
  if (!isReviewMode.value || !originalLibrary.value) return []

  const original = originalLibrary.value

  switch (fieldName) {
    case 'cover':
      return original.cover ? [original.cover] : []
    case 'size_image':
      return original.size_image ? original.size_image.split(',') : []
    case 'detail_image':
      return original.detail_image ? original.detail_image.split(',') : []
    case 'quality_test':
      return original.quality_test ? original.quality_test.split(',') : []
    default:
      return []
  }
}

const library = ref({
  name: '',
  shop_id: undefined as Shop | undefined,
  main_style: undefined as number[] | undefined,
  library_type: undefined as string | undefined,
  size: '',
  pattern_elements: [] as Wiki[],
  design_elements: [] as Wiki[],
  cloth_elements: [] as Wiki[],
  state: undefined as string | undefined,
  start_time: undefined as string[] | undefined,
  arrears_start: undefined as string | undefined,
  secondary_cloth: [] as Wiki[],
  sale_time: undefined as { year: number, month: number } | undefined,
  notes: '',
  season: undefined as string[] | undefined,
  library_price: undefined as number | undefined,
  color: [] as Wiki[],
  link: undefined as string | undefined,
  parent_id: undefined as Library | undefined,
  theme: [] as Wiki[],
  library_pattern: [] as Wiki[],
  fabric_composition: [] as FabricComposition[] // 成分
})

// 检查图鉴名称是否可能已收录
watch(
  () => [library.value.name, library.value.shop_id],
  async ([name, shop]) => {
    if (!name || isReviewMode.value) {
      nameMaybeExists.value = false
      return
    }

    try {
      checkingName.value = true
      const exists = await cheackLibraryName({
        name,
        // shop_id 可能为对象，取其 id，如果没有则传 null
        shop_id: shop && 'shop_id' in shop ? (shop as Shop).shop_id : null
      })
      nameMaybeExists.value = exists
    } catch (error) {
      console.error('检查图鉴名称是否已存在失败:', error)
      // 出错时不阻断用户操作，仅隐藏提示
      nameMaybeExists.value = false
    } finally {
      checkingName.value = false
    }
  }
)

const rules = computed(() => ({
  name: [
    { required: true, message: t('addLibrary.name_placeholder') }
  ],
  library_type: [
    { required: true, message: t('addLibrary.library_type_placeholder') }
  ],
  shop_id: [
    { required: true, message: t('addLibrary.search_shop_placeholder') }
  ],
  main_style: [
    { required: true, message: t('addLibrary.main_style_placeholder') }
  ],
  state: [
    { required: true, message: t('addLibrary.state_placeholder') }
  ],
  start_time: [
    { required: true, message: t('addLibrary.start_time') }
  ]
}))

// 模板引用
const libraryForm = ref()
const chooseLibraryRef = ref()
const sizeImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const coverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const detailImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const qualityImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const libraryTypeSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const stateSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const themeCustomInputRef = ref()
const patternElementsCustomInputRef = ref()

const libraryTypeQhxOptions = computed(() =>
  (library_type_options.value as any[]).map((item: any) => ({
    label: item.label ?? item.wiki_name,
    value: item.value ?? item.wiki_id
  }))
)

const stateQhxOptions = computed(() =>
  (config.value?.library_state || []).map(item => ({
    label: item.label,
    value: item.value
  }))
)

const openLibraryTypeSelect = (e: MouseEvent) => {
  if (isReviewMode.value) return
  libraryTypeSelectRef.value?.showPicker(e)
}

const openStateSelect = (e: MouseEvent) => {
  if (isReviewMode.value) return
  stateSelectRef.value?.showPicker(e)
}

const onLibraryTypeSelect = (option: { label: string; value: string | number }) => {
  library.value.library_type = option.label
}

const onStateSelect = (option: { label: string; value: string | number }) => {
  library.value.state = option.label
}

const openThemeCustomInput = (e: MouseEvent) => {
  if (isReviewMode.value) return
  themeCustomInputRef.value?.showModel(e)
}

const openPatternElementsCustomInput = (e: MouseEvent) => {
  if (isReviewMode.value) return
  patternElementsCustomInputRef.value?.showModel(e)
}

// 路由和toast
const route = useRoute()
const toast = useToast()

// 生命周期
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  // 检测审核模式
  if (route.query?.library_id && route.query?.review) {
    isReviewMode.value = true
    library_id.value = Number.parseInt(route.query.library_id as string)
    await fetchLibraryById()
    await fetchReviewData()
  } else if (route.query?.library_id) {
    library_id.value = Number.parseInt(route.query.library_id as string)
    fetchLibraryById()
  }

  getLibraryType()
  getMainStyle()
})
const showChooseWiki = (type: string) => {
  let type_id = 0
  wiki_type.value = type
  const params: { type_id: number } = { type_id: 0 }
  if (type === 'design_elements') {
    type_id = 2
  } else if (type === 'cloth_elements') {
    type_id = 5
  } else if (type === 'secondary_cloth') {
    type_id = 5
  } else if (type === 'theme') {
    type_id = 14
  } else if (type === 'library_pattern') {
    type_id = 1
    // console.log(option.library_type, this.form.library_type)
    // if (this.form.library_type && this.form.library_type !== '系列') {
    // 	const index = this.option.library_type.findIndex((child) => {
    // 		return child.label === this.form.library_type
    // 	})
    // 	if (index !== -1) {
    // 		params.parent_id = this.option.library_type[index].value
    // 	}
    // }
  } else if (type === 'color') {
    type_id = 13
  } else if (type === 'pattern_elements') {
    type_id = 3
  } else if (type === 'main_style') {
    type_id = 4
  }
  params.type_id = type_id
  wikiOptionsChooseRef.value?.showModel(params)
}
const chooseWiki = (wiki_list: Wiki[]) => {
  // biome-ignore lint/complexity/noForEach: <explanation>
  wiki_list.forEach((item: Wiki) => {
    if (wiki_type.value === 'theme') {
      const index = library.value.theme.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.theme.push(item)
      }
    } else if (wiki_type.value === 'library_pattern') {
      const index = library.value.library_pattern.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.library_pattern.push(item)
      }
    } else if (wiki_type.value === 'color') {
      const index = library.value.color.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.color.push(item)
      }
    } else if (wiki_type.value === 'pattern_elements') {
      const index = library.value.pattern_elements.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.pattern_elements.push(item)
      }
    } else if (wiki_type.value === 'design_elements') {
      const index = library.value.design_elements.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.design_elements.push(item)
      }
    } else if (wiki_type.value === 'cloth_elements') {
      const index = library.value.cloth_elements.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.cloth_elements.push(item)
      }
    } else if (wiki_type.value === 'secondary_cloth') {
      const index = library.value.secondary_cloth.findIndex((child: Wiki) => {
        return child.wiki_name === item.wiki_name
      })
      if (index === -1) {
        library.value.secondary_cloth.push(item)
      }
    } else if (wiki_type.value === 'main_style') {
      let index = null
      if (library.value.main_style) {
        index = library.value.main_style.findIndex((child: number) => {
          return child === item.wiki_id
        })
      } else {
        index = -1
      }
      if (index === -1) {
        if (library.value.main_style) {
          library.value.main_style.push(Number(item.wiki_id))
        } else {
          library.value.main_style = [Number(item.wiki_id)]
        }
      }
      console.log(item, 'item', library.value.main_style, index)

    }
  })
}
const shop_options_loading = ref(false)
const fetchShopOptiosns = async (keywords: string) => {
  const params: any = {}
  if (keywords !== '') {
    params.shop_name = keywords
  }
  shop_options_loading.value = true
  const response = await getShopOptiosns(params)
  shop_options.value = response
  let data = []
  if (response.length > 20) {
    data = response.slice(0, 19);
  } else {
    data = response
  }
  return data
}
// 方法定义
const removeFabricComposition = (index: number) => {
  library.value.fabric_composition.splice(index, 1)
}

const addFabricComposition = () => {
  const { name, value } = fabric_composition.value
  if (name.label === '') {
    return false
  }
  const index = library.value.fabric_composition.findIndex((item) => {
    return item.name.label === name.label
  })
  if (index === -1) {
    library.value.fabric_composition.push({
      name, value
    })
  }
  fabric_composition.value.name = {
    label: '',
    value: 0
  }
  fabric_composition.value.value = 0
  showComposition.value = false
}
const fetchLibraryById = async () => {
  if (!library_id.value) {
    return false
  }
  loading.value = true
  const params = {
    library_id: library_id.value
  }
  try {
    const res = await getLibraryById(params)
    console.log(res, '图鉴数据')
    // 保存原始数据用于审核模式对比
    if (isReviewMode.value) {
      originalLibrary.value = { ...res }
    }
    const { theme, style_list, name, library_type, state, shop, parent, library_price, library_pattern, detail_image, color, size, pattern_elements, design_elements, cloth_elements, secondary_cloth, notes, sale_time, season, link, cover, end_time, start_time, size_image, fabric_composition, quality_test } = res
    library.value.name = name

    library.value.library_type = library_type
    library.value.state = state
    library.value.shop_id = shop
    if (style_list && style_list.length > 0) {
      library.value.main_style = style_list.map((item: Wiki) => Number(item.wiki_id))
    } else {
      library.value.main_style = []
    }
    if (theme) {
      library.value.theme = theme.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    library.value.parent_id = parent
    library.value.library_price = library_price
    if (library_pattern) {
      library.value.library_pattern = library_pattern.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (color) {
      library.value.color = color.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    library.value.size = size || ''
    if (pattern_elements) {
      library.value.pattern_elements = pattern_elements.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (design_elements) {
      library.value.design_elements = design_elements.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (cloth_elements) {
      library.value.cloth_elements = cloth_elements.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    if (secondary_cloth) {
      library.value.secondary_cloth = secondary_cloth.split(',').map((item: string) => {
        return {
          wiki_name: item,
          wiki_id: item
        }
      })
    }
    library.value.notes = notes || ''
    if (sale_time) {
      library.value.sale_time = {
        year: dayjs(sale_time).year(),
        month: dayjs(sale_time).month()
      }
    }
    if (season) {
      library.value.season = season.split(',')
    }
    library.value.link = link
    library.value.start_time = [start_time || '', end_time || '']
    console.log(library.value.start_time, '预约时间')
    if (fabric_composition) {
      library.value.fabric_composition = fabric_composition.split(',').map((item: string): FabricComposition => {
        const child = item.split('%')
        if (child.length > 1) {
          return {
            name: {
              label: child[1],
              value: Number(child[0])
            },
            value: Number(child[0])
          }
        }
        return {
          name: {
            label: '',
            value: 0
          },
          value: 0
        }
      })
    }

    if (cover && coverRef.value) {
      coverRef.value.previewImages = [{ file: undefined, url: BASE_IMG + cover }]
    }
    if (size_image && sizeImageRef.value) {
      sizeImageRef.value.previewImages = size_image.split(',').map((item: string) => {
        return { file: undefined, url: BASE_IMG + item }
      })
    }
    if (detail_image && detailImageRef.value) {
      detailImageRef.value.previewImages = detail_image.split(',').map((item: string) => {
        return { file: undefined, url: BASE_IMG + item }
      })
    }
    if (quality_test && qualityImageRef.value) {
      qualityImageRef.value.previewImages = quality_test.split(',').map((item: string) => {
        return { file: undefined, url: BASE_IMG + item }
      })
    }
  } catch (error) {
    console.log(error)
    toast.add({
      title: t('addLibrary.error'),
      description: t('addLibrary.fetch_failed_retry'),
      color: 'red'
    })
    setTimeout(() => {
      fetchLibraryById()
    }, 5000)
  } finally {
    loading.value = false
  }
}

// 获取修改参数（审核模式）
const fetchReviewData = async () => {
  if (!library_id.value || !route.query?.review) {
    return false
  }
  loading.value = true
  const params = {
    library_id: library_id.value,
    review: Number.parseInt(route.query.review as string)
  }
  try {
    // {"link": null, "name": "永远盛开的杏花", "size": null, "color": "绿松石色", "cover": "static/library_app/22936_1766941095808101.JPG", "notes": null, "state": "上新图透", "theme": null, "season": null, "shop_id": 1372, "complete": true, "end_time": null, "edit_user": 1, "parent_id": 0, "sale_time": null, "main_style": "18", "size_image": "editor/33851432b6f9b9fc55e20577036cc4e8.jpg", "start_time": null, "arrears_end": null, "detail_image": "static/image/22936_176694109721826.JPG,static/image/22936_1766941098305108.JPG,static/image/22936_1766941099346104.JPG,static/image/22936_17669411003369.JPG", "library_type": "JSK", "square_cover": "static/library_app/22936_1766941095808101.JPG", "arrears_start": null, "library_price": 388, "cloth_elements": null, "design_elements": null, "library_pattern": null, "secondary_cloth": null, "pattern_elements": "杏花", "fabric_composition": null}
    const res = await getLibraryReviewData(params)
    reviewData.value = res.params
    await compareData()
  } catch (error) {
    console.log(error)
    toast.add({
      title: t('addLibrary.error'),
      description: t('addLibrary.fetch_review_failed'),
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 对比原信息和修改后的信息差异
const compareData = async () => {
  if (!originalLibrary.value || !reviewData.value) {
    return
  }
  changedFields.value.clear()
  const original = originalLibrary.value
  const review = reviewData.value

  // 对比各个字段
  if (original.name !== review.name) changedFields.value.add('name')
  if (original.library_type !== review.library_type) changedFields.value.add('library_type')
  if (original.state !== review.state) changedFields.value.add('state')
  if (original.shop_id !== review.shop_id) changedFields.value.add('shop_id')
  if (original.library_price !== review.library_price) changedFields.value.add('library_price')
  if (original.size !== review.size) changedFields.value.add('size')
  if (original.link !== review.link) changedFields.value.add('link')
  if (original.notes !== review.notes) changedFields.value.add('notes')
  if (original.sale_time !== review.sale_time) changedFields.value.add('sale_time')
  if (original.season !== review.season) changedFields.value.add('season')
  if (original.start_time !== review.start_time) changedFields.value.add('start_time')
  if (original.end_time !== review.end_time) changedFields.value.add('end_time')
  if (original.arrears_start !== review.arrears_start) changedFields.value.add('arrears_start')
  if (original.arrears_end !== review.arrears_end) changedFields.value.add('arrears_end')
  if (original.parent_id !== review.parent_id) changedFields.value.add('parent_id')
  if (original.cover !== review.cover) changedFields.value.add('cover')
  if (original.square_cover !== review.square_cover) changedFields.value.add('square_cover')
  if (original.size_image !== review.size_image) changedFields.value.add('size_image')
  if (original.detail_image !== review.detail_image) changedFields.value.add('detail_image')
  if (original.quality_test !== review.quality_test) changedFields.value.add('quality_test')

  // 对比字符串数组字段（需要转换为数组后对比）
  const compareStringArray = (original: string | undefined, review: string | null) => {
    const orig = original ? original.split(',').sort().join(',') : ''
    const rev = review ? review.split(',').sort().join(',') : ''
    return orig !== rev
  }

  if (compareStringArray(original.theme, review.theme)) changedFields.value.add('theme')
  if (compareStringArray(original.color, review.color)) changedFields.value.add('color')
  if (compareStringArray(original.pattern_elements, review.pattern_elements)) changedFields.value.add('pattern_elements')
  if (compareStringArray(original.design_elements, review.design_elements)) changedFields.value.add('design_elements')
  if (compareStringArray(original.cloth_elements, review.cloth_elements)) changedFields.value.add('cloth_elements')
  if (compareStringArray(original.secondary_cloth, review.secondary_cloth)) changedFields.value.add('secondary_cloth')
  if (compareStringArray(original.library_pattern, review.library_pattern)) changedFields.value.add('library_pattern')
  if (compareStringArray(original.fabric_composition, review.fabric_composition)) changedFields.value.add('fabric_composition')

  // 对比main_style（需要从style_list中提取）
  const originalMainStyle = original.style_list ? original.style_list.map((item: Wiki) => String(item.wiki_id)).sort().join(',') : ''
  const reviewMainStyle = review.main_style ? review.main_style.split(',').sort().join(',') : ''
  if (originalMainStyle !== reviewMainStyle) changedFields.value.add('main_style')

  // 应用修改后的数据到library
  if (reviewData.value) {
    await applyReviewData()
  }
}

// 应用修改后的数据
const applyReviewData = async () => {
  if (!reviewData.value) return

  const review = reviewData.value

  // 只应用被修改的字段
  if (changedFields.value.has('name')) {
    library.value.name = review.name
  }
  if (changedFields.value.has('library_type')) {
    library.value.library_type = review.library_type || undefined
  }
  if (changedFields.value.has('state')) {
    library.value.state = review.state || undefined
  }
  if (changedFields.value.has('shop_id') && review.shop_id) {
    // 根据shop_id查找shop对象
    try {
      const shop = await getShopDetail({ shop_id: review.shop_id })
      library.value.shop_id = shop
    } catch (error) {
      console.error('获取店铺信息失败:', error)
      library.value.shop_id = undefined
    }
  }
  if (changedFields.value.has('library_price')) {
    library.value.library_price = review.library_price || undefined
  }
  if (changedFields.value.has('size')) {
    library.value.size = review.size || ''
  }
  if (changedFields.value.has('link')) {
    library.value.link = review.link || undefined
  }
  if (changedFields.value.has('notes')) {
    library.value.notes = review.notes || ''
  }
  if (changedFields.value.has('sale_time') && review.sale_time) {
    library.value.sale_time = {
      year: dayjs(review.sale_time).year(),
      month: dayjs(review.sale_time).month()
    }
  }
  if (changedFields.value.has('season') && review.season) {
    library.value.season = review.season.split(',')
  }
  if (changedFields.value.has('start_time') || changedFields.value.has('end_time')) {
    library.value.start_time = [review.start_time || '', review.end_time || '']
  }
  if (changedFields.value.has('arrears_start') || changedFields.value.has('arrears_end')) {
    library.value.arrears_start = review.arrears_start ? [review.arrears_start, review.arrears_end || ''] as string[] : undefined
  }
  if (changedFields.value.has('theme') && review.theme) {
    library.value.theme = review.theme.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('color') && review.color) {
    library.value.color = review.color.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('pattern_elements') && review.pattern_elements) {
    library.value.pattern_elements = review.pattern_elements.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('design_elements') && review.design_elements) {
    library.value.design_elements = review.design_elements.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('cloth_elements') && review.cloth_elements) {
    library.value.cloth_elements = review.cloth_elements.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('secondary_cloth') && review.secondary_cloth) {
    library.value.secondary_cloth = review.secondary_cloth.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('library_pattern') && review.library_pattern) {
    library.value.library_pattern = review.library_pattern.split(',').map((item: string) => ({
      wiki_name: item,
      wiki_id: item
    }))
  }
  if (changedFields.value.has('fabric_composition') && review.fabric_composition) {
    library.value.fabric_composition = review.fabric_composition.split(',').map((item: string): FabricComposition => {
      const child = item.split('%')
      if (child.length > 1) {
        return {
          name: {
            label: child[1],
            value: Number(child[0])
          },
          value: Number(child[0])
        }
      }
      return {
        name: {
          label: '',
          value: 0
        },
        value: 0
      }
    })
  }
  if (changedFields.value.has('main_style') && review.main_style) {
    library.value.main_style = review.main_style.split(',').map((item: string) => Number(item))
  }
  if (changedFields.value.has('cover') && review.cover && coverRef.value) {
    coverRef.value.previewImages = [{ file: undefined, url: BASE_IMG + review.cover }]
  }
  if (changedFields.value.has('size_image') && review.size_image && sizeImageRef.value) {
    sizeImageRef.value.previewImages = review.size_image.split(',').map((item: string) => ({
      file: undefined,
      url: BASE_IMG + item
    }))
  }
  if (changedFields.value.has('detail_image') && review.detail_image && detailImageRef.value) {
    detailImageRef.value.previewImages = review.detail_image.split(',').map((item: string) => ({
      file: undefined,
      url: BASE_IMG + item
    }))
  }
  if (changedFields.value.has('quality_test') && review.quality_test && qualityImageRef.value) {
    qualityImageRef.value.previewImages = review.quality_test.split(',').map((item: string) => ({
      file: undefined,
      url: BASE_IMG + item
    }))
  }
}

const chooseLibrary = (item: Library[]) => {
  console.log('选择的图鉴', item)
  library.value.parent_id = item[0]
  showConfirmLibrary.value = true
}
const copyLibraryInfo = () => {
  if (!library.value.parent_id) {
    toast.add({
      title: t('addLibrary.warning'),
      description: t('addLibrary.select_library_warning'),
      color: 'orange'
    })
    return false
  }
  console.log(library.value.parent_id, '图鉴信息')

  const item: Library = library.value.parent_id
  showConfirmLibrary.value = false
  library.value.name = `${item.name} ${library.value.library_type ? library.value.library_type : ''}`
  if (item.shop) {
    library.value.shop_id = item.shop
  }
  if (item.theme) {
    library.value.theme = item.theme.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.library_pattern) {
    library.value.library_pattern = item.library_pattern.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.color) {
    library.value.color = item.color.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.pattern_elements) {
    library.value.pattern_elements = item.pattern_elements.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.design_elements) {
    library.value.design_elements = item.design_elements.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.cloth_elements) {
    library.value.cloth_elements = item.cloth_elements.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.secondary_cloth) {
    library.value.secondary_cloth = item.secondary_cloth.split(',').map((item: string) => {
      return {
        wiki_name: item,
        wiki_id: item
      }
    })
  }
  if (item.sale_time) {
    library.value.sale_time = {
      year: dayjs(item.sale_time).year(),
      month: dayjs(item.sale_time).month()
    }
  }
  if (item.season) {
    library.value.season = item.season.split(',')
  }
  if (item.notes) {
    library.value.notes = item.notes
  }
  if (item.link) {
    library.value.link = item.link
  }
}
const showSelectLibrary = () => {
  chooseLibraryRef.value?.showModel()
}

const init = () => {
  coverRef.value?.clear()
  sizeImageRef.value?.clear()
  detailImageRef.value?.clear()
  qualityImageRef.value?.clear()
  library.value = {
    name: '',
    shop_id: undefined as Shop | undefined,
    main_style: undefined,
    library_type: undefined,
    size: '',
    pattern_elements: [],
    design_elements: [],
    cloth_elements: [],
    state: undefined,
    start_time: undefined as string[] | undefined,
    arrears_start: undefined,
    secondary_cloth: [],
    sale_time: undefined,
    notes: '',
    season: undefined,
    library_price: undefined,
    color: [],
    link: undefined,
    parent_id: undefined,
    theme: [],
    library_pattern: [],
    fabric_composition: []
  }
}
const getShopOptions = async (query: string) => {
  if (query !== '') {
    loading.value = true
    const params = {
      shop_name: query
    }
    try {
      // const results = await getShopOptionsByKeywords(params)
      // 这里需要您自己实现API调用
      // let data = results.data
      // if (data.length > 0) {
      //   data = data.map((value) => {
      //     return {
      //       value: value.shop_id,
      //       label: value.shop_name
      //     }
      //   })
      // }
      // shop_options.value = data
    } catch (error) {
      console.error('获取店铺选项失败:', error)
    } finally {
      loading.value = false
    }
  } else {
    shop_options.value = []
  }
}

// 获取主要风格
const getMainStyle = async () => {
  const params = {
    type_id: 4
  }
  try {
    const res = await getWikiOptionsByKeywords(params)
    const data = res
    if (data.length > 0) {
      main_style_options.value = data.map((value: Wiki) => {
        return {
          value: value.wiki_id,
          label: value.wiki_name
        }
      })
    }
  } catch (error) {
    console.error('获取主要风格失败:', error)
  }
}
const query = async (type_id: number, queryString: string) => {
  const params = {
    type_id,
    wiki_name: queryString
  }
  try {
    const results = await getWikiOptionsByKeywords(params)
    let data = results
    if (data.length > 0) {
      data = data.map((value: Wiki) => {
        return {
          value: value.wiki_id,
          label: value.wiki_name
        }
      })
    }
    return data
  } catch (error) {
    console.error('查询失败:', error)
    return []
  }
}

const getPatternElements = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(3, queryString)
  pattern_elements_options.value = options
}

const getLibraryPattern = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(1, queryString)
  library_pattern_options.value = options
}

const getColor = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(13, queryString)
  console.log('颜色选项', options)
  color_options.value = options
}

const getTheme = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(14, queryString)
  theme_options.value = options
}

const getFabricComposition = async (queryString: string) => {
  const options = await query(15, queryString)
  console.log('面料成分选项', options)
  fabric_composition_options.value = options
  return options
}

const getLibraryType = async (queryString?: string) => {
  const options = await query(10, queryString || '')
  library_type_options.value = options
}

const getDesignElements = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(2, queryString)
  design_elements_options.value = options
}

const getClothElements = async (queryString: string) => {
  if (queryString === '') {
    return false
  }
  const options = await query(5, queryString)
  cloth_elements_options.value = options
}


const handleExceed = () => {
  toast.add({
    title: t('addLibrary.warning'),
    description: t('addLibrary.max_images_18'),
    color: 'orange'
  })
}

const handleRemove = (file: FileItem) => {
  const index = fileList.value.findIndex((value) => {
    return file.uid === value.uid
  })
  if (index !== -1) {
    fileList.value.splice(index, 1)
  }
  console.log(fileList.value, index)
}


const sizeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files?.[0]) {
    const file = target.files[0]
    const url = URL.createObjectURL(file)
    size_image.value = [{
      file,
      url,
      uid: Date.now() + Math.random()
    }]
  }
}

const coverChange = (file: File[]) => {
  console.log(file)
  // if (file.length > 0) {
  //   const fileItem = file[0]
  //   const url = URL.createObjectURL(file)
  //   cover.value = [{
  //     file: fileItem,
  //     url,
  //     uid: Date.now() + Math.random()
  //   }]
  // }
}

const coverExceed = () => {
  toast.add({
    title: t('addLibrary.warning'),
    description: t('addLibrary.max_images_1'),
    color: 'orange'
  })
}

const sizeRemove = (file: FileItem) => {
  const index = size_image.value.findIndex((value) => {
    return file.uid === value.uid
  })
  if (index !== -1) {
    size_image.value.splice(index, 1)
  }
}

const coverRemove = (file: FileItem) => {
  const index = cover.value.findIndex((value) => {
    return file.uid === value.uid
  })
  if (index !== -1) {
    cover.value.splice(index, 1)
  }
  console.log(fileList.value, index)
}

/**
 * 上传所有图片（并行上传）
 * @returns 返回上传结果对象，包含 coverImage, square_cover, sizeImage, detail_image, quality_test
 */
const uploadAllImages = async () => {
  // 收集所有需要上传的图片
  const uploadTasks: Array<{
    type: 'cover' | 'size' | 'detail' | 'quality'
    index?: number
    image: { file?: File; url: string }
  }> = []

  // 封面图
  if (coverRef.value && coverRef.value.previewImages.length > 0) {
    uploadTasks.push({
      type: 'cover',
      image: coverRef.value.previewImages[0]
    })
  }

  // 尺寸图
  if (sizeImageRef.value && sizeImageRef.value.previewImages.length > 0) {
    sizeImageRef.value.previewImages.forEach((img, index) => {
      uploadTasks.push({
        type: 'size',
        index,
        image: img
      })
    })
  }

  // 详情图
  if (detailImageRef.value && detailImageRef.value.previewImages.length > 0) {
    detailImageRef.value.previewImages.forEach((img, index) => {
      uploadTasks.push({
        type: 'detail',
        index,
        image: img
      })
    })
  }

  // 质检图
  if (qualityImageRef.value && qualityImageRef.value.previewImages.length > 0) {
    qualityImageRef.value.previewImages.forEach((img, index) => {
      uploadTasks.push({
        type: 'quality',
        index,
        image: img
      })
    })
  }

  // 如果没有需要上传的图片，直接返回
  if (uploadTasks.length === 0) {
    return {
      coverImage: null,
      square_cover: null,
      sizeImage: [],
      detail_image: [],
      quality_test: []
    }
  }

  // 使用 Promise.allSettled 并行上传所有图片
  const uploadPromises = uploadTasks.map((task) =>
    uploadImageOSS(task.image).then((url) => ({
      type: task.type,
      index: task.index,
      url,
      success: true
    })).catch((error) => {
      console.error(`上传${task.type}图片失败:`, error)
      return {
        type: task.type,
        index: task.index,
        url: null,
        success: false
      }
    })
  )

  const results = await Promise.allSettled(uploadPromises)

  // 处理上传结果
  let coverImage: string | null = null
  let square_cover: string | null = null
  const sizeImageMap = new Map<number, string>()
  const detailImageMap = new Map<number, string>()
  const qualityTestMap = new Map<number, string>()

  results.forEach((result, idx) => {
    const task = uploadTasks[idx]
    if (result.status === 'fulfilled' && result.value.success && result.value.url) {
      const { type, index, url } = result.value

      switch (type) {
        case 'cover':
          coverImage = url
          square_cover = url
          break
        case 'size':
          if (index !== undefined) {
            sizeImageMap.set(index, url)
          }
          break
        case 'detail':
          if (index !== undefined) {
            detailImageMap.set(index, url)
          }
          break
        case 'quality':
          if (index !== undefined) {
            qualityTestMap.set(index, url)
          }
          break
      }
    }
  })

  // 将 Map 转换为有序数组（只包含成功上传的图片）
  const sizeImage = Array.from(sizeImageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url)
  const detail_image = Array.from(detailImageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url)
  const quality_test = Array.from(qualityTestMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url)

  return {
    coverImage,
    square_cover,
    sizeImage,
    detail_image,
    quality_test
  }
}

const add = async () => {
  try {
    const valid = await libraryForm.value?.validate()
    if (!valid) {
      toast.add({
        title: t('addLibrary.warning'),
        description: t('addLibrary.form_incomplete'),
        color: 'orange'
      })
      return false
    }

    if (loading.value) {
      toast.add({
        title: t('addLibrary.warning'),
        description: t('addLibrary.requesting_wait'),
        color: 'orange'
      })
      return false
    }

    loading.value = true
    const {
      name,
      shop_id,
      main_style,
      library_type,
      size,
      color,
      pattern_elements,
      design_elements,
      cloth_elements,
      state,
      start_time,
      secondary_cloth,
      sale_time,
      notes,
      season,
      library_price,
      library_pattern,
      link,
      theme,
      parent_id,
      fabric_composition,
      arrears_start
    } = library.value
    console.log(start_time, '预约时间')

    // 并行上传所有图片
    const {
      coverImage,
      square_cover,
      sizeImage,
      detail_image,
      quality_test
    } = await uploadAllImages()

    const params: InsertParams = {
      name,
      shop_id: null,
      size,
      state,
      library_price,
      library_type,
      link
    }
    if (shop_id) {
      params.shop_id = shop_id.shop_id
    } else {
      params.shop_id = null
    }
    if (sale_time) {
      const year = sale_time.year
      const month = String(sale_time.month + 1).padStart(2, '0')
      params.sale_time = `${year}-${month}-01`
    } else {
      params.sale_time = null
    }
    // 添加可选参数
    if (coverImage) params.cover = coverImage
    if (sizeImage && sizeImage.length > 0) params.size_image = sizeImage.join(',')
    if (notes && notes !== '') {
      params.notes = notes
    } else {
      params.notes = null
    }
    if (theme && theme.length > 0) {
      params.theme = theme.map((item) => item.wiki_name).join(',')
    } else {
      params.theme = null
    }

    if (parent_id) {
      params.parent_id = parent_id.library_id
    } else {
      params.parent_id = null
    }
    if (square_cover) params.square_cover = square_cover
    if (detail_image && detail_image.length > 0) {
      params.detail_image = detail_image.join(',')
    } else {
      params.detail_image = null
    }
    if (quality_test && quality_test.length > 0) {
      params.quality_test = quality_test.join(',')
    } else {
      params.quality_test = null
    }
    if (cloth_elements && cloth_elements.length > 0) {
      params.cloth_elements = cloth_elements.map((item) => item.wiki_name).join(',')
    } else {
      params.cloth_elements = null
    }
    if (design_elements && design_elements.length > 0) {
      params.design_elements = design_elements.map((item) => item.wiki_name).join(',')
    } else {
      params.design_elements = null
    }
    if (fabric_composition && fabric_composition.length > 0) {
      params.fabric_composition = fabric_composition.map((item) =>
        item.value === 0 ? item.name.label : `${item.value}%${item.name.label}`
      ).join(',')
    } else {
      params.fabric_composition = null
    }
    if (color && color.length > 0) {
      params.color = color.map((item) => item.wiki_name).join(',')
    } else {
      params.color = null
    }
    if (main_style && main_style.length > 0) {
      params.main_style = main_style.join(',')
    } else {
      params.main_style = null
    }
    if (pattern_elements && pattern_elements.length > 0) {
      params.pattern_elements = pattern_elements.map((item) => item.wiki_name).join(',')
    } else {
      params.pattern_elements = null
    }
    if (season && season.length > 0) {
      params.season = season.join(',')
    } else {
      params.season = null
    }
    if (secondary_cloth && secondary_cloth.length > 0) {
      params.secondary_cloth = secondary_cloth.map((item) => item.wiki_name).join(',')
    } else {
      params.secondary_cloth = null
    }
    if (start_time) {
      if (start_time[0] !== '' && start_time[1] !== '') {
        params.start_time = start_time[0]
        params.end_time = start_time[1]
      } else {
        params.start_time = null
        params.end_time = null
      }
    }
    if (arrears_start) {
      if (arrears_start[0] !== '' && arrears_start[1] !== '') {
        params.arrears_start = arrears_start[0]
        params.arrears_end = arrears_start[1]
      } else {
        params.arrears_start = null
        params.arrears_end = null
      }
    }
    if (library_pattern && library_pattern.length > 0) {
      params.library_pattern = library_pattern.map((item) => item.wiki_name).join(',')
    } else {
      params.library_pattern = null
    }

    console.log(params, main_style, '最终参数')

    if (library_id.value !== null) {
      params.library_id = library_id.value
      await updateLibrary(params)
      toast.add({
        title: t('addLibrary.success'),
        description: t('addLibrary.update_success'),
        color: 'green'
      })
      await navigateTo(`/library/detail/${library_id.value}`)
    } else {
      const res = await insertLibrary(params)
      toast.add({
        title: t('addLibrary.success'),
        description: t('addLibrary.upload_success'),
        color: 'green'
      })
      init()
    }
  } catch (error) {
    console.error('提交失败:', error)
    // toast.add({
    //   title: '错误',
    //   description: '提交失败，请重试',
    //   color: 'red'
    // })
  } finally {
    loading.value = false
  }
}

// 提交审核
const submitReview = async () => {
  if (!reviewForm.value.status) {
    toast.add({
      title: t('addLibrary.warning'),
      description: t('addLibrary.select_review_result'),
      color: 'orange'
    })
    return
  }

  if (!library_id.value || !route.query?.review) {
    toast.add({
      title: t('addLibrary.error'),
      description: t('addLibrary.missing_params'),
      color: 'red'
    })
    return
  }

  reviewLoading.value = true
  try {
    // 调用审核接口
    const params = {
      library_id: library_id.value,
      history_id: route.query.review as string,
      is_apply: reviewForm.value.status === 'approved' ? 1 : 2,
      reason: reviewForm.value.suggestion || null
    }

    await submitLibraryReview(params)
    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus');
    if (isInUniApp && typeof uni !== 'undefined' && uni.redirectTo) {
      uni.redirectTo({
        url: '/pages/library/manage',
      });
    } else {
      window.location.href = `/library/detail/${library_id.value}`
    }
    toast.add({
      title: t('addLibrary.success'),
      description: reviewForm.value.status === 'approved' ? t('addLibrary.review_approved_msg') : t('addLibrary.review_rejected_msg'),
      color: 'green'
    })

    showReviewModal.value = false
    // 重置表单
    reviewForm.value = {
      status: '' as 'approved' | 'rejected' | '',
      suggestion: ''
    }

    // 审核完成后可以跳转或刷新
    window.location.href = `/library/detail/${library_id.value}`
  } catch (error) {
    console.error('审核提交失败:', error)
    toast.add({
      title: t('addLibrary.error'),
      description: t('addLibrary.review_submit_failed'),
      color: 'red'
    })
  } finally {
    reviewLoading.value = false
  }
}

// 加入QQ群
const joinQQGroup = () => {
  window.open('https://qm.qq.com/cgi-bin/qm/qr?k=QHxbdobmidEJ6SqlA6y_gsC3Nia2E1Pw&jump_from=webapi&authKey=urMk9ED6h5KNgQ20HkWHR+uv7+c08prYmMcT3pmZ3is3ZFC16LRawiwvALf0FL4l', '_blank')
}
</script>

<style scoped>
.add-library {
  max-width: 1040px;
  padding: 20px;
  margin: 20px auto;
  background: #fff;
  box-shadow: 1px 1px 10px #ccc;
  border-radius: 4px;
}

.vue-datepicker {
  --vp-background-color: var(--qhx-bg);
  --vp-accent-color: var(--qhx-primary);
  --vp-text-color: var(--qhx-text);
}
</style>
