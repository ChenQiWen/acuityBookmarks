<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-brain" />
      <span>{{ t('settings_embedding_title') }}</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_embedding_auto_generate') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_embedding_auto_generate_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_embedding_auto_generate_tooltip_1') }}</li>
                  <li>{{ t('settings_embedding_auto_generate_tooltip_2') }}</li>
                  <li>{{ t('settings_embedding_auto_generate_tooltip_3') }}</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <Switch v-model="autoEnabled" size="md" @change="onToggleAuto" />
        </div>
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_embedding_daily_quota') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_embedding_daily_quota_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_embedding_daily_quota_tooltip_1') }}</li>
                  <li>{{ t('settings_embedding_daily_quota_tooltip_2') }}</li>
                  <li>{{ t('settings_embedding_daily_quota_tooltip_3') }}</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <Input
          v-model.number="dailyQuota"
          type="number"
          density="compact"
          style="width: 140px"
          :placeholder="t('settings_embedding_daily_quota_placeholder')"
          @blur="commitDailyQuota"
          @keydown.enter.prevent="commitDailyQuota"
        />
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_embedding_per_run_max') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_embedding_per_run_max_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_embedding_per_run_max_tooltip_1') }}</li>
                  <li>{{ t('settings_embedding_per_run_max_tooltip_2') }}</li>
                  <li>{{ t('settings_embedding_per_run_max_tooltip_3') }}</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <Input
          v-model.number="perRunMax"
          type="number"
          density="compact"
          style="width: 140px"
          :placeholder="t('settings_embedding_per_run_max_placeholder')"
          @blur="commitPerRunMax"
          @keydown.enter.prevent="commitPerRunMax"
        />
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_embedding_night_idle_only') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_embedding_night_idle_only_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_embedding_night_idle_only_tooltip_1') }}</li>
                  <li>{{ t('settings_embedding_night_idle_only_tooltip_2') }}</li>
                  <li>{{ t('settings_embedding_night_idle_only_tooltip_3') }}</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <Switch
          v-model="nightOrIdleOnly"
          size="md"
          @change="onToggleNightIdle"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon, Input, Switch, Tooltip } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { notifyError, notifySuccess } from '@/application'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'EmbeddingSettings'
})

const autoEnabled = ref<boolean>(true)
const dailyQuota = ref<number | undefined>(undefined)
const perRunMax = ref<number | undefined>(undefined)
const nightOrIdleOnly = ref<boolean>(false)

onMounted(async () => {
  try {
    const enabled = await settingsAppService.getSetting<boolean>(
      'embedding.autoGenerateEnabled'
    )
    autoEnabled.value =
      enabled === null
        ? true
        : Boolean((enabled as unknown as { value?: boolean }).value ?? enabled)

    const dqRaw = await settingsAppService.getSetting<number>(
      'embedding.auto.dailyQuota'
    )
    const dq = (dqRaw as unknown as { value?: number })?.value ?? dqRaw
    if (typeof dq === 'number') dailyQuota.value = dq

    const pmRaw = await settingsAppService.getSetting<number>(
      'embedding.auto.perRunMax'
    )
    const pm = (pmRaw as unknown as { value?: number })?.value ?? pmRaw
    if (typeof pm === 'number') perRunMax.value = pm

    const nioRaw = await settingsAppService.getSetting<boolean>(
      'embedding.auto.nightOrIdleOnly'
    )
    const nio = (nioRaw as unknown as { value?: boolean })?.value ?? nioRaw
    if (typeof nio === 'boolean') nightOrIdleOnly.value = nio
  } catch (e) {
    console.error('[EmbeddingSettings] 加载设置失败，使用默认值', e)
    notifyError('加载嵌入设置失败，已使用默认值', 'Settings')
    // 保持默认值，不抛出，组件仍可用
  }
})

// 即时保存：开关变化时立即落盘
async function onToggleAuto(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'embedding.autoGenerateEnabled',
      Boolean(v),
      'boolean',
      '是否自动生成嵌入'
    )
    notifySuccess(v ? '已开启自动生成' : '已关闭自动生成', '嵌入设置')
  } catch {
    /* 忽略错误，保留显式保存入口 */
  }
}
async function onToggleNightIdle(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'embedding.auto.nightOrIdleOnly',
      Boolean(v),
      'boolean'
    )
    notifySuccess(v ? '仅夜间/空闲：开启' : '仅夜间/空闲：关闭', '嵌入设置')
  } catch {
    /* 忽略错误，保留显式保存入口 */
  }
}

// 即时保存：数值输入在 blur/Enter 时提交；为空时删除配置以回退默认
async function commitDailyQuota() {
  try {
    const v = dailyQuota.value
    if (v == null) {
      await settingsAppService.deleteSetting('embedding.auto.dailyQuota')
      notifySuccess('已恢复每日配额默认值', '嵌入设置')
      return
    }
    await settingsAppService.saveSetting(
      'embedding.auto.dailyQuota',
      Number(v),
      'number'
    )
    notifySuccess(`每日配额：${Number(v)}`, '嵌入设置')
  } catch {}
}
async function commitPerRunMax() {
  try {
    const v = perRunMax.value
    if (v == null) {
      await settingsAppService.deleteSetting('embedding.auto.perRunMax')
      notifySuccess('已恢复单次最大默认值', '嵌入设置')
      return
    }
    await settingsAppService.saveSetting(
      'embedding.auto.perRunMax',
      Number(v),
      'number'
    )
    notifySuccess(`单次最大：${Number(v)}`, '嵌入设置')
  } catch {}
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
</style>
