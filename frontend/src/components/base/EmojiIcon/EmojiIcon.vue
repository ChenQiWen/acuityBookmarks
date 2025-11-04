<template>
  <span
    class="acuity-emoji"
    :class="classes"
    :style="styleObject"
    aria-hidden="true"
    >{{ char }}</span
  >
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import type { EmojiIconProps } from './EmojiIcon.d'

const props = withDefaults(defineProps<EmojiIconProps>(), {
  size: 'md'
})

const classes = computed(() =>
  [
    typeof props.size === 'number' ? undefined : `acuity-emoji--${props.size}`,
    props.color &&
    typeof props.color === 'string' &&
    [
      'primary',
      'secondary',
      'tertiary',
      'error',
      'warning',
      'success',
      'info',
      'muted'
    ].includes(props.color)
      ? `acuity-emoji--${props.color}`
      : undefined,
    props.flipH ? 'acuity-emoji--flip-h' : undefined,
    props.flipV ? 'acuity-emoji--flip-v' : undefined,
    props.spin ? 'acuity-emoji--spin' : undefined
  ].filter(Boolean)
)

const styleObject = computed(() => {
  const style: Record<string, string> = {
    lineHeight: '1',
    display: 'inline-block'
  }
  if (typeof props.size === 'number') {
    style.fontSize = `${props.size}px`
  }
  const transforms = [] as string[]
  if (props.rotate) transforms.push(`rotate(${props.rotate}deg)`)
  if (props.flipH) transforms.push('scaleX(-1)')
  if (props.flipV) transforms.push('scaleY(-1)')
  if (transforms.length) style.transform = transforms.join(' ')

  // custom color value (CSS var or hex/rgb)
  if (
    props.color &&
    typeof props.color === 'string' &&
    ![
      'primary',
      'secondary',
      'tertiary',
      'error',
      'warning',
      'success',
      'info',
      'muted'
    ].includes(props.color)
  ) {
    style.color = props.color
  }
  return style
})

const { char } = toRefs(props)
</script>

<style scoped>
.acuity-emoji {
  user-select: none;
  vertical-align: middle;
  transition: transform var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.acuity-emoji--xs {
  font-size: 12px;
}
.acuity-emoji--sm {
  font-size: 16px;
}
.acuity-emoji--md {
  font-size: 20px;
}
.acuity-emoji--lg {
  font-size: 24px;
}
.acuity-emoji--xl {
  font-size: 32px;
}

.acuity-emoji--flip-h {
  transform: scaleX(-1);
}
.acuity-emoji--flip-v {
  transform: scaleY(-1);
}
.acuity-emoji--spin {
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
  animation: acuity-emoji-spin 1s linear infinite;
}

@keyframes acuity-emoji-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* semantic colors */
.acuity-emoji--primary {
  color: var(--color-primary);
}
.acuity-emoji--secondary {
  color: var(--color-text-secondary);
}
.acuity-emoji--tertiary {
  color: var(--color-tertiary, var(--color-text-secondary));
}
.acuity-emoji--success {
  color: var(--color-success);
}
.acuity-emoji--warning {
  color: var(--color-warning);
}
.acuity-emoji--error {
  color: var(--color-error);
}
.acuity-emoji--info {
  color: var(--color-info);
}
.acuity-emoji--muted {
  color: var(--color-text-secondary);
}
</style>
