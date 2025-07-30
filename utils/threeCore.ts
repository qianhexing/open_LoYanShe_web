import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
interface SceneObjectJSON  {
  type: 'box' | 'sphere' | 'model';
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color?: string;
  size?: [number, number, number]; // for box
  radius?: number; // for sphere
  url?: string; // for model
  useDracoLoader?: boolean;
  dracoDecoderPath?: string

  playAnimations?: string[]; 
  loopOnce?: boolean;
};
interface SceneJSON {
  objects: SceneObjectJSON[]
};


interface ThreeCoreOptions {
  antialias?: boolean;
  alpha?: boolean;
  clearColor?: number;
  cameraType?: 'perspective' | 'orthographic';
  cameraPosition?: { x: number; y: number; z: number };
  enableOrbitControls?: boolean;
  enableStats?: boolean;
  pixelRatio?: number;
  enableCSS3DRenderer?: boolean; // 新增选项：是否启用CSS3D渲染器
}

class ThreeCore {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;
  public css3DRenderer?: CSS3DRenderer; // CSS3D渲染器
  public controls: OrbitControls;
  public allObjects: THREE.Object3D[] // 场景里的所有模型
  
  public mixers: AnimationMixer[] = []; // 用于管理多个模型动画混合器
  public stats?: Stats;
  public animationCallbacks: Array<() => void>;
  public resizeCallbacks: Array<(width: number, height: number) => void>;
  public options: ThreeCoreOptions;
  public container?: HTMLElement | null;
  private resizeObserver?: ResizeObserver;
  public loadedModelURLs: Set<string>; // 已加载过的模型地址集合
  public loadedModels: THREE.Object3D[]; // 加载成功的模型数组
  public clock: THREE.Clock;

  constructor(options: ThreeCoreOptions = {}) {
    const defaultOptions: ThreeCoreOptions = {
      antialias: true,
      alpha: false,
      clearColor: 0x000000,
      cameraType: 'perspective',
      cameraPosition: { x: 0, y: 4, z: 5 },
      enableOrbitControls: true,
      enableStats: false,
      pixelRatio: window.devicePixelRatio || 1,
      enableCSS3DRenderer: false // 默认不启用CSS3D渲染器
    };

    this.options = { ...defaultOptions, ...options };
    this.scene = null!;
    this.camera = null!;
    this.renderer = null!;
    this.animationCallbacks = [];
    this.resizeCallbacks = [];
    this.container = null;
    this.controls = null!

    this.loadedModelURLs = new Set();
    this.loadedModels = [];
    this.allObjects = []
    this.clock = new THREE.Clock();

    this.initScene();
    this.initCamera();
    this.initRenderer();
    
    // 如果启用了CSS3D渲染器
    if (this.options.enableCSS3DRenderer) {
      this.initCSS3DRenderer();
    }
    
    this.initLights();
    
    // if (this.options.enableOrbitControls) {
    //   this.initOrbitControls();
    // }
    this.initOrbitControls();
    if (this.options.enableStats) {
      this.initStats();
    }
  }
  public async loadModel(url: string, options = {
    useDracoLoader: false,
    dracoDecoderPath: 'jsm/libs/draco/gltf/'
  }): Promise<THREE.Object3D> {
    // 如果已经加载过，直接返回缓存的模型
    const loader = new GLTFLoader();
    if (options.useDracoLoader) {
      const dracoLoader = new DRACOLoader();
      const decoderPath = options.dracoDecoderPath || '/draco/gltf/';
      dracoLoader.setDecoderPath(decoderPath);
      loader.setDRACOLoader(dracoLoader);
    }
    
    return new Promise((resolve, reject) => {
      if (this.loadedModelURLs.has(url)) {
        const existing = this.loadedModels.find(obj => obj.userData.url === url);
        if (existing) {
          resolve(existing.clone(true))
        }
      } else {
        loader.load(url, (gltf) => {
          const model = gltf.scene;
          model.userData.url = url;
    
          // this.scene.add(model);
          this.loadedModelURLs.add(url);
          this.loadedModels.push(model);
    
          // 动画处理
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new AnimationMixer(model);
            gltf.animations.forEach((clip) => {
              mixer.clipAction(clip).play();
            });
            this.addAnimationCallback(() => mixer.update(this.clock.getDelta()));
          }
    
          resolve(model);
        }, undefined, (error) => {
          console.error(`加载模型失败: ${url}`, error);
          reject(error);
        });
      }
    });
  }
  

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.options.antialias,
      alpha: this.options.alpha
    });
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      // 将事件传递给底层的WebGL渲染器
      console.log('webgl控制器被点击了')
    });
    this.renderer.setPixelRatio(this.options.pixelRatio);
    
    const width = this.container ? this.container.clientWidth : window.innerWidth;
    const height = this.container ? this.container.clientHeight : window.innerHeight;
    this.renderer.setSize(width, height);
    
    this.renderer.physicallyCorrectLights = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  initOrbitControls() {
    if (!this.camera || !this.renderer) return;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
  }

  initStats() {
    this.stats = new Stats();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.7);
    this.scene.add(hemisphereLight);
  }
  addAnimationCallback(callback: () => void) {
    this.animationCallbacks.push(callback);
  }
  initScene() {
    this.scene = new THREE.Scene();
    if (!this.options.alpha) {
      this.scene.background = null
      // new THREE.Color(this.options.clearColor);
    }
  }

  initCamera() {
    const { cameraType, cameraPosition } = this.options;
    const width = this.container ? this.container.clientWidth : window.innerWidth;
    const height = this.container ? this.container.clientHeight : window.innerHeight;
    const aspect = width / height;
    
    if (cameraType === 'orthographic') {
      const frustumSize = 5;
      this.camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
    } else {
      this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    }
    
    this.camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    this.camera.lookAt(0, 0, 0);
  }
  // 新增方法：初始化CSS3D渲染器
  initCSS3DRenderer() {
    this.css3DRenderer = new CSS3DRenderer();
    this.css3DRenderer.setSize(
      this.container ? this.container.clientWidth : window.innerWidth,
      this.container ? this.container.clientHeight : window.innerHeight
    );
    
    // 设置CSS3D渲染器的DOM元素样式，使其与WebGL渲染器重叠
    this.css3DRenderer.domElement.style.position = 'absolute';
    this.css3DRenderer.domElement.style.top = '0';
    this.css3DRenderer.domElement.style.pointerEvents = 'none';
    // 在初始化代码中添加
    this.css3DRenderer.domElement.addEventListener('mousedown', (e) => {
      // 将事件传递给底层的WebGL渲染器
      console.log('点击了')
      this.renderer.domElement.dispatchEvent(new MouseEvent(e.type, e));
    });
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.zIndex = '0';
    this.css3DRenderer.domElement.style.zIndex = '1';
  }

  // 修改onContainerResize方法以支持CSS3D渲染器
  onContainerResize() {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    // 更新相机
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect;
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      const frustumSize = 5;
      this.camera.left = -frustumSize * aspect / 2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = -frustumSize / 2;
    }
    this.camera.updateProjectionMatrix();

    // 更新渲染器
    this.renderer.setSize(width, height);
    
    // 更新CSS3D渲染器
    if (this.css3DRenderer) {
      this.css3DRenderer.setSize(width, height);
    }

    // 执行注册的回调
    this.resizeCallbacks.forEach(callback => callback(width, height));
  }

  // 修改startAnimationLoop方法以支持CSS3D渲染器
  startAnimationLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      if (this.controls) {
        this.controls.update();
      }

      this.animationCallbacks.forEach(callback => callback());
      
      // 渲染WebGL场景
      this.renderer.render(this.scene, this.camera);
      
      // 如果启用了CSS3D渲染器，也渲染CSS3D场景
      if (this.css3DRenderer) {
        this.css3DRenderer.render(this.scene, this.camera);
      }

      if (this.stats) {
        this.stats.update();
      }
    };

    animate();
  }

  // 修改mount方法以支持CSS3D渲染器
  mount(container: HTMLElement | null) {
    // 先清理之前的容器
    if (this.container) {
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      if (this.css3DRenderer?.domElement.parentNode) {
        this.css3DRenderer.domElement.parentNode.removeChild(this.css3DRenderer.domElement);
      }
    }
    
    // 移除之前的resize观察者
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.container = container;
    
    if (this.container) {
      // 添加WebGL渲染器
      this.container.appendChild(this.renderer.domElement);
      
      // 如果启用了CSS3D渲染器，添加到容器中
      if (this.css3DRenderer) {
        this.container.appendChild(this.css3DRenderer.domElement);
      }
      
      // 使用ResizeObserver监听容器大小变化
      this.resizeObserver = new ResizeObserver(() => {
        this.onContainerResize();
      });
      this.resizeObserver.observe(this.container);
      
      // 初始调整大小
      this.onContainerResize();
    } else {
      // 如果没有指定容器，添加到body
      document.body.appendChild(this.renderer.domElement);
      
      if (this.css3DRenderer) {
        document.body.appendChild(this.css3DRenderer.domElement);
      }
      
      // 监听窗口大小变化
      window.addEventListener('resize', () => this.onContainerResize());
    }
  }

  // 新增方法：创建CSS3D对象
  createCSS3DObject(element: HTMLElement): CSS3DObject {
    if (!this.css3DRenderer) {
      throw new Error('CSS3DRenderer is not enabled. Set enableCSS3DRenderer to true in options.');
    }
    return new CSS3DObject(element);
  }

  public async loadSceneFromJSON(json: SceneJSON) {
    for (const obj of json.objects) {
      const position = obj.position || [0, 0, 0];
      const rotation = obj.rotation || [0, 0, 0];
      const scale = obj.scale || [1, 1, 1];
  
      let mesh: THREE.Object3D | null = null;
  
      if (obj.type === 'box') {
        const size = obj.size || [1, 1, 1];
        const geometry = new THREE.BoxGeometry(...size);
        const material = new THREE.MeshStandardMaterial({ color: obj.color || '#ffffff' });
        mesh = new THREE.Mesh(geometry, material);
      }
  
      if (obj.type === 'sphere') {
        const radius = obj.radius || 1;
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: obj.color || '#ffffff' });
        mesh = new THREE.Mesh(geometry, material);
      }
  
      if (obj.type === 'model' && obj.url) {
        try {
          const model = await this.loadModel(BASE_IMG + obj.url, {
            useDracoLoader: obj.useDracoLoader ?? false,
            dracoDecoderPath: (obj.useDracoLoader && obj.dracoDecoderPath) ? obj.dracoDecoderPath : 'jsm/libs/draco/gltf/',
          });
          mesh = model
        } catch (e) {
          console.warn(`模型加载失败：${obj.url}`, e);
        }
      }
  
      if (mesh) {
        mesh.position.set(...position);
        mesh.rotation.set(...rotation);
        mesh.scale.set(...scale);
        this.allObjects.push(mesh)
        this.scene.add(mesh);
      }
    }
  }
  
  

  // 修改dispose方法以清理CSS3D渲染器
  dispose() {
    // 清理事件监听
    window.removeEventListener('resize', () => this.onContainerResize());
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.controls) {
      this.controls.dispose();
    }
    
    if (this.stats) {
      document.body.removeChild(this.stats.dom);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    // 清理CSS3D渲染器的DOM元素
    if (this.css3DRenderer?.domElement.parentNode) {
      this.css3DRenderer.domElement.parentNode.removeChild(this.css3DRenderer.domElement);
    }
    
    // 清理场景
    while(this.scene.children.length > 0) { 
      const object = this.scene.children[0];
      if ('geometry' in object) object.geometry.dispose();
      if ('material' in object) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
      this.scene.remove(object);
    }
  }
}

export default ThreeCore;