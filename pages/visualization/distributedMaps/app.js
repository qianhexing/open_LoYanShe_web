
/* eslint-disable */

// const THREE = require('three')
import * as THREE from 'three'

// const TrackballControls = require('three-trackballcontrols')
//const TWEEN = require('tween.js').TWEEN
// require('./OrbitControls.js')(THREE)
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import TWEEN from '@tweenjs/tween.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";


const app = (function () {
	let camera,
		controls,
		scene,
		renderer,
		raycaster = new THREE.Raycaster(),
		contain,
		rank,
		mouse = new THREE.Vector2(),
		selectColor = new THREE.Color(0x96D296),
		//所有的模型     
		objects = [],
		// 肌贴模型 
		muscle_patch = [],
		// 当前选中的肌贴
		current_patch = 0,
		//当前操作的所有obj            
		optionObj = [],
		//当前选中的模型          
		selectObj = [],
		//当前操作的步数记录  透明0 隐藏1 实体2 显示3          
		step = [],
		skin = null, // 皮肤
		painPoints = null, // 疼痛点
		opt = {
			//透明的模型                         
			opacity: [],
			//隐藏的模型
			hide: [],
			//实体的模型
			opaque: [],
			//显示的模型
			show: []
		},

		//模型操作的一些flag
		flag = {
			slice: false
		}

	const APPFn = function () {
		//需要控制的所有obj 
		this.PART = null
	}

	APPFn.prototype.getOriginalEvent = function (event) {
		if (event && typeof event.originalEvent !== "undefined") {
			event = event.originalEvent
		}
		return event
	},
	APPFn.prototype.addInterestPoint = function(x, y, z, id, name) {
		var geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
		var material = new THREE.MeshBasicMaterial({
			color: 'red'
		});
		var point = new THREE.Mesh(geometry, material);
		point.name = 'poi'
		point.position.set(x, y, z);
		point.userData.id = id
		point.userData.name = name

		// 将兴趣点添加到容器中
		app.scene.add(point)

		app.pointsContainer.push(point);
	}
		APPFn.prototype.init = function (dom, component) {
			var glowMaterialList=["Bone", 'human']
			contain = dom
			this.dom = dom

			this.reactDomComponent = component

			camera = new THREE.PerspectiveCamera(50, contain.getBoundingClientRect().width / contain.getBoundingClientRect().height, 0.1, 600)
			scene = new THREE.Scene()
			// scene.background = new THREE.Color( 0xffffff )
			scene.updateMatrixWorld(true)
			scene.add(camera)
			// var axisHelper = new THREE.AxesHelper( 50 );
			// console.log(axisHelper, '辅助器')
			// scene.add( axisHelper );
			// 添加一个球体

			const ambientLight = new THREE.AmbientLight(0xffffff, 2)
			scene.add(ambientLight)
			// const dirLight = new THREE.DirectionalLight(0xffffff, 4)

			// dirLight.position.set(0, 50, 50);
			// dirLight.target.set(0, 0, 50);
			// dirLight.castShadow = true; // 允许投射阴影
			// dirLight.shadow.camera.top = 200;
			// dirLight.shadow.camera.bottom = -200;
			// dirLight.shadow.camera.left = -200;
			// dirLight.shadow.camera.right = 200;
			// dirLight.shadow.mapSize.width = 2048;
			// dirLight.shadow.mapSize.height = 2048;
			// dirLight.shadow.camera.far = 3500;

			const dirLight = new THREE.DirectionalLight(0xffffff, 6);
			dirLight.position.set(50, 100, 50);
			dirLight.castShadow = true;
			dirLight.shadow.bias = - 0.0001;

			// 阴影设置
			dirLight.shadow.mapSize.width = 4096;
			dirLight.shadow.mapSize.height = 4096;
			dirLight.shadow.camera.near = 0.5;
			dirLight.shadow.camera.far = 500;
			dirLight.shadow.camera.left = -300;
			dirLight.shadow.camera.right = 300;
			dirLight.shadow.camera.top = 300;
			dirLight.shadow.camera.bottom = -300;
			dirLight.position.set(-50, 100, 50);
			scene.add(dirLight)
			const directionalLightHelper = new THREE.DirectionalLightHelper(dirLight);
			scene.add(directionalLightHelper);
			console.log(dirLight, '光影')

			renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, sortObjects: true, depthTest: true,  powerPreference: "high-performance" })
			// renderer = new THREE.WebGLRenderer( { antialias: true } );

			renderer.setPixelRatio(window.devicePixelRatio)
			renderer.setSize(contain.getBoundingClientRect().width, contain.getBoundingClientRect().height)
			// renderer.setSize(element.clientWidth, element.clientHeight) // 设置渲染区域尺寸
			renderer.shadowMap.enabled = true // 显示阴影
			renderer.sortObjects = true
			renderer.shadowMap.type = THREE.PCFSoftShadowMap


			const orbitControls = new OrbitControls(camera, renderer.domElement)
			// orbitControls.dynamicDampingFactor = 0.1
			orbitControls.screenSpacePanning = true
			orbitControls.rotateSpeed = 2
			orbitControls.zoomSpeed = 1
			orbitControls.enableDamping = true
			orbitControls.listenToKeyEvents(window)
			
			controls = orbitControls
			controls.keys = {
				LEFT: 'ArrowLeft', //left arrow
				UP: 'ArrowUp', // up arrow
				RIGHT: 'ArrowRight', // right arrow
				BOTTOM: 'ArrowDown' // down arrow
			}
			// camera.lookAt(new THREE.Vector3(0, 2.5, 0)) // 设置相机方向
			camera.position.set(0, 1, 2)
			controls.target = new THREE.Vector3(0, 0.5, 0)
			const mixer = new THREE.AnimationMixer(scene);
			const clock = new THREE.Clock();
			
			// 添加平行光源
			
			// 地面几何体
			const planeGeometry = new THREE.PlaneGeometry(10, 10);
			
			// 材质
			const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
			
			// 创建地面并添加阴影
			const plane = new THREE.Mesh(planeGeometry, planeMaterial);
			console.log(plane, '地面')
			plane.rotation.x = -0.5 * Math.PI;
			plane.receiveShadow = true; // 接收阴影
			// plane.castShadow = true;
			// scene.add(plane)

			this.camera = camera
			this.controls = controls
			this.renderer = renderer
			this.scene = scene
			this.raycaster = raycaster
			this.objects = objects
			this.objects_disease = [] // 疾病模型对象集合
			this.objects_skin = [] // 皮肤对象
			this.objects_group = [] // 模型的组对象
			this.parts_radius = null // 局部的半径 用与分离动画
			this.model_disease = null // 疾病模型
			this.model_animate = null // 动画模型
			this.textFont = null

			this.mixer = mixer
			this.clock = clock

			this.flag = flag
			this.optionObj = optionObj
			this.muscle_patch = muscle_patch
			this.rank = 1
			this.current_patch = current_patch
			this.selectObj = selectObj
			this.optionFn = optionFn
			this.cancelOptionFn = cancelOptionFn
			this.record_state = null // 切换肌贴的状态记录
			// this.ambientLight = ambientLight

			this.dirLight = dirLight
			this.materials = {
				scene: null
			}
			this.renderMode = 0
			this.point_box = []
			this.pointsContainer = [];
			this.createSphere()
			this.createEffectComposer()
			this.breathObject = []
			this.clickObj = null
			this.doubleClickTimer = null
			this.tween_list = []
			this.action = null
			contain.appendChild(renderer.domElement)
			window.addEventListener('resize', windowResize, false)
			renderer.domElement.addEventListener('click', function (e) { onClick(e) }, false)
			// app.addInterestPoint(0,0,0,1,1)
			// app.addInterestPoint(1,1,1,2,2)

			function animate() {
				requestAnimationFrame(animate)
				//controls.update()
				TWEEN.update()
				renderer.render(scene, camera)
				if (app.mixer) {
					app.mixer.update(clock.getDelta());
				}
			}

			windowResize()
			animate()
		}

	function windowResize() {
		camera.aspect = contain.getBoundingClientRect().width / contain.getBoundingClientRect().height
		camera.updateProjectionMatrix()
		renderer.setSize(contain.getBoundingClientRect().width, contain.getBoundingClientRect().height)
		controls.update()
	}

	APPFn.prototype.resetSelectColor = function () {
		if (!app.selectObj.length) { return false }
		var len = app.selectObj.length
		for (var i = 0; i < len; i++) {
			app.changeSelectDye(app.selectObj[i], false)
		}
	}
	APPFn.prototype.createEffectComposer = function () {
		const clientWidth = contain.getBoundingClientRect().width,
			clientHeight = contain.getBoundingClientRect().height
		// 场景渲染器
		const outputPass = new OutputPass();
		this.effectComposer = new EffectComposer(this.renderer)
		const renderPass = new RenderPass(this.scene, this.camera)
		this.effectComposer.addPass(renderPass)
		this.effectComposer.addPass(outputPass)

		//创建辉光效果
		// this.unrealBloomPass = new UnrealBloomPass(new THREE.Vector2(clientWidth, clientHeight), 0, 0, 0)
		// this.unrealBloomPass.threshold = 0.0 // 辉光强度
		// this.unrealBloomPass.strength = 0.5 // 辉光阈值
		// this.unrealBloomPass.radius = 0 //辉光半径
		// this.unrealBloomPass.renderToScreen = false // 
		// this.unrealBloomPass.samples = 30
		// 辉光合成器
		// this.glowComposer = new EffectComposer(this.renderer)
		// this.glowComposer.renderToScreen = true
		// this.glowComposer.addPass(new RenderPass(this.scene, this.camera))
		// this.glowComposer.addPass(this.unrealBloomPass)
		// 着色器
		// let shaderPass = new ShaderPass(new THREE.ShaderMaterial({
		// 	uniforms: {
		// 		baseTexture: { value: null },
		// 		bloomTexture: { value: this.glowComposer.renderTarget2.texture },
		// 		tDiffuse: {
		// 			value: null
		// 		}
		// 	},
		// 	vertexShader: '\t\t\tvarying vec2 vUv;\n' +
		// 		'\n' +
		// 		'\t\t\tvoid main() {\n' +
		// 		'\n' +
		// 		'\t\t\t\tvUv = uv;\n' +
		// 		'\n' +
		// 		'\t\t\t\tgl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
		// 		'\n' +
		// 		'\t\t\t}',
		// 	fragmentShader: '\t\t\tuniform sampler2D baseTexture;\n' +
		// 		'\t\t\tuniform sampler2D bloomTexture;\n' +
		// 		'\n' +
		// 		'\t\t\tvarying vec2 vUv;\n' +
		// 		'\n' +
		// 		'\t\t\tvoid main() {\n' +
		// 		'\n' +
		// 		'\t\t\t\tgl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );\n' +
		// 		'\n' +
		// 		'\t\t\t}',
		// 	defines: {}
		// }), 'baseTexture')

		// shaderPass.renderToScreen = true
		// shaderPass.needsSwap = true
		// this.effectComposer.addPass(shaderPass)
	}
	// 获取辉光材质
	APPFn.prototype.getFlowMeaterList = () => {
		const modelMaterialList = []
		app.objects.traverse((v) => {
			if (v.isMesh && v.material) {
				const { name, color, map } = v.material
				// 统一将模型材质 设置为 MeshLambertMaterial 类型
				v.material = new THREE.MeshLambertMaterial({
					map,
					transparent: true,
					color,
					name,
				})
				modelMaterialList.push(v)
			}
		})
		this.glowMaterialList = modelMaterialList.map(v => v.name)
	}
	// 呼吸灯
	APPFn.prototype.breathingLight = function(child) {
		const vertexShader = `
		  varying vec3 vReflect;
		  uniform float time;
		  varying vec3 vRefract[3];
		  varying float vReflectionFactor;
		  #include <common>
		  #include <uv_pars_vertex>
		  #include <envmap_pars_vertex>
		  #include <color_pars_vertex>
		  #include <fog_pars_vertex>
		  #include <morphtarget_pars_vertex>
		  #include <skinning_pars_vertex>
		  #include <logdepthbuf_pars_vertex>
		  #include <clipping_planes_pars_vertex>
		  void main() {
			#include <color_vertex>
			#include <morphcolor_vertex>
			#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
			  #include <beginnormal_vertex>
			  #include <morphnormal_vertex>
			  #include <skinbase_vertex>
			  #include <skinnormal_vertex>
			  #include <defaultnormal_vertex>
			#endif
			#include <begin_vertex>
			#include <morphtarget_vertex>
			#include <skinning_vertex>
			#include <project_vertex>
  
			vec4 mvPosition1 = modelViewMatrix * vec4( position, 1.0 );
			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
			vec3 I = worldPosition.xyz - cameraPosition;
			vReflect = reflect( I, worldNormal );
			vReflectionFactor = dot( normalize( I ), worldNormal );
			// gl_Position = projectionMatrix * mvPosition1;
		  }
		`
  
		const fragmentShader = [
		  "uniform samplerCube tCube;",
		  "varying vec3 vReflect;",
		  "uniform float time;",
		  "varying float vReflectionFactor;",
		
		  "void main() {",
			"vec4 reflectedColor = textureCube(tCube, vec3(-vReflect.x, vReflect.yz));",
			"vec4 refractedColor = vec4(1, 0, 0, 0.9);",  // 浅蓝色
		
			// 计算边缘加深色
			"float edgeFactor = 1.0 - smoothstep(0.3, 1.0, vReflectionFactor) / 0.5;", // 根据反射因子计算边缘因子，0.3和1.0是调整边缘效果的阈值
			// 应用边缘加深色
			// "vec4 finalColor = mix(refractedColor, reflectedColor, edgeFactor);",
			// "float flashFactor = 0.5 + 0.5 * sin(time);",
			"float flashFactor = 0.2 + 0.6 * (0.5 * (sin(time * 6.0) + 1.0));",
			"vec4 finalColor = vec4(mix(refractedColor.rgb, refractedColor.rgb, 0.0), refractedColor.a * (1.0 - edgeFactor) * flashFactor);", 
			// "gl_FragColor = finalColor;",
			"gl_FragColor = finalColor;",
  
		  "}"
		].join("\n")
		const material = new THREE.ShaderMaterial({
		  vertexShader,
		  fragmentShader,
		  side: THREE.DoubleSide,
		  uniforms: {
			time: { value: 0 },
		  },
		  depthWrite: false, // 关闭深度写入
		  depthTest: false, // 启用深度测试
		  blending: THREE.NormalBlending // 设定混合模式
		});
		material.transparent = true
		child.material = material
		// child.renderOrder = 0
		this.breathObject.push(child.material)
		// let opacity = { opacity: 0.05 }
		// child.material.color = new THREE.Color('#f00')
		// const breathingTween = new TWEEN.Tween(opacity)
		//   .to({ opacity: 0.2 }, 1000) // 透明度从0.9到1.0的过渡时间
		//   .easing(TWEEN.Easing.Quadratic.InOut) // 缓动函数，你可以选择不同的缓动函数
		//   .onUpdate(function () {
		//     child.material.opacity = opacity.opacity;
		//   })
		//   .yoyo(true) // 循环动画
		//   .repeat(Infinity) // 无限循环
		//   .start();
		// this.animate.push(breathingTween)
	}
	APPFn.prototype.hiddenOrShowSkin = (flag) => {
		app.objects_skin.forEach((child) => {
			child.visible = flag
		})
	}
	APPFn.prototype.hiddenOrShowShenjin = (flag, groupName) => {
		app[groupName].forEach((child) => {
			if (child.userData && child.userData.parent && child.userData.parent === '神经') {
				child.visible = flag
			}
		})
		console.log('显示神经', flag)
	}
	// 移动镜头到选中
	APPFn.prototype.lookAtSelectObj = function(arr) {
		// TWEEN.removeAll()
		const sphere = app.calcSelectObjSphere(arr)
		let { center, radius } = sphere
		// this.camera.lookAt(center)
  
		//相机当前位置 当前距离
		let cameraPostionNow = app.camera.position.clone()
		let distanceNow = cameraPostionNow.distanceTo(center)
		//相机距离模型的最终距离
		let finnalDistance
		let distanceRate
		let finalPostion
		finnalDistance = radius * 3
		distanceRate = finnalDistance / distanceNow
		finalPostion = cameraPostionNow.lerp(center, 1 - distanceRate)

		console.log(center, finalPostion)
		new TWEEN.Tween(app.controls.target)
		  .to({ x: center.x, y: center.y, z: center.z }, 1000)
		  .easing(TWEEN.Easing.Exponential.Out)
		  .start()
		new TWEEN.Tween(app.camera.position)
		  .to({ x: finalPostion.x, y: finalPostion.y, z: finalPostion.z }, 1000)
		  .easing(TWEEN.Easing.Exponential.Out)
		  .start()
		  .onUpdate(() => {
			app.camera.lookAt(app.controls.target)
		  })
		  .onComplete(() => {
		  })
	  }
	// 移动镜头到定位点
	// 如果自定义点name不用传
	APPFn.prototype.lookAtObject = (name, groupName = 'objects_disease', p1 = undefined, p2 = undefined) => {
		let index1, index2
		if (p1 && p2) {
			index1 = app[groupName].findIndex((item) => { return item.name === p1 })
			index2 = app[groupName].findIndex((item) => { return item.name === p2 })
		} else {
			index1 = app[groupName].findIndex((item) => { return item.name === name + '_d1' })
			index2 = app[groupName].findIndex((item) => { return item.name === name + '_d2' })
		}
		if (index1 !== -1 && index2 !== -1) {
			const position = app[groupName][index2].position
			const target = app[groupName][index1].position
			// app.objects[index2].material =  new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
			// app.objects[index1].material =  new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
			// app.objects[index2].visible = true
			// app.objects[index1].visible = true
			// console.log(app.objects[index2])
			// console.log(app.objects[index1])
			
			new TWEEN.Tween(app.controls.target)
				.to({ x: target.x, y: target.y, z: target.z }, 1000)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
			new TWEEN.Tween(app.camera.position)
				.to({ x: position.x, y: position.y, z: position.z }, 1000)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				.onUpdate(() => {
					app.camera.lookAt(app.controls.target)
				})
			// .onComplete(() => {
			// 	console.log('运行完了')
			// })
		}
	}

	//选中模型变色
	APPFn.prototype.changeSelectDye = function (obj, o, color = undefined) {
		var aa = obj.material
		if (aa.length) {
			for (var i = 0; i < aa.length; i++) {
				if (o) {
					aa[i].color = color || selectColor
				} else {
					aa[i].color = aa[i].originalColor
				}
			}
		} else {
			if (o) {
				aa.color = color || selectColor
			} else {
				aa.color = aa.originalColor
			}
		}
	}
	function breathingLight(child) {
		let opacity = { value: 0.2 };

		function updateOpacity() {
			child.material.opacity = opacity.value;
		}

		function startTween() {
			new TWEEN.Tween(opacity)
				.to({ value: 0.4 }, 1000)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(updateOpacity)
				.onComplete(reverseTween)
				.start();
		}

		function reverseTween() {
			new TWEEN.Tween(opacity)
				.to({ value: 0.2 }, 1000)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(updateOpacity)
				.onComplete(startTween)
				.start();
		}

		startTween();
	}
	APPFn.prototype.createSphere = () => {
		// 添加一个球体
		const canvas = document.createElement('canvas')
		canvas.height = 600;
		canvas.style.backgroundColor = '#000';
		const context = canvas.getContext('2d');
		let canvasWidth = 600;
		canvas.width = canvasWidth;

		// 绘制渐变圆
		const gradient = context.createRadialGradient(canvasWidth / 2, canvas.height / 2, 0, canvasWidth / 2, canvas.height / 2, canvasWidth / 2);
		gradient.addColorStop(0, 'rgba(255, 0, 0, 1)'); // 完全不透明的红色
		gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); // 完全透明的红色

		context.fillStyle = gradient;
		context.beginPath();
		context.arc(canvasWidth / 2, canvas.height / 2, canvasWidth / 2, 0, Math.PI * 2);
		context.closePath();
		context.fill();
		const texture = new THREE.Texture(canvas)
		texture.needsUpdate = true
		const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true })
		const sprite = new THREE.Sprite(spriteMaterial)
		sprite.scale.set(0.01, 0.01, 0.01)
		const sprite1 = new THREE.Sprite(spriteMaterial)
		sprite1.scale.set(0.007, 0.007, 0.007)
		breathingLight(sprite)
		const sprite2 = new THREE.Sprite(spriteMaterial)
		sprite2.scale.set(0.004, 0.004, 0.004)
		var group = new THREE.Group();
		group.add(sprite)
		group.add(sprite1)
		group.add(sprite2)
		group.name = 'painPoints'
		group.renderOrder = 5
		group.visible = false
		app.painPoints = group
		console.log('group疼痛点', group)
		app.scene.add(group);
	}
	APPFn.prototype.movePainPoints = (name) => {
		const index = app.objects.findIndex((item) => { return item.name === name })
		if (index !== -1) {
			app.painPoints.visible = true
			const position = app.objects[index].position
			app.painPoints.position.set(position.x, position.y, position.z)
		}
	}
	APPFn.prototype.showOrhiddenPainPoints = (state = false) => {
		app.painPoints.visible = state
	}
	function judgeIsVisible(child) {
		if (child.parent) {
			return child.visible && judgeIsVisible(child.parent)
		} else {
			return child.visible
		}
	}
	//鼠标点击模型事件
	function onClick(event) {
		event.preventDefault()
		let SELECTED = null
		const { show_part, muscle_patch } = app.reactDomComponent.state
		mouse.x = ((event.clientX - contain.getBoundingClientRect().left) / contain.getBoundingClientRect().width) * 2 - 1
		mouse.y = - ((event.clientY - contain.getBoundingClientRect().top) / contain.getBoundingClientRect().height) * 2 + 1

		raycaster.setFromCamera(mouse, camera)
		// item.material.name.includes('muscle')
		let obj = []
		if (show_part) {
			let patch_obj = []
			// muscle_patch.forEach(element => {
			// 	patch_obj.push(element.obj)
			// })
			// patch_obj = patch_obj.join()
			const list = [...app.objects_disease.filter((item) => {
				return judgeIsVisible(item)
			}), ...app.objects]
			obj = list.filter((item) => { return item.visible })
		} else {
			obj = app.objects.filter((item) => { return item.visible && item.name !== 'human' })
		}
		let intersects = raycaster.intersectObjects(obj)
		//选中了
		if (intersects.length > 0) {
			SELECTED = intersects[0].object
			console.log(SELECTED, '选中的')

			if (app.doubleClickTimer) {
			// this.lookAtSelectObj(SELECTED)
				// if (SELECTED === app.clickObj) { app.lookAtSelectObj([SELECTED]) }
			} else {
				app.doubleClickTimer = setTimeout(() => {
					clearTimeout(app.doubleClickTimer)
					app.doubleClickTimer = null
				}, 400);
			}
			const index = obj.findIndex((item) => {
				return SELECTED.name === item.name
			})
			if (index !== -1) {
				app.clickObj = SELECTED

				if (app.renderMode === 0) {
					// clickOption(SELECTED)

				}
			}
			//没选中
		} else {
			//清除选中颜色 清除选中obj
			app.resetSelectColor()
			app.selectObj = []
		}
	}

	function clickOption(SELECTED, color = undefined) {
		app.resetSelectColor()
		app.selectObj = []
		//手术刀的情况
		if (flag.slice) {
			app.selectObj[0] = SELECTED
			app.optionFn({ type: 1, other: false, cancel: false })
			return
		}
		app.changeSelectDye(SELECTED, true, color)
		app.selectObj[0] = SELECTED
		//重置控制版上的操作
		//$.fn.resetOption()
	}

	//操作选中模型  
	function optionFn(parameters) {
		//parameters { type : 操作方法 , other: true/false 是否操作其他 默认false,  cancel: true / flase 是否是取消操作 默认false}
		if (parameters == undefined) return
		let arr = []
		let option = optionObj
		let optionLen = option.length
		let select = app.selectObj

		let selectLen = select.length

		//隐藏其他时候用到
		let arrOther = []

		if (selectLen) {

			for (let i = 0; i < optionLen; i++) {
				for (let j = 0; j < selectLen; j++) {
					option[i] === select[j] ? arr.push(option[i]) : null
				}
			}

			let flag = false
			switch (parameters.type) {
				//透明
				case 0:
					//..操作其他
					if (parameters.other) {
						for (let i = 0; i < optionObj.length; i++) {
							flag = false
							for (let k = 0; k < selectLen; k++) {
								if (optionObj[i] === select[k]) {
									flag = true
								}
							}
							if (flag === false && optionObj[i].material.opacity == 1) {
								arrOther.push(optionObj[i])
								optionObj[i].material.opacity = 0.6
							}
						}
						opt.opacity.unshift(arrOther)
						//..操作选中
					} else {
						//操作记录
						for (let k = 0; k < selectLen; k++) {
							select[k].material.opacity = 0.6
						}
						//透明操作
						opt.opacity.unshift(arr)
					}
					step.unshift(0)
					break

				//隐藏
				case 1:
					//..操作其他
					if (parameters.other) {
						for (let i = 0; i < optionObj.length; i++) {
							flag = false
							for (let k = 0; k < selectLen; k++) {
								if (optionObj[i] === select[k]) {
									flag = true
								}
							}
							if (flag === false && optionObj[i].visible == true) {
								arrOther.push(optionObj[i])
								optionObj[i].visible = false
							}
						}
						opt.hide.unshift(arrOther)
						//..操作选中
					} else {
						for (let k = 0; k < selectLen; k++) {
							select[k].visible = false
						}
						opt.hide.unshift(arr);
					}

					step.unshift(1)

					break

				//实体
				case 2:
					//..操作其他
					if (parameters.other) {
						for (let i = 0; i < optionObj.length; i++) {
							flag = false
							for (let k = 0; k < selectLen; k++) {
								if (optionObj[i] === select[k]) {
									flag = true
								}
							}
							if (flag === false && optionObj[i].material.opacity == 0.6) {
								optionObj[i].material.opacity = 1
							}
						}
						opt.opaque.unshift(arrOther)
						//..操作选中
					} else {
						for (let k = 0; k < selectLen; k++) {
							select[k].material.opacity = 1
						}
						//实体操作
						opt.opaque.unshift(arr);
						//操作记录
					}
					step.unshift(2)

					break

				//显示
				case 3:
					//..操作其他
					if (parameters.other) {
						for (let i = 0; i < optionObj.length; i++) {
							flag = false
							for (let k = 0; k < selectLen; k++) {
								if (optionObj[i] === select[k]) {
									flag = true
								}
							}
							if (flag === false && optionObj[i].visible == false) {
								arrOther.push(optionObj[i])
								optionObj[i].visible = true
							}
						}
						opt.show.unshift(arrOther)
						//..操作选中
					} else {
						for (let k = 0; k < selectLen; k++) {
							select[k].visible = true
						}
						//显示操作
						opt.show.unshift(arr);
						//操作记录
					}

					step.unshift(3)

					break

				default:
					break
			}

			//操作结束之后
			//$('#cancel').removeAttr('disabled')

		}
	}

	function cancelOptionFn() {
		var stepFlag
		if (step.length) {
			stepFlag = step[0]
		} else {
			return false
		}
		switch (stepFlag) {
			case 0:
				if (opt.opacity.length) {
					for (var i = 0; i < opt.opacity[0].length; i++) {
						opt.opacity[0][i].material.opacity = 1
					}
					opt.opacity.splice(0, 1)
				}
				break

			case 1:
				if (opt.hide.length) {
					for (var i = 0; i < opt.hide[0].length; i++) {
						opt.hide[0][i].visible = true
					}
					//删除数组第一个第一项   先进后出  堆的原理
					opt.hide.splice(0, 1)
				}
				break

			case 2:
				if (opt.opaque.length) {
					for (var i = 0; i < opt.opaque[0].length; i++) {
						opt.opaque[0][i].material.opacity = 0.6
					}
					opt.opaque.splice(0, 1)
				}
				break

			case 3:
				if (opt.show.length) {
					//刚显示存进去数组所有模型                 
					for (var i = 0; i < opt.show[0].length; i++) {
						opt.show[0][i].visible = false
					}
					//删除数组第一个第一项 先进后出 堆的原理
					opt.show.splice(0, 1)
				}
				break

			default:
				break
		}

		step.splice(0, 1)
		//重置控制版上的操作
		//$.fn.resetOption()

		if (step.length == 0) {
			//$('#cancel').attr('disabled','disabled')
		}
	}
	APPFn.prototype.getInterestPointsScreenCoordinates = function () {
		var interestPointsData = [];
		app.pointsContainer.forEach((point) => {
			var screenPosition = new THREE.Vector3();
			point.updateMatrixWorld(); // 确保获取最新的矩阵
			screenPosition.setFromMatrixPosition(point.matrixWorld);

			// 将世界坐标转换为标准设备坐标（Normalized Device Coordinates）
			screenPosition.project(app.camera);

			// 将标准设备坐标转换为屏幕坐标
			var screenWidth = window.innerWidth - 680;
			var screenHeight = window.innerHeight;
			var screenX = Math.round((screenPosition.x + 1) * screenWidth / 2);
			var screenY = Math.round((-screenPosition.y + 1) * screenHeight / 2);
			// 获取兴趣点的ID
			var pointID = point.userData.id;

			var name = point.userData.name;

			interestPointsData.push({ id: pointID, x: screenX - 10, y: screenY - 10, name });
		});

		return interestPointsData;
	}
	// false为不透明，true 为透明
	APPFn.prototype.setSkinOpacity = function (state) {
		if (!app.objects_skin) {
			return false
		}
		const FresnelShader = {

			uniforms: {

				"mRefractionRatio": { value: 0.0 },
				"mFresnelBias": { value: 0.0 },
				"mFresnelPower": { value: 3.0 },
				"mFresnelScale": { value: 1.0 },
				"tCube": { value: null }
			},

			vertexShader: `

			uniform float mRefractionRatio;
			uniform float mFresnelBias;
			uniform float mFresnelScale;
			uniform float mFresnelPower;
			varying vec3 vReflect;
			varying vec3 vRefract[3];
			varying float vReflectionFactor;
	
			#include <common>
			#include <uv_pars_vertex>
			#include <envmap_pars_vertex>
			#include <color_pars_vertex>
			#include <fog_pars_vertex>
			#include <morphtarget_pars_vertex>
			#include <skinning_pars_vertex>
			#include <logdepthbuf_pars_vertex>
			#include <clipping_planes_pars_vertex>
			void main() {
				#include <uv_vertex>
				#include <color_vertex>
				#include <morphcolor_vertex>
				#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
					#include <beginnormal_vertex>
					#include <morphnormal_vertex>
					#include <skinbase_vertex>
					#include <skinnormal_vertex>
					#include <defaultnormal_vertex>
				#endif
				#include <begin_vertex>
				#include <morphtarget_vertex>
				#include <skinning_vertex>
				#include <project_vertex>
				vec4 mvPosition1 = modelViewMatrix * vec4( position, 1.0 );
				vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
				vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
				vec3 I = worldPosition.xyz - cameraPosition;
				vReflect = reflect( I, worldNormal );
				vRefract[0] = refract( normalize( I ), worldNormal, mRefractionRatio );
				vRefract[1] = refract( normalize( I ), worldNormal, mRefractionRatio * 0.99 );
				vRefract[2] = refract( normalize( I ), worldNormal, mRefractionRatio * 0.98 );
				vReflectionFactor = mFresnelBias + mFresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), mFresnelPower );
				// gl_Position = projectionMatrix * mvPosition1;
				// gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,

			fragmentShader: `
			uniform samplerCube tCube;
			varying vec3 vReflect;
			varying vec3 vRefract[3];
			varying float vReflectionFactor;
		
			void main() {
				vec4 reflectedColor = textureCube(tCube, vec3(-vReflect.x, vReflect.yz));
				vec4 refractedColor = vec4(0.95, 0.95, 0.95, 1.0);  // 浅蓝色
				vec4 highlightColor = vec4(0.78, 0.88, 1.0, 1.0);  // 浅蓝色

		
				// 计算边缘加深色
				float edgeFactor = 1.0 - smoothstep(0.1, 1.0, vReflectionFactor) / 0.2; // 根据反射因子计算边缘因子，0.3和0.6是调整边缘效果的阈值
				// vec3 highlightColor = mix(refractedColor.rgb, reflectedColor.rgb, edgeFactor);

				// 应用边缘加深色
				// vec4 finalColor = mix(refractedColor, reflectedColor, clamp(vReflectionFactor, 0.0, 1.0));
				vec4 finalColor = mix(highlightColor, refractedColor, edgeFactor);
				// vec4 finalColor = vec4(refractedColor.rgb, refractedColor.a);

				// finalColor.rgb *= edgeFactor; // 应用边缘加深色
	
				// vec4 finalColor = mix(refractedColor, reflectedColor, clamp(vReflectionFactor, 0.0, 1.0));
				// finalColor.rgb *= edgeFactor;

				gl_FragColor = finalColor;
			}`

		};
		const shader = FresnelShader;
		const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
		const SkinMaterial = new THREE.ShaderMaterial({
			uniforms: uniforms,
			transparent: false,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader
		});
		SkinMaterial.uniforms.mFresnelBias.value = 0.2; // 设置 Fresnel 偏差
		SkinMaterial.uniforms.mFresnelPower.value = 3.0; // 设置 Fresnel 功率
		SkinMaterial.uniforms.mFresnelScale.value = 0.5; // 设置 Fresnel 缩放
		SkinMaterial.renderOrder = 1001
		SkinMaterial.depthTest = false
		SkinMaterial.depthWrite = true

		if (state) {
			app.objects_skin.forEach((child) => {
				if (!child.originalMaterial) {
					child.originalMaterial = child.material
					child.material = SkinMaterial
				}
			})
			// if (!app.skin.originalMaterial) {
			// 	app.skin.originalMaterial = app.skin.material
			// 	app.skin.material = SkinMaterial
			// }
		} else {
			app.objects_skin.forEach((child) => {
				if (child.originalMaterial) {
					child.material = child.originalMaterial
					child.material.opacity = 0.3
					child.originalMaterial = null
				}
			})
			// if (app.skin.originalMaterial) {
			// 	app.skin.material = app.skin.originalMaterial
			// 	app.skin.originalMaterial = null
			// }
		}
		// child.material.roughness = materialArr['pifu'].roughness
		// child.material.normalScale = new THREE.Vector2(materialArr['pifu'].normalScale, - materialArr['pifu'].normalScale)
	}
	APPFn.prototype.setPan = function (flag) {
		if (flag) {
			app.controls.mouseButtons = {
				LEFT: THREE.MOUSE.PAN,
				MIDDLE: THREE.MOUSE.DOLLY,
				RIGHT: THREE.MOUSE.ROTATE
			}
			app.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.ROTATE };
		} else {
			app.controls.mouseButtons = {
				LEFT: THREE.MOUSE.ROTATE,
				MIDDLE: THREE.MOUSE.DOLLY,
				RIGHT: THREE.MOUSE.PAN
			}
			app.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
		}
	}
	// 肌贴动画
	APPFn.prototype.animateMusclePatch = function () {
		const { current_patch, muscle_patch } = app
		const len = muscle_patch.length
		const mid_len = Math.floor(len / 2)
		muscle_patch.forEach((item, index) => {
			let gap = index - current_patch + mid_len
			if (gap >= len) {
				gap = gap - len
			} else if (gap < 0) {
				gap = gap + len
			}
			new TWEEN.Tween(item.position)
				.to({
					x: 2.5 * (gap - mid_len),
					y: ((gap - mid_len) > 0 ? -(gap - mid_len) * -2.2 : (gap - mid_len) * -2.2) - 1.8,
					z: (gap - mid_len) > 0 ? -(gap - mid_len) * 2 : (gap - mid_len) * 2
				}, 1000)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
			// item.position.set(0,0,0)
			// item.traverse(function(child) {
			// 	// console.log(child,'肌贴模型列表')
			// 	child.visible=true
			// 	child.position.set(0,0,0)

			// 	new TWEEN.Tween(child.position)
			// 	.to({ 
			// 		x: 2*(gap - mid_len), 
			// 		y: ((gap - mid_len) > 0 ? -(gap - mid_len) * -1: (gap - mid_len) * -1) - 1, 
			// 		z: (gap - mid_len) > 0 ? -(gap - mid_len) * 2: (gap - mid_len) * 2 
			// 	}, 1000)
			// 	.easing(TWEEN.Easing.Exponential.Out)
			// 	.start()
			// })
		})
	}
	// 切换镜头到相机数据
	APPFn.prototype.lookAtCameraData = function (data) {
		if (!data || data === '') {
			// 如果没有摄像机数据就走这个
			this.lookAtSelectObj(this.objects)
			return
		}
		let camera = undefined, controls = undefined
		try {
			camera = data.camera
			controls = data.controls
		} catch (error) {
			console.log(error)
		}
		if (camera && controls) {
			new TWEEN.Tween(this.controls.target)
				.to({ x: controls.x, y: controls.y, z: controls.z }, 500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
			new TWEEN.Tween(this.camera.position)
				.to({ x: camera.x, y: camera.y, z: camera.z }, 500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				.onUpdate(() => {
					this.camera.lookAt(this.controls.target)
				})
				.onComplete(() => {
					this.controls.enabled = true;
				})
		}
	}
	// 对比模式或正常 true 对比 false 正常
	APPFn.prototype.contrastOrNormal= function (flag)  {
		const { disease_stage, disease_xml, current_disease } = app.reactDomComponent.state
		const tween_list = []
		app.tween_list.forEach(item => {
			item.stop()
		})
		let groupName = null
		let group_list = []
		if (Array.isArray(disease_xml)) {
			groupName = disease_xml[disease_stage].o
			disease_xml.forEach((item) => { group_list.push((item.o) )})
		} else {
			groupName = disease_xml.o
		}
		app.objects_group.forEach((child) => {
			const index  = group_list.findIndex((item) => {
				return child.name === item
			})
			if (index !== -1) {
				child.visible = false
			}
		})
		const index = app.objects_group.findIndex((child) => {
			return child.name === groupName
		})
		const index2 = app.objects_group.findIndex((child) => {
			return child.name === `A${current_disease.id}_ZC`
		})
		let index3 = null
		if (Array.isArray(disease_xml)) {
			index3 = app.objects_group.findIndex((child) => {
				return child.name === `A${current_disease.id}_JB`
			})
		}
		if (flag) {
			if (index !== -1) {
				const obj = app.objects_group[index]
				obj.visible = true
				// app.objects_group[index].position.x =  - app.parts_radius
				const position = obj.position
				const tween = new TWEEN.Tween(app.objects_group[index].position)
				.to({ x: position.x - app.parts_radius , y: position.y, z: position.z }, 1500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				tween_list.push(tween)
			}
			if (index2 !== -1) {
				const obj = app.objects_group[index2]
				obj.visible = true
				const position = obj.position
				// app.objects_group[index2].position.x = app.parts_radius
				const tween = new TWEEN.Tween(app.objects_group[index2].position)
				.to({ x: position.x + app.parts_radius , y: position.y, z: position.z }, 1500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				tween_list.push(tween)

			}
			if (index3 && index3 !== -1) {
				const obj = app.objects_group[index3]
				obj.visible = true
				// app.objects_group[index].position.x =  - app.parts_radius
				const position = obj.position
				const tween = new TWEEN.Tween(app.objects_group[index3].position)
				.to({ x: position.x - app.parts_radius , y: position.y, z: position.z }, 1500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				tween_list.push(tween)

			}
			app.initCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0.1, z: 0.1 })
			// setTimeout(() => {
			// 	app.lookAtSelectObj(app.objects_disease)
			// }, 1000);
		} else {
			if (index !== -1) {
				const obj = app.objects_group[index]
				obj.visible = true
				// app.objects_group[index].position.x =  - app.parts_radius
				const position = obj.position
				const tween = new TWEEN.Tween(app.objects_group[index].position)
				.to({ x: 0 , y: position.y, z: position.z }, 1500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				.onComplete(() => {
					obj.visible = true
				})
				tween_list.push(tween)

			}
			if (index2 !== -1) {
				const obj = app.objects_group[index2]
				const position = obj.position
				// app.objects_group[index2].position.x = app.parts_radius
				const tween = new TWEEN.Tween(app.objects_group[index2].position)
				.to({ x: 0 , y: position.y, z: position.z }, 1500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				.onComplete(() => {
					obj.visible = false
				})
				tween_list.push(tween)

			}
			if (index3 && index3 !== -1) {
				const obj = app.objects_group[index3]
				obj.visible = true
				// app.objects_group[index].position.x =  - app.parts_radius
				const position = obj.position
				const tween = new TWEEN.Tween(app.objects_group[index3].position)
				.to({ x: 0 , y: position.y, z: position.z }, 1500)
				.easing(TWEEN.Easing.Exponential.Out)
				.start()
				.onComplete(() => {
					obj.visible = true
				})
				tween_list.push(tween)

			}
		}
		app.tween_list = tween_list
	}
	// 切换模型阶段
	APPFn.prototype.changeStage = function (disease_stage) {
		const { disease_xml, current_disease } = app.reactDomComponent.state
		app.reactDomComponent.setState({
			contrast_mode: false
		})
		console.log('当前阶段', disease_stage)
		const group_list = []
		if (Array.isArray(disease_xml)) {
			disease_xml.forEach(item  => {
				group_list.push(item.o)
			})
			app.objects_group.forEach((child) => {
				const index = group_list.findIndex((item) => {
					return child.name === item && child.name !== item[disease_stage].o
				})
				if (index !== -1) {
					if ( child.name === group_list[disease_stage]) {
						child.visible = true
					} else {
						child.visible = false
						child.position.x = 0
					}
				}
				child.position.x = 0
			})
		}
		
		setTimeout(() => {
			const index2 = app.objects_group.findIndex((child) => {
				return child.name === `A${current_disease.id}_ZC`
			})
	
			app.objects_group[index2].visible = false
			app.objects_group[index2].position.x = 0
			const index = app.objects_group.findIndex((child) => {
				return child.name === group_list[disease_stage]
			})
			app.objects_group[index].visible = true
			app.objects_group[index].position.x = 0
			let index3 = null
			if (Array.isArray(disease_xml)) {
				index3 = app.objects_group.findIndex((child) => {
					return child.name === `A${current_disease.id}_JB`
				})
			}
			if (index3 && index3 !== -1) {
				const obj = app.objects_group[index3]
				obj.visible = true
				app.objects_group[index3].position.x = 0
			}	
		})
	}
	// 切换身体或肌贴信息 true 局部 ，false 身体, record_state是否记录切换状态
	APPFn.prototype.changeBodyOrParts = function (flag = undefined) {
		if (!flag) {
			app.initCamera()
		}
		const { disease_stage, disease_xml, current_disease } = app.reactDomComponent.state
		if (flag) {

			app.objects_group.forEach((item) => {
				item.visible = true
			})
			
			app.objects.forEach((item) => {
				item.visible = false
				if (item.userData && item.userData.parent === '神经') {

				} else {
					item.visible = false
				}
			})
			const group_list = []
			if (Array.isArray(disease_xml)) {
				disease_xml.forEach(item  => {
					group_list.push(item.o)
				})
				app.objects_group.forEach((child) => {
					const index = group_list.findIndex((item) => {
						return child.name === item && child.name !== item[0].o
					})
					if (index !== -1) {
						child.visible = false
					}
				})
			}
			const index = app.objects_group.findIndex((child) => {
				return child.name === `A${current_disease.id}_ZC`
			})
			app.objects_group[index].visible = false
			app.objects_skin.forEach((item) => {
				item.visible = false
			})
			app.showOrhiddenPainPoints(false)
			setTimeout(() => {
				console.log(disease_stage, Array.isArray(disease_xml), disease_xml, '当前信息')
				app.reactDomComponent.lookAtPainPoints()
				
				const cameraSphere = app.calcSelectObjSphere(app.objects_disease)
				app.parts_radius = cameraSphere.radius / 3
			});
		} else {
			app.objects_group.forEach((item) => {
				item.visible = false
			})
			app.objects.forEach((item) => {
				if (item.userData && item.userData.parent === '神经') {

				} else {
					item.visible = true
				}
			})
			app.objects_skin.forEach((item) => {
				item.visible = true
			})
			setTimeout(() => {
				app.reactDomComponent.resetBody()	
			});
		}
	}
	APPFn.prototype.initCamera = function (target = undefined, position = undefined) {
		new TWEEN.Tween(app.controls.target)
			.to(target || { x: 0, y: 0.03, z: 0 }, 1000)
			.easing(TWEEN.Easing.Exponential.Out)
			.start()
		// app.camera.lookAt(new THREE.Vector3(0, 2.5, 0)) // 设置相机方向
		// app.camera.position.set(0,2.5, 8)
		new TWEEN.Tween(app.camera.position)
			.to(position || { x: 0, y: 0.03, z: 0.08 }, 1000)
			.easing(TWEEN.Easing.Exponential.Out)
			.start()
			.onUpdate(() => {
				app.camera.lookAt(app.controls.target)
			})
	}
	APPFn.prototype.calcSelectObjSphere = function(arr) {
		let objectArr = arr || this.selectObj
		let object3D = new THREE.Object3D()
		for (let i = 0, len = objectArr.length; i < len; i++) {
			object3D.children.push(objectArr[i])
		}
		let box3 = new THREE.Box3()
		box3.expandByObject(object3D)
		let sphere = new THREE.Sphere()
		box3.getBoundingSphere(sphere)
		return sphere
	}
	APPFn.prototype.initCameraPatch = function () {
		const tween1 = new TWEEN.Tween(app.controls.target)
			.to({ x: 0, y: 4, z: 0 }, 1000)
			.easing(TWEEN.Easing.Exponential.Out)
			.start()
		const tween2 = new TWEEN.Tween(app.camera.position)
			.to({ x: 0, y: 5, z: 8 }, 1000)
			.easing(TWEEN.Easing.Exponential.Out)
			.start()
			.onUpdate(() => {
				const show_muscle_patch = this.reactDomComponent.state.show_muscle_patch
				if (!show_muscle_patch) {
					tween1.stop()
					tween2.stop()
				}
				app.camera.lookAt(app.controls.target)
			})
	}
	APPFn.prototype.reset = function () {

		app.objects = []
		app.optionObj = []
		app.selectObj = []
		app.controls.reset()

		while (app.scene.children.length > 0) {
			app.scene.remove(scene.children[0]);
		}

		app.scene.add(app.camera)
		app.scene.add(app.ambientLight)
		app.camera.add(app.dirLight)

	}

	const app = new APPFn()
	return app

})()

export default app