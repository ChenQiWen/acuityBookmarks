<template>
  <!-- 📊 全局书签同步进度对话框 -->
  <GlobalSyncProgress />

  <!-- ⚡ 全局快速添加书签对话框 -->
  <GlobalQuickAddBookmark />

  <App app class="app-container">
    <AppHeader
      :show-side-panel-toggle="false"
      :show-settings="false"
      :show-account="false"
    />
    <Main class="main-content">
      <div class="settings-body">
        <aside
          class="settings-sidebar"
          aria-label="Settings Sections"
          data-testid="settings-sidebar"
        >
          <Tabs
            v-model="tab"
            :tabs="tabsI18n"
            variant="pills"
            orientation="vertical"
            :aria-label="t('settings_sidebar')"
            data-testid="tabs-vertical"
          />
        </aside>

        <main class="settings-content" role="region">
          <div v-if="tab === 'general'" class="pane">
            <component :is="GeneralSettings" />
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
          <div v-else-if="tab === 'shortcuts'" class="pane">
            <component :is="ShortcutSettings" />
          </div>
        </main>
      </div>
    </Main>
  </App>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'
import { App, AppHeader, Main, Tabs } from '@/components'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import { t } from '@/infrastructure'
import { onEvent } from '@/infrastructure/events/event-bus'
import { useSupabaseAuth } from '@/composables'

// 使用 Supabase Auth 检查登录状态
const { isAuthenticated, initialize } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

defineOptions({
  name: 'SettingsPage',
  components: {
    Tabs
  },
  inheritAttrs: false
})

// 懒加载分区组件（首屏更快）
const GeneralSettings = defineAsyncComponent(
  () => import('./sections/GeneralSettings.vue')
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
const ShortcutSettings = defineAsyncComponent(
  () => import('./sections/ShortcutSettings.vue')
)
const AccountSettings = defineAsyncComponent(
  () => import('./sections/AccountSettings.vue')
)
const SubscriptionSettings = defineAsyncComponent(
  () => import('./sections/SubscriptionSettings.vue')
)

type TabKey =
  | 'general'
  | 'embeddings'
  | 'vectorize'
  | 'notifications'
  | 'shortcuts'
  | 'account'
  | 'subscription'
const tab = ref<TabKey>('general')
const tabs = [
  {
    value: 'general',
    key: 'settings_tab_general',
    fallback: '通用',
    icon: 'icon-more-vertical'
  },
  {
    value: 'embeddings',
    key: 'settings_tab_embeddings',
    fallback: '嵌入',
    icon: 'icon-brain'
  },
  {
    value: 'vectorize',
    key: 'settings_tab_vectorize',
    fallback: '向量检索',
    icon: 'icon-radar'
  },
  {
    value: 'notifications',
    key: 'settings_tab_notifications',
    fallback: '通知',
    icon: 'icon-notification'
  },
  {
    value: 'shortcuts',
    key: 'settings_tab_shortcuts',
    fallback: '快捷键',
    icon: 'icon-keyboard'
  },
  {
    value: 'account',
    key: 'settings_tab_account',
    fallback: '账户',
    icon: 'icon-account'
  },
  {
    value: 'subscription',
    key: 'settings_tab_subscription',
    fallback: '计划',
    icon: 'icon-crown'
  }
] as const

function tf(key: string, fallback: string) {
  const v = t(key)
  // 若返回与 key 相同，说明没有命中字典，使用 fallback
  if (!v || v === key) return fallback
  return v
}

const tabsI18n = computed(() =>
  tabs
    .filter(tb => {
      // 未登录时隐藏账户模块
      if (tb.value === 'account' && !isLoggedIn.value) {
        return false
      }
      return true
    })
    .map(tb => ({
      value: tb.value,
      text: tf(tb.key, tb.fallback),
      icon: tb.icon
    }))
)

// 检查登录状态 - 使用 Supabase Auth（响应式，自动更新）
async function checkLoginStatus() {
  // Supabase Auth 的 isAuthenticated 是响应式的，会自动更新
  // 不需要手动检查 token

  // 如果未登录且当前选中的是 account，切换到 general
  if (!isLoggedIn.value && tab.value === 'account') {
    tab.value = 'general'
    writeTabToURL('general')
  }
}

const allowed = new Set<TabKey>([
  'general',
  'embeddings',
  'vectorize',
  'notifications',
  'shortcuts',
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

let unsubscribeLogin: (() => void) | null = null
let unsubscribeLogout: (() => void) | null = null

// 监听页面可见性变化（当从其他页面返回时刷新状态）
const handleVisibilityChange = () => {
  if (!document.hidden) {
    console.log('[Settings] 页面变为可见，重新检查登录状态...')
    checkLoginStatus()
  }
}

onMounted(async () => {
  console.log('[Settings] 页面挂载，开始检查登录状态...')

  // 等待 Supabase Auth 初始化完成（首次加载需要时间）
  await initialize()

  // 检查登录状态
  await checkLoginStatus()

  console.log('[Settings] 初始化完成，登录状态:', {
    isLoggedIn: isLoggedIn.value,
    isAuthenticated: isAuthenticated.value,
    currentTab: tab.value
  })

  const initial = readTabFromURL()
  // 如果 URL 中指定了 account 但未登录，忽略并切换到 general
  if (initial === 'account' && !isLoggedIn.value) {
    console.log('[Settings] URL 指定了 account 但未登录，切换到 general')
    tab.value = 'general'
    writeTabToURL('general')
  } else if (initial && initial !== tab.value) {
    console.log('[Settings] 从 URL 读取标签:', initial)
    tab.value = initial
  } else if (initial === 'account' && isLoggedIn.value) {
    console.log('[Settings] ✅ 用户已登录，显示账户设置')
    tab.value = 'account'
  }

  // 监听浏览器前进/后退
  window.addEventListener('popstate', syncFromURL)
  window.addEventListener('hashchange', syncFromURL)

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 监听登录/退出事件
  unsubscribeLogin = onEvent('auth:logged-in', async () => {
    console.log('[Settings] 收到登录事件，重新检查登录状态...', {
      isLoggedIn: isLoggedIn.value,
      isAuthenticated: isAuthenticated.value
    })
    // 等待一下，确保 user 和 session 已更新
    await new Promise(resolve => setTimeout(resolve, 100))
    await checkLoginStatus()
    // 如果当前在 account 标签，确保显示
    if (isLoggedIn.value && tab.value === 'account') {
      console.log('[Settings] ✅ 用户已登录，显示账户设置')
    }
    // 重新初始化以确保状态同步
    await initialize()
    // 增加延迟时间，确保状态已更新
    await new Promise(resolve => setTimeout(resolve, 300))
    await checkLoginStatus()
    // 如果登录成功且当前在 general，切换到 account
    if (isLoggedIn.value && tab.value === 'general') {
      tab.value = 'account'
      writeTabToURL('account')
    }
  })

  unsubscribeLogout = onEvent('auth:logged-out', async () => {
    await initialize()
    await checkLoginStatus()
    // 如果当前在 account 页面，切换到 general
    if (tab.value === 'account') {
      tab.value = 'general'
      writeTabToURL('general')
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncFromURL)
  window.removeEventListener('hashchange', syncFromURL)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (unsubscribeLogin) unsubscribeLogin()
  if (unsubscribeLogout) unsubscribeLogout()
})

watch(tab, v => {
  // 如果切换到 account 但未登录，切换到 general
  if (v === 'account' && !isLoggedIn.value) {
    tab.value = 'general'
    writeTabToURL('general')
    return
  }
  writeTabToURL(v)
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}

.main-content {
  flex: 1;
  background: var(--color-background);
  overflow: auto;
}

.settings-body {
  display: grid;
  align-items: start;
  gap: var(--spacing-5);
  grid-template-columns: 260px minmax(0, 1fr);
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.settings-sidebar {
  position: sticky;
  top: var(--spacing-4);
  align-self: start;
  padding: var(--spacing-4) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.settings-sidebar :deep(.acuity-tab) {
  margin: var(--spacing-1) 0;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
}

.settings-sidebar :deep(.acuity-tab:hover:not(.acuity-tab--disabled)) {
  background: var(--color-surface-hover);
}

.settings-sidebar :deep(.acuity-tab--active) {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.settings-content {
  min-height: 70vh;
  padding: var(--spacing-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.pane {
  padding: var(--spacing-2) 0;
}
</style>
