<template>
  <main :class="mainClasses">
    <slot />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MainProps } from './Main.d'

const props = withDefaults(defineProps<MainProps>(), {
  padding: true,
  scrollable: true
})

const mainClasses = computed(() => [
  'acuity-main',
  {
    'acuity-main--padding': props.padding,
    'acuity-main--scrollable': props.scrollable
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
</style>
