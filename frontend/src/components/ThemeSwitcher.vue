<template>
  <div class="theme-switcher" :title="t('themeSwitcher.tooltip')">
    <button
      v-for="option in themeOptions"
      :key="option.value"
      :class="['theme-btn', { active: currentTheme === option.value }]"
      @click="setTheme(option.value as 'auto' | 'light' | 'dark')"
      :aria-label="option.label"
    >
      <span v-if="option.value === 'auto'" class="icon-auto" />
      <span v-else-if="option.value === 'light'" class="icon-light" />
      <span v-else class="icon-dark" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { t } from '../utils/i18n'

const THEME_KEY = 'acuity-theme-mode'
const themeOptions = [
  { value: 'auto', label: t('themeSwitcher.auto') },
  { value: 'light', label: t('themeSwitcher.light') },
  { value: 'dark', label: t('themeSwitcher.dark') },
]
const currentTheme = ref<'auto' | 'light' | 'dark'>('auto')

function applyTheme(mode: 'auto' | 'light' | 'dark') {
  const root = document.documentElement
  if (mode === 'auto') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
}

function setTheme(mode: 'auto' | 'light' | 'dark') {
  currentTheme.value = mode
  localStorage.setItem(THEME_KEY, mode)
  applyTheme(mode)
}



onMounted(() => {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'auto' || saved === 'light' || saved === 'dark') {
    currentTheme.value = saved
  }
  applyTheme(currentTheme.value as 'auto' | 'light' | 'dark')
  if (currentTheme.value === 'auto') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme.value === 'auto') applyTheme('auto')
    })
  }
})

watch(currentTheme, (val) => {
  applyTheme(val)
})
</script>

<style scoped>
.theme-switcher {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}
.theme-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--theme-on-surface, #333);
  opacity: 0.7;
  transition: background 0.15s, opacity 0.15s;
  font-size: 18px;
  display: flex;
  align-items: center;
}
.theme-btn.active,
.theme-btn:hover {
  background: var(--theme-secondary-container, #e0e0e0);
  opacity: 1;
}
.icon-auto::before {
  content: '\1F310'; /* 🌐 */
  font-size: 18px;
}
.icon-light::before {
  content: '\2600'; /* ☀️ */
  font-size: 18px;
}
.icon-dark::before {
  content: '\1F319'; /* 🌙 */
  font-size: 18px;
}
</style>
