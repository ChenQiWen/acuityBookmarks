<template>
  <div class="bookmark-tree-node">
    <!-- 文件夹节点 -->
    <div
      v-if="node.children"
      class="folder-node"
      :class="{ 'folder-expanded': isExpanded }"
      :style="{ paddingLeft: `${level * 12}px` }"
    >
      <div class="folder-header" @click="toggleExpanded">
        <div class="folder-toggle">
          <Icon 
            :name="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'" 
            :size="14" 
          />
        </div>
        <div class="folder-icon">
          <Icon name="mdi-folder" :size="16" />
        </div>
        <div class="folder-title" :title="node.title">
          {{ node.title }}
        </div>
        <!-- 🎯 性能优化：直接使用预计算值 -->
        <div 
          class="folder-count" 
          :title="`该文件夹包含 ${bookmarkCount} 条书签`"
          :class="{ 'optimized': isOptimizedNode }"
        >
          {{ bookmarkCount }}
          <span v-if="isOptimizedNode" class="optimization-badge" title="使用超级缓存优化">⚡</span>
        </div>
      </div>
      
      <!-- 子节点（递归） -->
      <div v-if="isExpanded" class="folder-children">
        <BookmarkTreeNodeSuper
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :level="level + 1"
          :expanded-folders="expandedFolders"
          @navigate="$emit('navigate', $event)"
          @toggle-folder="(folderId, parentId) => $emit('toggleFolder', folderId, parentId)"
        />
      </div>
    </div>
    
    <!-- 书签节点 -->
    <div
      v-else
      class="bookmark-node"
      :style="{ paddingLeft: `${level * 12 + 26}px` }"
      @click="$emit('navigate', node)"
      :class="{ 'optimized': isOptimizedNode }"
    >
      <div class="bookmark-icon">
        <div v-if="isFaviconLoading" class="loading-indicator">
          <Icon name="mdi-loading" :size="14" class="spin" />
        </div>
        <img 
          v-else-if="faviconUrl" 
          :src="faviconUrl" 
          alt=""
          @error="handleIconError"
        />
        <Icon v-else name="mdi-web" :size="14" />
      </div>
      <div class="bookmark-title" :title="node.title">
        {{ node.title || '无标题' }}
        <span v-if="isOptimizedNode" class="optimization-badge" title="使用超级缓存优化">⚡</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { Icon } from './ui'
import { superGlobalBookmarkCache } from '../utils/super-global-cache'
import type { BookmarkNode } from '../types'
import type { SuperEnhancedBookmarkNode } from '../types/enhanced-bookmark'

// Props
interface Props {
  node: BookmarkNode | SuperEnhancedBookmarkNode
  level: number
  expandedFolders?: Set<string>
}
const props = defineProps<Props>()

// Emits
const $emit = defineEmits<{
  navigate: [bookmark: BookmarkNode | SuperEnhancedBookmarkNode]
  toggleFolder: [folderId: string, parentId?: string]
}>()

// 图标状态管理
const faviconUrl = ref<string>('')
const isFaviconLoading = ref<boolean>(false)

// 🎯 检测节点是否已经是优化过的SuperEnhancedBookmarkNode
const isOptimizedNode = computed(() => {
  return 'bookmarkCount' in props.node
})

// 计算属性 - 是否展开
const isExpanded = computed(() => {
  return props.expandedFolders?.has(props.node.id) || false
})

// 🎯 超高性能书签计数：O(1) vs O(n)
const bookmarkCount = computed(() => {
  if (!props.node.children) return 0
  
  // 如果是优化节点，直接返回预计算值 ⚡
  if ('bookmarkCount' in props.node) {
    return (props.node as SuperEnhancedBookmarkNode).bookmarkCount
  }
  
  // 如果不是优化节点，尝试从超级缓存获取
  try {
    // 确保超级缓存已初始化
    if (superGlobalBookmarkCache.getCacheStatus() !== 'missing') {
      const cachedNode = superGlobalBookmarkCache.getNodeById(props.node.id)
      if (cachedNode) {
        return cachedNode.bookmarkCount
      }
    }
  } catch (error) {
    console.warn('从超级缓存获取数据失败，使用传统计算:', error)
  }
  
  // 💡 降级到传统递归计算（性能较差）
  console.warn('⚠️ 性能降级：使用传统递归计算书签数量')
  return calculateBookmarkCountFallback(props.node.children)
})

// 🐌 传统递归计算方法（性能较差）
const calculateBookmarkCountFallback = (nodes: BookmarkNode[]): number => {
  let count = 0
  const countBookmarks = (nodeList: BookmarkNode[]) => {
    for (const node of nodeList) {
      if (node.url) {
        count++
      } else if (node.children) {
        countBookmarks(node.children)
      }
    }
  }
  
  countBookmarks(nodes)
  return count
}

// 方法
const toggleExpanded = () => {
  // 发出切换事件，传递当前节点ID和父节点ID
  $emit('toggleFolder', props.node.id, props.node.parentId)
}

// 🎯 优化版本的Favicon加载
const loadFavicon = async () => {
  if (!props.node.url || faviconUrl.value) return
  
  try {
    isFaviconLoading.value = true
    
    // 优先使用超级缓存的favicon服务
    try {
      const favicon = await superGlobalBookmarkCache.getFaviconForUrl(props.node.url, 14)
      if (favicon) {
        faviconUrl.value = favicon
        return
      }
    } catch (error) {
      console.warn('超级缓存获取favicon失败，使用降级方案:', error)
    }
    
    // 降级方案：直接使用Google Favicon服务
    const googleFaviconUrl = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(props.node.url)}&size=14`
    faviconUrl.value = googleFaviconUrl
    
  } catch (error) {
    console.error('加载图标失败:', error)
  } finally {
    isFaviconLoading.value = false
  }
}

const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  // 图标加载失败时，清除URL以显示默认图标
  faviconUrl.value = ''
}

// 生命周期 - 组件挂载时立即加载图标（对于书签节点）
onMounted(() => {
  if (props.node.url) {
    loadFavicon()
  }
})

// 监听器 - 节点变化时重新加载图标
watch(() => props.node, (newNode) => {
  if (newNode.url && newNode.url !== props.node.url) {
    faviconUrl.value = ''
    loadFavicon()
  }
}, { deep: true })
</script>

<style scoped>
.bookmark-tree-node {
  user-select: none;
}

/* 文件夹样式 */
.folder-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 32px;
}

.folder-header:hover {
  background: var(--color-surface-hover);
}

.folder-toggle {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  transition: transform 0.15s ease;
}

.folder-expanded .folder-toggle {
  transform: none;
}

.folder-icon {
  display: flex;
  align-items: center;
  color: var(--color-primary);
}

.folder-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-surface-variant);
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  display: flex;
  align-items: center;
  gap: 2px;
  transition: all 0.15s ease;
}

/* 🎯 优化节点的视觉标识 */
.folder-count.optimized {
  background: linear-gradient(135deg, var(--color-primary-alpha-20), var(--color-success-alpha-20));
  color: var(--color-primary);
  border: 1px solid var(--color-primary-alpha-30);
  font-weight: 600;
}

.folder-count.optimized:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px var(--color-primary-alpha-20);
}

.folder-children {
  animation: slideDown 0.15s ease-out;
}

/* 书签样式 */
.bookmark-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 28px;
}

.bookmark-node:hover {
  background: var(--color-surface-hover);
}

.bookmark-node:active {
  background: var(--color-surface-active);
  transform: scale(0.98);
}

/* 🎯 优化书签节点的视觉标识 */
.bookmark-node.optimized {
  border-left: 2px solid var(--color-success);
  background: linear-gradient(90deg, var(--color-success-alpha-5), transparent);
}

.bookmark-icon {
  display: flex;
  align-items: center;
  width: 14px;
  height: 14px;
}

.bookmark-icon img {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.bookmark-title {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 🎯 优化标识 */
.optimization-badge {
  font-size: 10px;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.optimization-badge:hover {
  opacity: 1;
}

/* 动画 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 深度缩进视觉优化 */
.bookmark-tree-node[style*="padding-left: 84px"] .folder-header,
.bookmark-tree-node[style*="padding-left: 110px"] .bookmark-node {
  position: relative;
}

.bookmark-tree-node[style*="padding-left: 84px"] .folder-header::before,
.bookmark-tree-node[style*="padding-left: 110px"] .bookmark-node::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 2px;
  height: 2px;
  background: var(--color-border);
  border-radius: 50%;
}

/* 🎯 性能对比提示动画 */
@keyframes performanceHighlight {
  0%, 100% { 
    box-shadow: 0 0 0 0 var(--color-success-alpha-50);
  }
  50% { 
    box-shadow: 0 0 0 4px var(--color-success-alpha-10);
  }
}

.folder-count.optimized:hover {
  animation: performanceHighlight 1s ease-in-out;
}
</style>
