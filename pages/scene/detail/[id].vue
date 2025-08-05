<template>
	<div>
		<div style="height: 100vh; width: 100vw; overflow: hidden; " id="scene"></div>
	</div>
</template>
<script setup lang="ts">
import qhxCore from '@/utils/threeCore';
import * as THREE from 'three';
import type  { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getStudyId } from '@/api/scene'
import type { PaginationResponse, Scene } from '@/types/api'
let threeCore: qhxCore
const theme = useThemeStore()
const isClick = ref(false)
const Scene1Group = ref<THREE.Group | null>(null)

import leftContent from '@/components/home/leftContent.vue'
import rightContent from '@/components/home/rightContent.vue'
import type { App, Component } from 'vue';
import { createApp  } from 'vue'
const route = useRoute()
const edit_mode = ref(false) // 编辑模式
const token = ref<string | null>(null) // 传入的token
console.log(route.query, '路由')
const userStore = useUserStore()
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
const { data } = await useAsyncData('studyDeatil', () => {
  return getStudyId({ sence_id: Number.parseInt(id) })
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
	window.addEventListener('pointerdown', _onPointerDown);
	window.addEventListener('pointermove', _onPointerMove);
	window.addEventListener('pointerup', _onPointerUp);
	// threeCore.controls.autoRotate = true
	// 开始渲染循环
	threeCore.startAnimationLoop();
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
		threeCore.gizmo.attach(obj);
	} else if (threeCore.gizmo.dragging) {

	} else {
		threeCore.gizmo.detach();
	}
}
const mouse = new THREE.Vector2();
const throttledMouseMove = throttle((event: MouseEvent) => {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	updateCameraLookAt();
}, 20);
const calcCss3dScale = () => {
	if (threeCore?.camera) {
		const distance = threeCore.camera.position.distanceTo(new THREE.Vector3(0,0,0));
		const fovRad = (threeCore.camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
		const visibleHeightAtZ = 2 * Math.tan(fovRad / 2) * Math.abs(distance); // ≈6.9（当 z=5, FOV=75°）
		const scale = visibleHeightAtZ / window.innerHeight;
		return scale
	}
	return 1
}
// 计算水平夹角
const calcCameraAngleX = (cameraPosition: THREE.Vector3, targetPoint: THREE.Vector3): number => {

	// 1. 计算方向向量
	const direction = new THREE.Vector3().subVectors(targetPoint, cameraPosition);
	const yawRad = Math.atan2(direction.x, direction.z);
	const yawDeg = THREE.MathUtils.radToDeg(yawRad); // 弧度 → 角度
	return yawDeg
}
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