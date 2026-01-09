<template>
    <div class="dual-range-container relative">
        <div class="relative w-full h-6">
            <!-- 背景轨道 -->
            <div class="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            
            <!-- 选中范围 -->
            <div 
                class="absolute h-full bg-qhx-primary rounded-full"
                :style="{
                    left: `${leftPercent}%`,
                    width: `${rightPercent - leftPercent}%`
                }"
            ></div>
            
            <!-- 最小值滑块 -->
            <input
                ref="minInputRef"
                type="range"
                :min="min"
                :max="max"
                :step="step"
                :value="modelValue[0]"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                @input="handleMinInput"
                @mousedown="activeThumb = 'min'"
                @touchstart="activeThumb = 'min'"
            />
            
            <!-- 最大值滑块 -->
            <input
                ref="maxInputRef"
                type="range"
                :min="min"
                :max="max"
                :step="step"
                :value="modelValue[1]"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                @input="handleMaxInput"
                @mousedown="activeThumb = 'max'"
                @touchstart="activeThumb = 'max'"
            />
            
            <!-- 最小值拖拽点 -->
            <div
                class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-200 border-2 border-qhx-primary rounded-full shadow-md cursor-pointer z-30"
                :style="{ left: `calc(${leftPercent}% - 8px)` }"
                @mousedown.stop="activeThumb = 'min'; handleThumbMouseDown($event, 'min')"
                @touchstart.stop="activeThumb = 'min'; handleThumbTouchStart($event, 'min')"
            ></div>
            
            <!-- 最大值拖拽点 -->
            <div
                class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-200 border-2 border-qhx-primary rounded-full shadow-md cursor-pointer z-30"
                :style="{ left: `calc(${rightPercent}% - 8px)` }"
                @mousedown.stop="activeThumb = 'max'; handleThumbMouseDown($event, 'max')"
                @touchstart.stop="activeThumb = 'max'; handleThumbTouchStart($event, 'max')"
            ></div>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    modelValue: [number, number]
    min: number
    max: number
    step?: number
}>()

const emit = defineEmits<{
    'update:modelValue': [value: [number, number]]
}>()

const step = computed(() => props.step ?? 1)
const minInputRef = ref<HTMLInputElement | null>(null)
const maxInputRef = ref<HTMLInputElement | null>(null)
const activeThumb = ref<'min' | 'max' | null>(null)

const leftPercent = computed(() => {
    return ((props.modelValue[0] - props.min) / (props.max - props.min)) * 100
})

const rightPercent = computed(() => {
    return ((props.modelValue[1] - props.min) / (props.max - props.min)) * 100
})

const handleMinInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    const value = Number.parseFloat(target.value)
    const maxValue = props.modelValue[1]
    
    // 确保最小值不超过最大值
    const newMin = Math.min(value, maxValue - step.value)
    emit('update:modelValue', [newMin, maxValue])
}

const handleMaxInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    const value = Number.parseFloat(target.value)
    const minValue = props.modelValue[0]
    
    // 确保最大值不小于最小值
    const newMax = Math.max(value, minValue + step.value)
    emit('update:modelValue', [minValue, newMax])
}

const handleThumbMouseDown = (e: MouseEvent, thumb: 'min' | 'max') => {
    e.preventDefault()
    e.stopPropagation()
    activeThumb.value = thumb
    
    const container = (e.currentTarget as HTMLElement).closest('.dual-range-container') as HTMLElement
    if (!container) return
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!activeThumb.value || !container) return
        
        const rect = container.getBoundingClientRect()
        if (!rect) return
        
        const percent = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100))
        const value = props.min + (percent / 100) * (props.max - props.min)
        const steppedValue = Math.round(value / step.value) * step.value
        const clampedValue = Math.max(props.min, Math.min(props.max, steppedValue))
        
        if (thumb === 'min') {
            const newMin = Math.min(clampedValue, props.modelValue[1] - step.value)
            emit('update:modelValue', [newMin, props.modelValue[1]])
        } else {
            const newMax = Math.max(clampedValue, props.modelValue[0] + step.value)
            emit('update:modelValue', [props.modelValue[0], newMax])
        }
    }
    
    const handleMouseUp = () => {
        activeThumb.value = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
}

const handleThumbTouchStart = (e: TouchEvent, thumb: 'min' | 'max') => {
    e.preventDefault()
    e.stopPropagation()
    activeThumb.value = thumb
    
    const container = (e.currentTarget as HTMLElement).closest('.dual-range-container') as HTMLElement
    if (!container) return
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
        if (!activeThumb.value || !container) return
        
        const rect = container.getBoundingClientRect()
        if (!rect) return
        
        const touch = moveEvent.touches[0]
        const percent = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100))
        const value = props.min + (percent / 100) * (props.max - props.min)
        const steppedValue = Math.round(value / step.value) * step.value
        const clampedValue = Math.max(props.min, Math.min(props.max, steppedValue))
        
        if (thumb === 'min') {
            const newMin = Math.min(clampedValue, props.modelValue[1] - step.value)
            emit('update:modelValue', [newMin, props.modelValue[1]])
        } else {
            const newMax = Math.max(clampedValue, props.modelValue[0] + step.value)
            emit('update:modelValue', [props.modelValue[0], newMax])
        }
    }
    
    const handleTouchEnd = () => {
        activeThumb.value = null
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
}
</script>

<style scoped>
.dual-range-container input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
}

.dual-range-container input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: transparent;
    cursor: pointer;
}

.dual-range-container input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: transparent;
    border: none;
    cursor: pointer;
}
</style>

