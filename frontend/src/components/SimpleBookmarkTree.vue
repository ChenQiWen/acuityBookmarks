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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Icon, Input, Spinner } from './ui'
import SimpleTreeNode from './SimpleTreeNode.vue'
import type { BookmarkNode } from '@/types'
import { findNodeById as findNodeByIdCore } from '@/core/bookmark/services/tree-utils'
import { useBookmarkStore } from '@/stores/bookmarkStore'

// === Store ===
const bookmarkStore = useBookmarkStore()

// === Props 定义 ===
interface Props {
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
  /** 是否显示工具栏中的“展开所有/收起所有”按钮 */
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
}>()

// === 响应式状态 ===
const searchQuery = ref('')
const expandedFolders = ref(
  new Set(props.initialExpanded.map(id => String(id)))
)
const selectedNodes = ref(new Set(props.initialSelected.map(id => String(id))))
const activeNodeId = ref<string | undefined>(undefined)
const hoveredNodeId = ref<string | undefined>(undefined)
const containerRef = ref<HTMLElement | null>(null)
// 缓存最近的可滚动祖先容器，避免每次 focus 都遍历祖先链
const scrollAncestorRef = ref<HTMLElement | null>(null)
// 节点根元素注册表：避免滚动定位时反复 querySelector
const nodeElRegistry = new Map<string, HTMLElement>()
// 节点元素注册/注销（由 SimpleTreeNode 触发）
function registerNodeEl(id: string, el: HTMLElement) {
  nodeElRegistry.set(String(id), el)
}
function unregisterNodeEl(id: string) {
  nodeElRegistry.delete(String(id))
}
// 可见性阈值：节点上下各预留一定高度，足够可见时不触发滚动
const VISIBILITY_PADDING_RATIO = 0.15

// id -> path 缓存：O(N) 构建，一次性
const idToPath = new Map<string, string[]>()
// 滚动状态标记，避免并发滚动
const isScrolling = ref(false)

// === 计算属性 ===

// 树配置
const treeConfig = computed(() => ({
  size: props.size,
  searchable: props.searchable,
  selectable: props.selectable,
  editable: props.editable,
  showSelectionCheckbox: props.showSelectionCheckbox
}))

// 虚拟滚动配置（规范化配置，避免 TS 对 union 的“never”误判）
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
  // 当传入 boolean 时，提供默认阈值以支持“自动启用”逻辑
  return { enabled: !!props.virtual, threshold: 200 }
})

const virtualEnabled = computed(() => {
  const cfg = normalizedVirtual.value
  // 严格顺序模式下禁用虚拟滚动，确保结构/顺序完全可见且避免未实现的滚动可见区问题
  if (props.strictChromeOrder) return false
  if (cfg.enabled) return true
  // 自动启用：当节点总数超过阈值时
  const threshold = cfg.threshold ?? 200
  const count = countAllNodes(bookmarkStore.bookmarkTree)
  return count > threshold
})

const itemHeight = computed(() => {
  const cfg = normalizedVirtual.value
  if (cfg.itemHeight) return cfg.itemHeight
  return props.size === 'compact' ? 28 : props.size === 'spacious' ? 40 : 32
})

// 样式类
const treeClasses = computed(() => ({
  [`tree--${props.size}`]: true,
  'tree--virtual': virtualEnabled.value,
  'tree--loading': bookmarkStore.isLoading || !!props.loading
}))

// 容器样式
const containerStyles = computed(() => {
  const height =
    typeof props.height === 'number' ? `${props.height}px` : props.height
  return {
    height,
    overflowY: virtualEnabled.value ? ('auto' as const) : ('scroll' as const)
  }
})

// 过滤后的节点（不做去重/重排，完全尊重传入顺序）
const filteredNodes = computed(() => {
  const base = !searchQuery.value
    ? bookmarkStore.bookmarkTree
    : filterNodes(bookmarkStore.bookmarkTree, searchQuery.value)
  return base
})

// 扁平化节点 (虚拟滚动用)
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
    // 如果子节点未加载，则去加载
    if (!node._childrenLoaded) {
      bookmarkStore.fetchChildren(folderId)
    }
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
      // 取消选择：移除自身并移除其所有后代
      selectedNodes.value.delete(id)
      removeDescendants(node)
    } else {
      // 选择：添加自身并添加其所有后代
      selectedNodes.value.add(id)
      addDescendants(node)
    }
  }

  const selected = selectedNodes.value.has(id)
  emit('node-select', id, node, selected)
  emit('selection-change', Array.from(selectedNodes.value), getSelectedNodes())
}

const expandAll = () => {
  const allFolderIds = getAllFolderIds(bookmarkStore.bookmarkTree)
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
  const lowerQuery = (query || '').toString().toLowerCase().trim()

  // 支持标签专用语法："tag:xxx" 或 "#xxx"（仅标签匹配）
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
  nodes: BookmarkNode[],
  expanded: Set<string>,
  level = 0
): FlattenedItem[] {
  const result: FlattenedItem[] = []

  for (const node of nodes) {
    result.push({ id: node.id, node, level })

    if (node.children && expanded.has(node.id)) {
      result.push(...flattenNodes(node.children, expanded, level + 1))
    }
  }

  return result
}

// 统计所有节点数量（含文件夹与书签），用于自动虚拟化阈值判断
function countAllNodes(nodes: BookmarkNode[]): number {
  let total = 0
  for (const n of nodes) {
    total++
    if (n.children && n.children.length) {
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

function findPathToNode(
  nodes: BookmarkNode[],
  targetId: string,
  path: string[] = []
): string[] | null {
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

onMounted(() => {
  // 构建 id->path 缓存
  try {
    idToPath.clear()
    const build = (nodes: BookmarkNode[], path: string[] = []) => {
      for (const n of nodes) {
        const id = String(n.id)
        // 优先使用预计算的 pathIds（完整链：含自身）；否则回退为基于父路径累加
        const precomputed =
          n.pathIds && n.pathIds.length ? n.pathIds.map(String) : null
        const cur = precomputed ?? [...path, id]
        idToPath.set(id, cur)
        if (n.children && n.children.length) build(n.children, cur)
      }
    }
    build(bookmarkStore.bookmarkTree)
  } catch {}
})

// 通过ID查找节点，便于读取节点的 pathIds（IndexedDB 预处理字段）
function findNodeById(nodes: BookmarkNode[], id: string): BookmarkNode | null {
  const { node } = findNodeByIdCore(nodes as BookmarkNode[], String(id)) as {
    node: BookmarkNode | null
  }
  return node || null
}

async function focusNodeById(
  nodeId: string,
  options: {
    collapseOthers?: boolean
    scrollIntoViewCenter?: boolean
    pathIds?: string[]
  } = { collapseOthers: true, scrollIntoViewCenter: true }
) {
  const sid = String(nodeId)
  activeNodeId.value = sid
  hoveredNodeId.value = sid
  // 优先使用节点的 pathIds（首个为根，最后一个为自身），只展开父级链
  const providedPathIds = Array.isArray(options.pathIds)
    ? options.pathIds
    : undefined
  const searchNodes = bookmarkStore.bookmarkTree
  // 使用缓存优先，其次使用目标节点的 pathIds，再退化到 DFS（尽量避免）
  const cached = idToPath.get(sid)
  const targetNode =
    providedPathIds || cached ? null : findNodeById(searchNodes, sid)
  const nodePath =
    providedPathIds ??
    cached ??
    (Array.isArray(
      (targetNode as BookmarkNode & { pathIds?: string[] })?.pathIds
    )
      ? ((targetNode as BookmarkNode & { pathIds?: string[] })
          .pathIds as string[])
      : undefined)
  const parentChain = nodePath
    ? nodePath.slice(0, -1)
    : findPathToNode(searchNodes, sid) || []

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
  // 优先使用注册表中的元素；回退到选择器查找
  const targetEl =
    nodeElRegistry.get(sid) ||
    (container.querySelector(
      `.simple-tree-node[data-node-id="${CSS.escape(sid)}"]`
    ) as HTMLElement | null)
  if (!targetEl) return

  // 找到实际的滚动容器（可能是父级面板）
  const getScrollableAncestor = (
    el: HTMLElement | null
  ): HTMLElement | null => {
    let cur = el?.parentElement || null
    while (cur) {
      const style = window.getComputedStyle(cur)
      const oy = style.overflowY
      if (
        (oy === 'auto' || oy === 'scroll') &&
        cur.scrollHeight > cur.clientHeight
      ) {
        return cur
      }
      cur = cur.parentElement
    }
    return document.scrollingElement as HTMLElement
  }

  const scrollContainer =
    scrollAncestorRef.value || getScrollableAncestor(container)
  if (!scrollAncestorRef.value) scrollAncestorRef.value = scrollContainer
  if (!scrollContainer) return

  const sRect = scrollContainer.getBoundingClientRect()
  const tRect = targetEl.getBoundingClientRect()
  const paddingPx = scrollContainer.clientHeight * VISIBILITY_PADDING_RATIO
  const visibleTop = sRect.top + paddingPx
  const visibleBottom = sRect.bottom - paddingPx
  const isVisible = tRect.top >= visibleTop && tRect.bottom <= visibleBottom
  if (options.scrollIntoViewCenter !== false && !isVisible) {
    try {
      performance.mark('focusNodeById:scroll_start')
    } catch {}
    if (isScrolling.value) {
      // 正在滚动中，跳过本次，避免滚动堆积
      return
    }
    isScrolling.value = true
    const delta =
      tRect.top -
      sRect.top -
      (scrollContainer.clientHeight / 2 - tRect.height / 2)
    const targetTop = scrollContainer.scrollTop + delta
    const maxTop = scrollContainer.scrollHeight - scrollContainer.clientHeight
    const top = Math.max(0, Math.min(targetTop, maxTop))
    scrollContainer.scrollTo({ top, behavior: 'smooth' })
    // 记录结束标记与测量
    requestAnimationFrame(() => {
      try {
        performance.mark('focusNodeById:scroll_end')
        // 如果存在来自右侧悬停的起点，则测量一次完整耗时
        performance.measure(
          'hover_to_scroll',
          'hover_to_scroll_start',
          'focusNodeById:scroll_end'
        )
      } catch {}
      // 简单的结束复位（下一帧再复位，避免过早多次触发）
      setTimeout(() => {
        isScrolling.value = false
      }, 50)
    })
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

watch(searchQuery, newQuery => {
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
  toggleFolderById,
  // 🔎 对外暴露搜索控制，便于在面板头部放置搜索输入
  searchQuery,
  setSearchQuery: (q: string) => {
    searchQuery.value = q
  },
  isScrolling,
  // ✅ 可编程选择节点：支持单选/多选追加
  selectNodeById: (id: string, opts?: { append?: boolean }) => {
    const sid = String(id)
    // 若单选模式，或未指定append，则默认清空后再选择
    const allowMultiple = props.selectable === 'multiple'
    const append = !!opts?.append
    if (!allowMultiple || !append) {
      selectedNodes.value = new Set()
    }
    selectedNodes.value.add(sid)
    // 触发 selection-change，保持与交互式选择一致的对外行为
    emit(
      'selection-change',
      Array.from(selectedNodes.value),
      getSelectedNodes()
    )
  },
  // 返回当前过滤后树中的第一个可见书签节点ID（用于回车定位）
  getFirstVisibleBookmarkId: (): string | undefined => {
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
