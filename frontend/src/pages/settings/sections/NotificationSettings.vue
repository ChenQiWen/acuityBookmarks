<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-notification" />
      <span>通知设置</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label">系统通知镜像</div>
        <div class="field">
          <Switch v-model="mirror" size="md" @change="onToggleMirror" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon, Switch } from '@/components'
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
  width: 160px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
