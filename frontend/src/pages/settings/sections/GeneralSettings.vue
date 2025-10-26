<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-more" />
      <span>通用设置</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          主题跟随系统
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>主题跟随系统的作用：</strong>
                <ul>
                  <li>自动跟随系统主题，确保界面与系统主题一致</li>
                  <li>当系统主题变化时，界面会自动切换</li>
                  <li>无需手动切换主题</li>
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
          玻璃效果
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>玻璃效果的作用：</strong>
                <ul>
                  <li>启用毛玻璃材质（Glassmorphism）视觉效果</li>
                  <li>界面背景呈现半透明模糊效果，更有层次感</li>
                  <li>适合现代化、高端的视觉体验</li>
                </ul>
                <p>注意：可能会略微增加渲染负担。</p>
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
        ? '已开启自动跟随系统主题'
        : '已关闭自动跟随系统主题'
    )
  } catch (error) {
    uiStore.showError(`设置失败: ${(error as Error).message}`)
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
  gap: 16px;
}
.label {
  width: 130px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.field {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-card {
  border-color: var(--color-primary-alpha-20);
  background-color: var(--color-primary-alpha-5);
  margin-top: 8px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 0.875rem;
}

.info-content {
  font-size: 0.875rem;
}

.info-content ul {
  margin: 0 0 12px 0;
  padding-left: 20px;
}

.info-content li {
  margin-bottom: 4px;
}

.info-note {
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
  font-style: italic;
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
