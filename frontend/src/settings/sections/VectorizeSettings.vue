<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-cloud-sync-outline" /> <span>Vectorize</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">自动同步</div>
  <Switch v-model="auto" size="md" @change="onToggleAuto" />
      </div>
      <div class="row">
        <Button size="sm" color="primary" variant="outline" @click="save">保存</Button>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button, Card, Icon, Switch } from '../../components/ui'
import { unifiedBookmarkAPI } from '../../utils/unified-bookmark-api'
import { showToastSuccess } from '../../utils/toastbar'

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

// 即时保存
async function onToggleAuto(v: boolean){
  try {
    await unifiedBookmarkAPI.saveSetting('vectorize.autoSyncEnabled', Boolean(v), 'boolean', '是否自动Vectorize同步')
    showToastSuccess(v ? '自动同步：开启' : '自动同步：关闭', 'Vectorize')
  } catch (e) { /* 忽略错误，保留显式保存入口 */ }
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:10px}
.label{width:120px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:12px}
</style>