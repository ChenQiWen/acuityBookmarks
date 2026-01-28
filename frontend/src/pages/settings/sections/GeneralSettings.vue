<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-more-vertical" />
      <span>{{ t('settings_general_title') }}</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_general_auto_theme') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_general_auto_theme_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_general_auto_theme_tooltip_1') }}</li>
                  <li>{{ t('settings_general_auto_theme_tooltip_2') }}</li>
                  <li>{{ t('settings_general_auto_theme_tooltip_3') }}</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <Switch
            v-model="autoFollowSystemTheme"
            size="md"
            @change="handleAutoFollowChange"
          />
        </div>
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_general_glass_effect') }}
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_general_glass_effect_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_general_glass_effect_tooltip_1') }}</li>
                  <li>{{ t('settings_general_glass_effect_tooltip_2') }}</li>
                  <li>{{ t('settings_general_glass_effect_tooltip_3') }}</li>
                </ul>
                <p>{{ t('settings_general_glass_effect_note') }}</p>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <Switch v-model="useGlass" size="md" @change="applyGlass" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Icon, Switch, Tooltip } from '@/components'
import { defineOptions, onMounted, ref } from 'vue'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'GeneralSettings'
})
import { useUIStore } from '@/stores/ui-store'
import {
  getAutoFollowSystemTheme,
  setAutoFollowSystemTheme
} from '@/infrastructure/global-state/global-state-manager'

const useGlass = ref(false)
const autoFollowSystemTheme = ref(false)
const uiStore = useUIStore()

// 加载自动跟随系统主题设置
onMounted(async () => {
  try {
    const value = await getAutoFollowSystemTheme()
    autoFollowSystemTheme.value = value
    console.log('自动跟随系统主题设置已加载:', value)
  } catch (error) {
    console.error('加载自动跟随系统主题设置失败', error)
    // 加载失败时使用默认值 false
    autoFollowSystemTheme.value = false
  }
})

function applyGlass() {
  try {
    ;(
      window as unknown as { AB_setGlassEffect?: (enabled: boolean) => void }
    ).AB_setGlassEffect?.(!!useGlass.value)
  } catch {}
}

// 处理自动跟随系统主题变化
async function handleAutoFollowChange() {
  try {
    await setAutoFollowSystemTheme(autoFollowSystemTheme.value)
    uiStore.showSuccess(
      autoFollowSystemTheme.value
        ? t('settings_general_auto_theme_enabled')
        : t('settings_general_auto_theme_disabled')
    )
  } catch (error) {
    uiStore.showError(t('settings_general_save_failed', (error as Error).message))
    // 回滚状态
    autoFollowSystemTheme.value = !autoFollowSystemTheme.value
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
  gap: var(--spacing-4);
}

.label {
  width: 130px;
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-5);
}

.field {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
}

.info-card {
  margin-top: var(--spacing-2);
  border-color: var(--color-primary-alpha-20);
  background-color: var(--color-primary-alpha-5);
}

.info-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
  font-size: 0.875rem;
}

.info-content {
  font-size: 0.875rem;
}

.info-content ul {
  margin: 0 0 12px;
  padding-left: var(--spacing-5);
}

.info-content li {
  margin-bottom: var(--spacing-1);
}

.info-note {
  font-size: 0.8125rem;
  font-style: italic;
  color: var(--color-text-tertiary);
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
