<template>
  <div class="icon-preview">
    <header class="icon-preview__header">
      <h1>🎨 图标预览</h1>
      <p class="icon-preview__subtitle">
        共 <strong>{{ iconEntries.length }}</strong> 个图标 · 点击复制名称
      </p>
    </header>

    <section class="icon-preview__grid" role="list">
      <button
        v-for="([name], index) in iconEntries"
        :key="name"
        type="button"
        class="icon-preview__item no-select"
        role="listitem"
        :title="`点击复制: ${name}`"
        @click="copyName(name)"
      >
        <div class="icon-preview__icon-wrapper">
          <BaseIcon :name="name" size="xl" />
        </div>
        <div class="icon-preview__info">
          <span class="icon-preview__index">{{ index + 1 }}</span>
          <span class="icon-preview__name">{{ name }}</span>
        </div>
      </button>
    </section>

    <!-- 不再需要手动添加组件，useNotification 会自动管理 -->
  </div>
</template>

<script setup lang="ts">
import { computed, defineOptions } from 'vue'

defineOptions({
  name: 'IconPreviewPage'
})
import BaseIcon from '@/components/base/Icon/Icon.vue'
import { useNotification } from '@/composables/useNotification'
import { icons } from '@/icons/mdi'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 将图标映射转换为数组，按定义顺序渲染。
 */
const iconEntries = computed(() => Object.entries(icons))

/**
 * 使用 Ant Design 风格的 Notification
 */
const notification = useNotification()

/**
 * 点击按钮后复制图标名称到剪贴板，提升调试效率。
 */
async function copyName(name: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(name)

    notification.success({
      message: '复制成功',
      description: `已复制: ${name}`,
      duration: 2
    })
  } catch (error) {
    logger.warn('IconPreview', 'Copy', '复制图标名称失败', error)
    notification.error({
      message: '复制失败',
      description: String(error),
      duration: 3
    })
  }
}
</script>
<style>
html,
body {
  overflow-y: auto;
}
</style>
<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list -- 工具页面使用固定尺寸 */

/* 响应式 */
@media (width <= 768px) {
  .icon-preview {
    padding: 24px 16px;
  }

  .icon-preview__grid {
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .icon-preview__item {
    padding: 16px 10px;
  }

  .icon-preview__header h1 {
    font-size: 24px;
  }
}

.icon-preview {
  box-sizing: border-box;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 24px 28px;
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background: var(--color-surface-container);
}

/* Header */
.icon-preview__header {
  margin-bottom: 24px;
  text-align: center;
}

.icon-preview__header h1 {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.icon-preview__subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-secondary);
}

.icon-preview__subtitle strong {
  font-weight: 600;
  color: var(--color-primary);
}

/* Grid */
.icon-preview__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  width: 100%;
}

/* Icon Card */
.icon-preview__item {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  width: 100%;
  padding: 20px 12px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.icon-preview__item::before {
  position: absolute;
  inset: 0;
  background: var(--color-primary);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  content: '';
}

.icon-preview__item:hover {
  border-color: var(--color-primary);
  box-shadow: 0 8px 16px rgb(0 0 0 / 10%);
}

.icon-preview__item:hover::before {
  opacity: 0.04;
}

/* Icon Wrapper */
.icon-preview__icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--color-surface-container);
  transition: all 0.2s ease;
}

.icon-preview__item:hover .icon-preview__icon-wrapper {
  color: var(--color-primary);
  background: var(--color-primary-container);
}

/* Info */
.icon-preview__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.icon-preview__index {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  opacity: 0.6;
}

.icon-preview__name {
  font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  text-align: center;
  color: var(--color-text-primary);
  word-break: break-all;
}

.icon-preview__item:hover .icon-preview__name {
  color: var(--color-primary);
}
</style>
