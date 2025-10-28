<!--
BookmarkSearch - 书签搜索组件

QueryAppService 的 UI 层体现
- 聚合 QueryAppService 所有能力
- 接收搜索关键词，从 IndexedDB 查询书签
- 返回标准 BookmarkNode[] 格式
- 使用 BookmarkTree 显示结果

注意：术语分层
- UI 层（用户看到的）：Search / 搜索 (BookmarkSearch)
- 代码层（技术实现）：Query / 查询 (QueryAppService)
- 所有数据都在本地 IndexedDB，实时响应无需网络请求
-->

<template>
  <div class="bookmark-search">
    <!-- 搜索结果容器 -->
    <div class="filter-results-container">
      <!-- 加载状态 -->
      <div v-if="isFiltering" class="filter-loading">
        <Spinner size="md" />
        <p class="loading-text">搜索中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!query" class="filter-empty">
        <Icon name="icon-magnify" :size="48" color="text-tertiary" />
        <p class="empty-text">输入搜索关键词</p>
      </div>

      <!-- 无结果 -->
      <div v-else-if="bookmarkNodes.length === 0" class="filter-no-results">
        <Icon name="icon-alert-circle" :size="48" color="text-tertiary" />
        <p class="empty-text">无匹配结果</p>
        <p class="empty-hint">尝试使用其他关键词</p>
      </div>

      <!-- 搜索结果 -->
      <div v-else class="filter-results">
        <!-- 结果统计 -->
        <div v-if="showStats" class="filter-stats">
          <span class="stats-text">找到 {{ totalResults }} 个结果</span>
          <span v-if="executionTime" class="stats-time">
            ({{ executionTime }}ms)
          </span>
        </div>

        <!-- 使用 BookmarkTree 显示结果 -->
        <BookmarkTree
          :nodes="bookmarkNodes"
          :loading-children="loadingChildren"
          :selected-desc-counts="selectedDescCounts"
          :height="treeHeight"
          :size="treeSize"
          :selectable="selectable"
          :editable="editable"
          :virtual="virtual"
          :highlight-matches="true"
          :show-toolbar="showToolbar"
          v-bind="treeProps"
          @node-click="handleNodeClick"
          @node-select="handleNodeSelect"
          @selection-change="handleSelectionChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, shallowRef } from 'vue'
import { Icon, Spinner } from '@/components'
import BookmarkTree from '@/components/composite/BookmarkTree/BookmarkTree.vue'
import { bookmarkFilterService } from '@/application/query/bookmark-query-service'
import type { FilteredBookmarkNode } from '@/application/query/bookmark-query-service'
import type { EnhancedSearchResult } from '@/types/domain/query'
import type { BookmarkNode } from '@/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

// ✅ 明确组件名称
defineOptions({ name: 'BookmarkSearch' })

// ==================== Props ====================
interface Props {
  /** 搜索关键词 */
  query: string

  /**
   * 搜索模式
   * - indexeddb: 从 IndexedDB 查询（异步，高性能）
   * - memory: 从内存数据搜索（同步，适用于编辑中的数据或 LLM 返回的数据）
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 内存数据源
   * - mode='memory' 时必需
   * - 可以是已编辑的数据、LLM 返回的数据等
   */
  data?: BookmarkNode[]

  /** 搜索结果数量限制 */
  limit?: number

  /** 是否显示统计信息 */
  showStats?: boolean

  /** 树的高度 */
  treeHeight?: string | number

  /** 树的尺寸 */
  treeSize?: 'compact' | 'comfortable' | 'spacious'

  /** 是否可选择 */
  selectable?: boolean | 'single' | 'multiple'

  /** 是否可编辑 */
  editable?: boolean

  /** 是否启用虚拟滚动 */
  virtual?: boolean

  /** 是否显示工具栏 */
  showToolbar?: boolean

  /** 传递给 BookmarkTree 的额外 props */
  treeProps?: Record<string, unknown>

  /** 搜索选项 */
  filterOptions?: {
    fuzzy?: boolean
    threshold?: number
    sortBy?: 'relevance' | 'title' | 'date'
    filterFolders?: boolean
  }
}

const props = withDefaults(defineProps<Props>(), {
  query: '',
  mode: 'indexeddb',
  data: () => [],
  limit: 100,
  showStats: true,
  treeHeight: '100%',
  treeSize: 'comfortable',
  selectable: false,
  editable: false,
  virtual: true,
  showToolbar: false,
  treeProps: () => ({}),
  filterOptions: () => ({})
})

// ==================== Emits ====================
const emit = defineEmits<{
  /** 搜索完成 */
  'filter-complete': [results: EnhancedSearchResult[]]
  /** 搜索错误 */
  'filter-error': [error: Error]
  /** 节点点击 */
  'node-click': [node: BookmarkNode, event: MouseEvent]
  /** 节点选择 */
  'node-select': [id: string, node: BookmarkNode, selected: boolean]
  /** 选择变更 */
  'selection-change': [ids: string[], nodes: BookmarkNode[]]
}>()

// ==================== State ====================
const isFiltering = ref(false)
const filterResults = ref<FilteredBookmarkNode[]>([])
const totalResults = ref(0)
const executionTime = ref(0)
const filterSource = ref<'indexeddb' | 'memory'>('indexeddb')

// BookmarkTree 必需的 props
const loadingChildren = shallowRef(new Set<string>())
const selectedDescCounts = shallowRef(new Map<string, number>())

// ==================== Computed ====================
/**
 * 搜索结果即为 BookmarkNode 格式
 * FilteredBookmarkNode 继承自 BookmarkNode，可以直接使用
 */
const bookmarkNodes = computed((): BookmarkNode[] => {
  return filterResults.value
})

// ==================== Methods ====================
/**
 * 执行搜索
 * 支持双模式：indexeddb / memory
 */
async function performFilter(query: string): Promise<void> {
  if (!query || !query.trim()) {
    filterResults.value = []
    totalResults.value = 0
    executionTime.value = 0
    return
  }

  // 验证：memory 模式下必须提供 data
  if (props.mode === 'memory' && (!props.data || props.data.length === 0)) {
    logger.warn('BookmarkSearch', '内存模式下未提供数据源，跳过搜索')
    filterResults.value = []
    totalResults.value = 0
    executionTime.value = 0
    return
  }

  isFiltering.value = true

  try {
    // 使用统一的查询服务
    const result = await bookmarkFilterService.filter(
      query.trim(),
      props.mode || 'indexeddb',
      props.data,
      {
        limit: props.limit,
        fuzzy: props.filterOptions?.fuzzy,
        threshold: props.filterOptions?.threshold,
        filterFolders: props.filterOptions?.filterFolders
      }
    )

    filterResults.value = result.nodes
    totalResults.value = result.total
    executionTime.value = result.executionTime
    filterSource.value = result.source

    // 转换为 EnhancedSearchResult 格式以保持向后兼容
    // FilteredBookmarkNode 已在服务层被填充了 BookmarkRecord 的所有必需字段
    const legacyResults: EnhancedSearchResult[] = result.nodes.map(node => ({
      bookmark: node as unknown as BookmarkRecord,
      score: node.filterScore || 0,
      pathString: node.pathString,
      matchedFields: node.matchedFields || [],
      highlights: {
        title: [],
        url: [],
        domain: []
      }
    }))

    emit('filter-complete', legacyResults)

    logger.info('BookmarkSearch', `搜索完成 (${result.source}): "${query}"`, {
      total: totalResults.value,
      executionTime: executionTime.value
    })
  } catch (error) {
    logger.error('BookmarkSearch', '搜索失败', error)
    filterResults.value = []
    totalResults.value = 0
    executionTime.value = 0
    emit('filter-error', error as Error)
  } finally {
    isFiltering.value = false
  }
}

/**
 * 处理节点点击
 */
function handleNodeClick(node: BookmarkNode, event: MouseEvent): void {
  emit('node-click', node, event)
}

/**
 * 处理节点选择
 */
function handleNodeSelect(
  id: string,
  node: BookmarkNode,
  selected: boolean
): void {
  emit('node-select', id, node, selected)
}

/**
 * 处理选择变更
 */
function handleSelectionChange(ids: string[], nodes: BookmarkNode[]): void {
  emit('selection-change', ids, nodes)
}

// ==================== Watchers ====================
// 监听 query 变化，自动搜索
watch(
  () => props.query,
  newQuery => {
    performFilter(newQuery)
  },
  { immediate: true }
)

// ==================== Expose ====================
/**
 * 暴露方法给父组件
 */
defineExpose({
  /** 手动触发搜索 */
  filter: performFilter,
  /** 获取当前搜索结果 */
  getResults: () => filterResults.value,
  /** 获取转换后的节点 */
  getNodes: () => bookmarkNodes.value,
  /** 是否正在搜索 */
  isFiltering: () => isFiltering.value
})
</script>

<script lang="ts">
// 为了支持递归类型，需要扩展 BookmarkNode 类型
declare module '@/types' {
  interface BookmarkNode {
    filterScore?: number
    pathString?: string
    matchedFields?: string[]
  }
}
</script>

<style scoped>
.bookmark-search {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.filter-results-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 加载状态 */
.filter-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  height: 100%;
  color: var(--color-text-secondary);
}

.loading-text {
  font-size: var(--font-size-sm);
  margin: 0;
}

/* 空状态 */
.filter-empty,
.filter-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  height: 100%;
  padding: var(--spacing-xl);
  color: var(--color-text-tertiary);
}

.empty-text {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

.empty-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin: 0;
}

/* 搜索结果 */
.filter-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filter-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.stats-text {
  font-weight: 500;
}

.stats-time {
  color: var(--color-text-tertiary);
}
</style>
