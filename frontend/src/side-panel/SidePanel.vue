<template>
  <!-- 外部变更更新提示 -->
  <Dialog
    :show="showUpdatePrompt"
    title="检测到外部书签变更"
    icon="mdi-sync-alert"
    @update:show="showUpdatePrompt = $event"
  >
    <div class="update-prompt-content">
      <p>是否立即刷新侧边栏数据？</p>
      <div v-if="pendingUpdateDetail" class="update-detail">
        <small
          >类型：{{ pendingUpdateDetail.eventType }}，ID：{{
            pendingUpdateDetail.id
          }}</small
        >
      </div>
    </div>
    <template #actions>
      <Button variant="text" @click="postponeRefresh">稍后再说</Button>
      <Button color="primary" @click="confirmRefresh">立即刷新</Button>
    </template>
  </Dialog>
  <div class="side-panel-container">
    <!-- 简洁头部 -->
    <div class="panel-header">
      <div class="header-title">
        <Icon name="mdi-bookmark-outline" :size="18" />
        <span>书签导航</span>
        <!-- ✅ Phase 1: 实时同步状态指示器 -->
        <div
          v-if="lastSyncTime > 0"
          class="sync-indicator"
          :title="`最后同步: ${new Date(lastSyncTime).toLocaleTimeString()}`"
        >
          <Icon name="mdi-sync" :size="12" class="sync-icon" />
        </div>
      </div>

      <Button
        variant="text"
        icon="mdi-cog"
        size="sm"
        title="打开设置"
        class="settings-btn"
        data-testid="btn-open-settings"
        @click="openSettings"
      />
      <Button
        variant="text"
        icon="mdi-close"
        size="sm"
        title="关闭侧边栏"
        class="close-btn"
        data-testid="btn-close-sidepanel"
        @click="closeSidePanel"
      />
    </div>

    <!-- 搜索栏 -->
    <div class="search-section">
      <Input
        v-model="searchQuery"
        placeholder="书签名称或者URL"
        type="text"
        variant="outlined"
        density="compact"
        clearable
        data-testid="input-search"
      >
        <template #prepend>
          <Icon name="mdi-magnify" :size="16" />
        </template>
      </Input>
    </div>

    <!-- ✅ Phase 2 Step 2: 智能推荐系统 -->
    <div v-if="!searchQuery && !isLoading" class="recommendations-section">
      <SmartBookmarkRecommendations
        :max-recommendations="3"
        :show-debug-info="false"
        :auto-refresh="true"
        @bookmark-click="handleRecommendationClick"
        @recommendation-update="handleRecommendationUpdate"
        @recommendation-feedback="handleRecommendationFeedback"
      />
    </div>

    <!-- 书签导航树 - 统一组件 -->
    <div v-if="!searchQuery" class="bookmark-tree">
      <SimpleBookmarkTree
        :key="treeRefreshKey"
        source="sidePanel"
        :loading="isLoading"
        height="calc(100vh - 200px)"
        size="compact"
        :searchable="false"
        selectable="single"
        :editable="false"
        :show-toolbar="false"
        :initial-expanded="Array.from(expandedFolders)"
        @ready="handleTreeReady"
        @node-click="navigateToBookmark"
        @folder-toggle="handleFolderToggle"
        @bookmark-open-new-tab="handleBookmarkOpenNewTab"
        @bookmark-copy-url="handleBookmarkCopyUrl"
      />
    </div>

    <!-- 搜索结果 -->
    <div v-else class="search-results">
      <div
        v-if="isSearching"
        class="loading-state"
        data-testid="search-loading"
      >
        <Spinner size="sm" />
        <span>搜索中...</span>
      </div>

      <div
        v-else-if="searchResults.length === 0"
        class="empty-state"
        data-testid="search-empty"
      >
        <Icon name="mdi-bookmark-remove-outline" :size="32" />
        <p>未找到匹配的书签</p>
      </div>

      <div v-else class="search-items" data-testid="search-items">
        <div
          v-for="searchResult in searchResults"
          :key="searchResult.bookmark.id"
          class="search-item"
          :data-id="searchResult.bookmark.id"
          @click="navigateToBookmark(searchResult.bookmark)"
        >
          <div class="search-item-icon">
            <img
              v-if="
                searchResult.bookmark.url &&
                getFaviconForUrl(searchResult.bookmark.url)
              "
              :src="getFaviconForUrl(searchResult.bookmark.url)"
              alt=""
              @error="handleIconError"
            />
            <Icon v-else name="mdi-web" :size="20" />
          </div>

          <div class="search-item-content">
            <div
              class="search-item-title"
              :title="searchResult.bookmark.title"
              v-html="highlightSearchText(searchResult.bookmark.title)"
            ></div>
            <a
              class="search-item-url"
              :href="searchResult.bookmark.url"
              :title="searchResult.bookmark.url + ' (点击在新标签页打开)'"
              @click.stop="openInNewTab(searchResult.bookmark.url)"
            >
              {{ formatUrl(searchResult.bookmark.url || '') }}
            </a>
            <div
              v-if="searchResult.bookmark.path?.length"
              class="search-item-path"
              :title="searchResult.bookmark.path.join(' / ')"
            >
              {{ searchResult.bookmark.path.join(' / ') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Button, Icon, Input, Spinner } from '../components/ui'
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue'
import SmartBookmarkRecommendations from '../components/SmartBookmarkRecommendations.vue'

import { searchAppService } from '@/application/search/search-app-service'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'
import type { BookmarkNode } from '../types'
import type { SmartRecommendation } from '../services/smart-recommendation-engine'
import { logger } from '@/infrastructure/logging/logger'
import { AB_EVENTS } from '@/constants/events'
import { notifyInfo } from '@/application/notification/notification-service'
import {
  scheduleUIUpdate,
  scheduleMicrotask
} from '@/application/scheduler/scheduler-service'
// ✅ Phase 1: 现代化书签服务 (暂时未使用，Phase 2时启用)
// import { modernBookmarkService } from '../services/modern-bookmark-service'

// 响应式状态
const isLoading = ref(true)
// 通过切换 key 触发组件重挂载，达到刷新内部数据的目的
const treeRefreshKey = ref(0)
const expandedFolders = ref<Set<string>>(new Set())
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)

// 暂时使用简单的favicon URL生成（恢复功能优先）
const getFaviconForUrl = (url: string | undefined): string => {
  if (!url) return ''
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=20`
  } catch {
    return ''
  }
}

// 监听搜索查询变化，调用统一API进行搜索（页面不做数据加工）
let searchDebounceTimer: number | null = null
watch(searchQuery, newQuery => {
  const q = (newQuery || '').trim()
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  searchDebounceTimer = window.setTimeout(async () => {
    if (!q) {
      searchResults.value = []
      isSearching.value = false
      return
    }
    isSearching.value = true
    try {
      const coreResults = await searchAppService.search(q, { limit: 100 })
      searchResults.value = coreResults
    } catch (error) {
      logger.error('Component', 'SidePanel', '❌ 搜索失败', error)
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 200)
})

// 方法 - 导航到书签（在当前标签页打开）
const navigateToBookmark = async (
  bookmark: BookmarkNode | { id: string; url?: string; title: string }
) => {
  if (!bookmark.url) return

  try {
    // 在当前标签页中导航到书签URL
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { url: bookmark.url })
    }
  } catch (error) {
    logger.error('Component', 'SidePanel', '导航失败', error)
    // 如果更新当前标签页失败，则创建新标签页
    chrome.tabs.create({ url: bookmark.url })
  }
}

// 方法 - 在新标签页打开书签
const openInNewTab = async (url?: string) => {
  if (!url) return

  try {
    await chrome.tabs.create({
      url: url,
      active: false // 在后台打开新标签页，不切换到新标签页
    })
    logger.info('SidePanel', '✅ 已在新标签页打开', url)
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ 新标签页打开失败', error)
    // 降级处理：使用window.open
    window.open(url, '_blank')
  }
}

// 方法 - 打开设置页面
const openSettings = () => {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : '/settings.html'
    window.open(url, '_blank')
  } catch {
    window.open('/settings.html', '_blank')
  }
}

// 关闭侧边栏并广播状态变化
const closeSidePanel = async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const currentTab = tabs[0]
    if (currentTab?.id) {
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        enabled: false
      })
      try {
        chrome.runtime.sendMessage(
          {
            type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
            isOpen: false
          },
          () => {
            try {
              if (chrome?.runtime?.lastError) {
                logger.debug(
                  'SidePanel',
                  'SIDE_PANEL_STATE_CHANGED(lastError):',
                  chrome.runtime.lastError?.message
                )
              }
            } catch {}
          }
        )
      } catch {}
    }
    logger.info('SidePanel', '✅ 侧边栏已关闭')
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ 关闭侧边栏失败', error)
  }
}

// ✅ Phase 2 Step 2: 智能推荐事件处理
const handleRecommendationClick = (bookmark: SmartRecommendation) => {
  logger.info(
    'SidePanel',
    '🔗 推荐点击',
    bookmark.title,
    bookmark.recommendationType
  )
  // 注意：不要在这里打开链接！SmartBookmarkRecommendations组件已经处理了打开链接的逻辑
  // 这里只做额外的跟踪和日志记录
}

const handleRecommendationUpdate = (recommendations: SmartRecommendation[]) => {
  logger.info('SidePanel', '📊 推荐更新', recommendations.length, '个推荐')
}

const handleRecommendationFeedback = (
  recommendationId: string,
  feedback: 'accepted' | 'rejected' | 'clicked'
) => {
  logger.info('SidePanel', '📝 推荐反馈', recommendationId, feedback)
  // TODO: 可以将反馈数据发送到后台进行分析
}

// 🔧 修复：处理文件夹展开/收起（统一组件事件处理）
const handleFolderToggle = (
  folderId: string,
  _node: BookmarkNode,
  expanded: boolean
) => {
  const newExpanded = new Set(expandedFolders.value)

  if (expanded) {
    newExpanded.add(folderId)
  } else {
    newExpanded.delete(folderId)
  }

  expandedFolders.value = newExpanded
}

// 🌟 新增：处理hover操作项事件

// 处理在新标签页打开书签
const handleBookmarkOpenNewTab = async (node: BookmarkNode) => {
  logger.info('SidePanel', '📂 在新标签页打开', node.title, node.url)
  // SimpleBookmarkTree已经处理了实际的打开逻辑，这里可以添加额外的统计或日志记录
  try {
    // 记录用户行为统计（可选）
    // await trackUserAction('bookmark_open_new_tab', { bookmarkId: node.id })
  } catch (error) {
    logger.error('Component', 'SidePanel', '记录用户行为失败', error)
  }
}

// 处理复制书签URL
const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  logger.info('SidePanel', '📋 复制URL成功', node.title, node.url)

  // 统一通知封装
  try {
    notifyInfo('书签链接已复制', '复制成功')
  } catch {
    logger.info('SidePanel', '✅ URL已复制到剪贴板', node.url)
  }
}

// 方法 - 格式化URL显示
const formatUrl = (url: string) => {
  // 返回完整的URL
  return url
}

// 方法 - 图标错误处理
const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 方法 - 高亮搜索文本
const highlightSearchText = (text: string) => {
  if (!searchQuery.value.trim()) return text

  const query = searchQuery.value.toLowerCase()
  const index = text.toLowerCase().indexOf(query)

  if (index === -1) return text

  // 返回HTML格式的高亮文本
  return `${text.substring(
    0,
    index
  )}<span class="search-highlight">${text.substring(
    index,
    index + query.length
  )}</span>${text.substring(index + query.length)}`
}

// 组件就绪回调：仅解除页面加载状态
const handleTreeReady = () => {
  isLoading.value = false
}

// 数据更新监听器已移除 - IndexedDB架构下不需要

// favicon加载功能已移至Service Worker底层预处理

// ✅ Phase 1: 实时同步状态与更新提示
const lastSyncTime = ref<number>(0)
const showUpdatePrompt = ref<boolean>(false)

// 定义书签更新事件的详细信息类型
interface BookmarkUpdateDetail {
  eventType: string
  id: string
  [key: string]: unknown
}

const pendingUpdateDetail = ref<BookmarkUpdateDetail | null>(null)

// ✅ Phase 1: 实时同步监听器
const setupRealtimeSync = () => {
  // 监听自定义书签更新事件
  const handleBookmarkUpdate = (event: CustomEvent<BookmarkUpdateDetail>) => {
    logger.info('SidePanel', '🔄 收到书签更新事件', event.detail)
    scheduleUIUpdate(
      () => {
        pendingUpdateDetail.value = event.detail
        showUpdatePrompt.value = true
      },
      { timeout: 150 }
    )
  }

  // 监听数据库同步完成事件，仅更新同步指示时间，避免打扰用户
  const handleDbSynced = () => {
    scheduleUIUpdate(
      () => {
        lastSyncTime.value = Date.now()
        logger.info('SidePanel', '🟢 DB 同步完成，更新时间指示器')
      },
      { timeout: 150 }
    )
  }

  window.addEventListener(
    AB_EVENTS.BOOKMARK_UPDATED,
    handleBookmarkUpdate as EventListener
  )
  window.addEventListener(AB_EVENTS.BOOKMARKS_DB_SYNCED, handleDbSynced)

  return () => {
    window.removeEventListener(
      AB_EVENTS.BOOKMARK_UPDATED,
      handleBookmarkUpdate as EventListener
    )
    window.removeEventListener(AB_EVENTS.BOOKMARKS_DB_SYNCED, handleDbSynced)
  }
}

// 初始化
onMounted(async () => {
  try {
    logger.info('SidePanel', '🚀 SidePanel开始初始化...')

    // ✅ Phase 1: 现代化书签服务准备就绪 (Phase 2时启用)
    logger.info('SidePanel', '🔗 现代化书签服务架构已就位，等待Phase 2启用...')

    // ✅ Phase 1: 设置实时同步监听器
    const cleanupSync = setupRealtimeSync()

    // 书签树由组件内部加载，页面不再主动加工数据

    logger.info('SidePanel', '🎉 SidePanel初始化完成！')
    logger.info(
      'SidePanel',
      '✅ [Phase 1] 现代化书签API集成完成 - 实时同步已启用'
    )
    // 广播侧边栏已打开的状态，供popup同步
    try {
      chrome.runtime.sendMessage(
        {
          type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
          isOpen: true
        },
        () => {
          try {
            if (chrome?.runtime?.lastError) {
              logger.debug(
                'SidePanel',
                'SIDE_PANEL_STATE_CHANGED(lastError):',
                chrome.runtime.lastError?.message
              )
            }
          } catch {}
        }
      )
    } catch {}

    // 在组件卸载时清理监听器
    onUnmounted(() => {
      cleanupSync()
      logger.info('SidePanel', '🧹 实时同步监听器已清理')
    })
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ SidePanel初始化失败', error)

    // 设置错误状态，让用户看到友好的错误提示
    isLoading.value = false
    // 可以显示一个错误消息给用户
  }
})

// 清理（IndexedDB架构下无需清理数据监听器）
onUnmounted(() => {
  // 当前无需清理
})

// 刷新行动
const confirmRefresh = async () => {
  try {
    scheduleMicrotask(() => (showUpdatePrompt.value = false))
    // 触发组件重载以刷新内部数据（在空闲时进行，避免阻塞交互）
    scheduleUIUpdate(
      () => {
        isLoading.value = true
        treeRefreshKey.value++
        lastSyncTime.value = Date.now()
        logger.info('SidePanel', '✅ 已刷新侧边栏数据')
      },
      { timeout: 100 }
    )
  } catch (error) {
    logger.error('SidePanel', '❌ 刷新失败', error)
  }
}

const postponeRefresh = () => {
  showUpdatePrompt.value = false
  logger.info('SidePanel', '⏸️ 已暂缓刷新侧边栏数据')
}
</script>

<style scoped>
.ai-badge-inline {
  margin-right: var(--spacing-1-5);
}
</style>

<style scoped>
.side-panel-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  color: var(--color-text-primary);
  overflow: hidden;
}

/* 头部样式 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-btn {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.settings-btn:hover {
  opacity: 1;
}

.close-btn {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.close-btn:hover {
  opacity: 1;
}

/* ✅ Phase 1: 实时同步状态指示器样式 */
.sync-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: var(--spacing-sm);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  background: var(--color-success-background, rgba(16, 185, 129, 0.1));
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-success-border, rgba(16, 185, 129, 0.2));
}

.sync-icon {
  color: var(--color-success, #10b981);
  animation: sync-pulse 2s infinite;
}

@keyframes sync-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 搜索区域 */
.search-section {
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

/* ✅ Phase 2 Step 2: 智能推荐区域样式 */
.recommendations-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.recommendations-section :deep(.smart-recommendations) {
  border: none;
  padding: var(--spacing-sm) 0;
  background: transparent;
}

.recommendations-section :deep(.recommendations-title) {
  font-size: var(--text-base);
  color: var(--color-text-primary);
}

.recommendations-section :deep(.recommendation-item) {
  padding: var(--spacing-1-5) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.recommendations-section :deep(.recommendation-item:hover) {
  background: var(--color-background-hover);
}

.recommendations-section :deep(.bookmark-title) {
  font-size: var(--text-xs);
}

.recommendations-section :deep(.bookmark-meta) {
  font-size: var(--text-xs);
}

/* 书签树容器 */
.bookmark-tree {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

/* 搜索结果容器 */
.search-results {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.search-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.search-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-sm) var(--spacing-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
  border: 1px solid transparent;
}

.search-item:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.search-item:active {
  background: var(--color-surface-active);
  /* 避免缩放引起视觉位移与重排 */
  box-shadow: 0 0 0 2px var(--color-primary-alpha-10) inset;
}

.search-item-icon {
  display: flex;
  align-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.search-item-icon img {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
}

.search-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0; /* 移除默认间距，由各元素的margin控制 */
}

.search-item-title {
  font-size: var(--text-base);
  font-weight: 600; /* 加粗书签名称 */
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--spacing-0-5); /* 与URL的间距 */
}

.search-highlight {
  background: var(--color-warning-alpha-20);
  color: var(--color-text-primary);
  font-weight: 600;
  border-radius: var(--radius-xs);
  padding: 0 1px;
}

.search-item-path {
  font-size: var(--text-xs); /* 增大字体提升可读性 */
  color: var(--color-text-secondary); /* 使用次级文本颜色，比三级更明显 */
  background: var(--color-surface-variant);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: var(--spacing-0-5); /* 与其他元素保持一致的间距 */
  font-style: italic;
  border-left: 2px solid var(--color-primary);
  opacity: 0.95; /* 稍微增加不透明度 */
}

.search-item-url {
  font-size: var(--text-sm); /* 增大字体提升可读性 */
  color: var(--color-primary);
  white-space: nowrap; /* URL单行显示 */
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出显示省略号 */
  text-decoration: none;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  border-radius: var(--radius-xs);
  padding: 1px var(--spacing-1);
  margin: -1px calc(-1 * var(--spacing-1)) var(--spacing-0-5)
    calc(-1 * var(--spacing-1)); /* 添加底部间距与路径保持一致 */
  outline: none; /* 移除focus时的边框 */
}

.search-item-url:hover {
  color: var(--color-primary-400, var(--color-primary));
  background: var(--color-primary-alpha-10);
  text-decoration: underline;
}

.search-item-url:focus {
  outline: none; /* 移除focus时的边框 */
  box-shadow: none; /* 移除可能的阴影 */
}

.search-item-url:visited {
  color: var(--color-primary); /* 访问后保持相同颜色 */
}

.search-item-url:active {
  color: var(--color-primary); /* 点击时保持相同颜色 */
  background: none; /* 移除点击时的背景 */
}

/* 加载和空状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  padding: var(--spacing-10) var(--spacing-5);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-4);
  padding: var(--spacing-16) var(--spacing-5);
  text-align: center;
}

.empty-state p {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}

/* 滚动条样式 */
.bookmark-tree::-webkit-scrollbar,
.search-results::-webkit-scrollbar {
  width: 6px;
}

.bookmark-tree::-webkit-scrollbar-track,
.search-results::-webkit-scrollbar-track {
  background: transparent;
}

.bookmark-tree::-webkit-scrollbar-thumb,
.search-results::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.bookmark-tree::-webkit-scrollbar-thumb:hover,
.search-results::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}
</style>
