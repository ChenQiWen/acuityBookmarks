<template>
  <!-- 📊 全局书签同步进度对话框 -->
  <GlobalSyncProgress />

  <!-- ⚡ 全局快速添加书签对话框 -->
  <GlobalQuickAddBookmark />

  <!-- 外部变更更新提示 -->
  <Dialog
    :show="showUpdatePrompt"
    title="检测到外部书签变更"
    icon="icon-sync-alert"
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
      <Button color="primary" :loading="isLoading" @click="confirmRefresh"
        >立即刷新</Button
      >
    </template>
  </Dialog>
  <div class="side-panel-container">
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
          <Icon name="icon-magnify" :size="16" />
        </template>
      </Input>
    </div>

    <!-- 收藏书签 -->
    <div v-if="!searchQuery" class="favorites-section">
      <FavoriteBookmarks
        :show-numbers="false"
        @bookmark-click="handleFavoriteClick"
        @bookmark-remove="handleFavoriteRemove"
      />
    </div>

    <!-- 书签导航树 - 统一组件 -->
    <div v-if="!searchQuery" class="bookmark-tree">
      <BookmarkTree
        :key="treeRefreshKey"
        :nodes="bookmarkTree"
        :selected-desc-counts="treeSelectedDescCounts"
        source="sidePanel"
        :loading="isLoading"
        height="calc(100vh - 200px)"
        size="compact"
        :searchable="false"
        selectable="single"
        :editable="false"
        :show-toolbar="false"
        :accordion-mode="true"
        :show-favorite-button="true"
        @ready="handleTreeReady"
        @node-click="navigateToBookmark"
        @folder-toggle="handleFolderToggle"
        @bookmark-open-new-tab="handleBookmarkOpenNewTab"
        @bookmark-copy-url="handleBookmarkCopyUrl"
        @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
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
        <Icon name="icon-bookmark-remove-outline" :size="32" />
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
            <Icon v-else name="icon-web" :size="20" />
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
import {
  defineOptions,
  onMounted,
  onUnmounted,
  ref,
  watch,
  shallowRef
} from 'vue'
import { storeToRefs } from 'pinia'

defineOptions({
  name: 'SidePanelPage'
})
import { Button, Dialog, Icon, Input, Spinner } from '@/components'
import BookmarkTree from '@/components/composite/BookmarkTree/BookmarkTree.vue'
import FavoriteBookmarks from '@/components/composite/FavoriteBookmarks/FavoriteBookmarks.vue'
import GlobalSyncProgress from '@/components/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/GlobalQuickAddBookmark.vue'

import { useBookmarkStore } from '@/stores/bookmarkStore'
import { queryAppService } from '@/application/query/query-app-service'
import type {
  BookmarkNode,
  EnhancedSearchResult,
  SidePanelSearchItem,
  BookmarkUpdateDetail
} from './types'
import type { FavoriteBookmark } from '@/application/bookmark/favorite-app-service'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { AB_EVENTS } from '@/constants/events'
import { notifyInfo } from '@/application/notification/notification-service'
import {
  scheduleUIUpdate,
  scheduleMicrotask
} from '@/application/scheduler/scheduler-service'

// ==================== Store ====================
const bookmarkStore = useBookmarkStore()
const { bookmarkTree } = storeToRefs(bookmarkStore)

// ✅ SimpleBookmarkTree 必需的 props（纯 UI 组件）
const treeSelectedDescCounts = shallowRef(new Map<string, number>())

/**
 * 响应式状态
 * @description 响应式状态
 * @returns {boolean} 是否加载中
 * @throws {Error} 响应式状态失败
 */
const isLoading = ref(true)
/**
 * 通过切换 key 触发组件重挂载，达到刷新内部数据的目的
 * @description 通过切换 key 触发组件重挂载，达到刷新内部数据的目的
 * @returns {number} 刷新键
 * @throws {Error} 通过切换 key 触发组件重挂载，达到刷新内部数据的目的失败
 */
const treeRefreshKey = ref(0)

// ✅ 展开状态由 BookmarkTree 组件内部管理，SidePanel 不需要维护
/**
 * 搜索查询
 * @description 搜索查询
 * @returns {string} 搜索查询
 * @throws {Error} 搜索查询失败
 */
const searchQuery = ref('')
/**
 * 搜索结果
 * @description 搜索结果
 * @returns {SidePanelSearchItem[]} 搜索结果
 * @throws {Error} 搜索结果失败
 */
const searchResults = ref<SidePanelSearchItem[]>([])

/**
 * 转换为侧边栏结果
 * @description 转换为侧边栏结果
 * @param {EnhancedSearchResult} result 搜索结果
 * @returns {SidePanelSearchItem} 侧边栏结果
 * @throws {Error} 转换为侧边栏结果失败
 */
const toSidePanelResult = (
  result: EnhancedSearchResult
): SidePanelSearchItem => ({
  bookmark: {
    id: String(result.bookmark.id),
    title: result.bookmark.title,
    url: result.bookmark.url,
    path: result.bookmark.path
  },
  score: result.score,
  matchedFields: result.matchedFields,
  highlights: result.highlights
})
/**
 * 是否正在搜索
 * @description 是否正在搜索
 * @returns {boolean} 是否正在搜索
 * @throws {Error} 是否正在搜索失败
 */
const isSearching = ref(false)

// ✅ 使用Google favicon服务（CSP允许，更可靠）
/**
 * 获取favicon
 * @description 获取favicon
 * @param {string} url 书签URL
 * @returns {string} favicon
 * @throws {Error} 获取favicon失败
 */
const getFaviconForUrl = (url: string | undefined): string => {
  if (!url) return ''
  try {
    // 使用 Google favicon 服务（CSP已允许）
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=20`
  } catch {
    return ''
  }
}

// 监听搜索查询变化，调用统一API执行搜索（页面不做数据加工）
/**
 * 搜索查询变化监听器
 * @description 搜索查询变化监听器
 * @param {string} newQuery 新查询
 * @returns {void} 搜索查询变化监听器
 * @throws {Error} 搜索查询变化监听器失败
 */
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
      const coreResults = await queryAppService.search(q, { limit: 100 })
      searchResults.value = coreResults.map(toSidePanelResult)
    } catch (error) {
      logger.error('Component', 'SidePanel', '❌ 搜索失败', error)
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 200)
})

/**
 * 导航到书签（在当前标签页打开）
 * @description 导航到书签（在当前标签页打开）
 * @param {BookmarkNode | { id: string; url?: string; title: string }} bookmark 书签
 * @returns {void} 导航到书签（在当前标签页打开）
 * @throws {Error} 导航到书签（在当前标签页打开）失败
 */
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

/**
 * 在新标签页打开书签
 * @description 在新标签页打开书签
 * @param {string} url 书签URL
 * @returns {void} 在新标签页打开书签
 * @throws {Error} 在新标签页打开书签失败
 */
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

/**
 * 处理文件夹展开/收起
 * @description 接收 BookmarkTree 的展开状态变化通知（仅用于日志记录）
 * @param {string} folderId 文件夹ID
 * @param {BookmarkNode} node 文件夹节点
 * @param {boolean} expanded 是否展开
 * @returns {void} 处理文件夹展开/收起
 */
const handleFolderToggle = (
  folderId: string,
  node: BookmarkNode,
  expanded: boolean
) => {
  // ✅ 展开状态由 BookmarkTree 内部管理，这里只记录日志
  logger.debug('SidePanel', '📂 文件夹状态变化', {
    folderId,
    title: node.title,
    expanded
  })
}

/**
 * 处理收藏书签点击
 * @description 在新标签页打开收藏的书签
 * @param {FavoriteBookmark} favorite 收藏书签
 * @returns {void} 无返回值
 */
const handleFavoriteClick = async (favorite: FavoriteBookmark) => {
  logger.info('SidePanel', '⭐ 点击收藏书签:', favorite.title)

  try {
    await chrome.tabs.create({ url: favorite.url, active: true })
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ 打开收藏书签失败:', error)
    // 降级处理：使用window.open
    window.open(favorite.url, '_blank')
  }
}

/**
 * 处理收藏书签移除
 * @description 收藏书签被移除时的回调
 * @param {FavoriteBookmark} favorite 被移除的收藏书签
 * @returns {void} 无返回值
 */
const handleFavoriteRemove = (favorite: FavoriteBookmark) => {
  logger.info('SidePanel', '🗑️ 移除收藏书签:', favorite.title)
  notifyInfo(`已取消收藏: ${favorite.title}`)
}

/**
 * 处理书签收藏/取消收藏
 * @description 切换书签的收藏状态
 * @param {BookmarkNode} node 书签节点
 * @param {boolean} isFavorite 是否收藏
 * @returns {void} 无返回值
 */
const handleBookmarkToggleFavorite = async (
  node: BookmarkNode,
  isFavorite: boolean
) => {
  logger.info(
    'SidePanel',
    `${isFavorite ? '⭐ 收藏' : '🗑️ 取消收藏'}书签:`,
    node.title
  )

  try {
    const { favoriteAppService } = await import(
      '@/application/bookmark/favorite-app-service'
    )

    // 执行收藏/取消收藏操作（会发送事件）
    const success = isFavorite
      ? await favoriteAppService.addToFavorites(node.id)
      : await favoriteAppService.removeFromFavorites(node.id)

    if (success) {
      // 操作成功，显示提示
      notifyInfo(isFavorite ? `书签已收藏` : `书签已取消收藏`)

      // 重新加载书签数据以更新书签树中的星星图标
      // FavoriteBookmarks 组件会通过事件监听自动更新
      await bookmarkStore.loadFromIndexedDB()

      logger.debug('SidePanel', '✅ 书签数据已刷新，UI 应该已更新')
    } else {
      // 操作失败
      notifyInfo('操作失败，请重试')
    }
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ 切换收藏状态失败:', error)
    notifyInfo('操作失败，请重试')
  }
}

/**
 * 处理在新标签页打开书签
 * @description 处理在新标签页打开书签
 * @param {BookmarkNode} node 书签节点
 * @returns {void} 处理在新标签页打开书签
 * @throws {Error} 处理在新标签页打开书签失败
 */
const handleBookmarkOpenNewTab = async (node: BookmarkNode) => {
  logger.info('SidePanel', '📂 在新标签页打开', node.title, node.url)
  // SimpleBookmarkTree已经处理了实际的打开逻辑，这里可以添加额外的统计或日志记录
}

/**
 * 处理复制书签URL
 * @description 处理复制书签URL
 * @param {BookmarkNode} node 书签节点
 * @returns {void} 处理复制书签URL
 * @throws {Error} 处理复制书签URL失败
 */
const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  logger.info('SidePanel', '📋 复制URL成功', node.title, node.url)

  // 统一通知封装
  try {
    notifyInfo('书签链接已复制', '复制成功')
  } catch {
    logger.info('SidePanel', '✅ URL已复制到剪贴板', node.url)
  }
}

/**
 * 格式化URL显示
 * @description 格式化URL显示
 * @param {string} url 书签URL
 * @returns {string} 格式化后的URL
 * @throws {Error} 格式化URL显示失败
 */
const formatUrl = (url: string) => {
  // 返回完整的URL
  return url
}

/**
 * 图标错误处理
 * @description 图标错误处理
 * @param {Event} event 事件
 * @returns {void} 图标错误处理
 * @throws {Error} 图标错误处理失败
 */
const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

/**
 * 高亮搜索文本
 * @description 高亮搜索文本
 * @param {string} text 文本
 * @returns {string} 高亮搜索文本
 * @throws {Error} 高亮搜索文本失败
 */
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
  logger.info('SidePanel', '📱 书签树组件就绪，数据加载完成')
}

/**
 * 实时同步状态与更新提示
 * @description 实时同步状态与更新提示
 * @returns {void} 实时同步状态与更新提示
 * @throws {Error} 实时同步状态与更新提示失败
 */
const lastSyncTime = ref<number>(0)
/**
 * 显示更新提示
 * @description 显示更新提示
 * @returns {boolean} 显示更新提示
 * @throws {Error} 显示更新提示失败
 */
const showUpdatePrompt = ref<boolean>(false)

const pendingUpdateDetail = ref<BookmarkUpdateDetail | null>(null)

/**
 * 设置实时同步监听器
 * 🆕 使用 mitt 事件总线替代 window.addEventListener
 * @description 设置实时同步监听器
 * @returns {void} 设置实时同步监听器
 * @throws {Error} 设置实时同步监听器失败
 */
const setupRealtimeSync = () => {
  // 监听书签更新事件（🆕 使用 mitt）
  const unsubscribeUpdate = onEvent('bookmark:updated', data => {
    logger.info('SidePanel', '🔄 收到书签更新事件', data)
    scheduleUIUpdate(
      () => {
        // 转换 mitt payload 为原有的 BookmarkUpdateDetail 格式
        pendingUpdateDetail.value = {
          eventType: 'updated',
          id: data.id,
          changes: data.changes
        }
        showUpdatePrompt.value = true
      },
      { timeoutMs: 150 }
    )
  })

  // 监听数据库同步完成事件（🆕 使用 mitt），仅更新同步指示时间，避免打扰用户
  const unsubscribeSync = onEvent('data:synced', () => {
    scheduleUIUpdate(
      () => {
        lastSyncTime.value = Date.now()
        logger.info('SidePanel', '🟢 DB 同步完成，更新时间指示器')
      },
      { timeoutMs: 150 }
    )
  })

  // 返回清理函数
  return () => {
    unsubscribeUpdate()
    unsubscribeSync()
  }
}

/**
 * 初始化
 * @description 初始化
 * @returns {void} 初始化
 * @throws {Error} 初始化失败
 */
onMounted(async () => {
  try {
    logger.info('SidePanel', '🚀 SidePanel开始初始化...')

    // ✅ 1. 从 IndexedDB 加载书签数据（唯一数据源）
    isLoading.value = true
    try {
      await bookmarkStore.loadFromIndexedDB()
      logger.info('SidePanel', '✅ 书签数据加载完成')
    } catch (error) {
      logger.error('Component', 'SidePanel', '❌ 书签数据加载失败:', error)
    } finally {
      isLoading.value = false
    }

    // ✅ 2. 设置实时同步监听
    const cleanupSync = setupRealtimeSync()

    logger.info('SidePanel', '🎉 SidePanel初始化完成！')
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
          } catch (error) {
            logger.error(
              'Component',
              'SidePanel',
              '❌ SIDE_PANEL_STATE_CHANGED(sendMessage):',
              error
            )
          }
        }
      )
    } catch (error) {
      logger.error(
        'Component',
        'SidePanel',
        '❌ SIDE_PANEL_STATE_CHANGED(sendMessage):',
        error
      )
    }

    // 在组件卸载时清理监听器
    onUnmounted(() => {
      cleanupSync()
      logger.info('SidePanel', '🧹 实时同步监听器已清理')
    })
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ SidePanel初始化失败:', error)
    isLoading.value = false
  }
})

/**
 * 清理
 * @description 清理
 * @returns {void} 清理
 * @throws {Error} 清理失败
 */
onUnmounted(() => {
  // 安全重置loading状态
  isLoading.value = false

  // 广播侧边栏已关闭的状态
  try {
    chrome.runtime.sendMessage(
      {
        type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
        isOpen: false
      },
      () => {
        if (chrome?.runtime?.lastError) {
          logger.debug('SidePanel', '广播关闭状态失败（可忽略）')
        }
      }
    )
  } catch (error) {
    logger.debug('SidePanel', '广播关闭状态失败（可忽略）', error)
  }
})

/**
 * 刷新行动
 * @description 刷新行动
 * @returns {void} 刷新行动
 * @throws {Error} 刷新行动失败
 */
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
      { timeoutMs: 100 }
    )
  } catch (error) {
    logger.error('SidePanel', '❌ 刷新失败', error)
    // 刷新失败时也要重置loading状态
    isLoading.value = false
  }
}

/**
 * 暂缓刷新
 * @description 暂缓刷新
 * @returns {void} 暂缓刷新
 * @throws {Error} 暂缓刷新失败
 */
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

.side-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: var(--color-text-primary);
  background: var(--color-background);
  overflow: hidden;
}

/* 头部样式 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.sync-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: var(--spacing-sm);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border: 1px solid var(--color-success-border, rgb(16 185 129 / 20%));
  border-radius: var(--radius-lg);
  background: var(--color-success-background, rgb(16 185 129 / 10%));
}

.sync-icon {
  color: var(--color-success, #10b981);

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;
  animation: sync-pulse 2s infinite;
}

/* 搜索区域 */
.search-section {
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.favorites-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
}

.recommendations-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.recommendations-section :deep(.smart-recommendations) {
  padding: var(--spacing-sm) 0;
  border: none;
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
  padding: var(--spacing-sm);
  overflow-y: auto;
}

/* 搜索结果容器 */
.search-results {
  flex: 1;
  padding: var(--spacing-sm);
  overflow-y: auto;
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
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.search-item:hover {
  border-color: var(--color-border-hover);
  background: var(--color-surface-hover);
}

.search-item:active {
  background: var(--color-surface-active);

  /* 避免缩放引起视觉位移与重排 */
  box-shadow: 0 0 0 2px var(--color-primary-alpha-10) inset;
}

.search-item-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  width: 20px;
  height: 20px;
}

.search-item-icon img {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
}

.search-item-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0; /* 移除默认间距，由各元素的margin控制 */
  min-width: 0;
}

.search-item-title {
  margin-bottom: var(--spacing-0-5); /* 与URL的间距 */
  font-size: var(--text-base);
  font-weight: 600; /* 加粗书签名称 */
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-highlight {
  padding: 0 1px;
  border-radius: var(--radius-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-warning-alpha-20);
}

.search-item-path {
  margin-top: var(--spacing-0-5); /* 与其他元素保持一致的间距 */
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-left: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs); /* 增大字体提升可读性 */
  font-style: italic;
  white-space: nowrap;
  color: var(--color-text-secondary); /* 使用次级文本颜色，比三级更明显 */
  background: var(--color-surface-variant);
  opacity: 0.95; /* 稍微增加不透明度 */
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-item-url {
  margin: -1px calc(-1 * var(--spacing-1)) var(--spacing-0-5)
    calc(-1 * var(--spacing-1)); /* 添加底部间距与路径保持一致 */

  padding: 1px var(--spacing-1);
  border-radius: var(--radius-xs);
  outline: none; /* 移除focus时的边框 */
  font-size: var(--text-sm); /* 增大字体提升可读性 */
  text-decoration: none;
  white-space: nowrap; /* URL单行显示 */
  color: var(--color-primary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出显示省略号 */
}

.search-item-url:hover {
  text-decoration: underline;
  color: var(--color-primary-400, var(--color-primary));
  background: var(--color-primary-alpha-10);
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
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-10) var(--spacing-5);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-16) var(--spacing-5);
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 滚动条使用浏览器默认样式 */
</style>
