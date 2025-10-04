<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-cog-outline" /> <span>通用</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">主题</div>
        <div class="field">
          <Button size="sm" @click="toggleTheme">切换主题</Button>
        </div>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { Button, Card, Icon } from '../../components/ui'
function toggleTheme(){
  try { (window as any).AB_toggleTheme?.() } catch {}
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:10px}
.label{width:120px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:12px}
</style>