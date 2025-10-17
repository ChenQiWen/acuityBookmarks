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
          :loading-children="loadingChildrenState"
          :selected-desc-counts="selectedDescCountsState"
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
              :loading-children="loadingChildrenState"
              :selected-desc-counts="selectedDescCountsState"
              :search-query="searchQuery"
              :highlight-matches="highlightMatches"
              :config="treeConfig"
              :is-virtual-mode="true"
              :strict-order="props.strictChromeOrder"
              :active-id="activeNodeId"
              :hovered-id="hoveredNodeId"
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
import { Icon, Input, Spinner } from '@/components'
import type { BookmarkNode } from '@/types'
import { useBookmarkStore } from '@/stores/bookmarkStore'

// ✅ 明确组件名称，便于 Vue DevTools 与日志追踪
defineOptions({ name: 'SimpleBookmarkTree' })

// 🚀 性能优化：使用 defineAsyncComponent 懒加载子组件
const SimpleTreeNode = defineAsyncComponent(
  () => import('@/components/composite/SimpleTreeNode/SimpleTreeNode.vue')
)

// === Store ===
// 📚 默认依赖 Pinia 中的 bookmarkStore，外部可通过 props nodes 覆盖
const bookmarkStore = useBookmarkStore()

// 📌 后台分页加载统一尺寸，确保懒加载策略一致
const DEFAULT_PAGE_SIZE = 100

// === Props 定义 ===
/**
 * 🌳 书签树组件支持的属性集合
 * - 兼容外部注入节点或直接读取 store
 * - 统一在这里补充中文注释，便于团队理解参数语义
 */
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
  /** 外部提供的“子节点加载中”集合 */
  loadingChildren?: Set<string>
  /** 外部提供的“选中后代计数”映射 */
  selectedDescCounts?: Map<string, number>
}

// ✅ 组件默认值集中在此，便于统一维护
const props = withDefaults(defineProps<Props>(), {
  nodes: undefined,
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
  initialExpanded: () => [],
  initialSelected: () => [],
  source: 'sidePanel',
  highlightMatches: true,
  showSelectionCheckbox: false,
  loadingChildren: undefined,
  selectedDescCounts: undefined
})

// === Emits 定义 ===
// ✅ 组件对外事件统一声明，用中文说明触发时机
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
  /** 展开状态变化事件：true=全部展开，false=全部收起 */
  'expand-state-change': [isAllExpanded: boolean]
  'request-children': [
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      offset: number
    }
  ]
  'request-more-children': [
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      loaded: number
    }
  ]
}>()

// === 响应式状态 ===
// 🚀 性能优化：使用 shallowRef 减少深度响应式开销
const searchQuery = ref('')
const expandedFolders = shallowRef(
  new Set(props.initialExpanded.map((id: string) => String(id)))
)
const selectedNodes = shallowRef(
  new Set(props.initialSelected.map((id: string) => String(id)))
)
const activeNodeId = ref<string | undefined>(undefined)
const hoveredNodeId = ref<string | undefined>(undefined)
const containerRef = ref<HTMLElement | null>(null)
// 节点根元素注册表：避免滚动定位时反复 querySelector
const nodeElRegistry = new Map<string, HTMLElement>()
// 滚动状态标记，避免并发滚动
const isScrolling = ref(false)
// 自动加载相关状态
const loadingMoreFolders = shallowRef(new Set<string>())

// 📦 统一加载状态来源：若外部传入则优先生效，否则退回 Pinia store
const loadingChildrenState = computed(
  () =>
    props.loadingChildren ??
    (isUsingStoreData.value ? bookmarkStore.loadingChildren : new Set<string>())
)

// 📊 选中后代计数同理：保持组件在独立数据源场景下依旧可用
const selectedDescCountsState = computed(
  () =>
    props.selectedDescCounts ??
    (isUsingStoreData.value
      ? bookmarkStore.selectedDescCounts
      : new Map<string, number>())
)

/**
 * 向外部请求首次加载指定目录的子节点
 * - 在使用 Pinia store 时直接调用 store action
 * - 外部驱动模式下通过事件通知父级处理
 */
const requestChildren = (
  folderId: string,
  node: BookmarkNode,
  options: { limit: number; offset: number }
) => {
  if (isUsingStoreData.value) {
    void bookmarkStore.fetchChildren(folderId, options.limit, options.offset)
    return
  }
  emit('request-children', {
    folderId,
    node,
    limit: options.limit,
    offset: options.offset
  })
}

/**
 * 向外部请求增量加载目录更多子节点
 * - 与 requestChildren 类似，但携带当前已加载数量，用于分页
 */
const requestMoreChildren = (
  folderId: string,
  node: BookmarkNode,
  limit: number,
  loaded: number
) => {
  if (isUsingStoreData.value) {
    void bookmarkStore.fetchMoreChildren(folderId, limit)
    return
  }
  emit('request-more-children', { folderId, node, limit, loaded })
}

// === 计算属性 ===

// 🚀 性能优化：统一loading状态判断
// 🔁 判定当前是否使用 Pinia 数据：true => 使用 store，false => 使用外部传入节点
const isUsingStoreData = computed(() => props.nodes === undefined)

const loading = computed(() => {
  if (props.loading !== undefined) {
    return props.loading
  }
  return isUsingStoreData.value ? bookmarkStore.isLoading : false
})

// 🌲 统一获取当前渲染所使用的节点列表
const treeSource = computed(() =>
  props.nodes !== undefined ? props.nodes : bookmarkStore.bookmarkTree
)

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
  const count = countAllNodes(treeSource.value)
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
// 🔍 根据搜索关键字过滤节点，保持树结构不破坏
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

// 🚀 性能优化：缓存扁平化节点
const flattenedItems = computed(() => {
  if (!virtualEnabled.value) return []
  return flattenNodes(filteredNodes.value, expandedFolders.value)
})

// === TanStack Virtualizer ===
// 🌀 初始化虚拟滚动器，减少 DOM 渲染压力
const virtualizer = useVirtualizer(
  computed(() => ({
    count: flattenedItems.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => itemHeight.value,
    overscan: 10
  }))
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
// 📏 计算虚拟滚动总高度，供 spacer 占位
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
  console.log(`[SimpleBookmarkTree] 📂 handleFolderToggle:`, {
    folderId,
    title: node.title,
    isExpanded,
    childrenLoaded: node._childrenLoaded,
    childrenLength: Array.isArray(node.children) ? node.children.length : 0,
    childrenCount: node.childrenCount
  })

  if (isExpanded) {
    expandedFolders.value.delete(folderId)
  } else {
    expandedFolders.value.add(folderId)
    const loaded = Array.isArray(node.children) ? node.children.length : 0
    const total = node.childrenCount ?? loaded

    if (!node._childrenLoaded) {
      requestChildren(folderId, node, { limit: DEFAULT_PAGE_SIZE, offset: 0 })
    } else if (total > loaded) {
      requestMoreChildren(folderId, node, DEFAULT_PAGE_SIZE, loaded)
    }
  }

  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)

  emit('folder-toggle', folderId, node, !isExpanded)
}

// === 自动加载功能 ===
// 设置滚动自动加载
const setupScrollAutoLoad = () => {
  if (!containerRef.value) return

  let lastScrollTop = 0

  const handleScroll = () => {
    if (!containerRef.value) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.value
    const isScrollingDown = scrollTop > lastScrollTop
    lastScrollTop = scrollTop

    // 如果正在向上滚动，不触发加载
    if (!isScrollingDown) return

    // 如果已经滚动到底部80%位置，开始自动加载
    const scrollThreshold = scrollHeight * 0.8
    const currentScroll = scrollTop + clientHeight

    if (currentScroll >= scrollThreshold) {
      autoLoadMoreContent()
    }
  }

  containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
}

/**
 * 当滚动接近底部时触发批量懒加载
 * - 仅 Pinia store 场景启用，保证外部驱动模式不会重复请求
 */
const autoLoadMoreContent = async () => {
  if (!isUsingStoreData.value) return
  const foldersToLoad = findFoldersNeedingMoreChildren()

  if (foldersToLoad.length === 0) return

  await Promise.all(
    foldersToLoad.map(folderId => loadMoreChildrenForFolder(folderId))
  )
}

// 查找需要加载更多子节点的文件夹
const findFoldersNeedingMoreChildren = (): string[] => {
  const folders: string[] = []

  const checkNode = (node: BookmarkNode) => {
    if (node.children && hasMoreChildren(node)) {
      folders.push(node.id)
    }
    if (node.children) {
      node.children.forEach(checkNode)
    }
  }

  const nodes = treeSource.value
  if (Array.isArray(nodes)) {
    ;(nodes as BookmarkNode[]).forEach(checkNode)
  }

  return folders
}

// 检查文件夹是否还有更多子节点需要加载
const hasMoreChildren = (node: BookmarkNode): boolean => {
  if (!node.children) return false
  const total = node.childrenCount ?? 0
  const loaded = node.children.length
  return total > loaded && !loadingMoreFolders.value.has(node.id)
}

/**
 * 为指定目录触发“加载更多”流程
 * - Pinia store 模式直接调用 store
 * - 外部驱动模式通过事件回调交给父组件
 */
const loadMoreChildrenForFolder = async (folderId: string) => {
  if (loadingMoreFolders.value.has(folderId)) return

  loadingMoreFolders.value.add(folderId)
  try {
    if (isUsingStoreData.value) {
      await bookmarkStore.fetchMoreChildren(folderId, DEFAULT_PAGE_SIZE)
    } else {
      const target = findNodeById(folderId)
      if (target) {
        requestMoreChildren(
          folderId,
          target,
          DEFAULT_PAGE_SIZE,
          target.children?.length ?? 0
        )
      }
    }
  } finally {
    loadingMoreFolders.value.delete(folderId)
  }
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

/**
 * 处理节点选择逻辑
 * - 支持单选/多选
 * - 同步维护子节点的选中状态
 */
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

  // 基于当前选中集合重算已选后代计数（O(#selected书签 * 平均祖先深度））
  bookmarkStore.recomputeSelectedDescCounts(selectedNodes.value)
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
  find(bookmarkStore.bookmarkTree)
  return result
}

// === 监听器 ===
watch(searchQuery, (newQuery: string) => {
  const trimmed = newQuery?.trim() || ''

  if (trimmed) {
    // 仅展开命中路径：收集命中节点及其祖先
    try {
      const source =
        props.nodes !== undefined ? props.nodes : bookmarkStore.bookmarkTree
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
  const source =
    props.nodes !== undefined ? props.nodes : bookmarkStore.bookmarkTree
  const allFolderIds = getAllFolderIds(source)
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
  emit('selection-change', [], [])
}

const clearHoverAndActive = () => {
  hoveredNodeId.value = undefined
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
    // 强制触发响应式更新
    expandedFolders.value = new Set(expandedFolders.value)
  }
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
