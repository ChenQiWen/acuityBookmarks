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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Button, Input, Icon, Spinner } from '../components/ui'
import BookmarkTreeNode from '../components/BookmarkTreeNode.vue'
import { sidePanelAPI } from '../utils/unified-bookmark-api'
import type { BookmarkNode } from '../types'
import { createBookmarkSearchPresets } from '../composables/useBookmarkSearch'

// 响应式状态
const isLoading = ref(true)
const bookmarkTree = ref<BookmarkNode[]>([])
const expandedFolders = ref<Set<string>>(new Set())

// 使用通用搜索功能 - 延迟初始化，等书签数据加载完成
let searchInstance: ReturnType<ReturnType<typeof createBookmarkSearchPresets>['sidebarSearch']> | null = null
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)

// 在书签数据加载完成后初始化搜索
const initializeSearch = () => {
  if (bookmarkTree.value.length > 0 && !searchInstance) {
    try {
      const searchPresets = createBookmarkSearchPresets()
      // 调用函数创建搜索实例
      searchInstance = searchPresets.sidebarSearch(bookmarkTree.value)
      
      // 建立响应式同步 - 监听搜索实例的状态变化
      watch(() => searchInstance?.searchResults.value, (newResults) => {
        if (newResults) {
          searchResults.value = newResults
        }
      }, { immediate: true })
      
      watch(() => searchInstance?.isSearching.value, (newIsSearching) => {
        if (typeof newIsSearching === 'boolean') {
          isSearching.value = newIsSearching
        }
      }, { immediate: true })
      
      console.log('✅ SidePanel搜索组件初始化成功')
    } catch (error) {
      console.error('❌ SidePanel搜索组件初始化失败:', error)
    }
  }
}

// 计算属性 - 根文件夹（书签栏、其他书签、移动书签）
const rootFolders = computed(() => {
  // bookmarkTree.value 已经通过 extractRootFolders 提取了所有根文件夹
  // 包括：书签栏、其他书签、移动设备书签等
  return bookmarkTree.value
})

// 暂时使用简单的favicon URL生成（恢复功能优先）
const getFaviconForUrl = (url: string | undefined): string => {
  if (!url) return ''
  try {
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=20`
  } catch {
    return ''
  }
}

// 监听搜索查询变化，触发搜索
watch(searchQuery, (newQuery) => {
  if (searchInstance) {
    searchInstance.handleSearchInput(newQuery)
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

// 方法 - 加载书签数据（使用统一API）
const loadBookmarks = async () => {
  try {
    console.log('🚀 侧边栏开始加载书签数据...')
    
    // 🚀 使用统一API获取书签数据
    const bookmarkData = await sidePanelAPI.getBookmarkHierarchy(5);
    
    if (bookmarkData && Array.isArray(bookmarkData)) {
      // 将书签数据转换为树形结构
      const tree = convertBookmarkDataToTree(bookmarkData);
      const rootFolders = extractRootFolders(tree);
      bookmarkTree.value = rootFolders;
      
      console.log('✅ 侧边栏书签数据加载完成！', {
        rootFolderCount: bookmarkTree.value.length,
        totalItems: bookmarkData.length
      });
      
      // 初始化搜索功能
      initializeSearch();
    } else {
      console.warn('📚 未获取到书签数据或数据格式错误');
    }
  } catch (error) {
    console.error('❌ 加载书签失败:', error)
    console.log('📊 错误详情:', (error as Error).message, (error as Error).stack)
  } finally {
    isLoading.value = false
  }
}

// 🎯 辅助方法 - 将书签数据转换为树形结构
const convertBookmarkDataToTree = (flatData: any[]): BookmarkNode[] => {
  const idMap = new Map<string, BookmarkNode>();
  const result: BookmarkNode[] = [];

  // 第一遍：创建所有节点
  flatData.forEach(item => {
    const node: BookmarkNode = {
      id: item.id,
      title: item.title,
      url: item.url,
      children: item.url ? undefined : []
    };
    idMap.set(item.id, node);
  });

  // 第二遍：建立父子关系
  flatData.forEach(item => {
    const node = idMap.get(item.id)!;
    if (item.parentId && idMap.has(item.parentId)) {
      const parent = idMap.get(item.parentId)!;
      if (parent.children) {
        parent.children.push(node);
      }
    } else {
      // 根节点
      result.push(node);
    }
  });

  return result;
};

// 🎯 辅助方法 - 提取根文件夹
const extractRootFolders = (tree: any[]): BookmarkNode[] => {
  // 对于超级增强书签数据，直接返回根节点的children
  // 或者如果是Chrome原始数据，提取第一个节点的children
  if (tree.length > 0) {
    // 如果第一个节点有children且title为空（Chrome根节点特征）
    if (tree[0].children && (!tree[0].title || tree[0].title === '')) {
      return tree[0].children as unknown as BookmarkNode[]
    }
    // 否则直接返回tree（可能已经是根文件夹数组）
    return tree as unknown as BookmarkNode[]
  }
  return []
}

// 数据更新监听器已移除 - IndexedDB架构下不需要

// favicon加载功能已移至Service Worker底层预处理

// 初始化
onMounted(async () => {
  try {
    console.log('🚀 SidePanel开始初始化...')
    
    // 1️⃣ 直接加载书签数据（使用IndexedDB）
    await loadBookmarks()
    
    console.log('🎉 SidePanel初始化完成！')
  } catch (error) {
    console.error('❌ SidePanel初始化失败:', error)
    
    // 设置错误状态，让用户看到友好的错误提示
    isLoading.value = false
    // 可以显示一个错误消息给用户
  }
})

// 清理（IndexedDB架构下无需清理数据监听器）
onUnmounted(() => {
  // 当前无需清理
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
