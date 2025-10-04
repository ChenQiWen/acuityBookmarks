<template>
  <div class="settings-root">
    <Tabs v-model="tab" :tabs="tabs" grow />

    <div v-if="tab==='general'" class="pane"><GeneralSettings /></div>
    <div v-else-if="tab==='embeddings'" class="pane"><EmbeddingSettings /></div>
    <div v-else-if="tab==='vectorize'" class="pane"><VectorizeSettings /></div>
    <div v-else-if="tab==='notifications'" class="pane"><NotificationSettings /></div>
    <div v-else-if="tab==='account'" class="pane"><AccountSettings /></div>
    <div v-else-if="tab==='subscription'" class="pane"><SubscriptionSettings /></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { Tabs } from '../components/ui'
import GeneralSettings from './sections/GeneralSettings.vue'
import EmbeddingSettings from './sections/EmbeddingSettings.vue'
import VectorizeSettings from './sections/VectorizeSettings.vue'
import NotificationSettings from './sections/NotificationSettings.vue'
import AccountSettings from './sections/AccountSettings.vue'
import SubscriptionSettings from './sections/SubscriptionSettings.vue'

type TabKey = 'general'|'embeddings'|'vectorize'|'notifications'|'account'|'subscription'
const tab = ref<TabKey>('general')
const tabs = [
  { value: 'general', text: '通用' },
  { value: 'embeddings', text: '嵌入' },
  { value: 'vectorize', text: 'Vectorize' },
  { value: 'notifications', text: '通知' },
  { value: 'account', text: '账户' },
  { value: 'subscription', text: '订阅' }
]

const allowed = new Set<TabKey>(['general','embeddings','vectorize','notifications','account','subscription'])

function readTabFromURL(): TabKey | null {
  try {
    const url = new URL(window.location.href)
    const q = (url.searchParams.get('tab') || '').toLowerCase()
    if (q && allowed.has(q as TabKey)) return q as TabKey
    const h = (url.hash || '').toLowerCase()
    // 支持 #tab=xxx 或 #/tab/xxx 两种形式（宽松匹配）
    if (h.startsWith('#tab=')) {
      const v = h.slice(5)
      if (allowed.has(v as TabKey)) return v as TabKey
    }
    if (h.startsWith('#/tab/')) {
      const v = h.slice('#/tab/'.length)
      if (allowed.has(v as TabKey)) return v as TabKey
    }
  } catch {}
  return null
}

function writeTabToURL(v: TabKey) {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', v)
    // 清理旧的 #tab 片段，统一用查询参数
    if (url.hash && (url.hash.startsWith('#tab=') || url.hash.startsWith('#/tab/'))) {
      url.hash = ''
    }
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

function syncFromURL() {
  const t = readTabFromURL()
  if (t && t !== tab.value) tab.value = t
}

onMounted(() => {
  const initial = readTabFromURL()
  if (initial && initial !== tab.value) tab.value = initial
  // 监听浏览器前进/后退
  window.addEventListener('popstate', syncFromURL)
  window.addEventListener('hashchange', syncFromURL)
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncFromURL)
  window.removeEventListener('hashchange', syncFromURL)
})

watch(tab, (v) => writeTabToURL(v))
</script>

<style scoped>
.settings-root { display: flex; flex-direction: column; gap: 12px; }
.pane { padding: 8px 4px; }
</style>
