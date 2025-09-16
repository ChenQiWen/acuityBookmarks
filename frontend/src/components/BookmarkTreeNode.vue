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
        <div class="folder-count" :title="`该文件夹包含 ${bookmarkCount} 条书签`">{{ bookmarkCount }}</div>
      </div>
      
      <!-- 子节点（递归） -->
      <div v-if="isExpanded" class="folder-children">
        <BookmarkTreeNode
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
    >
      <div class="bookmark-icon">
        <img 
          v-if="faviconUrl" 
          :src="faviconUrl" 
          alt=""
          @error="handleIconError"
        />
        <Icon v-else name="mdi-web" :size="14" />
      </div>
      <div class="bookmark-title" :title="node.title">
        {{ node.title || '无标题' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from './ui'
// import { useFavicon } from '../composables/useFavicon'  // 暂时禁用
// import { FaviconLoadPriority } from '../services/favicon-service'  // 暂时禁用
import type { BookmarkNode } from '../types'

// Props
interface Props {
  node: BookmarkNode
  level: number
  expandedFolders?: Set<string>
}
const props = defineProps<Props>()

// Emits
const $emit = defineEmits<{
  navigate: [bookmark: BookmarkNode]
  toggleFolder: [folderId: string, parentId?: string]
}>()

// 暂时使用简单的favicon URL生成（恢复功能优先）
const faviconUrl = computed(() => {
  if (!props.node.url) return ''
  try {
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(props.node.url)}&size=14`
  } catch {
    return ''
  }
})

// 计算属性 - 是否展开
const isExpanded = computed(() => {
  return props.expandedFolders?.has(props.node.id) || false
})

// 计算属性 - 高性能书签计数（使用缓存）
const bookmarkCountCache = new Map<string, { count: number; timestamp: number }>()

const bookmarkCount = computed(() => {
  if (!props.node.children) return 0
  
  // 使用节点ID和子节点数量作为缓存键
  const cacheKey = `${props.node.id}-${props.node.children?.length || 0}`
  const cached = bookmarkCountCache.get(cacheKey)
  
  // 如果有效缓存存在且未过期（5分钟）
  if (cached && (Date.now() - cached.timestamp) < 300000) {
    return cached.count
  }
  
  // 计算书签数量
  let count = 0
  const countBookmarks = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      if (node.url) {
        count++
      } else if (node.children) {
        countBookmarks(node.children)
      }
    }
  }
  
  countBookmarks(props.node.children)
  
  // 缓存结果
  bookmarkCountCache.set(cacheKey, { count, timestamp: Date.now() })
  
  // 清理过期缓存（每100次计算清理一次）
  if (Math.random() < 0.01) {
    const now = Date.now()
    for (const [key, value] of bookmarkCountCache.entries()) {
      if (now - value.timestamp > 300000) {
        bookmarkCountCache.delete(key)
      }
    }
  }
  
  return count
})

// 方法
const toggleExpanded = () => {
  // 发出切换事件，传递当前节点ID和父节点ID
  $emit('toggleFolder', props.node.id, props.node.parentId)
}

// 图标错误处理
const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  // 图标加载失败时隐藏图标，显示默认Web图标
}
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
</style>
