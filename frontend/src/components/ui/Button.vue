<!--
  AcuityButton - 按钮组件
  高性能、可复用的按钮组件，支持多种变体和尺寸
-->
<template>
  <component
    :is="component"
    :class="buttonClasses"
    :disabled="disabled || loading"
    :type="component === 'button' ? type : undefined"
    :href="component === 'a' ? href : undefined"
    :target="component === 'a' ? target : undefined"
    v-bind="$attrs"
    @click="handleClick"
  >
    <!-- Loading State -->
    <div v-if="loading" class="btn__spinner">
      <div class="btn__spinner-icon"></div>
    </div>
    
    <!-- Icon (Left) -->
    <AcuityIcon 
      v-if="iconLeft && !loading" 
      :name="iconLeft" 
      :size="iconSize"
      class="btn__icon btn__icon--left" 
    />
    
    <!-- Content -->
    <span v-if="$slots.default" class="btn__content">
      <slot />
    </span>
    
    <!-- Icon (Right) -->
    <AcuityIcon 
      v-if="iconRight" 
      :name="iconRight" 
      :size="iconSize"
      class="btn__icon btn__icon--right" 
    />
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import AcuityIcon from './Icon.vue';

interface Props {
  // Variants
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text'
  size?: 'sm' | 'md' | 'lg'
  
  // States
  disabled?: boolean
  loading?: boolean
  
  // Icons
  iconLeft?: string
  iconRight?: string
  
  // Behavior
  block?: boolean
  
  // Component type
  component?: 'button' | 'a'
  type?: 'button' | 'submit' | 'reset'
  href?: string
  target?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  component: 'button',
  type: 'button'
});

const emit = defineEmits<{
  click: [event: Event]
}>();

// Computed Classes
const slots = useSlots();

const buttonClasses = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  {
    'btn--block': props.block,
    'btn--loading': props.loading,
    'btn--disabled': props.disabled,
    'btn--icon-only': !slots.default && (props.iconLeft || props.iconRight)
  }
]);

// Icon size based on button size
const iconSize = computed((): 'sm' | 'md' | 'lg' => {
  const sizeMap: Record<string, 'sm' | 'md' | 'lg'> = {
    sm: 'sm',
    md: 'md', 
    lg: 'lg'
  };
  return sizeMap[props.size] || 'md';
});

// Click handler
const handleClick = (event: Event) => {
  if (props.disabled || props.loading) {
    event.preventDefault();
    return;
  }
  emit('click', event);
};

// Export types
export type ButtonProps = Props
</script>

<style scoped>
.btn {
  /* Base styles */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
  
  /* Focus styles */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

/* === Size Variants === */
.btn--sm {
  height: var(--button-height-sm);
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
  min-width: var(--button-height-sm);
}

.btn--md {
  height: var(--button-height-md);
  padding: 0 var(--space-4);
  font-size: var(--font-size-base);
  min-width: var(--button-height-md);
}

.btn--lg {
  height: var(--button-height-lg);
  padding: 0 var(--space-6);
  font-size: var(--font-size-lg);
  min-width: var(--button-height-lg);
}

/* === Color Variants === */
.btn--primary {
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  border-color: var(--color-primary);
  
  &:hover:not(.btn--disabled):not(.btn--loading) {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }
  
  &:active:not(.btn--disabled):not(.btn--loading) {
    background-color: var(--color-primary-active);
    border-color: var(--color-primary-active);
  }
}

.btn--secondary {
  background-color: var(--color-secondary);
  color: var(--color-text-on-primary);
  border-color: var(--color-secondary);
  
  &:hover:not(.btn--disabled):not(.btn--loading) {
    background-color: var(--color-secondary-hover);
    border-color: var(--color-secondary-hover);
    color: var(--color-text-on-primary);
  }
  
  &:active:not(.btn--disabled):not(.btn--loading) {
    background-color: var(--color-secondary-active);
    border-color: var(--color-secondary-active);
    color: var(--color-text-on-primary);
  }
}

.btn--outline {
  background-color: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
  
  &:hover:not(.btn--disabled):not(.btn--loading) {
    background-color: var(--color-primary);
    color: var(--color-text-on-primary);
  }
}

.btn--ghost {
  background-color: transparent;
  color: var(--color-primary);
  border-color: transparent;
  
  &:hover:not(.btn--disabled):not(.btn--loading) {
    background-color: var(--color-surface-hover);
  }
}

.btn--text {
  background-color: transparent;
  color: var(--color-primary);
  border-color: transparent;
  
  &:hover:not(.btn--disabled):not(.btn--loading) {
    text-decoration: underline;
  }
}

/* === States === */
.btn--disabled {
  cursor: not-allowed;
  opacity: 0.6;
  pointer-events: none;
}

.btn--loading {
  cursor: wait;
  pointer-events: none;
}

.btn--block {
  width: 100%;
}

.btn--icon-only {
  padding: 0;
  aspect-ratio: 1;
}

/* === Icons === */
.btn__icon {
  flex-shrink: 0;
}

.btn__icon--left {
  margin-left: calc(var(--space-1) * -1);
}

.btn__icon--right {
  margin-right: calc(var(--space-1) * -1);
}

/* === Loading Spinner === */
.btn__spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn__spinner-icon {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* === Content === */
.btn__content {
  display: flex;
  align-items: center;
  gap: inherit;
}

/* === Loading state content visibility === */
.btn--loading .btn__content,
.btn--loading .btn__icon {
  opacity: 0;
}
</style>
