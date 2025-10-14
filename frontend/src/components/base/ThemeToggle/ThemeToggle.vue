<!--
  主题切换组件
  - 支持自动/暗黑/明亮三种模式
  - 点击轮流切换，用不同图标表示
  - 可独立使用，不依赖特定页面结构
-->
<template>
  <button
    class="theme-toggle"
    :title="currentThemeTooltip"
    :aria-label="currentThemeTooltip"
    @click="toggleTheme"
  >
    <Icon :name="currentThemeIcon" :size="20" />
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@/components'

// 主题类型定义
type ThemeMode = 'auto' | 'dark' | 'light'

// 当前主题状态
const currentTheme = ref<ThemeMode>('auto')

// 主题配置
const themeConfig = {
  auto: {
    icon: 'mdi-theme-light-dark',
    tooltip: '自动主题（跟随系统）'
  },
  dark: {
    icon: 'mdi-weather-night',
    tooltip: '暗黑主题'
  },
  light: {
    icon: 'mdi-weather-sunny',
    tooltip: '明亮主题'
  }
} as const

// 计算当前主题的图标和提示
const currentThemeIcon = computed(() => themeConfig[currentTheme.value].icon)
const currentThemeTooltip = computed(
  () => themeConfig[currentTheme.value].tooltip
)

// 主题切换逻辑
const toggleTheme = () => {
  const themes: ThemeMode[] = ['auto', 'dark', 'light']
  const currentIndex = themes.indexOf(currentTheme.value)
  const nextIndex = (currentIndex + 1) % themes.length
  currentTheme.value = themes[nextIndex]

  // 应用主题
  applyTheme(currentTheme.value)

  // 保存到本地存储
  localStorage.setItem('acuity-theme', currentTheme.value)
}

// 应用主题到页面
const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement

  // 移除所有主题类
  root.classList.remove('theme-auto', 'theme-dark', 'theme-light')

  // 添加当前主题类
  root.classList.add(`theme-${theme}`)

  // 设置 CSS 变量
  if (theme === 'auto') {
    // 自动模式：跟随系统偏好
    root.style.colorScheme = ''
    root.removeAttribute('data-theme')
  } else if (theme === 'dark') {
    // 暗黑模式
    root.style.colorScheme = 'dark'
    root.setAttribute('data-theme', 'dark')
  } else if (theme === 'light') {
    // 明亮模式
    root.style.colorScheme = 'light'
    root.setAttribute('data-theme', 'light')
  }
}

// 初始化主题
const initializeTheme = () => {
  // 从本地存储读取保存的主题
  const savedTheme = localStorage.getItem('acuity-theme') as ThemeMode
  if (savedTheme && ['auto', 'dark', 'light'].includes(savedTheme)) {
    currentTheme.value = savedTheme
  } else {
    // 默认使用自动模式
    currentTheme.value = 'auto'
  }

  // 应用主题
  applyTheme(currentTheme.value)
}

// 监听系统主题变化（仅在自动模式下）
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const handleSystemThemeChange = () => {
  if (currentTheme.value === 'auto') {
    applyTheme('auto')
  }
}

onMounted(() => {
  initializeTheme()

  // 监听系统主题变化
  mediaQuery.addEventListener('change', handleSystemThemeChange)
})

// 清理监听器
import { onUnmounted } from 'vue'
onUnmounted(() => {
  mediaQuery.removeEventListener('change', handleSystemThemeChange)
})
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-base);
}

.theme-toggle:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-alpha-10);
}

.theme-toggle:active {
  /* 使用其他方式实现点击效果，避免使用 transform */
  opacity: 0.8;
}

/* 主题样式 */
.theme-auto {
  color-scheme: light dark;
}

.theme-dark {
  color-scheme: dark;
}

/* 为全局主题类设置样式 */
.theme-light {
  color-scheme: light;
}
</style>
