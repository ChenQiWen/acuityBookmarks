<!--
  🌳 简化版统一书签目录树组件
  
  先实现基础功能，确保能正常工作
-->

<template>
  <div class="simple-bookmark-tree" :class="treeClasses">
    <!-- 搜索框 (可选) -->
    <div v-if="searchable" class="tree-search">
      <Input
        v-model="searchQuery"
        placeholder="搜索书签..."
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

    <!-- 树容器 -->
    <div class="tree-container" :style="containerStyles" ref="containerRef" @mouseleave="clearHoverAndActive">
      <!-- 标准渲染模式 -->
      <div v-if="!virtualEnabled" class="standard-content">
        <SimpleTreeNode
          v-for="node in filteredNodes"
          :key="node.id"
          :node="node"
          :level="0"
          :expanded-folders="expandedFolders"
          :selected-nodes="selectedNodes"
          :search-query="searchQuery"
          :config="treeConfig"
          :active-id="activeNodeId"
          :hovered-id="hoveredNodeId"
          @node-click="handleNodeClick"
          @folder-toggle="handleFolderToggle"
          @node-select="handleNodeSelect"
          @node-edit="handleNodeEdit"
          @node-delete="handleNodeDelete"
          @folder-add="handleFolderAdd"
          @bookmark-open-new-tab="handleBookmarkOpenNewTab"
          @bookmark-copy-url="handleBookmarkCopyUrl"
          @drag-drop="handleDragDrop"
          @node-hover="handleNodeHover"
          @node-hover-leave="handleNodeHoverLeave"
        />
      </div>

      <!-- 虚拟滚动模式 -->
      <div v-else class="virtual-content">
        <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }"></div>
        <div 
          class="virtual-items"
          :style="{ transform: `translateY(${offsetY}px)` }"
        >
          <SimpleTreeNode
            v-for="item in visibleItems"
            :key="item.id"
            :node="item.node"
            :level="item.level"
            :expanded-folders="expandedFolders"
            :selected-nodes="selectedNodes"
            :search-query="searchQuery"
            :config="treeConfig"
            :style="{ height: `${itemHeight}px` }"
            :active-id="activeNodeId"
            :hovered-id="hoveredNodeId"
            @node-click="handleNodeClick"
            @folder-toggle="handleFolderToggle"
            @node-select="handleNodeSelect"
            @node-edit="handleNodeEdit"
            @node-delete="handleNodeDelete"
            @folder-add="handleFolderAdd"
            @bookmark-open-new-tab="handleBookmarkOpenNewTab"
            @bookmark-copy-url="handleBookmarkCopyUrl"
            @drag-drop="handleDragDrop"
            @node-hover="handleNodeHover"
            @node-hover-leave="handleNodeHoverLeave"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!filteredNodes.length && !loading" class="empty-state">
        <Icon name="mdi-folder-outline" :size="48" color="secondary" />
        <p>暂无书签数据</p>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <Spinner size="md" />
        <span>加载中...</span>
      </div>
    </div>

    <!-- 工具栏：仅在存在可展示内容时渲染，避免出现空白条 -->
    <div v-if="shouldShowToolbar" class="tree-toolbar">
      <Button 
        v-if="selectedNodes.size > 0"
        variant="text" 
        size="sm" 
        @click="clearSelection"
      >
        清除选择 ({{ selectedNodes.size }})
      </Button>
      
      <div v-if="toolbarExpandCollapse" class="toolbar-actions">
        <Button 
          variant="text" 
          size="sm" 
          @click="expandAll"
          title="展开所有"
        >
          <Icon name="mdi-expand-all-outline" />
        </Button>
        <Button 
          variant="text" 
          size="sm" 
          @click="collapseAll"
          title="收起所有"
        >
          <Icon name="mdi-collapse-all-outline" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Input, Button, Icon, Spinner } from './ui'
import SimpleTreeNode from './SimpleTreeNode.vue'
import type { BookmarkNode } from '../types'
import { logger } from '@/utils/logger'

// === Props 定义 ===
interface Props {
  nodes: BookmarkNode[]
  loading?: boolean
  height?: string | number
  searchable?: boolean
  selectable?: boolean | 'single' | 'multiple'
  draggable?: boolean
  editable?: boolean
  virtual?: boolean | { enabled: boolean; itemHeight?: number; threshold?: number }
  size?: 'compact' | 'comfortable' | 'spacious'
  showToolbar?: boolean
  /** 是否显示工具栏中的“展开所有/收起所有”按钮 */
  toolbarExpandCollapse?: boolean
  initialExpanded?: string[]
  initialSelected?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  nodes: () => [],
  loading: false,
  height: '400px',
  searchable: false,
  selectable: false,
  draggable: false,
  editable: false,
  virtual: false,
  size: 'comfortable',
  showToolbar: true,
  toolbarExpandCollapse: true,
  initialExpanded: () => [],
  initialSelected: () => []
})

// === Emits 定义 ===
const emit = defineEmits<{
  'node-click': [node: BookmarkNode, event: MouseEvent]
  'folder-toggle': [folderId: string, node: BookmarkNode, expanded: boolean]
  'node-select': [nodeId: string, node: BookmarkNode, selected: boolean]
  'selection-change': [selectedIds: string[], nodes: BookmarkNode[]]
  'search': [query: string]
  'ready': []
  'node-edit': [node: BookmarkNode]
  'node-delete': [node: BookmarkNode]
  'folder-add': [parentNode: BookmarkNode]
  'bookmark-open-new-tab': [node: BookmarkNode]
  'bookmark-copy-url': [node: BookmarkNode]
  'drag-reorder': [dragData: any, targetNode: BookmarkNode, dropPosition: 'before' | 'after' | 'inside']
  'node-hover': [node: BookmarkNode]
  'node-hover-leave': [node: BookmarkNode]
}>()

// === 响应式状态 ===
const searchQuery = ref('')
const expandedFolders = ref(new Set(props.initialExpanded))
const selectedNodes = ref(new Set(props.initialSelected))
const activeNodeId = ref<string | undefined>(undefined)
const hoveredNodeId = ref<string | undefined>(undefined)
const containerRef = ref<HTMLElement | null>(null)

// === 计算属性 ===

// 树配置
const treeConfig = computed(() => ({
  size: props.size,
  searchable: props.searchable,
  selectable: props.selectable,
  draggable: props.draggable,
  editable: props.editable
}))

// 虚拟滚动配置
const virtualEnabled = computed(() => {
  if (typeof props.virtual === 'boolean') return props.virtual
  if (typeof props.virtual === 'object') return props.virtual.enabled
  return false
})

const itemHeight = computed(() => {
  if (typeof props.virtual === 'object' && props.virtual.itemHeight) {
    return props.virtual.itemHeight
  }
  return props.size === 'compact' ? 28 : props.size === 'spacious' ? 40 : 32
})

// Virtual threshold - currently not used but kept for future reference
// const virtualThreshold = computed(() => {
//   if (typeof props.virtual === 'object' && props.virtual.threshold) {
//     return props.virtual.threshold
//   }
//   return 100
// })

// 样式类
const treeClasses = computed(() => ({
  [`tree--${props.size}`]: true,
  'tree--virtual': virtualEnabled.value,
  'tree--loading': props.loading
}))

// 容器样式
const containerStyles = computed(() => {
  const height = typeof props.height === 'number' ? `${props.height}px` : props.height
  return {
    height,
    overflowY: virtualEnabled.value ? ('auto' as const) : ('visible' as const)
  }
})

// 过滤后的节点
const filteredNodes = computed(() => {
  if (!searchQuery.value) return props.nodes
  return filterNodes(props.nodes, searchQuery.value)
})

// 扁平化节点 (虚拟滚动用)
const flattenedItems = computed(() => {
  if (!virtualEnabled.value) return []
  return flattenNodes(filteredNodes.value, expandedFolders.value)
})

// 虚拟滚动相关 (当前简化版本暂不实现，保留接口)
// const scrollTop = ref(0)
// const containerHeight = ref(parseInt(String(props.height)) || 400)
const visibleRange = ref({ start: 0, end: 10 })

const totalHeight = computed(() => {
  return flattenedItems.value.length * itemHeight.value
})

const offsetY = computed(() => {
  return visibleRange.value.start * itemHeight.value
})

const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  return flattenedItems.value.slice(start, end + 1)
})

// 是否显示底部工具栏：当启用工具栏且存在内容（选择数>0 或 展开/收起按钮启用）时显示
const shouldShowToolbar = computed(() => {
  return (
    props.showToolbar && (
      selectedNodes.value.size > 0 || !!props.toolbarExpandCollapse
    )
  )
})

// === 事件处理 ===

const handleNodeClick = (node: BookmarkNode, event: MouseEvent) => {
  emit('node-click', node, event)
}

const handleFolderToggle = (folderId: string, node: BookmarkNode) => {
  const isExpanded = expandedFolders.value.has(folderId)
  if (isExpanded) {
    expandedFolders.value.delete(folderId)
  } else {
    expandedFolders.value.add(folderId)
  }
  
  emit('folder-toggle', folderId, node, !isExpanded)
}

// === 新增操作事件处理 ===

const handleNodeEdit = (node: BookmarkNode) => {
  emit('node-edit', node)
}

const handleNodeDelete = (node: BookmarkNode) => {
  emit('node-delete', node)
}

const handleFolderAdd = (parentNode: BookmarkNode) => {
  emit('folder-add', parentNode)
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (node.url) {
    emit('bookmark-open-new-tab', node)
  }
}

const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  // 复制成功的提示可以在调用组件中处理
  emit('bookmark-copy-url', node)
}

// 处理拖拽排序
const handleDragDrop = (dragData: any, targetNode: BookmarkNode, dropPosition: 'before' | 'after' | 'inside') => {
  logger.info('🎯 [SimpleBookmarkTree] 处理拖拽排序:', {
    dragData,
    targetNode: targetNode.title,
    dropPosition
  })
  
  emit('drag-reorder', dragData, targetNode, dropPosition)
}

const handleNodeHover = (node: BookmarkNode) => {
  emit('node-hover', node)
}

const handleNodeHoverLeave = (node: BookmarkNode) => {
  // 悬停移出时同时清空程序化 hover 与激活高亮
  hoveredNodeId.value = undefined
  activeNodeId.value = undefined
  emit('node-hover-leave', node)
}

const handleNodeSelect = (nodeId: string, node: BookmarkNode) => {
  const isSelected = selectedNodes.value.has(nodeId)
  
  if (props.selectable === 'single') {
    selectedNodes.value.clear()
    if (!isSelected) {
      selectedNodes.value.add(nodeId)
    }
  } else if (props.selectable === 'multiple') {
    if (isSelected) {
      selectedNodes.value.delete(nodeId)
    } else {
      selectedNodes.value.add(nodeId)
    }
  }
  
  const selected = selectedNodes.value.has(nodeId)
  emit('node-select', nodeId, node, selected)
  emit('selection-change', Array.from(selectedNodes.value), getSelectedNodes())
}

// Scroll handling for virtual scrolling (currently not used but kept for future)
// const handleScroll = (event: Event) => {
//   if (!virtualEnabled.value) return
//   
//   const target = event.target as HTMLElement
//   scrollTop.value = target.scrollTop
//   
//   const visibleStart = Math.floor(scrollTop.value / itemHeight.value)
//   const visibleEnd = Math.min(
//     flattenedItems.value.length - 1,
//     Math.ceil((scrollTop.value + containerHeight.value) / itemHeight.value)
//   )
//   
//   visibleRange.value = { start: visibleStart, end: visibleEnd }
// }

const expandAll = () => {
  const allFolderIds = getAllFolderIds(props.nodes)
  expandedFolders.value = new Set(allFolderIds)
}

const collapseAll = () => {
  expandedFolders.value = new Set()
}

const clearSelection = () => {
  selectedNodes.value = new Set()
  emit('selection-change', [], [])
}

// === 工具函数 ===

function filterNodes(nodes: BookmarkNode[], query: string): BookmarkNode[] {
  const lowerQuery = query.toLowerCase()
  return nodes.filter(node => {
    if (node.title.toLowerCase().includes(lowerQuery)) return true
    if (node.url?.toLowerCase().includes(lowerQuery)) return true
    if (node.children) {
      return filterNodes(node.children, query).length > 0
    }
    return false
  }).map(node => ({
    ...node,
    children: node.children ? filterNodes(node.children, query) : undefined
  }))
}

interface FlattenedItem {
  id: string
  node: BookmarkNode
  level: number
}

function flattenNodes(nodes: BookmarkNode[], expanded: Set<string>, level = 0): FlattenedItem[] {
  const result: FlattenedItem[] = []
  
  for (const node of nodes) {
    result.push({ id: node.id, node, level })
    
    if (node.children && expanded.has(node.id)) {
      result.push(...flattenNodes(node.children, expanded, level + 1))
    }
  }
  
  return result
}

function getAllFolderIds(nodes: BookmarkNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.children) {
      ids.push(node.id)
      ids.push(...getAllFolderIds(node.children))
    }
  }
  return ids
}

function getSelectedNodes(): BookmarkNode[] {
  const result: BookmarkNode[] = []
  const find = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      if (selectedNodes.value.has(node.id)) {
        result.push(node)
      }
      if (node.children) {
        find(node.children)
      }
    }
  }
  find(props.nodes)
  return result
}

function findPathToNode(nodes: BookmarkNode[], targetId: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    // 命中目标，返回当前祖先路径（不包含目标本身）
    if (node.id === targetId) {
      return path
    }
    // 深度优先：仅当进入子节点时才把当前节点加入路径
    if (node.children && node.children.length) {
      const result = findPathToNode(node.children, targetId, [...path, node.id])
      if (result) return result
    }
  }
  return null
}

// 通过ID查找节点，便于读取节点的 pathIds（IndexedDB 预处理字段）
function findNodeById(nodes: BookmarkNode[], id: string): BookmarkNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children && n.children.length) {
      const found = findNodeById(n.children, id)
      if (found) return found
    }
  }
  return null
}

async function focusNodeById(
  nodeId: string,
  options: { collapseOthers?: boolean; scrollIntoViewCenter?: boolean; pathIds?: string[] } = { collapseOthers: true, scrollIntoViewCenter: true }
) {
  activeNodeId.value = nodeId
  hoveredNodeId.value = nodeId
  // 优先使用节点的 pathIds（首个为根，最后一个为自身），只展开父级链
  const providedPathIds = Array.isArray(options.pathIds) ? options.pathIds : undefined
  const targetNode = providedPathIds ? null : findNodeById(props.nodes, nodeId)
  const pathIds: string[] | undefined = providedPathIds ?? (Array.isArray((targetNode as any)?.pathIds) ? ((targetNode as any).pathIds as string[]) : undefined)
  const parentChain = pathIds ? pathIds.slice(0, -1) : (findPathToNode(props.nodes, nodeId) || [])

  if (options.collapseOthers !== false) {
    expandedFolders.value = new Set(parentChain)
  } else {
    // 保留现有展开状态，仅确保路径上的父级已展开
    for (const id of parentChain) expandedFolders.value.add(id)
  }
  // 等待渲染完成后滚动
  await new Promise(r => requestAnimationFrame(r))
  await nextTick()
  const container = containerRef.value
  if (!container) return
  const targetEl = container.querySelector(`.simple-tree-node[data-node-id="${CSS.escape(nodeId)}"]`) as HTMLElement | null
  if (!targetEl) return

  // 找到实际的滚动容器（可能是父级面板）
  const getScrollableAncestor = (el: HTMLElement | null): HTMLElement | null => {
    let cur = el?.parentElement || null
    while (cur) {
      const style = window.getComputedStyle(cur)
      const oy = style.overflowY
      if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight) {
        return cur
      }
      cur = cur.parentElement
    }
    return document.scrollingElement as HTMLElement
  }

  const scrollContainer = getScrollableAncestor(container)
  if (!scrollContainer) return

  const sRect = scrollContainer.getBoundingClientRect()
  const tRect = targetEl.getBoundingClientRect()
  const isVisible = tRect.top >= sRect.top && tRect.bottom <= sRect.bottom
  if (options.scrollIntoViewCenter !== false && !isVisible) {
    const delta = (tRect.top - sRect.top) - (scrollContainer.clientHeight / 2 - tRect.height / 2)
    const targetTop = scrollContainer.scrollTop + delta
    const maxTop = scrollContainer.scrollHeight - scrollContainer.clientHeight
    const top = Math.max(0, Math.min(targetTop, maxTop))
    scrollContainer.scrollTo({ top, behavior: 'smooth' })
  }
}

function clearHoverAndActive() {
  hoveredNodeId.value = undefined
  activeNodeId.value = undefined
}

// === 目录展开/收起（按ID） ===
function expandFolderById(folderId: string) {
  const next = new Set(expandedFolders.value)
  next.add(folderId)
  expandedFolders.value = next
}

function collapseFolderById(folderId: string) {
  const next = new Set(expandedFolders.value)
  next.delete(folderId)
  expandedFolders.value = next
}

function toggleFolderById(folderId: string) {
  const next = new Set(expandedFolders.value)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  expandedFolders.value = next
}

// === 监听器 ===

watch(searchQuery, (newQuery) => {
  emit('search', newQuery)
})

// === 生命周期 ===

onMounted(() => {
  emit('ready')
})

// === 暴露的方法 ===
defineExpose({
  expandAll,
  collapseAll,
  clearSelection,
  expandedFolders,
  selectedNodes,
  focusNodeById,
  activeNodeId,
  hoveredNodeId,
  clearHoverAndActive,
  expandFolderById,
  collapseFolderById,
  toggleFolderById
})
</script>

<style scoped>
.simple-bookmark-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-surface);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.tree-search {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.tree-container {
  flex: 1;
  position: relative;
  overflow-y: auto;
}

.standard-content,
.virtual-content {
  position: relative;
  height: 100%;
}

.virtual-spacer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
}

.virtual-items {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--color-text-secondary);
  gap: 12px;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-variant);
}

.toolbar-actions {
  display: flex;
  gap: 4px;
}

/* 尺寸变体 */
.tree--compact {
  --item-height: 28px;
  --indent-size: 16px;
}

.tree--comfortable {
  --item-height: 32px;
  --indent-size: 20px;
}

.tree--spacious {
  --item-height: 40px;
  --indent-size: 24px;
}

.tree--loading {
  pointer-events: none;
  opacity: 0.6;
}
</style>
