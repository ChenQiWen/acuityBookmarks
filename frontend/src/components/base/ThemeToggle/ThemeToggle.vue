<!--
  主题切换组件
  - 支持暗黑/明亮两种模式
  - 点击切换，使用 SVG 图标表示
  - 可独立使用，不依赖特定页面结构
-->
<template>
  <Button
    ref="toggleBtnRef"
    variant="ghost"
    borderless
    class="theme-toggle"
    :title="nextThemeTooltip"
    :aria-label="nextThemeTooltip"
    @click="handleClick"
  >
    <Icon :name="nextThemeIcon" :size="18" />
  </Button>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import {
  globalStateManager,
  type ThemeMode
} from '@/infrastructure/global-state/global-state-manager'
import Icon from '@/components/base/Icon/Icon.vue'
import Button from '@/components/base/Button/Button.vue'

// 当前主题状态（从全局状态管理器获取）
const currentTheme = ref<ThemeMode>('light')

// 按钮引用（用于获取点击位置）
const toggleBtnRef = ref<InstanceType<typeof Button> | null>(null)

// 系统主题变化监听器（MediaQueryList）
let systemThemeQuery: MediaQueryList | null = null

// 计算下一个主题的图标
const nextThemeIcon = computed(() =>
  currentTheme.value === 'dark' ? 'icon-light' : 'icon-dark'
)

const nextThemeTooltip = computed(() => {
  return currentTheme.value === 'dark'
    ? '点击切换到明亮主题'
    : '点击切换到暗黑主题'
})

// 点击处理函数
const handleClick = (event: Event) => {
  logger.info('ThemeToggle', '按钮被点击')
  toggleTheme(event as MouseEvent)
}

/**
 * 获取圆形扩散动画的参数
 * @param x 点击位置 X
 * @param y 点击位置 Y
 * @returns 覆盖整个页面所需的最大半径
 */
const getCircleRadius = (x: number, y: number): number => {
  // 计算从点击位置到页面四个角的距离，取最大值
  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  return Math.hypot(maxX, maxY)
}

// 主题切换逻辑 - 只在暗黑和明亮之间切换
const toggleTheme = async (event?: MouseEvent) => {
  // 只有两种主题：暗黑和明亮
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark'
  const isDark = newTheme === 'dark'

  logger.info('ThemeToggle', '开始切换主题', {
    current: currentTheme.value,
    next: newTheme
  })

  // 获取点击位置（用于圆形扩散动画）
  let x = window.innerWidth - 50 // 默认右上角
  let y = 50
  if (event) {
    x = event.clientX
    y = event.clientY
  } else if (toggleBtnRef.value?.$el) {
    const rect = toggleBtnRef.value.$el.getBoundingClientRect()
    x = rect.left + rect.width / 2
    y = rect.top + rect.height / 2
  }

  // 检查是否支持 View Transitions API
  const isViewTransitionSupported =
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (isViewTransitionSupported) {
    // 使用 View Transitions API 实现圆形扩散动画
    const radius = getCircleRadius(x, y)
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${radius}px at ${x}px ${y}px)`
    ]

    // 设置 CSS 变量供动画使用
    document.documentElement.style.setProperty('--theme-transition-x', `${x}px`)
    document.documentElement.style.setProperty('--theme-transition-y', `${y}px`)

    const transition = (document as unknown as { startViewTransition: (cb: () => void) => { ready: Promise<void> } }).startViewTransition(() => {
      currentTheme.value = newTheme
      applyTheme(newTheme)
    })

    transition.ready.then(() => {
      // 暗黑模式：新视图从小圆扩散到大圆
      // 明亮模式：旧视图从大圆收缩到小圆
      document.documentElement.animate(
        {
          clipPath: isDark ? clipPath : [...clipPath].reverse()
        },
        {
          duration: 400,
          easing: 'ease-out',
          // 保持动画结束状态，避免闪烁
          fill: 'forwards',
          pseudoElement: isDark
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)'
        }
      )
    })
  } else {
    // 不支持 View Transitions，直接切换
    currentTheme.value = newTheme
    applyTheme(newTheme)
  }

  try {
    // 使用全局状态管理器设置主题（异步，不阻塞UI）
    await globalStateManager.setTheme(newTheme)
    logger.info('ThemeToggle', '全局状态管理器设置成功')
  } catch (error) {
    logger.error('ThemeToggle', '全局状态管理器设置失败，但UI已更新', error)
    // 全局状态管理器失败不影响用户体验，UI已经更新了
  }

  logger.info('ThemeToggle', `主题已切换: ${currentTheme.value} -> ${newTheme}`)
}

// 应用主题到页面 - 只处理暗黑和明亮两种主题
const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement

  // 移除所有主题类
  root.classList.remove('theme-dark', 'theme-light')

  // 添加当前主题类
  root.classList.add(`theme-${theme}`)

  // 设置主题属性
  if (theme === 'dark') {
    // 暗黑模式
    root.style.colorScheme = 'dark'
    root.setAttribute('data-theme', 'dark')
  } else if (theme === 'light') {
    // 明亮模式
    root.style.colorScheme = 'light'
    root.setAttribute('data-theme', 'light')
  }
}

// 系统主题变化处理函数
const handleSystemThemeChange = async (e: MediaQueryListEvent) => {
  try {
    // 检查是否开启了自动跟随系统主题
    await globalStateManager.initialize()
    const autoFollow = globalStateManager.getAutoFollowSystemTheme()

    if (!autoFollow) {
      logger.debug('ThemeToggle', '未开启自动跟随系统主题，忽略系统主题变化')
      return
    }

    // 根据系统主题设置
    const systemTheme: ThemeMode = e.matches ? 'dark' : 'light'
    logger.info('ThemeToggle', '检测到系统主题变化，自动跟随', {
      systemTheme,
      previousTheme: currentTheme.value
    })

    // 更新主题
    currentTheme.value = systemTheme
    applyTheme(systemTheme)

    // 保存到全局状态管理器
    await globalStateManager.setTheme(systemTheme)
  } catch (error) {
    logger.error('ThemeToggle', '处理系统主题变化失败', error)
  }
}

// 启动系统主题监控
const startSystemThemeMonitoring = () => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    logger.warn('ThemeToggle', '当前环境不支持系统主题监控')
    return
  }

  try {
    // 创建媒体查询以监听系统主题
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')

    // 添加监听器
    if (systemThemeQuery.addEventListener) {
      systemThemeQuery.addEventListener('change', handleSystemThemeChange)
      logger.info('ThemeToggle', '系统主题监控已启动')
    } else {
      // 兼容旧版浏览器
      systemThemeQuery.addListener(handleSystemThemeChange)
      logger.info('ThemeToggle', '系统主题监控已启动（兼容模式）')
    }
  } catch (error) {
    logger.error('ThemeToggle', '启动系统主题监控失败', error)
  }
}

// 停止系统主题监控
const stopSystemThemeMonitoring = () => {
  if (!systemThemeQuery) return

  try {
    if (systemThemeQuery.removeEventListener) {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange)
    } else {
      // 兼容旧版浏览器
      systemThemeQuery.removeListener(handleSystemThemeChange)
    }
    logger.info('ThemeToggle', '系统主题监控已停止')
    systemThemeQuery = null
  } catch (error) {
    logger.error('ThemeToggle', '停止系统主题监控失败', error)
  }
}

// 初始化主题 - 只处理暗黑和明亮两种主题
const initializeTheme = async () => {
  try {
    logger.info('ThemeToggle', '开始初始化主题...')

    // 立即设置默认值，确保UI尽快显示
    currentTheme.value = 'light' // 默认使用明亮主题
    applyTheme('light')

    try {
      // 尝试从全局状态管理器获取保存的主题
      await globalStateManager.initialize()
      const savedTheme = globalStateManager.getTheme()
      const autoFollow = globalStateManager.getAutoFollowSystemTheme()
      logger.info('ThemeToggle', '全局状态管理器初始化完成，获取到保存的主题', {
        savedTheme,
        autoFollow
      })

      // 如果开启了自动跟随系统主题，则使用系统主题
      if (autoFollow && typeof window !== 'undefined' && window.matchMedia) {
        const systemThemeQuery = window.matchMedia(
          '(prefers-color-scheme: dark)'
        )
        const systemTheme: ThemeMode = systemThemeQuery.matches
          ? 'dark'
          : 'light'
        currentTheme.value = systemTheme
        applyTheme(systemTheme)
        logger.info('ThemeToggle', '使用系统主题（自动跟随已开启）', {
          theme: systemTheme
        })
      } else if (['dark', 'light'].includes(savedTheme)) {
        currentTheme.value = savedTheme
        applyTheme(savedTheme)
        logger.info('ThemeToggle', '使用保存的主题', { theme: savedTheme })
      } else {
        logger.info('ThemeToggle', '保存的主题无效，使用默认明亮主题', {
          savedTheme,
          default: 'light'
        })
      }
    } catch (globalStateError) {
      logger.warn(
        'ThemeToggle',
        '全局状态管理器初始化失败，使用默认明亮主题',
        globalStateError
      )
      // 全局状态管理器失败不影响组件正常工作，已经设置了默认主题
    }

    logger.info('ThemeToggle', '主题初始化完成', { theme: currentTheme.value })
  } catch (error) {
    logger.error('ThemeToggle', '主题初始化完全失败，使用默认明亮主题', error)
    currentTheme.value = 'light'
    applyTheme(currentTheme.value)
  }
}

onMounted(async () => {
  try {
    // 初始化全局状态管理器
    await globalStateManager.initialize()

    // 初始化主题（先获取当前主题）
    await initializeTheme()

    // 根据初始设置决定是否启动系统主题监控
    try {
      const autoFollow = globalStateManager.getAutoFollowSystemTheme()
      if (autoFollow) {
        startSystemThemeMonitoring()
      }
    } catch (error) {
      logger.error('ThemeToggle', '检查自动跟随系统主题设置失败', error)
    }
  } catch (error) {
    logger.error('ThemeToggle', '组件挂载失败', error)
  }
})

// 清理监听器
onUnmounted(() => {
  // 清理系统主题监听器
  stopSystemThemeMonitoring()
})
</script>

<style scoped>
.theme-toggle {
  padding: 0;
}
</style>
