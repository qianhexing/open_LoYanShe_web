/** XZ 平面轴对齐包围盒 */
export interface AABB2D {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** 将中心 + 尺寸 + Y 轴旋转转换为 XZ 平面 AABB */
export function createRotatedAABB(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  rotation = 0
): AABB2D {
  const hw = width / 2
  const hd = depth / 2
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd]
  ].map(([x, z]) => ({
    x: cx + x * cos - z * sin,
    z: cz + x * sin + z * cos
  }))

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  for (const c of corners) {
    minX = Math.min(minX, c.x)
    maxX = Math.max(maxX, c.x)
    minZ = Math.min(minZ, c.z)
    maxZ = Math.max(maxZ, c.z)
  }
  return { minX, maxX, minZ, maxZ }
}

/** 地图边界碰撞体（内缩 playerRadius 防止越界） */
export function createMapBoundaryAABB(
  width: number,
  depth: number,
  margin: number
): AABB2D {
  return {
    minX: -width / 2 + margin,
    maxX: width / 2 - margin,
    minZ: -depth / 2 + margin,
    maxZ: depth / 2 - margin
  }
}

/** 圆与 AABB 是否相交（用于碰撞检测） */
export function circleIntersectsAABB(
  px: number,
  pz: number,
  radius: number,
  box: AABB2D
): boolean {
  const cx = Math.max(box.minX, Math.min(px, box.maxX))
  const cz = Math.max(box.minZ, Math.min(pz, box.maxZ))
  const dx = px - cx
  const dz = pz - cz
  return dx * dx + dz * dz < radius * radius - 1e-8
}

/** 圆是否在地图边界内（边界为可活动区域，越界则 false） */
export function circleInsideBoundary(
  px: number,
  pz: number,
  radius: number,
  boundary: AABB2D
): boolean {
  return (
    px - radius >= boundary.minX
    && px + radius <= boundary.maxX
    && pz - radius >= boundary.minZ
    && pz + radius <= boundary.maxZ
  )
}

/** 将圆推出 AABB 重叠区域 */
export function resolveCircleAABB(
  px: number,
  pz: number,
  radius: number,
  box: AABB2D
): [number, number] {
  const cx = Math.max(box.minX, Math.min(px, box.maxX))
  const cz = Math.max(box.minZ, Math.min(pz, box.maxZ))
  const dx = px - cx
  const dz = pz - cz
  const distSq = dx * dx + dz * dz

  if (distSq >= radius * radius) return [px, pz]

  if (distSq < 1e-10) {
    const distLeft = px - box.minX
    const distRight = box.maxX - px
    const distTop = pz - box.minZ
    const distBottom = box.maxZ - pz
    const minDist = Math.min(distLeft, distRight, distTop, distBottom)
    if (minDist === distLeft) return [box.minX - radius, pz]
    if (minDist === distRight) return [box.maxX + radius, pz]
    if (minDist === distTop) return [px, box.minZ - radius]
    return [px, box.maxZ + radius]
  }

  const dist = Math.sqrt(distSq)
  const overlap = radius - dist
  return [px + (dx / dist) * overlap, pz + (dz / dist) * overlap]
}

/**
 * 尝试移动圆形碰撞体，分轴检测并修正
 * colliders 为障碍物 AABB；boundary 为可活动区域（圆心+半径不可超出）
 */
export function tryMoveCircle(
  px: number,
  pz: number,
  dx: number,
  dz: number,
  radius: number,
  colliders: AABB2D[],
  boundary: AABB2D
): [number, number] {
  let nx = px + dx
  let nz = pz + dz

  // 分轴滑动：先 X 后 Z
  for (const box of colliders) {
    if (circleIntersectsAABB(nx, pz, radius, box)) {
      ;[nx] = resolveCircleAABB(nx, pz, radius, box)
    }
  }
  for (const box of colliders) {
    if (circleIntersectsAABB(nx, nz, radius, box)) {
      ;[, nz] = resolveCircleAABB(nx, nz, radius, box)
    }
  }

  // 地图边界限制
  nx = Math.max(boundary.minX + radius, Math.min(boundary.maxX - radius, nx))
  nz = Math.max(boundary.minZ + radius, Math.min(boundary.maxZ - radius, nz))

  return [nx, nz]
}
