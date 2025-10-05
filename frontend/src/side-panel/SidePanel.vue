<template>
  <!-- 外部变更更新提示 -->
  <Dialog
    :show="showUpdatePrompt"
    @update:show="showUpdatePrompt = $event"
    title="检测到外部书签变更"
    icon="mdi-sync-alert">
    <div class="update-prompt-content">
      <p>是否立即刷新侧边栏数据？</p>
      <div class="update-detail" v-if="pendingUpdateDetail">
        <small>类型：{{ pendingUpdateDetail.eventType }}，ID：{{ pendingUpdateDetail.id }}</small>
      </div>
    </div>
    <template #actions>
      <Button variant="text" @click="postponeRefresh">稍后再说</Button>
      <Button color="primary" @click="confirmRefresh">立即刷新</Button>
    </template>
  </Dialog>
  <div class="side-panel-container">
    <!-- 简洁头部 -->
    <div class="panel-header" style="display: flex; align-items: center; justify-content: space-between;">
      <div class="header-title">
        <Icon name="mdi-bookmark-outline" :size="18" />
        <span>书签导航</span>
        <!-- ✅ Phase 1: 实时同步状态指示器 -->
        <div v-if="lastSyncTime > 0" class="sync-indicator" :title="`最后同步: ${new Date(lastSyncTime).toLocaleTimeString()}`">
          <Icon name="mdi-sync" :size="12" class="sync-icon" />
        </div>
      </div>
      
      <Button
        variant="text"
        icon="mdi-cog"
        size="sm"
        @click="openSettings"
        title="打开设置"
        class="settings-btn"
      />
      <Button
        variant="text"
        icon="mdi-close"
        size="sm"
        @click="closeSidePanel"
        title="关闭侧边栏"
        class="close-btn"
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
    <div class="bookmark-tree" v-if="!searchQuery">
      <SimpleBookmarkTree
        source="sidePanel"
        :loading="isLoading"
        height="calc(100vh - 200px)"
        size="compact"
        :searchable="false"
        selectable="single"
        :editable="false"
        :show-toolbar="false"
        :initial-expanded="Array.from(expandedFolders)"
        :key="treeRefreshKey"
        @ready="handleTreeReady"
        @node-click="navigateToBookmark"
        @folder-toggle="handleFolderToggle"
        @bookmark-open-new-tab="handleBookmarkOpenNewTab"
        @bookmark-copy-url="handleBookmarkCopyUrl"
      />
    </div>

    <!-- 搜索结果 -->
    <div class="search-results" v-else>
      <div v-if="isSearching" class="loading-state">
        <Spinner size="sm" />
        <span>搜索中...</span>
      </div>
      
      <div v-else-if="searchResults.length === 0" class="empty-state">
        <Icon name="mdi-bookmark-remove-outline" :size="32" />
        <p>未找到匹配的书签</p>
      </div>
      
      <div v-else class="search-items">
        <div
          v-for="bookmark in searchResults"
          :key="bookmark.id"
          class="search-item"
          @click="navigateToBookmark(bookmark)"
        >
          <div class="search-item-icon">
            <img 
              v-if="bookmark.url && getFaviconForUrl(bookmark.url)" 
              :src="getFaviconForUrl(bookmark.url)" 
              alt=""
              @error="handleIconError"
            />
            <Icon v-else name="mdi-web" :size="20" />
          </div>
          
          <div class="search-item-content">
            <div class="search-item-title" :title="bookmark.title" v-html="highlightSearchText(bookmark.title)">
            </div>
            <a 
              class="search-item-url" 
              :href="bookmark.url"
              :title="bookmark.url + ' (点击在新标签页打开)'"
              @click.stop="openInNewTab(bookmark.url)"
            >
              {{ formatUrl(bookmark.url || '') }}
            </a>
            <div class="search-item-path" v-if="bookmark.path?.length" :title="bookmark.path.join(' / ')">
              {{ bookmark.path.join(' / ') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Button, Input, Icon, Spinner } from '../components/ui'
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue'
import SmartBookmarkRecommendations from '../components/SmartBookmarkRecommendations.vue'
 
import { sidePanelAPI } from '../utils/unified-bookmark-api'
import type { BookmarkNode } from '../types'
import type { SmartRecommendation } from '../services/smart-recommendation-engine'
import { logger } from '../utils/logger'
// ✅ Phase 1: 现代化书签服务 (暂时未使用，Phase 2时启用)
// import { modernBookmarkService } from '../services/modern-bookmark-service'

// 响应式状态
const isLoading = ref(true)
// 通过切换 key 触发组件重挂载，达到刷新内部数据的目的
const treeRefreshKey = ref(0)
const expandedFolders = ref<Set<string>>(new Set())
const searchQuery = ref('')
const searchResults = ref<any[]>([])
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
watch(searchQuery, async (newQuery) => {
  const q = (newQuery || '').trim()
  if (!q) {
    searchResults.value = []
    isSearching.value = false
    return
  }
  isSearching.value = true
  try {
    const result: any = await sidePanelAPI.searchBookmarks(q)
    // 统一处理返回结构（数组或对象）
    searchResults.value = Array.isArray(result) ? result : (result?.results ?? [])
  } catch (error) {
    logger.error('SidePanel', '❌ 搜索失败', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
})


// 方法 - 导航到书签（在当前标签页打开）
const navigateToBookmark = async (bookmark: BookmarkNode) => {
  if (!bookmark.url) return
  
  try {
    // 在当前标签页中导航到书签URL
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { url: bookmark.url })
    }
  } catch (error) {
    logger.error('SidePanel', '导航失败', error)
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
  logger.error('SidePanel', '❌ 新标签页打开失败', error)
    // 降级处理：使用window.open
    window.open(url, '_blank')
  }
}

// 方法 - 打开设置页面
const openSettings = () => {
  try {
    const url = chrome?.runtime?.getURL ? chrome.runtime.getURL('settings.html') : '/settings.html'
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
      await chrome.sidePanel.setOptions({ tabId: currentTab.id, enabled: false })
      try { chrome.runtime.sendMessage({ type: 'SIDE_PANEL_STATE_CHANGED', isOpen: false }) } catch {}
    }
  logger.info('SidePanel', '✅ 侧边栏已关闭')
  } catch (error) {
  logger.error('SidePanel', '❌ 关闭侧边栏失败', error)
  }
}

// ✅ Phase 2 Step 2: 智能推荐事件处理
const handleRecommendationClick = (bookmark: SmartRecommendation, _event: MouseEvent) => {
  logger.info('SidePanel', '🔗 推荐点击', bookmark.title, bookmark.recommendationType)
  // 注意：不要在这里打开链接！SmartBookmarkRecommendations组件已经处理了打开链接的逻辑
  // 这里只做额外的跟踪和日志记录
}

const handleRecommendationUpdate = (recommendations: SmartRecommendation[]) => {
  logger.info('SidePanel', '📊 推荐更新', recommendations.length, '个推荐')
}

const handleRecommendationFeedback = (recommendationId: string, feedback: 'accepted' | 'rejected' | 'clicked') => {
  logger.info('SidePanel', '📝 推荐反馈', recommendationId, feedback)
  // TODO: 可以将反馈数据发送到后台进行分析
}

// 🔧 修复：处理文件夹展开/收起（统一组件事件处理）
const handleFolderToggle = (folderId: string, _node: BookmarkNode, expanded: boolean) => {
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
  logger.error('SidePanel', '记录用户行为失败', error)
  }
}

// 处理复制书签URL
const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  logger.info('SidePanel', '📋 复制URL成功', node.title, node.url)
  
  // 显示成功提示
  try {
    if ('Notification' in window && (window.Notification as any).permission === 'granted') {
      const notification = new (window.Notification as any)('书签链接已复制', {
        body: `已复制：${node.title}`,
        icon: '/icons/icon-48.png',
        tag: 'bookmark-copy'
      })
      
      // 2秒后自动关闭
      setTimeout(() => notification.close(), 2000)
    } else {
      // 降级到控制台提示
  logger.info('SidePanel', '✅ URL已复制到剪贴板', node.url)
    }
  } catch (error) {
    // 如果通知失败，至少在控制台显示成功信息
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
  return text.substring(0, index) + 
         '<span class="search-highlight">' + text.substring(index, index + query.length) + '</span>' + 
         text.substring(index + query.length)
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
const pendingUpdateDetail = ref<any>(null)

// ✅ Phase 1: 实时同步监听器
const setupRealtimeSync = () => {
  // 监听自定义书签更新事件
  const handleBookmarkUpdate = (event: any) => {
    logger.info('SidePanel', '🔄 收到书签更新事件', event.detail)
    pendingUpdateDetail.value = event.detail
    showUpdatePrompt.value = true
  }

  window.addEventListener('acuity-bookmark-updated', handleBookmarkUpdate as (event: Event) => void)
  
  return () => {
    window.removeEventListener('acuity-bookmark-updated', handleBookmarkUpdate as (event: Event) => void)
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
  logger.info('SidePanel', '✅ [Phase 1] 现代化书签API集成完成 - 实时同步已启用')
    // 广播侧边栏已打开的状态，供popup同步
    try { chrome.runtime.sendMessage({ type: 'SIDE_PANEL_STATE_CHANGED', isOpen: true }) } catch {}
    
    // 在组件卸载时清理监听器
    onUnmounted(() => {
      cleanupSync()
  logger.info('SidePanel', '🧹 实时同步监听器已清理')
    })
    
  } catch (error) {
  logger.error('SidePanel', '❌ SidePanel初始化失败', error)
    
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
    showUpdatePrompt.value = false
    // 触发组件重载以刷新内部数据
    isLoading.value = true
    treeRefreshKey.value++
    lastSyncTime.value = Date.now()
    logger.info('SidePanel', '✅ 已刷新侧边栏数据')
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
  margin-right: 6px;
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
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-btn {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.settings-btn:hover {
  opacity: 1;
}

.close-btn {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.close-btn:hover {
  opacity: 1;
}

/* ✅ Phase 1: 实时同步状态指示器样式 */
.sync-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 6px;
  background: var(--color-success-background, rgba(16, 185, 129, 0.1));
  border-radius: 10px;
  border: 1px solid var(--color-success-border, rgba(16, 185, 129, 0.2));
}

.sync-icon {
  color: var(--color-success, #10b981);
  animation: sync-pulse 2s infinite;
}

@keyframes sync-pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 搜索区域 */
.search-section {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border);
}

/* ✅ Phase 2 Step 2: 智能推荐区域样式 */
.recommendations-section {
  padding: 0 16px 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.recommendations-section :deep(.smart-recommendations) {
  border: none;
  padding: 8px 0;
  background: transparent;
}

.recommendations-section :deep(.recommendations-title) {
  font-size: 13px;
  color: var(--color-text-primary);
}

.recommendations-section :deep(.recommendation-item) {
  padding: 6px 8px;
  border-radius: 4px;
}

.recommendations-section :deep(.recommendation-item:hover) {
  background: var(--color-background-hover);
}

.recommendations-section :deep(.bookmark-title) {
  font-size: 12px;
}

.recommendations-section :deep(.bookmark-meta) {
  font-size: 10px;
}

/* 书签树容器 */
.bookmark-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* 搜索结果容器 */
.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
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
  border-radius: 4px;
}

.search-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0; /* 移除默认间距，由各元素的margin控制 */
}

.search-item-title {
  font-size: 13px;
  font-weight: 600; /* 加粗书签名称 */
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px; /* 与URL的间距 */
}

.search-highlight {
  background: var(--color-warning-alpha-20);
  color: var(--color-text-primary);
  font-weight: 600;
  border-radius: 2px;
  padding: 0 1px;
}

.search-item-path {
  font-size: 11px; /* 增大字体提升可读性 */
  color: var(--color-text-secondary); /* 使用次级文本颜色，比三级更明显 */
  background: var(--color-surface-variant);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px; /* 与其他元素保持一致的间距 */
  font-style: italic;
  border-left: 2px solid var(--color-primary);
  opacity: 0.95; /* 稍微增加不透明度 */
}

.search-item-url {
  font-size: 12px; /* 增大字体提升可读性 */
  color: var(--color-primary);
  white-space: nowrap; /* URL单行显示 */
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出显示省略号 */
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 3px;
  padding: 1px 3px;
  margin: -1px -3px 2px -3px; /* 添加底部间距与路径保持一致 */
  outline: none; /* 移除focus时的边框 */
}

.search-item-url:hover {
  color: var(--color-primary-dark);
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
  gap: 12px;
  padding: 40px 20px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.empty-state p {
  color: var(--color-text-secondary);
  font-size: 13px;
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
  border-radius: 3px;
  transition: background 0.2s ease;
}

.bookmark-tree::-webkit-scrollbar-thumb:hover,
.search-results::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}


</style>
