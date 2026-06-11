<script setup lang="ts">
import type { Library, LibraryPipe } from '@/types/api'
import {
  insertLibraryPipe,
  updateLibraryPipe,
  type PipeInsertParams,
  type PipeUpdateParams
} from '@/api/library'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import dayjs from 'dayjs'

const props = defineProps<{
  library: Library | null
}>()

const emit = defineEmits<{ success: [] }>()

const configStore = useConfigStore()
const config = computed(() => configStore.config)
const toast = useToast()

const show = ref(false)
const loading = ref(false)
const type = ref(0)
const pipeId = ref<number | null>(null)
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const pipeStateSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const includeLibraryList = ref<Library[]>([])

const form = ref<{
  startDate: string | null
  endDate: string | null
  state: string | undefined
  note: string
}>({
  startDate: null,
  endDate: null,
  state: undefined,
  note: ''
})

const pipeStateQhxOptions = computed(() =>
  (config.value?.pipe_state || []).map((item) => ({
    label: item.label,
    value: item.value
  }))
)

const resetForm = () => {
  form.value = { startDate: null, endDate: null, state: undefined, note: '' }
  includeLibraryList.value = []
  pipeId.value = null
  type.value = 0
}

const closeModel = () => {
  show.value = false
  resetForm()
}

const showModel = () => {
  resetForm()
  type.value = 0
  show.value = true
}

const editModel = (item: LibraryPipe) => {
  resetForm()
  type.value = 1
  pipeId.value = item.pipe_id
  form.value.note = item.note || ''
  form.value.state = config.value?.pipe_state.find((s) => s.value === item.state)?.label
  if (item.start_time) {
    form.value.startDate = dayjs(item.start_time).format('YYYY-MM-DD')
  }
  if (item.end_time) {
    form.value.endDate = dayjs(item.end_time).format('YYYY-MM-DD')
  }
  includeLibraryList.value = item.library_list ? [...item.library_list] : []
  show.value = true
}

const openPipeStateSelect = (e: MouseEvent) => {
  pipeStateSelectRef.value?.showPicker(e)
}

const onPipeStateSelect = (option: { label: string; value: string | number }) => {
  form.value.state = option.label
}

const showChooseLibraryList = () => {
  libraryChooseRef.value?.showModel()
}

const chooseLibraryList = (list: Library[]) => {
  includeLibraryList.value = list
}

const submit = async () => {
  if (!props.library?.library_id) return
  if (!form.value.startDate || !form.value.endDate) {
    toast.add({ title: '请选择起止时间', color: 'orange' })
    return
  }
  if (!form.value.state) {
    toast.add({ title: '请选择状态', color: 'orange' })
    return
  }
  const stateVal = config.value?.pipe_state.find((item) => item.label === form.value.state)?.value
  if (stateVal == null) {
    toast.add({ title: '状态无效', color: 'red' })
    return
  }

  const base: PipeInsertParams = {
    state: stateVal,
    start_time: `${dayjs(form.value.startDate).format('YYYY-MM-DD')} 00:00:00`,
    end_time: `${dayjs(form.value.endDate).format('YYYY-MM-DD')} 23:59:59`,
    note: form.value.note,
    pk_id: props.library.library_id,
    pk_type: 0
  }
  if (includeLibraryList.value.length > 0) {
    base.include_library = includeLibraryList.value.map((item) => item.library_id).join(',')
  }

  loading.value = true
  try {
    if (type.value === 1 && pipeId.value != null) {
      const params: PipeUpdateParams = { ...base, pipe_id: pipeId.value }
      await updateLibraryPipe(params)
      toast.add({ title: '修改成功', color: 'green' })
    } else {
      await insertLibraryPipe(base)
      toast.add({ title: '添加成功', color: 'green' })
    }
    emit('success')
    closeModel()
  } catch (error) {
    console.error(error)
    toast.add({ title: '操作失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel, editModel })
</script>

<template>
  <QhxModal v-model="show" :close-on-backdrop="false" @close="closeModel">
    <div class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {{ type === 0 ? '新增状态流水线' : '编辑状态流水线' }}
        </h2>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">起止时间 <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QhxDateTimePicker
              v-model="form.startDate"
              placeholder="开始日期"
              :enable-time-picker="false"
              format="YYYY-MM-DD"
            />
            <QhxDateTimePicker
              v-model="form.endDate"
              placeholder="结束日期"
              :enable-time-picker="false"
              format="YYYY-MM-DD"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">状态 <span class="text-red-500">*</span></label>
          <div class="flex flex-wrap items-center gap-2">
            <QhxTag v-if="form.state" :active="true">{{ form.state }}</QhxTag>
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="openPipeStateSelect($event)"
            >
              {{ form.state ? '重新选择' : '选择状态' }}
            </button>
          </div>
          <QhxSelect ref="pipeStateSelectRef" :options="pipeStateQhxOptions" @select="onPipeStateSelect" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">备注</label>
          <textarea
            v-model="form.note"
            rows="3"
            placeholder="请输入备注"
            class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-qhx-primary/40"
          />
        </div>

        <div v-if="library?.library_type === '系列'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">包含图鉴</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <QhxTag v-for="item in includeLibraryList" :key="item.library_id" :active="true">
              {{ item.name }}
            </QhxTag>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
            @click="showChooseLibraryList"
          >
            选择图鉴
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
        <button
          type="button"
          class="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
          @click="closeModel"
        >
          取消
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
          :disabled="loading"
          @click="submit"
        >
          {{ loading ? '提交中…' : type === 0 ? '确认添加' : '确认修改' }}
        </button>
      </div>
    </div>
  </QhxModal>

  <LibraryChoose
    ref="libraryChooseRef"
    :multiple="true"
    :need-parent="false"
    :filter_list="library?.library_id ? [{ field: 'parent_id', op: 'and', value: library.library_id }] : []"
    @choose="chooseLibraryList"
  />
</template>
