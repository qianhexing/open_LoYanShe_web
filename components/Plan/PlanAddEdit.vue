<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { PlanList } from '@/types/api'
import { insertPlanList, updatePlanList } from '@/api/plan'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
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
}

const props = withDefaults(defineProps<Props>(), {
  planList: null,
  needStatus: false,
  dontUpload: true
})

const emit = defineEmits<{
  (e: 'success', params: any): void
  (e: 'edit'): void
  (e: 'insert', data: PlanList): void
}>()

const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 添加 1 编辑
const toast = useToast()
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

  // 如果不自动上传，直接触发事件
  if (!props.dontUpload) {
    emit('success', params)
    closeModel()
    return
  }

  loading.value = true
  try {
    if (type.value === 0) {
      const res = await insertPlanList(params)
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('edit')
      emit('insert', res)
      closeModel()
    } else {
      const res = await updatePlanList(params)
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      emit('edit')
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
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold">
          {{ type === 0 ? '新增攒钱计划' : '编辑攒钱计划' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <!-- 计划名称 -->
        <UFormGroup label="计划名称">
          <UInput
            v-model="form.plan_name"
            type="text"
            placeholder="计划名称"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>

        <!-- 计划封面 -->
        <UFormGroup label="计划封面">
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <QhxImagePicker 
              :multiple="false" 
              @update:files="onUpdateFiles" 
              ref="imagePickerRef" 
            />
          </div>
        </UFormGroup>

        <!-- 需要资金 -->
        <UFormGroup label="需要资金">
          <UInput
            :disabled="getListLength !== 0"
            v-model.number="form.need_money"
            type="number"
            placeholder="需要资金"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>

        <!-- 备注 -->
        <UFormGroup label="备注">
          <UTextarea
            v-model="form.plan_note"
            placeholder="备注"
            :rows="3"
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
        </UFormGroup>

        <!-- 尾款时间 -->
        <UFormGroup label="尾款时间">
          <div class="flex items-center gap-2">
            <VueDatePicker
              v-model="form.end_time"
              :enable-time-picker="true"
              format="yyyy-MM-dd HH:mm:ss"
              placeholder="选择结束时间"
            />
            <UButton
              v-if="form.end_time"
              color="red"
              variant="ghost"
              size="xs"
              icon="i-heroicons-x-mark"
              @click="form.end_time = null"
            />
          </div>
        </UFormGroup>

        <!-- 新增定尾阶段 -->
        <div class="flex items-center gap-2 p-2">
          <UButton
            color="primary"
            size="sm"
            icon="i-heroicons-plus"
            @click="addPlan"
          >
            新增定尾阶段
          </UButton>
        </div>

        <!-- 阶段列表 -->
        <div v-if="list.length > 0" class="space-y-4 border-t pt-4">
          <div v-for="(stage, index) in list" :key="index" class="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                阶段 {{ index + 1 }}
              </h3>
              <UButton
                color="red"
                variant="ghost"
                size="xs"
                icon="i-heroicons-trash"
                @click="deleteList(index)"
              />
            </div>

            <!-- 需要资金 -->
            <UFormGroup label="需要资金">
              <UInput
                v-model.number="stage.need_money"
                type="number"
                placeholder="需要资金"
                :ui="{
                  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                  rounded: 'rounded-full',
                  padding: { xs: 'px-4 py-2' },
                  color: {
                    white: {
                      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                    }
                  }
                }"
              />
            </UFormGroup>

            <!-- 备注 -->
            <UFormGroup label="备注">
              <UTextarea
                v-model="stage.plan_note"
                placeholder="备注"
                :rows="2"
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
            </UFormGroup>

            <!-- 尾款时间 -->
            <UFormGroup label="尾款时间">
              <div class="flex items-center gap-2">
                <VueDatePicker
                  v-model="stage.end_time"
                  :enable-time-picker="true"
                  format="yyyy-MM-dd HH:mm:ss"
                  placeholder="选择结束时间"
                />
                <UButton
                  v-if="stage.end_time"
                  color="red"
                  variant="ghost"
                  size="xs"
                  icon="i-heroicons-x-mark"
                  @click="stage.end_time = null"
                />
              </div>
            </UFormGroup>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton 
          color="gray" 
          variant="ghost"
          @click="closeModel"
          class="px-6"
        >
          取消
        </UButton>
        <UButton
          :loading="loading"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="handleSubmit"
        >
          {{ type === 1 ? '确认修改' : '确认新增' }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
.close-btn {
  display: inline-block;
  margin-left: 2px;
  font-size: 14px;
}
</style>

