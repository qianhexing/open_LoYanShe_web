<template>
	<div>
		
		<div class=" fixed bottom-[20px] left-[20px] rounded-[50%] w-[50px] h-[50px] z-10 items-center justify-center shadow-lg flex cursor-pointer bg-qhx-bg-card"
		@click="showMaterial()">加</div>
		<div style="height: 100vh; width: 100vw; overflow: hidden; " id="scene"></div>
		<div class="opera fixed p-3  bg-qhx-bg-card rounded-[30px] z-20 h-[60px] flex items-center" 
		v-show="clickObject"
		:style="{ left: operaPosition.x + 40 + 'px', top: operaPosition.y - 40 + 'px' }">
			<div class=" cursor-pointer px-3" >缩放</div>
			<div class=" cursor-pointer px-3" @click.stop="deleteModel()">删除</div>
		</div>
		<div @click.stop="(e) => {
			handleClickDiary(e, diary)
		}" class="fixed p-3 cursor-pointer bg-qhx-bg-card rounded-[30px] shadow-lg z-10 h-[60px] flex items-center" v-for="diary in diaryList" :style="{ left: diary.position.x + 'px', top: diary.position.y + 'px' }">
			{{ diary.title }}
		</div>
		<SceneMaterial @chooseTemplate="chooseTemplate" @addDiary="addDiary" @saveScene="saveScene" @addImage="onUpdateFiles" ref="MaterialRef"></SceneMaterial>
		<QhxModal v-model="showDiary" :trigger-position="clickPosition">
			<div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto" v-if="activeDiary">
				<div>{{ activeDiary.title }}</div>
				<div>{{ activeDiary.content }}</div>
			</div>
		</QhxModal>
	</div>
</template>
<script setup lang="ts">
import qhxCore from '@/utils/threeCore';
import * as THREE from 'three';
import type  { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getSceneId, updateScene } from '@/api/scene'
import type { PaginationResponse, Scene, TemplateInterface } from '@/types/api'
import type SceneMaterial from '@/components/scene/Material.vue'
import { uploadImage } from '~/api';
const showDiary = ref(false)
let threeCore: qhxCore
const theme = useThemeStore()
const isClick = ref(false)
const Scene1Group = ref<THREE.Group | null>(null)
const operaPosition = ref<Object<{ x: number, y: number}>>({ x: 0, y: 0})
const clickObject = ref<THREE.Object3D[] | null>(null)
const diaryList = ref([])
const activeDiary = ref(null)

	

const MaterialRef = ref<InstanceType<typeof SceneMaterial> | null>(null)

import leftContent from '@/components/home/leftContent.vue'
import rightContent from '@/components/home/rightContent.vue'
import type { App, Component } from 'vue';
import { createApp  } from 'vue'
const route = useRoute()
const edit_mode = ref(false) // 编辑模式
const token = ref<string | null>(null) // 传入的token
console.log(route.query, '路由')
const toast = useToast()
const userStore = useUserStore()
const clickPosition = ref({ x: 0, y: 0 })

if (route.query?.edit) {
	edit_mode.value = true
}
if (route.query?.token) {
	userStore.setToken(route.query.token.toString())
}
const id = route.params.id as string
useHead({
	title: 'Lo研社 Lolita图书馆',
	meta: [
		{
			name: 'keywords',
			content: 'Lo研社,洛丽塔图书馆,Lolita,Lolita汇总'
		},
		{
			name: 'description',
			content: 'Lo研社 Lolita服饰与文化研习社'
		}
	]
})

const deleteModel = () => {
	if (clickObject.value && clickObject.value.length > 0) {
		if (clickObject.value[0].userData.type === 'diary') {
			const index = threeCore.loadedDiary.findIndex((child) => {
				return clickObject.value && child.object.uuid === clickObject.value[0].uuid
			})
			if (index !== -1) {
				threeCore.loadedDiary.splice(index, 1)
			}
		}
		threeCore.clearGroup(clickObject.value[0])
		clickObject.value = null
		threeCore.gizmo.detach();
	}
}
const handleClickDiary = (e: MouseEvent, item) => {
  showDiary.value = true
  clickPosition.value = {
    x: e.clientX, y: e.clientY
  }
	activeDiary.value = item
}
const addAnimationFunc = () => {
	if (clickObject.value && clickObject.value.length > 0) {
		operaPosition.value = threeCore.screenPositionFromObject(clickObject.value[0])
	}
	const diary_list = []
	if (threeCore.loadedDiary && threeCore.loadedDiary.length > 0) {
		// biome-ignore lint/complexity/noForEach: <explanation>
			threeCore.loadedDiary.forEach((diary) => {
			const position = threeCore.screenPositionFromObject(diary.object)
			diary_list.push({...diary, position})
			// console.log('日记点位置', position)
		})
	}
	diaryList.value = diary_list
}
const { data } = await useAsyncData('studyDeatil', () => {
  return getSceneId({ sence_id: Number.parseInt(id) })
}, {})
const detail = ref<Scene | null>(null)
detail.value = data.value ?? null
const initThreejs = () => {
	threeCore = new qhxCore({
		enableCSS3DRenderer: true,
		alpha: true
	})
	// 挂载到DOM
	threeCore.mount(document.getElementById('scene'));
	// loadLibrary()
  if (detail.value?.json_data) {
		threeCore.loadSceneFromJSON(detail.value.json_data)
	} else {
		use$Get(`/sence/json/${id}.json?2`, undefined, { baseURL: BASE_IMG})
    .then((res) => {
      threeCore.loadSceneFromJSON(res)
    }) 
	}
  
	threeCore.controls.enabled = true
	threeCore.scene.background = new THREE.Color('#ffddf2')
	// window.addEventListener('mousemove', gpuPick, false)
	// window.addEventListener('touchmove', gpuPick, false)
	// window.addEventListener('click', gpuPick, false)
	document.getElementById('scene')?.addEventListener('pointerdown', _onPointerDown);
	document.getElementById('scene')?.addEventListener('pointermove', _onPointerMove);
	document.getElementById('scene')?.addEventListener('pointerup', _onPointerUp);
	// threeCore.controls.autoRotate = true
	// 开始渲染循环
	threeCore.startAnimationLoop();
	threeCore.addAnimationFunc = () => { addAnimationFunc() }
}
const _onPointerDown = () => {
	isClick.value = true
}
const _onPointerMove = () => {
	if (isClick.value) {
		isClick.value = false
	} 
}
const _onPointerUp = (event: PointerEvent) => {
	if (isClick.value) {
		gpuPick(event)
	}
	
}

const showMaterial = () => {
	if (MaterialRef.value) {
		MaterialRef.value.showModel()
	}
}
const addDiary = async (form) => {
	const mesh = await threeCore.createDiary({
		title: form.title,
		content: form.content,
		type: 'diary'
	})
	mesh.position.set(0,0,0)
	threeCore.scene.add(mesh)
}
const chooseTemplate = async (item: TemplateInterface) => {
	if (threeCore.loadTemplate.length > 0) {
		// biome-ignore lint/complexity/noForEach: <explanation>
		threeCore.loadTemplate.forEach((child) => {
			threeCore.clearGroup(child)
		})
		threeCore.loadTemplate = []
	}
	if (item.json_data) {

	} else if (item.json_url) {
		use$Get(item.json_data || `/sence/json/${item.json_url}.json?2`, undefined, { baseURL: BASE_IMG})
    .then(async (res) => {
      const group = await threeCore.loadSceneFromJSON(res, true)
			if (group) {
				group.userData.type = 'template'
				group.userData.template_id =  item.template_id
				group.userData.ignorePick = true
				threeCore.scene.add(group)
				threeCore.loadTemplate.push(group)
			}
    })
	}
}
const saveScene = () => {
	const json_data = threeCore.saveSceneToJSON()
	const params = {
		sence_id: Number.parseInt(id),
		json_data
	}
	console.log('保存的数据', json_data)
	return
	updateScene(params)
		.then((res) => {
			toast.add({
				title: '保存成功',
				icon: 'i-heroicons-check-circle',
				color: 'green'
			})
		})
}
const onUpdateFiles = async (resault) => {
	const mesh = await threeCore.loadImageMesh(BASE_IMG + resault.file_url)
		console.log('当前面片', mesh)
		threeCore.scene.add(mesh)
}
onUnmounted(() => {
	// window.removeEventListener('mousemove', gpuPick, false)
	// window.removeEventListener('touchmove', gpuPick, false)
	window.removeEventListener('pointerdown', _onPointerDown, false)
	window.removeEventListener('pointermove', _onPointerMove, false)
	window.removeEventListener('pointerup', _onPointerUp, false)
})
const gpuPick = (ev: MouseEvent | TouchEvent) => {
	const obj = threeCore.gpuPick(ev)
	if (obj) {
		console.log('点击到的', obj)
		threeCore.gizmo.attach(obj);
		clickObject.value = [obj]
		operaPosition.value = threeCore.screenPositionFromObject(obj)
	} else if (threeCore.gizmo.dragging) {

	} else {
		threeCore.gizmo.detach();
		clickObject.value = null
	}
}
const mouse = new THREE.Vector2();
const throttledMouseMove = throttle((event: MouseEvent) => {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	updateCameraLookAt();
}, 20);

// 像素转换threejs坐标
const pxToThreeJSX = (px: number) => {
	// 计算可见宽度
	const fovRad = (threeCore.camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
	const visibleHeightAtZ = 2 * Math.tan(fovRad / 2) * Math.abs(threeCore.camera.position.z);
	const visibleWidthAtZ = visibleHeightAtZ * (window.innerWidth / window.innerHeight);
  const screenRatio = px / window.innerWidth;
  return -visibleWidthAtZ / 2 + screenRatio * visibleWidthAtZ;
}

const updateCameraLookAt = () => {
	if (!threeCore) {
		return;
	}
	if (!threeCore.controls) {
		return
	}

	// 获取屏幕宽度（以像素为单位）
	const screenWidth = window.innerWidth;

	const mouseXNormalized = mouse.x / (screenWidth / 2);

	const angleX = mouse.x * (Math.PI / 2);
	const angleY = mouse.y * (Math.PI / 2);
	// 
	const lookDistance = threeCore.controls.object.position.z / 2;
	const targetPosition = new THREE.Vector3(
		Math.sin(angleX) * lookDistance / 4,
		0,
		0
	);
	if (Scene1Group.value) {
		Scene1Group.value.rotation.y = angleX / 4
	}
	// if (UIGroup.value) {
	// 	UIGroup.value.rotation.y = angleX / 90
	// 	UIGroup.value.rotation.z = -angleX / 90
	// }
	// threeCore.camera.lookAt(targetPosition);
	// threeCore.controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
};
onMounted(() => {
	setTimeout(() => {
		initThreejs()
		// window.addEventListener('mousemove', throttledMouseMove, false);
	});
})
// 不需要手动引入布局
</script>

<style>
.left-box{
	height: 100vh;
	width: 20vw;
	/* background: #000; */
}
.right-box{
	height: 100vh;
	width: 30vw;
	/* background: #000; */
}
</style>