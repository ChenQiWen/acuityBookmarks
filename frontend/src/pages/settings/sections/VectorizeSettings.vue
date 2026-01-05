<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-radar" />
      <span>{{ t('settings_vectorize_title') }}</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_vectorize_auto_sync') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_vectorize_auto_sync_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_vectorize_auto_sync_tooltip_1') }}</li>
                  <li>{{ t('settings_vectorize_auto_sync_tooltip_2') }}</li>
                  <li>{{ t('settings_vectorize_auto_sync_tooltip_3') }}</li>
                </ul>
                <p>{{ t('settings_vectorize_auto_sync_note') }}</p>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <Switch v-model="auto" size="md" @change="onToggleAuto" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { defineOptions, onMounted, ref } from 'vue'

defineOptions({
  name: 'VectorizeSettings'
})
import { Icon, Switch, Tooltip } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { notifySuccess } from '@/application'
import { t } from '@/utils/i18n-helpers'

const auto = ref<boolean>(false)

onMounted(async () => {
  const enabled = await settingsAppService.getSetting<boolean>(
    'vectorize.autoSyncEnabled'
  )
  if (enabled !== null && typeof enabled !== 'undefined') {
    auto.value = Boolean(
      (enabled as unknown as { value?: boolean }).value ?? enabled
    )
  }
})

// 即时保存
async function onToggleAuto(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'vectorize.autoSyncEnabled',
      Boolean(v),
      'boolean',
      '是否自动Vectorize同步'
    )
    notifySuccess(
      v ? t('settings_vectorize_auto_sync_enabled') : t('settings_vectorize_auto_sync_disabled'),
      'Vectorize'
    )
  } catch {
    /* 忽略错误，保留显式保存入口 */
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
  gap: var(--spacing-2);
}

.label {
  width: 120px;
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.label--with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  cursor: default;
}

.label-info-icon {
  font-size: var(--text-sm);
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
  margin: var(--spacing-2) 0;
  padding-left: var(--spacing-5);
}

.tooltip-content li {
  margin-bottom: var(--spacing-1);
}

.tooltip-content p {
  margin: var(--spacing-2) 0 0;
}
</style>
