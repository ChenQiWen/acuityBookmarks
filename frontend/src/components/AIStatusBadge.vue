<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAIStore } from '../stores';

const aiStore = useAIStore();

onMounted(() => {
  // 初始化事件监听
  aiStore.initListener();
  aiStore.initAvailability();
  aiStore.startAvailabilityMonitor();
});

const label = computed(() => aiStore.displayName);
const color = computed(() => aiStore.providerColor);
const tooltip = computed(() => aiStore.tooltip);
</script>

<template>
  <div class="ai-status-badge" :style="{ borderColor: color, color }" :title="tooltip">
    <span class="dot" :style="{ backgroundColor: color }"></span>
    <span class="text">AI: {{ label }}</span>
  </div>
  
</template>

<style scoped>
.ai-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1;
  padding: 6px 10px;
  border: 1px solid;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.text {
  font-weight: 600;
}
</style>