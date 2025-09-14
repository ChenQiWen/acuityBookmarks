<template>
  <div class="side-panel-container">
    <!-- 简洁头部 -->
    <div class="panel-header">
      <div class="header-title">
        <Icon name="mdi-bookmark-outline" :size="18" />
        <span>书签导航</span>
      </div>
      <Button
        variant="text"
        icon="mdi-cog"
        size="sm"
        @click="openManagement"
        title="打开管理页面"
        class="settings-btn"
      />
    </div>

    <!-- 搜索栏 -->
    <div class="search-section">
      <Input
        v-model="searchQuery"
        placeholder="快速搜索书签..."
        type="text"
        variant="outlined"
        density="compact"
        clearable
        @input="handleSearch"
      >
        <template #prepend>
          <Icon name="mdi-magnify" :size="16" />
        </template>
      </Input>
    </div>

    <!-- 书签导航树 -->
    <div class="bookmark-tree" v-if="!searchQuery">
      <div v-if="isLoading" class="loading-state">
        <Spinner size="sm" />
        <span>加载书签...</span>
      </div>
      
      <BookmarkTreeNode
        v-else
        v-for="folder in rootFolders"
        :key="folder.id"
        :node="folder"
        :level="0"
        :expanded-folders="expandedFolders"
        @navigate="navigateToBookmark"
        @toggle-folder="handleFolderToggle"
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
              v-if="bookmark.faviconUrl" 
              :src="bookmark.faviconUrl" 
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Button, Input, Icon, Spinner } from '../components/ui'
import BookmarkTreeNode from '../components/BookmarkTreeNode.vue'
import { globalBookmarkCache } from '../utils/global-bookmark-cache'
import type { BookmarkNode } from '../types'

// 增强的搜索结果项类型
interface EnhancedBookmarkResult extends BookmarkNode {
  path: string[]
  faviconUrl?: string
  isFaviconLoading?: boolean
}

// 响应式状态
const searchQuery = ref('')
const isSearching = ref(false)
const isLoading = ref(true)
const bookmarkTree = ref<BookmarkNode[]>([])
const expandedFolders = ref<Set<string>>(new Set())

// 计算属性 - 根文件夹（书签栏、其他书签、移动书签）
const rootFolders = computed(() => {
  // bookmarkTree.value 已经通过 extractRootFolders 提取了所有根文件夹
  // 包括：书签栏、其他书签、移动设备书签等
  return bookmarkTree.value
})

// 搜索结果图标缓存
const searchFaviconCache = ref<Map<string, string>>(new Map())

// 计算属性 - 搜索结果（带路径和图标）
const searchResults = computed(() => {
  if (!searchQuery.value.trim() || !bookmarkTree.value.length) return []
  
  const query = searchQuery.value.toLowerCase()
  const results: Array<EnhancedBookmarkResult> = []
  
  // 递归搜索所有书签，构建路径
  const searchInNodes = (nodes: BookmarkNode[], currentPath: string[] = []) => {
    nodes.forEach(node => {
      if (node.url) {
        // 这是一个书签
        const titleMatch = node.title?.toLowerCase().includes(query)
        let domainMatch = false
        
        // 只匹配域名，不匹配完整路径
        try {
          const urlObj = new URL(node.url)
          domainMatch = urlObj.hostname.toLowerCase().includes(query)
        } catch {
          // URL解析失败时，仍使用原URL进行匹配
          domainMatch = node.url.toLowerCase().includes(query)
        }
        
        if (titleMatch || domainMatch) {
          results.push({
            ...node,
            path: [...currentPath], // 记录完整路径
            faviconUrl: searchFaviconCache.value.get(node.url) || '',
            isFaviconLoading: false
          })
        }
      } else if (node.children) {
        // 这是一个文件夹，递归搜索（添加当前文件夹到路径）
        const newPath = [...currentPath, node.title]
        searchInNodes(node.children, newPath)
      }
    })
  }
  
  searchInNodes(bookmarkTree.value)
  const limitedResults = results.slice(0, 50) // 限制搜索结果数量
  
  // 异步加载图标
  loadFaviconsForSearchResults(limitedResults)
  
  return limitedResults
})

// 方法 - 搜索处理（防抖）
let searchTimeout: number
const handleSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    isSearching.value = true
    // 模拟搜索延迟
    setTimeout(() => {
      isSearching.value = false
    }, 150)
  }, 200)
}

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
    console.error('导航失败:', error)
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
    console.log('✅ 已在新标签页打开:', url)
  } catch (error) {
    console.error('❌ 新标签页打开失败:', error)
    // 降级处理：使用window.open
    window.open(url, '_blank')
  }
}

// 方法 - 打开管理页面
const openManagement = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('management.html') })
}

// 方法 - 处理文件夹展开/收起（同级互斥）
const handleFolderToggle = (folderId: string, parentId?: string) => {
  const newExpanded = new Set(expandedFolders.value)
  
  if (newExpanded.has(folderId)) {
    // 如果当前文件夹已展开，则收起
    newExpanded.delete(folderId)
  } else {
    // 如果当前文件夹未展开，则展开并收起同级文件夹
    if (parentId) {
      // 收起同级的所有文件夹
      const parentNode = findNodeById(bookmarkTree.value, parentId)
      if (parentNode?.children) {
        parentNode.children.forEach(sibling => {
          if (sibling.children && sibling.id !== folderId) {
            newExpanded.delete(sibling.id)
          }
        })
      }
    } else {
      // 根级别文件夹：收起其他根级文件夹
      rootFolders.value.forEach(rootFolder => {
        if (rootFolder.id !== folderId) {
          newExpanded.delete(rootFolder.id)
        }
      })
    }
    
    newExpanded.add(folderId)
  }
  
  expandedFolders.value = newExpanded
}

// 辅助方法 - 根据ID查找节点
const findNodeById = (nodes: BookmarkNode[], targetId: string): BookmarkNode | null => {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node
    }
    if (node.children) {
      const found = findNodeById(node.children, targetId)
      if (found) return found
    }
  }
  return null
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

// 方法 - 加载书签数据（使用全局预加载缓存）
const loadBookmarks = async () => {
  try {
    console.log('🚀 侧边栏开始加载书签数据...')
    
    // 🎯 使用全局预加载缓存获取书签数据
    const tree = await globalBookmarkCache.getBookmarkTree()
    
    if (tree && tree.length > 0) {
      // 提取根节点的children作为根文件夹（书签栏、其他书签等）
      bookmarkTree.value = extractRootFolders(tree)
      
      // 获取缓存统计信息
      const stats = await globalBookmarkCache.getCacheStats()
      console.log('📊 侧边栏书签数据加载完成', {
        folders: bookmarkTree.value.length,
        cacheAge: Math.round(stats.dataAge / 1000) + 's',
        fromCache: stats.isFromCache
      })
    } else {
      console.warn('📚 侧边栏未获取到书签数据')
    }
  } catch (error) {
    console.error('❌ 加载书签失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 辅助方法 - 提取根文件夹
const extractRootFolders = (tree: chrome.bookmarks.BookmarkTreeNode[]): BookmarkNode[] => {
  // Chrome书签树的第一个节点是根节点，我们需要它的children
  if (tree.length > 0 && tree[0].children) {
    return tree[0].children as unknown as BookmarkNode[]
  }
  return []
}

// 数据更新监听器
let unsubscribeDataUpdate: (() => void) | null = null

// 方法 - 为搜索结果异步加载图标
const loadFaviconsForSearchResults = async (results: EnhancedBookmarkResult[]) => {
  // 收集需要加载图标的唯一域名
  const domainsToLoad = new Set<string>()
  results.forEach(bookmark => {
    if (bookmark.url && !searchFaviconCache.value.has(bookmark.url)) {
      const domain = extractDomain(bookmark.url)
      if (domain) domainsToLoad.add(domain)
    }
  })

  // 并发加载图标（限制并发数）
  const domains = Array.from(domainsToLoad)
  const BATCH_SIZE = 3 // 搜索结果图标加载使用更小的批次

  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(async domain => {
        try {
          const faviconUrl = await globalBookmarkCache.getFaviconForUrl(`https://${domain}`)
          if (faviconUrl) {
            // 更新缓存，所有该域名的书签都使用同一图标
            results.forEach(bookmark => {
              if (bookmark.url && extractDomain(bookmark.url) === domain) {
                searchFaviconCache.value.set(bookmark.url, faviconUrl)
              }
            })
          }
        } catch (error) {
          console.error(`Failed to load favicon for ${domain}:`, error)
        }
      })
    )
  }
}

// 辅助方法 - 提取域名
const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

// 初始化
onMounted(async () => {
  // 加载书签数据
  await loadBookmarks()
  
  // 监听数据更新
  unsubscribeDataUpdate = globalBookmarkCache.onDataUpdate(() => {
    console.log('📊 侧边栏收到数据更新通知，重新加载...')
    loadBookmarks()
  })
})

// 清理
onUnmounted(() => {
  if (unsubscribeDataUpdate) {
    unsubscribeDataUpdate()
  }
})
</script>

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

/* 搜索区域 */
.search-section {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-border);
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
  transform: scale(0.99);
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
