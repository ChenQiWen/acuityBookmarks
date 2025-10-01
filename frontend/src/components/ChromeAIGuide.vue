<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAIStore } from '../stores'

const aiStore = useAIStore()
const hidden = ref<boolean>(false)

onMounted(() => {
  try {
    const v = localStorage.getItem('hideChromeAIGuide')
    hidden.value = v === '1'
  } catch {}
  // 确保已初始化可用性与监控（若页面未引入AIStatusBadge）
  aiStore.initListener()
  aiStore.initAvailability()
  aiStore.startAvailabilityMonitor()
})

const availability = computed(() => aiStore.availability)
const shouldShow = computed(() => !hidden.value && (availability.value === 'unsupported' || availability.value === 'after_download'))
const isUnsupported = computed(() => availability.value === 'unsupported')
const isDownloading = computed(() => availability.value === 'after_download')

function hideForever() {
  hidden.value = true
  try { localStorage.setItem('hideChromeAIGuide', '1') } catch {}
}

function openHelp() {
  // 提示用户如何启用 Prompt API / 本地AI
  // 直接打开 chrome://flags 可能受限制，这里尝试打开新标签；失败则给出文本提示
  const url = 'chrome://flags/#prompt-api'
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url })
      return
    }
    window.open(url, '_blank')
  } catch {
    // 忽略失败，在UI中提供文字指引
  }
}
</script>

<template>
  <div v-if="shouldShow" class="ai-guide">
    <div class="ai-guide-content">
      <div class="ai-guide-icon">⚙️</div>
      <div class="ai-guide-text">
        <template v-if="isUnsupported">
          <div class="title">Chrome 内置 AI 未启用</div>
          <div class="desc">
            请在浏览器中启用本地 AI（Prompt API/Gemini Nano）。
            操作步骤：打开 <code>chrome://flags</code>，搜索 “Prompt API” 或 “Gemini Nano/On‑device AI”，启用相关项并重启浏览器。
          </div>
          <div class="note">当前已自动回退到云端提供商，功能依旧可用但可能产生调用成本。</div>
        </template>
        <template v-else-if="isDownloading">
          <div class="title">Chrome 内置 AI 正在下载</div>
          <div class="desc">本地模型组件下载完成后将自动就绪，请保持浏览器打开以完成安装。</div>
          <div class="note">在就绪前，系统将自动回退到云端提供商以保证可用性。</div>
        </template>
      </div>
      <div class="ai-guide-actions">
        <button type="button" class="btn btn-primary" @click="openHelp">打开帮助</button>
        <button type="button" class="btn btn-ghost" @click="hideForever">不再提示</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-guide {
  margin: 8px 0;
}
.ai-guide-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px dashed rgba(0,0,0,0.15);
  border-radius: 10px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
}
.ai-guide-icon {
  font-size: 18px;
  line-height: 1;
  margin-top: 2px;
}
.ai-guide-text {
  flex: 1;
}
.title {
  font-weight: 600;
  margin-bottom: 4px;
}
.desc {
  font-size: 12px;
  color: #555;
}
.note {
  font-size: 12px;
  color: #777;
  margin-top: 6px;
}
.ai-guide-actions {
  display: flex;
  gap: 8px;
}
.btn {
  font-size: 12px;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
}
.btn-primary {
  color: #fff;
  background: #007aff;
  border: 1px solid #0066d6;
}
.btn-ghost {
  color: #333;
  background: transparent;
  border: 1px solid rgba(0,0,0,0.2);
}
</style>