<template>
  <div class="acuity-tabs">
    <div
      ref="tabsNavRef"
      :class="tabsClasses"
      tabindex="0"
      role="tablist"
      :aria-orientation="orientation"
      :aria-label="ariaLabel"
    >
      <button
        v-for="(tab, index) in tabs"
        :key="tab.value || index"
        v-memo="[tab.value, tab.label, activeTab]"
        :class="getTabClasses(tab.value || index)"
        :disabled="tab.disabled"
        role="tab"
        :aria-selected="activeTab === (tab.value || index)"
        :tabindex="activeTab === (tab.value || index) ? 0 : -1"
        @click="selectTab(tab.value || index)"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="tab-icon" />
        <span class="tab-text">{{ tab.text || tab.label }}</span>
      </button>
    </div>

    <div class="acuity-tabs-content">
      <slot :activeTab="activeTab" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@/components'

export interface TabItem {
  text?: string
  label?: string
  value?: string | number
  icon?: string
  disabled?: boolean
}

export interface TabsProps {
  modelValue?: string | number
  tabs?: TabItem[]
  grow?: boolean
  variant?: 'default' | 'pills' | 'underline'
  color?: 'primary' | 'secondary'
  ariaLabel?: string
  orientation?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<TabsProps>(), {
  tabs: () => [],
  grow: false,
  variant: 'underline',
  color: 'primary',
  orientation: 'horizontal'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  change: [value: string | number]
}>()

// 引用tabs容器
const tabsNavRef = ref<HTMLElement>()

const activeTab = computed(() => props.modelValue || props.tabs[0]?.value || 0)

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

const selectTab = (value: string | number) => {
  const tab = props.tabs.find(t => (t.value || props.tabs.indexOf(t)) === value)
  if (tab?.disabled) return

  emit('update:modelValue', value)
  emit('change', value)
}

// 键盘导航功能
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
  if (event.key === 'Tab') {
    handled = true
    if (event.shiftKey)
      selectTab(
        enabledTabs[prev()].value || props.tabs.indexOf(enabledTabs[prev()])
      )
    else
      selectTab(
        enabledTabs[next()].value || props.tabs.indexOf(enabledTabs[next()])
      )
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    handled = true
    selectTab(
      enabledTabs[next()].value || props.tabs.indexOf(enabledTabs[next()])
    )
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    handled = true
    selectTab(
      enabledTabs[prev()].value || props.tabs.indexOf(enabledTabs[prev()])
    )
  }

  if (handled) {
    event.preventDefault()
    event.stopPropagation()
  }
}

// 事件监听器管理
onMounted(() => {
  if (tabsNavRef.value) {
    tabsNavRef.value.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (tabsNavRef.value) {
    tabsNavRef.value.removeEventListener('keydown', handleKeydown)
  }
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
  outline: none;
}

/* 垂直方向：使用 column 堆叠 */
.acuity-tabs-nav[aria-orientation='vertical'] {
  flex-direction: column;
  border-bottom: none;
}

.acuity-tabs-nav:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
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
.acuity-tab:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

.acuity-tab--active {
  color: var(--color-primary);
}

.acuity-tab--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Underline variant */
.acuity-tabs-nav--underline .acuity-tab--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}
/* 垂直方向下的 active 指示（左边竖线） */
/* 垂直方向：由容器定义选中背景，不再使用左侧竖线 */

.acuity-tabs-nav--underline.acuity-tabs-nav--secondary
  .acuity-tab--active::after {
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
