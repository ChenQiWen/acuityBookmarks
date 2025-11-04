<!--
  AcuityCard - 卡片组件
  通用卡片布局组件，支持标题、内容、操作区域
-->
<template>
  <div
    :class="cardClasses"
    @click="props.clickable ? $emit('click', $event) : undefined"
  >
    <!-- Header -->
    <header v-if="$slots.header || title" class="card__header">
      <slot name="header">
        <div class="card__title-section">
          <Icon
            v-if="icon"
            :name="icon"
            :color="iconColor"
            class="card__icon"
          />
          <h3 v-if="title" class="card__title">{{ title }}</h3>
          <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
        </div>

        <div v-if="$slots.actions" class="card__actions">
          <slot name="actions" />
        </div>
      </slot>
    </header>

    <!-- Body -->
    <div v-if="$slots.default" class="card__body">
      <slot />
    </div>

    <!-- Footer -->
    <Transition :name="props.footerTransition">
      <footer
        v-if="(props.footerVisible ?? !!$slots.footer) && $slots.footer"
        class="card__footer"
      >
        <slot name="footer" />
      </footer>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@/components'
import type { CardProps, CardEmits } from './Card.d'

/**
 * 卡片默认属性设置，保障视觉与交互一致性。
 */
const props = withDefaults(defineProps<CardProps>(), {
  variant: 'default',
  size: 'md',
  padding: true,
  borderless: false,
  footerTransition: ''
})

defineEmits<CardEmits>()

// Card classes
/**
 * 根据属性生成卡片的样式类集合。
 */
const cardClasses = computed(() => [
  'card',
  `card--${props.variant}`,
  `card--${props.size}`,
  {
    'card--no-padding': !props.padding,
    'card--hover': props.hover,
    'card--clickable': props.clickable,
    'card--borderless': props.borderless
  }
])

// 类型已从 Card.types.ts 导入
</script>

<style scoped>
.card {
  /* Base styles */
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

/* === Variants === */
.card--default {
  border: 1px solid var(--color-border);
}

.card--outlined {
  border: 2px solid var(--color-border);
}

.card--elevated {
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

/* === Borderless === */
.card--borderless {
  border: none !important;
}

/* === Sizes === */
.card--sm {
  --card-padding: var(--space-3);
  --card-gap: var(--space-2);
}

.card--md {
  --card-padding: var(--space-4);
  --card-gap: var(--space-3);
}

.card--lg {
  --card-padding: var(--space-6);
  --card-gap: var(--space-4);
}

/* === States === */
.card--hover:hover {
  /* 无几何位移，仅使用阴影增强 */
  box-shadow: var(--shadow-lg);
}

.card--clickable {
  cursor: pointer;

  &:hover {
    border-color: var(--color-border-hover);
  }

  &:active {
    /* 按下态使用不改变布局的反馈 */
    opacity: 0.95;
  }
}

.card--no-padding {
  --card-padding: 0;
}

/* === Header === */
.card__header {
  width: 100%;
  display: flex;
  height: 65px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: var(--card-gap);
  padding: 0 var(--card-padding);
  min-height: 0; /* Allow flex shrinking */
  border-bottom: 1px solid var(--color-border);
}

.card__title-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0; /* Allow flex shrinking */
  flex: 1;
}

.card__icon {
  flex-shrink: 0;
}

.card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  min-width: 0; /* Allow text truncation */
}

.card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  margin-top: var(--space-1);
}

.card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* === Body === */
.card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* Allow flex shrinking */
}

/* When there's a header, reduce top padding of body */
.card:has(.card__header) .card__body {
  padding: var(--card-gap);
}

/* === Footer === */
.card__footer {
  /* padding: var(--card-padding); */
  border-top: 1px solid var(--color-border);
  /* margin-top: var(--card-gap); */
}

/* When body is empty, remove bottom padding */
.card:not(:has(.card__body)) .card__footer {
  padding-top: var(--card-gap);
  border-top: none;
  margin-top: 0;
}

/* === Responsive === */
@container (max-width: 400px) {
  .card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .card__title-section {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* === Focus Styles === */
.card--clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* === Loading State === */
.card--loading {
  pointer-events: none;
  opacity: 0.7;
}

.card--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
  animation: card-loading 1.5s infinite;
}

@keyframes card-loading {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* === Footer slide transition (可按需启用) === */
.card-footer-slide-enter-active,
.card-footer-slide-leave-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
  will-change: transform, opacity;
}
.card-footer-slide-enter-from {
  transform: translateY(12px);
  opacity: 0;
}
.card-footer-slide-leave-to {
  transform: translateY(12px);
  opacity: 0;
}
</style>
