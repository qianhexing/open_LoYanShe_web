<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { PlanList, WardrobeClothes } from '@/types/api'
import { insertPlanList, updatePlanList, planListRelate } from '@/api/plan'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import { useConfigStore } from '@/stores/config'
import dayjs from 'dayjs'

interface PlanStage {
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
      // 处理日期，可能是 Date 对象或字符串
      if (end_time) {
        form.value.end_time = typeof end_time === 'string' 
          ? end_time 
          : dayjs(end_time).format('YYYY-MM-DD HH:mm:ss')
      } else {
        form.value.end_time = null
      }
      form.value.plan_cover = plan_cover || ''
      
      // 设置封面图片预览
      nextTick(() => {
        if (imagePickerRef.value && plan_cover) {
          imagePickerRef.value.previewImages = [{ 
            id: `img_${Date.now()}_${Math.random()}`,
            file: undefined as unknown as File, 
            url: BASE_IMG + plan_cover 
          }]
        }
      })
      
      // 如果有子计划列表（plan_list），需要从后端获取或处理
      // 这里假设 plan_list 是一个数组
      if ((props.planList as any).plan_list && Array.isArray((props.planList as any).plan_list)) {
        list.value = (props.planList as any).plan_list.map((item: any) => ({
          need_money: item.need_money || 0,
          end_time: item.end_time 
            ? (typeof item.end_time === 'string' 
                ? item.end_time 
                : dayjs(item.end_time).format('YYYY-MM-DD HH:mm:ss'))
            : null,
          plan_note: item.plan_note || ''
        }))
      } else {
        list.value = []
      }
    } else {
      type.value = 0
      if (props.initialNeedMoney && props.initialNeedMoney > 0) {
        form.value.need_money = props.initialNeedMoney
      }
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

// 格式化日期
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return ''
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
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

// 处理图片上传
const onUpdateFiles = async (files: File[]) => {
  if (files.length > 0) {
    try {
      const result = await uploadImage(files[0])
      form.value.plan_cover = result.file_url
    } catch (error) {
      console.error('图片上传失败:', error)
      toast.add({
        title: '图片上传失败',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
    }
  } else {
    // 如果清空了图片，清空封面
    form.value.plan_cover = ''
  }
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

  // 如果有新的封面图片，使用新的；否则在编辑模式下保留原有的
  if (form.value.plan_cover && form.value.plan_cover !== '') {
    params.plan_cover = form.value.plan_cover
  } else if (props.planList && props.planList.plan_cover) {
    // 编辑模式下，如果没有上传新图片，保留原有图片
    params.plan_cover = props.planList.plan_cover
  }

  // 如果不自动上传，直接触发事件（服饰关联由父级或后续接口处理）
  if (!props.dontUpload) {
    if (props.enableLinkClothes) {
      params.clothes_id = selectedLinkedClothes.value?.clothes_id ?? null
    }
    emit('success', params)
    closeModel()
    return
  }

  loading.value = true
  try {
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
      const planListFormatted = list.value.map((item, idx) => {
        const original = props.planList?.plan_list?.[idx]
        return {
          ...original,
          list_id: original?.list_id,
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
    <div class="w-[95vw] max-w-xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
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
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- 首行：名称 + 资金 -->
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3">
          <UFormGroup label="计划名称" class="mb-0">
            <UInput
              v-model="form.plan_name"
              placeholder="计划名称"
              size="sm"
              :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
            />
          </UFormGroup>
          <UFormGroup label="需要资金" class="mb-0">
            <UInput
              :disabled="getListLength !== 0"
              v-model.number="form.need_money"
              type="number"
              placeholder="0"
              size="sm"
              :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
            />
          </UFormGroup>
        </div>

        <!-- 封面 -->
        <UFormGroup label="计划封面" class="mb-0">
          <div class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700/30 border border-gray-200/60 dark:border-gray-600/60">
            <QhxImagePicker :multiple="false" @update:files="onUpdateFiles" ref="imagePickerRef" />
          </div>
        </UFormGroup>

        <!-- 尾款时间 + 备注 -->
        <UFormGroup label="尾款时间" class="mb-0">
          <div class="flex items-center gap-1.5">
            <QhxDateTimePicker v-model="form.end_time" placeholder="选择结束时间" />
            <UButton v-if="form.end_time" color="red" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="form.end_time = null" />
          </div>
        </UFormGroup>
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
        <div v-if="list.length > 0" class="space-y-3 border-t border-gray-200/60 dark:border-gray-700 pt-3">
          <div
            v-for="(stage, index) in list"
            :key="index"
            class="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-600/50 space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">阶段 {{ index + 1 }}</span>
              <UButton color="red" variant="ghost" size="xs" icon="i-heroicons-trash" @click="deleteList(index)" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-2">
              <UFormGroup label="金额" class="mb-0">
                <UInput
                  v-model.number="stage.need_money"
                  type="number"
                  placeholder="0"
                  size="sm"
                  :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
                />
              </UFormGroup>
              <UFormGroup label="尾款时间" class="mb-0">
                <div class="flex items-center gap-1.5">
                  <QhxDateTimePicker v-model="stage.end_time" placeholder="选时间" />
                  <UButton v-if="stage.end_time" color="red" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="stage.end_time = null" />
                </div>
              </UFormGroup>
            </div>
            <UFormGroup label="备注" class="mb-0">
              <UTextarea
                v-model="stage.plan_note"
                placeholder="可选"
                :rows="1"
                size="sm"
                :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
              />
            </UFormGroup>
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

