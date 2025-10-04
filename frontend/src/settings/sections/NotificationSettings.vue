<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-bell-outline" /> <span>通知</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">系统通知镜像</div>
        <Button size="sm" :color="mirror ? 'primary' : 'secondary'" @click="mirror = !mirror">{{ mirror? '开' : '关' }}</Button>
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

const mirror = ref<boolean>(true)

onMounted(async () => {
  const v = await unifiedBookmarkAPI.getSetting<boolean>('notifications.mirrorSystemWhenHidden')
  if (v !== null && typeof v !== 'undefined') mirror.value = Boolean((v as any).value ?? v)
})

async function save(){
  await unifiedBookmarkAPI.saveSetting('notifications.mirrorSystemWhenHidden', Boolean(mirror.value), 'boolean', '页面隐藏时镜像系统通知')
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:10px}
.label{width:160px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:12px}
</style>