<template>
  <span :class="computedClass">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger'
    size?: 'sm' | 'md'
    className?: string
  }>(),
  {
    variant: 'default',
    size: 'sm',
    className: ''
  }
)

const computedClass = computed(() => {
  return twMerge(
    clsx(
      'inline-flex items-center rounded-full font-medium transition-colors',
      {
        // Variants
        'bg-primary-500/10 text-primary-400 border border-primary-500/20':
          props.variant === 'default',
        'bg-transparent border border-border text-content-muted':
          props.variant === 'outline',
        'bg-green-500/10 text-green-400 border border-green-500/20':
          props.variant === 'success',
        'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20':
          props.variant === 'warning',
        'bg-red-500/10 text-red-400 border border-red-500/20':
          props.variant === 'danger',

        // Sizes
        'px-2.5 py-0.5 text-xs': props.size === 'sm',
        'px-3 py-1 text-sm': props.size === 'md'
      },
      props.className
    )
  )
})
</script>
