<template>
  <svg
    :width="computedSize"
    :height="computedSize"
    :viewBox="resolvedViewBox"
    fill="currentColor"
    aria-hidden="true"
    class="acuity-svg-icon"
    :class="[{ spin }, colorClass]"
    :style="[transformStyle, colorStyle]"
    shape-rendering="geometricPrecision"
    v-bind="$attrs"
  >
    <path :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SvgIconProps } from './SvgIcon.d'

// Google Material Symbols 默认使用 24px 尺寸且坐标范围为 0 -960 960 960
const DEFAULT_VIEWBOX = '0 -960 960 960'

const props = withDefaults(defineProps<SvgIconProps>(), {
  size: 'md',
  spin: false
})

const computedSize = computed(() => {
  if (typeof props.size === 'number') return props.size
  const map: Record<string, number> = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 }
  return map[props.size] ?? 20
})

const resolvedViewBox = computed(() => props.viewBox ?? DEFAULT_VIEWBOX)

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
  /* 优化图标渲染，减少模糊 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 使用 GPU 加速 */
  transform: translateZ(0);
  will-change: transform;
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
