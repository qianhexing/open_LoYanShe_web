<script setup lang="ts">
import type { Effect, Material, TemplateInterface } from '@/types/api';
const configStore = useConfigStore()
import { uploadImage } from '@/api';
import { insertMaterial } from '@/api/material'
import { uploadFileToOSS } from '@/utils/ossUpload'
import { createGltfCoverBlob } from '@/utils/gltfCoverSnapshot'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type * as THREE from 'three'
const imagePicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const toast = useToast()
const customUploadInput = ref<HTMLInputElement | null>(null)
const customUploading = ref(false)
const customMateriaListKey = ref(0)
const gltfEditOpen = ref(false)
const gltfEditTarget = ref<Material | null>(null)

function openGltfEdit(m: Material) {
  gltfEditTarget.value = m
  gltfEditOpen.value = true
}

function onGltfMaterialEditSuccess() {
  customMateriaListKey.value += 1
}
const show = ref(false)
const diary = ref(false)
const textShow = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const imageType = ref(0) // 0是添加图片 1是添加背景
const diaryForm = reactive({
  title: '',
  content: '',
})
const textForm = reactive({
  title: '',
})
interface Props {
  className?: string,
  needJump?: boolean // 是否需要跳转
  loadTemplate?: boolean
  panelType?: 'material' | 'template' | 'effect' | 'clothing' | 'scene' | 'custom' | null // 面板类型
}
const addImage = () => {
  imageType.value = 0
  if (imagePicker.value) {
    imagePicker.value.triggerInput()
  }
}
const addBackground = () => {
  imageType.value = 1
  if (imagePicker.value) {
    imagePicker.value.triggerInput()
  }
}


const showModel = () => {
  show.value = true
}
const addDiary = (e: MouseEvent) => {
  diary.value = true
  clickPosition.value = {
    x: e.clientX, y: e.clientY
  }
}
const closeModel = () => {
  show.value = false
}
const props = withDefaults(defineProps<Props>(), {
  panelType: null
})
const { loadTemplate, panelType } = toRefs(props)
// 记录已访问的面板类型，懒加载：首次访问才挂载，切换时保持挂载不重新加载
const visitedTypes = ref<Set<'material' | 'clothing' | 'template' | 'effect' | 'scene' | 'custom'>>(new Set())
watch(panelType, (val) => {
    if (val && !visitedTypes.value.has(val)) {
        visitedTypes.value = new Set([...visitedTypes.value, val])
    }
}, { immediate: true })
const emit = defineEmits(['addImage', 'saveScene', 'addDiary', 'chooseTemplate', 'chooseEffect', 'clearTemplate', 'recordCamera', 'addBackgroun', 'chooseMaterial', 'addText'])

const saveScene = () => {
  emit('saveScene')
}
const addText = () => {
  textShow.value = true
}

const confirmAddText = () => {
  if (textForm.title) {
    emit('addText', textForm.title)
    textForm.title = ''
    textShow.value = false
  }
}

const emitDiary = () => {
  emit('addDiary', diaryForm)
}

const chooseTemplate = (item: TemplateInterface) => {
  emit('chooseTemplate', item)
}
const chooseMaterial = (item: Material) => {
  emit('chooseMaterial', item)
}

const chooseEffect = (item: Effect) => {
  emit('chooseEffect', item)
}
const clearTemplate = () => {
  emit('clearTemplate')
}
const recordCamera = () =>{
  emit('recordCamera')
}

const triggerCustomUpload = () => {
  customUploadInput.value?.click()
}

const onCustomFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const lower = file.name.toLowerCase()
  const isGltf = lower.endsWith('.glb') || lower.endsWith('.gltf')
  const isImage = file.type.startsWith('image/')

  if (!isGltf && !isImage) {
    toast.add({
      title: '格式不支持',
      description: '请选择图片或 .glb / .gltf 文件',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  customUploading.value = true
  try {
    if (isImage) {
      const uploaded = await uploadImage(file)
      const created = await insertMaterial({
        materia_title: file.name,
        materia_url: uploaded.file_url,
        cover: uploaded.file_url,
        pk_type: 5,
        pk_id: uploaded.file_id,
        is_enable: 1,
        is_private: 0,
        options: { assetKind: 'image' }
      })
      chooseMaterial(created)
    } else {
      const uploaded = await uploadFileToOSS(file, 'material')
      let coverUrl: string | null = null
      try {
        const blob = await createGltfCoverBlob(file)
        const png = new File(
          [blob],
          `materia-cover-${Date.now()}.png`,
          { type: 'image/png' }
        )
        const coverRes = await uploadFileToOSS(png, 'editor')
        coverUrl = coverRes.file_url
      } catch (coverErr) {
        console.error('GLB/GLTF 自动封面失败:', coverErr)
        toast.add({
          title: '模型已上传，封面未自动生成',
          description: '可稍后在素材管理中补充封面',
          icon: 'i-heroicons-exclamation-triangle',
          color: 'orange'
        })
      }
      const created = await insertMaterial({
        materia_title: file.name,
        materia_url: uploaded.file_url,
        cover: coverUrl,
        pk_type: 5,
        pk_id: uploaded.file_id,
        is_private: 0,
        options: { assetKind: 'model', useDracoLoader: true }
      })
      chooseMaterial(created)
    }
    customMateriaListKey.value += 1
    toast.add({
      title: '已添加',
      description: '素材已上传并加入场景',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (err) {
    console.error('自定义素材上传失败:', err)
    toast.add({
      title: '上传失败',
      description: err instanceof Error ? err.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    customUploading.value = false
  }
}

const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  uploadImage(file[0])
    .then(async (res) => {
      console.log('上传返回', res)
      if ( imageType.value === 0) {
        emit('addImage', res)

      } else {
        emit('addBackgroun', res)

      }
      
      if (imagePicker.value) {
        imagePicker.value.clear()
      }
    })
}
const { needJump } = props
defineExpose({
  showModel,
  addImage,
  addBackground,
  addDiary,
  addText
})
</script>
<template>
  <input
    ref="customUploadInput"
    type="file"
    class="hidden"
    accept="image/*,.glb,.gltf,model/gltf-binary,model/gltf+json"
    @change="onCustomFileChange"
  >
  <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" class="hidden" ref="imagePicker" />
  <QhxModal v-model="diary" :trigger-position="clickPosition">
    <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
      <UInput v-model="diaryForm.title" :placeholder="'标题'" class="flex-1 focus:ring-0" :ui="{
        base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
        rounded: 'rounded-[10px]',
        padding: { xs: 'px-4 py-2' },
        color: {
          white: {
            outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
          }
        }
      }" />
      <UTextarea v-model="diaryForm.content" :placeholder="'内容'" type="texare" class="flex-1 focus:ring-0 pt-3" :ui="{
        base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
        rounded: 'rounded-[10px]',
        padding: { xs: 'px-4 py-2' },
        color: {
          white: {
            outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
          }
        }
      }" />
      <UButton type="submit" block class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
        @click="emitDiary()">
        添加
      </UButton>
    </div>
  </QhxModal>
  <QhxModal v-model="textShow" :trigger-position="clickPosition">
    <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
      <UInput v-model="textForm.title" :placeholder="'文本内容'" class="flex-1 focus:ring-0" :ui="{
        base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
        rounded: 'rounded-[10px]',
        padding: { xs: 'px-4 py-2' },
        color: {
          white: {
            outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
          }
        }
      }" />
      <div class="text-sm text-gray-500 mt-2">3D文本不会换行，需要换行请使用添加多个文本</div>
      <UButton type="submit" block class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
        @click="confirmAddText()">
        添加
      </UButton>
    </div>
  </QhxModal>
  <!-- 旧版弹窗模式（保留兼容性） -->
  <div v-if="!panelType" class="w-full fixed transition-all duration-300 bottom-0 left-0 z-20 h-[500px] md:h-full md:w-[500px]  bg-qhx-bg"
    :class="show ? '' : 'bottom-[-500px] md:bottom-[0px] md:left-[-500px]'">
    <div class="fun-head h-[60px] border-b flex">
      <div class="flex flex-1">
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="saveScene()">
              <UIcon name="ant-design:file-filled" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">保存</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="addImage()">
              <UIcon name="ant-design:picture-filled" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">图片</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="addDiary($event)" style="font-size: 22px">
              <UIcon name="icon-park-outline:add-text" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">日记点</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1 cursor-pointer" @click="recordCamera()">
            <div
              class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
               style="font-size: 22px">
              <UIcon name="material-symbols:video-camera-back" class="text-[22px] text-[#ffffff]" />
            </div>
            <div class=" text-sm">记录镜头</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="addBackground()">
              <UIcon name="ant-design:picture-filled" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">背景</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1  cursor-pointer">
            <div
              class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
              @click="textShow = true" style="font-size: 22px">
              <UIcon name="icon-park-outline:add-text" class="text-[22px] text-[#ffffff]" />
            </div>
            <div  class=" text-sm">文本</div>
          </div>
        </QhxJellyButton>
      </div>
      <QhxJellyButton>
        <div class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
          @click="closeModel()">
          <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
        </div>
      </QhxJellyButton>
    </div>
    <QhxTabs :tabs="['素材', '模版', '特效']">
      <QhxTabPanel :index="0">
        <template #default="{ isActive }">
          <div class="bg-white h-[370px] md:h-[calc(100vh-130px)] overflow-y-auto">
            <MateriaList @choose="chooseMaterial" :pk-type="[0, 1, 2]"></MateriaList>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="1">
        <template #default="{ isActive }">
          <div class="bg-white h-[370px] md:h-[calc(100vh-130px)] overflow-y-auto">
            <QhxJellyButton v-show="loadTemplate">
              <div class="h-[60px] text-center px-1 cursor-pointer" @click="clearTemplate()">
                <div
                  class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
                  style="font-size: 22px">
                  <UIcon name="material-symbols:video-camera-back" class="text-[22px] text-[#ffffff]" />
                </div>
                <div class=" text-sm">清空模版</div>
              </div>
            </QhxJellyButton>
            <TemplateList @choose="chooseTemplate"></TemplateList>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="2">
        <template #default="{ isActive }">
          <div class="bg-white h-[370px] md:h-[calc(100vh-130px)] overflow-y-auto">
            <EffectList @choose="chooseEffect"></EffectList>
          </div>
        </template>
      </QhxTabPanel>
    </QhxTabs>
  </div>

  <!-- 新版右侧面板模式 -->
  <div v-else class="w-full">
    <!-- 素材列表 -->
    <div v-if="panelType === 'material'" class="w-full">
      <MateriaList @choose="chooseMaterial" :compact="true" :pk-type="[0, 1, 2]"></MateriaList>
    </div>
    
    <!-- 服饰列表 -->
    <div v-if="panelType === 'clothing'" class="w-full">
      <MateriaList @choose="chooseMaterial" :compact="true" :pk-type="3"></MateriaList>
    </div>

    <!-- 场景列表 -->
    <div v-if="panelType === 'scene'" class="w-full">
      <MateriaList @choose="chooseMaterial" :compact="true" :pk-type="4"></MateriaList>
    </div>

    <!-- 自定义素材（pk_type 与后端约定为 5） -->
    <div v-if="panelType === 'custom'" class="w-full">
      <div class="mb-1.5 px-0.5 shrink-0">
        <button
          type="button"
          class="w-full h-8 text-[10px] font-medium text-center px-1.5 cursor-pointer flex items-center justify-center gap-1 bg-indigo-50 dark:bg-indigo-900/25 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200/70 dark:border-indigo-700/50 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
          :disabled="customUploading"
          title="上传图片或 glTF / GLB 模型"
          @click="triggerCustomUpload"
        >
          <UIcon
            :name="customUploading ? 'svg-spinners:ring-resize' : 'material-symbols:add-rounded'"
            class="text-sm shrink-0"
          />
          <span>{{ customUploading ? '上传中…' : '上传' }}</span>
        </button>
      </div>
      <MateriaList
        :key="customMateriaListKey"
        hide-item-title
        allow-delete
        allow-gltf-edit
        @choose="chooseMaterial"
        @edit-gltf="openGltfEdit"
        :compact="true"
        :pk-type="5"
      />
    </div>
    
    <!-- 模版列表 -->
    <div v-if="panelType === 'template'" class="w-full">
      <div v-if="loadTemplate" class="mb-1 px-1 pt-1">
        <button 
          @click="clearTemplate()"
          class="w-full h-6 text-[10px] text-center px-1.5 cursor-pointer flex items-center justify-center gap-0.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors active:scale-95"
        >
          <UIcon name="material-symbols:delete-outline" class="text-[10px]" />
          <span>清空模版</span>
        </button>
      </div>
      <TemplateList @choose="chooseTemplate" :compact="true"></TemplateList>
    </div>
    
    <!-- 特效列表 -->
    <div v-if="panelType === 'effect'" class="w-full">
      <EffectList @choose="chooseEffect" :compact="true"></EffectList>
    </div>
  </div>

  <MateriaGltfModelEditModal
    v-model="gltfEditOpen"
    :material="gltfEditTarget"
    @success="onGltfMaterialEditSuccess"
  />
</template>

<style scoped></style>
