<script setup lang="ts">
import { inject } from 'vue'
import { studyManageTreeKey } from '@/composables/studyManageTree'
import StudyManageTreeRows from './StudyManageTreeRows.vue'

const props = defineProps<{
  rows: Study[]
  depth: number
}>()

const tree = inject(studyManageTreeKey, null)
if (!tree) {
  throw new Error('StudyManageTreeRows 须在研习管理页内使用（缺少 provide）')
}

const padStyle = (depth: number) => ({
  paddingLeft: depth > 0 ? `calc(${0.5 + depth * 0.85}rem)` : undefined
})
</script>

<template>
  <template v-for="row in props.rows" :key="row.study_id">
    <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
      <td class="px-2 py-2 align-middle text-center" :style="padStyle(props.depth)">
        <button
          v-if="tree.canExpandRow(row)"
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors"
          :aria-expanded="tree.isExpanded(row.study_id)"
          @click.stop="tree.toggleExpand(row)"
        >
          <UIcon
            :name="tree.isExpanded(row.study_id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
            class="w-4 h-4"
          />
        </button>
        <span v-else class="inline-block w-8 shrink-0" />
      </td>
      <td class="px-3 py-2 align-middle text-right font-mono text-xs text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
        {{ row.study_id }}
      </td>
      <td class="px-4 py-2 align-middle">
        <img
          :src="tree.formatImg(row.study_cover || 'static/plan_cover/default.jpg')"
          :alt="row.study_title || ''"
          class="h-12 w-12 rounded-md object-cover border border-gray-200 dark:border-gray-600"
          loading="lazy"
        />
      </td>
      <td class="px-4 py-2 align-middle">
        <div class="flex items-center gap-2">
          <span
            v-if="Number(row.is_bottom) === 1"
            class="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium bg-gray-200/90 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
            title="底层，无下级"
          >
            底层
          </span>
          <div class="min-w-0">
            <div class="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
              {{ row.study_title || '未命名' }}
            </div>
            <div v-if="row.study_desc" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
              {{ row.study_desc }}
            </div>
          </div>
        </div>
      </td>
      <td class="px-4 py-2 align-middle whitespace-nowrap">
        <span
          class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        >
          {{ tree.studyTypeLabel(row.study_type) }}
        </span>
      </td>
      <td class="px-4 py-2 align-middle text-gray-700 dark:text-gray-300">{{ row.sort ?? 0 }}</td>
      <td class="px-4 py-2 align-middle text-gray-700 dark:text-gray-300">{{ row.parent_id ?? 0 }}</td>
      <td class="px-4 py-2 align-middle max-w-[280px]">
        <span class="text-gray-600 dark:text-gray-400 break-all line-clamp-2" :title="row.study_url || ''">
          {{ row.study_url || '—' }}
        </span>
      </td>
      <td class="px-4 py-2 align-middle text-gray-700 dark:text-gray-300">
        {{ row.child?.length ?? row.count ?? 0 }}
      </td>
      <td class="px-4 py-2 align-middle text-right">
        <div class="inline-flex flex-wrap items-center justify-end gap-1">
          <UButton
            v-if="tree.canExpandRow(row)"
            size="xs"
            variant="ghost"
            class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            icon="i-heroicons-plus"
            title="添加下级"
            @click.stop="tree.onAddChild(row)"
          >
            添加下级
          </UButton>
          <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-pencil-square" @click="tree.onEdit(row)">
            编辑
          </UButton>
          <UButton size="xs" variant="ghost" color="red" icon="i-heroicons-trash" @click="tree.onDelete(row)">
            删除
          </UButton>
        </div>
      </td>
    </tr>

    <template v-if="tree.isExpanded(row.study_id)">
      <tr v-if="tree.childrenLoading(row.study_id)" class="bg-gray-50/50 dark:bg-gray-900/30">
        <td colspan="10" class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
          <span class="inline-flex items-center gap-2">
            <span class="w-4 h-4 border-2 border-qhx-primary border-t-transparent rounded-full animate-spin" />
            加载下级…
          </span>
        </td>
      </tr>
      <tr v-else-if="!(tree.childrenRows(row.study_id)?.length)" class="bg-gray-50/50 dark:bg-gray-900/30">
        <td colspan="10" :style="padStyle(props.depth + 1)" class="px-4 py-3 text-sm text-gray-500">
          暂无下级
        </td>
      </tr>
      <StudyManageTreeRows v-else :rows="tree.childrenRows(row.study_id)!" :depth="props.depth + 1" />
    </template>
  </template>
</template>
