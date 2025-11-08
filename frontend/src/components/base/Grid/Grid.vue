<template>
  <!-- Container Component -->
  <div v-if="is === 'container'" :class="containerClasses">
    <slot />
  </div>

  <!-- Row Component -->
  <div v-else-if="is === 'row'" :class="rowClasses">
    <slot />
  </div>

  <!-- Col Component -->
  <div v-else-if="is === 'col'" :class="colClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GridProps } from './Grid.d'

/**
 * Grid 默认配置，控制列数与间距。
 */
const props = withDefaults(defineProps<GridProps>(), {
  columns: 1,
  rowGap: '16px',
  columnGap: '16px',
  autoFit: false
})

/** 容器类名集合 */
const containerClasses = computed(() => [
  'acuity-container',
  {
    'acuity-container--fluid': props.fluid
  }
])

/** 行容器类名集合 */
const rowClasses = computed(() => [
  'acuity-row',
  `acuity-row--gutter-${props.gutter}`,
  `acuity-row--justify-${props.justify}`,
  `acuity-row--align-${props.align}`
])

/** 列容器类名集合 */
const colClasses = computed(() => {
  const classes = ['acuity-col']

  if (props.cols) classes.push(`acuity-col--${props.cols}`)
  if (props.offset) classes.push(`acuity-col--offset-${props.offset}`)

  return classes
})
</script>

<style scoped>
/* Container */
.acuity-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.acuity-container--fluid {
  max-width: none;
}

/* Row */
.acuity-row {
  display: flex;
  flex-wrap: wrap;
}

/* Col */
.acuity-col {
  flex: 1;
  min-width: 0;
}

.acuity-row--gutter-sm {
  margin: calc(-1 * var(--spacing-sm));
}

.acuity-row--gutter-sm > .acuity-col {
  padding: var(--spacing-sm);
}

.acuity-row--gutter-lg {
  margin: calc(-1 * var(--spacing-lg));
}

.acuity-row--gutter-lg > .acuity-col {
  padding: var(--spacing-lg);
}

.acuity-row--gutter-xl {
  margin: calc(-1 * var(--spacing-xl));
}

.acuity-row--gutter-xl > .acuity-col {
  padding: var(--spacing-xl);
}

/* Row justify */
.acuity-row--justify-start {
  justify-content: flex-start;
}

.acuity-row--justify-center {
  justify-content: center;
}

.acuity-row--justify-end {
  justify-content: flex-end;
}

.acuity-row--justify-space-between {
  justify-content: space-between;
}

.acuity-row--justify-space-around {
  justify-content: space-around;
}

.acuity-row--justify-space-evenly {
  justify-content: space-evenly;
}

/* Row align */
.acuity-row--align-start {
  align-items: flex-start;
}

.acuity-row--align-center {
  align-items: center;
}

.acuity-row--align-end {
  align-items: flex-end;
}

.acuity-row--align-stretch {
  align-items: stretch;
}

.fill-height {
  height: 100%;
}

/* Column sizes */
.acuity-col--1 {
  flex: 0 0 8.3333%;
  max-width: 8.3333%;
}

.acuity-col--2 {
  flex: 0 0 16.6667%;
  max-width: 16.6667%;
}

.acuity-col--3 {
  flex: 0 0 25%;
  max-width: 25%;
}

.acuity-col--4 {
  flex: 0 0 33.3333%;
  max-width: 33.3333%;
}

.acuity-col--5 {
  flex: 0 0 41.6667%;
  max-width: 41.6667%;
}

.acuity-col--6 {
  flex: 0 0 50%;
  max-width: 50%;
}

.acuity-col--7 {
  flex: 0 0 58.3333%;
  max-width: 58.3333%;
}

.acuity-col--8 {
  flex: 0 0 66.6667%;
  max-width: 66.6667%;
}

.acuity-col--9 {
  flex: 0 0 75%;
  max-width: 75%;
}

.acuity-col--10 {
  flex: 0 0 83.3333%;
  max-width: 83.3333%;
}

.acuity-col--11 {
  flex: 0 0 91.6667%;
  max-width: 91.6667%;
}

.acuity-col--12 {
  flex: 0 0 100%;
  max-width: 100%;
}
</style>
