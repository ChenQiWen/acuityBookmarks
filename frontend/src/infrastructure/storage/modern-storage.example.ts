/**
 * ModernStorage 使用示例
 *
 * 展示如何从旧的 chrome.storage.local 迁移到现代化存储方案
 */

import { modernStorage } from './modern-storage'

/**
 * 示例 1：存储用户会话状态（UI 折叠/展开）
 *
 * 🆕 使用 Session Storage（自动清理）
 */
async function exampleSessionState() {
  // ❌ 旧方式：使用 local 存储临时状态
  // await chrome.storage.local.set({ leftPanelExpanded: true })

  // ✅ 新方式：使用 session 存储
  await modernStorage.setSession('leftPanelExpanded', true)
  await modernStorage.setSession('rightPanelExpanded', false)

  // 读取
  const isExpanded = await modernStorage.getSession<boolean>(
    'leftPanelExpanded',
    false
  )
  console.log('Left panel expanded:', isExpanded)

  // 浏览器关闭后自动清理，无需手动删除
}

/**
 * 示例 2：存储搜索历史（会话级别）
 */
async function exampleSearchHistory() {
  interface SearchQuery {
    query: string
    timestamp: number
  }

  // 获取当前搜索历史（带默认值）
  const history =
    (await modernStorage.getSession<SearchQuery[]>('searchHistory')) ?? []

  // 添加新搜索
  const newQuery: SearchQuery = {
    query: 'javascript tutorial',
    timestamp: Date.now()
  }

  const updatedHistory = [newQuery, ...history].slice(0, 10) // 保留最近10条
  await modernStorage.setSession('searchHistory', updatedHistory)
}

/**
 * 示例 3：存储未保存的表单数据
 */
async function exampleFormDraft() {
  interface BookmarkDraft {
    title: string
    url: string
    tags: string[]
    lastModified: number
  }

  // 用户输入时自动保存草稿
  const draft: BookmarkDraft = {
    title: 'My New Bookmark',
    url: 'https://example.com',
    tags: ['tutorial', 'javascript'],
    lastModified: Date.now()
  }

  await modernStorage.setSession('bookmarkDraft', draft)

  // 页面刷新后恢复
  const savedDraft =
    await modernStorage.getSession<BookmarkDraft>('bookmarkDraft')
  if (savedDraft) {
    console.log('恢复草稿:', savedDraft)
  }
}

/**
 * 示例 4：存储 API 响应缓存（会话级别）
 */
async function exampleApiCache() {
  interface CacheEntry<T> {
    data: T
    timestamp: number
    expiresIn: number
  }

  async function fetchWithSessionCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5 * 60 * 1000 // 5分钟
  ): Promise<T> {
    // 检查缓存
    const cached = await modernStorage.getSession<CacheEntry<T>>(key)

    if (cached && Date.now() - cached.timestamp < cached.expiresIn) {
      console.log('命中缓存:', key)
      return cached.data
    }

    // 重新获取
    console.log('缓存过期，重新获取:', key)
    const data = await fetcher()

    await modernStorage.setSession(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttl
    })

    return data
  }

  // 使用
  const recommendations = await fetchWithSessionCache(
    'bookmark-recommendations',
    async () => {
      const response = await fetch('/api/recommendations')
      return response.json()
    }
  )

  console.log('推荐结果:', recommendations)
}

/**
 * 示例 5：批量设置会话数据
 */
async function exampleBatchSession() {
  await modernStorage.setBatchSession({
    'ui.leftPanel.expanded': true,
    'ui.leftPanel.width': 300,
    'ui.rightPanel.expanded': false,
    'ui.rightPanel.width': 400,
    'search.recentQueries': ['query1', 'query2'],
    'selection.bookmarkIds': ['1', '2', '3']
  })
}

/**
 * 示例 6：监听存储变化
 */
function exampleStorageListener() {
  // 监听 session 存储变化
  const unsubscribe = modernStorage.onChanged((changes, area) => {
    if (area === 'session') {
      console.log('Session 存储变化:', changes)

      // 同步 UI 状态
      if (changes.leftPanelExpanded) {
        const newValue = changes.leftPanelExpanded.newValue
        console.log('左侧面板状态变更:', newValue)
        // 更新 UI
      }
    }
  }, 'session')

  // 组件卸载时清理
  // onUnmounted(() => unsubscribe())

  return unsubscribe
}

/**
 * 示例 7：迁移指南 - Background Script
 */
async function migrationExample_BackgroundState() {
  // ❌ 旧代码（background/state.ts）
  /*
  async function saveState() {
    await chrome.storage.local.set({
      currentTab: { id: '123', url: 'https://example.com' },
      isProcessing: true,
      lastAction: 'bookmark-created'
    })
  }
  */

  // ✅ 新代码：区分持久化和会话数据
  async function saveStateMigrated() {
    // 持久化数据：使用 local
    await modernStorage.setLocal('lastSyncTime', Date.now())
    await modernStorage.setLocal('userPreferences', { theme: 'dark' })

    // 临时状态：使用 session
    await modernStorage.setSession('currentTab', {
      id: '123',
      url: 'https://example.com'
    })
    await modernStorage.setSession('isProcessing', true)
    await modernStorage.setSession('lastAction', 'bookmark-created')
  }

  await saveStateMigrated()
}

/**
 * 示例 8：清理会话数据
 */
async function exampleCleanup() {
  // 清空所有会话数据（例如：用户登出）
  await modernStorage.clearAllSession()

  console.log('✅ 所有会话数据已清空')
}

/**
 * 性能对比测试
 */
async function performanceTest() {
  const testData = { count: 100, items: Array(100).fill('test data') }

  console.time('Session Storage')
  await modernStorage.setSession('perfTest', testData)
  await modernStorage.getSession('perfTest')
  console.timeEnd('Session Storage')

  console.time('Local Storage')
  await modernStorage.setLocal('perfTest', testData)
  await modernStorage.getLocal('perfTest')
  console.timeEnd('Local Storage')

  // Session Storage 通常快 10-20%
}

/**
 * 类型安全示例
 */
async function exampleTypeSafety() {
  interface UserSession {
    userId: string
    displayName: string
    avatar: string
    loginTime: number
  }

  // 类型安全的存储和读取
  const session: UserSession = {
    userId: '123',
    displayName: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
    loginTime: Date.now()
  }

  await modernStorage.setSession<UserSession>('userSession', session)

  const retrieved = await modernStorage.getSession<UserSession>('userSession')

  if (retrieved) {
    console.log(retrieved.displayName) // 类型安全
    // console.log(retrieved.invalidKey) // ❌ TypeScript 错误
  }
}

// 导出所有示例
export {
  exampleSessionState,
  exampleSearchHistory,
  exampleFormDraft,
  exampleApiCache,
  exampleBatchSession,
  exampleStorageListener,
  migrationExample_BackgroundState,
  exampleCleanup,
  performanceTest,
  exampleTypeSafety
}
