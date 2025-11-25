import * as THREE from 'three';

type GridOptions = {
  cellSize?: number;        // 次网格尺寸（世界单位）
  majorEvery?: number;      // 主网格间隔（每 N 个次网格一条）
  minorColor?: string;
  majorColor?: string;
  axisColor?: string;
  minorThickness?: number;  // 线宽（像素）
  majorThickness?: number;
  axisThickness?: number;
  fadeStart?: number;       // 相机水平距离开始淡出
  fadeEnd?: number;         // 相机水平距离完全透明
  opacity?: number;         // 全局不透明度（0-1）
};

export function createGrid(opts: GridOptions = {}) {
  const {
    cellSize = 1,
    majorEvery = 5,
    minorColor = '#cfd3dc',
    majorColor = '#aab0bd',
    axisColor  = '#4c84ff',
    minorThickness = 1.0,
    majorThickness = 1.8,
    axisThickness  = 2.2,
    fadeStart = 25.0,
    fadeEnd   = 120.0,
    opacity   = 1.0,
  } = opts;

  // 用一个“单位全屏四边形” + 自定义着色器，做无限网格
  // 这里用很大的 Plane 也可以；全屏四边形通常需要自定义顶点写 NDC。
  // 为了简单，这里用“大平面”+ 仅靠着色器计算网格。
  const SIZE = 1e6; // 足够大即可（渲染成本由像素决定，基本不受几何大小影响）
  const geom = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
  geom.rotateX(-Math.PI / 2); // 平铺到 XZ 平面

  const uniforms = {
    uMinor:         { value: cellSize },
    uMajorEvery:    { value: majorEvery },
    uMinorColor:    { value: new THREE.Color(minorColor) },
    uMajorColor:    { value: new THREE.Color(majorColor) },
    uAxisColor:     { value: new THREE.Color(axisColor) },
    uMinorPx:       { value: minorThickness },
    uMajorPx:       { value: majorThickness },
    uAxisPx:        { value: axisThickness },
    uOpacity:       { value: opacity },
    uFadeStart:     { value: fadeStart },
    uFadeEnd:       { value: fadeEnd },
    uCamXZ:         { value: new THREE.Vector2(0, 0) }, // 相机水平位置
  };

  const vert = /* glsl */`
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  // 屏幕空间抗锯齿网格线：
  // 思路：将世界坐标 / spacing 得到网格坐标，用 fwidth 做 1px 抗锯齿，然后通过 thicknessPx 控制像素线宽
  const frag = /* glsl */`
    precision highp float;

    varying vec3 vWorldPos;

    uniform float uMinor;          // 次网格间距
    uniform float uMajorEvery;     // 每 N 个次网格为主网格
    uniform vec3  uMinorColor;
    uniform vec3  uMajorColor;
    uniform vec3  uAxisColor;
    uniform float uMinorPx;        // 次网格线宽（px）
    uniform float uMajorPx;        // 主网格线宽（px）
    uniform float uAxisPx;         // 坐标轴线宽（px）
    uniform float uOpacity;
    uniform float uFadeStart;
    uniform float uFadeEnd;
    uniform vec2  uCamXZ;

    // 返回 0..1 的线覆盖率；thicknessPx 为像素宽度
    float gridLine(vec2 worldXZ, float spacing, float thicknessPx){
      vec2 coord = worldXZ / spacing;            // 网格坐标
      vec2 deriv = fwidth(coord);                // 屏幕导数 ~ 像素大小
      vec2 d = abs(fract(coord - 0.5) - 0.5);    // 到最近网格线的距离（0..0.5）
      // 将线宽体现在阈值里：deriv * (thicknessPx)
      vec2 w = deriv * thicknessPx * 0.5;
      vec2 a = smoothstep(w, vec2(0.0), d);      // a 越大表示越靠近线
      return max(a.x, a.y);                      // 返回线的透明度，修正原来的反向计算
    }

    // 坐标轴（x=0 或 z=0）加粗，高优先级覆盖
    float axisLine(vec2 worldXZ, float thicknessPx){
      // 使用世界坐标直接做 0 线，仍然用 fwidth 保证屏幕一致线宽
      float w = thicknessPx * 0.5;
      float ax = smoothstep(fwidth(worldXZ.x) * w, 0.0, abs(worldXZ.x));
      float az = smoothstep(fwidth(worldXZ.y) * w, 0.0, abs(worldXZ.y));
      return max(ax, az);
    }

    void main(){
      vec2 p = vWorldPos.xz;

      // 主/次网格
      float majorSpacing = uMinor * max(uMajorEvery, 1.0);

      float majorMask = gridLine(p, majorSpacing, uMajorPx);
      float minorMask = gridLine(p, uMinor,       uMinorPx);

      // 坐标轴覆盖在所有线上
      float axisMask = axisLine(p, uAxisPx);

      // 颜色合成（轴 > 主 > 次）
      vec3 col = vec3(0.0);
      float alpha = 0.0;

      // 次网格（只在没有主网格和坐标轴的地方显示）
      float minorContrib = minorMask * (1.0 - majorMask) * (1.0 - axisMask);
      col   = mix(col, uMinorColor, minorContrib);
      alpha = max(alpha, minorContrib);

      // 主网格（只在没有坐标轴的地方显示）
      float majorContrib = majorMask * (1.0 - axisMask);
      col   = mix(col, uMajorColor, majorContrib);
      alpha = max(alpha, majorContrib);

      // 坐标轴（最高优先级）
      col   = mix(col, uAxisColor, axisMask);
      alpha = max(alpha, axisMask);

      // 根据与相机的水平距离淡出（更接近酷家乐那种近清远淡）
      float camDist = length(p - uCamXZ);
      float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
      alpha *= fade * uOpacity;

      if(alpha < 1.0/255.0) discard;

      gl_FragColor = vec4(col, alpha);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,    // 不写深度，像地面覆盖在最底层
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'Grid';
  mesh.renderOrder = -9999; // 尽量早画，避免被半透明物体挡住
  mesh.userData.__gridUniforms = uniforms;
  mesh.userData.ignorePick = true;

  return mesh;
}

// 在渲染循环中调用以更新相机位置（用于淡出）
export function updateGrid(grid: THREE.Object3D, camera: THREE.Camera) {
  const u = (grid as any).userData.__gridUniforms;
  if (!u) return;

  // 取相机在世界坐标的 XZ
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  u.uCamXZ.value.set(camPos.x, camPos.z);
}
