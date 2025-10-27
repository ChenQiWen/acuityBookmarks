<template>
  <div class="icon-preview">
    <header class="icon-preview__header">
      <h1>项目内置图标预览</h1>
      <p>当前共 {{ iconEntries.length }} 个图标，可点击快速复制名称。</p>
    </header>
    <section class="icon-preview__grid" role="list">
      <button
        v-for="([name], index) in iconEntries"
        :key="name"
        type="button"
        class="icon-preview__item"
        role="listitem"
        :title="`${name}\nviewBox: 0 -960 960 960`"
        @click="copyName(name)"
      >
        <BaseIcon :name="name" size="lg" />
        <span class="icon-preview__label">{{ index + 1 }}. {{ name }}</span>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineOptions } from 'vue'

defineOptions({
  name: 'IconPreviewPage'
})
import BaseIcon from '@/components/base/Icon/Icon.vue'
import { icons } from '@/icons/mdi'
import { notifySuccess } from '@/application/notification/notification-service'

/**
 * 将图标映射转换为数组并按名称排序，便于渲染。
 */
const iconEntries = computed(() =>
  Object.entries(icons).sort(([a], [b]) => a.localeCompare(b))
)

/**
 * 点击按钮后复制图标名称到剪贴板，提升调试效率。
 */
async function copyName(name: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(name)
    await notifySuccess(`已复制: ${name}`)
  } catch (error) {
    console.warn('复制图标名称失败', error)
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
  padding: var(--spacing-6) var(--spacing-8);
  color: var(--color-text-primary);
  background: var(--color-surface-container);
  width: 100%;
  margin: 0;
  box-sizing: border-box;
}

.icon-preview__header {
  margin-bottom: var(--spacing-4);
}

.icon-preview__header h1 {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--md-sys-typescale-title-large-size);
}

.icon-preview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-3);
  width: 100%;
}

.icon-preview__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: box-shadow 120ms ease;
  width: 100%;
  box-sizing: border-box;
}

.icon-preview__item:hover {
  box-shadow: var(--shadow-lg);
}

.icon-preview__label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  word-break: break-all;
  text-align: center;
}
</style>
