<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <LucideIcon name="settings" :size="20" />
      <span>{{ t('settings_title_general') }}</span>
    </h3>
    <div class="grid">
      <!-- AI 自动归纳书签 -->
      <div class="row">
        <div class="label">
          <LucideIcon name="sparkles" :size="16" />
          AI 自动归纳书签
        </div>
        <div class="field">
          <label class="toggle-switch">
            <input
              v-model="aiAutoEnabled"
              type="checkbox"
              class="toggle-input"
              @change="handleAIAutoToggle"
            />
            <span class="toggle-slider"></span>
          </label>
          <div class="field-description">
            <p class="field-description__text">
              开启后，添加书签时自动推荐最佳文件夹并直接保存，无需手动选择。
            </p>
            <p class="field-description__hint">
              关闭后，每次添加书签都会弹出对话框让你手动选择文件夹。
            </p>
          </div>
        </div>
      </div>

      <!-- 语言说明 -->
      <div class="row">
        <div class="label">
          {{ t('settings_general_language') }}
        </div>
        <div class="field">
          <div class="language-info">
            <p class="language-info__text">
              扩展语言由浏览器语言设置决定。当前语言：<strong>{{ currentLanguageName }}</strong>
            </p>
            <p class="language-info__hint">
              如需更改，请在 Chrome 设置 > 语言 中修改浏览器语言。
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LucideIcon } from '@/components'
import { t } from '@/utils/i18n-helpers'
import { computed, onMounted, ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({
  name: 'GeneralSettings'
})

// AI 自动归纳开关状态
const aiAutoEnabled = ref(true) // 默认开启

// 加载设置
onMounted(async () => {
  try {
    const result = await chrome.storage.local.get('aiAutoBookmark')
    aiAutoEnabled.value = result.aiAutoBookmark !== false // 默认 true
    logger.info('GeneralSettings', 'AI 自动归纳设置已加载', { enabled: aiAutoEnabled.value })
  } catch (error) {
    logger.error('GeneralSettings', '加载 AI 自动归纳设置失败', error)
  }
})

// 处理开关切换
async function handleAIAutoToggle() {
  try {
    await chrome.storage.local.set({ aiAutoBookmark: aiAutoEnabled.value })
    logger.info('GeneralSettings', 'AI 自动归纳设置已更新', { enabled: aiAutoEnabled.value })
  } catch (error) {
    logger.error('GeneralSettings', '保存 AI 自动归纳设置失败', error)
  }
}

// 语言显示名称映射
// 支持多种语言代码格式（连字符和下划线）
const languageNames: Record<string, string> = {
  'zh-CN': '简体中文',
  zh_CN: '简体中文',
  'zh-TW': '繁體中文',
  zh_TW: '繁體中文',
  en: 'English',
  'en-US': 'English',
  en_US: 'English',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  es: 'Español'
}

// 获取当前语言名称
const currentLanguageName = computed(() => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    const uiLanguage = chrome.i18n.getUILanguage()
    return languageNames[uiLanguage] || uiLanguage
  }
  return 'English'
})
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
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 100px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-5);
}

.field {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: var(--spacing-4);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  width: 44px;
  height: 24px;
}

.toggle-input {
  width: 0;
  height: 0;
  opacity: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-full);
  background-color: var(--color-border);
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.toggle-slider::before {
  position: absolute;
  bottom: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--md-sys-color-surface-container-highest);
  transition: transform 0.3s ease;
  content: '';
}

.toggle-input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-input:focus + .toggle-slider {
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

/* Field Description */
.field-description {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.field-description__text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.field-description__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* 语言信息 */
.language-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.language-info__text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.language-info__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
</style>
