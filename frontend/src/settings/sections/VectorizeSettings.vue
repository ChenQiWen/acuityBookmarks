<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-cloud-sync-outline" /> <span>Vectorize</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">自动同步</div>
        <Button size="sm" :color="auto ? 'success' : 'secondary'" @click="auto = !auto">{{ auto ? '开启' : '关闭' }}</Button>
      </div>
      <div class="row">
        <Button size="sm" color="primary" variant="outline" @click="save">保存</Button>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button, Card, Icon } from '../../components/ui'
import { unifiedBookmarkAPI } from '../../utils/unified-bookmark-api'

const auto = ref<boolean>(false)

onMounted(async () => {
  const enabled = await unifiedBookmarkAPI.getSetting<boolean>('vectorize.autoSyncEnabled')
  if (enabled !== null && typeof enabled !== 'undefined') {
    auto.value = Boolean((enabled as any).value ?? enabled)
  }
})

async function save(){
  await unifiedBookmarkAPI.saveSetting('vectorize.autoSyncEnabled', Boolean(auto.value), 'boolean', '是否自动Vectorize同步')
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:10px}
.label{width:120px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:12px}
</style>