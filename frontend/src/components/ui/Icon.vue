<!--
  AcuityIcon - 图标组件
  轻量级图标组件，支持Material Design Icons
-->
<template>
  <i 
    :class="iconClasses"
    :style="iconStyles"
    v-bind="$attrs"
  ></i>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

interface Props {
  // Icon name (MDI format: mdi-icon-name)
  name: string
  
  // Size variants
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  
  // Color (CSS color value or semantic color)
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'warning' | 'success' | 'info' | 'muted' | string
  
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

// Icon classes
const iconClasses = computed(() => {
  // 智能处理图标名称：如果已经包含 mdi- 前缀，则去掉重复
  const iconName = props.name.startsWith('mdi-') ? props.name : `mdi-${props.name}`
  
  return [
    'acuity-icon',
    `mdi ${iconName}`,
    {
      [`acuity-icon--${props.size}`]: typeof props.size === 'string',
      'acuity-icon--spin': props.spin,
      'acuity-icon--flip-h': props.flipH,
      'acuity-icon--flip-v': props.flipV
    }
  ]
})

// Icon styles
const iconStyles = computed((): CSSProperties => {
  const styles: CSSProperties = {}
  
  // Custom size (number)
  if (typeof props.size === 'number') {
    styles.fontSize = `${props.size}px`
  }
  
  // Color
  if (props.color) {
    // Check if it's a semantic color (starts with --)
    if (props.color.startsWith('--')) {
      styles.color = `var(${props.color})`
    } 
    // Check if it's a predefined semantic color name
    else if (['primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info', 'muted'].includes(props.color)) {
      // Map muted to secondary for backwards compatibility
      const colorMap: Record<string, string> = {
        muted: 'var(--color-text-secondary)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-text-secondary)',
        tertiary: 'var(--color-text-tertiary)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
        success: 'var(--color-success)',
        info: 'var(--color-info)'
      }
      styles.color = colorMap[props.color] || props.color
    }
    // Direct color value (hex, rgb, etc.)
    else {
      styles.color = props.color
    }
  }
  
  // Rotation
  if (props.rotate) {
    styles.transform = `rotate(${props.rotate}deg)`
  }
  
  return styles
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