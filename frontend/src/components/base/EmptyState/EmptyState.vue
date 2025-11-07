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
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-state__icon {
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state__title {
  margin-bottom: var(--space-2);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-state__description {
  max-width: 400px;
  margin-bottom: var(--space-4);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.empty-state__actions {
  margin-top: var(--space-4);
}
</style>
