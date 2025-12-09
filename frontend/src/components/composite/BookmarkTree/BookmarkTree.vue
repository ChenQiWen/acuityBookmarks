<!--
  🌳 性能优化版书签目录树组件
  
  优化策略：
  1. 使用 shallowRef 减少深度响应式开销
  2. 使用 computed 缓存复杂计算
  3. 使用 v-memo 优化列表渲染
  4. 优化事件处理函数
-->

<template>
  <div class="simple-bookmark-tree" :class="treeClasses">
    <!-- 搜索框 (可选) -->
    <div v-if="searchable" class="tree-search">
      <Input
        v-model="searchQuery"
        placeholder="筛选书签..."
        type="text"
        variant="outlined"
        density="compact"
        clearable
      >
        <template #prepend>
          <Icon name="icon-search" :size="16" />
        </template>
      </Input>
    </div>

    <!-- 树容器 -->
    <div class="tree-container-wrapper">
      <div
        ref="containerRef"
        class="tree-container"
        :class="{ 'is-loading': isOverlayLoading }"
        :style="containerStyles"
      >
        <div v-if="isOverlayLoading" class="tree-loading-overlay">
          <Spinner size="lg" />
          <div class="tree-loading-text">正在加载书签…</div>
        </div>

        <!-- 空状态 -->
        <EmptyState
          v-if="shouldShowEmptyState"
          :icon="emptyStateConfig.icon"
          :title="emptyStateConfig.title"
          :description="emptyStateConfig.description"
          :icon-size="56"
        />

        <!-- 标准渲染模式 -->
        <div
          v-if="!virtualEnabled && !shouldShowEmptyState"
          class="standard-content"
        >
          <TreeNode
            v-for="node in filteredNodes"
            :key="node.id"
            :node="node"
            :level="0"
            :expanded-folders="expandedFolders"
            :selected-nodes="selectedNodes"
            :selected-desc-counts="selectedDescCountsState"
            :search-query="searchQuery"
            :highlight-matches="highlightMatches"
            :config="treeConfig"
            :deleting-node-ids="visibleDeletingNodeIds"
            :drag-state="dragState"
            :strict-order="props.strictChromeOrder"
            :active-id="activeNodeId"
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
            @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
            @folder-share="handleFolderShare"
            @drag-start="handleDragStart"
            @drag-over="handleDragOver"
            @drag-leave="handleDragLeave"
            @drop="handleDrop"
            @drag-end="handleDragEnd"
          />
        </div>

        <!-- 虚拟滚动模式 (TanStack Virtual) -->
        <div
          v-else-if="virtualEnabled && !shouldShowEmptyState"
          class="virtual-content"
        >
          <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
            <div
              v-for="row in virtualRows"
              :key="row.record.id"
              class="virtual-item"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`
              }"
            >
              <TreeNode
                v-if="row.record.kind === 'node' && row.record.node"
                :node="row.record.node"
                :level="row.record.level"
                :expanded-folders="expandedFolders"
                :selected-nodes="selectedNodes"
                :selected-desc-counts="selectedDescCountsState"
                :search-query="searchQuery"
                :highlight-matches="highlightMatches"
                :config="treeConfig"
                :is-virtual-mode="true"
                :deleting-node-ids="visibleDeletingNodeIds"
                :drag-state="dragState"
                :strict-order="props.strictChromeOrder"
                :active-id="activeNodeId"
                :loading-more-folders="loadingMoreFolders"
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
                @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
                @folder-share="handleFolderShare"
                @drag-start="handleDragStart"
                @drag-over="handleDragOver"
                @drag-leave="handleDragLeave"
                @drop="handleDrop"
                @drag-end="handleDragEnd"
              />
              <VirtualFolderList
                v-else-if="row.record.kind === 'chunk' && row.record.chunk"
                :chunk="row.record.chunk"
                :level="row.record.level"
                :expanded-folders="expandedFolders"
                :selected-nodes="selectedNodes"
                :selected-desc-counts="selectedDescCountsState"
                :search-query="searchQuery"
                :highlight-matches="highlightMatches"
                :config="treeConfig"
                :strict-order="props.strictChromeOrder"
                :active-id="activeNodeId"
                :loading-more-folders="loadingMoreFolders"
                :size="props.size"
                :deleting-node-ids="visibleDeletingNodeIds"
                @node-click="handleNodeClick"
                @folder-toggle="handleFolderToggle"
                @node-select="handleNodeSelect"
                @node-edit="handleNodeEdit"
                @node-delete="handleNodeDelete"
                @folder-add="handleFolderAdd"
                @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                @bookmark-copy-url="handleBookmarkCopyUrl"
                @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
                @folder-share="handleFolderShare"
              />
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading && !isOverlayLoading" class="loading-state">
          <Spinner size="md" />
          <span>加载中...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, shallowRef } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { EmptyState, Icon, Input, Spinner } from '@/components'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import TreeNode from './TreeNode.vue'
import VirtualFolderList from './VirtualFolderList.vue'
import { notificationService } from '@/application/notification/notification-service'

// ✅ 明确组件名称，便于 Vue DevTools 与日志追踪
defineOptions({ name: 'BookmarkTree' })

// === Props 定义 ===
/**
 * 🌳 书签树组件支持的属性集合
 *
 * ⚠️ 架构原则：纯 UI 组件
 * - 所有数据必须通过 props 传入
 * - 不允许组件内部访问 store
 * - 业务逻辑在页面层处理
 */
interface Props {
  /** 书签树节点数据（必需） */
  nodes: BookmarkNode[]
  /** 是否正在加载 */
  loading?: boolean
  /** 树的高度 */
  height?: string | number
  /** 是否可搜索 */
  searchable?: boolean
  /** 是否可选择 */
  selectable?: boolean | 'single' | 'multiple'
  editable?: boolean
  /** 严格按 Chrome API 原始树的结构与顺序渲染（不做去重/重排） */
  strictChromeOrder?: boolean
  /** 是否启用虚拟滚动 */
  virtual?:
    | boolean
    | { enabled: boolean; itemHeight?: number; threshold?: number }
  /** 树的尺寸 */
  size?: 'compact' | 'comfortable' | 'spacious'
  /** 是否显示工具栏 */
  showToolbar?: boolean
  /** 是否显示工具栏中的"展开所有/收起所有"按钮 */
  toolbarExpandCollapse?: boolean
  /**
   * ⚠️ 已废弃：选择状态可能需要外部控制（待评估）
   * @deprecated 待重新设计
   */
  initialSelected?: string[]
  /** 数据来源上下文，用于组件内部决定调用哪个页面级API。 */
  source?: 'sidePanel' | 'management'
  /** 是否在标题中高亮匹配关键字 */
  highlightMatches?: boolean
  /** 是否在书签前显示选择复选框（仅书签节点） */
  showSelectionCheckbox?: boolean
  /**
   * 手风琴模式：展开一个文件夹时自动收起同级的其他文件夹
   * @default false
   */
  accordionMode?: boolean
  /**
   * 独立按钮控制（细粒度配置）
   * 当 editable=false 时，仍然可以单独启用某些操作按钮
   */
  /** 是否显示收藏按钮 */
  showFavoriteButton?: boolean
  /** 是否显示编辑按钮 */
  showEditButton?: boolean
  /** 是否显示删除按钮 */
  showDeleteButton?: boolean
  /** 是否显示添加按钮（文件夹） */
  showAddButton?: boolean
  /** 是否显示打开新标签页按钮 */
  showOpenNewTabButton?: boolean
  /** 是否显示复制链接按钮 */
  showCopyUrlButton?: boolean
  /** 是否显示分享按钮（文件夹） */
  showShareButton?: boolean
  /**
   * 选中后代计数映射（可选）
   * - 用于显示文件夹包含多少已选中的子节点
   * - 如不需要此功能，可不传或传入空 Map
   */
  selectedDescCounts?: Map<string, number>
  /**
   * 正在执行删除动画的节点 ID 集合
   * - 用于在删除节点时显示离场动画
   * - 如不需要此功能，传入空 Set
   */
  deletingNodeIds?: Set<string>
  /**
   * 是否启用拖拽功能
   * @default false
   */
  draggable?: boolean
}

// ✅ 组件默认值集中在此，便于统一维护
const props = withDefaults(defineProps<Props>(), {
  loading: undefined,
  height: '400px',
  searchable: false,
  selectable: false,
  editable: false,
  strictChromeOrder: false,
  virtual: false,
  size: 'comfortable',
  showToolbar: true,
  toolbarExpandCollapse: true,
  initialSelected: () => [],
  source: 'sidePanel',
  highlightMatches: true,
  showSelectionCheckbox: false,
  accordionMode: false,
  showFavoriteButton: false,
  showEditButton: false,
  showDeleteButton: false,
  showAddButton: false,
  showOpenNewTabButton: false,
  showCopyUrlButton: false,
  showShareButton: false,
  loadingChildren: undefined,
  draggable: false,
  selectedDescCounts: undefined
})

// === Emits 定义 ===
// ✅ 组件对外事件统一声明，用中文说明触发时机
const emit = defineEmits<{
  'node-click': [BookmarkNode, MouseEvent]
  'folder-toggle': [string, BookmarkNode, boolean]
  'node-select': [string, BookmarkNode, boolean]
  'selection-change': [string[], BookmarkNode[]]
  search: [string]
  ready: []
  'node-edit': [BookmarkNode]
  'node-delete': [BookmarkNode]
  'folder-add': [BookmarkNode]
  'bookmark-open-new-tab': [BookmarkNode]
  'bookmark-copy-url': [BookmarkNode]
  'bookmark-toggle-favorite': [BookmarkNode, boolean]
  /** 分享文件夹 */
  'folder-share': [BookmarkNode]
  'node-hover': [BookmarkNode]
  'node-hover-leave': [BookmarkNode]
  /** 展开状态变化事件：true=全部展开，false=全部收起 */
  'expand-state-change': [boolean]
  'request-children': [
    {
      folderId: string
      node: BookmarkNode
      limit: number
      offset: number
    }
  ]
  'request-more-children': [
    {
      folderId: string
      node: BookmarkNode
      limit: number
      loaded: number
    }
  ]
  'request-clear-filters': []
  // ✅ 拖拽相关事件
  'bookmark-move': [
    {
      sourceId: string
      targetId: string
      position: 'before' | 'inside' | 'after'
    }
  ]
  // 后代计数更新事件
  'desc-counts-updated': [Map<string, number>]
}>()

// === 响应式状态 ===
// 🚀 性能优化：使用 shallowRef 减少深度响应式开销
const searchQuery = ref('')

// ✅ 展开/收起状态：完全由组件内部管理（纯 UI 状态）
const expandedFolders = shallowRef(new Set<string>())

// ⚠️ 选择状态：暂时保留 initialSelected（待重新设计为完全受控或完全非受控）
const selectedNodes = shallowRef(
  new Set(props.initialSelected.map((id: string) => String(id)))
)

// ✅ 拖拽状态
const dragState = ref<{
  isDragging: boolean
  dragSourceId: string | null
  dropTargetId: string | null
  dropPosition: 'before' | 'inside' | 'after' | null
}>({
  isDragging: false,
  dragSourceId: null,
  dropTargetId: null,
  dropPosition: null
})
const activeNodeId = ref<string | undefined>(undefined)
const containerRef = ref<HTMLDivElement | null>(null)
const isOverlayLoading = ref(false)
// 节点根元素注册表：避免滚动定位时反复 querySelector
const nodeElRegistry = new Map<string, HTMLElement>()
// 滚动状态标记，避免并发滚动
const isScrolling = ref(false)
// 自动加载相关状态
const loadingMoreFolders = shallowRef(new Set<string>())

// 📊 选中后代计数：直接使用 props
const selectedDescCountsState = computed(() => props.selectedDescCounts)

// === 计算属性 ===

// 🚀 loading 状态
const loading = computed(() => props.loading ?? false)

// 🌲 统一获取当前渲染所使用的节点列表
const treeSource = computed(() => {
  // ✅ 纯 UI 组件：直接使用传入的 nodes
  // 空 nodes 是合法的 UI 状态（初始化、无数据、搜索无结果等），不需要警告
  return props.nodes
})

// 🚀 性能优化：缓存树配置对象
const treeConfig = computed(() => ({
  size: props.size,
  searchable: props.searchable,
  selectable: props.selectable,
  editable: props.editable,
  showSelectionCheckbox: props.showSelectionCheckbox,
  draggable: props.draggable, // ✅ 拖拽功能配置
  // 细粒度按钮控制
  showFavoriteButton: props.showFavoriteButton,
  showEditButton: props.showEditButton,
  showDeleteButton: props.showDeleteButton,
  showAddButton: props.showAddButton,
  showOpenNewTabButton: props.showOpenNewTabButton,
  showCopyUrlButton: props.showCopyUrlButton,
  showShareButton: props.showShareButton
}))

// 🚀 性能优化：缓存虚拟滚动配置
interface VirtualConfig {
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

/**
 * 固定节点高度映射：通过约束节点布局，确保虚拟滚动定位稳定。
 */
const TREE_ITEM_HEIGHT_MAP: Record<
  'compact' | 'comfortable' | 'spacious',
  number
> = {
  compact: 30,
  comfortable: 36,
  spacious: 44
}
const LARGE_FOLDER_THRESHOLD = 2000

const virtualEnabled = computed(() => {
  const cfg = normalizedVirtual.value
  if (props.strictChromeOrder) return false
  if (cfg.enabled) return true
  const threshold = cfg.threshold ?? 500
  const count = countAllNodes(treeSource.value)
  return count > threshold
})

const itemHeight = computed(() => {
  const cfg = normalizedVirtual.value
  if (cfg.itemHeight) return cfg.itemHeight
  return TREE_ITEM_HEIGHT_MAP[props.size] ?? TREE_ITEM_HEIGHT_MAP.comfortable
})

/**
 * 动态计算 overscan，缓解滚动空白与额外渲染开销之间的冲突。
 */
const virtualOverscan = computed(() => {
  const containerHeight =
    containerRef.value?.clientHeight ?? TREE_ITEM_HEIGHT_MAP.comfortable * 12
  const rowsInView = Math.max(Math.ceil(containerHeight / itemHeight.value), 1)
  return Math.max(Math.min(rowsInView * 3, 120), 24)
})

// 🚀 性能优化：缓存样式类
const treeClasses = computed(() => ({
  [`tree--${props.size}`]: true,
  'tree--virtual': virtualEnabled.value,
  'tree--loading': loading.value
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
// 🔍 根据搜索条件过滤节点，保持树结构不破坏
const filteredNodes = computed(() => {
  try {
    const source = treeSource.value

    const base = !searchQuery.value
      ? source
      : filterNodes(source as unknown as BookmarkNode[], searchQuery.value)
    return Array.isArray(base) ? base : []
  } catch {
    return []
  }
})

// 🎨 是否显示空状态
const shouldShowEmptyState = computed(() => {
  // 加载中不显示空状态
  if (loading.value) return false
  // 有数据不显示空状态
  if (filteredNodes.value.length > 0) return false
  // 没有数据时显示空状态
  return true
})

// 🎨 空状态配置
const emptyStateConfig = computed(() => {
  const hasSearchQuery = searchQuery.value.trim().length > 0
  const hasSourceData = (props.nodes?.length ?? 0) > 0

  if (hasSearchQuery) {
    // 搜索无结果
    return {
      icon: 'icon-search',
      title: '未找到匹配的书签',
      description: `没有找到与"${searchQuery.value}"相关的书签，试试其他关键词吧`
    }
  }

  if (!hasSourceData) {
    // 真的没有书签
    return {
      icon: 'icon-folder',
      title: '暂无书签'
      // description: '没有找到任何书签，请添加书签'
    }
  }

  // 其他情况（理论上不应该到这里）
  return {
    icon: 'icon-folder',
    title: '暂无数据',
    description: ''
  }
})

watch(
  () => treeSource.value,
  async () => {
    if (virtualEnabled.value) {
      // 等待 DOM 更新并确保有数据后再滚动
      await nextTick()
      if (flattenedItems.value.length > 0) {
        try {
          virtualizer.value?.scrollToIndex(0, { align: 'start' })
        } catch {
          // 虚拟滚动器还未准备好，忽略错误
        }
      }
    }
  }
)

const flattenedItems = computed(() => {
  if (!virtualEnabled.value) return []
  return flattenNodes(filteredNodes.value, expandedFolders.value)
})

// 🚀 性能优化：缓存扁平化节点
type FlattenedItem =
  | {
      kind: 'node'
      id: string
      node: BookmarkNode
      level: number
    }
  | {
      kind: 'chunk'
      id: string
      chunk: {
        parentId: string
        items: BookmarkNode[]
      }
      level: number
    }

/**
 * S-树虚拟化：仅扁平化当前可视路径，避免整棵树递归展开。
 */
function flattenNodes(
  nodes: BookmarkNode[] | unknown,
  expanded: Set<string>,
  level = 0,
  ancestors: Set<string> = new Set()
): FlattenedItem[] {
  const result: FlattenedItem[] = []
  const arr = Array.isArray(nodes) ? (nodes as BookmarkNode[]) : []
  for (const node of arr) {
    if (!node || typeof node !== 'object') continue
    const nodeId = String(node.id)
    result.push({ kind: 'node', id: nodeId, node, level })

    const isExpanded = expanded.has(nodeId)
    if (!isExpanded) continue

    if (ancestors.has(nodeId)) {
      continue
    }
    ancestors.add(nodeId)
    const children = (node as BookmarkNode).children
    if (Array.isArray(children) && children.length) {
      if (children.length > LARGE_FOLDER_THRESHOLD) {
        const chunkSize = Math.max(Math.floor(LARGE_FOLDER_THRESHOLD / 4), 400)
        for (let index = 0; index < children.length; index += chunkSize) {
          const slice = children.slice(index, index + chunkSize)
          result.push({
            kind: 'chunk',
            id: `${nodeId}-chunk-${index}`,
            chunk: { parentId: nodeId, items: slice },
            level: level + 1
          })
        }
      } else {
        result.push(...flattenNodes(children, expanded, level + 1, ancestors))
      }
    }

    ancestors.delete(nodeId)
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

/**
 * 聚合当前选中节点列表，供事件回调使用
 */
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
  find(treeSource.value)
  return result
}

// === TanStack Virtualizer ===
// 🌀 初始化虚拟滚动器，减少 DOM 渲染压力
const virtualizer = useVirtualizer(
  computed(() => ({
    count: flattenedItems.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => itemHeight.value,
    overscan: virtualOverscan.value
  }))
)

let rafId: number | null = null
const lastKnownScrollTop = ref(0)

interface VirtualRow {
  start: number
  size: number
  record: FlattenedItem
}

/**
 * 虚拟滚动行计算
 */
const virtualRows = computed<VirtualRow[]>(() => {
  const rows: VirtualRow[] = []
  const items = virtualizer.value.getVirtualItems()
  const source = flattenedItems.value
  for (const item of items) {
    const record = source[item.index]
    if (!record) continue
    rows.push({ start: item.start, size: item.size, record })
  }
  return rows
})

// ✅ 性能优化：只对可见节点应用删除动画
// 在虚拟滚动模式下，只对当前可见的节点应用动画，减少不必要的 CSS 更新
const visibleDeletingNodeIds = computed(() => {
  if (!props.deletingNodeIds || props.deletingNodeIds.size === 0) {
    return new Set<string>()
  }

  // 如果未启用虚拟滚动，返回所有删除节点
  if (!virtualEnabled.value) {
    return props.deletingNodeIds
  }

  // 虚拟滚动模式：只返回可见节点的删除 ID
  const visibleIds = new Set<string>()
  for (const row of virtualRows.value) {
    if (row.record.kind === 'node' && row.record.node) {
      const nodeId = String(row.record.node.id)
      if (props.deletingNodeIds.has(nodeId)) {
        visibleIds.add(nodeId)
      }
    } else if (row.record.kind === 'chunk' && row.record.chunk) {
      // 对于 chunk，检查其中的所有节点
      const chunkItems = row.record.chunk.items
      if (Array.isArray(chunkItems)) {
        for (const node of chunkItems) {
          const nodeId = String(node.id)
          if (props.deletingNodeIds.has(nodeId)) {
            visibleIds.add(nodeId)
          }
        }
      }
    }
  }
  return visibleIds
})

// 📏 计算虚拟滚动总高度，供 spacer 占位
const totalHeight = computed(() => virtualizer.value.getTotalSize())

function scheduleVirtualizerUpdate() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    virtualizer.value.measure()
  })
}

// === 性能优化：缓存状态检查函数 ===
// ✅ 移除了 v-memo，不再需要这些辅助函数

// === 事件处理 ===
// 🚀 性能优化：使用箭头函数避免重复创建
const handleNodeClick = (node: BookmarkNode, event: MouseEvent) => {
  emit('node-click', node, event)
}

const handleFolderToggle = (folderId: string, node: BookmarkNode) => {
  const isExpanded = expandedFolders.value.has(folderId)
  logger.debug('SimpleBookmarkTree', 'handleFolderToggle', {
    folderId,
    title: node.title,
    isExpanded,
    accordionMode: props.accordionMode,
    childrenLoaded: node._childrenLoaded,
    childrenLength: Array.isArray(node.children) ? node.children.length : 0,
    childrenCount: node.childrenCount
  })

  if (isExpanded) {
    // 收起文件夹
    expandedFolders.value.delete(folderId)
  } else {
    // 展开文件夹

    // 🎯 手风琴模式：展开时收起同级的其他文件夹
    if (props.accordionMode) {
      // 获取同级节点（parentId 相同的节点）
      const parentId = node.parentId
      const siblingIds: string[] = []

      // 遍历所有节点，找到同级的文件夹节点
      const findSiblings = (nodes: BookmarkNode[]) => {
        for (const n of nodes) {
          // 同父节点，且不是当前节点，且是文件夹
          if (n.parentId === parentId && n.id !== folderId && !n.url) {
            siblingIds.push(n.id)
          }
          // 递归查找子节点
          if (n.children && n.children.length > 0) {
            findSiblings(n.children)
          }
        }
      }

      findSiblings(props.nodes)

      // 收起所有同级的已展开文件夹
      for (const siblingId of siblingIds) {
        if (expandedFolders.value.has(siblingId)) {
          expandedFolders.value.delete(siblingId)
          logger.debug(
            'SimpleBookmarkTree',
            '📁 手风琴模式：收起同级文件夹',
            siblingId
          )
        }
      }
    }

    // 展开当前文件夹
    expandedFolders.value.add(folderId)
    // ✅ 数据已完整加载，无需懒加载
  }

  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)

  emit('folder-toggle', folderId, node, !isExpanded)
}

// === 自动加载功能 ===
// 设置滚动自动加载
const setupScrollAutoLoad = () => {
  if (!containerRef.value) return

  const handleScroll = () => {
    if (!containerRef.value) return

    const { scrollTop } = containerRef.value
    lastKnownScrollTop.value = scrollTop
    scheduleVirtualizerUpdate()
    // ✅ 数据已完整加载，无需懒加载
  }

  containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
}

/**
 * 在当前树数据中查找指定 ID 的节点
 * - 外部驱动模式需要基于 props.nodes 查询
 */
const findNodeById = (id: string): BookmarkNode | undefined => {
  const source = treeSource.value
  if (!Array.isArray(source)) return undefined
  const search = (nodes: BookmarkNode[]): BookmarkNode | undefined => {
    for (const node of nodes) {
      if (String(node.id) === String(id)) return node
      if (Array.isArray(node.children)) {
        const found = search(node.children)
        if (found) return found
      }
    }
    return undefined
  }
  return search(source as BookmarkNode[])
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

const handleFolderShare = (node: BookmarkNode) => {
  emit('folder-share', node)
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (node.url) {
    emit('bookmark-open-new-tab', node)
  }
}

const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  emit('bookmark-copy-url', node)
}

const handleBookmarkToggleFavorite = (
  node: BookmarkNode,
  isFavorite: boolean
) => {
  emit('bookmark-toggle-favorite', node, isFavorite)
}

// 拖拽事件处理
const handleDragStart = (node: BookmarkNode) => {
  dragState.value.isDragging = true
  dragState.value.dragSourceId = String(node.id)
  logger.debug('BookmarkTree', '开始拖拽', { nodeId: node.id })
}

const handleDragOver = (data: {
  node: BookmarkNode
  position: 'before' | 'inside' | 'after'
}) => {
  dragState.value.dropTargetId = String(data.node.id)
  dragState.value.dropPosition = data.position
}

const handleDragLeave = () => {
  dragState.value.dropTargetId = null
  dragState.value.dropPosition = null
}

const handleDrop = (data: {
  sourceId: string
  targetId: string
  position: 'before' | 'inside' | 'after'
}) => {
  logger.info('BookmarkTree', '拖拽放置', data)
  emit('bookmark-move', data)

  // 重置拖拽状态
  dragState.value.isDragging = false
  dragState.value.dragSourceId = null
  dragState.value.dropTargetId = null
  dragState.value.dropPosition = null
}

const handleDragEnd = () => {
  // 重置拖拽状态
  dragState.value.isDragging = false
  dragState.value.dragSourceId = null
  dragState.value.dropTargetId = null
  dragState.value.dropPosition = null
}

/**
 * 处理节点选择逻辑
 * - 支持单选/多选
 * - 同步维护子节点的选中状态
 */
const handleNodeSelect = (nodeId: string, node: BookmarkNode) => {
  const id = String(nodeId)
  const isSelected = selectedNodes.value.has(id)

  // 递归选中/取消选中所有子孙节点
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

  // 🆕 向上级联更新父节点选中状态
  const updateAncestors = (currentNode: BookmarkNode) => {
    if (!currentNode.parentId) return

    const parentNode = findNodeById(currentNode.parentId)
    if (!parentNode || !parentNode.children || parentNode.children.length === 0)
      return

    // 检查父节点的所有直接子节点是否都被选中
    const allChildrenSelected = parentNode.children.every(child =>
      selectedNodes.value.has(String(child.id))
    )

    const anyChildSelected = parentNode.children.some(child =>
      selectedNodes.value.has(String(child.id))
    )

    if (allChildrenSelected) {
      // 所有子节点都选中 → 选中父节点
      selectedNodes.value.add(String(parentNode.id))
      // 继续向上检查
      updateAncestors(parentNode)
    } else if (!anyChildSelected) {
      // 所有子节点都未选中 → 取消选中父节点
      selectedNodes.value.delete(String(parentNode.id))
      // 继续向上检查
      updateAncestors(parentNode)
    } else {
      // 部分选中 → 取消选中父节点（会通过 selectedDescCounts 显示半选中）
      selectedNodes.value.delete(String(parentNode.id))
      // 继续向上检查
      updateAncestors(parentNode)
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
      // 取消选中：移除该节点及所有子孙节点
      selectedNodes.value.delete(id)
      removeDescendants(node)
      // 🆕 向上更新父节点状态
      updateAncestors(node)
    } else {
      // 选中：添加该节点及所有子孙节点
      selectedNodes.value.add(id)
      addDescendants(node)
      // 🆕 向上更新父节点状态
      updateAncestors(node)
    }
  }

  // ✅ 强制触发响应式更新（Vue 无法自动追踪 Set 内部变化）
  selectedNodes.value = new Set(selectedNodes.value)

  const selected = selectedNodes.value.has(id)
  emit('node-select', id, node, selected)
  emit('selection-change', Array.from(selectedNodes.value), getSelectedNodes())

  // 基于当前选中集合重算已选后代计数（O(#selected书签 * 平均祖先深度））
  // ✅ 直接修改 props.selectedDescCounts (Map 是引用类型，父组件会自动更新)
  // ✅ 使用完整的 treeSource 而不是 filteredNodes，确保搜索状态下也能正确计算父节点的 indeterminate 状态
  const source = props.nodes || treeSource.value
  const newCounts = new Map<string, number>()

  if (Array.isArray(source)) {
    const traverse = (nodes: BookmarkNode[], ancestors: string[] = []) => {
      for (const current of nodes) {
        const currentId = String(current.id)
        const nextAncestors = current.url
          ? ancestors
          : [...ancestors, currentId]

        if (current.url && selectedNodes.value.has(currentId)) {
          for (const ancestorId of ancestors) {
            newCounts.set(ancestorId, (newCounts.get(ancestorId) ?? 0) + 1)
          }
        }

        if (Array.isArray(current.children) && current.children.length) {
          traverse(current.children, nextAncestors)
        }
      }
    }

    traverse(source as BookmarkNode[])
  }

  // ✅ 更新 Map 并触发响应式（通过 emit 让父组件重新赋值）
  if (props.selectedDescCounts) {
    try {
      props.selectedDescCounts.clear()
      newCounts.forEach((value, key) => {
        props.selectedDescCounts!.set(key, value)
      })
    } catch (error) {
      // ⚠️ 如果 Map 被冻结（例如被 Immer 管理），创建新 Map 并替换
      logger.warn('BookmarkTree', 'selectedDescCounts 被冻结，无法直接修改', {
        error
      })
    }
    
    // 🔄 通过 emit 通知父组件 Map 已更新（触发响应式）
    emit('desc-counts-updated', new Map(props.selectedDescCounts))
  }
}

// === 工具函数 ===
// 🚀 性能优化：缓存节点元素注册/注销函数
function registerNodeEl(id: string, el: HTMLElement) {
  nodeElRegistry.set(String(id), el)
}

function unregisterNodeEl(id: string) {
  nodeElRegistry.delete(String(id))
}

/**
 * 针对树结构执行搜索过滤
 * - 保证保留命中的节点及其祖先，用于展开展示
 */
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

// === 监听器 ===
watch(searchQuery, (newQuery: string) => {
  const trimmed = newQuery?.trim() || ''

  if (trimmed) {
    // 仅展开命中路径：收集命中节点及其祖先
    try {
      const source = treeSource.value
      const matchedIds = new Set<string>()

      const lowerQuery = trimmed.toLowerCase()
      const matchNode = (n: BookmarkNode): boolean => {
        const titleLower = (n.titleLower || n.title || '')
          .toString()
          .toLowerCase()
        const urlLower = (n.urlLower || n.url || '').toString().toLowerCase()
        const domainLower = (n.domain || '').toLowerCase()
        const tags = n.tags || []
        const hasTagHit = tags.some((t: string) =>
          t.toLowerCase().includes(lowerQuery)
        )
        return (
          titleLower.includes(lowerQuery) ||
          urlLower.includes(lowerQuery) ||
          domainLower.includes(lowerQuery) ||
          hasTagHit
        )
      }

      const dfs = (arr: BookmarkNode[], ancestors: string[] = []) => {
        for (const n of arr) {
          const childAnc = [...ancestors, n.id]
          if (matchNode(n)) {
            for (const aid of ancestors) matchedIds.add(aid)
          }
          if (n.children && n.children.length) dfs(n.children, childAnc)
        }
      }

      if (Array.isArray(source)) dfs(source)

      expandedFolders.value = new Set(matchedIds)
    } catch {
      // 回退：若出现异常，保持原策略
      expandAll()
    }
  } else {
    collapseAll()
  }

  emit('search', newQuery)
})

// === 生命周期 ===
onMounted(() => {
  emit('ready')
  setupScrollAutoLoad()
})

// === 暴露的方法 ===
const expandAll = () => {
  const source = treeSource.value
  const allFolderIds = getAllFolderIds(source)
  if (allFolderIds.length > 2000) {
    logger.warn('SimpleBookmarkTree', 'expandAll 被限制，节点过多')
    notificationService.notify('节点过多，展开全部会影响性能，请按需展开。', {
      level: 'warning'
    })
    return
  }
  expandedFolders.value = new Set(allFolderIds)
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
  emit('expand-state-change', true)
}

const collapseAll = () => {
  expandedFolders.value = new Set()
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
  emit('expand-state-change', false)
}

const clearSelection = () => {
  selectedNodes.value = new Set()
  // ✅ 安全地清空 Map（处理可能的 Immer 冻结对象）
  try {
    props.selectedDescCounts.clear()
  } catch (error) {
    logger.warn('BookmarkTree', 'selectedDescCounts 被冻结，无法清空', {
      error
    })
  }
  emit('selection-change', [], [])
}

const clearHoverAndActive = () => {
  activeNodeId.value = undefined
}

// === 缺失的方法实现 ===
/**
 * 暴露给父组件的聚焦能力
 */
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
    // 强制触发响应式更新
    expandedFolders.value = new Set(expandedFolders.value)
  }

  // 构建需要展开的父节点路径
  let pathIdsToExpand: string[] = []

  if (options?.pathIds && options.pathIds.length > 0) {
    // 优先使用传入的 pathIds（来自 IndexedDB 的预处理数据）
    pathIdsToExpand = options.pathIds
  } else {
    // 降级方案：自己查找并构建路径
    const targetNode = findNodeById(id)
    if (targetNode) {
      pathIdsToExpand = buildParentPath(id)
    }
  }

  // 展开父路径上的所有文件夹
  if (pathIdsToExpand.length > 0) {
    for (const pathId of pathIdsToExpand) {
      expandedFolders.value.add(pathId)
      // ✅ 数据已完整加载，无需懒加载
    }
    // 强制触发响应式更新
    expandedFolders.value = new Set(expandedFolders.value)
  }

  // 滚动操作：非阻塞异步执行
  if (options?.scrollIntoView || options?.scrollIntoViewCenter) {
    nextTick(() => {
      const element = nodeElRegistry.get(id)
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: options?.scrollIntoViewCenter ? 'center' : 'nearest'
        })
      } else {
        requestAnimationFrame(() => {
          const el = nodeElRegistry.get(id)
          if (el) {
            el.scrollIntoView({
              behavior: 'smooth',
              block: options?.scrollIntoViewCenter ? 'center' : 'nearest'
            })
          }
        })
      }
    })
  }
}

/**
 * 构建从根到目标节点的父路径
 * 返回所有需要展开的文件夹 ID 列表（不包含目标节点本身）
 */
const buildParentPath = (targetId: string): string[] => {
  const path: string[] = []
  const source = treeSource.value
  if (!Array.isArray(source)) return path

  // 递归查找节点并记录路径
  const findPath = (nodes: BookmarkNode[], currentPath: string[]): boolean => {
    for (const node of nodes) {
      if (String(node.id) === String(targetId)) {
        // 找到目标节点，返回当前路径（不包含目标节点本身）
        path.push(...currentPath)
        return true
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        // 递归查找子节点
        if (findPath(node.children, [...currentPath, String(node.id)])) {
          return true
        }
      }
    }
    return false
  }

  findPath(source as BookmarkNode[], [])
  return path
}

const expandFolderById = (id: string) => {
  expandedFolders.value.add(id)
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

const collapseFolderById = (id: string) => {
  expandedFolders.value.delete(id)
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

const toggleFolderById = (id: string) => {
  if (expandedFolders.value.has(id)) {
    expandedFolders.value.delete(id)
  } else {
    expandedFolders.value.add(id)
  }
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

const selectNodeById = (id: string, opts?: { append?: boolean }) => {
  const sid = String(id)
  const allowMultiple = props.selectable === 'multiple'
  const append = !!opts?.append
  if (!allowMultiple || !append) {
    selectedNodes.value = new Set()
  }
  selectedNodes.value.add(sid)
  // ✅ 强制触发响应式更新
  selectedNodes.value = new Set(selectedNodes.value)
  emit('selection-change', Array.from(selectedNodes.value), getSelectedNodes())
}

const selectNodesByIds = (ids: string[], opts?: { append?: boolean }) => {
  const allowMultiple = props.selectable === 'multiple'
  const normalized = ids.map(id => String(id)).filter(Boolean)
  const current = opts?.append
    ? new Set(selectedNodes.value)
    : new Set<string>()
  for (const id of normalized) {
    if (!allowMultiple && current.size >= 1) {
      current.clear()
    }
    current.add(id)
    if (!allowMultiple) break
  }
  selectedNodes.value = current
  emit('selection-change', Array.from(current), getSelectedNodes())

  // ✅ 重新计算选中后代计数
  // ✅ 使用完整的 props.nodes 而不是 filteredNodes，确保搜索状态下也能正确计算父节点的 indeterminate 状态
  const source = props.nodes || treeSource.value
  const newCounts = new Map<string, number>()

  if (Array.isArray(source)) {
    const traverse = (nodes: BookmarkNode[], ancestors: string[] = []) => {
      for (const node of nodes) {
        const nodeId = String(node.id)
        const nextAncestors = node.url ? ancestors : [...ancestors, nodeId]

        if (node.url && current.has(nodeId)) {
          for (const ancestorId of ancestors) {
            newCounts.set(ancestorId, (newCounts.get(ancestorId) ?? 0) + 1)
          }
        }

        if (Array.isArray(node.children) && node.children.length) {
          traverse(node.children, nextAncestors)
        }
      }
    }

    traverse(source)
  }

  // ✅ 安全地更新 Map（处理可能的 Immer 冻结对象）
  try {
    props.selectedDescCounts.clear()
    newCounts.forEach((value, key) => {
      props.selectedDescCounts.set(key, value)
    })
  } catch (error) {
    logger.warn('BookmarkTree', 'selectedDescCounts 被冻结，无法直接修改', {
      error
    })
  }
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
  clearHoverAndActive,
  expandFolderById,
  collapseFolderById,
  toggleFolderById,
  selectNodeById,
  selectNodesByIds,
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
  border-radius: var(--border-radius-md);
  background: var(--color-surface);
}

.tree-search {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.tree-container-wrapper {
  position: relative;
}

.tree-container {
  position: relative;
  flex: 1;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  overflow: auto;
}

.tree-container.is-loading {
  pointer-events: none;
}

.tree-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
}

.tree-loading-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
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
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

/* 尺寸变体 */
.tree--compact {
  --item-height: 28px;
  --indent-size: 20px; /* ✅ 增加缩进：16 → 20 */
}

.tree--comfortable {
  --item-height: 32px;
  --indent-size: 24px; /* ✅ 增加缩进：20 → 24 */
}

.tree--spacious {
  --item-height: 40px;
  --indent-size: 32px; /* ✅ 增加缩进：24 → 32 */
}

.tree--loading {
  opacity: 0.6;
  pointer-events: none;
}
</style>
