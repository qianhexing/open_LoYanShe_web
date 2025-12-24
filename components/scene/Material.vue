<script setup lang="ts">
import type { Effect, Material, TemplateInterface } from '@/types/api';
const configStore = useConfigStore()
import { uploadImage } from '@/api';
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type * as THREE from 'three'
const imagePicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)
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
  panelType?: 'material' | 'template' | 'effect' | null // 面板类型
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
            <MateriaList @choose="chooseMaterial"></MateriaList>
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
      <MateriaList @choose="chooseMaterial" :compact="true"></MateriaList>
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
</template>

<style scoped></style>
