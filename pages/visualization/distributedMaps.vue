<template>
  <div class="relative w-full h-screen overflow-hidden bg-black">
    <RankingList :data="rankList" />
    <div ref="container" class="w-full h-full"></div>
    
    <!-- Loading overlay -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
      <div class="text-white text-xl">Loading...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import ThreeCore from '@/utils/threeCore'
import { BASE_IMG } from '@/utils/ipConfig'
import { getDistributedMaps } from '@/api/statistics'
import RankingList from '@/components/visualization/RankingList.vue'

// SEO
useHead({
  title: 'Lo娘分布地图 - Lo研社',
})

const container = ref<HTMLElement | null>(null)
const loading = ref(true)
const rankList = ref<any[]>([])
const threeCore = shallowRef<ThreeCore | null>(null)

// Map state
const latRange = ref({ min: Infinity, max: -Infinity })
const lonRange = ref({ min: Infinity, max: -Infinity })

// Helper to convert lat/lon to 3D coordinates (using simple linear projection as requested)
const latLonToXYZ = (lat: number, lon: number) => {
  const lRange = latRange.value
  const lnRange = lonRange.value
  
  if (lRange.min === Infinity || lnRange.min === Infinity) return new THREE.Vector3(0, 0, 0)
  
  // Center the map at (0,0,0) by subtracting 0.5 and then scaling
  // The original code mapped to 0..1000. Let's map to -500..500 for better centering
  const x = ((lon - lnRange.min) / (lnRange.max - lnRange.min) - 0.5) * 1000
  const y = ((lat - lRange.min) / (lRange.max - lRange.min) - 0.5) * 1000
  const z = 0
  
  return new THREE.Vector3(x, y, z)
}

// Calculate ranges from GeoJSON
const calculateLatLonRange = (geojson: any) => {
  let lRange = { min: Infinity, max: -Infinity }
  let lnRange = { min: Infinity, max: -Infinity }

  geojson.features.forEach((feature: any) => {
    const processRing = (ring: number[][]) => {
      ring.forEach(([lon, lat]) => {
        lRange.min = Math.min(lRange.min, lat)
        lRange.max = Math.max(lRange.max, lat)
        lnRange.min = Math.min(lnRange.min, lon)
        lnRange.max = Math.max(lnRange.max, lon)
      })
    }

    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach(processRing)
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon: any) => {
        polygon.forEach(processRing)
      })
    }
  })

  return { latRange: lRange, lonRange: lnRange }
}

// Create Map Mesh from GeoJSON
const createGeoJsonMap = (geojson: any, options: { totalCount: number }) => {
  const group = new THREE.Group()
  const material = new THREE.MeshPhongMaterial({ 
    color: 0x333333, 
    transparent: true, 
    opacity: 0.9,
    side: THREE.DoubleSide
  })
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })

  geojson.features.forEach((feature: any) => {
    const drawPolygon = (coordinates: number[][]) => {
      const shape = new THREE.Shape()
      
      coordinates.forEach((point, i) => {
        const [lon, lat] = point
        const pos = latLonToXYZ(lat, lon)
        if (i === 0) {
          shape.moveTo(pos.x, pos.y)
        } else {
          shape.lineTo(pos.x, pos.y)
        }
      })

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 2,
        bevelEnabled: false
      })

      // Determine color based on rank if available
      let color = new THREE.Color(0x333333)
      if (feature.rank) {
        // Top ranks get brighter colors
        if (feature.rank <= 3) {
           color = new THREE.Color().setHSL(0.1, 0.8, 0.6) // Gold-ish
        } else if (feature.rank <= 10) {
           color = new THREE.Color().setHSL(0.6, 0.5, 0.5) // Blue-ish
        } else {
           // Gradient based on rank
           color = new THREE.Color().setHSL(0.6, 0.3, 0.3 + (1/feature.rank)*0.5)
        }
      } else if (feature.count > 0) {
          color = new THREE.Color().setHSL(0.6, 0.5, 0.4)
      }

      const mat = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      })

      const mesh = new THREE.Mesh(geometry, mat)
      mesh.userData = feature.properties
      mesh.receiveShadow = true
      mesh.castShadow = true
      group.add(mesh)

      // Add border line
      const points = coordinates.map(([lon, lat]) => latLonToXYZ(lat, lon))
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(lineGeometry, lineMaterial)
      // Lift line slightly to avoid z-fighting
      line.position.z = 2.1
      group.add(line)
    }

    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach(drawPolygon)
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon: any) => {
        polygon.forEach(drawPolygon)
      })
    }
  })

  return group
}

// Create Cylinder at Lat/Lng
const createCylinderAtLatLng = (lat: number, lon: number, height: number, name: string) => {
  const pos = latLonToXYZ(lat, lon)
  
  // Ensure minimum height for visibility
  const h = Math.max(height, 2)
  
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, h, 8)
  // Shift center so cylinder grows upwards
  geometry.translate(0, h / 2, 0)
  // Rotate to align with Z axis (since map is on XY plane in the projection logic)
  geometry.rotateX(Math.PI / 2)
  
  const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 }) // Green bars
  const mesh = new THREE.Mesh(geometry, material)
  
  mesh.position.set(pos.x, pos.y, 2) // On top of map
  mesh.userData = { name, height }
  mesh.castShadow = true
  mesh.receiveShadow = true
  
  return mesh
}

// Rank distribution helper
const rankDistribution = (features: any[], topN: number | null = null) => {
  const total = features.reduce((sum, f) => sum + (f.count || 0), 0)
  const sorted = [...features]
    .filter(f => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((f, index) => ({
      rank: index + 1,
      name: f.name,
      count: f.count,
      percent: total > 0 ? ((f.count / total) * 100).toFixed(2) + '%' : '0%'
    }))
  return topN ? sorted.slice(0, topN) : sorted
}

onMounted(async () => {
  if (!container.value) return

  // Initialize ThreeCore with high performance settings
  const app = new ThreeCore({
    antialias: true,
    alpha: true,
    cameraPosition: { x: 0, y: 0, z: 600 },
    enableOrbitControls: true,
    pixelRatio: window.devicePixelRatio,
    // clearColor: 0x000000 
  })
  
  app.mount(container.value)
  app.startAnimationLoop()
  threeCore.value = app
  
  // Use Bloom
  app.toggleBloom(true)
  if (app.bloomPass) {
      app.bloomPass.strength = 0.5
      app.bloomPass.radius = 0.5
      app.bloomPass.threshold = 0
  }

  // Clear existing lights and setup scene specific lights
  // app.scene.remove(...app.scene.children.filter(o => o instanceof THREE.Light)) // Rough cleanup if needed
  
  // Setup lights based on the requested "old code" style
  // Ambient Light
  if (app.lights?.ambient) app.lights.ambient.intensity = 2
  
  // Directional Light with Shadows
  if (app.lights?.directional) {
      const dirLight = app.lights.directional
      dirLight.intensity = 6
      dirLight.position.set(50, 100, 50)
      dirLight.castShadow = true
      dirLight.shadow.mapSize.width = 4096
      dirLight.shadow.mapSize.height = 4096
      dirLight.shadow.bias = -0.0001
      dirLight.shadow.camera.near = 0.5
      dirLight.shadow.camera.far = 500
      dirLight.shadow.camera.left = -300
      dirLight.shadow.camera.right = 300
      dirLight.shadow.camera.top = 300
      dirLight.shadow.camera.bottom = -300
      
      // Add helper for debugging if needed
      // const helper = new THREE.DirectionalLightHelper(dirLight)
      // app.scene.add(helper)
  }

  try {
    // 1. Fetch World JSON (changed from geoJson.json)
    const geoJsonRes = await fetch(BASE_IMG + 'ssr/world.json')
    if (!geoJsonRes.ok) throw new Error('Failed to load world.json')
    const geojson = await geoJsonRes.json()

    // 2. Calculate Ranges
    const ranges = calculateLatLonRange(geojson)
    latRange.value = ranges.latRange
    lonRange.value = ranges.lonRange

    // 3. Fetch Statistics Data
    const statsRes = await getDistributedMaps()
    const statsData = statsRes.data

    // 4. Merge Data
    let totalCount = 0
    const features = geojson.features.map((item: any) => {
        return {
            name: item.properties.name,
            center: item.properties.center, 
            count: 0
        }
    })

    statsData.forEach((child) => {
        const index = features.findIndex((item: any) => item.name && item.name.includes(child.ip_location))
        if (index !== -1) {
            features[index].count = child.COUNT
            totalCount += child.COUNT
            geojson.features[index].count = child.COUNT
        }
    })

    // 5. Rank Logic (from old React code)
    const provinceName = [
        '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省',
        '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省',
        '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省',
        '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
        '台湾省', '香港特别行政区', '澳门特别行政区'
    ];
    
    // Rank features for coloring logic
    const chinaFeaturesWithIndex = geojson.features
        .map((f: any, i: number) => ({ feature: f, index: i }))
        .filter((item: any) => provinceName.includes(item.feature.properties.name));
        
    chinaFeaturesWithIndex
        .sort((a: any, b: any) => (b.feature.count || 0) - (a.feature.count || 0))
        .forEach((item: any, i: number) => {
          geojson.features[item.index].rank = i + 1;
        });

    rankList.value = rankDistribution(features)

    // 6. Create Map
    const mapGroup = createGeoJsonMap(geojson, { totalCount })
    app.scene.add(mapGroup)

    // 7. Create Cylinders (Data Bars)
    const barsGroup = new THREE.Group()
    features.forEach((child: any) => {
        if (child.count > 0 && child.center) {
            const height = (child.count / totalCount) * 500 // Scale factor
            const cylinder = createCylinderAtLatLng(child.center[1], child.center[0], height, `${child.name} ${child.count}`)
            
            // Color coding based on count intensity
            const intensity = Math.min(child.count / (totalCount * 0.1), 1)
            const color = new THREE.Color().setHSL(0.3 - intensity * 0.3, 1.0, 0.5) // Green to Red
            if (cylinder.material instanceof THREE.MeshPhongMaterial) {
               cylinder.material.color = color
               // Add emissive for bloom
               cylinder.material.emissive = color
               cylinder.material.emissiveIntensity = 0.5
            }
            
            // Enable bloom layer for this object
            app.addBloomObject(cylinder)
            
            barsGroup.add(cylinder)
        }
    })
    app.scene.add(barsGroup)

    // Breathing Animation
    const animateBreathing = () => {
        const time = Date.now() * 0.002;
        barsGroup.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
                // Pulse emissive intensity
                const pulse = (Math.sin(time) + 1) * 0.5 * 0.5 + 0.2; // 0.2 to 0.7
                child.material.emissiveIntensity = pulse;
            }
        });
    }
    app.addAnimationCallback(animateBreathing);

    // Adjust Camera Focus
    const centerPos = latLonToXYZ(35, 105) // China center roughly
    app.controls.target.set(centerPos.x, centerPos.y, 0)
    app.camera.position.set(centerPos.x, centerPos.y - 300, 300)
    app.camera.lookAt(centerPos.x, centerPos.y, 0)
    app.controls.update()

  } catch (e) {
    console.error('Failed to load map data', e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (threeCore.value) {
    threeCore.value.dispose()
  }
})
</script>

<style scoped>
/* Add any custom styles here */
</style>
