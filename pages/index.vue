<template>
	<div>
		<!-- <h1 class="text-3xl font-bold mb-6 relative z-10">
			<a href="https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita" target="_blank" rel="noopener noreferrer">
				<UButton>下载Lo研社APP</UButton>
			</a>
			<br>
			BOOM！！！服务器爆炸啦,新版本正在重建，敬请期待哦。
		</h1> -->
		<div style="height: 100%; width: 100%;position: absolute; left: 0; top: 0; overflow: hidden; " id="three-container"></div>
	</div>
</template>
<script setup lang="ts">
import qhxCore from '../utils/threeCore';
import * as THREE from 'three';
import type  { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
let threeCore: qhxCore
const theme = useThemeStore()
const UIGroup = ref<THREE.Group | null>(null)
const Scene1Group = ref<THREE.Group | null>(null)
import leftContent from '@/components/home/leftContent.vue'
import rightContent from '@/components/home/rightContent.vue'
import type { App, Component } from 'vue';
import { createApp  } from 'vue'
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
const creatDomUi = (className: string, component: Component): CSS3DObject => {
	const scale = calcCss3dScale()
	const divElement: HTMLElement = document.createElement('div');
	divElement.className = className
	const app: App = createApp(component)
	app.mount(divElement) // 挂载 Vue 组件
	// divElement.style.backgroundColor = hexToRgba(theme.themeCss.primary, 0.4)
	const css3dObject = threeCore.createCSS3DObject(divElement);
	css3dObject.position.set(0, 0, 0);
	css3dObject.scale.set(scale, scale, scale)
	return css3dObject
}
const createUIDom = () => {
	if (UIGroup.value) {
		// 重置UI组
    threeCore.scene.remove(UIGroup.value);
    UIGroup.value.clear();
    UIGroup.value = null;
  }
	const Group = new THREE.Group()
	const left = creatDomUi('left-box', leftContent)
	left.position.x = -pxToThreeJSX(window.innerWidth * 1.005)
	// left.position.z = -0.1
	console.log('左侧', left)
	// left.rotateY(5 * (Math.PI / 180))
	// left.rotateZ(-4 * (Math.PI / 180))
	left.rotateX(-0.675)
	Group.add(left)

	const rigth = creatDomUi('right-box', rightContent)
	rigth.position.x = pxToThreeJSX(window.innerWidth * 0.94)
	// rigth.position.z = -0.25
	// rigth.rotateY(-5 * (Math.PI / 180))
	// rigth.rotateZ( * (Math.PI / 180))
	rigth.rotateX(-0.675)
	Group.add(rigth)

	UIGroup.value = Group
	threeCore.scene.add(Group)
}
const loadLibrary = async () => {
	const Group = new THREE.Group()
	const model = await threeCore.loadModel(`${BASE_IMG}sence/library.glb`, { useDracoLoader: true, dracoDecoderPath: '/draco/gltf/' })
	model.scale.set(0.014,0.014,0.014)
	model.rotateY(150* (Math.PI / 180))
	model.position.set(0,0,0)
	Group.add(model)
	Group.position.set(-1.5,0,-3)
	Scene1Group.value = Group
	threeCore.scene.add(Group)
	console.log('模型', model)
}
const initThreejs = () => {
	threeCore = new qhxCore({
		enableCSS3DRenderer: true,
		alpha: true
	})
	// 挂载到DOM
	threeCore.mount(document.getElementById('three-container'));
	createUIDom()
	loadLibrary()
	threeCore.controls.enabled = false
	// threeCore.controls.autoRotate = true
	// 开始渲染循环
	threeCore.startAnimationLoop();
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
	if (UIGroup.value) {
		UIGroup.value.rotation.y = angleX / 90
		UIGroup.value.rotation.z = -angleX / 90
	}
	// threeCore.camera.lookAt(targetPosition);
	// threeCore.controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
};
onMounted(() => {
	setTimeout(() => {
		initThreejs()
		window.addEventListener('mousemove', throttledMouseMove, false);
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