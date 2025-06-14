<template>
  <div class="theme-switcher">
    <div class="preset-themes">
      <button
        v-for="theme in Object.values(themes)"
        :key="theme.name"
        @click="setTheme(theme.name)"
        :class="{ active: currentTheme === theme.name }"
      >
        {{ theme.label }}
      </button>
    </div>
    
    <button @click="isCustomizing = !isCustomizing">
      {{ isCustomizing ? 'Hide Customization' : 'Customize Theme' }}
    </button>
    
    <div v-if="isCustomizing" class="color-customizer">
      <div v-for="(value, key) in themes.custom.colors" :key="key" class="color-input">
        <label :for="key">{{ key }}</label>
        <input
          :id="key"
          type="color"
          :value="value"
          @input="updateColor(key, ($event.target as HTMLInputElement).value)"
        >
        <span>{{ value }}</span>
      </div>
      
      <button @click="resetCustomTheme">Reset</button>
      <button @click="applyCustomTheme">Apply Custom Theme</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from '~/stores/theme'

const themeStore = useThemeStore()
const { currentTheme, themes } = storeToRefs(themeStore)
const isCustomizing = ref(false)

const setTheme = (themeName: string) => {
  themeStore.setTheme(themeName)
}

const updateColor = (key: string, value: string) => {
  themeStore.updateCustomThemeColor(key, value)
}

const resetCustomTheme = () => {
  themeStore.resetCustomTheme()
}

const applyCustomTheme = () => {
  themeStore.setTheme('custom')
}
</script>

<style scoped>
.theme-switcher {
  padding: 1rem;
  background: var(--card-color);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.preset-themes {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  border: 1px solid var(--text-color);
  background: var(--background-color);
  color: var(--text-color);
}

button.active {
  background: var(--primary-color);
}

.color-customizer {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--card-color);
  border-radius: 0.5rem;
}

.color-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.color-input label {
  min-width: 100px;
}

.color-input input[type="color"] {
  width: 50px;
  height: 30px;
  padding: 0;
  border: none;
  cursor: pointer;
}
</style>
