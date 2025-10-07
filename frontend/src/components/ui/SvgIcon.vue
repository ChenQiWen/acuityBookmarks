<template>
  <svg
    :width="computedSize"
    :height="computedSize"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    class="acuity-svg-icon"
    :class="[{ spin }, colorClass]"
    :style="[transformStyle, colorStyle]"
    v-bind="$attrs"
  >
    <path :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    path: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
    color?:
      | 'primary'
      | 'secondary'
      | 'tertiary'
      | 'error'
      | 'warning'
      | 'success'
      | 'info'
      | 'muted'
      | string
    spin?: boolean
    rotate?: number
    flipH?: boolean
    flipV?: boolean
  }>(),
  {
    size: 'md',
    spin: false
  }
)

const computedSize = computed(() => {
  if (typeof props.size === 'number') return props.size
  const map: Record<string, number> = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 }
  return map[props.size] ?? 20
})

const colorClass = computed(() => {
  const c = props.color
  if (!c) return undefined
  if (
    [
      'primary',
      'secondary',
      'tertiary',
      'error',
      'warning',
      'success',
      'info',
      'muted'
    ].includes(c)
  )
    return `acuity-svg-icon--${c}`
  return undefined
})

const transformStyle = computed(() => {
  const transforms: string[] = []
  if (props.flipH) transforms.push('scaleX(-1)')
  if (props.flipV) transforms.push('scaleY(-1)')
  if (props.rotate) transforms.push(`rotate(${props.rotate}deg)`)
  return transforms.length ? { transform: transforms.join(' ') } : undefined
})

const colorStyle = computed(() => {
  const c = props.color
  if (!c) return undefined
  // if semantic class handled above, skip inline
  if (
    [
      'primary',
      'secondary',
      'tertiary',
      'error',
      'warning',
      'success',
      'info',
      'muted'
    ].includes(c)
  )
    return undefined
  if (typeof c === 'string') {
    if (c.startsWith('--')) return { color: `var(${c})` }
    return { color: c }
  }
  return undefined
})
</script>

<style scoped>
.acuity-svg-icon {
  display: inline-block;
  vertical-align: middle;
}
.acuity-svg-icon.spin {
  animation: acuity-icon-spin 1s linear infinite;
}

.acuity-svg-icon--primary {
  color: var(--color-primary);
}
.acuity-svg-icon--secondary {
  color: var(--color-text-secondary);
}
.acuity-svg-icon--tertiary {
  color: var(--color-text-tertiary);
}
.acuity-svg-icon--error {
  color: var(--color-error);
}
.acuity-svg-icon--warning {
  color: var(--color-warning);
}
.acuity-svg-icon--success {
  color: var(--color-success);
}
.acuity-svg-icon--info {
  color: var(--color-info);
}

@keyframes acuity-icon-spin {
  from {
    transform: rotate(0);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
