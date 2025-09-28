<!--
  📄 简化版书签树节点组件
-->

<template>
  <div class="simple-tree-node" :class="nodeClasses" :style="nodeStyle">
    <!-- 文件夹节点 -->
    <div
      v-if="isFolder"
      class="node-content folder-content"
      @click="handleFolderClick"
      @dblclick="handleDoubleClick"
    >
      <!-- 展开/收起图标 -->
      <div class="expand-icon" @click.stop="handleToggleClick">
        <Icon 
          :name="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'" 
          :size="16" 
        />
      </div>

      <!-- 文件夹图标 -->
      <div class="folder-icon">
        <Icon 
          :name="isExpanded ? 'mdi-folder-open' : 'mdi-folder'" 
          :size="16"
          color="primary"
        />
      </div>

      <!-- 文件夹标题 -->
      <div class="node-title" :title="node.title">
        <span v-html="highlightedTitle"></span>
      </div>

      <!-- 书签计数 -->
      <div v-if="showCount" class="folder-count">
        {{ bookmarkCount }}
      </div>
    </div>

    <!-- 书签节点 -->
    <div
      v-else
      class="node-content bookmark-content"
      @click="handleBookmarkClick"
      @dblclick="handleDoubleClick"
    >
      <!-- 选择复选框 -->
      <div v-if="showCheckbox" class="select-checkbox">
        <input
          type="checkbox"
          :checked="isSelected"
          @change="handleSelectChange"
          @click.stop
        />
      </div>

      <!-- 书签图标/Favicon -->
      <div class="bookmark-icon">
        <img 
          v-if="faviconUrl" 
          :src="faviconUrl" 
          :alt="node.title"
          :style="{ width: '16px', height: '16px' }"
          @error="handleFaviconError"
        />
        <Icon 
          v-else 
          name="mdi-web" 
          :size="16" 
          color="secondary"
        />
      </div>

      <!-- 书签标题 -->
      <div class="node-title" :title="bookmarkTooltip">
        <span v-html="highlightedTitle"></span>
      </div>

      <!-- 书签URL (spacious模式显示) -->
      <div v-if="config.size === 'spacious' && node.url" class="bookmark-url">
        {{ truncatedUrl }}
      </div>
    </div>

    <!-- 子节点 -->
    <div v-if="isFolder && isExpanded && node.children && !isVirtualMode" class="children">
      <SimpleTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        :selected-nodes="selectedNodes"
        :search-query="searchQuery"
        :config="config"
        @node-click="(node, event) => $emit('node-click', node, event)"
        @node-double-click="(node, event) => $emit('node-double-click', node, event)"
        @folder-toggle="(folderId, node) => $emit('folder-toggle', folderId, node)"
        @node-select="(nodeId, node) => $emit('node-select', nodeId, node)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from './ui'
import type { BookmarkNode } from '../types'

// === Props 定义 ===
interface Props {
  node: BookmarkNode
  level: number
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  searchQuery?: string
  config: {
    size?: 'compact' | 'comfortable' | 'spacious'
    searchable?: boolean
    selectable?: boolean | 'single' | 'multiple'
    draggable?: boolean
    editable?: boolean
  }
  isVirtualMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  searchQuery: '',
  isVirtualMode: false
})

// === Emits 定义 ===
const emit = defineEmits<{
  'node-click': [node: BookmarkNode, event: MouseEvent]
  'node-double-click': [node: BookmarkNode, event: MouseEvent]
  'folder-toggle': [folderId: string, node: BookmarkNode]
  'node-select': [nodeId: string, node: BookmarkNode]
}>()

// === 计算属性 ===

const isFolder = computed(() => Boolean(props.node.children))
const isExpanded = computed(() => props.expandedFolders.has(props.node.id))
const isSelected = computed(() => props.selectedNodes.has(props.node.id))

const showCheckbox = computed(() => {
  return props.config.selectable === 'multiple'
})

const showCount = computed(() => {
  return isFolder.value && props.config.size !== 'compact'
})

const bookmarkCount = computed(() => {
  if (!isFolder.value || !props.node.children) return 0
  return countBookmarks(props.node.children)
})

const faviconUrl = computed(() => {
  if (!props.node.url) return ''
  try {
    const url = new URL(props.node.url)
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`
  } catch {
    return ''
  }
})

const highlightedTitle = computed(() => {
  if (!props.searchQuery || !props.node.title) return props.node.title
  
  const query = props.searchQuery
  const title = props.node.title
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  
  return title.replace(regex, '<mark>$1</mark>')
})

const truncatedUrl = computed(() => {
  if (!props.node.url) return ''
  const maxLength = 40
  return props.node.url.length > maxLength 
    ? props.node.url.substring(0, maxLength) + '...'
    : props.node.url
})

const bookmarkTooltip = computed(() => {
  const parts = [props.node.title]
  if (props.node.url) parts.push(props.node.url)
  return parts.join('\n')
})

const nodeClasses = computed(() => ({
  'node--folder': isFolder.value,
  'node--bookmark': !isFolder.value,
  'node--expanded': isExpanded.value,
  'node--selected': isSelected.value,
  [`node--level-${props.level}`]: true,
  [`node--${props.config.size || 'comfortable'}`]: true
}))

const nodeStyle = computed(() => ({
  paddingLeft: `${props.level * getIndentSize()}px`
}))

// === 事件处理 ===

const handleFolderClick = (event: MouseEvent) => {
  emit('node-click', props.node, event)
}

const handleBookmarkClick = (event: MouseEvent) => {
  if (props.config.selectable === 'single') {
    emit('node-select', props.node.id, props.node)
  }
  emit('node-click', props.node, event)
}

const handleDoubleClick = (event: MouseEvent) => {
  emit('node-double-click', props.node, event)
}

const handleToggleClick = () => {
  emit('folder-toggle', props.node.id, props.node)
}

const handleSelectChange = () => {
  emit('node-select', props.node.id, props.node)
}

const handleFaviconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// === 工具函数 ===

function countBookmarks(nodes: BookmarkNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.url) {
      return count + 1
    } else if (node.children) {
      return count + countBookmarks(node.children)
    }
    return count
  }, 0)
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getIndentSize(): number {
  switch (props.config.size) {
    case 'compact': return 16
    case 'spacious': return 24
    default: return 20
  }
}
</script>

<style scoped>
.simple-tree-node {
  position: relative;
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: var(--item-height, 32px);
}

.node-content:hover {
  background: var(--color-surface-hover);
}

.node-content:active {
  background: var(--color-surface-active);
}

.node--selected .node-content {
  background: var(--color-primary-subtle);
  color: var(--color-primary-emphasis);
}

/* 展开图标 */
.expand-icon {
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: var(--border-radius-xs);
  transition: transform 0.15s ease;
}

.expand-icon:hover {
  background: var(--color-surface-variant);
}

/* 文件夹样式 */
.folder-icon {
  display: flex;
  align-items: center;
  color: var(--color-primary);
}

/* 书签样式 */
.select-checkbox {
  display: flex;
  align-items: center;
}

.bookmark-icon {
  display: flex;
  align-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.bookmark-icon img {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  object-fit: cover;
}

/* 标题 */
.node-title {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.node-title :deep(mark) {
  background: var(--color-warning-subtle);
  color: var(--color-warning-emphasis);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

/* 文件夹计数 */
.folder-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-surface-variant);
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  font-weight: 500;
}

/* 书签URL */
.bookmark-url {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-surface-variant);
  padding: 2px 6px;
  border-radius: var(--border-radius-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

/* 子节点 */
.children {
  position: relative;
}

.children::before {
  content: '';
  position: absolute;
  left: calc(var(--indent-size, 20px) + 8px);
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-border);
  opacity: 0.3;
}

/* 尺寸变体 */
.node--compact .node-content {
  min-height: 28px;
  padding: 2px 6px;
}

.node--compact .node-title {
  font-size: 12px;
}

.node--spacious .node-content {
  min-height: 40px;
  padding: 6px 12px;
  gap: 8px;
}

.node--spacious .node-title {
  font-size: 14px;
}

/* 层级样式 */
.node--level-0 .node-content {
  font-weight: 500;
}

/* 动画 */
.children {
  animation: slideDown 0.2s ease-out;
}

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
</style>
