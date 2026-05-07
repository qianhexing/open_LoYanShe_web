<script setup lang="ts">
/**
 * 无界面客户端组件：对 GLB/GLTF 做离屏加载、包围盒聚焦、截屏并上传 OSS，
 * 通过 v-model 或 success 事件把封面 file_url 交给父级（如 formData.cover）。
 */
import { ref } from 'vue'
import { createGltfCoverBlob } from '@/utils/gltfCoverSnapshot'
import { uploadFileToOSS } from '@/utils/ossUpload'

const props = withDefaults(
  defineProps<{
    /** 与封面上传接口路径一致，默认与手动选图相同 */
    uploadPath?: string
    shotWidth?: number
    shotHeight?: number
    /** 可绑定素材封面 file_url */
    modelValue?: string | null
  }>(),
  {
    uploadPath: 'editor',
    shotWidth: 512,
    shotHeight: 512,
    modelValue: null
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  success: [fileUrl: string]
  error: [err: Error]
}>()

const busy = ref(false)

/**
 * 从已选择的 GLB/GLTF 文件生成截图并上传，返回相对路径 file_url
 */
async function generateAndUploadFromFile(file: File): Promise<string> {
  if (!/\.(glb|gltf)$/i.test(file.name)) {
    const err = new Error('需要 GLB 或 GLTF 文件以生成封面')
    emit('error', err)
    throw err
  }
  busy.value = true
  try {
    const blob = await createGltfCoverBlob(file, {
      width: props.shotWidth,
      height: props.shotHeight
    })
    const name = `materia-cover-${Date.now()}.png`
    const png = new File([blob], name, { type: 'image/png' })
    const { file_url } = await uploadFileToOSS(png, props.uploadPath)
    emit('update:modelValue', file_url)
    emit('success', file_url)
    return file_url
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    emit('error', err)
    throw err
  } finally {
    busy.value = false
  }
}

defineExpose({
  /** 从本地模型文件截屏并上传，写入 v-model */
  generateAndUploadFromFile,
  busy
})
</script>

<template>
  <span class="sr-only" aria-hidden="true">GltfCoverCapture</span>
</template>
