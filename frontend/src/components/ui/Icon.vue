<!--
  AcuityIcon - 图标组件
  轻量级图标组件，支持Material Design Icons
-->
<template>
  <component :is="componentType" v-bind="componentProps" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import EmojiIcon from './EmojiIcon.vue'
import { paths, type MdiName } from '@/icons/mdi'

interface Props {
  // Icon name (MDI format: mdi-icon-name)
  name: string

  // Size variants
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number

  // Color (CSS color value or semantic color)
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

  // Rotation
  rotate?: number

  // Flip
  flipH?: boolean
  flipV?: boolean

  // Spin animation
  spin?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

// Decide SVG path by mapped mdi name
const isEmoji = computed(() => props.name.startsWith('emoji:'))
const normalizedName = computed<MdiName | string>(() => {
  if (isEmoji.value) return props.name
  return props.name.startsWith('mdi-') ? props.name : `mdi-${props.name}`
})
const svgPath = computed(
  () => (paths as any)[normalizedName.value] as string | undefined
)
const isSvg = computed(() => !!svgPath.value)

// Legacy font style no longer needed since we always return SvgIcon now.

const componentType = computed(() => (isEmoji.value ? EmojiIcon : SvgIcon))
const componentProps = computed(() => {
  if (isEmoji.value) {
    const ch = props.name.slice('emoji:'.length) || 'ℹ️'
    return {
      char: ch,
      size: props.size,
      color: props.color,
      spin: props.spin || /loading|sync/.test(ch),
      rotate: props.rotate,
      flipH: props.flipH,
      flipV: props.flipV
    }
  }
  const path = isSvg.value
    ? svgPath.value
    : (paths as any)['mdi-information-outline'] ||
      'M11,9H13V7H11M12,2A10,10 0 1,1 2,12A10,10 0 0,1 12,2M11,17H13V11H11'
  const autoSpin = /loading|sync|cached/.test(normalizedName.value)
  return {
    path,
    size: props.size,
    color: props.color,
    spin: props.spin || autoSpin,
    rotate: props.rotate,
    flipH: props.flipH,
    flipV: props.flipV
  }
})

// Export types
export type IconProps = Props
</script>

<style scoped>
.acuity-icon {
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
  user-select: none;
  transition: all var(--transition-fast);
}

/* === Size Variants === */
.acuity-icon--xs {
  font-size: 0.75rem; /* 12px */
}

.acuity-icon--sm {
  font-size: 1rem; /* 16px */
}

.acuity-icon--md {
  font-size: 1.25rem; /* 20px */
}

.acuity-icon--lg {
  font-size: 1.5rem; /* 24px */
}

.acuity-icon--xl {
  font-size: 2rem; /* 32px */
}

/* === Transformations === */
.acuity-icon--flip-h {
  transform: scaleX(-1);
}

.acuity-icon--flip-v {
  transform: scaleY(-1);
}

.acuity-icon--spin {
  animation: acuity-icon-spin 1s linear infinite;
}

@keyframes acuity-icon-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* === Semantic Colors === */
.acuity-icon--primary {
  color: var(--color-primary);
}

.acuity-icon--secondary {
  color: var(--color-text-secondary);
}

.acuity-icon--success {
  color: var(--color-success);
}

.acuity-icon--warning {
  color: var(--color-warning);
}

.acuity-icon--error {
  color: var(--color-error);
}

.acuity-icon--info {
  color: var(--color-info);
}
</style>
