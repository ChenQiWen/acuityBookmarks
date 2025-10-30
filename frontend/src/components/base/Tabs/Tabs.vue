<template>
  <div class="acuity-tabs">
    <div
      ref="tabsNavRef"
      :class="tabsClasses"
      role="tablist"
      :aria-orientation="orientation"
      :aria-label="ariaLabel"
    >
      <button
        v-for="(tab, index) in tabs"
        :key="tab.value || index"
        :ref="setButtonRef(tab.value || index)"
        :class="getTabClasses(tab.value || index)"
        :disabled="tab.disabled"
        role="tab"
        :aria-selected="activeTab === (tab.value || index)"
        :tabindex="activeTab === (tab.value || index) ? 0 : -1"
        @click="selectTab(tab.value || index)"
        @keydown="handleKeydown"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="tab-icon" />
        <span class="tab-text">{{ tab.text || tab.label }}</span>
      </button>
      <!-- ✅ 滑动的下边框指示器（仅用于 underline 变体） -->
      <span
        v-if="props.variant === 'underline'"
        ref="indicatorRef"
        class="tab-indicator"
        :style="indicatorStyle"
      ></span>
    </div>

    <div class="acuity-tabs-content">
      <slot :activeTab="activeTab" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  watch,
  nextTick,
  ref,
  onMounted,
  type ComponentPublicInstance
} from 'vue'
import { Icon } from '@/components'
import type { TabsProps, TabsEmits } from './Tabs.d'

const props = withDefaults(defineProps<TabsProps>(), {
  tabs: () => [],
  grow: false,
  variant: 'underline',
  color: 'primary',
  orientation: 'horizontal'
})

const emit = defineEmits<TabsEmits>()

const activeTab = computed(() => props.modelValue || props.tabs[0]?.value || 0)

// 用于管理按钮引用
const tabButtonRefs = new Map<string | number, HTMLButtonElement>()

// ✅ 指示器相关的 refs 和状态
const tabsNavRef = ref<HTMLElement | null>(null)
const indicatorRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref({
  left: '0px',
  width: '0px'
})

// 注册按钮引用的回调
const setButtonRef =
  (value: string | number) =>
  (el: Element | ComponentPublicInstance | null) => {
    if (el && el instanceof HTMLElement) {
      tabButtonRefs.set(value, el as HTMLButtonElement)
    }
  }

const tabsClasses = computed(() => [
  'acuity-tabs-nav',
  `acuity-tabs-nav--${props.variant}`,
  `acuity-tabs-nav--${props.color}`,
  {
    'acuity-tabs-nav--grow': props.grow
  }
])

const getTabClasses = (value: string | number) => [
  'acuity-tab',
  {
    'acuity-tab--active': activeTab.value === value,
    'acuity-tab--disabled': props.tabs.find(
      t => (t.value || props.tabs.indexOf(t)) === value
    )?.disabled
  }
]

// ✅ 更新指示器位置和宽度
const updateIndicator = () => {
  if (props.variant !== 'underline') return

  const activeButtonEl = tabButtonRefs.get(activeTab.value)
  const navEl = tabsNavRef.value

  if (activeButtonEl && navEl) {
    const navRect = navEl.getBoundingClientRect()
    const buttonRect = activeButtonEl.getBoundingClientRect()

    indicatorStyle.value = {
      left: `${buttonRect.left - navRect.left}px`,
      width: `${buttonRect.width}px`
    }
  }
}

const selectTab = async (value: string | number) => {
  const tab = props.tabs.find(t => (t.value || props.tabs.indexOf(t)) === value)
  if (tab?.disabled) return

  emit('update:modelValue', value)
  emit('change', value)

  // 在下一个 tick 后将焦点设置到新的标签按钮
  await nextTick()
  const buttonEl = tabButtonRefs.get(value)
  if (buttonEl) {
    buttonEl.focus()
  }

  // ✅ 更新指示器位置
  updateIndicator()
}

// 键盘导航功能
// 支持两种模式：
// 1. Tab/Shift+Tab：在标签之间快速切换
// 2. 箭头键：也可以在标签之间切换
const handleKeydown = (event: KeyboardEvent) => {
  const enabledTabs = props.tabs.filter(tab => !tab.disabled)
  if (enabledTabs.length <= 1) return

  const currentIndex = enabledTabs.findIndex(
    tab => (tab.value || props.tabs.indexOf(tab)) === activeTab.value
  )

  const prev = () =>
    currentIndex <= 0 ? enabledTabs.length - 1 : currentIndex - 1
  const next = () =>
    currentIndex >= enabledTabs.length - 1 ? 0 : currentIndex + 1

  let handled = false
  let nextValue: string | number | undefined

  // ✅ Tab 键：在标签之间切换
  if (event.key === 'Tab') {
    handled = true
    // ⚠️ 先阻止事件传播，避免无限递归
    event.preventDefault()
    event.stopPropagation()

    if (event.shiftKey) {
      nextValue =
        enabledTabs[prev()].value || props.tabs.indexOf(enabledTabs[prev()])
    } else {
      nextValue =
        enabledTabs[next()].value || props.tabs.indexOf(enabledTabs[next()])
    }
  }
  // ✅ 箭头键：也可以在标签之间切换
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    handled = true
    event.preventDefault()
    event.stopPropagation()
    nextValue =
      enabledTabs[next()].value || props.tabs.indexOf(enabledTabs[next()])
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    handled = true
    event.preventDefault()
    event.stopPropagation()
    nextValue =
      enabledTabs[prev()].value || props.tabs.indexOf(enabledTabs[prev()])
  }

  if (handled && nextValue !== undefined) {
    // 在事件循环的下一个 tick 执行，确保当前事件已完全处理
    setTimeout(() => {
      selectTab(nextValue!)
    }, 0)
  }
}

// 事件监听器管理
// ✅ 已改为直接在按钮上使用 @keydown，无需手动管理监听器

// ✅ 监听 activeTab 变化，更新指示器位置
watch(activeTab, async () => {
  await nextTick()
  updateIndicator()
})

// ✅ 组件挂载后初始化指示器位置
onMounted(async () => {
  await nextTick()
  updateIndicator()
})

// Watch for external changes
watch(
  () => props.modelValue,
  newValue => {
    if (newValue !== undefined) {
      // Ensure the new value is valid
      const validTab = props.tabs.find(
        t => (t.value || props.tabs.indexOf(t)) === newValue
      )
      if (!validTab && props.tabs.length > 0) {
        emit('update:modelValue', props.tabs[0].value || 0)
      }
    }
  }
)
</script>

<style scoped>
.acuity-tabs {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.acuity-tabs-nav {
  display: flex;
  position: relative;
  border-bottom: 1px solid var(--color-border);
}

/* 垂直方向：使用 column 堆叠 */
.acuity-tabs-nav[aria-orientation='vertical'] {
  flex-direction: column;
  border-bottom: none;
}

.acuity-tabs-nav--grow {
  flex: 1;
}

.acuity-tabs-nav--grow .acuity-tab {
  flex: 1;
}

.acuity-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  transition: all var(--transition-base);
  position: relative;
  min-height: 48px;
}

.acuity-tabs-nav[aria-orientation='vertical'] .acuity-tab {
  justify-content: flex-start;
  width: 100%;
  padding: 10px 12px;
}

.acuity-tab:hover:not(.acuity-tab--disabled) {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
}

/* 键盘焦点样式 - 更优雅的设计 */
.acuity-tab:focus-visible {
  outline: none;
  box-shadow:
    inset 0 0 0 2px var(--color-primary),
    0 0 0 3px rgba(var(--color-primary-rgb, 0 122 255), 0.1);
  border-radius: var(--radius-md);
  z-index: 1;
}

.acuity-tab--active {
  color: var(--color-primary);
}

.acuity-tab--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Underline variant */
/* ✅ 移除静态的 ::after 伪元素，改用动态指示器 */
/* .acuity-tabs-nav--underline .acuity-tab--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
} */

/* ✅ 滑动指示器样式 */
.tab-indicator {
  position: absolute;
  bottom: -1px;
  height: 2px;
  background: var(--color-primary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 1;
}

/* 垂直方向下的 active 指示（左边竖线） */
/* 垂直方向：由容器定义选中背景，不再使用左侧竖线 */

.acuity-tabs-nav--underline.acuity-tabs-nav--secondary .tab-indicator {
  background: var(--color-secondary);
}

/* Pills variant */
.acuity-tabs-nav--pills {
  gap: var(--spacing-sm);
  border-bottom: none;
  padding: var(--spacing-sm);
  background: var(--color-surface-variant);
  border-radius: var(--radius-lg);
}

.acuity-tabs-nav--pills .acuity-tab {
  border-radius: var(--radius-md);
  min-height: 36px;
}

.acuity-tabs-nav--pills .acuity-tab--active {
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

/* Default variant */
.acuity-tabs-nav--default .acuity-tab {
  border: 1px solid var(--color-border);
  border-bottom: none;
  margin-right: -1px;
}

.acuity-tabs-nav--default .acuity-tab:first-child {
  border-top-left-radius: var(--radius-md);
}

.acuity-tabs-nav--default .acuity-tab:last-child {
  border-top-right-radius: var(--radius-md);
  margin-right: 0;
}

.acuity-tabs-nav--default .acuity-tab--active {
  background: var(--color-surface);
  border-bottom-color: var(--color-surface);
  z-index: 1;
}

.tab-icon {
  flex-shrink: 0;
}

.tab-text {
  white-space: nowrap;
}

.acuity-tabs-content {
  flex: 1;
  min-height: 0;
}
</style>
