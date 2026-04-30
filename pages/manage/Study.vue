<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">研习管理</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            顶级 parent_id 为 0。仅「学习板块」或内部链接且地址含 pages/study/studyMore
            时显示展开（且 is_bottom≠1）；点击后请求下级。
          </p>
        </div>
        <UButton
          class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
          icon="i-heroicons-plus"
          @click="showAddModal = true"
        >
          添加研习
        </UButton>
      </div>

      <div class="mb-6">
        <div class="flex gap-2">
          <UInput
            v-model="searchKeyword"
            placeholder="搜索标题..."
            class="flex-1"
            icon="i-heroicons-magnifying-glass"
            @keyup.enter="handleSearch"
          />
          <UButton class="bg-qhx-primary text-white hover:bg-qhx-primaryHover" @click="handleSearch">
            搜索
          </UButton>
          <UButton v-if="searchKeyword" variant="outline" @click="handleReset">
            重置
          </UButton>
        </div>
      </div>

      <div
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-[960px] w-full text-left text-sm">
            <thead class="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th
                  class="px-2 py-3 font-medium w-10 text-center"
                  title="学习板块或 studyMore 内部链接且非底层时可展开"
                  aria-label="展开"
                />
                <th class="px-3 py-3 font-medium whitespace-nowrap w-[72px] text-right tabular-nums">ID</th>
                <th class="px-4 py-3 font-medium w-[72px]">封面</th>
                <th class="px-4 py-3 font-medium min-w-[160px]">标题</th>
                <th class="px-4 py-3 font-medium whitespace-nowrap">类型</th>
                <th class="px-4 py-3 font-medium whitespace-nowrap w-20">排序</th>
                <th class="px-4 py-3 font-medium whitespace-nowrap w-24">上级 ID</th>
                <th class="px-4 py-3 font-medium min-w-[200px]">跳转</th>
                <th class="px-4 py-3 font-medium whitespace-nowrap w-24">子项数</th>
                <th class="px-4 py-3 font-medium text-right whitespace-nowrap w-36">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="loading">
                <td colspan="10" class="px-4 py-16 text-center text-gray-500 dark:text-gray-400">
                  <span class="inline-flex items-center gap-2">
                    <span
                      class="w-5 h-5 border-2 border-qhx-primary border-t-transparent rounded-full animate-spin"
                    />
                    加载中…
                  </span>
                </td>
              </tr>
              <StudyManageTreeRows v-if="!loading && list.length" :rows="list" :depth="0" />
              <tr v-if="!loading && !list.length">
                <td colspan="10" class="px-4 py-16 text-center">
                  <div class="text-4xl mb-3">📚</div>
                  <p class="text-gray-500 dark:text-gray-400 mb-4">暂无研习条目</p>
                  <UButton
                    class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
                    @click="showAddModal = true"
                  >
                    添加第一条
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="!loading && total > 0" class="mt-6 flex justify-center">
        <UPagination
          v-model="page"
          :total="total"
          :page-count="pageSize"
          :ui="{
            wrapper: 'flex items-center gap-1',
            base: 'flex items-center gap-1'
          }"
        />
      </div>
    </div>

    <UModal v-model="showAddModal" :ui="{ width: 'max-w-2xl' }">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ editingStudy ? '编辑研习' : '添加研习' }}
            </h3>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="handleCloseModal" />
          </div>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
            <UInput v-model="formData.study_title" placeholder="请输入标题" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">简介</label>
            <UTextarea v-model="formData.study_desc" placeholder="可选" :rows="3" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">研习类型</label>
            <USelect
              v-model="formData.study_type"
              :options="studyMainTypeOptions"
              placeholder="选择类型"
              value-attribute="value"
              option-attribute="label"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              0 学习板块 · 1 内部链接（APP pages 路径，对应下方类型映射）· 2 外部链接
            </p>
          </div>
          <div v-if="formData.study_type === 0" class="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
            学习板块将跳转至研习详情页（/study/detail/:id），无需填写链接。
          </div>
          <div v-else-if="formData.study_type === 1" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                APP 路径模板（类型映射）
              </label>
              <USelect
                :model-value="internalMapPick"
                :options="internalMappingOptions"
                placeholder="选择模板，或留空后手动输入"
                value-attribute="value"
                option-attribute="label"
                @update:model-value="onInternalTemplatePick"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                仅内部链接需要与 APP 一致的 pages/… 路径；选择模板会填入前缀，请补全 id 等参数。
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">APP 路径</label>
              <UInput
                v-model="formData.study_url"
                placeholder="例：pages/study/studyMore?id=123"
              />
            </div>
          </div>
          <div v-else>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">外部链接 URL</label>
            <UInput v-model="formData.study_url" placeholder="https://..." />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">排序</label>
              <UInput v-model.number="formData.sort" type="number" placeholder="数字越小越靠前" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">上级 ID</label>
              <UInput v-model.number="formData.parent_id" type="number" placeholder="0 为顶级" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">封面</label>
            <div v-if="formData.study_cover" class="mb-2">
              <img
                :src="formatImg(formData.study_cover)"
                alt="封面预览"
                class="w-32 h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
              />
            </div>
            <QhxImagePicker ref="coverPicker" :multiple="false" @update:files="handleCoverChange" />
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="handleCloseModal">取消</UButton>
            <UButton
              :loading="submitting"
              class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
              @click="handleSubmit"
            >
              {{ editingStudy ? '更新' : '添加' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showDeleteModal" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-red-600">确认删除</h3>
        </template>
        <p class="text-gray-700 dark:text-gray-300">
          确定要删除研习「{{ deletingStudy?.study_title || '未命名' }}」吗？若有子项或关联数据请先在后端确认。
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showDeleteModal = false">取消</UButton>
            <UButton :loading="deleting" color="red" @click="confirmDelete">删除</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, provide } from 'vue'
import type { Study } from '@/types/api'
import {
  getStudyList,
  insertStudy,
  updateStudy,
  deleteStudy,
  type InsertStudyParams
} from '@/api/study'
import { uploadFileToOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import {
  STUDY_INTERNAL_APP_PATH_TEMPLATES,
  STUDY_MAIN_TYPE_FORM_OPTIONS,
  studyRowCanShowTreeExpand,
  studyTypeLabel
} from '@/utils/studyTypes'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import StudyManageTreeRows from '@/components/manage/StudyManageTreeRows.vue'
import { studyManageTreeKey, type StudyManageTreeApi } from '@/composables/studyManageTree'

definePageMeta({ ssr: false })

const toast = useToast()
const configStore = useConfigStore()

const studyMainTypeOptions = [...STUDY_MAIN_TYPE_FORM_OPTIONS]
/** 内部链接：硬编码模板 + 配置里以 pages/ 开头的 value（与后台类型映射一致时可直接选用） */
const internalMappingOptions = computed(() => {
  const hard = STUDY_INTERNAL_APP_PATH_TEMPLATES.map((t) => ({ label: t.label, value: t.prefix }))
  const cfg = configStore.config?.study_type ?? []
  const fromCfg = cfg
    .filter((c) => typeof c.value === 'string' && c.value.trim().startsWith('pages/'))
    .map((c) => {
      const v = c.value.trim()
      return { label: v.length > 56 ? `${v.slice(0, 56)}…` : v, value: v }
    })
  const seen = new Set<string>()
  const merged: { label: string; value: string }[] = [{ label: '— 手动输入 —', value: '' }]
  for (const o of [...hard, ...fromCfg]) {
    if (!o.value || seen.has(o.value)) continue
    seen.add(o.value)
    merged.push(o)
  }
  return merged
})

const internalMapPick = ref('')

const submitting = ref(false)
const deleting = ref(false)
const searchKeyword = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const list = ref<Study[]>([])
const loading = ref(false)

/** 已展开父行的 study_id */
const expandedIds = ref<number[]>([])
/** 子项缓存 parentId -> rows */
const childrenCache = ref<Record<number, Study[]>>({})
/** 子项加载中 */
const childrenLoading = ref<Record<number, boolean>>({})

const showAddModal = ref(false)
const showDeleteModal = ref(false)
const editingStudy = ref<Study | null>(null)
const deletingStudy = ref<Study | null>(null)

const formData = reactive<InsertStudyParams>({
  study_title: '',
  study_desc: '',
  study_cover: null,
  study_type: 0,
  study_url: '',
  sort: 0,
  parent_id: 0
})

const coverPicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)

function syncInternalMapPickFromUrl() {
  const url = formData.study_url?.trim() || ''
  const opts = internalMappingOptions.value.filter((o) => o.value)
  const hit = [...opts].sort((a, b) => b.value.length - a.value.length).find((o) => url.startsWith(o.value))
  internalMapPick.value = hit?.value ?? ''
}

function onInternalTemplatePick(v: string | number | null) {
  const raw = v == null ? '' : String(v)
  internalMapPick.value = raw
  if (raw) {
    formData.study_url = raw
  }
}

watch(
  () => formData.study_type,
  (t) => {
    if (t === 0) {
      formData.study_url = ''
      internalMapPick.value = ''
      return
    }
    if (t !== 1) {
      internalMapPick.value = ''
      return
    }
    syncInternalMapPickFromUrl()
  }
)

const formatImg = (url: string) => {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

const canExpandRow = (row: Study) => studyRowCanShowTreeExpand(row)

const isExpanded = (studyId: number) => expandedIds.value.includes(studyId)

const childrenRows = (parentId: number) => childrenCache.value[parentId]

function collectDescendantIdsInCache(rootId: number): Set<number> {
  const out = new Set<number>()
  const walk = (pid: number) => {
    const kids = childrenCache.value[pid]
    if (!kids?.length) return
    for (const k of kids) {
      out.add(k.study_id)
      walk(k.study_id)
    }
  }
  walk(rootId)
  return out
}

const resetExpandState = () => {
  expandedIds.value = []
  childrenCache.value = {}
  childrenLoading.value = {}
}

const ensureChildrenLoaded = async (row: Study) => {
  const id = row.study_id
  if (childrenCache.value[id] !== undefined) return
  childrenLoading.value = { ...childrenLoading.value, [id]: true }
  try {
    const res = await getStudyList({ page: 1, pageSize: 200, parent_id: id })
    childrenCache.value = { ...childrenCache.value, [id]: res.rows ?? [] }
  } catch (e) {
    console.error('加载子研习失败', e)
    toast.add({ title: '加载下级失败', icon: 'i-heroicons-x-circle', color: 'red' })
    childrenCache.value = { ...childrenCache.value, [id]: [] }
  } finally {
    childrenLoading.value = { ...childrenLoading.value, [id]: false }
  }
}

const toggleExpand = async (row: Study) => {
  const id = row.study_id
  const cur = expandedIds.value
  const pos = cur.indexOf(id)
  if (pos >= 0) {
    const desc = collectDescendantIdsInCache(id)
    desc.add(id)
    expandedIds.value = cur.filter((x) => !desc.has(x))
  } else {
    expandedIds.value = [...cur, id]
    await ensureChildrenLoaded(row)
  }
}

/** 仅拉取当前页顶级列表（不重置展开与下级缓存） */
async function fetchRootPage() {
  loading.value = true
  try {
    const params: Parameters<typeof getStudyList>[0] = {
      page: page.value,
      pageSize,
      parent_id: 0
    }
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim()
    }
    const response = await getStudyList(params)
    list.value = response.rows || []
    total.value = response.count || 0
  } catch (error) {
    console.error('获取研习列表失败:', error)
    toast.add({ title: '获取研习列表失败', icon: 'i-heroicons-x-circle', color: 'red' })
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/**
 * 只刷新某一父级下的列表：parentId=0 刷新当前页顶级；否则只更新该节点的 childrenCache
 */
async function refreshLevelOnly(parentId: number) {
  const pid = parentId == null ? 0 : Number(parentId)
  if (pid === 0) {
    await fetchRootPage()
    return
  }
  childrenLoading.value = { ...childrenLoading.value, [pid]: true }
  try {
    const res = await getStudyList({ page: 1, pageSize: 200, parent_id: pid })
    childrenCache.value = { ...childrenCache.value, [pid]: res.rows ?? [] }
  } catch (e) {
    console.error('刷新下级列表失败', e)
    toast.add({ title: '刷新列表失败', icon: 'i-heroicons-x-circle', color: 'red' })
  } finally {
    childrenLoading.value = { ...childrenLoading.value, [pid]: false }
  }
}

const loadList = async () => {
  resetExpandState()
  await fetchRootPage()
}

const handleSearch = () => {
  if (page.value !== 1) {
    page.value = 1
  } else {
    loadList()
  }
}
const handleReset = () => {
  searchKeyword.value = ''
  if (page.value !== 1) {
    page.value = 1
  } else {
    loadList()
  }
}

watch(page, () => {
  loadList()
})

onMounted(() => {
  loadList()
})

const handleCoverChange = async (files: File[]) => {
  if (!files.length) return
  try {
    const result = await uploadFileToOSS(files[0])
    formData.study_cover = result.file_url
    toast.add({ title: '封面上传成功', icon: 'i-heroicons-check-circle', color: 'green' })
  } catch (error) {
    console.error(error)
    toast.add({ title: '封面上传失败', icon: 'i-heroicons-x-circle', color: 'red' })
  }
}

const handleEdit = (item: Study) => {
  editingStudy.value = item
  formData.study_title = item.study_title || ''
  formData.study_desc = item.study_desc || ''
  formData.study_cover = item.study_cover || null
  formData.study_type = item.study_type ?? 0
  formData.study_url = item.study_url || ''
  formData.sort = item.sort ?? 0
  formData.parent_id = item.parent_id ?? 0
  if (formData.study_type === 1) {
    syncInternalMapPickFromUrl()
  } else {
    internalMapPick.value = ''
  }
  showAddModal.value = true
}

const handleDelete = (item: Study) => {
  deletingStudy.value = item
  showDeleteModal.value = true
}

/** 从树行快速新增子项：与顶部「添加」相同表单，预填上级 ID */
const handleAddChild = (parent: Study) => {
  const pid = parent.study_id
  handleCloseModal()
  formData.parent_id = pid
  showAddModal.value = true
}

provide(studyManageTreeKey, {
  isExpanded,
  canExpandRow,
  toggleExpand,
  childrenRows,
  childrenLoading: (pid: number) => !!childrenLoading.value[pid],
  formatImg,
  studyTypeLabel,
  onEdit: handleEdit,
  onDelete: handleDelete,
  onAddChild: handleAddChild
} satisfies StudyManageTreeApi)

const confirmDelete = async () => {
  if (!deletingStudy.value) return
  const parentIdForRefresh = deletingStudy.value.parent_id ?? 0
  deleting.value = true
  try {
    await deleteStudy(deletingStudy.value.study_id)
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    showDeleteModal.value = false
    deletingStudy.value = null
    await refreshLevelOnly(parentIdForRefresh)
  } catch (error) {
    console.error(error)
    toast.add({ title: '删除失败', icon: 'i-heroicons-x-circle', color: 'red' })
  } finally {
    deleting.value = false
  }
}

const handleSubmit = async () => {
  if (!formData.study_title?.trim()) {
    toast.add({ title: '请填写标题', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return
  }
  const studyUrlRaw = (formData.study_url || '').trim()
  if (formData.study_type === 1 && !studyUrlRaw) {
    toast.add({ title: '内部链接请填写 APP 路径', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return
  }
  if (formData.study_type === 2 && !studyUrlRaw) {
    toast.add({ title: '请填写外部链接 URL', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return
  }
  const wasEditing = !!editingStudy.value
  const prevParentId = editingStudy.value ? (editingStudy.value.parent_id ?? 0) : 0

  submitting.value = true
  try {
    const studyUrl = formData.study_type === 0 ? '' : studyUrlRaw

    const payload: InsertStudyParams = {
      study_title: formData.study_title.trim(),
      study_desc: formData.study_desc || '',
      study_cover: formData.study_cover,
      study_type: formData.study_type,
      study_url: studyUrl,
      sort: Number(formData.sort) || 0,
      parent_id: formData.parent_id == null ? 0 : Number(formData.parent_id)
    }
    const newParentId = payload.parent_id ?? 0

    if (editingStudy.value) {
      await updateStudy({ ...payload, study_id: editingStudy.value.study_id })
      toast.add({ title: '更新成功', icon: 'i-heroicons-check-circle', color: 'green' })
    } else {
      await insertStudy(payload)
      toast.add({ title: '添加成功', icon: 'i-heroicons-check-circle', color: 'green' })
    }
    handleCloseModal()

    if (wasEditing) {
      await refreshLevelOnly(newParentId)
      if (newParentId !== prevParentId) {
        await refreshLevelOnly(prevParentId)
      }
    } else {
      await refreshLevelOnly(newParentId)
    }
  } catch (error) {
    console.error(error)
    toast.add({
      title: editingStudy.value ? '更新失败' : '添加失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}

const handleCloseModal = () => {
  showAddModal.value = false
  editingStudy.value = null
  formData.study_title = ''
  formData.study_desc = ''
  formData.study_cover = null
  formData.study_type = 0
  formData.study_url = ''
  formData.sort = 0
  formData.parent_id = 0
  internalMapPick.value = ''
  coverPicker.value?.clear()
}

useHead({ title: '研习管理 - Lo研社' })
</script>

<style scoped></style>
