<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-crown" />
      <span>订阅</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label">当前订阅</div>
        <div class="field text-secondary">免费版（占位）</div>
      </div>
      <div class="row">
        <Button size="sm" color="primary">升级到 Pro（占位）</Button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { defineOptions } from 'vue'

defineOptions({
  name: 'SubscriptionSettings'
})
import { Button, Icon } from '@/components'
</script>
<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.label {
  width: 120px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.text-secondary {
  color: var(--color-text-secondary);
}
</style>
