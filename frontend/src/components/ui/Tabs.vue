<template>
  <div class="acuity-tabs">
    <div :class="tabsClasses">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.value || index"
        :class="getTabClasses(tab.value || index)"
        @click="selectTab(tab.value || index)"
        :disabled="tab.disabled"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="tab-icon" />
        <span class="tab-text">{{ tab.text || tab.label }}</span>
      </button>
    </div>
    
    <div class="acuity-tabs-content">
      <slot :active-tab="activeTab" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import Icon from './Icon.vue'

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
}

const props = withDefaults(defineProps<TabsProps>(), {
  tabs: () => [],
  grow: false,
  variant: 'underline',
  color: 'primary'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  change: [value: string | number]
}>()

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
    'acuity-tab--disabled': props.tabs.find(t => (t.value || props.tabs.indexOf(t)) === value)?.disabled
  }
]

const selectTab = (value: string | number) => {
  const tab = props.tabs.find(t => (t.value || props.tabs.indexOf(t)) === value)
  if (tab?.disabled) return
  
  emit('update:modelValue', value)
  emit('change', value)
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== undefined) {
    // Ensure the new value is valid
    const validTab = props.tabs.find(t => (t.value || props.tabs.indexOf(t)) === newValue)
    if (!validTab && props.tabs.length > 0) {
      emit('update:modelValue', props.tabs[0].value || 0)
    }
  }
})
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

.acuity-tab:hover:not(.acuity-tab--disabled) {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
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

.acuity-tabs-nav--underline.acuity-tabs-nav--secondary .acuity-tab--active::after {
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