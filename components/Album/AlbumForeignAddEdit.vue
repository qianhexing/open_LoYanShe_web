<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-lg font-semibold">
          {{ type === 0 ? '达成成就' : type === 1 ? '重新打卡' : '成就展示' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="space-y-6 max-h-[70vh] overflow-y-auto p-6">
          <!-- 成就信息展示 -->
          <div v-if="info">
            <!-- 封面展示 -->
            <div v-if="!info.album_foreign || (info.album_foreign && !info.album_foreign.cover)" class="mb-4">
              <div class="relative w-full rounded-lg overflow-hidden shadow-md" :style="{ aspectRatio: '20/15' }">
                <img 
                  :src="BASE_IMG + info.album_cover" 
                  :alt="info.album_title"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                  <div class="p-4 w-full text-white">
                    <h3 class="text-xl font-semibold mb-2 text-center">{{ info.album_title }}</h3>
                    <SafeRichText v-if="albumDescNodes.length > 0" :nodes="albumDescNodes" class="text-sm" />
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 多图轮播展示 -->
            <div v-else class="mb-4">
              <div v-if="albumForeignCoverPreview.length > 0" class="mb-4">
                <div class="grid grid-cols-3 gap-2 mb-4">
                  <div 
                    v-for="(img, index) in albumForeignCoverPreview" 
                    :key="index"
                    class="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <QhxPreviewImage 
                      :list="[{ src: img, alt: `成就图片 ${index + 1}` }]"
                      :preview="albumForeignCoverPreview"
                      className="w-full h-full object-cover"
                    />
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all pointer-events-none"></div>
                  </div>
                </div>
              </div>
              <h3 class="text-xl font-semibold mb-2 text-center">{{ info.album_title }}</h3>
              <SafeRichText v-if="albumDescNodes.length > 0" :nodes="albumDescNodes" class="text-sm mb-4" />
            </div>
            
            <!-- 成就进度 -->
            <div v-if="info.pk_type === 1 && info.progress" class="mb-4">
              <div class="text-sm text-gray-600 mb-2">成就进度</div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  class="bg-qhx-primary h-2.5 rounded-full transition-all duration-300" 
                  :style="{ width: `${info.progress}%` }"
                ></div>
              </div>
              <div class="text-xs text-gray-500 mt-1 text-right">{{ info.progress }}%</div>
            </div>
            
            <!-- 达成时间 -->
            <div v-if="info.album_foreign && info.album_foreign.create_time" class="text-sm text-gray-600 mb-4">
              达成时间: {{ formatDate(info.album_foreign.create_time) }}
            </div>
            
            <!-- 封面图片上传（仅新增和修改模式） -->
            <div v-if="info.pk_type === 0 && type !== 2" class="mb-4">
              <UFormGroup label="成就封面">
                <QhxImagePicker 
                  :multiple="true" 
                  @update:files="onUpdateCoverFiles" 
                  ref="coverImageRef" 
                />
                <p class="text-xs text-gray-500 mt-2">请上传至少一张封面图片</p>
              </UFormGroup>
            </div>
            
            <!-- 关联内容与笔记（仅新增和修改模式） -->
            <div v-if="type !== 2" class="mb-4 space-y-4">
              <!-- 关联类型与已选内容（可选） -->
              <div>
                <UFormGroup label="关联内容（可选）">
                  <!-- 关联类型选择 -->
                  <div
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer flex items-center justify-between mb-2"
                    @click="openTypeModal"
                  >
                    <span class="text-gray-500 dark:text-gray-400">
                      {{ form.pk_type ? pkTypeLabel : '请选择关联类型' }}
                    </span>
                    <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400" />
                  </div>

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
                      <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">
                        <img
                          :src="`${BASE_IMG}${selectedClothes.clothes_img || ''}`"
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
                        class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600"
                      >
                        <img
                          :src="`${BASE_IMG}${selectedMatching.cover}`"
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
                    @click="form.pk_type ? openChooseModal() : openTypeModal"
                  >
                    <span class="text-gray-500 dark:text-gray-400">
                      {{ form.pk_type ? '点击选择关联内容' : '点击选择关联类型' }}
                    </span>
                    <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
                  </div>
                </UFormGroup>
              </div>

              <!-- 笔记输入 -->
              <div>
                <UFormGroup label="笔记">
                  <UTextarea 
                    v-model="form.note" 
                    placeholder="记录你的成就心得..." 
                    :rows="4"
                    maxlength="3000"
                    class="flex-1 focus:ring-0" 
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
                  <div class="text-xs text-gray-500 mt-1 text-right">
                    {{ form.note?.length || 0 }}/3000
                  </div>
                </UFormGroup>
              </div>
            </div>
            
            <!-- 展示模式下的关联内容 -->
            <div
              v-if="type === 2 && info.album_foreign && info.album_foreign.pk_type && info.album_foreign.pk_id"
              class="mb-4 space-y-2"
            >
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                关联内容
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                <!-- 帖子 -->
                <template v-if="info.album_foreign.pk_type === 1">
                  <CommunityItem
                    v-if="info.album_foreign.community"
                    :item="info.album_foreign.community"
                    size="big"
                    :need-jump="true"
                    class="!m-0 !shadow-none border-0"
                  />
                  <p
                    v-else
                    class="text-sm text-amber-600 dark:text-amber-400"
                  >
                    关联帖子已失效
                  </p>
                </template>

                <!-- 服饰 -->
                <template v-else-if="info.album_foreign.pk_type === 2">
                  <div
                    v-if="info.album_foreign.wardrobe_clothes"
                    class="flex gap-3"
                  >
                    <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">
                      <img
                        :src="`${BASE_IMG}${info.album_foreign.wardrobe_clothes.clothes_img || ''}${getImageParams()}`"
                        :alt="info.album_foreign.wardrobe_clothes.clothes_note"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {{ info.album_foreign.wardrobe_clothes.clothes_note || '暂无笔记' }}
                      </div>
                      <div
                        v-if="info.album_foreign.wardrobe_clothes.wardrobe_status"
                        class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                      >
                        状态：{{ info.album_foreign.wardrobe_clothes.wardrobe_status }}
                      </div>
                      <div
                        v-if="info.album_foreign.wardrobe_clothes.clothes_part"
                        class="text-xs text-gray-500 dark:text-gray-400"
                      >
                        部位：{{ info.album_foreign.wardrobe_clothes.clothes_part }}
                      </div>
                    </div>
                  </div>
                  <p
                    v-else
                    class="text-sm text-amber-600 dark:text-amber-400"
                  >
                    关联服饰已失效
                  </p>
                </template>

                <!-- 搭配 -->
                <template v-else-if="info.album_foreign.pk_type === 3">
                  <div
                    v-if="info.album_foreign.matching_list"
                    class="flex gap-3"
                  >
                    <div
                      v-if="info.album_foreign.matching_list.cover"
                      class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600"
                    >
                      <img
                        :src="`${BASE_IMG}${info.album_foreign.matching_list.cover}${getImageParams()}`"
                        :alt="info.album_foreign.matching_list.note || '搭配'"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {{ info.album_foreign.matching_list.note || '未命名搭配' }}
                      </div>
                      <div
                        v-if="info.album_foreign.matching_list.main_style"
                        class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                      >
                        风格：{{ info.album_foreign.matching_list.main_style }}
                      </div>
                    </div>
                  </div>
                  <p
                    v-else
                    class="text-sm text-amber-600 dark:text-amber-400"
                  >
                    关联搭配已失效
                  </p>
                </template>

                <!-- 图鉴 -->
                <template v-else-if="info.album_foreign.pk_type === 4">
                  <div v-if="info.album_foreign.library">
                    <LibraryItem
                      :need-jump="false"
                      :size="'mini-list'"
                      :item="info.album_foreign.library"
                    />
                  </div>
                  <p
                    v-else
                    class="text-sm text-amber-600 dark:text-amber-400"
                  >
                    关联图鉴已失效
                  </p>
                </template>
              </div>
            </div>

            <!-- 笔记展示（仅展示模式） -->
            <div
              v-if="type === 2 && info.album_foreign && info.album_foreign.note && info.album_foreign.note !== ''"
              class="mb-4"
            >
              <div class="text-sm font-medium text-gray-700 mb-2">笔记</div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {{ info.album_foreign.note }}
              </div>
            </div>
          </div>
          
          <!-- 加载中状态 -->
          <div v-else class="flex justify-center items-center py-8">
            <div class="text-gray-500">加载中...</div>
          </div>
        </div>
      </div>
      
      <!-- 底部按钮 -->
      <div v-if="type !== 2" class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <UButton color="gray" @click="closeModel">取消</UButton>
        <UButton 
          v-if="info && info.can_achieved"
          :loading="loading" 
          size="xs" 
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="handleSubmit"
        >
          {{ type === 1 ? '重新打卡' : '达成成就' }}
        </UButton>
        <UButton 
          v-else-if="info"
          disabled
          size="xs"
        >
          未达成
        </UButton>
        <UButton 
          v-else
          disabled
          size="xs"
        >
          加载中
        </UButton>
      </div>
    </div>

    <!-- 选择器：帖子 / 服饰 / 搭配 / 图鉴 -->
    <CommunityChoose
      ref="communityChooseRef"
      :only-mine="true"
      @choose="onCommunityChoose"
    />
    <WardrobeClothesChoose ref="wardrobeClothesChooseRef" @choose="onClothesChoose" />
    <MatchingChoose
      ref="matchingChooseRef"
      :filter-list="matchingFilterList"
      @choose="onMatchingChoose"
    />
    <LibraryChoose
      ref="libraryChooseRef"
      :multiple="false"
      @choose="onLibraryChoose"
    />

    <!-- 类型选择弹框 -->
    <QhxModal v-model="typeModalShow" :trigger-position="typeModalPosition" @close="typeModalShow = false">
      <div class="p-4 w-[220px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择关联类型</h3>

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
            <div class="text-xs text-gray-500 dark:text-gray-400">添加帖子关联</div>
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
            <div class="text-xs text-gray-500 dark:text-gray-400">添加服饰关联</div>
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
            <div class="text-xs text-gray-500 dark:text-gray-400">添加搭配关联</div>
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
            <div class="text-xs text-gray-500 dark:text-gray-400">添加图鉴关联</div>
          </div>
        </button>
      </div>
    </QhxModal>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { insertAlbumForeign, getAlbumDetail, updateAlbumForeign } from '@/api/album'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { useToast } from '#imports'
import { parseRichText } from '@/utils/public'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { Album, Community, WardrobeClothes, Library } from '@/types/api'
import type { RichNode } from '@/utils/public'
import dayjs from 'dayjs'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import CommunityChoose from '@/components/community/CommunityChoose.vue'
import CommunityItem from '@/components/community/CommunityItem.vue'
import WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import MatchingChoose from '@/components/matching/MatchingChoose.vue'
import LibraryChoose from '@/components/library/LibraryChoose.vue'
import LibraryItem from '@/components/library/LibraryItem.vue'
import type { MatchingListItem } from '@/api/matching_list'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'

// 扩展 Album 类型以包含成就相关信息
interface ExtendedAlbum extends Album {
  album_desc?: string
  pk_type?: number
  progress?: number
  can_achieved?: boolean
}

const emit = defineEmits(['success'])

const userStore = useUserStore()
const configStore = useConfigStore()

const show = ref<boolean>(false)
const loading = ref<boolean>(false)
const type = ref<number>(0) // 0 新增 1 修改 2 展示
const album_id = ref<number | null>(null)
const user_id = ref<number | null>(null)
const info = ref<ExtendedAlbum | null>(null)
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

// 图片选择器引用
const coverImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

// 表单数据
const form = ref<{
  note: string
  pk_type: number | null
  pk_id: number | null
}>({
  note: '',
  pk_type: null,
  pk_id: null
})

// 关联选择相关
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

const pkTypeOptions = [
  { label: '帖子', value: 1 },
  { label: '服饰', value: 2 },
  { label: '搭配', value: 3 },
  { label: '图鉴', value: 4 }
]

const pkTypeLabel = computed(
  () => pkTypeOptions.find((o) => o.value === form.value.pk_type)?.label || ''
)

const getImageParams = () => configStore.config?.image_params || ''

// 解析成就描述为富文本节点
const albumDescNodes = computed<RichNode[]>(() => {
  if (!info.value?.album_desc) return []
  try {
    return parseRichText(info.value.album_desc)
  } catch (error) {
    console.error('解析富文本失败:', error)
    return []
  }
})

// 成就关联封面预览列表（统一转成 string[]）
const albumForeignCoverPreview = computed<string[]>(() => {
  const foreign = (info.value as any)?.album_foreign as
    | {
        cover?: string | string[]
      }
    | undefined

  if (!foreign || !foreign.cover) return []

  if (Array.isArray(foreign.cover)) {
    return foreign.cover.filter((x) => !!x)
  }

  if (typeof foreign.cover === 'string') {
    return foreign.cover.split(',').filter(Boolean)
  }

  return []
})

// 格式化日期
const formatDate = (date: string | Date | undefined): string => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

// 打开类型选择弹窗
const openTypeModal = (e?: MouseEvent) => {
  if (e) {
    typeModalPosition.value = { x: e.clientX, y: e.clientY }
  } else {
    typeModalPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  typeModalShow.value = true
}

// 选择类型后直接打开对应选择器
const selectTypeAndOpenChooser = (value: number) => {
  form.value = { ...form.value, pk_type: value, pk_id: null }
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

// 打开已选类型对应的选择器
const openChooseModal = () => {
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

// 选择结果回调
const onCommunityChoose = (item: Community) => {
  const id = item.community_id ?? 0
  form.value = { ...form.value, pk_type: 1, pk_id: id }
  selectedCommunity.value = item
}

const onClothesChoose = (item: WardrobeClothes) => {
  const id = item.clothes_id ?? 0
  form.value = { ...form.value, pk_type: 2, pk_id: id }
  selectedClothes.value = item
}

const onMatchingChoose = (item: MatchingListItem) => {
  const id = item.matching_id ?? 0
  form.value = { ...form.value, pk_type: 3, pk_id: id }
  selectedMatching.value = item
}

const onLibraryChoose = (list: Library[]) => {
  const item = list[0]
  if (!item) return
  const id = item.library_id ?? 0
  form.value = { ...form.value, pk_type: 4, pk_id: id }
  selectedLibrary.value = item
}

// 当前用户匹配筛选（仅看自己的搭配）
const matchingFilterList = computed(() => {
  const uid = userStore.user?.user_id
  if (!uid) return []
  return [{ field: 'user_id', op: 'eq', value: uid }]
})

// 显示新增弹窗
const showModel = (item: { album_id: number }, event?: MouseEvent) => {
  // 记录触发位置（如果有事件对象）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  show.value = true
  type.value = 0
  album_id.value = item.album_id
  user_id.value = null
  fetchAlbumDetail()
}

// 显示修改弹窗
const editModel = (item: { album_id: number }, event?: MouseEvent) => {
  // 记录触发位置（如果有事件对象）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  show.value = true
  type.value = 1
  album_id.value = item.album_id
  user_id.value = null
  fetchAlbumDetail()
}

// 显示成就展示弹窗
const showAchieve = (item: { album_id: number; user_id?: number }, event?: MouseEvent) => {
  // 记录触发位置（如果有事件对象）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  show.value = true
  type.value = 2
  album_id.value = item.album_id
  user_id.value = item.user_id || null
  fetchAlbumDetail()
}

// 获取成就详情
const fetchAlbumDetail = async () => {
  try {
    if (!album_id.value) return
    
    const params: { album_id: number; user_id?: number } = {
      album_id: album_id.value
    }
    if (user_id.value) {
      params.user_id = user_id.value
    }
    const response = await getAlbumDetail(params)
    // API 返回的数据可能包含扩展字段，使用类型断言
    const albumInfo = response as unknown as ExtendedAlbum

    info.value = albumInfo
    
    // 如果是修改模式，设置已有的封面图片、关联和笔记
    const foreign: any = (albumInfo as any).album_foreign
    if (type.value === 1 && foreign) {
      nextTick(() => {
        if (coverImageRef.value && foreign.cover) {
          const coverStr: string = foreign.cover
          const coverList = coverStr.split(',').filter(Boolean)
          if (coverList.length > 0) {
            coverImageRef.value.previewImages = coverList.map((img: string) => ({
              url: BASE_IMG + img,
              file: undefined as unknown as File
            }))
          }
        }
        form.value.note = foreign.note || ''
        form.value.pk_type = foreign.pk_type ?? null
        form.value.pk_id = foreign.pk_id ?? null

        // 回显关联对象，方便在“重新打卡”时直接看到当前关联内容
        selectedCommunity.value = (foreign.community as Community | undefined) ?? null
        selectedClothes.value = (foreign.wardrobe_clothes as WardrobeClothes | undefined) ?? null
        selectedMatching.value = (foreign.matching_list as MatchingListItem | undefined) ?? null
        selectedLibrary.value = (foreign.library as Library | undefined) ?? null
      })
    } else {
      form.value.note = ''
      form.value.pk_type = null
      form.value.pk_id = null
    }
  } catch (error) {
    console.error('获取成就详情失败:', error)
    toast.add({
      title: '获取成就详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 处理封面图片更新
const onUpdateCoverFiles = (files: File[]) => {
  // 文件已通过 QhxImagePicker 处理
}

// 上传图片
const fetchUpload = async (file: { file?: File; url: string }): Promise<string> => {
  try {
    let url: string
    if (file.file) {
      const res = await uploadImage(file.file)
      url = res.file_url
    } else {
      url = file.url.replace(BASE_IMG, '')
    }
    return url
  } catch (error) {
    console.error('图片上传失败:', error)
    toast.add({
      title: '图片上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    throw error
  }
}

// 提交表单
const handleSubmit = async () => {
  if (loading.value) {
    toast.add({
      title: '请求中请稍后',
      icon: 'i-heroicons-exclamation-circle',
      color: 'warning'
    })
    return
  }
  
  // 验证封面图片
  if (info.value?.pk_type === 0) {
    if (!coverImageRef.value || coverImageRef.value.previewImages.length === 0) {
      toast.add({
        title: '请上传封面',
        icon: 'i-heroicons-exclamation-circle',
        color: 'warning'
      })
      return
    }
  }
  
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      album_id: album_id.value,
      note: form.value.note || ''
    }

    // 处理关联内容（可选）
    if (form.value.pk_type && form.value.pk_id) {
      params.pk_type = form.value.pk_type
      params.pk_id = form.value.pk_id
    }
    
    // 处理封面图片
    if (info.value?.pk_type === 0 && coverImageRef.value && coverImageRef.value.previewImages.length > 0) {
      const coverUrls = await Promise.all(
        coverImageRef.value.previewImages.map(img => fetchUpload(img))
      )
      params.cover = coverUrls.join(',')
    }
    
    if (type.value === 0) {
      await insertAlbumForeign(params)
      toast.add({
        title: '达成成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      await updateAlbumForeign(params)
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    
    emit('success')
    closeModel()
  } catch (error) {
    console.error('操作失败:', error)
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 关闭弹窗
const closeModel = () => {
  show.value = false
  initData()
}

// 处理关闭事件
const handleClose = () => {
  closeModel()
}

// 初始化数据
const initData = () => {
  info.value = null
  form.value = {
    note: '',
    pk_type: null,
    pk_id: null
  }
  album_id.value = null
  user_id.value = null
  
  // 清空图片选择器
  nextTick(() => {
    if (coverImageRef.value) {
      coverImageRef.value.clear()
    }
  })
}

defineExpose({
  showModel,
  editModel,
  showAchieve
})
</script>

<style scoped>

</style>
