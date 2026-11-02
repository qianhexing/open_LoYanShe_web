<script setup lang="ts">
import { checkUserName, renameUser } from '@/api/user'
import type { User } from '@/types/api'
import {
  RENAME_EXP_COST,
  appendFormerName,
  validateUserNameFormat,
} from '@/utils/userName'

interface Props {
  modelValue: boolean
  user?: User | null
}

const props = withDefaults(defineProps<Props>(), {
  user: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const toast = useToast()
const userStore = useUserStore()

const newName = ref('')
const nameError = ref('')
const checkingName = ref(false)
const nameAvailable = ref<boolean | null>(null)
const submitting = ref(false)

const currentExp = computed(() => props.user?.exp ?? userStore.user?.exp ?? 0)
const currentName = computed(() => props.user?.user_name?.trim() ?? '')

const canSubmit = computed(() => {
  const name = newName.value.trim()
  if (!name || nameError.value) return false
  if (nameAvailable.value === false) return false
  if (submitting.value || checkingName.value) return false
  return true
})

function updateModelValue(value: boolean) {
  emit('update:modelValue', value)
  if (!value) resetForm()
}

function handleCancel() {
  updateModelValue(false)
}

function resetForm() {
  newName.value = ''
  nameError.value = ''
  checkingName.value = false
  nameAvailable.value = null
}

function applyLocalFormatCheck(): boolean {
  const name = newName.value.trim()
  const formatError = validateUserNameFormat(name)
  if (formatError) {
    nameError.value = formatError
    nameAvailable.value = null
    return false
  }
  if (name === currentName.value) {
    nameError.value = '新昵称不能与当前昵称相同'
    nameAvailable.value = null
    return false
  }
  nameError.value = ''
  return true
}

async function runAvailabilityCheck() {
  if (!applyLocalFormatCheck()) return

  const name = newName.value.trim()
  checkingName.value = true
  nameAvailable.value = null
  try {
    const available = await checkUserName({ user_name: name })
    nameAvailable.value = available
    if (!available) {
      nameError.value = '昵称已被占用'
    }
  } catch {
    nameAvailable.value = null
  } finally {
    checkingName.value = false
  }
}

async function confirmRename() {
  if (!applyLocalFormatCheck()) {
    toast.add({
      title: nameError.value || '昵称格式不正确',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange',
    })
    return
  }

  if (currentExp.value < RENAME_EXP_COST) {
    toast.add({
      title: '经验不足',
      description: `经验不足，当前=${currentExp.value}，需要减少=${RENAME_EXP_COST}`,
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange',
    })
    return
  }

  if (nameAvailable.value === false) {
    toast.add({
      title: '昵称已被占用',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'orange',
    })
    return
  }

  const name = newName.value.trim()
  const oldName = currentName.value
  submitting.value = true

  try {
    if (nameAvailable.value === null) {
      const available = await checkUserName({ user_name: name })
      if (!available) {
        nameAvailable.value = false
        nameError.value = '昵称已被占用'
        toast.add({
          title: '昵称已被占用',
          icon: 'i-heroicons-exclamation-triangle',
          color: 'orange',
        })
        return
      }
      nameAvailable.value = true
    }

    await renameUser({ user_name: name })

    try {
      await userStore.fetchUserInfo()
    } catch {
      const prev = userStore.user
      if (prev) {
        userStore.setUserInfo({
          ...prev,
          user_name: name,
          former_name: appendFormerName(prev.former_name, oldName),
          exp: Math.max(0, (prev.exp ?? 0) - RENAME_EXP_COST),
        })
      }
    }

    toast.add({
      title: '改名成功',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })

    updateModelValue(false)
    emit('success')
  } catch {
    // 失败提示由 httpCore 统一弹出（含后端 msg）
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  }
)

watch(newName, () => {
  nameAvailable.value = null
  if (newName.value.trim()) {
    applyLocalFormatCheck()
  } else {
    nameError.value = ''
  }
})
</script>

<template>
  <QhxModal :model-value="modelValue" @update:model-value="updateModelValue">
    <div
      class="flex w-[92vw] max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-2xl dark:border-gray-700/50 dark:bg-gray-800"
    >
      <div
        class="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-pink-50/90 to-orange-50/70 px-5 py-4 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800"
      >
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">
          修改昵称
        </h3>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          aria-label="关闭"
          @click="handleCancel"
        >
          <Icon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <div class="space-y-4 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          改名将消耗
          <span class="font-medium text-qhx-primary">{{ RENAME_EXP_COST }}</span>
          经验，当前经验
          <span class="font-medium tabular-nums text-gray-800 dark:text-gray-200">{{ currentExp }}</span>
        </p>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            新昵称
          </label>
          <input
            v-model="newName"
            type="text"
            maxlength="6"
            placeholder="1–6 个字，仅中文/英文/数字"
            class="w-full rounded-full border border-gray-200 bg-gray-50/90 px-4 py-2.5 text-sm text-gray-800 outline-none transition-shadow focus:border-qhx-primary/40 focus:ring-2 focus:ring-qhx-primary/30 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-100"
            @blur="runAvailabilityCheck"
          >
          <p v-if="nameError" class="mt-1.5 text-xs text-red-500">
            {{ nameError }}
          </p>
          <p v-else-if="checkingName" class="mt-1.5 text-xs text-gray-400">
            正在检查昵称…
          </p>
          <p
            v-else-if="nameAvailable === true"
            class="mt-1.5 text-xs text-green-600 dark:text-green-400"
          >
            昵称可用
          </p>
          <p
            v-else-if="nameAvailable === false"
            class="mt-1.5 text-xs text-red-500"
          >
            昵称已被占用
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
        <button
          type="button"
          class="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="handleCancel"
        >
          取消
        </button>
        <QhxJellyButton>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full bg-qhx-primary px-5 py-2 text-sm font-medium text-qhx-inverted transition-colors hover:bg-qhx-primaryHover disabled:opacity-50"
            :disabled="!canSubmit"
            @click="confirmRename"
          >
            <Icon
              v-if="submitting"
              name="i-heroicons-arrow-path"
              class="h-4 w-4 animate-spin"
            />
            确认改名
          </button>
        </QhxJellyButton>
      </div>
    </div>
  </QhxModal>
</template>
