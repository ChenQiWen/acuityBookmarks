<template>
  <Card>
    <template #header>
      <div class="title-row">
        <Icon name="mdi-bell-outline" /> <span>通知</span>
      </div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">系统通知镜像</div>
        <div class="field">
          <Switch v-model="mirror" size="md" @change="onToggleMirror" />
        </div>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Card, Icon, Switch } from '@/components/ui'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { showToastSuccess } from '@/application'

const mirror = ref<boolean>(true)

onMounted(async () => {
  const v = await settingsAppService.getSetting<boolean>(
    'notifications.mirrorSystemWhenHidden'
  )
  if (v !== null && typeof v !== 'undefined')
    mirror.value = Boolean((v as unknown as { value?: boolean }).value ?? v)
})

// 即时保存：开关变化时立即落盘
async function onToggleMirror(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'notifications.mirrorSystemWhenHidden',
      Boolean(v),
      'boolean',
      '页面隐藏时镜像系统通知'
    )
    showToastSuccess(v ? '系统通知镜像：开启' : '系统通知镜像：关闭', '通知')
  } catch {
    /* 保留手动保存按钮 */
  }
}
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
  width: 160px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
