import * as THREE from 'three'
import { getLolitaHeatColorByRank } from '@/utils/lolitaHeatGradient'

export const GLOBE_RADIUS = 80
export const GLOBE_BG = 0x0a0614
/** 陆地相对海洋球的轻微抬升（真正防下陷靠球面细分） */
export const GLOBE_SURFACE_LIFT = 0.12
/** 球面细分最大边长（弧度）；越大越省面，越小越贴球 */
export const GLOBE_MAX_EDGE_RAD = (2.2 * Math.PI) / 180
/** 标记重建版本号（变更后强制重建地球） */
export const GLOBE_BUILD_VERSION = 'arc-v5'

export interface GlobeGeoFeature {
  type: string
  properties: {
    name: string
    center?: [number, number]
    centroid?: [number, number]
  }
  geometry: {
    type: string
    coordinates: number[][][] | number[][][][]
  }
}

export interface GlobeGeoJSON {
  type: string
  features: GlobeGeoFeature[]
}

export interface GlobeDataItem {
  count: number
  rank: number
}

export interface GlobeBarSource {
  name: string
  count: number
}

export interface GlobeTeaParty {
  tea_id?: number
  tea_cover: string
  tea_title: string
  longitude: number
  latitude: number
  start_time: number
  end_time: number
}

export interface GlobeShopMarker {
  longitude: number
  latitude: number
  shops: unknown[]
  label?: string
}

const CHINA_NAME_HINTS = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏',
  '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西',
  '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏',
  '新疆', '台湾', '香港', '澳门', '中国',
]

/** 经纬度 → 球面坐标（Y 轴朝上） */
export function lngLatToVector3(
  lng: number,
  lat: number,
  radius = GLOBE_RADIUS
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

/** 单位方向向量 → 经纬度 */
export function vector3ToLngLat(v: THREE.Vector3): [number, number] {
  const n = v.clone().normalize()
  const phi = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1))
  const lat = 90 - (phi * 180) / Math.PI
  const theta = Math.atan2(n.z, -n.x)
  let lng = (theta * 180) / Math.PI - 180
  if (lng > 180) lng -= 360
  if (lng < -180) lng += 360
  return [lng, lat]
}

/** 两点球面中心角（弧度） */
export function angularDistanceRad(
  a: [number, number],
  b: [number, number]
): number {
  const va = lngLatToVector3(a[0], a[1], 1)
  const vb = lngLatToVector3(b[0], b[1], 1)
  return Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1))
}

/** 大圆弧中点（测地线中点） */
export function geodesicMidpoint(
  a: [number, number],
  b: [number, number]
): [number, number] {
  const va = lngLatToVector3(a[0], a[1], 1)
  const vb = lngLatToVector3(b[0], b[1], 1)
  return vector3ToLngLat(va.add(vb))
}

/**
 * 平面弦相对球面的矢高（下陷深度）。
 * footprintR：贴地点到边缘的平面半宽。
 */
export function sphereSagitta(radius: number, footprintR: number): number {
  const r = Math.min(Math.abs(footprintR), radius * 0.999)
  return radius - Math.sqrt(Math.max(radius * radius - r * r, 0))
}

/** 标记底座半径 = 陆地表面 + 按底面半径计算的弧矢高 + 间隙 */
export function markerBaseRadius(
  footprintR: number,
  surfaceRadius = GLOBE_RADIUS + GLOBE_SURFACE_LIFT
): number {
  return surfaceRadius + sphereSagitta(surfaceRadius, footprintR) + 0.2
}

/** 让物体局部 +Y 朝向球心外法线 */
export function orientOutward(object: THREE.Object3D, position: THREE.Vector3) {
  const normal = position.clone().normalize()
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
}

export function getCameraLookingAtLngLat(
  lng: number,
  lat: number,
  distance: number,
  radius = GLOBE_RADIUS
) {
  const target = lngLatToVector3(lng, lat, radius)
  const dir = target.clone().normalize()
  const position = dir.multiplyScalar(distance)
  return {
    position,
    target: new THREE.Vector3(0, 0, 0),
  }
}

function isLikelyChinaFeature(name: string): boolean {
  return CHINA_NAME_HINTS.some((hint) => name.includes(hint))
}

function matchDataItem(
  provinceName: string,
  dataMap: Map<string, GlobeDataItem>
): GlobeDataItem | undefined {
  const direct = dataMap.get(provinceName)
  if (direct) return direct

  const isInnerMongolia =
    provinceName === '内蒙古自治区' || provinceName.includes('内蒙古')
  const isMongolia = provinceName === '蒙古' && !provinceName.includes('内')

  for (const [key, value] of dataMap.entries()) {
    if (isInnerMongolia) {
      if (key.includes('内蒙古')) return value
    } else if (isMongolia) {
      if (
        (key === '蒙古' ||
          key.replace(/省|市|自治区|特别行政区$/, '') === '蒙古') &&
        !key.includes('内')
      ) {
        return value
      }
    } else if (provinceName.includes(key) || key.includes(provinceName)) {
      return value
    }
  }
  return undefined
}

function getFeatureCenter(feature: GlobeGeoFeature): [number, number] | null {
  if (feature.properties.centroid) return feature.properties.centroid
  if (feature.properties.center) return feature.properties.center

  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let yMin = Number.POSITIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY

  const updateBounds = (ring: number[][]) => {
    for (const pt of ring) {
      if (pt[0] < xMin) xMin = pt[0]
      if (pt[0] > xMax) xMax = pt[0]
      if (pt[1] < yMin) yMin = pt[1]
      if (pt[1] > yMax) yMax = pt[1]
    }
  }

  const { type, coordinates } = feature.geometry
  if (type === 'Polygon') {
    for (const ring of coordinates as number[][][]) {
      updateBounds(ring)
    }
  } else if (type === 'MultiPolygon') {
    for (const polygon of coordinates as number[][][][]) {
      for (const ring of polygon) {
        updateBounds(ring)
      }
    }
  }

  if (xMin === Number.POSITIVE_INFINITY) return null
  return [(xMin + xMax) / 2, (yMin + yMax) / 2]
}

function sampleRing(ring: number[][], maxPoints = 120): number[][] {
  if (ring.length <= maxPoints) return ring
  const step = Math.ceil(ring.length / maxPoints)
  const sampled: number[][] = []
  for (let i = 0; i < ring.length; i += step) {
    sampled.push(ring[i])
  }
  const first = ring[0]
  const last = sampled[sampled.length - 1]
  if (last[0] !== first[0] || last[1] !== first[1]) {
    sampled.push(first)
  }
  return sampled
}

function createAtmosphere(radius: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius * 1.12, 64, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
        gl_FragColor = vec4(0.55, 0.28, 0.85, 1.0) * intensity;
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'GlobeAtmosphere'
  return mesh
}

function createEarthSphere(radius: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 96, 96)
  const material = new THREE.MeshStandardMaterial({
    color: 0x2a1f4d,
    roughness: 0.7,
    metalness: 0.05,
    emissive: 0x3d2a6b,
    emissiveIntensity: 0.55,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'GlobeEarth'
  mesh.receiveShadow = true
  return mesh
}

function createGraticule(radius: number): THREE.LineSegments {
  const positions: number[] = []
  const r = radius + GLOBE_SURFACE_LIFT * 0.5

  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lng = -180; lng < 180; lng += 5) {
      const a = lngLatToVector3(lng, lat, r)
      const b = lngLatToVector3(lng + 5, lat, r)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  for (let lng = -180; lng < 180; lng += 30) {
    for (let lat = -80; lat < 80; lat += 5) {
      const a = lngLatToVector3(lng, lat, r)
      const b = lngLatToVector3(lng, lat + 5, r)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  )
  const material = new THREE.LineBasicMaterial({
    color: 0x5b3d8a,
    transparent: true,
    opacity: 0.22,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.name = 'GlobeGraticule'
  return lines
}

function createLandFillMesh(
  rings: number[][][],
  radius: number,
  color: THREE.Color,
  lift = 0.35,
  maxPoints = 100,
  opacity = 0.92,
  maxEdgeRad = GLOBE_MAX_EDGE_RAD
): THREE.Mesh | null {
  if (!rings.length || rings[0].length < 3) return null

  const outer = sampleRing(rings[0], maxPoints)
  const contour = outer.map((p) => new THREE.Vector2(p[0], p[1]))
  if (
    contour.length > 1 &&
    contour[0].distanceTo(contour[contour.length - 1]) < 1e-6
  ) {
    contour.pop()
  }
  if (contour.length < 3) return null

  let triangles: number[][]
  try {
    triangles = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    return null
  }

  type LngLat = [number, number]
  const queue: LngLat[][] = []
  for (const tri of triangles) {
    queue.push([
      [contour[tri[0]].x, contour[tri[0]].y],
      [contour[tri[1]].x, contour[tri[1]].y],
      [contour[tri[2]].x, contour[tri[2]].y],
    ])
  }

  // 大圆弧细分：长边按测地线中点切开，贴合球面曲率
  const finalTris: LngLat[][] = []
  let guard = 0
  const maxOps = 80000
  while (queue.length > 0 && guard < maxOps) {
    guard++
    const tri = queue.pop()
    if (!tri) break
    const d01 = angularDistanceRad(tri[0], tri[1])
    const d12 = angularDistanceRad(tri[1], tri[2])
    const d20 = angularDistanceRad(tri[2], tri[0])
    let longest = 0
    let longestLen = d01
    if (d12 > longestLen) {
      longest = 1
      longestLen = d12
    }
    if (d20 > longestLen) {
      longest = 2
      longestLen = d20
    }

    if (longestLen <= maxEdgeRad) {
      finalTris.push(tri)
      continue
    }

    const a = tri[longest]
    const b = tri[(longest + 1) % 3]
    const c = tri[(longest + 2) % 3]
    const m = geodesicMidpoint(a, b)
    queue.push([a, m, c], [m, b, c])
  }
  while (queue.length > 0) {
    const tri = queue.pop()
    if (tri) finalTris.push(tri)
  }

  const shellR = radius + lift
  const positions: number[] = []
  const indices: number[] = []
  const vertexIndex = new Map<string, number>()

  const getIndex = (lng: number, lat: number) => {
    const key = `${lng.toFixed(5)},${lat.toFixed(5)}`
    const existed = vertexIndex.get(key)
    if (existed !== undefined) return existed
    const v = lngLatToVector3(lng, lat, shellR)
    const idx = positions.length / 3
    positions.push(v.x, v.y, v.z)
    vertexIndex.set(key, idx)
    return idx
  }

  for (const tri of finalTris) {
    const i0 = getIndex(tri[0][0], tri[0][1])
    const i1 = getIndex(tri[1][0], tri[1][1])
    const i2 = getIndex(tri[2][0], tri[2][1])
    if (i0 === i1 || i1 === i2 || i2 === i0) continue
    indices.push(i0, i1, i2)
  }

  if (indices.length < 3) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.12,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  })

  return new THREE.Mesh(geometry, material)
}

export interface BuildGlobeOptions {
  geojson: GlobeGeoJSON
  dataMap: Map<string, GlobeDataItem>
  totalRanks: number
  barSources: GlobeBarSource[]
  teaParties: GlobeTeaParty[]
  shopMarkers: GlobeShopMarker[]
  showBars: boolean
  showTeaParties: boolean
  showShops: boolean
  timeScale: number
  currentTimestamp: number
  formatLocationLabel?: (name: string) => string
  createTextSprite?: (
    text: string,
    color?: string,
    options?: {
      fontSize?: number
      withBackground?: boolean
      strokeWidth?: number
      theme?: 'light' | 'globe'
    }
  ) => THREE.Sprite | null
  barColor?: string | number
}

export interface GlobeSceneParts {
  root: THREE.Group
  barGroup: THREE.Group
  teaGroup: THREE.Group
  shopGroup: THREE.Group
  earth: THREE.Mesh
}

/**
 * 构建完整地球场景（球体 + 大气 + 国界 + 省热力 + 柱/茶会/店铺）
 */
export function buildGlobeScene(options: BuildGlobeOptions): GlobeSceneParts {
  const {
    geojson,
    dataMap,
    totalRanks,
    barSources,
    teaParties,
    shopMarkers,
    showBars,
    showTeaParties,
    showShops,
    timeScale,
    currentTimestamp,
    formatLocationLabel,
    createTextSprite,
    barColor = '#FFC0CB',
  } = options

  const root = new THREE.Group()
  root.name = 'GlobeRoot'
  root.userData.buildVersion = GLOBE_BUILD_VERSION
  root.userData.surfaceLift = GLOBE_SURFACE_LIFT

  // 地球自带补光，避免依赖平面地图的方向光位置
  const globeAmbient = new THREE.AmbientLight(0xffffff, 0.85)
  globeAmbient.name = 'GlobeAmbient'
  root.add(globeAmbient)
  const globeKey = new THREE.DirectionalLight(0xfff0ff, 1.35)
  globeKey.position.set(120, 80, 60)
  globeKey.name = 'GlobeKeyLight'
  root.add(globeKey)
  const globeFill = new THREE.DirectionalLight(0xa5b4fc, 0.55)
  globeFill.position.set(-80, -40, -60)
  globeFill.name = 'GlobeFillLight'
  root.add(globeFill)

  const earth = createEarthSphere(GLOBE_RADIUS)
  root.add(earth)
  root.add(createAtmosphere(GLOBE_RADIUS))
  root.add(createGraticule(GLOBE_RADIUS))

  // 用 world.json 绘制全球陆地填色 + 全部边界线
  // 颜色逻辑与平面地图一致：有人数 → 按排名热力色；无数据 → 浅灰
  const chinaBorderPositions: number[] = []
  const worldBorderPositions: number[] = []
  const idleLandColor = new THREE.Color(0xeeeeee)

  const densifyArc = (
    a: [number, number],
    b: [number, number],
    maxEdge: number,
    depth = 0
  ): [number, number][] => {
    if (depth > 8 || angularDistanceRad(a, b) <= maxEdge) return [a, b]
    const m = geodesicMidpoint(a, b)
    const left = densifyArc(a, m, maxEdge, depth + 1)
    const right = densifyArc(m, b, maxEdge, depth + 1)
    return left.slice(0, -1).concat(right)
  }

  const pushRing = (ring: number[][], into: number[], dense: boolean) => {
    if (!ring || ring.length < 2) return
    const borderR = GLOBE_RADIUS + GLOBE_SURFACE_LIFT + 0.08
    const maxEdge = dense ? GLOBE_MAX_EDGE_RAD * 0.85 : GLOBE_MAX_EDGE_RAD * 1.15
    const sampled = sampleRing(ring, dense ? 260 : 160)
    for (let i = 0; i < sampled.length - 1; i++) {
      const pts = densifyArc(
        [sampled[i][0], sampled[i][1]],
        [sampled[i + 1][0], sampled[i + 1][1]],
        maxEdge
      )
      for (let k = 0; k < pts.length - 1; k++) {
        const a = lngLatToVector3(pts[k][0], pts[k][1], borderR)
        const b = lngLatToVector3(pts[k + 1][0], pts[k + 1][1], borderR)
        into.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
  }

  const landGroup = new THREE.Group()
  landGroup.name = 'GlobeLand'
  const heatGroup = new THREE.Group()
  heatGroup.name = 'GlobeHeat'

  for (const feature of geojson.features) {
    const name = feature.properties.name || ''
    const china = isLikelyChinaFeature(name)
    const { type, coordinates } = feature.geometry
    if (type !== 'Polygon' && type !== 'MultiPolygon') continue

    const borderTarget = china ? chinaBorderPositions : worldBorderPositions
    const ringsList: number[][][] =
      type === 'Polygon'
        ? [coordinates as number[][][]]
        : (coordinates as number[][][][])

    for (const rings of ringsList) {
      // 外环 + 内环都画边界
      for (const ring of rings) {
        pushRing(ring, borderTarget, china)
      }

      // 全球陆地填色：与平面 drawMap 相同——有人数按排名热力色，无数据浅灰
      const dataItem = matchDataItem(name, dataMap)
      const count = dataItem?.count || 0
      const hasHeat = !!(dataItem && count > 0)
      const fillColor =
        hasHeat && dataItem
          ? getLolitaHeatColorByRank(dataItem.rank, totalRanks)
          : idleLandColor.clone()

      const mesh = createLandFillMesh(
        rings,
        GLOBE_RADIUS,
        fillColor,
        hasHeat
          ? GLOBE_SURFACE_LIFT + 0.06
          : china
            ? GLOBE_SURFACE_LIFT + 0.03
            : GLOBE_SURFACE_LIFT,
        china ? 140 : 100,
        hasHeat ? 0.98 : 0.92,
        china ? GLOBE_MAX_EDGE_RAD * 0.85 : GLOBE_MAX_EDGE_RAD
      )
      if (!mesh) continue

      mesh.userData = {
        isProvince: true,
        isGlobeProvince: true,
        isGlobeLand: true,
        name,
        count,
        rank: dataItem?.rank || 0,
        baseColor: fillColor.clone(),
      }
      const g = new THREE.Group()
      g.userData = { ...mesh.userData }
      g.add(mesh)
      if (hasHeat) heatGroup.add(g)
      else landGroup.add(g)
    }
  }

  root.add(landGroup)
  root.add(heatGroup)

  if (worldBorderPositions.length > 0) {
    const worldBorderGeo = new THREE.BufferGeometry()
    worldBorderGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(worldBorderPositions, 3)
    )
    root.add(
      new THREE.LineSegments(
        worldBorderGeo,
        new THREE.LineBasicMaterial({
          color: 0xc4b5e8,
          transparent: true,
          opacity: 0.75,
        })
      )
    )
  }

  if (chinaBorderPositions.length > 0) {
    const chinaBorderGeo = new THREE.BufferGeometry()
    chinaBorderGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(chinaBorderPositions, 3)
    )
    root.add(
      new THREE.LineSegments(
        chinaBorderGeo,
        new THREE.LineBasicMaterial({
          color: 0xf0e6ff,
          transparent: true,
          opacity: 0.95,
        })
      )
    )
  }

  // 分布柱
  const barGroup = new THREE.Group()
  barGroup.name = 'GlobeBarGroup'
  const maxCount = Math.max(1, ...barSources.map((d) => d.count))

  for (const item of barSources) {
    if (item.count <= 0) continue
    const feature = geojson.features.find((f) => {
      const fName = f.properties.name || ''
      const isInner = item.name.includes('内蒙古')
      if (isInner) return fName.includes('内蒙古')
      if (item.name === '蒙古' || (item.name.includes('蒙古') && !item.name.includes('内'))) {
        return (
          (fName === '蒙古' ||
            fName.replace(/省|市|自治区|特别行政区$/, '') === '蒙古') &&
          !fName.includes('内')
        )
      }
      return (
        fName === item.name ||
        fName.includes(item.name) ||
        item.name.includes(fName.replace(/省|市|自治区|特别行政区$/, ''))
      )
    })
    if (!feature) continue
    const center = getFeatureCenter(feature)
    if (!center) continue

    const ratio = item.count / maxCount
    const height = ratio * 14 + 1.5
    const cylR = 0.7
    const baseR = markerBaseRadius(cylR)
    const surface = lngLatToVector3(center[0], center[1], baseR)
    const normal = surface.clone().normalize()

    const geometry = new THREE.CylinderGeometry(0.55, 0.7, height, 14)
    const material = new THREE.MeshStandardMaterial({
      color: barColor,
      roughness: 0.45,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92,
      emissive: new THREE.Color(barColor),
      emissiveIntensity: 0.15,
    })
    const mesh = new THREE.Mesh(geometry, material)
    const mid = normal.clone().multiplyScalar(baseR + height / 2)
    mesh.position.copy(mid)
    orientOutward(mesh, mid)
    mesh.userData = {
      isBar: true,
      isGlobeBar: true,
      name: item.name,
      count: item.count,
    }
    barGroup.add(mesh)

    // 底座光环
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 28),
      new THREE.MeshBasicMaterial({
        color: barColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      })
    )
    const ringPos = normal.clone().multiplyScalar(baseR + 0.05)
    ring.position.copy(ringPos)
    ring.lookAt(0, 0, 0)
    barGroup.add(ring)

    if (createTextSprite) {
      const labelText = formatLocationLabel
        ? formatLocationLabel(item.name)
        : item.name
      const label = createTextSprite(labelText, '#111111', {
        fontSize: 36,
        withBackground: true,
        strokeWidth: 3,
        theme: 'globe',
      })
      const num = createTextSprite(`${item.count}`, '#111111', {
        fontSize: 38,
        withBackground: true,
        strokeWidth: 3,
        theme: 'globe',
      })
      if (label) {
        label.userData.isGlobeLabel = true
        label.position.copy(
          normal.clone().multiplyScalar(baseR + height + 3.2)
        )
        label.scale.multiplyScalar(2.4)
        barGroup.add(label)
      }
      if (num) {
        num.userData.isGlobeLabel = true
        num.position.copy(
          normal.clone().multiplyScalar(baseR + height + 1.6)
        )
        num.scale.multiplyScalar(2.4)
        barGroup.add(num)
      }
    }
  }
  barGroup.visible = showBars
  root.add(barGroup)

  // 茶会：径向柱，时间差沿法线偏移
  const teaGroup = new THREE.Group()
  teaGroup.name = 'GlobeTeaGroup'
  const globeTimeScale = timeScale * 0.35

  for (const party of teaParties) {
    if (!party.longitude && !party.latitude) continue
    const durationMs = party.end_time - party.start_time
    const durationDays = Math.max(0.1, durationMs / (1000 * 60 * 60 * 24))
    const height = Math.max(0.8, durationDays * globeTimeScale)

    const geometry = new THREE.CylinderGeometry(0.35, 0.35, height, 12)
    const material = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.2,
    })
    const mesh = new THREE.Mesh(geometry, material)
    const surface = lngLatToVector3(party.longitude, party.latitude, GLOBE_RADIUS)
    const normal = surface.clone().normalize()
    const diffDays =
      (party.start_time - currentTimestamp) / (1000 * 60 * 60 * 24)
    const radialOffset = diffDays * globeTimeScale
    const baseR = markerBaseRadius(0.35)
    const mid = normal
      .clone()
      .multiplyScalar(baseR + radialOffset + height / 2)
    mesh.position.copy(mid)
    orientOutward(mesh, mid)
    mesh.userData = {
      isTeaParty: true,
      isGlobeTeaParty: true,
      tea_id: party.tea_id,
      start_time: party.start_time,
      end_time: party.end_time,
      height,
      name: party.tea_title,
      tea_cover: party.tea_cover,
      surfaceNormal: normal.clone(),
      baseRadius: baseR,
      globeTimeScale,
    }
    teaGroup.add(mesh)
  }
  teaGroup.visible = showTeaParties
  root.add(teaGroup)

  // 实体店：按 0.8° 网格聚合
  const teaShopGroup = new THREE.Group()
  teaShopGroup.name = 'GlobeShopGroup'
  const grid = new Map<string, { lngSum: number; latSum: number; shops: unknown[] }>()
  for (const marker of shopMarkers) {
    const key = `${Math.round(marker.longitude / 0.8)}_${Math.round(marker.latitude / 0.8)}`
    const existed = grid.get(key)
    if (!existed) {
      grid.set(key, {
        lngSum: marker.longitude,
        latSum: marker.latitude,
        shops: [...marker.shops],
      })
    } else {
      existed.shops.push(...marker.shops)
      existed.lngSum += marker.longitude
      existed.latSum += marker.latitude
    }
  }

  for (const marker of grid.values()) {
    const count = marker.shops.length
    const radius = Math.min(1.8, 0.55 + count * 0.12)
    const pos = lngLatToVector3(
      marker.lngSum / count,
      marker.latSum / count,
      markerBaseRadius(radius) + radius
    )
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshStandardMaterial({
        color: count > 1 ? 0xff9eb5 : 0xb794f6,
        emissive: count > 1 ? 0xff6b9d : 0x7c3aed,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.1,
      })
    )
    mesh.position.copy(pos)
    mesh.userData =
      count > 1
        ? { isShopCluster: true, isGlobeShop: true, cluster: marker.shops }
        : {
            isPhysicalShop: true,
            isGlobeShop: true,
            shop: marker.shops[0],
            cluster: marker.shops,
          }
    teaShopGroup.add(mesh)
  }
  teaShopGroup.visible = showShops
  root.add(teaShopGroup)

  return {
    root,
    barGroup,
    teaGroup,
    shopGroup: teaShopGroup,
    earth,
  }
}

/** 按当前时间更新地球茶会径向位置 */
export function updateGlobeTeaPartyPositions(
  teaGroup: THREE.Group | null,
  currentTimestamp: number
) {
  if (!teaGroup) return
  for (const child of teaGroup.children) {
    if (!child.userData.isGlobeTeaParty) continue
    const normal = child.userData.surfaceNormal as THREE.Vector3
    const baseRadius = child.userData.baseRadius as number
    const height = child.userData.height as number
    const globeTimeScale = child.userData.globeTimeScale as number
    const startTs = child.userData.start_time as number
    const diffDays = (startTs - currentTimestamp) / (1000 * 60 * 60 * 24)
    const radialOffset = diffDays * globeTimeScale
    const mid = normal
      .clone()
      .multiplyScalar(baseRadius + radialOffset + height / 2)
    child.position.copy(mid)
    orientOutward(child, mid)
  }
}

/**
 * 隐藏转到地球背面的标注（Sprite 默认会始终朝向相机，需按半球可见性裁剪）
 */
export function updateGlobeLabelVisibility(
  root: THREE.Object3D | null,
  camera: THREE.Camera
) {
  if (!root || !root.visible) return
  const camDir = camera.position.clone().normalize()
  root.traverse((obj) => {
    if (!obj.userData?.isGlobeLabel) return
    // 标注在球心外沿法线方向；与相机方向点积 <= 0 即在背面
    const outward = obj.position.clone().normalize()
    obj.visible = outward.dot(camDir) > 0.12
  })
}

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry?.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) {
        for (const m of mat) m.dispose()
      } else {
        mat?.dispose()
      }
    }
  })
}
