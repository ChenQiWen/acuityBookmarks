<template>
  <div :class="computedClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'glass' | 'outline'
    hover?: boolean
    className?: string
  }>(),
  {
    variant: 'glass',
    hover: false,
    className: ''
  }
)

const computedClass = computed(() => {
  return twMerge(
    clsx(
      'rounded-2xl overflow-hidden transition-all duration-300',
      {
        'bg-bg-surface border border-border': props.variant === 'default',
        'bg-white/[0.02] border border-white/[0.05] backdrop-blur-md':
          props.variant === 'glass',
        'bg-transparent border border-border': props.variant === 'outline',

        'hover:border-primary-500/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-primary-500/5':
          props.hover
      },
      props.className
    )
  )
})
</script>
