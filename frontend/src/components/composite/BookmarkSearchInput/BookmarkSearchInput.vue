<!--
BookmarkSearchInput - 书签搜索输入组件

职责：
- 提供搜索输入框
- 调用核心书签检索服务
- 返回标准书签树结构数据
- 不负责展示结果（由父组件决定）

数据流：
用户输入 → 搜索服务 → emit('search-complete', results)

注意：
- 数据源默认 IndexedDB，可外部传入
- 只负责搜索逻辑，不负责结果展示
- 保持单一职责原则
-->

<template>
  <div class="bookmark-search-input">
    <!-- 可展开搜索框 -->
    <div
      class="search-wrapper"
      :class="{ expanded: isExpanded, searching: isSearching }"
    >
      <!-- 输入框容器 -->
      <div class="input-container">
        <Input
          ref="inputRef"
          v-model="query"
          class="search-input"
          placeholder="筛选书签..."
          :disabled="disabled"
          borderless
          @blur="handleBlur"
          @keydown.esc="handleEscape"
        />
      </div>

      <!-- 搜索图标按钮 -->
      <button
        class="search-icon-button"
        :class="{ 'has-query': query.length > 0 }"
        :title="isSearching ? '搜索中...' : query.length > 0 ? '清空' : '搜索'"
        @mousedown="isClickingButton = true"
        @click="handleIconClick"
      >
        <Spinner v-if="isSearching" size="sm" />
        <Icon
          v-else-if="query.length > 0"
          name="icon-cancel"
          :size="20"
          color="text-secondary"
        />
        <Icon v-else name="icon-search" :size="20" color="text-secondary" />
      </button>

      <!-- 快捷筛选标签（延迟显示，等展开动画完成） -->
      <Transition name="tags-fade">
        <div
          v-if="showQuickTags && hasQuickFilters"
          class="filter-quick-tags"
          @mousedown="isClickingTag = true"
          @mouseup="isClickingTag = false"
          @mouseleave="isClickingTag = false"
        >
          <button
            v-for="quickFilter in allQuickFilters"
            :key="quickFilter.id"
            class="filter-tag"
            :class="{ active: activeFilters.has(quickFilter.id) }"
            :title="quickFilter.label"
            @click="toggleFilter(quickFilter.id)"
          >
            <Icon v-if="quickFilter.icon" :name="quickFilter.icon" :size="14" />
            <span class="filter-label">{{ quickFilter.label }}</span>
            <span v-if="quickFilter.count !== undefined" class="filter-count">
              {{ quickFilter.count }}
            </span>
          </button>
        </div>
      </Transition>

      <!-- 搜索状态提示（绝对定位在搜索框下方） -->
      <Transition name="stats-fade">
        <div
          v-if="showStats && totalResults > 0 && isExpanded"
          class="search-stats"
        >
          <span class="stats-text">找到 {{ totalResults }} 个结果</span>
          <span v-if="executionTime" class="stats-time">
            ({{ executionTime }}ms)
          </span>
        </div>
      </Transition>

      <!-- 错误提示（绝对定位在搜索框下方） -->
      <Transition name="error-fade">
        <div v-if="error && isExpanded" class="search-error">
          <Icon name="icon-error" :size="16" color="error" />
          <span class="error-text">{{ error.message }}</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed, ref, nextTick, onUnmounted } from 'vue'
import { Icon, Input, Spinner } from '@/components'
import { useBookmarkSearch } from '@/composables/useBookmarkSearch'
import type { BookmarkNode } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { useCleanupStore } from '@/stores/cleanup/cleanup-store'
import type { CleanupProblem } from '@/types/domain/cleanup'

defineOptions({
  name: 'BookmarkSearchInput'
})

// 展开状态
const isExpanded = ref(false)
const inputRef = ref<InstanceType<typeof Input>>()

// 快捷标签显示状态（延迟显示，避免展开动画时变形）
const showQuickTags = ref(false)
let tagsDelayTimer: ReturnType<typeof setTimeout> | null = null

// 防止点击按钮或标签时触发失焦收起的标记
const isClickingButton = ref(false)
const isClickingTag = ref(false)
let blurTimeoutId: ReturnType<typeof setTimeout> | null = null

/**
 * 快捷筛选器配置
 */
export interface QuickFilter {
  /** 筛选器唯一标识 */
  id: string
  /** 显示标签 */
  label: string
  /** 图标名称（可选） */
  icon?: string
  /** 结果数量（可选） */
  count?: number
  /** 自定义筛选逻辑 */
  filter: (node: BookmarkNode) => boolean
}

interface Props {
  /**
   * 搜索模式
   * - indexeddb: 从 IndexedDB 搜索（默认）
   * - memory: 从内存数据搜索
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 内存数据源（mode='memory' 时使用）
   */
  data?: BookmarkNode[]

  /**
   * 自定义快捷筛选器配置（用于扩展额外的筛选功能）
   */
  quickFilters?: QuickFilter[]

  /**
   * 是否启用内置的健康度筛选标签
   * @default true
   */
  enableHealthFilters?: boolean

  /**
   * 是否显示快捷筛选标签
   * @default true
   */
  showQuickFilters?: boolean

  /**
   * 搜索结果数量限制
   * @default 100
   */
  limit?: number

  /**
   * 防抖延迟（毫秒）
   * @default 300
   */
  debounce?: number

  /**
   * 是否禁用
   */
  disabled?: boolean

  /**
   * 是否显示统计信息
   */
  showStats?: boolean

  /**
   * 初始搜索关键词
   */
  initialQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'indexeddb',
  limit: 100,
  debounce: 300,
  disabled: false,
  showStats: true,
  enableHealthFilters: true,
  showQuickFilters: true,
  initialQuery: '',
  quickFilters: () => []
})

interface Emits {
  /**
   * 搜索完成事件
   * @param results - 搜索结果（标准书签树结构）
   */
  'search-complete': [results: BookmarkNode[]]

  /**
   * 搜索开始事件
   * @param query - 搜索关键词
   */
  'search-start': [query: string]

  /**
   * 搜索错误事件
   * @param error - 错误对象
   */
  'search-error': [error: Error]

  /**
   * 搜索清空事件
   */
  'search-clear': []
}

const emit = defineEmits<Emits>()

// ========== 快捷筛选器状态管理 ==========

/** 当前激活的筛选器 ID 集合 */
const activeFilters = ref<Set<string>>(new Set())

// 获取 CleanupStore 实例以访问健康度统计数据
const cleanupStore = useCleanupStore()

/**
 * 内置的健康度筛选器配置
 */
const builtInHealthFilters = computed<QuickFilter[]>(() => {
  if (!props.enableHealthFilters) return []

  // 从 CleanupStore 的 filterResults 统计各类健康问题的数量
  const countHealthIssues = (healthTag: string): number => {
    const filterResults = cleanupStore.cleanupState?.filterResults
    if (!filterResults) return 0

    let count = 0
    filterResults.forEach((problems: CleanupProblem[]) => {
      if (problems.some((p: CleanupProblem) => p.type === healthTag)) {
        count++
      }
    })

    return count
  }

  return [
    {
      id: '404',
      label: '失效链接',
      icon: 'icon-error',
      count: countHealthIssues('404'),
      filter: (node: BookmarkNode) => node.healthTags?.includes('404') ?? false
    },
    {
      id: 'duplicate',
      label: '重复书签',
      icon: 'icon-copy',
      count: countHealthIssues('duplicate'),
      filter: (node: BookmarkNode) =>
        node.healthTags?.includes('duplicate') ?? false
    },
    {
      id: 'empty',
      label: '空文件夹',
      icon: 'icon-folder',
      count: countHealthIssues('empty'),
      filter: (node: BookmarkNode) =>
        node.healthTags?.includes('empty') ?? false
    },
    {
      id: 'invalid',
      label: '无效数据',
      icon: 'icon-warning',
      count: countHealthIssues('invalid'),
      filter: (node: BookmarkNode) =>
        node.healthTags?.includes('invalid') ?? false
    }
  ]
})

/**
 * 合并的筛选器列表（内置 + 自定义）
 */
const allQuickFilters = computed<QuickFilter[]>(() => {
  return [...builtInHealthFilters.value, ...(props.quickFilters ?? [])]
})

/** 是否有可用的快捷筛选器 */
const hasQuickFilters = computed(() => {
  return props.showQuickFilters && allQuickFilters.value.length > 0
})

/**
 * 切换筛选器的激活状态
 * @param filterId - 筛选器 ID
 */
const toggleFilter = async (filterId: string) => {
  if (activeFilters.value.has(filterId)) {
    activeFilters.value.delete(filterId)
  } else {
    activeFilters.value.add(filterId)
  }

  // 重新触发筛选
  executeFilter()

  // 点击标签后重新聚焦输入框，避免失焦收起
  await nextTick()
  inputRef.value?.$el?.querySelector('input')?.focus()

  // 短暂延迟后重置点击标记
  setTimeout(() => {
    isClickingTag.value = false
  }, 100)
}

// 使用书签搜索 Composable
const {
  query,
  bookmarkNodes,
  isFiltering: isSearching,
  error,
  totalResults,
  executionTime,
  filter,
  clear
} = useBookmarkSearch({
  mode: props.mode,
  data: computed(() => props.data ?? []),
  limit: props.limit,
  initialQuery: props.initialQuery,
  autoFilter: false // 手动控制搜索时机
})

/**
 * 应用快捷筛选器到结果集
 * @param nodes - 原始节点数组
 * @returns 筛选后的节点数组
 */
const applyQuickFilters = (nodes: BookmarkNode[]): BookmarkNode[] => {
  if (activeFilters.value.size === 0) {
    return nodes
  }

  const activeFilterFns = Array.from(activeFilters.value)
    .map(id => allQuickFilters.value.find(f => f.id === id)?.filter)
    .filter((fn): fn is (node: BookmarkNode) => boolean => fn !== undefined)

  if (activeFilterFns.length === 0) {
    return nodes
  }

  // 🔍 调试日志
  console.log('🔍 [applyQuickFilters] 开始筛选', {
    activeFilters: Array.from(activeFilters.value),
    nodesCount: nodes.length,
    firstNode: nodes[0],
    hasHealthTags: nodes.some(n => n.healthTags && n.healthTags.length > 0)
  })

  // 递归筛选节点树
  const filterNodes = (nodeList: BookmarkNode[]): BookmarkNode[] => {
    const result: BookmarkNode[] = []

    for (const node of nodeList) {
      // 检查当前节点是否匹配所有激活的筛选器
      const matchesAllFilters = activeFilterFns.every(fn => fn(node))

      if (node.type === 'folder' && node.children) {
        // 递归筛选子节点
        const filteredChildren = filterNodes(node.children)

        // 如果有符合条件的子节点，或者文件夹本身符合条件，则保留该文件夹
        if (filteredChildren.length > 0 || matchesAllFilters) {
          result.push({
            ...node,
            children: filteredChildren
          })
        }
      } else if (matchesAllFilters) {
        // 书签节点符合条件
        console.log('✅ 匹配的书签节点', {
          id: node.id,
          title: node.title,
          healthTags: node.healthTags
        })
        result.push(node)
      }
    }

    return result
  }

  const filteredResults = filterNodes(nodes)
  console.log('🔍 [applyQuickFilters] 筛选完成', {
    filteredCount: filteredResults.length
  })

  return filteredResults
}

/**
 * 执行筛选（组合文本搜索 + 快捷筛选器）
 */
const executeFilter = async () => {
  try {
    const hasTextQuery = query.value.trim().length > 0
    const hasActiveFilters = activeFilters.value.size > 0

    console.log('🔍 [executeFilter] 开始筛选', {
      hasTextQuery,
      hasActiveFilters,
      propsDataLength: props.data?.length,
      propsMode: props.mode
    })

    // 如果既无文本又无筛选器，清空结果
    if (!hasTextQuery && !hasActiveFilters) {
      clear()
      emit('search-complete', [])
      emit('search-clear')
      return
    }

    // 步骤 1: 如果有文本搜索，先执行文本筛选
    let results: BookmarkNode[] = []
    if (hasTextQuery) {
      emit('search-start', query.value)
      await filter(query.value)
      results = bookmarkNodes.value
    } else {
      // 如果没有文本搜索，使用完整的数据源
      results = props.data ?? []
      console.log('🔍 [executeFilter] 使用完整数据源', {
        resultsLength: results.length,
        firstItem: results[0]
      })
    }

    // 步骤 2: 应用快捷筛选器
    if (hasActiveFilters) {
      results = applyQuickFilters(results)
    }

    // 发送最终结果
    console.log('🔍 [executeFilter] 筛选完成', { finalCount: results.length })
    emit('search-complete', results)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    emit('search-error', error)
  }
}

// 防抖搜索
const debouncedSearch = useDebounceFn(executeFilter, props.debounce)

// 监听搜索关键词变化
watch(query, () => {
  debouncedSearch()
})

// 处理图标点击
const handleIconClick = async () => {
  // 标记正在点击按钮，防止失焦事件触发收起
  isClickingButton.value = true

  // 取消任何待执行的失焦收起
  if (blurTimeoutId) {
    clearTimeout(blurTimeoutId)
    blurTimeoutId = null
  }

  if (query.value) {
    // 如果有内容，点击清空
    handleClear()
  } else if (isExpanded.value) {
    // 如果已展开且无内容，收起
    // 先隐藏标签（让其淡出动画播放）
    showQuickTags.value = false
    if (tagsDelayTimer) {
      clearTimeout(tagsDelayTimer)
      tagsDelayTimer = null
    }

    // 等待标签淡出动画完成后再收起输入框
    setTimeout(() => {
      isExpanded.value = false
    }, 200) // 标签淡出动画时间
  } else {
    // 展开并聚焦
    isExpanded.value = true
    await nextTick()
    inputRef.value?.$el?.querySelector('input')?.focus()

    // 延迟显示快捷标签（等待展开动画完成）
    if (tagsDelayTimer) {
      clearTimeout(tagsDelayTimer)
    }
    tagsDelayTimer = setTimeout(() => {
      showQuickTags.value = true
      tagsDelayTimer = null
    }, 300) // 与展开动画时间一致
  }

  // 短暂延迟后重置标记
  setTimeout(() => {
    isClickingButton.value = false
  }, 100)
}

// 处理失焦
const handleBlur = () => {
  // 如果正在点击按钮或标签，不要收起
  if (isClickingButton.value || isClickingTag.value) {
    return
  }

  // 如果没有内容，延迟收起
  if (!query.value) {
    // 清除之前的定时器
    if (blurTimeoutId) {
      clearTimeout(blurTimeoutId)
    }

    blurTimeoutId = setTimeout(() => {
      // 再次检查，确保不是在点击按钮或标签
      if (!query.value && !isClickingButton.value && !isClickingTag.value) {
        // 先隐藏标签（让其淡出动画播放）
        showQuickTags.value = false
        if (tagsDelayTimer) {
          clearTimeout(tagsDelayTimer)
          tagsDelayTimer = null
        }

        // 等待标签淡出动画完成后再收起输入框
        setTimeout(() => {
          isExpanded.value = false
        }, 200) // 标签淡出动画时间
      }
      blurTimeoutId = null
    }, 200)
  }
}

// 处理 ESC 键
const handleEscape = () => {
  if (query.value) {
    handleClear()
  } else {
    // 先隐藏标签（让其淡出动画播放）
    showQuickTags.value = false
    if (tagsDelayTimer) {
      clearTimeout(tagsDelayTimer)
      tagsDelayTimer = null
    }

    // 等待标签淡出动画完成后再收起输入框
    setTimeout(() => {
      isExpanded.value = false
    }, 200) // 标签淡出动画时间
  }
}

// 清空搜索
const handleClear = () => {
  clear()
  activeFilters.value.clear() // ✅ 清空激活的筛选器
  // ✅ 统一通过 search-complete 事件通知父组件（传递空数组）
  emit('search-complete', [])
  // 🔔 同时保留 search-clear 事件，用于特殊场景（如关闭搜索框）
  emit('search-clear')
}

/**
 * 手动触发搜索
 * @param searchQuery - 搜索关键词
 */
const search = async (searchQuery: string) => {
  query.value = searchQuery
  await filter(searchQuery)
  emit('search-complete', bookmarkNodes.value)
}

/**
 * 获取当前搜索结果
 */
const getResults = () => bookmarkNodes.value

/**
 * 清空搜索
 */
const clearSearch = () => {
  clear()
  activeFilters.value.clear() // ✅ 清空激活的筛选器
  // ✅ 统一通过 search-complete 事件通知父组件（传递空数组）
  emit('search-complete', [])
  // 🔔 同时保留 search-clear 事件，用于特殊场景（如关闭搜索框）
  emit('search-clear')
}

defineExpose({
  search,
  getResults,
  clear: clearSearch,
  isSearching,
  totalResults
})

// 清理定时器
onUnmounted(() => {
  if (blurTimeoutId) {
    clearTimeout(blurTimeoutId)
    blurTimeoutId = null
  }
  if (tagsDelayTimer) {
    clearTimeout(tagsDelayTimer)
    tagsDelayTimer = null
  }
})
</script>

<style scoped>
.bookmark-search-input {
  position: relative;
  display: flex;
  align-items: flex-end;
}

/* 搜索框包裹器 */
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 32px; /* 初始圆形宽度 */
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px; /* 完全圆形 */
  overflow: visible; /* 改为 visible，让绝对定位的子元素可见 */
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* 展开状态 */
.search-wrapper.expanded {
  width: 280px; /* 展开后的宽度 */
  border-radius: 20px; /* 保持圆角 */
}

/* 搜索中状态 */
.search-wrapper.searching {
  border-color: var(--color-primary);
}

/* 聚焦状态 */
.search-wrapper:has(.search-input:focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

/* 悬停效果 */
.search-wrapper:hover {
  border-color: var(--color-primary-hover);
}

/* 输入框容器 */
.input-container {
  flex: 1;
  opacity: 0;
  width: 0;
  overflow: hidden; /* 保持 hidden，防止输入内容溢出 */
  transition:
    opacity 0.2s ease 0.1s,
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-wrapper.expanded .input-container {
  opacity: 1;
  width: 100%;
}

/* 输入框样式 */
.search-input {
  width: 100%;
}

.search-input :deep(.acuity-input-container) {
  padding: 0 var(--spacing-3);
  min-height: 30px;
}

.search-input :deep(.acuity-input) {
  font-size: var(--text-sm);
}

/* 搜索图标按钮 */
.search-icon-button {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease,
    box-shadow 0.2s ease;
  outline: none;
}

.search-icon-button:hover {
  background: var(--color-bg-hover);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-icon-button:active {
  background: var(--color-bg-active);
  opacity: 0.8;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 当有查询内容时，按钮更明显 */
.search-icon-button.has-query {
  background: var(--color-error-subtle);
}

.search-icon-button.has-query:hover {
  background: var(--color-error);
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
}

.search-icon-button.has-query:hover :deep(.acuity-icon) {
  color: var(--color-text-on-primary);
}

/* 统计信息（绝对定位） */
.search-stats {
  position: absolute;
  top: calc(100% + 4px); /* 在搜索框下方 4px */
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.stats-time {
  color: var(--color-text-tertiary);
}

/* 错误提示（绝对定位） */
.search-error {
  position: absolute;
  top: calc(100% + 4px); /* 在搜索框下方 4px */
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-error-subtle);
  border: 1px solid var(--color-error);
  border-radius: var(--border-radius-md);
  font-size: var(--text-xs);
  max-width: 280px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.error-text {
  color: var(--color-error-emphasis);
  flex: 1;
}

/* 快捷筛选标签容器 */
.filter-quick-tags {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

/* 单个筛选标签按钮 */
.filter-tag {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 32px;
  width: 100%;
  white-space: nowrap;
}

.filter-tag:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  color: var(--color-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filter-tag.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-on-primary);
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.filter-tag.active:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.filter-tag .filter-label {
  flex: 1;
  text-align: left;
  line-height: 1.2;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-tag .filter-count {
  padding: 1px var(--spacing-1);
  background: rgba(0, 0, 0, 0.08);
  border-radius: var(--border-radius-sm);
  font-size: var(--text-2xs);
  font-weight: 600;
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.filter-tag.active .filter-count {
  background: rgba(255, 255, 255, 0.25);
  color: var(--color-text-on-primary);
}

/* 过渡动画 */
.stats-fade-enter-active,
.stats-fade-leave-active,
.error-fade-enter-active,
.error-fade-leave-active,
.tags-fade-enter-active,
.tags-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.stats-fade-enter-from,
.stats-fade-leave-to,
.error-fade-enter-from,
.error-fade-leave-to,
.tags-fade-enter-from,
.tags-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
