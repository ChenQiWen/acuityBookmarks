<template>
  <main :class="mainClasses">
    <slot />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MainProps } from './Main.d'

const props = withDefaults(defineProps<MainProps>(), {
  withAppBar: false,
  appBarHeight: 64,
  padding: true,
  centered: false,
  maxWidth: '1200px',
  background: 'transparent',
  fullHeight: false
})

const mainClasses = computed(() => [
  'acuity-main',
  {
    'acuity-main--with-app-bar': props.withAppBar,
    'acuity-main--padding': props.padding,
    'acuity-main--centered': props.centered,
    'acuity-main--full-height': props.fullHeight
  }
])
</script>

<style scoped>
.acuity-main {
  flex: 1;
  width: 100vw;
}

.acuity-main--padding {
  padding: var(--spacing-lg);
}

.acuity-main--with-app-bar {
  /* Padding-top is handled by computed style */
}
</style>
