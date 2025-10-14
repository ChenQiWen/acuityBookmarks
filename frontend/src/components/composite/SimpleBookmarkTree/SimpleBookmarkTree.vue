<!--
  🌳 性能优化版书签目录树组件
  
  优化策略：
  1. 使用 shallowRef 减少深度响应式开销
  2. 使用 computed 缓存复杂计算
  3. 使用 v-memo 优化列表渲染
  4. 使用 defineAsyncComponent 懒加载子组件
  5. 优化事件处理函数
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
    <div
      ref="containerRef"
      class="tree-container"
      :style="containerStyles"
      @mouseleave="clearHoverAndActive"
    >
      <!-- 标准渲染模式 -->
      <div v-if="!virtualEnabled" class="standard-content">
        <SimpleTreeNode
          v-for="node in filteredNodes"
          :key="node.id"
          v-memo="[
            node.id,
            node.title,
            node.url,
            isExpanded(node.id),
            isSelected(node.id)
          ]"
          :node="node"
          :level="0"
          :expanded-folders="expandedFolders"
          :selected-nodes="selectedNodes"
          :loading-children="bookmarkStore.loadingChildren"
          :search-query="searchQuery"
          :highlight-matches="highlightMatches"
          :config="treeConfig"
          :strict-order="props.strictChromeOrder"
          :active-id="activeNodeId"
          :hovered-id="hoveredNodeId"
          @node-mounted="registerNodeEl"
          @node-unmounted="unregisterNodeEl"
          @node-click="handleNodeClick"
          @folder-toggle="handleFolderToggle"
          @load-more-children="handleLoadMoreChildren"
          @node-select="handleNodeSelect"
          @node-edit="handleNodeEdit"
          @node-delete="handleNodeDelete"
          @folder-add="handleFolderAdd"
          @bookmark-open-new-tab="handleBookmarkOpenNewTab"
          @bookmark-copy-url="handleBookmarkCopyUrl"
          @node-hover="handleNodeHover"
          @node-hover-leave="handleNodeHoverLeave"
        />
      </div>

      <!-- 虚拟滚动模式 (TanStack Virtual) -->
      <div v-else class="virtual-content">
        <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
          <div
            v-for="virtualItem in virtualItems"
            :key="flattenedItems[virtualItem.index].id"
            class="virtual-item"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }"
          >
            <SimpleTreeNode
              :node="flattenedItems[virtualItem.index].node"
              :level="flattenedItems[virtualItem.index].level"
              :expanded-folders="expandedFolders"
              :selected-nodes="selectedNodes"
              :loading-children="bookmarkStore.loadingChildren"
              :search-query="searchQuery"
              :highlight-matches="highlightMatches"
              :config="treeConfig"
              :is-virtual-mode="true"
              :strict-order="props.strictChromeOrder"
              :active-id="activeNodeId"
              :hovered-id="hoveredNodeId"
              @node-mounted="registerNodeEl"
              @node-unmounted="unregisterNodeEl"
              @node-click="handleNodeClick"
              @folder-toggle="handleFolderToggle"
              @load-more-children="handleLoadMoreChildren"
              @node-select="handleNodeSelect"
              @node-edit="handleNodeEdit"
              @node-delete="handleNodeDelete"
              @folder-add="handleFolderAdd"
              @bookmark-open-new-tab="handleBookmarkOpenNewTab"
              @bookmark-copy-url="handleBookmarkCopyUrl"
              @node-hover="handleNodeHover"
              @node-hover-leave="handleNodeHoverLeave"
            />
          </div>
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
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
  shallowRef,
  defineAsyncComponent
} from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Icon, Input, Spinner } from '@/components/ui'
import type { BookmarkNode } from '@/types'
import { useBookmarkStore } from '@/stores/bookmarkStore'

// 🚀 性能优化：使用 defineAsyncComponent 懒加载子组件
const SimpleTreeNode = defineAsyncComponent(
  () => import('@/components/composite/SimpleTreeNode/SimpleTreeNode.vue')
)

// === Store ===
const bookmarkStore = useBookmarkStore()

// === Props 定义 ===
interface Props {
  /** 外部传入的节点数据，如果提供则优先使用，否则从 bookmarkStore 获取 */
  nodes?: BookmarkNode[]
  loading?: boolean
  height?: string | number
  searchable?: boolean
  selectable?: boolean | 'single' | 'multiple'
  editable?: boolean
  /** 严格按 Chrome API 原始树的结构与顺序渲染（不做去重/重排） */
  strictChromeOrder?: boolean
  virtual?:
    | boolean
    | { enabled: boolean; itemHeight?: number; threshold?: number }
  size?: 'compact' | 'comfortable' | 'spacious'
  showToolbar?: boolean
  /** 是否显示工具栏中的"展开所有/收起所有"按钮 */
  toolbarExpandCollapse?: boolean
  initialExpanded?: string[]
  initialSelected?: string[]
  /** 数据来源上下文，用于组件内部决定调用哪个页面级API。 */
  source?: 'sidePanel' | 'management'
  /** 是否在标题中高亮匹配关键字 */
  highlightMatches?: boolean
  /** 是否在书签前显示选择复选框（仅书签节点） */
  showSelectionCheckbox?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nodes: undefined,
  loading: false,
  height: '400px',
  searchable: false,
  selectable: false,
  editable: false,
  strictChromeOrder: false,
  virtual: false,
  size: 'comfortable',
  showToolbar: true,
  toolbarExpandCollapse: true,
  initialExpanded: () => [],
  initialSelected: () => [],
  source: 'sidePanel',
  highlightMatches: true,
  showSelectionCheckbox: false
})

// === Emits 定义 ===
const emit = defineEmits<{
  'node-click': [node: BookmarkNode, event: MouseEvent]
  'folder-toggle': [folderId: string, node: BookmarkNode, expanded: boolean]
  'load-more-children': [folderId: string, node: BookmarkNode]
  'node-select': [nodeId: string, node: BookmarkNode, selected: boolean]
  'selection-change': [selectedIds: string[], nodes: BookmarkNode[]]
  search: [query: string]
  ready: []
  'node-edit': [node: BookmarkNode]
  'node-delete': [node: BookmarkNode]
  'folder-add': [parentNode: BookmarkNode]
  'bookmark-open-new-tab': [node: BookmarkNode]
  'bookmark-copy-url': [node: BookmarkNode]
  'node-hover': [node: BookmarkNode]
  'node-hover-leave': [node: BookmarkNode]
  /** 展开状态变化事件：true=全部展开，false=全部收起 */
  'expand-state-change': [isAllExpanded: boolean]
}>()

// === 响应式状态 ===
// 🚀 性能优化：使用 shallowRef 减少深度响应式开销
const searchQuery = ref('')
const expandedFolders = shallowRef(
  new Set(props.initialExpanded.map(id => String(id)))
)
const selectedNodes = shallowRef(
  new Set(props.initialSelected.map(id => String(id)))
)
const activeNodeId = ref<string | undefined>(undefined)
const hoveredNodeId = ref<string | undefined>(undefined)
const containerRef = ref<HTMLElement | null>(null)
// 节点根元素注册表：避免滚动定位时反复 querySelector
const nodeElRegistry = new Map<string, HTMLElement>()
// 滚动状态标记，避免并发滚动
const isScrolling = ref(false)

// === 计算属性 ===

// 🚀 性能优化：缓存树配置对象
const treeConfig = computed(() => ({
  size: props.size,
  searchable: props.searchable,
  selectable: props.selectable,
  editable: props.editable,
  showSelectionCheckbox: props.showSelectionCheckbox
}))

// 🚀 性能优化：缓存虚拟滚动配置
type VirtualConfig = {
  enabled: boolean
  itemHeight?: number
  threshold?: number
}
const normalizedVirtual = computed<VirtualConfig>(() => {
  if (typeof props.virtual === 'object' && props.virtual) {
    return {
      enabled: !!props.virtual.enabled,
      itemHeight: props.virtual.itemHeight,
      threshold: props.virtual.threshold
    }
  }
  return { enabled: !!props.virtual, threshold: 500 }
})

const virtualEnabled = computed(() => {
  const cfg = normalizedVirtual.value
  if (props.strictChromeOrder) return false
  if (cfg.enabled) return true
  const threshold = cfg.threshold ?? 500
  const count = countAllNodes(bookmarkStore.bookmarkTree)
  return count > threshold
})

const itemHeight = computed(() => {
  const cfg = normalizedVirtual.value
  if (cfg.itemHeight) return cfg.itemHeight
  return props.size === 'compact' ? 28 : props.size === 'spacious' ? 40 : 32
})

// 🚀 性能优化：缓存样式类
const treeClasses = computed(() => ({
  [`tree--${props.size}`]: true,
  'tree--virtual': virtualEnabled.value,
  'tree--loading': bookmarkStore.isLoading || !!props.loading
}))

// 🚀 性能优化：缓存容器样式
const containerStyles = computed(() => {
  const height =
    typeof props.height === 'number' ? `${props.height}px` : props.height
  return {
    height,
    overflowY: virtualEnabled.value ? ('auto' as const) : ('scroll' as const)
  }
})

// 🚀 性能优化：缓存过滤后的节点
const filteredNodes = computed(() => {
  try {
    const source =
      props.nodes !== undefined ? props.nodes : bookmarkStore.bookmarkTree

    const base = !searchQuery.value
      ? source
      : filterNodes(source as unknown as BookmarkNode[], searchQuery.value)
    return Array.isArray(base) ? base : []
  } catch {
    return []
  }
})

// 🚀 性能优化：缓存扁平化节点
const flattenedItems = computed(() => {
  if (!virtualEnabled.value) return []
  return flattenNodes(filteredNodes.value, expandedFolders.value)
})

// === TanStack Virtualizer ===
const virtualizer = useVirtualizer(
  computed(() => ({
    count: flattenedItems.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => itemHeight.value,
    overscan: 5
  }))
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

// === 性能优化：缓存状态检查函数 ===
const isExpanded = (nodeId: string) => expandedFolders.value.has(nodeId)
const isSelected = (nodeId: string) => selectedNodes.value.has(nodeId)

// === 事件处理 ===
// 🚀 性能优化：使用箭头函数避免重复创建
const handleNodeClick = (node: BookmarkNode, event: MouseEvent) => {
  emit('node-click', node, event)
}

const handleFolderToggle = (folderId: string, node: BookmarkNode) => {
  const isExpanded = expandedFolders.value.has(folderId)
  if (isExpanded) {
    expandedFolders.value.delete(folderId)
  } else {
    expandedFolders.value.add(folderId)
    const loaded = Array.isArray(node.children) ? node.children.length : 0
    const total = node.childrenCount ?? loaded
    if (!node._childrenLoaded) {
      bookmarkStore.fetchChildren(folderId, 100, 0)
    } else if (total > loaded) {
      bookmarkStore.fetchMoreChildren(folderId, 100)
    }
  }

  emit('folder-toggle', folderId, node, !isExpanded)
}

const handleLoadMoreChildren = (folderId: string, node: BookmarkNode) => {
  bookmarkStore.fetchMoreChildren(folderId, 100)
  emit('load-more-children', folderId, node)
}

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
  emit('bookmark-copy-url', node)
}

const handleNodeHover = (node: BookmarkNode) => {
  emit('node-hover', node)
}

const handleNodeHoverLeave = (node: BookmarkNode) => {
  hoveredNodeId.value = undefined
  activeNodeId.value = undefined
  emit('node-hover-leave', node)
}

const handleNodeSelect = (nodeId: string, node: BookmarkNode) => {
  const id = String(nodeId)
  const isSelected = selectedNodes.value.has(id)

  const addDescendants = (n: BookmarkNode) => {
    if (n.children && n.children.length) {
      for (const c of n.children) {
        selectedNodes.value.add(String(c.id))
        addDescendants(c)
      }
    }
  }
  const removeDescendants = (n: BookmarkNode) => {
    if (n.children && n.children.length) {
      for (const c of n.children) {
        selectedNodes.value.delete(String(c.id))
        removeDescendants(c)
      }
    }
  }

  if (props.selectable === 'single') {
    selectedNodes.value.clear()
    if (!isSelected) {
      selectedNodes.value.add(id)
      if (node.children) addDescendants(node)
    }
  } else if (props.selectable === 'multiple') {
    if (isSelected) {
      selectedNodes.value.delete(id)
      removeDescendants(node)
    } else {
      selectedNodes.value.add(id)
      addDescendants(node)
    }
  }

  const selected = selectedNodes.value.has(id)
  emit('node-select', id, node, selected)
  emit('selection-change', Array.from(selectedNodes.value), getSelectedNodes())
}

// === 工具函数 ===
// 🚀 性能优化：缓存节点元素注册/注销函数
function registerNodeEl(id: string, el: HTMLElement) {
  nodeElRegistry.set(String(id), el)
}

function unregisterNodeEl(id: string) {
  nodeElRegistry.delete(String(id))
}

function filterNodes(nodes: BookmarkNode[], query: string): BookmarkNode[] {
  const lowerQuery = (query || '').toString().toLowerCase().trim()

  const isTagOnly = lowerQuery.startsWith('tag:') || lowerQuery.startsWith('#')
  const tagTerm = isTagOnly
    ? lowerQuery
        .replace(/^tag:\s*/i, '')
        .replace(/^#/, '')
        .trim()
    : ''

  const matchNode = (n: BookmarkNode): boolean => {
    const titleLower = (n.titleLower || n.title || '').toString().toLowerCase()
    const urlLower = (n.urlLower || n.url || '').toString().toLowerCase()
    const domainLower = (n.domain || '').toLowerCase()
    const tags = n.tags || []
    const hasTagHit = tags.some((t: string) =>
      t.toLowerCase().includes(isTagOnly ? tagTerm : lowerQuery)
    )

    if (isTagOnly) return hasTagHit

    return (
      titleLower.includes(lowerQuery) ||
      urlLower.includes(lowerQuery) ||
      domainLower.includes(lowerQuery) ||
      hasTagHit
    )
  }

  const recurse = (arr: BookmarkNode[]): BookmarkNode[] => {
    const out: BookmarkNode[] = []
    for (const n of arr) {
      const matched = matchNode(n)
      const childMatches = n.children ? recurse(n.children) : []
      if (matched || childMatches.length > 0) {
        out.push({
          ...n,
          children: childMatches.length ? childMatches : n.url ? undefined : []
        })
      }
    }
    return out
  }
  return recurse(nodes)
}

interface FlattenedItem {
  id: string
  node: BookmarkNode
  level: number
}

function flattenNodes(
  nodes: BookmarkNode[] | unknown,
  expanded: Set<string>,
  level = 0
): FlattenedItem[] {
  const result: FlattenedItem[] = []
  const arr = Array.isArray(nodes) ? (nodes as BookmarkNode[]) : []
  for (const node of arr) {
    if (!node || typeof node !== 'object') continue
    result.push({ id: String((node as BookmarkNode).id), node, level })
    const children = (node as BookmarkNode).children
    if (
      Array.isArray(children) &&
      expanded.has(String((node as BookmarkNode).id))
    ) {
      result.push(...flattenNodes(children, expanded, level + 1))
    }
  }
  return result
}

function countAllNodes(nodes: BookmarkNode[] | unknown): number {
  const arr = Array.isArray(nodes) ? (nodes as BookmarkNode[]) : []
  let total = 0
  for (const n of arr) {
    total++
    if (Array.isArray(n.children) && n.children.length) {
      total += countAllNodes(n.children)
    }
  }
  return total
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
  find(bookmarkStore.bookmarkTree)
  return result
}

// === 监听器 ===
watch(searchQuery, newQuery => {
  const trimmed = newQuery?.trim() || ''

  if (trimmed) {
    expandAll()
  } else {
    collapseAll()
  }

  emit('search', newQuery)
})

// === 生命周期 ===
onMounted(() => {
  emit('ready')
})

// === 暴露的方法 ===
const expandAll = () => {
  const source =
    props.nodes !== undefined ? props.nodes : bookmarkStore.bookmarkTree
  const allFolderIds = getAllFolderIds(source)
  expandedFolders.value = new Set(allFolderIds)
  emit('expand-state-change', true)
}

const collapseAll = () => {
  expandedFolders.value = new Set()
  emit('expand-state-change', false)
}

const clearSelection = () => {
  selectedNodes.value = new Set()
  emit('selection-change', [], [])
}

const clearHoverAndActive = () => {
  hoveredNodeId.value = undefined
  activeNodeId.value = undefined
}

// === 缺失的方法实现 ===
const focusNodeById = async (
  id: string,
  options?: {
    scrollIntoView?: boolean
    collapseOthers?: boolean
    scrollIntoViewCenter?: boolean
    pathIds?: string[]
  }
) => {
  // 实现节点聚焦逻辑
  activeNodeId.value = id

  if (options?.collapseOthers) {
    // 收起其他文件夹，只保留当前节点
    expandedFolders.value = new Set([id])
  }

  if (options?.scrollIntoView || options?.scrollIntoViewCenter) {
    const element = nodeElRegistry.get(id)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: options?.scrollIntoViewCenter ? 'center' : 'nearest'
      })
    }
  }

  if (options?.pathIds) {
    // 展开路径上的所有文件夹
    for (const pathId of options.pathIds) {
      expandedFolders.value.add(pathId)
    }
  }
}

const expandFolderById = (id: string) => {
  expandedFolders.value.add(id)
}

const collapseFolderById = (id: string) => {
  expandedFolders.value.delete(id)
}

const toggleFolderById = (id: string) => {
  if (expandedFolders.value.has(id)) {
    expandedFolders.value.delete(id)
  } else {
    expandedFolders.value.add(id)
  }
}

const selectNodeById = (id: string, opts?: { append?: boolean }) => {
  const sid = String(id)
  const allowMultiple = props.selectable === 'multiple'
  const append = !!opts?.append
  if (!allowMultiple || !append) {
    selectedNodes.value = new Set()
  }
  selectedNodes.value.add(sid)
  emit('selection-change', Array.from(selectedNodes.value), getSelectedNodes())
}

const getFirstVisibleBookmarkId = (): string | undefined => {
  const findFirst = (nodes: BookmarkNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.url) return n.id
      if (n.children && n.children.length) {
        const id = findFirst(n.children)
        if (id) return id
      }
    }
    return undefined
  }
  return findFirst(filteredNodes.value)
}

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
  toggleFolderById,
  selectNodeById,
  getFirstVisibleBookmarkId,
  searchQuery,
  setSearchQuery: (q: string) => {
    searchQuery.value = q
  },
  isScrolling
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
  position: relative;
  width: 100%;
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
