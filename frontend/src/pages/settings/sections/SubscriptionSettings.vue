<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="icon-crown" /> <span>订阅</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">当前订阅</div>
        <div class="field text-secondary">免费版（占位）</div>
      </div>
      <div class="row">
        <Button size="sm" color="primary">升级到 Pro（占位）</Button>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { Button, Card, Icon } from '@/components'
</script>
<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
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
