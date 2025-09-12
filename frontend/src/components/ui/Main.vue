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

const mainStyle = computed(() => {
  const styles: Record<string, string> = {}
  
  if (props.withAppBar) {
    const height = typeof props.appBarHeight === 'number' 
      ? `${props.appBarHeight}px` 
      : props.appBarHeight
    styles.paddingTop = height
  }
  
  return styles
})
</script>

<style scoped>
.acuity-main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  padding-top: v-bind('mainStyle.paddingTop');
}

.acuity-main--padding {
  padding: var(--spacing-lg);
}

.acuity-main--with-app-bar {
  /* Padding-top is handled by computed style */
}
</style>