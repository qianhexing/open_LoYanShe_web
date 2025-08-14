import * as THREE from 'three';
import type { GPUPicker } from 'three_gpu_picking/src/gpupicker.js'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class TransformGizmo extends THREE.Group {
  public domElement: HTMLElement;
  public activeAxis: THREE.Vector3 | null; 
  public target: THREE.Object3D | null; 
  public dragging: boolean; 

  

  constructor(scene: THREE.Scene, camera: THREE.OrthographicCamera, controls: OrbitControls , domElement: HTMLElement, picker: GPUPicker) {
    super();
    this.camera = camera;
    this.scene = scene
    this.domElement = domElement;
    this.scene = scene
    this.target = null;
    this.controls = controls
    this.raycaster = new THREE.Raycaster();
    this.picker = picker
    this.mouse = new THREE.Vector2();

    this.activeAxis = null;
    this.dragging = false;

    this.createGizmo();
    this.visible = false;

    this.rotating = false;
    this.activeRotationAxis = null;
    this.startRotateVector = null; // 起始旋转角度

    this._initEvents();
  }

  createGizmo() {
    const arrowLength = 1;
  
    const createArrow = (dir: THREE.Vector3, color: number) => {
      const arrowLength = 1;
      const shaftRadius = 0.04;
      const headRadius = 0.08;
      const headLength = 0.2;
      const shaftLength = arrowLength - headLength;
  
      const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8,depthWrite: false });
  
      const shaftGeometry = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12);
      const shaft = new THREE.Mesh(shaftGeometry, material);
      shaft.position.set(0, shaftLength / 2, 0);
      shaft.userData.axis = dir

      const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 12);
      const head = new THREE.Mesh(headGeometry, material);
      head.position.set(0, shaftLength + headLength / 2, 0);
      head.userData.axis = dir
  
      const arrowGroup = new THREE.Group();
      shaft.renderOrder = 1
      head.renderOrder = 1
      arrowGroup.add(shaft);
      arrowGroup.add(head);
  
      arrowGroup.position.copy(dir.clone().multiplyScalar(arrowLength));
      arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  
      arrowGroup.userData.axis = dir;
  
      this.add(arrowGroup);
    };
  
    const createRotationRing = (axis: THREE.Vector3, color: number) => {
      const ringRadius = 1.2;
      const tubeRadius = 0.05;
  
      const geometry = new THREE.TorusGeometry(ringRadius, tubeRadius, 32, 64);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        depthTest: false,
        depthWrite: false
      });
  
      const ring = new THREE.Mesh(geometry, material);
  
      // 旋转到指定轴所在平面
      if (axis.equals(new THREE.Vector3(1, 0, 0))) {
        ring.rotation.y = Math.PI / 2; // 绕 X 轴 → YZ 平面
      } else if (axis.equals(new THREE.Vector3(0, 1, 0))) {
        ring.rotation.x = Math.PI / 2; // 绕 Y 轴 → ZX 平面
      } else if (axis.equals(new THREE.Vector3(0, 0, 1))) {
        ring.rotation.x = Math.PI / 2; // Z 环默认在 XY 平面
      }

      ring.renderOrder = 1
      ring.userData.axis = axis;
      ring.userData.type = 'rotate';
      console.log(ring, '圆环')
      ring.userData.ignorePick = true
      // this.add(ring);
      return ring
    };
  
    // 平移箭头
    createArrow(new THREE.Vector3(1, 0, 0), 0xff0000); // X
    createArrow(new THREE.Vector3(0, 1, 0), 0x00ff00); // Y
    createArrow(new THREE.Vector3(0, 0, 1), 0x0000ff); // Z
  
    const rin_group = new THREE.Group()
    // 旋转环（XY平面、YZ平面、ZX平面）
    rin_group.add(createRotationRing(new THREE.Vector3(0, 0, 1), 0xffff00)); // 绕Z → XY平面
    rin_group.add(createRotationRing(new THREE.Vector3(1, 0, 0), 0xff00ff)); // 绕X → YZ平面
    rin_group.add(createRotationRing(new THREE.Vector3(0, 1, 0), 0x00ffff)); // 绕Y → ZX平面
    this.ring = rin_group
    this.add(rin_group)
  }
  

  attach(object) {
    this.target = object;
    this.visible = true;
    this.position.copy(object.position);
    this.ring.rotation.copy(object.rotation)
  }

  detach() {
    this.target = null;
    this.visible = false;
  }

  update() {
    if (!this.target) return;
    this.position.copy(this.target.position);
  }
  _initEvents() {
    this.domElement.addEventListener('pointerdown', this._onPointerDown.bind(this));
    this.domElement.addEventListener('pointermove', this._onPointerMove.bind(this));
    this.domElement.addEventListener('pointerup', this._onPointerUp.bind(this));
  }
  dispose() {
    // 移除事件监听器
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerup', this._onPointerUp);
    // 释放资源
    this.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
  
    this.clear();
  
    this.target = null;
    this.visible = false;
  }
  
  
  gpuPick(ev: MouseEvent | TouchEvent) {
    function shouldPickObject(object: THREE.Object3D) {
      return object.userData.axis;
    }
  
    const inversePixelRatio = 1.0 / (window.devicePixelRatio || 1);
  
    let clientX: number;
    let clientY: number;
  
    if ('touches' in ev) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
  
    let sub = 0;
    if (this.domElement) {
      sub = this.domElement.getBoundingClientRect().left;
    }
  
    const objId = this.picker.pick(
      clientX * window.devicePixelRatio - sub * window.devicePixelRatio,
      clientY * window.devicePixelRatio,
      shouldPickObject
    );

    const pickedObject = this.getObjectById(objId);
    // const pickedObject = this.scene.getObjectById(objId);
  
    function findTopGroup(object: THREE.Object3D | null | undefined): THREE.Object3D | null {
      if (!object) return null;
      // let current = object;
      // while (current.parent && current.parent.type !== 'Scene') {
      //   current = current.parent;
      // }
      return object;
    }
  
    return findTopGroup(pickedObject);
  }
  // 旋转平面
  _getIntersectVectorOnRotationPlane(event: PointerEvent, axis: THREE.Vector3): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  
    this.raycaster.setFromCamera(mouse, this.camera);
  
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(axis.clone().normalize(), this.position);
  
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, intersection);
    if (!hit) return null;
  
    // 返回从 gizmo 中心指向点击点的向量
    return intersection.sub(this.position).normalize();
  }
  // 移动平面
  // 获取当前拖拽轴方向上，鼠标与轴垂直平面的交点
  _getIntersectPointOnAxisPlane(event: PointerEvent, axis: THREE.Vector3): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  
    this.raycaster.setFromCamera(mouse, this.camera);
  
    // 正确地选择平面的法线 —— 应该是拖拽轴的垂直平面（不是本身）
    const planeNormal = new THREE.Vector3();
    if (axis.x === 1) planeNormal.set(0, 1, 0);  // 拖动 X 轴，使用 YZ 平面
    else if (axis.y === 1) planeNormal.set(1, 0, 0); // 拖动 Y 轴，使用 XZ 平面
    else if (axis.z === 1) planeNormal.set(0, 1, 0); // 拖动 Z 轴，使用 XY 平面
    else planeNormal.copy(axis);
  
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      this.position
    );
    // const planeNormal = axis.clone().normalize();
    // const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, this.position);
  
    // 可视化 plane
    if (!this._debugPlaneHelper) {
      this._debugPlaneHelper = new THREE.PlaneHelper(plane, 2, 0xff0000);
      this.scene.add(this._debugPlaneHelper);
    } else {
      this._debugPlaneHelper.plane = plane;
      this._debugPlaneHelper.updateMatrixWorld(true);
      this._debugPlaneHelper.visible = true;
    }
  
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, intersection);
    return hit ? intersection : null;
  }
  

  
  _onPointerDown(event: PointerEvent) {
    if (!this.visible) return;
    const rect = this.domElement.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;
  
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  
    const obj = this.gpuPick(event);
    if (obj) {
      const axis = obj.userData.axis?.clone().normalize();
      if (!axis) return;
  
      if (obj.userData.type === 'rotate') {
        this.activeRotationAxis = axis;
        this.rotating = true;
      
        this.startRotateVector = this._getIntersectVectorOnRotationPlane(event, axis);
      }
       else {
        this.activeAxis = axis;
        this.dragging = true;
        this.startPoint = this._getIntersectPointOnAxisPlane(event, this.activeAxis).clone().sub(this.position)
      }
      this.controls.enabled = false

    }
  }
  
  _onPointerMove(event: PointerEvent) {
    if (!this.target) return;
  
    // === 平移操作 ===
    if (this.dragging && this.activeAxis) {
      const newPoint = this._getIntersectPointOnAxisPlane(event, this.activeAxis);
      if (!newPoint || !this.startPoint) return;
  
      const deltaVec = newPoint.clone().sub(this.startPoint);
      const axis = this.activeAxis.clone().normalize();
      const projectedDelta = axis.multiplyScalar(deltaVec.dot(axis));
      if (this.activeAxis.y === 1) {
        this.position.setY(deltaVec.y)
      } else if (this.activeAxis.z === 1) {
        this.position.setZ(deltaVec.z)
      } else if (this.activeAxis.x === 1) {
        this.position.setX(deltaVec.x)

      }
      console.log(this.position,'位置属性', newPoint, this.activeAxis)
      this.target.position.copy(this.position);
      // this.startPoint.set(0,0,0);
    }
  
    // === 旋转操作 ===
    if (this.rotating && this.activeRotationAxis) {
      const newVec = this._getIntersectVectorOnRotationPlane(event, this.activeRotationAxis);
      if (!newVec || !this.startRotateVector) return;
  
      // 计算角度差（方向使用叉乘判断）
      const angle = this.startRotateVector.angleTo(newVec);
      const cross = new THREE.Vector3().crossVectors(this.startRotateVector, newVec);
      const direction = cross.dot(this.activeRotationAxis) < 0 ? -1 : 1;
  
      const deltaAngle = direction * angle;
  
      // 旋转
      const q = new THREE.Quaternion().setFromAxisAngle(this.activeRotationAxis, deltaAngle);
      this.ring.quaternion.premultiply(q);
      this.target.quaternion.copy(this.ring.quaternion);
  
      // 更新起点向量
      this.startRotateVector.copy(newVec);
    }
  }
  
  
  // _onPointerMove(event: PointerEvent) {
  //   const obj = this.gpuPick(event);
  //   if (obj) {
  //     console.log('移动到的obj', obj)
  //   }
  //   if (!this.target) return;
  
  //   // 计算鼠标移动量
  //   const delta = new THREE.Vector2(event.movementX, -event.movementY);
  
  //   // === 移动 ===
  //   if (this.dragging && this.activeAxis) {
  //     const moveAmount = delta.length() * 0.01;
  //     const moveDir = this.activeAxis.clone().normalize().multiplyScalar(
  //       delta.x * this.activeAxis.x +
  //       delta.y * this.activeAxis.y +
  //       delta.y * this.activeAxis.z
  //     );
      
  
  //     this.position.add(moveDir);              // 只移动 gizmo
  //     this.target.position.copy(this.position); // 同步给目标
  //   }
  
  //   // === 旋转 ===
  //   if (this.rotating && this.activeRotationAxis) {
  //     const angle = delta.length() * 0.01;
  //     const axis = this.activeRotationAxis;
  
  //     // 构建旋转四元数
  //     const quat = new THREE.Quaternion();
  //     quat.setFromAxisAngle(axis, delta.x > 0 ? angle : -angle); // 根据方向旋转
  
  //     this.quaternion.multiply(quat);               // 只旋转 gizmo
  //     this.target.quaternion.copy(this.quaternion); // 同步给目标
  //   }
  // }
  

  _onPointerUp() {
    
    this.activeAxis = null;
  
    this.rotating = false;
    this.activeRotationAxis = null;
  
    this.controls.enabled = true;
    setTimeout(() => {
      this.dragging = false;
    });
  }
  
}
