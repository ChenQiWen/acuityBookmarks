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
    <footer class="icon-preview__footer">
      <p>
        点击任意图标可复制名称，粘贴至代码中即可使用。
        页面仅用于开发调试，可在需要时访问 `icon-preview.html`。
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  padding: 24px 32px;
  color: #1f1f1f;
  background: #f9fafb;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
}

.icon-preview__header {
  margin-bottom: 16px;
}

.icon-preview__header h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.icon-preview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  width: 100%;
}

.icon-preview__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: box-shadow 120ms ease;
  width: 100%;
  box-sizing: border-box;
}

.icon-preview__item:hover {
  box-shadow: 0 8px 16px rgb(15 23 42 / 0.08);
}

.icon-preview__label {
  font-size: 13px;
  color: #374151;
  word-break: break-all;
  text-align: center;
}

.icon-preview__footer {
  margin-top: 24px;
  font-size: 13px;
  color: #6b7280;
}
</style>
