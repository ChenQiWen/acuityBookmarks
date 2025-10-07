<template>
  <main :class="mainClasses">
    <slot />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface MainProps {
  withAppBar?: boolean
  appBarHeight?: number | string
  padding?: boolean
}

const props = withDefaults(defineProps<MainProps>(), {
  withAppBar: false,
  appBarHeight: 64,
  padding: true
})

const mainClasses = computed(() => [
  'acuity-main',
  {
    'acuity-main--with-app-bar': props.withAppBar,
    'acuity-main--padding': props.padding
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
