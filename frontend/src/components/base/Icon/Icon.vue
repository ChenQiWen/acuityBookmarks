<!--
  Icon - 图标组件
  轻量级图标组件，支持Material Design Icons
-->
<template>
  <component :is="componentType" v-bind="componentProps" />
</template>

<script setup lang="ts">
defineOptions({
  name: 'Icon'
})
import { computed } from 'vue'
import SvgIcon from '../SvgIcon/SvgIcon.vue'
import EmojiIcon from '../EmojiIcon/EmojiIcon.vue'
import { icons, type MaterialIconName } from '@/icons/mdi'
import type { IconProps } from './Icon.d'

// const DEFAULT_ICON_PATH =
//   'M11,9H13V7H11M12,2A10,10 0 1,1 2,12A10,10 0 0,1 12,2M11,17H13V11H11'

/**
 * 组件接收的属性集合，默认设置图标尺寸为中号。
 * @constant
 */
const props = withDefaults(defineProps<IconProps>(), {
  size: 'md'
})

/**
 * 标记当前图标名称是否以 emoji: 前缀开头，用于区分 Emoji 图标与 SVG 图标。
 * @constant
 */
const isEmoji = computed(() => props.name.startsWith('emoji:'))
/**
 * 规范化后的图标名称，始终保证为 icon- 前缀或原始 emoji 名称。
 * @constant
 */
const normalizedName = computed<MaterialIconName | string>(() => {
  if (isEmoji.value) return props.name
  return props.name.startsWith('icon-')
    ? (props.name as MaterialIconName | string)
    : (`icon-${props.name}` as MaterialIconName | string)
})
/**
 * 根据规范化名称查找对应 SVG path，若找不到则返回 undefined。
 * @constant
 */
const svgPath = computed<string | undefined>(() => {
  if (isEmoji.value) return undefined
  const name = normalizedName.value
  if (typeof name !== 'string') return undefined
  return icons[name as MaterialIconName]
})

// Legacy font style no longer needed since we always return SvgIcon now.

/**
 * 根据是否为 Emoji 图标选择渲染组件（EmojiIcon 或 SvgIcon）。
 * @constant
 */
const componentType = computed(() => (isEmoji.value ? EmojiIcon : SvgIcon))
/**
 * 组装渲染所需的属性对象，包含颜色、旋转、翻转等展示参数。
 * @constant
 */
const componentProps = computed(() => {
  const path = svgPath.value
  return {
    name: normalizedName.value,
    path,
    size: props.size,
    color: props.color,
    spin: props.spin,
    rotate: props.rotate,
    flipH: props.flipH,
    flipV: props.flipV
  }
})
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
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
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
