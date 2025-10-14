<template>
  <div :class="appBarClasses">
    <div class="acuity-app-bar-content">
      <div class="acuity-app-bar-title">
        <slot name="title" />
      </div>

      <div class="acuity-app-bar-spacer"></div>

      <div class="acuity-app-bar-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface AppBarProps {
  flat?: boolean
  app?: boolean
  color?: 'primary' | 'secondary' | 'surface' | 'transparent'
  height?: number | string
  elevation?: 'none' | 'low' | 'medium' | 'high'
}

const props = withDefaults(defineProps<AppBarProps>(), {
  flat: true,
  app: true,
  color: 'surface',
  height: 64,
  elevation: 'low'
})

const appBarClasses = computed(() => [
  'acuity-app-bar',
  `acuity-app-bar--${props.color}`,
  `acuity-app-bar--elevation-${props.elevation}`,
  {
    'acuity-app-bar--flat': props.flat,
    'acuity-app-bar--app': props.app
  }
])

const appBarStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height
}))
</script>

<style scoped>
.acuity-app-bar {
  z-index: 1000;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  height: v-bind('appBarStyle.height');
  display: flex;
  align-items: center;
}

.acuity-app-bar--surface {
  background: var(--color-surface);
}

.acuity-app-bar--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.acuity-app-bar--secondary {
  background: var(--color-secondary);
  color: var(--color-secondary-foreground);
}

.acuity-app-bar--transparent {
  background: transparent;
  border-bottom: none;
}

.acuity-app-bar--flat {
  box-shadow: none;
}

.acuity-app-bar--elevation-none {
  box-shadow: none;
}

.acuity-app-bar--elevation-low {
  box-shadow: var(--shadow-sm);
}

.acuity-app-bar--elevation-medium {
  box-shadow: var(--shadow-md);
}

.acuity-app-bar--elevation-high {
  box-shadow: var(--shadow-lg);
}

.acuity-app-bar-content {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 var(--spacing-lg);
}

.acuity-app-bar-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.acuity-app-bar-spacer {
  flex: 1;
}

.acuity-app-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
</style>
