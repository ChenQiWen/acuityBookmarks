<template>
  <div class="tree-node-skeleton" :class="`skeleton--${size}`">
    <div class="skeleton-icon shimmer"></div>
    <div class="skeleton-title shimmer"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'compact' | 'comfortable' | 'spacious'
}

withDefaults(defineProps<Props>(), {
  size: 'comfortable'
})
</script>

<style scoped>
.tree-node-skeleton {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: 0 var(--spacing-sm);
  height: var(--item-height, 36px);
}

.skeleton-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--color-surface-variant);
  flex-shrink: 0;
}

.skeleton-title {
  flex: 1;
  height: 12px;
  border-radius: 4px;
  background: var(--color-surface-variant);
}

.skeleton--compact {
  height: 30px;
}

.skeleton--spacious {
  height: 44px;
}

.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}
</style>
