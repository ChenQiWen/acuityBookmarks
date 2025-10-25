<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-radar" />
      <span>Vectorize</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label">自动同步</div>
        <div class="field">
          <Switch v-model="auto" size="md" @change="onToggleAuto" />
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
    showToastSuccess(v ? '自动同步：开启' : '自动同步：关闭', 'Vectorize')
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
</style>
