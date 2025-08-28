// StyledTransformControls.ts
import * as THREE from 'three';
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoTheme = {
  x: number;
  y: number;
  z: number;
  hover: number;
  translateOpacity: number;
  rotateOpacity: number;
  scaleOpacity: number;
  thickness: number; // 粗细系数：整体几何的“胖瘦”
};

export const DefaultTheme: GizmoTheme = {
  x: 0xff5151,
  y: 0x56e36f,
  z: 0x4aa3ff,
  hover: 0xffff66,
  translateOpacity: 1.0,
  rotateOpacity: 0.9,
  scaleOpacity: 1.0,
  thickness: 1.0,
};

/**
 * 用等比例缩放替换 TransformControls 的缩放行为：
 * - 在 scale 模式下，拖任何轴/平面，都按统一比例缩放
 * - 可选：仅保留中心“XYZ”缩放手柄，隐藏 SX/SY/SZ（三轴非等比）
 */
export function installUniformScale(
  controls: TransformControls,
  opts: { onlyCenterHandle?: boolean } = {}
) {
  let start = new THREE.Vector3();
  let active = false;

  const makeUniform = () => {
    if (!active) return;
    const obj = (controls as any).object as THREE.Object3D | undefined;
    if (!obj) return;

    // 当前比例 / 初始比例
    const s = obj.scale;
    const fx = s.x / start.x;
    const fy = s.y / start.y;
    const fz = s.z / start.z;

    // 取变化幅度最大的那个作为统一比例（手感最好）
    let k = Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fz));
    // 防止负值或 0（倒置/崩塌）
    k = Math.max(k, 1e-4);

    s.set(start.x * k, start.y * k, start.z * k);
  };

  controls.addEventListener('mouseDown', () => {
    if (controls.getMode() === 'scale' && (controls as any).object) {
      start.copy((controls as any).object.scale);
      active = true;
    }
  });

  controls.addEventListener('change', () => {
    if (controls.getMode() === 'scale' && (controls as any).dragging) {
      makeUniform();
    }
  });

  controls.addEventListener('mouseUp', () => {
    active = false;
  });

  // 只保留中心“XYZ”手柄（可选）
  if (opts.onlyCenterHandle) {
    try {
      const gizmoRoot = getGizmoRoot(controls);
      const vis = getVisibleGizmoGroups(gizmoRoot);
      // 隐藏单轴/平面缩放，只留中心 XYZ（等比例）
      // biome-ignore lint/complexity/noForEach: <explanation>
            ['X', 'Y', 'Z', 'XY', 'YZ', 'XZ'].forEach((name) => {
        const o = vis.scale?.getObjectByName(name);
        if (o) {
          o.visible = false;
          o.layers.disableAll?.();
        }
      });
      const center = vis.scale?.getObjectByName('XYZ');
      if (center) center.visible = true;
    } catch {
      /* 忽略：不同版本结构差异时不影响功能 */
    }
  }
}

/**
 * 美化/重绘 gizmo 的外观（在不破坏交互的前提下）
 * - 统一替换颜色与材质
 * - 加粗(厚度)与透明度
 * - 尽量不动“picker”层（不可见拾取对象），以保证射线拾取/交互稳定
 */
export function restyleGizmo(controls: TransformControls, theme: Partial<GizmoTheme> = {}) {
  const t = { ...DefaultTheme, ...theme };

  const gizmoRoot = getGizmoRoot(controls);
  const vis = getVisibleGizmoGroups(gizmoRoot);

  // 通用材质工厂（不同模式不同透明度）
  const makeMat = (hex: number, opacity = 1) =>
    new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity, depthTest: false });

  // —— 平移 gizmo：加粗箭头（保留原有布局/朝向）——
  if (vis.translate) {
    recolorAndThicken(vis.translate, {
      X: { mat: makeMat(t.x, t.translateOpacity), scale: t.thickness },
      Y: { mat: makeMat(t.y, t.translateOpacity), scale: t.thickness },
      Z: { mat: makeMat(t.z, t.translateOpacity), scale: t.thickness },
      XY: { mat: makeMat(t.x, 0.2) },
      YZ: { mat: makeMat(t.y, 0.2) },
      XZ: { mat: makeMat(t.z, 0.2) },
      XYZ: { mat: makeMat(0xffffff, 0.15) },
    });
  }

  // —— 旋转 gizmo：加粗圆环（改变 torus 半径/管径可能由内部控制，尽量用 scale）——
  if (vis.rotate) {
    recolorAndThicken(vis.rotate, {
      RX: { mat: makeMat(t.x, t.rotateOpacity), scale: t.thickness },
      RY: { mat: makeMat(t.y, t.rotateOpacity), scale: t.thickness },
      RZ: { mat: makeMat(t.z, t.rotateOpacity), scale: t.thickness },
      E: { mat: makeMat(0xffffff, 0.25), scale: t.thickness * 0.9 }, // 屏幕对齐的自由旋转环
    });
  }

  // —— 缩放 gizmo：把末端小方块/杆加粗、统一风格 —— 
  if (vis.scale) {
    recolorAndThicken(vis.scale, {
      X: { mat: makeMat(t.x, t.scaleOpacity), scale: t.thickness },
      Y: { mat: makeMat(t.y, t.scaleOpacity), scale: t.thickness },
      Z: { mat: makeMat(t.z, t.scaleOpacity), scale: t.thickness },
      XYZ: { mat: makeMat(0xffffff, 0.2), scale: t.thickness * 1.05 }, // 中心等比手柄
    });
  }

  // —— 悬停高亮（覆写默认材质即可）——
  controls.addEventListener('change', () => {
    try {
      const axis: string | null = (controls as any).axis || null;
      if (!axis) return;
      const all = [vis.translate, vis.rotate, vis.scale].filter(Boolean) as THREE.Object3D[];
      for (const g of all) {
        g.traverse((obj) => {
          const m = (obj as THREE.Mesh).material as THREE.Material | undefined;
          if (!m || !(m as any).color) return;
          const name = obj.name || '';
          const isHot = name === axis || name === `R${axis}`; // 兼容 RX/RY/RZ
          ((m as any).color as THREE.Color).setHex(isHot ? t.hover : (m as any).__baseColor ?? (m as any).color?.getHex());
        });
      }
    } catch {
      /* 忽略 */
    }
  });
}

/* -------------------- 内部小工具（尽量兼容不同版本） -------------------- */

function getGizmoRoot(controls: TransformControls): any {
  // 常见私有字段：_gizmo 或 gizmo；否则从 children 找
  const anyCtl = controls as any;
  const root =
    anyCtl._gizmo ||
    anyCtl.gizmo ||
    controls.children.find((c: any) => c?.isTransformControlsGizmo || c?.type === 'TransformControlsGizmo');
  if (!root) throw new Error('Cannot locate TransformControls gizmo root');
  return root;
}

function getVisibleGizmoGroups(gizmoRoot: any): {
  translate?: THREE.Object3D;
  rotate?: THREE.Object3D;
  scale?: THREE.Object3D;
} {
  // 不同版本里，gizmoRoot.gizmo?.translate / rotate / scale 最常见
  const groups =
    gizmoRoot.gizmo ||
    {
      translate: gizmoRoot.getObjectByName?.('translate') ?? undefined,
      rotate: gizmoRoot.getObjectByName?.('rotate') ?? undefined,
      scale: gizmoRoot.getObjectByName?.('scale') ?? undefined,
    };

  return {
    translate: groups.translate,
    rotate: groups.rotate,
    scale: groups.scale,
  };
}

function recolorAndThicken(
  group: THREE.Object3D,
  map: Record<
    string,
    { mat?: THREE.Material; scale?: number }
  >
) {
  // 按名称（X/Y/Z/XY/XZ/YZ/XYZ/RX/RY/RZ/E）找到可见手柄并替换材质 & 加粗
  group.traverse((obj: THREE.Object3D) => {
    const cfg = map[obj.name];
    if (!cfg) return;

    if ((obj as any).material && cfg.mat) {
      const mat = cfg.mat.clone();
      // 记录基础色，供 hover 恢复
      (mat as any).__baseColor = (mat as any).color?.getHex?.();
      (obj as any).material = mat;
    }
    if (cfg.scale && cfg.scale !== 1) {
      obj.scale.multiplyScalar(cfg.scale);
    }
  });
}

/* -------------------- 典型用法 --------------------

import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { installUniformScale, restyleGizmo, DefaultTheme } from './StyledTransformControls';

const controls = new TransformControls(camera, renderer.domElement);
scene.add(controls);

// 1) 保留完整功能但“换皮”
restyleGizmo(controls, {
  x: 0xff3b30,
  y: 0x34c759,
  z: 0x0a84ff,
  thickness: 1.25,      // 粗一点
  rotateOpacity: 0.8,
});

// 2) 强制缩放为等比例；并可选只留中心手柄
installUniformScale(controls, { onlyCenterHandle: true });

// 其余全按原生 API 用：setMode / setSpace / setSize / attach / detach 等
controls.setMode('translate'); // 'rotate' | 'scale'
controls.setSpace('local');    // or 'world'
controls.setSize(1.0);

--------------------------------------------------- */
