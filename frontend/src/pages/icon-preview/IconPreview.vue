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
        class="icon-preview__item"
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

    <!-- 统一使用 ToastBar 组件 -->
    <ToastBar ref="toastBarRef" position="top-right" :offset-top="20" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineOptions, ref } from 'vue'

defineOptions({
  name: 'IconPreviewPage'
})
import BaseIcon from '@/components/base/Icon/Icon.vue'
import ToastBar from '@/components/base/ToastBar/ToastBar.vue'
import { icons } from '@/icons/mdi'

/**
 * 将图标映射转换为数组，按定义顺序渲染。
 */
const iconEntries = computed(() => Object.entries(icons))

/**
 * ToastBar 组件引用
 */
const toastBarRef = ref<InstanceType<typeof ToastBar> | null>(null)

/**
 * 点击按钮后复制图标名称到剪贴板，提升调试效率。
 */
async function copyName(name: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(name)

    // 使用统一的 ToastBar 组件显示提示
    toastBarRef.value?.showToast(`已复制: ${name}`, {
      level: 'success',
      timeoutMs: 2000
    })
  } catch (error) {
    console.warn('复制图标名称失败', error)
    toastBarRef.value?.showToast(`复制失败: ${error}`, {
      level: 'error',
      timeoutMs: 3000
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
.icon-preview {
  font-family: var(--font-family-base);
  padding: 24px 28px;
  color: var(--color-text-primary);
  background: var(--color-surface-container);
  min-height: 100vh;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
}

/* Header */
.icon-preview__header {
  margin-bottom: 24px;
  text-align: center;
}

.icon-preview__header h1 {
  margin: 0 0 8px 0;
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
  color: var(--color-primary);
  font-weight: 600;
}

/* Grid */
.icon-preview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  width: 100%;
}

/* Icon Card */
.icon-preview__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 12px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.icon-preview__item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-primary);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.icon-preview__item:hover {
  border-color: var(--color-primary);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.icon-preview__item:hover::before {
  opacity: 0.04;
}

/* Icon Wrapper */
.icon-preview__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--color-surface-container);
  transition: all 0.2s ease;
}

.icon-preview__item:hover .icon-preview__icon-wrapper {
  background: var(--color-primary-container);
  color: var(--color-primary);
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
  color: var(--color-text-tertiary);
  font-weight: 500;
  opacity: 0.6;
}

.icon-preview__name {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
  word-break: break-all;
  text-align: center;
  line-height: 1.4;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
}

.icon-preview__item:hover .icon-preview__name {
  color: var(--color-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .icon-preview {
    padding: 24px 16px;
  }

  .icon-preview__grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .icon-preview__item {
    padding: 16px 10px;
  }

  .icon-preview__header h1 {
    font-size: 24px;
  }
}
</style>
