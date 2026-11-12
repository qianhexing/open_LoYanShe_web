<template>
	<div>
		<!-- 手机端：中间内容作为正常DOM显示 -->
		<div v-if="isMobile" class="mobile-content-wrapper mt-[10px]">
			<MiddleContent />
		</div>
		<div :style="{ height: '100%', width: '100%', position: 'absolute', left: 0, top: 0, overflow: 'hidden', zIndex: isMobile ? 1 : 'auto' }" id="three-container"></div>
	</div>
</template>
<script setup lang="ts">
import type { App, Component } from 'vue'
import { createApp } from 'vue'
import type { Group, Vector2, Vector3, PerspectiveCamera } from 'three'
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import type QhxCore from '../utils/threeCore'

const MiddleContent = defineAsyncComponent(
	() => import('@/components/home/middleContent.vue'),
)

type ThreeNS = typeof import('three')
type QhxCoreCtor = typeof import('../utils/threeCore').default

let THREE: ThreeNS | null = null
let QhxCoreClass: QhxCoreCtor | null = null
let threeCore: QhxCore | null = null
let mouse: Vector2 | null = null

const UIGroup = ref<Group | null>(null)
const Scene1Group = ref<Group | null>(null)
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)
const { t } = useI18n()
useHead({
	title: () => t('home.title'),
	meta: [
		{
			name: 'keywords',
			content: () => t('home.keywords')
		},
		{
			name: 'description',
			content: () => t('home.description')
		}
	]
})
const nuxtApp = useNuxtApp()

async function loadThreeStack() {
	if (THREE && QhxCoreClass) return
	const [threeMod, coreMod] = await Promise.all([
		import('three'),
		import('../utils/threeCore'),
	])
	THREE = threeMod
	QhxCoreClass = coreMod.default
	mouse = new THREE.Vector2()
}

const creatDomUi = (className: string, component: Component): CSS3DObject => {
	if (!threeCore) throw new Error('threeCore not ready')
	const scale = calcCss3dScale()
	const divElement: HTMLElement = document.createElement('div')
	divElement.className = className
	const app: App = createApp(component)
	// CSS3D 侧是独立 createApp，需手动挂上主应用的 i18n，否则模板 $t 会报错导致整页黑屏
	const i18n = nuxtApp.$i18n as { t: (...args: unknown[]) => string }
	app.config.globalProperties.$t = ((...args: unknown[]) => i18n.t(...args)) as typeof i18n.t
	app.config.globalProperties.$i18n = i18n
	const i18nSymbol = Object.getOwnPropertySymbols(nuxtApp.vueApp._context.provides)
		.find((s) => String(s).includes('vue-i18n'))
	if (i18nSymbol) {
		app._context.provides[i18nSymbol] = nuxtApp.vueApp._context.provides[i18nSymbol]
	}
	app.mount(divElement)
	const css3dObject = threeCore.createCSS3DObject(divElement)
	css3dObject.position.set(0, 0, 0)
	css3dObject.scale.set(scale, scale, scale)
	return css3dObject
}

const createUIDom = async () => {
	if (!THREE || !threeCore) return
	let isPc = true
	if (window.innerWidth < 768) {
		isPc = false
	}
	if (UIGroup.value) {
		threeCore.scene.remove(UIGroup.value)
		UIGroup.value.clear()
		UIGroup.value = null
	}

	// 手机端：不在3D场景中添加UI，使用正常DOM
	if (isPc) {
		const [{ default: leftContent }, { default: rightContent }] = await Promise.all([
			import('@/components/home/leftContent.vue'),
			import('@/components/home/rightContent.vue'),
		])
		const Group = new THREE.Group()
		const left = creatDomUi('left-box', leftContent)
		left.position.x = -pxToThreeJSX(window.innerWidth * 1.005)
		left.rotateX(-0.675)
		Group.add(left)

		const right = creatDomUi('right-box', rightContent)
		right.position.x = pxToThreeJSX(window.innerWidth * 0.94)
		right.rotateX(-0.675)
		Group.add(right)

		UIGroup.value = Group
		threeCore.scene.add(Group)
	}
}

const loadLibrary = async () => {
	if (!THREE || !threeCore) return
	const Group = new THREE.Group()
	const model = await threeCore.loadModel(`${BASE_IMG_MODEL}/sence/tuxiong3.glb?12211333322`, { useDracoLoader: true, dracoDecoderPath: '/draco/gltf/' })
	model.scale.set(1, 1, 1)
	model.rotateY(150 * (Math.PI / 180))
	model.position.set(0, 0, 0)
	Group.add(model)
	Group.position.set(0, 0, 0)
	Scene1Group.value = Group
	threeCore.scene.add(Group)
}

const initThreejs = async () => {
	configStore.initMobileDetection()

	// 移动端只用 DOM 首页，不下载 three / threeCore
	if (configStore.isMobile) {
		return
	}

	await loadThreeStack()
	if (!THREE || !QhxCoreClass) return

	threeCore = new QhxCoreClass({
		enableCSS3DRenderer: true,
		alpha: true,
	})

	await threeCore.mount(document.getElementById('three-container'))

	await createUIDom()
	void loadLibrary()
	threeCore.controls.enabled = false
	threeCore.scene.background = new THREE.Color('#ffddf2')
	await threeCore.startAnimationLoop()
}

const throttledMouseMove = throttle((event: MouseEvent) => {
	if (!mouse) return
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
	updateCameraLookAt()
}, 20)

const calcCss3dScale = () => {
	if (!THREE || !threeCore?.camera) return 1
	const distance = threeCore.camera.position.distanceTo(new THREE.Vector3(0, 0, 0))
	const fovRad = (threeCore.camera as PerspectiveCamera).fov * (Math.PI / 180)
	const visibleHeightAtZ = 2 * Math.tan(fovRad / 2) * Math.abs(distance)
	return visibleHeightAtZ / window.innerHeight
}

const pxToThreeJSX = (px: number) => {
	if (!THREE || !threeCore) return 0
	const fovRad = (threeCore.camera as PerspectiveCamera).fov * (Math.PI / 180)
	const visibleHeightAtZ = 2 * Math.tan(fovRad / 2) * Math.abs(threeCore.camera.position.z)
	const visibleWidthAtZ = visibleHeightAtZ * (window.innerWidth / window.innerHeight)
	const screenRatio = px / window.innerWidth
	return -visibleWidthAtZ / 2 + screenRatio * visibleWidthAtZ
}

const updateCameraLookAt = () => {
	if (!THREE || !threeCore || !mouse) return
	if (!threeCore.controls) return

	const angleX = mouse.x * (Math.PI / 2)
	if (Scene1Group.value) {
		Scene1Group.value.rotation.y = angleX / 4
	}
	if (UIGroup.value) {
		UIGroup.value.rotation.y = angleX / 90
		UIGroup.value.rotation.z = -angleX / 90
	}
}

onMounted(() => {
	configStore.initMobileDetection()
	setTimeout(() => {
		void initThreejs()
		window.addEventListener('mousemove', throttledMouseMove, false)
	})
})
</script>

<style>
.left-box{
	height: 100vh;
	width: 20vw;
}
.right-box{
	height: 100vh;
	width: 30vw;
}
.mobile-content-wrapper {
	position: relative;
	z-index: 2;
}
</style>
