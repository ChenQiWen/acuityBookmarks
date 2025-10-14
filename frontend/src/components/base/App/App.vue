<template>
  <div :class="appClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface AppProps {
  theme?: 'light' | 'dark' | 'auto'
  fullHeight?: boolean
}

const props = withDefaults(defineProps<AppProps>(), {
  theme: 'light',
  fullHeight: true
})

const appClasses = computed(() => [
  'acuity-app',
  `acuity-app--theme-${props.theme}`,
  {
    'acuity-app--full-height': props.fullHeight
  }
])
</script>

<style scoped>
.acuity-app {
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  line-height: var(--line-height-base);
}

.acuity-app--full-height {
  min-height: 100vh;
  height: 100vh;
}

.acuity-app--theme-light {
  /* Light theme variables are set in tokens.css */
}

.acuity-app--theme-dark {
  /* Dark theme implementation would go here */
  filter: invert(1) hue-rotate(180deg);
}

/* Global app styles */
.acuity-app * {
  box-sizing: border-box;
}

.acuity-app img,
.acuity-app svg {
  max-width: 100%;
  height: auto;
}
</style>
