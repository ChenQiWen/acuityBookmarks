<template>
  <div class="settings-layout">
    <!-- 左侧竖向 tabs（大屏） -->
    <aside class="sidebar" aria-label="Settings Sections">
      <Tabs
        v-model="tab"
        :tabs="tabsI18n"
        variant="pills"
        orientation="vertical"
        :aria-label="t('settings.sidebar')"
      />
    </aside>

    <!-- 小屏时顶部横向 tabs -->
    <div class="top-tabs">
      <Tabs
        v-model="tab"
        :tabs="tabsI18n"
        variant="underline"
        :grow="true"
        :aria-label="t('settings.topTabs')"
      />
    </div>

    <!-- 右侧内容区 -->
    <div class="divider" aria-hidden="true"></div>
    <main class="content" role="region" :aria-labelledby="titleId">
      <header class="section-header">
        <h2 :id="titleId" ref="titleRef" class="section-title">
          {{ currentTitle }}
        </h2>
        <p class="section-desc">{{ currentDesc }}</p>
      </header>
      <div v-if="tab === 'general'" class="pane">
        <component :is="GeneralSettings" />
      </div>
      <div v-else-if="tab === 'cleanup'" class="pane">
        <component :is="CleanupAdvancedSettings" />
      </div>
      <div v-else-if="tab === 'embeddings'" class="pane">
        <component :is="EmbeddingSettings" />
      </div>
      <div v-else-if="tab === 'vectorize'" class="pane">
        <component :is="VectorizeSettings" />
      </div>
      <div v-else-if="tab === 'notifications'" class="pane">
        <component :is="NotificationSettings" />
      </div>
      <div v-else-if="tab === 'account'" class="pane">
        <component :is="AccountSettings" />
      </div>
      <div v-else-if="tab === 'subscription'" class="pane">
        <component :is="SubscriptionSettings" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'
import { Tabs } from '../components/ui'
import { t } from '@/utils/i18n'

// 懒加载分区组件（首屏更快）
const GeneralSettings = defineAsyncComponent(
  () => import('./sections/GeneralSettings.vue')
)
const CleanupAdvancedSettings = defineAsyncComponent(
  () => import('./sections/CleanupAdvancedSettings.vue')
)
const EmbeddingSettings = defineAsyncComponent(
  () => import('./sections/EmbeddingSettings.vue')
)
const VectorizeSettings = defineAsyncComponent(
  () => import('./sections/VectorizeSettings.vue')
)
const NotificationSettings = defineAsyncComponent(
  () => import('./sections/NotificationSettings.vue')
)
const AccountSettings = defineAsyncComponent(
  () => import('./sections/AccountSettings.vue')
)
const SubscriptionSettings = defineAsyncComponent(
  () => import('./sections/SubscriptionSettings.vue')
)

type TabKey =
  | 'general'
  | 'cleanup'
  | 'embeddings'
  | 'vectorize'
  | 'notifications'
  | 'account'
  | 'subscription'
const tab = ref<TabKey>('general')
const tabs = [
  {
    value: 'general',
    key: 'settings.tab.general',
    fallback: '通用',
    icon: 'settings'
  },
  {
    value: 'cleanup',
    key: 'settings.tab.cleanup',
    fallback: '清理',
    icon: 'broom'
  },
  {
    value: 'embeddings',
    key: 'settings.tab.embeddings',
    fallback: '嵌入',
    icon: 'brain'
  },
  {
    value: 'vectorize',
    key: 'settings.tab.vectorize',
    fallback: '向量检索',
    icon: 'vector-circle'
  },
  {
    value: 'notifications',
    key: 'settings.tab.notifications',
    fallback: '通知',
    icon: 'bell'
  },
  {
    value: 'account',
    key: 'settings.tab.account',
    fallback: '账户',
    icon: 'account-circle'
  },
  {
    value: 'subscription',
    key: 'settings.tab.subscription',
    fallback: '订阅',
    icon: 'credit-card'
  }
] as const

function tf(key: string, fallback: string) {
  const v = t(key)
  // 若返回与 key 相同，说明没有命中字典，使用 fallback
  if (!v || v === key) return fallback
  return v
}

const tabsI18n = computed(() =>
  tabs.map(tb => ({
    value: tb.value,
    text: tf(tb.key, tb.fallback),
    icon: tb.icon
  }))
)

const titles = {
  general: 'settings.title.general',
  cleanup: 'settings.title.cleanup',
  embeddings: 'settings.title.embeddings',
  vectorize: 'settings.title.vectorize',
  notifications: 'settings.title.notifications',
  account: 'settings.title.account',
  subscription: 'settings.title.subscription'
} as const

const descs = {
  general: 'settings.desc.general',
  cleanup: 'settings.desc.cleanup',
  embeddings: 'settings.desc.embeddings',
  vectorize: 'settings.desc.vectorize',
  notifications: 'settings.desc.notifications',
  account: 'settings.desc.account',
  subscription: 'settings.desc.subscription'
} as const

const currentTitle = computed(() =>
  tf(titles[tab.value], tabs.find(x => x.value === tab.value)?.fallback || '')
)
const currentDesc = computed(() => tf(descs[tab.value], ''))

const allowed = new Set<TabKey>([
  'general',
  'cleanup',
  'embeddings',
  'vectorize',
  'notifications',
  'account',
  'subscription'
])

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
    if (
      url.hash &&
      (url.hash.startsWith('#tab=') || url.hash.startsWith('#/tab/'))
    ) {
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

watch(tab, v => writeTabToURL(v))

// 辅助：标题 id 与聚焦滚动
const titleRef = ref<HTMLElement | null>(null)
const titleId = computed(() => `settings-section-title-${tab.value}`)

watch(tab, async () => {
  // URL 已更新；等待下一次渲染后滚动并聚焦标题（改善可用性）
  await nextTick()
  try {
    titleRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    titleRef.value?.focus?.()
  } catch {}
})
</script>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 240px 1px 1fr;
  gap: 0;
  align-items: start;
}

/* 侧栏：粘性定位，跟随滚动 */
.sidebar {
  position: sticky;
  top: 12px;
  align-self: start;
  background: #f7f9fc;
  border-right: 1px solid var(--color-border);
  padding: 12px var(--spacing-sm);
  height: fit-content;
}

/* 小屏隐藏侧栏，显示顶部横向 tabs */
.top-tabs {
  display: none;
}

.divider {
  width: 1px;
  height: 100%;
  background: var(--color-border);
}

.content {
  min-height: 60vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px 28px;
  box-shadow: var(--shadow-xs);
}

.pane {
  padding: 4px;
}

/* Google 风格 tabs：侧栏项目 hover/active 背景柔和 */
.sidebar :deep(.acuity-tab) {
  border-radius: 12px;
  margin: 2px 0;
  padding: 10px 10px;
}
.sidebar :deep(.acuity-tab:hover:not(.acuity-tab--disabled)) {
  background: var(--color-surface-hover);
}
.sidebar :deep(.acuity-tab--active) {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-text-primary);
}

/* 内容区最大宽度，左右留白更舒适 */
.content {
  max-width: 960px;
}

.section-header {
  margin-bottom: 12px;
}
.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: 0.2px;
}
.section-desc {
  color: var(--color-text-secondary);
  margin: 0;
  font-size: 0.92rem;
}

@media (max-width: 920px) {
  .settings-layout {
    display: flex;
    flex-direction: column;
  }
  .sidebar {
    display: none;
  }
  .top-tabs {
    display: block;
    margin-bottom: 12px;
  }
}
</style>
