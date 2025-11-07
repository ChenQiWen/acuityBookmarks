<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-notification" />
      <span>通知设置</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          系统通知镜像
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>系统通知镜像的作用：</strong>
                <ul>
                  <li>当页面隐藏时，自动镜像通知到系统通知中心</li>
                  <li>确保重要提醒不会被遗漏</li>
                  <li>支持在后台运行时接收通知</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <Switch v-model="mirror" size="md" @change="onToggleMirror" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { defineOptions, onMounted, ref } from 'vue'

defineOptions({
  name: 'NotificationSettings'
})
import { Icon, Switch, Tooltip } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { notifySuccess } from '@/application'

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
    notifySuccess(v ? '系统通知镜像：开启' : '系统通知镜像：关闭', '通知')
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
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
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

.label--with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: default;
}

.label-info-icon {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.label-info-icon:hover {
  color: var(--color-primary);
}

.tooltip-content {
  font-size: 0.85rem;
  line-height: 1.4;
}

.tooltip-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.tooltip-content li {
  margin-bottom: 4px;
}
</style>
