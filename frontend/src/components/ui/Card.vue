<!--
  AcuityCard - 卡片组件
  通用卡片布局组件，支持标题、内容、操作区域
-->
<template>
  <div 
    :class="cardClasses"
    @click="props.clickable ? $emit('click', $event) : undefined"
  >
    <!-- Header -->
    <header v-if="$slots.header || title" class="card__header">
      <slot name="header">
        <div class="card__title-section">
          <AcuityIcon 
            v-if="icon" 
            :name="icon" 
            :color="iconColor"
            class="card__icon" 
          />
          <h3 v-if="title" class="card__title">{{ title }}</h3>
          <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
        </div>
        
        <div v-if="$slots.actions" class="card__actions">
          <slot name="actions" />
        </div>
      </slot>
    </header>
    
    <!-- Body -->
    <div v-if="$slots.default" class="card__body">
      <slot />
    </div>
    
    <!-- Footer -->
    <footer v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AcuityIcon from './Icon.vue'

interface Props {
  // Content
  title?: string
  subtitle?: string
  icon?: string
  iconColor?: string
  
  // Appearance
  variant?: 'default' | 'outlined' | 'elevated'
  size?: 'sm' | 'md' | 'lg'
  
  // Layout
  padding?: boolean
  
  // States
  hover?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  padding: true
})

defineEmits<{
  click: [event: Event]
}>()

// Card classes
const cardClasses = computed(() => [
  'card',
  `card--${props.variant}`,
  `card--${props.size}`,
  {
    'card--no-padding': !props.padding,
    'card--hover': props.hover,
    'card--clickable': props.clickable
  }
])

// Export types
export type CardProps = Props
</script>

<style scoped>
.card {
  /* Base styles */
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

/* === Variants === */
.card--default {
  border: 1px solid var(--color-border);
}

.card--outlined {
  border: 2px solid var(--color-border);
}

.card--elevated {
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

/* === Sizes === */
.card--sm {
  --card-padding: var(--space-3);
  --card-gap: var(--space-2);
}

.card--md {
  --card-padding: var(--space-4);
  --card-gap: var(--space-3);
}

.card--lg {
  --card-padding: var(--space-6);
  --card-gap: var(--space-4);
}

/* === States === */
.card--hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.card--clickable {
  cursor: pointer;
  
  &:hover {
    border-color: var(--color-border-hover);
  }
  
  &:active {
    transform: translateY(0);
  }
}

.card--no-padding {
  --card-padding: 0;
}

/* === Header === */
.card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--card-gap);
  padding: var(--card-padding);
  padding-bottom: 0;
  min-height: 0; /* Allow flex shrinking */
}

.card__title-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0; /* Allow flex shrinking */
  flex: 1;
}

.card__icon {
  flex-shrink: 0;
}

.card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  min-width: 0; /* Allow text truncation */
}

.card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  margin-top: var(--space-1);
}

.card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* === Body === */
.card__body {
  flex: 1;
  padding: var(--card-padding);
  overflow-y: auto;
  min-height: 0; /* Allow flex shrinking */
}

/* When there's no header, remove top padding from body */
.card:not(:has(.card__header)) .card__body {
  padding-top: var(--card-padding);
}

/* When there's a header, reduce top padding of body */
.card:has(.card__header) .card__body {
  padding-top: var(--card-gap);
}

/* === Footer === */
.card__footer {
  padding: var(--card-padding);
  padding-top: 0;
  border-top: 1px solid var(--color-border);
  margin-top: var(--card-gap);
}

/* When body is empty, remove bottom padding */
.card:not(:has(.card__body)) .card__footer {
  padding-top: var(--card-gap);
  border-top: none;
  margin-top: 0;
}

/* === Responsive === */
@container (max-width: 400px) {
  .card__header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .card__title-section {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* === Focus Styles === */
.card--clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* === Loading State === */
.card--loading {
  pointer-events: none;
  opacity: 0.7;
}

.card--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: card-loading 1.5s infinite;
}

@keyframes card-loading {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>