<script setup lang="ts">
import qhxCore, { type CameraState } from '@/utils/threeCore';
import * as THREE from 'three';
import type  { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getSceneId, updateScene, insertScene } from '@/api/scene'
import type { Community, Effect, Library, Material, PaginationResponse, Scene, TemplateInterface } from '@/types/api'
import { insertCommunity } from '@/api/community'
import type { DiaryInterface, LibraryInterface } from '@/types/sence'
import type SceneMaterial from '@/components/scene/Material.vue'
import type SceneTextureEditor from '@/components/scene/TextureEditor.vue'
import { useSceneStore } from '@/stores/sence'
import { uploadImage, createFont } from '~/api';
const sceneStore = useSceneStore()
const configStore = storeToRefs(useConfigStore())
const { port } = configStore
const showDiary = ref(false)
let threeCore: qhxCore
const theme = useThemeStore()
const isClick = ref(false)
const Scene1Group = ref<THREE.Group | null>(null)
const operaPosition = ref<Object<{ x: number, y: number}>>({ x: 0, y: 0})
const clickObject = ref<THREE.Object3D[] | null>(null)
const diaryList = ref<DiaryInterface[]>([])
const libraryList = ref<LibraryInterface[]>([])
// const lightingDebugGUIRef = ref<InstanceType<typeof LightingDebugGUI> | null>(null)
const currentSettings = ref(null)

const onLightingSettingsChanged = (settings) => {
  currentSettings.value = settings
  console.log('Lighting settings changed:', settings)
}
const activeDiary = ref<DiaryInterface | null>(null)
const loading = ref(false)
let uni: any;
// 判断是否可替换贴图
const canTexture = computed(() => {
	let flag = false
	if (clickObject.value) {
		clickObject.value[0].traverse((child) => {
			if (child.name.includes('replace')) {
				flag = true
			}
		})
	}
	return flag
}); // 可以替换贴图
	

const MaterialRef = ref<InstanceType<typeof SceneMaterial> | null>(null)
const SceneTextureEditorRef = ref<InstanceType<typeof SceneTextureEditor> | null>(null)

import leftContent from '@/components/home/leftContent.vue'
import rightContent from '@/components/home/rightContent.vue'
import type { App, Component } from 'vue';
import { createApp  } from 'vue'
const route = useRoute()
const edit_mode = ref(false) // 编辑模式
const add_mode = ref(false)
const token = ref<string | null>(null) // 传入的token
console.log(route.query, '路由')
const toast = useToast()
const userStore = useUserStore()
const clickPosition = ref({ x: 0, y: 0 })
const doubleClickTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const target = ref(null)
const transformType  = ref('translate')

if (route.query?.edit) {
	edit_mode.value = true
}
if (route.query?.add) {
	edit_mode.value = true
	add_mode.value = true
}

if (route.query?.token) {
	userStore.setToken(route.query.token.toString())
}
const id = route.params.id as string
const editDiary = () => {
	if (activeDiary.value?.object) {
		activeDiary.value.object.userData.title = activeDiary.value.title
		activeDiary.value.object.userData.content = activeDiary.value.content
		showDiary.value = false
	}
}
const showTexture = async () => {
	if (SceneTextureEditorRef.value) {
		SceneTextureEditorRef.value.showModel()
	}
}
const copyModel = async () => {
	if (clickObject.value  && clickObject.value.length > 0) {
		if (clickObject.value[0].userData.url) {
			if (clickObject.value[0].userData.type === 'model') {
				const mesh = await threeCore.loadModel(clickObject.value[0].userData.url)
				if (clickObject.value[0].userData.options) {
					threeCore.setOptionsModel(mesh, clickObject.value[0].userData.options)
				}
				threeCore.scene.add(mesh)
			}
		}
	}
}
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
		// threeCore.gizmo.detach();
		threeCore.transformControls.detach()
		threeCore.showbloom = true
	}
}
const handleClickDiary = (e: MouseEvent, item: DiaryInterface) => {
  showDiary.value = true
  clickPosition.value = {
    x: e.clientX, y: e.clientY
  }
	activeDiary.value = item
}
const handleClickLibrary = (item: LibraryInterface) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (!item.library_id) return
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/library/libraryDetail/libraryDetail?id=${item.library_id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
		// 普通网页环境
		window.location.href = `https://lolitalibrary.com/library/detail/${item.library_id}`;
	}
}

const deleteCamera = (index: number) => {
	threeCore.cameraList.splice(index, 1)
}
const resetCamera = (index: number) => {
	threeCore.cameraList[index] = threeCore.recordCamera(false)
}
const addAnimationFunc = () => {
	if (clickObject.value && clickObject.value.length > 0) {
		operaPosition.value = threeCore.screenPositionFromObject(clickObject.value[0])
	}
	const diary_list: DiaryInterface[] = []
	if (threeCore.loadedDiary && threeCore.loadedDiary.length > 0) {
		// biome-ignore lint/complexity/noForEach: <explanation>
			threeCore.loadedDiary.forEach((diary) => {
			const position = threeCore.screenPositionFromObject(diary.object)
			diary_list.push({object: diary.object, title: diary.object.userData.title, content: diary.object.userData.content, position, id: diary.object.uuid})
			// console.log('日记点位置', position)
		})
	}
	diaryList.value = diary_list
	const library_list: LibraryInterface[] = []
	if (threeCore.loadedLibrary && threeCore.loadedLibrary.length > 0) {
		// biome-ignore lint/complexity/noForEach: <explanation>
			threeCore.loadedLibrary.forEach((library) => {
			const position = threeCore.screenPositionFromObject(library.object)
			library_list.push({object: library.object, title: library.object.userData.title, cover: library.object.userData.cover, position, id: library.object.uuid, library_id: library.object.userData.library_id})
			// console.log('日记点位置', position)
		})
	}
	libraryList.value = library_list

}
const { data } = await useAsyncData('studyDeatil', () => {
  return getSceneId({ sence_id: Number.parseInt(id) })
}, {})
const detail = ref<Scene | null>(null)
detail.value = data.value ?? null

const initThreejs = async () => {
	threeCore = new qhxCore({
		enableCSS3DRenderer: true,
		alpha: true,
		editMode: edit_mode.value
	})
	// 挂载到DOM
	threeCore.mount(document.getElementById('scene'));
	// loadLibrary()
  if (detail.value?.json_data) {
		await threeCore.loadSceneFromJSON(detail.value.json_data)
	} else {
		try {
			const res = await use$Get(`/sence/json/${id}.json`, undefined, { baseURL: BASE_IMG})
    	await threeCore.loadSceneFromJSON(res)
		} catch (error) {
			
		}
	}
	threeCore.controls.enabled = true
	if (threeCore.cameraList && threeCore.cameraList.length > 0) {
		lookAtCameraState(threeCore.cameraList[0])
	}
	// threeCore.scene.background = new THREE.Color('#ffddf2')
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
const clearTemplate = () => {
	if (threeCore.loadTemplate.length > 0) {
		// biome-ignore lint/complexity/noForEach: <explanation>
		threeCore.loadTemplate.forEach((child) => {
			threeCore.clearGroup(child)
		})
		threeCore.loadTemplate = []
	}
}
const recordCamera = () => {
	threeCore.recordCamera()
}
const chooseEffect = async (item: Effect) => {
	let effectName = null
	// biome-ignore lint/complexity/noForEach: <explanation>
	threeCore.scene.children.forEach((child: THREE.Object3D) => {
		if (child.userData && child.userData.type === 'effect') {
			effectName = child.userData.effectName
		}
	})
	if (effectName) {
		threeCore.removeEffect( { effect_name: effectName, effect_id: 0}, threeCore.scene)
	}
	threeCore.addEffect(item)
}
// 获取屏幕中心坐标
const getScreenCenter = () => {
	const screenCenter = new THREE.Vector3()
	threeCore.camera.getWorldPosition(screenCenter)
	return threeCore.controls.target.clone()
}
const chooseMaterial = async (item: Material) => {
	if (item.pk_type === 1) {
		sceneStore.setLoading(true)
		const mesh = await threeCore.loadModel(BASE_IMG + item.materia_url, { useDracoLoader: item.options?.useDracoLoader ? item.options.useDracoLoader : true, dracoDecoderPath: '/draco/gltf/' })
		// threeCore.addEffect({ effect_name: 'ScaleAnimate', effect_id: 0}, mesh)
		// threeCore.addEffect({ effect_name: 'ToonOutlineEffect', effect_id: 0}, mesh)
		// threeCore.addEffect({ effect_name: 'ToonOutlineEffect', effect_id: 0}, mesh)

		// threeCore.applyAnimation(mesh, {
		// 	id: 103,
		// 	type: 'timeline',
		// 	sequence: true, // 顺序执行
		// 	children: [
		// 		{
		// 			id: 104,
		// 			type: 'animation',
		// 			effect_name: 'move',
		// 			properties: {
		// 				'position.x': 5,
		// 				'position.y': 2
		// 			},
		// 			duration: 2,
		// 			ease: 'sine.inOut'
		// 		},
		// 		{
		// 			id: 105,
		// 			type: 'animation',
		// 			effect_name: 'rotate',
		// 			properties: {
		// 				'rotation.y': Math.PI * 2
		// 			},
		// 			duration: 3,
		// 			ease: 'power1.inOut'
		// 		},
		// 		{
		// 			id: 106,
		// 			type: 'animation',
		// 			effect_name: 'scale',
		// 			properties: {
		// 				'scale.x': 2,
		// 				'scale.y': 2,
		// 				'scale.z': 2
		// 			},
		// 			duration: 1.5,
		// 			ease: 'sine.inOut'
		// 		}
		// 	]
		// })
		console.log(mesh, '对象')
		const screenCenter = getScreenCenter()
		mesh.position.set(screenCenter.x, screenCenter.y, screenCenter.z)
		if (item.options) {
			threeCore.setOptionsModel(mesh, item.options)
		}
		sceneStore.setLoading(false)
		setTimeout(() => {
			threeCore.lookAtSelectObj([mesh])
		});


		// setTimeout(() => {
		// 	mesh.traverse((child) => {
		// 		threeCore.addBloomObject(child)
		// 		console.log('添加的对象', child)
		// 	})
		// }, 1000);
		// mesh.position.set(0,0,0)
		threeCore.scene.add(mesh)
	}
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
		const group = await threeCore.loadSceneFromJSON(item.json_data, true)
			if (group) {
				group.userData.type = 'template'
				group.userData.template_id =  item.template_id
				group.userData.ignorePick = true
				threeCore.scene.add(group)
				threeCore.loadTemplate.push(group)
			}
	} else if (item.json_url) {
		use$Get(`/sence/json/${item.json_url}.json?2`, undefined, { baseURL: BASE_IMG})
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
const jumpToCommunity = (item: Community) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');

	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/community/communityDetail/communityDetail?id=${item.community_id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
		// 普通网页环境
		window.location.href = `https://lolitalibrary.com/community/detail/${item.community_id}`;
	}
}
const saveScene = () => {
	const json_data = threeCore.saveSceneToJSON()
	const params = {
		json_data
	}
	console.log('保存的数据', json_data)
	if (add_mode.value) {
		if (loading.value) {
					toast.add({
					title: '请求中……',
					icon: 'i-heroicons-check-circle',
					color: 'green'
				})
			return
		}
		loading.value = true
		insertScene(params)
			.then(async (res) => {
				const communityParams = {
					title: '3D帖子',
					content: `<p><iframe style="width:100%; height:60vh" frameborder="0" allowfullscreen
					mozallowfullscreen="true" webkitallowfullscreen="true" allow="autoplay; fullscreen; xr-spatial-tracking"
					xr-spatial-tracking execution-while-out-of-viewport execution-while-not-rendered web-share
					src="https://lolitalibrary.com/scene/detail/${res.sence_id}"> </iframe></p>`,
					type: '3D'
				}
				try {
					const community = await insertCommunity(communityParams)
					jumpToCommunity(community)
						toast.add({
						title: '新增成功',
						icon: 'i-heroicons-check-circle',
						color: 'green'
					})
				} catch (error) {
					
				}
				
			})
			.finally(() => {
				loading.value = false
			})
	} else {
		updateScene({
			...params,
			sence_id: Number.parseInt(id)
		})
			.then((res) => {
				toast.add({
					title: '保存成功',
					icon: 'i-heroicons-check-circle',
					color: 'green'
				})
			})
	}
}
const onUpdateFiles = async (resault) => {
	const mesh = await threeCore.loadImageMesh(BASE_IMG + resault.file_url)
		console.log('当前面片', mesh)
		threeCore.scene.add(mesh)
}
const addBackgroun = async (resault) => {
	threeCore.background = resault.file_url
}
const addText = async (resault: string) => {
	const charset =  resault
	const font = await createFont({ charset })
	const mesh = await threeCore.addTextToScene(BASE_IMG +font.file_url, charset)
	console.log('文本返回', mesh)
	mesh.userData.url = font.file_url
	threeCore.scene.add(mesh)
}

onUnmounted(() => {
	// window.removeEventListener('mousemove', gpuPick, false)
	// window.removeEventListener('touchmove', gpuPick, false)
	window.removeEventListener('pointerdown', _onPointerDown, false)
	window.removeEventListener('pointermove', _onPointerMove, false)
	window.removeEventListener('pointerup', _onPointerUp, false)
})
const setMode = (type: 'translate' | 'scale' | 'rotate') => {
	transformType.value = type
	threeCore.transformControls.setMode(type)
}
const gpuPick = (ev: MouseEvent | TouchEvent) => {
	const obj = threeCore.gpuPick(ev)
	if (obj) {
		if (doubleClickTimer.value) {
			clearTimeout(doubleClickTimer.value)
			doubleClickTimer.value = null
			if (clickObject.value && clickObject.value.length > 0 && clickObject.value[0].uuid === obj.uuid) {
				console.log('双击')
				threeCore.lookAtSelectObj([obj])
				return
			}
		}
		if (clickObject.value && clickObject.value[0].uuid === obj.uuid) {
			console.log('点到同一个目标')
			return
		}
		if (edit_mode.value) {
			// threeCore.gizmo?.attach(obj);
			threeCore.transformControls.attach(obj)
			setMode('translate')
			threeCore.showbloom = false
		}
		doubleClickTimer.value = setTimeout(() => {
			doubleClickTimer.value = null
		}, 300)
		clickObject.value = [obj]
		operaPosition.value = threeCore.screenPositionFromObject(obj)

		obj.traverse((child) => {
			if (child.name.includes('replace')) {
				target.value = child
			}
		})
	} else if (threeCore.gizmo?.dragging) {

	} else {
		if (edit_mode.value) {
			// threeCore.gizmo?.detach();
			threeCore.transformControls.detach()
			threeCore.showbloom = true
		}
		clickObject.value = null
	}
}
const mouse = new THREE.Vector2();
const throttledMouseMove = throttle((event: MouseEvent) => {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	updateCameraLookAt();
}, 20);

const lookAtCameraState = (item: CameraState) => {
	threeCore.lookAtCameraState(item)
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
onMounted(async() => {
	uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
	setTimeout(() => {
		initThreejs()
		// window.addEventListener('mousemove', throttledMouseMove, false);
	});
})
useHead({
	title: '3D手账',
	meta: [
		{
			name: 'keywords',
			content: '3D手账'
		},
		{
			name: 'description',
			content: 'Lo研社 Lolita服饰与文化研习社'
		}
	]
})
// 不需要手动引入布局
</script>
<template>
	<div class="select-none touch-callout-none" :style="{ background: threeCore &&threeCore.background ? `url(${BASE_IMG}${threeCore.background})` : '', backgroundSize: 'cover' }">
		<SceneTextureEditor
			ref="SceneTextureEditorRef"
			v-if="target"
			:target="target"
			:image-url="BASE_IMG + threeCore.background"
			:mask-url="BASE_IMG + 'sence/8_mask.png'"
			@close="target = null"
		/>
		<!-- 光影调试GUI -->
    <!-- <LightingDebugGUI 
      v-if="threeCore" 
      :three-core="threeCore"
      @settings-changed="onLightingSettingsChanged"
    /> -->
		
		<!-- <div class=" fixed bottom-[80px] left-[20px] rounded-[50%] w-[50px] h-[50px] z-10 items-center justify-center shadow-lg flex cursor-pointer bg-qhx-bg-card"
		v-show="edit_mode">场景</div> -->
		<div class=" fixed bottom-[20px] left-[20px] rounded-[50%] w-[50px] h-[50px] z-10 items-center justify-center shadow-lg flex cursor-pointer bg-qhx-bg-card"
		@click="showMaterial()" v-show="edit_mode">
		<UIcon name="material-symbols:add" class="text-[22px] text-[#000000]" />
	</div>
		<div style="height: 100vh; width: 100vw; overflow: hidden; " id="scene"></div>
		<div class="opera fixed p-3  z-20 flex items-center whitespace-nowrap" 
		v-show="clickObject && edit_mode"
		:style="{ left: operaPosition.x + 40 + 'px', top: operaPosition.y - 100 + 'px' }">
			<!-- <QhxJellyButton>
				
			</QhxJellyButton> -->
			<div class="opera fixed p-3  bg-qhx-bg-card rounded-[30px] z-20 h-[60px] flex items-center whitespace-nowrap overflow-hidden">
				<div class=" cursor-pointer px-3" @click="setMode('translate')" v-show="transformType !== 'translate'">移动</div>
				<div class=" cursor-pointer px-3" @click="setMode('rotate')" v-show="transformType !== 'rotate'">旋转</div>
				<div class=" cursor-pointer px-3" @click="setMode('scale')" v-show="transformType !== 'scale'">缩放</div>
				<div class=" cursor-pointer px-3" @click.stop="copyModel()" v-if="clickObject && clickObject[0].userData.type === 'model'">复制</div>
				<div class=" cursor-pointer px-3" @click.stop="showTexture()" v-if="canTexture">贴图</div>
				<div class=" cursor-pointer px-3" @click.stop="deleteModel()">删除</div>
			</div>
		</div>
		<div class="camera-list fixed right-[10px] bottom-0 w-[40px] h-auto max-h-full" v-if="threeCore">
			<div class=" relative flex justify-center" v-for="(camera_list, index) in threeCore.cameraList">
				<QhxJellyButton>
					<div class="text-center cursor-pointer" @click="lookAtCameraState(camera_list)">
						<div
							class=" relative m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
							style="font-size: 22px">
							<div class="text-[#000] absolute left-0 top-0 h-[30px] w-[30px] flex items-center justify-center z-[1] text-[10px]">{{ index + 1 }}</div>
							<UIcon name="material-symbols:video-camera-back" class="text-[22px] text-[#ffffff]"></UIcon>
						</div>
					</div>
				</QhxJellyButton>
				<div v-if="edit_mode" class=" absolute right-[50px] top-0 flex">
					<QhxJellyButton>
						<div class="text-center cursor-pointer mr-2" @click="deleteCamera(index)">
							<div
								class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
								style="font-size: 22px">
								<UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
							</div>
						</div>
					</QhxJellyButton>
					<QhxJellyButton>
						<div class="text-center cursor-pointer" @click="resetCamera(index)">
							<div
								class=" m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
								style="font-size: 22px">
								<UIcon name="ri:reset-right-line" class="text-[22px] text-[#ffffff]" />
							</div>
						</div>
					</QhxJellyButton>
				</div>
			</div>
		</div>
		<div @click.stop="(e) => {
			handleClickDiary(e, diary)
		}" class="fixed p-3 cursor-pointer bg-qhx-bg-card rounded-[30px] shadow-lg z-10 h-[60px] flex items-center whitespace-nowrap overflow-hidden" v-for="diary in diaryList" :style="{ left: diary.position.x + 'px', top: diary.position.y  - 30 + 'px' }">
			{{ diary.title }}
		</div>
		<div @click.stop="handleClickLibrary(library)" class="fixed cursor-pointer bg-qhx-bg-card rounded-[30px] shadow-lg z-10 h-[60px] flex items-center whitespace-nowrap overflow-hidden" v-for="library in libraryList" :style="{ left: library.position.x + 'px', top: library.position.y  - 30 + 'px' }">
			<div class=" flex items-center">
				<div>
					<img :src="`${BASE_IMG}${library.cover}`"
          class="w-16 h-16 object-cover rounded-[60px] border border-gray-200 my-2 cursor-pointer" loading="lazy" />
				</div>
				<div class="p-2">{{ library.title }}</div>
			</div>
		</div>
		<SceneMaterial 
		v-if="edit_mode"
		@recordCamera="recordCamera" 
		@chooseTemplate="chooseTemplate" 
		@choose-material="chooseMaterial"
		@clearTemplate="clearTemplate" @addDiary="addDiary" @saveScene="saveScene" 
		@addImage="onUpdateFiles"
		@addBackgroun="addBackgroun"
		@choose-effect="chooseEffect"
		@addText="addText"
		 ref="MaterialRef" 
		:loadTemplate="threeCore && threeCore.loadTemplate.length > 0 ? true : false"></SceneMaterial>
		<QhxModal v-model="showDiary" :trigger-position="clickPosition">
			<div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto" v-if="activeDiary && !edit_mode">
				<div>{{ activeDiary.title }}</div>
				<div>{{ activeDiary.content }}</div>
			</div>
			<div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto" v-if="activeDiary && edit_mode">
				<UInput v-model="activeDiary.title" :placeholder="'标题'" class="flex-1 focus:ring-0" :ui="{
					base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
					rounded: 'rounded-[10px]',
					padding: { xs: 'px-4 py-2' },
					color: {
						white: {
							outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
						}
					}
				}" />
				<UTextarea v-model="activeDiary.content" :placeholder="'内容'" type="texare" class="flex-1 focus:ring-0 pt-3" :ui="{
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
					@click="editDiary()">
					保存修改
				</UButton>
			</div>
		</QhxModal>
	</div>
</template>
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