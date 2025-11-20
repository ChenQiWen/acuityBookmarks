<template>
  <component
    :is="as"
    :class="computedClass"
    v-bind="$attrs"
    :disabled="disabled || loading"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link'
    size?: 'sm' | 'md' | 'lg'
    as?: string | object
    loading?: boolean
    disabled?: boolean
    block?: boolean
    className?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    as: 'button',
    loading: false,
    disabled: false,
    block: false,
    className: ''
  }
)

const computedClass = computed(() => {
  return twMerge(
    clsx(
      'inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-depth disabled:opacity-50 disabled:cursor-not-allowed',
      {
        // Variants
        'bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white shadow-lg shadow-primary-500/20 border-0':
          props.variant === 'primary',
        'bg-white/10 hover:bg-white/15 text-white border border-white/10 backdrop-blur-sm':
          props.variant === 'secondary',
        'border border-primary-500/30 text-primary-400 hover:bg-primary-500/10':
          props.variant === 'outline',
        'text-content-muted hover:text-white hover:bg-white/5':
          props.variant === 'ghost',
        'text-primary-400 hover:text-primary-300 underline-offset-4 hover:underline p-0':
          props.variant === 'link',

        // Sizes
        'px-3 py-1.5 text-xs': props.size === 'sm',
        'px-6 py-2.5 text-sm': props.size === 'md',
        'px-8 py-3.5 text-base': props.size === 'lg',

        // Block
        'w-full': props.block
      },
      props.className
    )
  )
})
</script>
