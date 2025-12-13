<template>
  <div class="accordion-item">
    <div class="accordion-header" @click="handleToggle">
      <div class="accordion-title">
        <Icon v-if="icon" :name="icon" :size="iconSize" />
        <span>{{ title }}</span>
        <slot name="badge" />
      </div>
      <Icon
        :name="isExpanded ? 'icon-chevron-down' : 'icon-chevron-right'"
        :size="16"
        class="accordion-icon"
      />
    </div>
    <div v-if="isExpanded" class="accordion-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import Icon from '../Icon/Icon.vue'
import type { AccordionItemProps } from './Accordion.d'

defineOptions({
  name: 'AccordionItem'
})

const props = withDefaults(defineProps<AccordionItemProps>(), {
  iconSize: 16
})

// 从父组件注入
const accordion = inject<{
  toggleItem: (id: string) => void
  isItemExpanded: (id: string) => boolean
}>('accordion')

if (!accordion) {
  throw new Error('AccordionItem must be used within Accordion component')
}

// 计算是否展开
const isExpanded = computed(() => accordion.isItemExpanded(props.id))

// 处理点击
const handleToggle = () => {
  accordion.toggleItem(props.id)
}
</script>

<style scoped>
.accordion-item {
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid transparent;
  background-color: var(--md-sys-color-surface-container-low);
  cursor: pointer;
  transition:
    background-color var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard),
    border-color var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard);
}

.accordion-header:hover {
  background-color: var(--md-sys-color-surface-container);
}

.accordion-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.accordion-icon {
  color: var(--color-text-secondary);
  transition: transform var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.accordion-content {
  padding: var(--spacing-3) var(--spacing-4);
  background-color: var(--md-sys-color-surface);
  animation: accordion-expand var(--md-sys-motion-duration-medium1)
    var(--md-sys-motion-easing-emphasized);
}

@keyframes accordion-expand {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
