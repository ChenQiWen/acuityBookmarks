<template>
  <div :class="spacerClasses"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpacerProps } from './Spacer.d'

const props = withDefaults(defineProps<SpacerProps>(), {
  direction: 'horizontal'
})

const spacerClasses = computed(() => {
  const sizeClass = props.size ? `size-${props.size}` : undefined
  return ['acuity-spacer', `acuity-spacer--${props.direction}`, sizeClass]
})
</script>

<style scoped>
.acuity-spacer {
  flex-shrink: 0;
}

.acuity-spacer--horizontal {
  flex: 1;
  min-width: 0;
}

.acuity-spacer--vertical {
  flex: 1;
  min-height: 0;
}

.acuity-spacer--both {
  flex: 1;
}

/* 固定尺寸（通过类映射到设计系统 spacing token） */
.acuity-spacer.size-xs.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-xs);
  height: 1px;
}
.acuity-spacer.size-sm.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-sm);
  height: 1px;
}
.acuity-spacer.size-md.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-md);
  height: 1px;
}
.acuity-spacer.size-lg.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-lg);
  height: 1px;
}
.acuity-spacer.size-xl.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-xl);
  height: 1px;
}
.acuity-spacer.size-2xl.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-2xl);
  height: 1px;
}
.acuity-spacer.size-3xl.acuity-spacer--horizontal {
  flex: 0;
  width: var(--spacing-3xl);
  height: 1px;
}

.acuity-spacer.size-xs.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-xs);
  width: 1px;
}
.acuity-spacer.size-sm.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-sm);
  width: 1px;
}
.acuity-spacer.size-md.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-md);
  width: 1px;
}
.acuity-spacer.size-lg.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-lg);
  width: 1px;
}
.acuity-spacer.size-xl.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-xl);
  width: 1px;
}
.acuity-spacer.size-2xl.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-2xl);
  width: 1px;
}
.acuity-spacer.size-3xl.acuity-spacer--vertical {
  flex: 0;
  height: var(--spacing-3xl);
  width: 1px;
}

.acuity-spacer.size-xs.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-xs);
  height: var(--spacing-xs);
}
.acuity-spacer.size-sm.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-sm);
  height: var(--spacing-sm);
}
.acuity-spacer.size-md.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-md);
  height: var(--spacing-md);
}
.acuity-spacer.size-lg.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-lg);
  height: var(--spacing-lg);
}
.acuity-spacer.size-xl.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-xl);
  height: var(--spacing-xl);
}
.acuity-spacer.size-2xl.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-2xl);
  height: var(--spacing-2xl);
}
.acuity-spacer.size-3xl.acuity-spacer--both {
  flex: 0;
  width: var(--spacing-3xl);
  height: var(--spacing-3xl);
}
</style>
