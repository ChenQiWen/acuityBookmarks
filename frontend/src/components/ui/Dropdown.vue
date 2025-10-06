<template>
  <div class="acuity-dropdown" ref="dropdownRef">
    <div @click="toggle" class="acuity-dropdown-trigger">
      <slot name="trigger" :show="show" :toggle="toggle" />
    </div>
    
    <Transition name="dropdown">
      <div
        v-if="show"
        :class="dropdownContentClasses"
        :style="contentStyle"
        @click="handleContentClick"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';

export interface DropdownProps {
  modelValue?: boolean
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'bottom-start' | 'bottom-end'
  offset?: number
  closeOnClickOutside?: boolean
  closeOnContentClick?: boolean
}

const props = withDefaults(defineProps<DropdownProps>(), {
  placement: 'bottom',
  offset: 8,
  closeOnClickOutside: true,
  closeOnContentClick: false
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>();

const show = ref(props.modelValue || false);
const dropdownRef = ref<HTMLElement>();

const dropdownContentClasses = computed(() => [
  'acuity-dropdown-content',
  `acuity-dropdown-content--${props.placement}`
]);

const contentStyle = computed(() => {
  const {offset} = props;
  
  switch (props.placement) {
    case 'bottom':
    case 'bottom-start':
    case 'bottom-end':
      return { top: `calc(100% + ${offset}px)` };
    case 'top':
      return { bottom: `calc(100% + ${offset}px)` };
    case 'left':
      return { right: `calc(100% + ${offset}px)` };
    case 'right':
      return { left: `calc(100% + ${offset}px)` };
    default:
      return { top: `calc(100% + ${offset}px)` };
  }
});

const toggle = () => {
  show.value = !show.value;
  emit('update:modelValue', show.value);
  
  if (show.value) {
    emit('open');
  } else {
    emit('close');
  }
};

const close = () => {
  if (show.value) {
    show.value = false;
    emit('update:modelValue', false);
    emit('close');
  }
};

const handleContentClick = () => {
  if (props.closeOnContentClick) {
    close();
  }
};

const handleClickOutside = (event: MouseEvent) => {
  if (!props.closeOnClickOutside) return;
  
  const target = event.target as Node;
  if (dropdownRef.value && !dropdownRef.value.contains(target)) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.acuity-dropdown {
  position: relative;
  display: inline-block;
}

.acuity-dropdown-trigger {
  cursor: pointer;
}

.acuity-dropdown-content {
  position: absolute;
  z-index: 1000;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  max-width: 320px;
  overflow: hidden;
}

/* Placement */
.acuity-dropdown-content--bottom {
  left: 0;
}

.acuity-dropdown-content--bottom-start {
  left: 0;
}

.acuity-dropdown-content--bottom-end {
  right: 0;
}

.acuity-dropdown-content--top {
  left: 0;
}

.acuity-dropdown-content--left {
  top: 0;
}

.acuity-dropdown-content--right {
  top: 0;
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  transform-origin: top;
}

.dropdown-enter-from {
  opacity: 0;
  transform: scaleY(0.8) translateY(var(--spacing-sm));
}

.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.8) translateY(var(--spacing-sm));
}
</style>
