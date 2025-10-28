<!--
  空状态组件
  用于展示无数据、筛选无结果等空状态
-->
<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <Icon :name="icon" :size="iconSize" :color="iconColor" />
    </div>
    <div v-if="title" class="empty-state__title">{{ title }}</div>
    <div v-if="description" class="empty-state__description">
      {{ description }}
    </div>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@/components'
import type { EmptyStateProps } from './EmptyState.d'

defineOptions({ name: 'EmptyState' })

withDefaults(defineProps<EmptyStateProps>(), {
  icon: 'icon-folder',
  iconSize: 48,
  iconColor: 'muted'
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  min-height: 200px;
}

.empty-state__icon {
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.empty-state__description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 400px;
  line-height: 1.5;
  margin-bottom: var(--space-4);
}

.empty-state__actions {
  margin-top: var(--space-4);
}
</style>
