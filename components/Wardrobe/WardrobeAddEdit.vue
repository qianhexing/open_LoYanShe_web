<template>
  <UModal v-model="show" :ui="{ width: 'max-w-3xl'  }" prevent-close>
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            {{ type === 0 ? '新增服饰' : '编辑服饰' }}
          </h2>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="show = false"
          />
        </div>
      </template>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-2">

        <!-- 衣柜名称 -->
        <!-- 名称 -->
        <UFormGroup label="衣柜名称">
          <UInput
            v-model="form.wardrobe_name"
            placeholder="请输入衣柜名称"
            class="flex-1 focus:ring-0"
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
        <!-- 衣柜封面 -->
        <UFormGroup label="衣柜封面">
          <QhxImagePicker :multiple="false" @update:files="onUpdateFiles" ref="wardrobeCoverRef" />
        </UFormGroup>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="show = false">取消</UButton>
          <UButton
            :loading="loading"
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="insert"
          >
            {{ type === 1 ? '确认修改' : '确认添加' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>


<script setup lang="ts">
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const show = ref<boolean>(false) 

const emit = defineEmits(['success'])
const showModel = () => {
  show.value = true
}
const type = ref<number>(0)
const loading = ref<boolean>(false)
const insert = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 1000)
}
const wardrobeCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const onUpdateFiles = (file: File[]) => {
  console.log(file)
}
const form = ref<{
  wardrobe_name: string
  wardrobe_cover: string
}>({
  wardrobe_name: '',
  wardrobe_cover: ''
})

const props = defineProps<{
  show: boolean
}>()
defineExpose({
  showModel
})


</script>
