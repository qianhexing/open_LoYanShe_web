<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, shallowRef, computed, onUnmounted } from 'vue';
import ThreeCore from '@/utils/threeCore';
import * as THREE from 'three';
import { getLibraryList, getLibraryById } from '@/api/library';
import type { Shop, Library } from '@/types/api';
import { useRouter } from 'vue-router';
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig';
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl';
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const router = useRouter();
const toast = useToast();
const container = ref<HTMLElement | null>(null);
const threeCore = shallowRef<ThreeCore | null>(null);
const loading = ref(true);
const shopMap = new Map<number, Shop>();
const libraryMap = new Map<number, Library>(); // 为了快速查找 parent
const libraryList = ref<Library[]>([]);

// 检测是否为手机端
const isMobile = ref(false);
const checkIsMobile = () => {
  if (import.meta.client) {
    isMobile.value = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
};

// 选中信息（点击后锁定）
const selectedInfo = ref<{
  visible: boolean;
  x: number;
  y: number;
  data: Library | Shop | null;
  type: 'library' | 'shop';
  loading?: boolean;
  currentId?: number; // 当前选中的 ID（library_id 或 shop_id）
}>({
  visible: false,
  x: 0,
  y: 0,
  data: null,
  type: 'library',
  loading: false,
  currentId: undefined
});

// 颜色生成器
const colorMap = new Map<number, THREE.Color>();
const getShopColor = (shopId: number) => {
  if (!colorMap.has(shopId)) {
    const hue = Math.random();
    const saturation = 0.6 + Math.random() * 0.4;
    const lightness = 0.4 + Math.random() * 0.3;
    colorMap.set(shopId, new THREE.Color().setHSL(hue, saturation, lightness));
  }
  return colorMap.get(shopId)!;
};

// 获取数据
const fetchData = async () => {
  try {
    loading.value = true;

    // 获取店铺列表（直接加载 JSON）
    const shopRes = await fetch(`${BASE_IMG}/ssr/visualization/shop.json`);
    const shopList = await shopRes.json() as Shop[];
    // biome-ignore lint/complexity/noForEach: <explanation>
    shopList.forEach(shop => {
      shopMap.set(shop.shop_id, shop);
      getShopColor(shop.shop_id);
    });

    // 获取图鉴列表
    const libRes = await fetch(`${BASE_IMG}/ssr/visualization/library.json`);
    // const libraryList = await libRes.json() as Library[];
    // const libRes = await getLibraryList({ page: 1, pageSize: 9 });
    libraryList.value = (await libRes.json() as Library[]).filter(l => l.shop_id);

    // 构建 Map 供后续查找
    // biome-ignore lint/complexity/noForEach: <explanation>
    libraryList.value.forEach(lib => {
      libraryMap.set(lib.library_id, { ...lib, wardrobe_count: 1 });
    });
  } catch (error) {
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const createFocusRing = () => {
  const geometry = new THREE.RingGeometry(0.8, 1.0, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.visible = false;
  ring.userData.isFocusRing = true;
  return ring;
}

const createPointCloud = () => {
  if (!threeCore.value || libraryList.value.length === 0) return;

  const scene = threeCore.value.scene;
  const libraries = libraryList.value;
  const count = libraries.length;

  // 1. 计算店铺聚类位置 (Grid Layout - Random Space)
  const shopClusters = new Map<number, { cx: number, cy: number, cz: number }>();
  const uniqueShopIds = new Set(libraries.map(l => l.shop_id).filter(id => id));
  const uniqueShopIdsArray = Array.from(uniqueShopIds);

  // 星系排布
  const GALAXY_RADIUS = 200;
  uniqueShopIdsArray.forEach((id, index) => {
    const r = Math.random() * GALAXY_RADIUS + 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    shopClusters.set(id!, {
      cx: r * Math.sin(phi) * Math.cos(theta),
      cy: r * Math.sin(phi) * Math.sin(theta),
      cz: r * Math.cos(phi)
    });
  });

  // 2. 计算每个图鉴的位置 (需要先计算所有位置，因为子图鉴依赖母图鉴位置)
  // 为了简单，我们先计算所有关联了店铺的父级图鉴位置，以及店铺位置。
  // 然后对于有 parent_id 的图鉴，我们在其 parent 周围分布。
  // 注意：如果层级很深，或者顺序不对，可能找不到 parent 位置。
  // 简便方法：所有顶层图鉴(parent_id=0)围绕店铺分布。子图鉴(parent_id!=0)围绕母图鉴分布。
  // 我们需要一个 Map 来存储已计算出的图鉴位置。

  const libPosMap = new Map<number, { x: number, y: number, z: number }>();

  // 分两步处理：
  // Step 1: 处理 parent_id === 0 的图鉴
  // biome-ignore lint/complexity/noForEach: <explanation>
  libraries.forEach(lib => {
    if (!lib.parent_id || lib.parent_id === 0) {
      const shopId = lib.shop_id!;
      const center = shopClusters.get(shopId) || { cx: 0, cy: 0, cz: 0 };
      const offset = 25;
      const x = center.cx + (Math.random() - 0.5) * offset;
      const y = center.cy + (Math.random() - 0.5) * offset;
      const z = center.cz + (Math.random() - 0.5) * offset;
      libPosMap.set(lib.library_id, { x, y, z });
    }
  });

  // Step 2: 处理 parent_id !== 0 的图鉴 (可能存在多级，这里简单假设大多数只有一层或通过多次循环解决)
  // 为了确保所有 parent 都被处理，我们可以循环几次，或者递归。这里简单循环两次覆盖大部分情况。
  for (let p = 0; p < 3; p++) {
    // biome-ignore lint/complexity/noForEach: <explanation>
    libraries.forEach(lib => {
      if (lib.parent_id && lib.parent_id !== 0 && !libPosMap.has(lib.library_id)) {
        const parentPos = libPosMap.get(lib.parent_id);
        if (parentPos) {
          // 围绕母图鉴分布，范围更小，体现聚合
          const offset = 8;
          const x = parentPos.x + (Math.random() - 0.5) * offset;
          const y = parentPos.y + (Math.random() - 0.5) * offset;
          const z = parentPos.z + (Math.random() - 0.5) * offset;
          libPosMap.set(lib.library_id, { x, y, z });
        } else {
          // 如果找不到母图鉴位置（可能母图鉴数据没加载），暂时按店铺分布
          const shopId = lib.shop_id!;
          const center = shopClusters.get(shopId) || { cx: 0, cy: 0, cz: 0 };
          const offset = 25;
          const x = center.cx + (Math.random() - 0.5) * offset;
          const y = center.cy + (Math.random() - 0.5) * offset;
          const z = center.cz + (Math.random() - 0.5) * offset;
          libPosMap.set(lib.library_id, { x, y, z });
        }
      }
    });
  }

  // 3. 准备 Buffer 数据
  const libPositions = new Float32Array(count * 3);
  const libColors = new Float32Array(count * 3);
  const libSizes = new Float32Array(count);

  const shopPositions: number[] = [];
  const shopColors: number[] = [];
  const shopSizes: number[] = [];
  const shopDataList: Shop[] = [];

  // 贝塞尔曲线点数组（动态大小）
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const CURVE_SEGMENTS = 20; // 每条曲线的分段数，值越大曲线越平滑

  // 4. 填充数据
  libraries.forEach((lib, i) => {
    const shopId = lib.shop_id!;
    const color = getShopColor(shopId);

    // 获取已计算的位置，如果没有(理论上不应该)，则给个默认值
    const pos = libPosMap.get(lib.library_id) || { x: 0, y: 0, z: 0 };

    // Fill Lib Data
    libPositions[i * 3] = pos.x;
    libPositions[i * 3 + 1] = pos.y;
    libPositions[i * 3 + 2] = pos.z;

    libColors[i * 3] = color.r;
    libColors[i * 3 + 1] = color.g;
    libColors[i * 3 + 2] = color.b;

    const popularity = (lib.good_count || 0) + (lib.wardrobe_count || 0) * 2;
    libSizes[i] = Math.max(1.5, Math.min(6, Math.log(popularity + 1) * 1.5));

    // Fill Bezier Curve Data
    const startPoint = new THREE.Vector3(pos.x, pos.y, pos.z);

    // Target (Parent Lib or Shop Center)
    let targetPoint: THREE.Vector3;
    if (lib.parent_id && lib.parent_id !== 0 && libPosMap.has(lib.parent_id)) {
      // 连接到母图鉴
      const pPos = libPosMap.get(lib.parent_id)!;
      targetPoint = new THREE.Vector3(pPos.x, pPos.y, pPos.z);
    } else {
      // 连接到店铺中心
      const center = shopClusters.get(shopId) || { cx: 0, cy: 0, cz: 0 };
      targetPoint = new THREE.Vector3(center.cx, center.cy, center.cz);
    }

    // 创建二次贝塞尔曲线，控制点设置在起点和终点之间，稍微偏移以产生小弧度
    const midPoint = new THREE.Vector3().addVectors(startPoint, targetPoint).multiplyScalar(0.5);
    // 计算垂直于起点到终点方向的向量，用于控制弧度
    const direction = new THREE.Vector3().subVectors(targetPoint, startPoint);
    const perpendicular = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    // 如果垂直向量为零（方向与Y轴平行），使用另一个方向
    if (perpendicular.length() < 0.1) {
      perpendicular.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
    }
    // 控制点偏移距离，值越小弧度越小（这里设为距离的15%，产生小弧度）
    const curveHeight = direction.length() * 0.15;
    const controlPoint = midPoint.clone().add(perpendicular.multiplyScalar(curveHeight));

    // 创建贝塞尔曲线
    const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, targetPoint);

    // 获取曲线上的点
    const curvePoints = curve.getPoints(CURVE_SEGMENTS);

    // 将曲线点添加到数组（每两个相邻点形成一条线段）
    for (let j = 0; j < curvePoints.length - 1; j++) {
      const p1 = curvePoints[j];
      const p2 = curvePoints[j + 1];

      // 起点颜色（较亮）
      const startColorFactor = j === 0 ? 1.0 : 0.4 + (0.6 * (1 - j / curvePoints.length));
      linePositions.push(p1.x, p1.y, p1.z);
      lineColors.push(
        color.r * startColorFactor,
        color.g * startColorFactor,
        color.b * startColorFactor
      );

      // 终点颜色（较暗）
      const endColorFactor = j === curvePoints.length - 2 ? 0.4 : 0.4 + (0.6 * (1 - (j + 1) / curvePoints.length));
      linePositions.push(p2.x, p2.y, p2.z);
      lineColors.push(
        color.r * endColorFactor,
        color.g * endColorFactor,
        color.b * endColorFactor
      );
    }
  });

  // 5. 构建店铺点数据
  uniqueShopIdsArray.forEach((id) => {
    const center = shopClusters.get(id!)!;
    const color = getShopColor(id!);
    const shop = shopMap.get(id!);

    if (shop) {
      shopPositions.push(center.cx, center.cy, center.cz);
      shopColors.push(color.r, color.g, color.b);
      shopSizes.push(8.0);
      shopDataList.push(shop);
    }
  });

  // --- Render Library Points ---
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(libPositions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(libColors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(libSizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if(length(coord) > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0); 
      }
    `,
    transparent: true,
    vertexColors: true
  });

  const points = new THREE.Points(geometry, material);
  // 只存储 library_id 数组，节省内存
  const libraryIds = libraries.map(lib => lib.library_id);
  points.userData = { isPointCloud: true, libraryIds };
  scene.add(points);

  // --- Render Shop Points ---
  const shopGeometry = new THREE.BufferGeometry();
  shopGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shopPositions), 3));
  shopGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(shopColors), 3));
  shopGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(shopSizes), 1));

  const shopMaterial = material.clone();

  const shopPoints = new THREE.Points(shopGeometry, shopMaterial);
  shopPoints.userData = { isShopPoints: true, shops: shopDataList };
  scene.add(shopPoints);

  // --- Render Lines (Bezier Curves) ---
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lineColors), 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.userData = { isLines: true };
  scene.add(lines);

  // --- Focus Ring ---
  const focusRing = createFocusRing();
  scene.add(focusRing);
};

const initThree = () => {
  if (!container.value) return;

  const core = new ThreeCore({
    container: container.value,
    cameraPosition: { x: 0, y: 0, z: 200 },
    clearColor: 0x000000,
    alpha: false,
    enableStats: false, // 1. 去掉性能监控
    enableOrbitControls: true
  });

  core.camera.lookAt(0, 0, 0);

  threeCore.value = core;
  core.mount(container.value);
  core.startAnimationLoop();

  // Raycaster setup
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 1.5;
  const mouse = new THREE.Vector2();

  // 通用 Raycast 函数
  const performRaycast = (clientX: number, clientY: number) => {
    if (!core.camera) return null;
    const rect = container.value!.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, core.camera);

    const pointsObject = core.scene.children.find(child => (child as any).userData?.isPointCloud) as THREE.Points;
    const shopPointsObject = core.scene.children.find(child => (child as any).userData?.isShopPoints) as THREE.Points;

    // Check Shops
    if (shopPointsObject) {
      const intersections = raycaster.intersectObject(shopPointsObject);
      if (intersections.length > 0) {
        const index = intersections[0].index!;
        const shop = (shopPointsObject as any).userData.shops[index] as Shop;
        const pointPosition = new THREE.Vector3();
        pointPosition.fromBufferAttribute(shopPointsObject.geometry.attributes.position as THREE.BufferAttribute, index);
        return { type: 'shop', data: shop, position: pointPosition, index } as const;
      }
    }

    // Check Libraries
    if (pointsObject) {
      const intersections = raycaster.intersectObject(pointsObject);
      if (intersections.length > 0) {
        const index = intersections[0].index!;
        const libraryIds = (pointsObject as any).userData.libraryIds as number[];
        const libraryId = libraryIds[index];
        const pointPosition = new THREE.Vector3();
        pointPosition.fromBufferAttribute(pointsObject.geometry.attributes.position as THREE.BufferAttribute, index);
        return { type: 'library', libraryId, position: pointPosition, index } as const;
      }
    }
    return null;
  };

  const updateFocusRing = (clientX: number, clientY: number) => {
    const result = performRaycast(clientX, clientY);
    const focusRing = core.scene.children.find(child => (child as any).userData?.isFocusRing) as THREE.Mesh;

    if (result) {
      document.body.style.cursor = 'pointer';
      if (focusRing) {
        focusRing.visible = true;
        focusRing.position.copy(result.position);
        focusRing.lookAt(core.camera.position);
        focusRing.scale.set(result.type === 'shop' ? 3 : 1.5, result.type === 'shop' ? 3 : 1.5, 1);
      }
    } else {
      document.body.style.cursor = 'default';
      // 如果没有选中任何东西，且鼠标移开，我们只隐藏聚焦环
      // 信息框的显隐由 Click 控制
      if (focusRing) focusRing.visible = false;
    }
  }
  useHead({
    title: 'Lolita星系 - Lo研社',
  })
  // 移动检测相关变量
  let mouseHasMoved = false;
  let mouseDownX = 0;
  let mouseDownY = 0;
  const MOVE_THRESHOLD = 5; // 移动阈值（像素），超过这个距离认为移动了

  let touchHasMoved = false;
  let touchStartX = 0;
  let touchStartY = 0;

  const onMouseMove = (event: MouseEvent) => {
    updateFocusRing(event.clientX, event.clientY);
    // 检测是否移动
    if (mouseDownX !== 0 || mouseDownY !== 0) {
      const distance = Math.sqrt(
        (event.clientX - mouseDownX) ** 2 +
        (event.clientY - mouseDownY) ** 2
      );
      if (distance > MOVE_THRESHOLD) {
        mouseHasMoved = true;
      }
    }
  };

  // 触摸移动事件
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      updateFocusRing(touch.clientX, touch.clientY);
      // 检测是否移动
      if (touchStartX !== 0 || touchStartY !== 0) {
        const distance = Math.sqrt(
          (touch.clientX - touchStartX) ** 2 +
          (touch.clientY - touchStartY) ** 2
        );
        if (distance > MOVE_THRESHOLD) {
          touchHasMoved = true;
        }
      }
    }
  };

  const selectInfo = async (clientX: number, clientY: number) => {
    const result = performRaycast(clientX, clientY);
    if (result) {
      if (result.type === 'shop') {
        const shop = result.data as Shop;
        const shopId = shop.shop_id;

        // 如果点击的是同一个 shop，只更新位置，不重新加载
        if (selectedInfo.value.currentId === shopId && selectedInfo.value.type === 'shop') {
          selectedInfo.value.x = clientX + 15;
          selectedInfo.value.y = clientY + 15;
          return;
        }

        // Shop 数据直接从本地获取
        selectedInfo.value = {
          visible: true,
          x: clientX + 15,
          y: clientY + 15,
          data: shop,
          type: 'shop',
          loading: false,
          currentId: shopId
        };
      } else if (result.type === 'library') {
        const libraryId = result.libraryId;

        // 如果点击的是同一个 library，只更新位置，不重新加载
        if (selectedInfo.value.currentId === libraryId && selectedInfo.value.type === 'library' && selectedInfo.value.data) {
          selectedInfo.value.x = clientX + 15;
          selectedInfo.value.y = clientY + 15;
          return;
        }

        // Library 数据通过 API 获取
        selectedInfo.value = {
          visible: true,
          x: clientX + 15,
          y: clientY + 15,
          data: null,
          type: 'library',
          loading: true,
          currentId: libraryId
        };

        try {
          const library = await getLibraryById({ library_id: libraryId, attributes: ['library_id', 'cover', 'sale_time', 'good_count', 'collect_count', 'wardrobe_count', 'name'] });
          selectedInfo.value.data = library;
          selectedInfo.value.loading = false;
        } catch (error) {
          console.error('获取图鉴信息失败:', error);
          selectedInfo.value.loading = false;
          selectedInfo.value.visible = false;
          selectedInfo.value.currentId = undefined;
        }
      }
    } else {
      // 点击空白处，隐藏信息框
      selectedInfo.value.visible = false;
      selectedInfo.value.currentId = undefined;
    }
  }

  const onMouseDown = (event: MouseEvent) => {
    // 记录鼠标按下位置，重置移动标志
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    mouseHasMoved = false;
  }

  const onClick = async (event: MouseEvent) => {
    // 检查是否移动过，如果移动过则不弹窗
    if (!mouseHasMoved) {
      await selectInfo(event.clientX, event.clientY);
    }
    // 重置状态
    mouseDownX = 0;
    mouseDownY = 0;
    mouseHasMoved = false;
  }

  // 2. 双击聚焦（镜头拉近）
  const focusOnTarget = (clientX: number, clientY: number) => {
    const result = performRaycast(clientX, clientY);
    if (result && core) {
      // 移动相机到目标点附近
      const targetPos = result.position.clone();
      const currentPos = core.camera.position.clone();

      // 计算新的相机位置：保持当前方向，但推进距离（镜头拉近，从40改为25）
      const offset = new THREE.Vector3(0, 0, 25);
      // 如果当前相机在反面，就反向偏移
      if (currentPos.z < targetPos.z) offset.z = -25;

      const newCamPos = targetPos.clone().add(offset);

      core.lookAtCameraState({
        position: newCamPos,
        target: targetPos
      }, 1500); // 1.5s 动画
    }
  }

  const onDblClick = (event: MouseEvent) => {
    focusOnTarget(event.clientX, event.clientY);
  }

  // 手机端双击触摸支持
  let lastTouchTime = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let touchClickTimer: ReturnType<typeof setTimeout> | null = null;
  const TOUCH_DOUBLE_TAP_DELAY = 300; // 双击间隔时间（毫秒）
  const TOUCH_DOUBLE_TAP_DISTANCE = 50; // 双击允许的最大距离（像素）

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      // 记录触摸开始位置，重置移动标志
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchHasMoved = false;
    }
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) return; // 如果还有触摸点，不处理

    const touch = event.changedTouches[0];

    // 检查从触摸开始到结束是否移动了
    const moveDistance = Math.sqrt(
      (touch.clientX - touchStartX) ** 2 +
      (touch.clientY - touchStartY) ** 2
    );

    // 如果移动了，不触发弹窗，直接返回
    if (moveDistance > MOVE_THRESHOLD || touchHasMoved) {
      // 重置触摸状态
      touchStartX = 0;
      touchStartY = 0;
      touchHasMoved = false;
      return;
    }

    const currentTime = Date.now();
    const timeDiff = currentTime - lastTouchTime;
    const distance = Math.sqrt(
      (touch.clientX - lastTouchX) ** 2 +
      (touch.clientY - lastTouchY) ** 2
    );

    if (timeDiff < TOUCH_DOUBLE_TAP_DELAY && distance < TOUCH_DOUBLE_TAP_DISTANCE) {
      // 双击触摸 - 取消单次点击的延迟执行
      if (touchClickTimer) {
        clearTimeout(touchClickTimer);
        touchClickTimer = null;
      }
      event.preventDefault();
      // 双击时允许移动（因为双击本身就需要移动）
      focusOnTarget(touch.clientX, touch.clientY);
      lastTouchTime = 0; // 重置，避免三击
    } else {
      // 单次触摸 - 延迟执行，等待可能的双击
      lastTouchTime = currentTime;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      if (touchClickTimer) {
        clearTimeout(touchClickTimer);
      }
      touchClickTimer = setTimeout(async () => {
        // 再次检查是否移动过（防止在延迟期间移动）
        if (!touchHasMoved) {
          await selectInfo(touch.clientX, touch.clientY);
        }
        touchClickTimer = null;
      }, TOUCH_DOUBLE_TAP_DELAY);
    }

    // 重置触摸状态
    touchStartX = 0;
    touchStartY = 0;
    touchHasMoved = false;
  }

  container.value.addEventListener('mousedown', onMouseDown);
  container.value.addEventListener('mousemove', onMouseMove);
  container.value.addEventListener('mouseup', onClick);
  // container.value.addEventListener('click', onClick);
  container.value.addEventListener('dblclick', onDblClick);
  container.value.addEventListener('touchstart', onTouchStart, { passive: true });
  container.value.addEventListener('touchmove', onTouchMove, { passive: true });
  container.value.addEventListener('touchend', onTouchEnd, { passive: true });
};

// 分享功能
const handleShare = async () => {
  try {
    const { copyCurrentUrl } = useCopyCurrentUrl()
    const result = await copyCurrentUrl()
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '分享链接已复制到剪贴板',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message || '请手动复制链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  } catch (error) {
    console.error('复制链接失败:', error)
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

// 跳转详情页
const goToDetail = () => {
  if (!selectedInfo.value.data) return;
  const id = selectedInfo.value.type === 'shop'
    ? (selectedInfo.value.data as Shop).shop_id
    : (selectedInfo.value.data as Library).library_id;
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  if (selectedInfo.value.type === 'shop') {
    if (isInUniApp) {
      uni.navigateTo({
        url: `/pages/shop/shopDetail/shopDetail?id=${id}`,
      });
    } else {
      if (port.value) {
        port.value.postMessage(JSON.stringify({
          type: 'jump',
          path: 'ShopDetail',
          params: {
            id: id
          }
        }));
      } else {
        // router.push(`/shop/detail/${id}`);
        window.open(`/shop/detail/${id}`, '_blank');
      }
    }
  } else {
    if (isInUniApp) {
      uni.navigateTo({
        url: `/pages/library/libraryDetail/libraryDetail?id=${id}`,
      });
    } else {
      if (port.value) {
        port.value.postMessage(JSON.stringify({
          type: 'jump',
          path: 'LibraryDetail',
          params: {
            id: id
          }
        }));
      } else {
        // router.push(`/library/detail/${id}`);
        window.open(`/library/detail/${id}`, '_blank');
      }
    }
  }
};

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  checkIsMobile();
  if (import.meta.client) {
    window.addEventListener('resize', checkIsMobile);
  }

  await fetchData();
  initThree();
  createPointCloud();
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', checkIsMobile);
  }
});

onBeforeUnmount(() => {
  if (threeCore.value) {
    threeCore.value.dispose();
  }
});
</script>

<template>
  <div class="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-serif">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div
        class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.02]">
      </div>
      <div
        class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-blob">
      </div>
      <div
        class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-blob animation-delay-2000">
      </div>
      <div
        class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-pink-500/10 to-purple-500/10 rounded-full blur-3xl animate-blob animation-delay-4000">
      </div>
    </div>

    <div ref="container" class="w-full h-full relative z-10"></div>

    <!-- Loading Overlay -->
    <div v-if="loading"
      class="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-sm z-50">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-purple-100/20 rounded-full"></div>
        <div
          class="absolute top-0 left-0 w-16 h-16 border-4 border-purple-400 rounded-full border-t-transparent animate-spin">
        </div>
      </div>
      <p class="mt-4 text-purple-400 tracking-widest text-sm uppercase">加载星系中...</p>
    </div>

    <!-- UI Overlay -->
    <div class="absolute top-6 left-6 z-40 pointer-events-none">
      <div class="inline-block relative">
        <h1
          class="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-qhx-bg-card to-qhx-primaryHover bg-clip-text text-transparent tracking-tight">
          Lo研社
        </h1>
        <span class="absolute -top-2 -right-4 text-xl animate-bounce">✨</span>
      </div>
      <p class="text-gray-400 text-sm mt-1">{{ libraryList.length }} 图鉴 | {{ shopMap.size }} 店铺</p>
    </div>

    <!-- 分享按钮 -->
    <div class="absolute top-6 right-6 z-40 pointer-events-auto">
      <button
          @click="handleShare"
          class="bg-qhx-bg-card backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 transition-colors"
        >
          <span class="text-xl">🔗</span>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">分享</span>
        </button>
    </div>

    <!-- Info Card (Based on selectedInfo) -->
    <!-- 手机端：从底部弹出的抽屉 -->


    <!-- PC端：原有样式 -->
    <div v-if="selectedInfo.visible && !isMobile"
      class="fixed z-50 bg-qhx-bg-card backdrop-blur-md rounded-[2rem] p-6 shadow-2xl border border-white/50 dark:border-gray-700 w-80 transform transition-all duration-300 hover:scale-[1.02]"
      :style="{ left: `${selectedInfo.x}px`, top: `${selectedInfo.y}px` }">
      <!-- Loading State -->
      <div v-if="selectedInfo.loading" class="flex flex-col items-center justify-center py-8">
        <div class="relative">
          <div class="w-12 h-12 border-4 border-purple-100/20 rounded-full"></div>
          <div
            class="absolute top-0 left-0 w-12 h-12 border-4 border-purple-400 rounded-full border-t-transparent animate-spin">
          </div>
        </div>
        <p class="mt-4 text-purple-400 text-sm">加载中...</p>
      </div>

      <!-- Shop Info -->
      <div v-if="!selectedInfo.loading && selectedInfo.data && selectedInfo.type === 'shop'"
        class="flex items-center gap-4 mb-4">
        <div
          class="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full overflow-hidden flex items-center justify-center border-2 border-purple-300 dark:border-purple-600 shadow-lg">
          <img v-if="(selectedInfo.data as Shop).shop_logo" :src="BASE_IMG + (selectedInfo.data as Shop).shop_logo"
            class="w-full h-full object-cover" alt="logo" />
          <span v-else class="text-xs text-gray-500">🛍️</span>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-base text-qhx-primary hover:text-qhx-primaryHover truncate">
            {{ (selectedInfo.data as Shop).shop_name }}
          </h3>
        </div>
      </div>

      <!-- Library Info -->
      <div v-else-if="!selectedInfo.loading && selectedInfo.data" class="flex items-start gap-4 mb-4">
        <div
          class="w-[60px] h-[60px] flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl overflow-hidden shadow-lg border border-purple-200/50 dark:border-purple-700/50">
          <img v-if="(selectedInfo.data as Library).cover" :src="BASE_IMG + (selectedInfo.data as Library).cover"
            class="w-full h-full object-cover" alt="cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-2xl">📚</div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-xs text-qhx-primary hover:text-qhx-primaryHover truncate mb-2">
            {{ (selectedInfo.data as Library).name }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
            {{ shopMap.get((selectedInfo.data as Library).shop_id!)?.shop_name || '未知店铺' }}
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span class="opacity-70">初售:</span>
              <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as
                Library).sale_time?.split(' ')[0] || '暂无' }}</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <span class="opacity-70">点赞数:</span>
              <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as Library).good_count ||
                0 }}</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <span class="opacity-70">收藏数:</span>
              <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as Library).collect_count ||
                0 }}</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <span class="opacity-70">衣柜数:</span>
              <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as Library).wardrobe_count ||
                0 }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Action Button -->
      <div v-if="!selectedInfo.loading && selectedInfo.data"
        class="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-700">
        <button @click.stop="goToDetail"
          class="px-6 py-2 bg-qhx-primary hover:bg-qhx-primaryHover text-white text-sm rounded-full font-medium transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105">
          查看详情
        </button>
      </div>
    </div>

    <Transition name="drawer">
      <div v-if="selectedInfo.visible && isMobile" class="fixed inset-0 z-50 flex items-end pointer-events-none">
        <!-- 背景遮罩 -->
        <!-- <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div> -->

        <!-- 抽屉内容 -->
        <div
          class="relative w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-t-[2rem] p-6 shadow-2xl border-t border-white/50 dark:border-gray-700 max-w-md mx-auto pointer-events-auto">
          <!-- 抽屉拖拽指示器 -->
          <div class="flex justify-center mb-4">
            <div class="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>

          <!-- 关闭按钮 -->
          <button @click.stop="selectedInfo.visible = false"
            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400">
            <span class="text-xl">✕</span>
          </button>

          <!-- Loading State -->
          <div v-if="selectedInfo.loading" class="flex flex-col items-center justify-center py-8">
            <div class="relative">
              <div class="w-12 h-12 border-4 border-purple-100/20 rounded-full"></div>
              <div
                class="absolute top-0 left-0 w-12 h-12 border-4 border-purple-400 rounded-full border-t-transparent animate-spin">
              </div>
            </div>
            <p class="mt-4 text-purple-400 text-sm">加载中...</p>
          </div>

          <!-- Shop Info -->
          <div v-if="!selectedInfo.loading && selectedInfo.data && selectedInfo.type === 'shop'"
            class="flex items-center gap-4 mb-4">
            <div
              class="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full overflow-hidden flex items-center justify-center border-2 border-purple-300 dark:border-purple-600 shadow-lg">
              <img v-if="(selectedInfo.data as Shop).shop_logo" :src="BASE_IMG + (selectedInfo.data as Shop).shop_logo"
                class="w-full h-full object-cover" alt="logo" />
              <span v-else class="text-xs text-gray-500">🛍️</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-base text-qhx-primary hover:text-qhx-primaryHover truncate">
                {{ (selectedInfo.data as Shop).shop_name }}
              </h3>
            </div>
          </div>

          <!-- Library Info -->
          <div v-else-if="!selectedInfo.loading && selectedInfo.data" class="flex items-start gap-4 mb-4">
            <div
              class="w-[60px] h-[60px] flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl overflow-hidden shadow-lg border border-purple-200/50 dark:border-purple-700/50">
              <img v-if="(selectedInfo.data as Library).cover" :src="BASE_IMG + (selectedInfo.data as Library).cover"
                class="w-full h-full object-cover" alt="cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-2xl">📚</div>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-xs text-qhx-primary hover:text-qhx-primaryHover truncate mb-2">
                {{ (selectedInfo.data as Library).name }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                {{ shopMap.get((selectedInfo.data as Library).shop_id!)?.shop_name || '未知店铺' }}
              </p>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span class="opacity-70">初售:</span>
                  <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as
                    Library).sale_time?.split(' ')[0] || '暂无' }}</span>
                </div>
                <div class="flex items-center gap-1.5 px-2 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <span class="opacity-70">点赞数:</span>
                  <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as Library).good_count ||
                    0 }}</span>
                </div>
                <div class="flex items-center gap-1.5 px-2 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <span class="opacity-70">收藏数:</span>
                  <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as Library).collect_count ||
                    0 }}</span>
                </div>
                <div class="flex items-center gap-1.5 px-2 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <span class="opacity-70">衣柜数:</span>
                  <span class="text-gray-700 dark:text-gray-300">{{ (selectedInfo.data as Library).wardrobe_count ||
                    0 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <div v-if="!selectedInfo.loading && selectedInfo.data"
            class="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-700">
            <button @click.stop="goToDetail"
              class="px-6 py-2 bg-qhx-primary hover:bg-qhx-primaryHover text-white text-sm rounded-full font-medium transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105">
              查看详情
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <!-- Footer Controls -->
    <div class="absolute bottom-6 left-6 z-40 pointer-events-none select-none">
      <div
        class="bg-qhx-bg-card backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/50 dark:border-gray-700">
        <div class="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span>左键点击选择信息</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
            <span>双击聚焦</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span>左键拖拽旋转</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span>滚轮缩放</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 0px;
}

@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }

  33% {
    transform: translate(30px, -50px) scale(1.1);
  }

  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }

  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

/* 抽屉动画 */
.drawer-enter-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-active>div:last-child {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-leave-active>div:last-child {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-from>div:last-child {
  transform: translateY(100%);
}

.drawer-leave-to>div:last-child {
  transform: translateY(100%);
}

.drawer-enter-to>div:last-child,
.drawer-leave-from>div:last-child {
  transform: translateY(0);
}
</style>