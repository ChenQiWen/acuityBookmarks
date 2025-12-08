<template>
  <div
    :class="itemClasses"
    :title="title"
    @click="handleClick"
  >
    <!-- Leading slot (icon, avatar, etc.) -->
    <div v-if="$slots.leading" class="list-item__leading">
      <slot name="leading" />
    </div>

    <!-- Content area -->
    <div class="list-item__content">
      <slot>
        <span v-if="label" class="list-item__label">{{ label }}</span>
      </slot>
      <span v-if="description" class="list-item__description">
        {{ description }}
      </span>
    </div>

    <!-- Trailing slot (actions, badges, etc.) -->
    <div v-if="$slots.trailing" class="list-item__trailing">
      <slot name="trailing" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'ListItem'
})

interface Props {
  /** 主文本 */
  label?: string
  /** 描述文本 */
  description?: string
  /** 悬浮提示 */
  title?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否激活状态 */
  active?: boolean
  /** 是否可点击 */
  clickable?: boolean
  /** 紧凑模式 */
  dense?: boolean
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  active: false,
  clickable: true,
  dense: false,
  size: 'md'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const itemClasses = computed(() => [
  'list-item',
  `list-item--${props.size}`,
  {
    'list-item--disabled': props.disabled,
    'list-item--active': props.active,
    'list-item--clickable': props.clickable && !props.disabled,
    'list-item--dense': props.dense
  }
])

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return
  emit('click', event)
}
</script>

<style scoped lang="scss">
.list-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-2-5);
  border-radius: var(--radius-sm);
  cursor: default;
  transition:
    background-color var(--transition-fast),
    opacity var(--transition-fast);

  &--sm {
    min-height: 32px;
    padding: var(--spacing-1) var(--spacing-2);
  }

  &--md {
    min-height: 40px;
    padding: var(--spacing-1-5) var(--spacing-2);
  }

  &--lg {
    min-height: 48px;
    padding: var(--spacing-2) var(--spacing-3);
  }

  &--dense {
    padding-top: var(--spacing-1);
    padding-bottom: var(--spacing-1);
  }

  &--clickable {
    cursor: pointer;

    &:hover {
      background-color: var(--color-surface-hover);
    }

    &:active {
      background-color: var(--color-surface-active);
    }
  }

  &--active {
    color: var(--color-primary);
    background-color: var(--color-primary-alpha-10);
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.list-item__leading {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
}

.list-item__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-0-5);
  min-width: 0;
}

.list-item__label {
  font-size: var(--text-sm);
  line-height: 1.4;
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-item__description {
  font-size: var(--text-xs);
  line-height: 1.3;
  white-space: nowrap;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-item__trailing {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-1);
  opacity: 0;
  transition: opacity var(--transition-fast);

  .list-item:hover & {
    opacity: 1;
  }
}
</style>
