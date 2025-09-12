<template>
  <div :class="spacerClasses" :style="spacerStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SpacerProps {
  size?: number | string
  direction?: 'horizontal' | 'vertical' | 'both'
}

const props = withDefaults(defineProps<SpacerProps>(), {
  direction: 'horizontal'
})

const spacerClasses = computed(() => [
  'acuity-spacer',
  `acuity-spacer--${props.direction}`
])

const spacerStyle = computed(() => {
  if (props.size) {
    const sizeValue = typeof props.size === 'number' ? `${props.size}px` : props.size
    
    switch (props.direction) {
      case 'horizontal':
        return { width: sizeValue, height: '1px' }
      case 'vertical':
        return { height: sizeValue, width: '1px' }
      case 'both':
        return { width: sizeValue, height: sizeValue }
      default:
        return {}
    }
  }
  return {}
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
</style>