<script setup>
import { ref, onMounted, inject } from 'vue'
import * as THREE from 'three'

const threeScene = inject('threeScene')
const particles = ref(null)

onMounted(() => {
  const scene = threeScene.getScene()
  
  // 创建粒子几何体
  const geometry = new THREE.BufferGeometry()
  const count = 5000
  
  // 创建随机位置
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10
    colors[i] = Math.random()
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  
  // 创建粒子材质
  const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  })
  
  // 创建粒子系统
  particles.value = new THREE.Points(geometry, material)
  scene.add(particles.value)
  
  // 动画
  const animateParticles = () => {
    if (!particles.value) return
    
    const positions = particles.value.geometry.attributes.position.array
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += 0.01
      if (positions[i + 1] > 5) {
        positions[i + 1] = -5
      }
    }
    particles.value.geometry.attributes.position.needsUpdate = true
  }
  
  threeScene.getRenderer().setAnimationLoop(() => {
    animateParticles()
    threeScene.getRenderer().render(scene, threeScene.getCamera())
  })
})
</script>

<template>
  <div></div>
</template>