<template>
	<div>
		<h1 class="text-3xl font-bold text-qhx-textInverted mb-6 relative z-10">
			<a href="https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita" target="_blank" rel="noopener noreferrer">
				<UButton>下载Lo研社APP</UButton>
			</a>
			<br>
			BOOM！！！服务器爆炸啦,新版本正在重建，敬请期待哦。
		</h1>
		<div style="height: 100%; width: 100%;position: absolute; left: 0; top: 0;" id="three-container"></div>
	</div>
</template>

<script setup lang="ts">
import qhxCore from '../utils/threeCore';
import * as THREE from 'three';
let threeCore: qhxCore
const theme = useThemeStore()
console.log(theme.themeCss, '主题色')
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
const initThreejs = () => {
	threeCore = new qhxCore({
		enableCSS3DRenderer: true,
		alpha: true
	})
	// 挂载到DOM
	threeCore.mount(document.getElementById('three-container'));

	// 添加一个立方体
	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
	const cube = new THREE.Mesh(geometry, material);
	threeCore.scene.add(cube);
	const scale = calcCss3dScale()

	// 创建CSS3D对象
	const divElement = document.createElement('div');
	divElement.textContent = '3D HTML Content';
	divElement.style.backgroundColor = theme.themeCss.primary;
	divElement.style.backgroundColor = hexToRgba(theme.themeCss.primary, 0.4)
	divElement.style.height = '100vh';
	divElement.style.width = '100vw';
	const css3dObject = threeCore.createCSS3DObject(divElement);
	css3dObject.position.set(0, 0, 0);
	css3dObject.scale.set(scale, scale, scale)
	threeCore.scene.add(css3dObject);
	threeCore.controls.enabled = false;
	// 开始动画循环
	// threeCore.startAnimationLoop();
	// 添加动画
	threeCore.addAnimationCallback(() => {
		cube.rotation.x += 0.01;
		cube.rotation.y += 0.01;
	});

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
		const fovRad = threeCore.camera.fov * (Math.PI / 180);
		const visibleHeightAtZ = 2 * Math.tan(fovRad / 2) * Math.abs(threeCore.camera.position.z); // ≈6.9（当 z=5, FOV=75°）
		const scale = visibleHeightAtZ / window.innerHeight; // 关键：缩放比例 = (Three.js 可见高度) / (CSS 高度)
		return scale
	}
	return 1
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
		Math.sin(angleX) * lookDistance,
		Math.sin(angleY) * lookDistance / 4,
		0
	);
	threeCore.camera.lookAt(targetPosition);
	threeCore.controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
};
onMounted(() => {
	setTimeout(() => {
		initThreejs()
		window.addEventListener('mousemove', throttledMouseMove, false);
	});
})
// 不需要手动引入布局
</script>
