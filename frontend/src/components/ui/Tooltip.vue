<template>
  <div 
    class="acuity-tooltip-wrapper" 
    @mouseenter="show = true" 
    @mouseleave="show = false"
    @focus="show = true"
    @blur="show = false"
  >
    <slot :show="show" />
    
    <Teleport to="body">
      <Transition name="tooltip">
        <div
          v-if="show"
          ref="tooltipRef"
          :class="tooltipClasses"
          :style="tooltipStyle"
        >
          <div class="acuity-tooltip-content">
            <slot name="content">{{ text }}</slot>
          </div>
          <div class="acuity-tooltip-arrow" :style="arrowStyle"></div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'

export interface TooltipProps {
  text?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  delay?: number
  disabled?: boolean
  activator?: string
}

const props = withDefaults(defineProps<TooltipProps>(), {
  placement: 'top',
  delay: 300,
  disabled: false
})

const show = ref(false)
const tooltipRef = ref<HTMLElement>()
const position = ref({ x: 0, y: 0 })

const tooltipClasses = computed(() => [
  'acuity-tooltip',
  `acuity-tooltip--${props.placement}`,
  {
    'acuity-tooltip--disabled': props.disabled
  }
])

const tooltipStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`
}))

const arrowStyle = computed(() => {
  const placement = props.placement
  if (placement.includes('top')) {
    return { 
      top: '100%', 
      borderTopColor: 'var(--color-surface-inverse)',
      borderBottomColor: 'transparent'
    }
  } else if (placement.includes('bottom')) {
    return { 
      bottom: '100%', 
      borderBottomColor: 'var(--color-surface-inverse)',
      borderTopColor: 'transparent'
    }
  } else if (placement.includes('left')) {
    return { 
      left: '100%', 
      borderLeftColor: 'var(--color-surface-inverse)',
      borderRightColor: 'transparent'
    }
  } else if (placement.includes('right')) {
    return { 
      right: '100%', 
      borderRightColor: 'var(--color-surface-inverse)',
      borderLeftColor: 'transparent'
    }
  }
  return {}
})

// Simple positioning - in a real implementation you'd use a library like Floating UI
watch(show, (newShow) => {
  if (newShow && !props.disabled) {
    nextTick(() => {
      // Basic positioning logic
      position.value = { x: 100, y: 100 }
    })
  }
})
</script>

<style scoped>
.acuity-tooltip-wrapper {
  display: inline-block;
}

.acuity-tooltip {
  position: absolute;
  z-index: 10000;
  max-width: 300px;
  pointer-events: none;
}

.acuity-tooltip-content {
  background: var(--color-surface-inverse);
  color: var(--color-text-inverse);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.4;
  box-shadow: var(--shadow-lg);
}

.acuity-tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 6px solid transparent;
}

.acuity-tooltip--top .acuity-tooltip-arrow {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--color-surface-inverse);
}

.acuity-tooltip--bottom .acuity-tooltip-arrow {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: var(--color-surface-inverse);
}

.acuity-tooltip--left .acuity-tooltip-arrow {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: var(--color-surface-inverse);
}

.acuity-tooltip--right .acuity-tooltip-arrow {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: var(--color-surface-inverse);
}

/* Transitions */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tooltip-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.tooltip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>