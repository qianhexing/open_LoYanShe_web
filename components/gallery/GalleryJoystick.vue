<script setup lang="ts">
/**
 * 移动端虚拟摇杆
 * 输出 normalized 向量 { x, y } ∈ [-1, 1]
 */
const emit = defineEmits<{
  move: [x: number, y: number]
  end: []
}>()

const zoneRef = ref<HTMLElement | null>(null)
const active = ref(false)
const knobOffset = ref({ x: 0, y: 0 })

const RADIUS = 50
const KNOB_RADIUS = 22

const resetKnob = () => {
  knobOffset.value = { x: 0, y: 0 }
  active.value = false
  emit('end')
  emit('move', 0, 0)
}

const handlePointerDown = (e: PointerEvent) => {
  if (!zoneRef.value) return
  active.value = true
  zoneRef.value.setPointerCapture(e.pointerId)
  updateKnob(e)
}

const updateKnob = (e: PointerEvent) => {
  if (!zoneRef.value || !active.value) return
  const rect = zoneRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = e.clientX - cx
  let dy = e.clientY - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > RADIUS) {
    dx = (dx / dist) * RADIUS
    dy = (dy / dist) * RADIUS
  }
  knobOffset.value = { x: dx, y: dy }
  emit('move', dx / RADIUS, dy / RADIUS)
}

const handlePointerMove = (e: PointerEvent) => {
  if (!active.value) return
  updateKnob(e)
}

const handlePointerUp = (e: PointerEvent) => {
  if (!zoneRef.value) return
  zoneRef.value.releasePointerCapture(e.pointerId)
  resetKnob()
}
</script>

<template>
  <div
    ref="zoneRef"
    class="gallery-joystick"
    @pointerdown.prevent="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="resetKnob"
  >
    <div class="gallery-joystick__base" />
    <div
      class="gallery-joystick__knob"
      :style="{
        transform: `translate(calc(-50% + ${knobOffset.x}px), calc(-50% + ${knobOffset.y}px))`
      }"
    />
  </div>
</template>

<style scoped>
.gallery-joystick {
  position: relative;
  width: 120px;
  height: 120px;
  touch-action: none;
  user-select: none;
  filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.4));
}

.gallery-joystick__base {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 42%, rgba(40, 28, 38, 0.55), rgba(8, 6, 12, 0.72)),
    rgba(255, 255, 255, 0.06);
  border: 1.5px solid rgba(232, 164, 180, 0.35);
  box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
}

.gallery-joystick__base::before {
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.gallery-joystick__knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, #f0c8d4, #c87890 55%, #8a4a5c);
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.35),
    0 0 14px rgba(232, 164, 180, 0.35);
  pointer-events: none;
  transition: box-shadow 0.15s, transform 0.15s;
}

.gallery-joystick:active .gallery-joystick__knob {
  box-shadow:
    0 2px 14px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(232, 164, 180, 0.55);
}
</style>
