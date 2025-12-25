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
      
      // Compute color based on rank or count if needed
      // const color = new THREE.Color().setHSL(Math.random(), 0.5, 0.5)
      // const mat = material.clone()
      // mat.color = color

      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData = feature.properties
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

  // Initialize ThreeCore
  const app = new ThreeCore({
    antialias: true,
    alpha: true,
    cameraPosition: { x: 0, y: 0, z: 600 }, // Adjust based on scale
    enableOrbitControls: true
  })
  
  app.mount(container.value)
  app.startAnimationLoop()
  threeCore.value = app

  // Setup basic lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  app.scene.add(ambientLight)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(100, 100, 200)
  app.scene.add(dirLight)

  try {
    // 1. Fetch GeoJSON
    const geoJsonRes = await fetch(BASE_IMG + 'ssr/geoJson.json')
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
        // Find center if not present (simple approximation or property)
        // The user code assumed item.properties.center exists
        return {
            name: item.properties.name,
            center: item.properties.center, 
            count: 0
        }
    })

    statsData.forEach((child) => {
        // Fuzzy match province name
        const index = features.findIndex((item: any) => item.name && item.name.includes(child.ip_location))
        if (index !== -1) {
            features[index].count = child.COUNT
            totalCount += child.COUNT
            
            // Also update geojson feature for consistency if needed
            geojson.features[index].count = child.COUNT
        }
    })

    // 5. Update Rank List
    rankList.value = rankDistribution(features)

    // 6. Create Map
    const mapGroup = createGeoJsonMap(geojson, { totalCount })
    // Center the map group? The latLonToXYZ handles centering reasonably well if ranges are correct.
    app.scene.add(mapGroup)

    // 7. Create Cylinders (Data Bars)
    const barsGroup = new THREE.Group()
    features.forEach((child: any) => {
        if (child.count > 0 && child.center) {
            // center is [lon, lat] usually
            const height = (child.count / totalCount) * 500 // Scale factor
            const cylinder = createCylinderAtLatLng(child.center[1], child.center[0], height, `${child.name} ${child.count}`)
            
            // Color coding based on count intensity
            const intensity = Math.min(child.count / (totalCount * 0.1), 1) // Heuristic
            const color = new THREE.Color().setHSL(0.3 - intensity * 0.3, 1.0, 0.5) // Green to Red
            if (cylinder.material instanceof THREE.MeshPhongMaterial) {
               cylinder.material.color = color
            }
            
            barsGroup.add(cylinder)
        }
    })
    app.scene.add(barsGroup)

    // Adjust Camera
    // Focus on China (approx center)
    // 31.51, 121.4 is Shanghai, user focused there.
    // China center roughly 35, 105
    const centerPos = latLonToXYZ(35, 105)
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
