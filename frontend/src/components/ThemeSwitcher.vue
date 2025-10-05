<template>
  <div class="theme-switcher" :title="currentLabel">
    <button class="theme-toggle" @click="cycleTheme" :aria-label="currentLabel">
      <!-- 叠加三个图标，仅显示当前主题对应的一个 -->
      <span class="icon icon-auto" :class="{ visible: currentTheme === 'auto' }" />
      <span class="icon icon-light" :class="{ visible: currentTheme === 'light' }" />
      <span class="icon icon-dark" :class="{ visible: currentTheme === 'dark' }" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { t } from '../utils/i18n'

const THEME_KEY = 'acuity-theme-mode'
const currentTheme = ref<'auto' | 'light' | 'dark'>('auto')

const currentLabel = computed(() => {
  switch (currentTheme.value) {
    case 'light': return t('themeSwitcher.light')
    case 'dark': return t('themeSwitcher.dark')
    default: return t('themeSwitcher.auto')
  }
})

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

function cycleTheme() {
  const next: Record<'auto' | 'light' | 'dark', 'auto' | 'light' | 'dark'> = {
    auto: 'light',
    light: 'dark',
    dark: 'auto',
  }
  setTheme(next[currentTheme.value])
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
}

.theme-toggle {
  position: relative;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-surface-variant, rgba(255,255,255,0.08));
  border: 1px solid var(--theme-outline, rgba(255,255,255,0.12));
  border-radius: 8px;
  color: var(--theme-on-surface, #ddd);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.08s ease;
  z-index: 1;
}

.theme-toggle:hover { background: var(--theme-secondary-container, rgba(255,255,255,0.12)); }
.theme-toggle:active { opacity: 0.9; }

.icon {
  position: absolute;
  opacity: 0;
  transition: opacity 0.12s ease;
  font-size: 18px;
  line-height: 1;
}
.icon.visible { opacity: 1; }

.icon-auto::before { content: '\1F310'; }
.icon-light::before { content: '\2600'; }
.icon-dark::before { content: '\1F319'; }
</style>
