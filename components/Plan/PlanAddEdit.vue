<script setup lang="ts">
import { ref, computed, watch, nextTick, unref } from 'vue'
import type { PlanList, WardrobeClothes } from '@/types/api'
import { insertPlanList, updatePlanList, planListRelate } from '@/api/plan'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import { useConfigStore } from '@/stores/config'
import {
  PLAN_COVER_MAX,
  joinPlanCoverPaths,
  parsePlanCoverPaths,
} from '@/utils/planCover'
import dayjs from 'dayjs'

interface PlanStage {
  /** 已有子计划 id；提交时带回，避免后端当作新阶段重复插入 */
  list_id?: number
  need_money: number
  end_time: string | null
  plan_note: string
}

interface Props {
  planList?: PlanList | null
  needStatus?: boolean
  dontUpload?: boolean
  /** 创建时预填需要资金（如服饰尾款金额） */
  initialNeedMoney?: number
  /** 为 true 时显示「关联服饰」，可选择衣柜服饰并在保存后调用计划关联接口 */
  enableLinkClothes?: boolean
  /** 新增计划时预置的关联服饰信息（如从服饰详情打开），含 clothes_id 即可参与保存关联 */
  linkedClothes?: WardrobeClothes | null
}

const props = withDefaults(defineProps<Props>(), {
  planList: null,
  needStatus: false,
  dontUpload: true,
  initialNeedMoney: 0,
  enableLinkClothes: false,
  linkedClothes: null
})

const emit = defineEmits<{
  (e: 'success', params: any): void
  (e: 'edit'): void
  (e: 'insert', data: PlanList): void
  (e: 'updated', data: PlanList): void
}>()

const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑
const toast = useToast()
const configStore = useConfigStore()
const clickPosition = ref({ x: 0, y: 0 })

const form = ref({
  plan_name: '',
  need_money: 0,
  plan_note: '',
  plan_cover: '',
  have_money: 0,
  end_time: null as string | null
})

const list = ref<PlanStage[]>([])
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const wardrobeClothesChooseRef = ref<InstanceType<typeof WardrobeClothesChoose> | null>(null)
/** 当前表单选中的关联服饰（展示与提交） */
const selectedLinkedClothes = ref<WardrobeClothes | null>(null)

const getImageParams = () => configStore.config?.image_params || ''

const syncLinkedClothesFromPlan = () => {
  const p = props.planList
  if (!p) {
    selectedLinkedClothes.value = props.linkedClothes ? { ...props.linkedClothes } : null
    return
  }
  if (p.wardrobe_clothes?.clothes_id) {
    selectedLinkedClothes.value = { ...p.wardrobe_clothes }
    return
  }
  if (p.clothes_id) {
    selectedLinkedClothes.value = { clothes_id: p.clothes_id }
    return
  }
  selectedLinkedClothes.value = null
}

const openClothesPicker = (e?: MouseEvent) => {
  wardrobeClothesChooseRef.value?.showModel(e)
}

const onClothesChosen = (item: WardrobeClothes) => {
  selectedLinkedClothes.value = item ? { ...item } : null
}

const clearLinkedClothes = () => {
  selectedLinkedClothes.value = null
}

const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 统一尾款时间格式，保证编辑回显正确 */
const normalizeEndTime = (time: string | Date | null | undefined): string | null => {
  if (!time) return null
  const d = dayjs(time)
  return d.isValid() ? d.format(TIME_FORMAT) : null
}

/** 子计划 → 表单阶段：保留 list_id，并按 list_id 去重（排除与母计划同 id） */
const stagesFromPlanList = (
  planList: PlanList[] | undefined | null,
  parentId?: number | null
): PlanStage[] => {
  if (!Array.isArray(planList) || planList.length === 0) return []
  const seen = new Set<number>()
  const out: PlanStage[] = []
  for (const item of planList) {
    if (!item) continue
    const id = item.list_id
    if (parentId != null && id === parentId) continue
    if (id != null) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    out.push({
      list_id: id,
      need_money: item.need_money || 0,
      end_time: normalizeEndTime(item.end_time),
      plan_note: item.plan_note || ''
    })
  }
  return out
}

// 计算总金额
const getListLength = computed(() => {
  if (list.value.length > 0) {
    let money = 0
    list.value.forEach((child) => {
      money += parseInt(String(child.need_money || 0))
    })
    form.value.need_money = money
  }
  return list.value.length
})

// 监听弹窗显示，初始化数据
watch(show, (newValue) => {
  if (newValue) {
    if (props.enableLinkClothes) {
      syncLinkedClothesFromPlan()
    } else {
      selectedLinkedClothes.value = null
    }
    if (props.planList) {
      type.value = 1
      const { plan_cover, plan_name, need_money, plan_note, have_money, end_time } = props.planList
      
      form.value.need_money = need_money || 0
      form.value.plan_name = plan_name || ''
      form.value.plan_note = plan_note || ''
      form.value.have_money = have_money || 0
      form.value.end_time = normalizeEndTime(end_time)
      form.value.plan_cover = plan_cover || ''

      nextTick(() => {
        imagePickerRef.value?.clear()
        const paths = parsePlanCoverPaths(plan_cover)
        if (paths.length) {
          imagePickerRef.value?.seedFromPaths(paths)
        }
      })

      list.value = stagesFromPlanList(props.planList.plan_list, props.planList.list_id)
    } else {
      type.value = 0
      form.value = {
        plan_name: '',
        need_money: props.initialNeedMoney > 0 ? props.initialNeedMoney : 0,
        plan_note: '',
        plan_cover: '',
        have_money: 0,
        end_time: null
      }
      list.value = []
      nextTick(() => {
        imagePickerRef.value?.clear()
      })
    }
  }
})

// 删除阶段
const deleteList = (index: number) => {
  list.value.splice(index, 1)
}

// 添加阶段
const addPlan = () => {
  list.value.push({
    need_money: 0,
    end_time: null,
    plan_note: ''
  })
}

// 显示弹窗
const showModel = (event?: MouseEvent) => {
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
}

// 关闭弹窗
const closeModel = () => {
  show.value = false
  initData()
}

const handleClose = () => {
  closeModel()
}

// 初始化数据
const initData = () => {
  if (imagePickerRef.value) {
    imagePickerRef.value.clear()
  }
  form.value = {
    plan_name: '',
    need_money: 0,
    plan_note: '',
    plan_cover: '',
    have_money: 0,
    end_time: null
  }
  list.value = []
  selectedLinkedClothes.value = null
}

const fetchUpload = async (file: { file?: File; url?: string }): Promise<string> => {
  try {
    if (file.file) {
      const res = await uploadImage(file.file)
      return res.file_url
    }
    if (file.url) {
      return file.url.replace(BASE_IMG, '')
    }
  } catch (error) {
    console.error('图片上传失败:', error)
    toast.add({
      title: '图片上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
  return ''
}

/** 从选择器解析封面路径列表，提交时上传并逗号拼接 */
const resolvePlanCoverForSubmit = async (): Promise<string> => {
  const raw = imagePickerRef.value?.previewImages as unknown
  const list = (Array.isArray(raw) ? raw : unref(raw as never)) as Array<{ file?: File; url?: string }>
  const rows = (Array.isArray(list) ? list : []).slice(0, PLAN_COVER_MAX)
  if (!rows.length) return ''
  const urls = await Promise.all(rows.map((item) => fetchUpload(item)))
  return joinPlanCoverPaths(urls.filter(Boolean))
}

// 提交表单
const handleSubmit = async () => {
  if (loading.value) return

  // 验证需要资金
  if (!form.value.need_money || form.value.need_money < 0) {
    toast.add({
      title: '需要资金不可为空并且要大于0',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (form.value.need_money < form.value.have_money) {
    toast.add({
      title: '需要资金不能小于已有资金',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  // 验证计划名称
  if (form.value.plan_name.length > 20) {
    toast.add({
      title: '计划名必须小于20个字符',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  loading.value = true
  try {
    const planCover = await resolvePlanCoverForSubmit()
    form.value.plan_cover = planCover

    const params: any = {
      plan_name: form.value.plan_name,
      need_money: form.value.need_money,
      plan_note: form.value.plan_note,
      end_time: form.value.end_time,
      plan_list: list.value
    }

    if (props.planList) {
      params.list_id = props.planList.list_id
    }

    params.plan_cover = planCover

    // 如果不自动上传，直接触发事件（服饰关联由父级或后续接口处理）
    if (!props.dontUpload) {
      if (props.enableLinkClothes) {
        params.clothes_id = selectedLinkedClothes.value?.clothes_id ?? null
      }
      emit('success', params)
      closeModel()
      return
    }
    if (type.value === 0) {
      const res = await insertPlanList(params)
      let merged = res as PlanList
      if (props.enableLinkClothes && res.list_id) {
        const cid = selectedLinkedClothes.value?.clothes_id
        if (cid) {
          try {
            const rel = await planListRelate({ list_id: res.list_id, clothes_id: cid })
            merged = { ...res, ...rel }
          } catch {
            toast.add({
              title: '计划已添加，但关联服饰失败，稍后在计划页可再关联',
              icon: 'i-heroicons-exclamation-triangle',
              color: 'orange'
            })
          }
        }
      }
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('edit')
      emit('insert', merged)
      closeModel()
    } else {
      const res = await updatePlanList(params)
      let merged = res as PlanList
      if (props.enableLinkClothes) {
        const listId = params.list_id ?? props.planList?.list_id
        const nextId = selectedLinkedClothes.value?.clothes_id ?? null
        const prevId = props.planList?.clothes_id ?? null
        if (listId != null && nextId !== prevId) {
          try {
            const rel = await planListRelate({ list_id: listId, clothes_id: nextId })
            merged = { ...res, ...rel }
          } catch {
            toast.add({
              title: '计划已保存，但关联服饰失败，稍后在计划页可再关联',
              icon: 'i-heroicons-exclamation-triangle',
              color: 'orange'
            })
          }
        }
      }
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      // 合并本地表单数据，确保编辑后及时回显（后端可能不返回完整 plan_list）
      const planListFormatted = list.value.map((item) => {
        const original =
          item.list_id != null
            ? props.planList?.plan_list?.find((child) => child.list_id === item.list_id)
            : undefined
        return {
          ...original,
          list_id: item.list_id ?? original?.list_id,
          need_money: item.need_money,
          end_time: item.end_time,
          plan_note: item.plan_note
        } as unknown as PlanList
      })
      const fullPlan: PlanList = {
        ...(props.planList || {}),
        ...merged,
        list_id: params.list_id ?? props.planList?.list_id,
        plan_name: form.value.plan_name,
        need_money: form.value.need_money,
        plan_note: form.value.plan_note,
        plan_cover: form.value.plan_cover || props.planList?.plan_cover || '',
        plan_list: planListFormatted
      }
      emit('edit')
      emit('updated', fullPlan)
      closeModel()
    }
  } catch (error) {
    console.error('操作失败:', error)
    toast.add({
      title: type.value === 0 ? '添加失败' : '修改失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

defineExpose({
  showModel
})
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-xl h-[min(640px,calc(100dvh-4rem))] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-700 flex-shrink-0">
        <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">
          {{ type === 0 ? '新增攒钱计划' : '编辑攒钱计划' }}
        </h2>
        <button
          type="button"
          @click="closeModel"
          class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/80 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
        <UFormGroup label="计划名称" class="mb-0">
          <UInput
            v-model="form.plan_name"
            placeholder="计划名称"
            size="sm"
            :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
          />
        </UFormGroup>

        <UFormGroup :label="`计划封面（最多 ${PLAN_COVER_MAX} 张）`" class="mb-0">
          <QhxImagePicker
            ref="imagePickerRef"
            :multiple="true"
            :max="PLAN_COVER_MAX"
          />
        </UFormGroup>

        <!-- 母计划：金额 + 尾款时间同行（与定尾阶段一致） -->
        <div class="grid grid-cols-[100px_1fr] gap-2 items-end">
          <UInput
            :disabled="getListLength !== 0"
            v-model.number="form.need_money"
            type="number"
            placeholder="需要资金"
            size="sm"
            :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
          />
          <QhxDateTimePicker
            v-model="form.end_time"
            placeholder="尾款时间"
            :format="TIME_FORMAT"
          />
        </div>

        <UFormGroup label="备注" class="mb-0">
          <UTextarea
            v-model="form.plan_note"
            placeholder="可选"
            :rows="2"
            size="sm"
            :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
          />
        </UFormGroup>

        <!-- 关联服饰 -->
        <UFormGroup v-if="enableLinkClothes" label="关联服饰" class="mb-0">
          <div class="flex items-stretch gap-2">
            <button
              type="button"
              class="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-gray-200/70 dark:border-gray-600/70 bg-gray-50/80 dark:bg-gray-800/50 px-3 py-2 text-left text-sm transition hover:border-qhx-primary/50 hover:bg-qhx-primary/5"
              @click="openClothesPicker"
            >
              <template v-if="selectedLinkedClothes?.clothes_id">
                <div class="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                  <img
                    v-if="selectedLinkedClothes.clothes_img"
                    :src="`${BASE_IMG}${selectedLinkedClothes.clothes_img}${getImageParams()}`"
                    :alt="selectedLinkedClothes.clothes_note || ''"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <UIcon name="i-heroicons-shirt" class="w-5 h-5" />
                  </div>
                </div>
                <span class="truncate text-gray-800 dark:text-gray-100 font-medium">
                  {{ selectedLinkedClothes.clothes_note || `服饰 #${selectedLinkedClothes.clothes_id}` }}
                </span>
              </template>
              <span v-else class="text-gray-400 dark:text-gray-500">点击选择衣柜服饰</span>
            </button>
            <UButton
              v-if="selectedLinkedClothes?.clothes_id"
              color="gray"
              variant="ghost"
              size="sm"
              icon="i-heroicons-x-mark"
              class="flex-shrink-0 self-center"
              aria-label="清除关联"
              @click="clearLinkedClothes"
            />
          </div>
        </UFormGroup>

        <!-- 新增定尾阶段 -->
        <UButton
          color="primary"
          variant="soft"
          size="xs"
          icon="i-heroicons-plus"
          class="w-fit bg-qhx-primary/10 text-qhx-primary hover:bg-qhx-primary/20"
          @click="addPlan"
        >
          新增定尾阶段
        </UButton>

        <!-- 阶段列表 -->
        <div v-if="list.length > 0" class="space-y-2 border-t border-gray-200/60 dark:border-gray-700 pt-3">
          <div
            v-for="(stage, index) in list"
            :key="index"
            class="p-2.5 rounded-lg bg-gray-50/80 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-600/50 space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">阶段 {{ index + 1 }}</span>
              <UButton color="red" variant="ghost" size="xs" icon="i-heroicons-trash" @click="deleteList(index)" />
            </div>
            <div class="grid grid-cols-[80px_1fr] gap-2 items-end">
              <UInput
                v-model.number="stage.need_money"
                type="number"
                placeholder="金额"
                size="sm"
                :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
              />
              <QhxDateTimePicker
                v-model="stage.end_time"
                placeholder="尾款时间"
                :format="TIME_FORMAT"
              />
            </div>
            <UInput
              v-model="stage.plan_note"
              placeholder="备注（可选）"
              size="sm"
              :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
            />
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200/60 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton color="gray" variant="ghost" size="sm" @click="closeModel">取消</UButton>
        <UButton
          :loading="loading"
          size="sm"
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="handleSubmit"
        >
          {{ type === 1 ? '保存' : '新增' }}
        </UButton>
      </div>
    </div>
  </QhxModal>
  <WardrobeClothesChoose ref="wardrobeClothesChooseRef" @choose="onClothesChosen" />
</template>

