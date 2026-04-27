<!--
BookmarkSearchInput - 书签筛选输入组件

职责：
- 提供筛选输入框
- 调用核心书签筛选服务
- 返回标准书签树结构数据
- 不负责展示结果（由父组件决定）

数据流：
用户输入 → 筛选服务 → emit('search-complete', results)

注意：
- 数据源默认 IndexedDB，可外部传入
- 只负责筛选逻辑，不负责结果展示
- 保持单一职责原则
-->

<template>
  <div class="bookmark-search-input">
    <!-- 可展开搜索框 -->
    <div
      ref="searchWrapperRef"
      class="search-wrapper"
      :class="{ expanded: isExpanded, searching: isSearching }"
      @transitionend="handleSearchBoxTransitionEnd"
    >
      <!-- 输入框容器 -->
      <div class="input-container">
        <Input
          ref="inputRef"
          v-model="query"
          class="search-input"
          :placeholder="t('search_placeholder')"
          :disabled="disabled"
          borderless
          @keydown.esc="handleEscape"
        />
      </div>

      <!-- 搜索图标按钮 -->
      <button
        class="search-icon-button"
        :class="{ 'has-query': query.length > 0 }"
        :title="isSearching ? '搜索中...' : query.length > 0 ? '清空' : '搜索'"
        :aria-label="
          isSearching ? '搜索中' : query.length > 0 ? '清空搜索' : '展开搜索'
        "
        :aria-expanded="isExpanded"
        @click="handleIconClick"
      >
        <Spinner v-if="isSearching" size="sm" />
        <LucideIcon
          v-else-if="query.length > 0"
          name="x"
          :size="20"
        />
        <LucideIcon v-else name="search" :size="20" />
      </button>

      <!-- 搜索结果面板（包含筛选标签 + 搜索结果） -->
      <Transition name="panel-fade" @after-leave="handlePanelTransitionEnd">
        <div v-if="showPanel" class="search-result-panel">
          <!-- 快捷筛选标签（可选显示） -->
          <div
            v-if="showQuickTags && hasQuickFilters"
            class="filter-quick-tags"
          >
            <button
              v-for="quickFilter in allQuickFilters"
              :key="quickFilter.id"
              class="filter-tag"
              :class="{
                active: activeFilters.has(quickFilter.id),
                loading: isLoadingTraitCounts
              }"
              :title="quickFilter.label"
              :aria-label="`${quickFilter.label}${activeFilters.has(quickFilter.id) ? '（已选中）' : ''}`"
              :aria-pressed="activeFilters.has(quickFilter.id)"
              tabindex="0"
              @click="toggleFilter(quickFilter.id)"
              @keydown.enter.prevent="toggleFilter(quickFilter.id)"
              @keydown.space.prevent="toggleFilter(quickFilter.id)"
            >
              <LucideIcon
                v-if="quickFilter.icon"
                :name="quickFilter.icon"
                :size="14"
              />
              <span class="filter-label">{{ quickFilter.label }}</span>
              <!-- ✅ 加载状态：显示动画 -->
              <Spinner v-if="isLoadingTraitCounts" size="sm" />
              <!-- ✅ 加载完成：显示实际数量 -->
              <CountIndicator
                v-else-if="quickFilter.count !== undefined"
                :count="quickFilter.count"
                size="sm"
                class="filter-count"
              />
            </button>
          </div>

          <!-- 搜索结果统计（只在有搜索内容时显示，0 个结果也显示） -->
          <div
            v-if="
              showStats &&
              displayResultCount >= 0 &&
              (query.trim() || activeFilters.size > 0)
            "
            class="search-stats"
          >
            <span class="stats-text">找到 {{ displayResultCount }} 个结果</span>
            <span v-if="executionTime" class="stats-time">
              ({{ executionTime }}ms)
            </span>
          </div>
        </div>
      </Transition>

      <!-- 错误提示（绝对定位在搜索框下方） -->
      <Transition name="error-fade">
        <div v-if="error && isExpanded" class="search-error">
          <LucideIcon name="alert-circle" :size="16" />
          <span class="error-text">{{ error.message }}</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed, ref, nextTick, onMounted } from 'vue'
import { CountIndicator, LucideIcon, Input, Spinner } from '@/components'
import { useBookmarkSearch } from '@/composables/useBookmarkSearch'
import type { BookmarkNode } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { useTraitFilterStore } from '@/stores/trait-filter/trait-filter-store'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { TraitTag } from '@/infrastructure/indexeddb/types/bookmark-record'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'BookmarkSearchInput'
})

// 展开状态
const isExpanded = ref(false)
const inputRef = ref<InstanceType<typeof Input>>()
const searchWrapperRef = ref<HTMLElement | null>(null)

// 面板显示状态（独立控制，实现时序动画）
const showPanel = ref(false)
// 快捷标签显示状态
const showQuickTags = ref(false)

// 收起中标志（防止在收起过程中重复操作）
const isCollapsing = ref(false)

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
   * 是否启用内置的特征筛选标签
   * @default true
   */
  enableTraitFilters?: boolean

  /**
   * 是否与全局 cleanupStore 同步筛选状态
   * - true: 监听 cleanupStore.activeFilters 变化并同步
   * - false: 独立维护筛选状态，不受全局影响
   * @default false
   */
  syncWithStore?: boolean

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
  enableTraitFilters: true,
  syncWithStore: false,
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

// 获取 TraitFilterStore 实例以访问特征统计数据
const traitFilterStore = useTraitFilterStore()

/**
 * 特征统计数据（响应式）
 */
const traitCounts = ref({
  invalid: 0,
  duplicate: 0
})

/** 特征统计是否正在加载 */
const isLoadingTraitCounts = ref(false)

/**
 * 统计特征问题数量
 *
 * @description
 * ⚠️ 统一从 traitTags 字段读取，确保与筛选逻辑一致。
 * 这是唯一可靠的数据源，因为：
 * 1. traitTags 在书签同步时就会设置
 * 2. isDuplicate/isInvalid 字段可能因为数据迁移不完整而缺失
 * 3. 必须保证统计数量和筛选结果的数据来源一致
 *
 * 性能优化：只统计非文件夹的书签（url 存在的）
 */
async function updateTraitCounts(): Promise<void> {
  if (!props.enableTraitFilters) return

  isLoadingTraitCounts.value = true

  try {
    // ✅ 加载所有书签，从 traitTags 字段统计（与筛选逻辑一致）
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    // ✅ 统计重复书签：从 traitTags 读取，只统计有 URL 的书签
    const duplicateCount = allBookmarks.filter(
      b => b.url && b.traitTags && b.traitTags.includes('duplicate')
    ).length

    // ✅ 统计失效书签：从 traitTags 读取，只统计有 URL 的书签
    const invalidCount = allBookmarks.filter(
      b => b.url && b.traitTags && b.traitTags.includes('invalid')
    ).length

    traitCounts.value = {
      invalid: invalidCount,
      duplicate: duplicateCount
    }
  } catch (error) {
    console.error('[BookmarkSearchInput] 更新特征统计失败:', error)
    traitCounts.value = { invalid: 0, duplicate: 0 }
  } finally {
    isLoadingTraitCounts.value = false
  }
}

/**
 * 内置的特征筛选器配置
 */
const builtInTraitFilters = computed<QuickFilter[]>(() => {
  if (!props.enableTraitFilters) return []

  return [
    {
      id: 'invalid',
      label: '失效书签',
      icon: 'alert-circle',
      count: traitCounts.value.invalid,
      filter: (node: BookmarkNode) => {
        const isRootNode = !node.parentId || node.parentId === '0'
        if (isRootNode) return false
        // 失效书签（合并了404和URL格式错误）
        return node.traitTags?.includes('invalid') ?? false
      }
    },
    {
      id: 'duplicate',
      label: '重复书签',
      icon: 'copy',
      count: traitCounts.value.duplicate,
      filter: (node: BookmarkNode) =>
        node.traitTags?.includes('duplicate') ?? false
    }
  ]
})

/**
 * 合并的筛选器列表（内置 + 自定义）
 */
const allQuickFilters = computed<QuickFilter[]>(() => {
  return [...builtInTraitFilters.value, ...(props.quickFilters ?? [])]
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

  // ✅ 仅在启用特征标签筛选时，同步状态到 TraitFilterStore
  if (props.enableTraitFilters) {
    const activeTraitTags = Array.from(activeFilters.value).filter(id =>
      ['duplicate', 'invalid'].includes(id)
    ) as TraitTag[]

    if (activeTraitTags.length > 0) {
      traitFilterStore.setActiveFilters(activeTraitTags)
    } else {
      // 如果没有激活的特征标签，清除筛选状态
      traitFilterStore.clearFilters()
    }
  }

  // 重新触发筛选
  executeFilter()
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

// ✅ 本地筛选结果计数（用于健康度筛选场景）
const localFilteredCount = ref<number>(0)

/**
 * 实际显示的结果数量
 * - 有健康度筛选时：始终使用 localFilteredCount（递归统计最终结果树）
 * - 仅文本搜索时：使用 useBookmarkSearch 返回的 totalResults（IndexedDB 搜索的准确结果）
 *
 * 原因：健康度筛选会在文本搜索结果上进一步过滤，所以必须使用最终统计
 */
const displayResultCount = computed(() => {
  const hasTextQuery = query.value.trim().length > 0
  const hasActiveFilters = activeFilters.value.size > 0

  // 有健康度筛选：使用本地统计（无论是否有文本搜索）
  if (hasActiveFilters) {
    return localFilteredCount.value
  }

  // 仅文本搜索：使用 useBookmarkSearch 的结果
  if (hasTextQuery) {
    return totalResults.value
  }

  // 无搜索无筛选：返回 0
  return 0
})

/**
 * 递归统计筛选结果中的叶子节点数量
 *
 * 统计规则：只统计"叶子节点"（在最终结果树中最深层的匹配节点）
 * - 空文件夹：children 为空数组 [] 的节点（是叶子节点）
 * - 重复书签/失效链接：没有 children 属性的节点（是叶子节点）
 * - 父文件夹：有非空 children 的节点（不是叶子节点，不统计）
 *
 * @param nodes - 节点数组
 * @returns 叶子节点数量
 */
const countFilteredItems = (nodes: BookmarkNode[], depth = 0): number => {
  let count = 0

  for (const node of nodes) {
    const hasChildren = node.children && Array.isArray(node.children)

    if (hasChildren && node.children!.length > 0) {
      // 有非空子节点：这是父文件夹，递归统计子节点，但不统计自己
      const childCount = countFilteredItems(node.children!, depth + 1)
      count += childCount
    } else {
      // 叶子节点：无子节点的书签 OR 空文件夹（children 为 []）
      count++
    }
  }

  return count
}

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

  // 递归筛选节点树
  const filterNodes = (nodeList: BookmarkNode[]): BookmarkNode[] => {
    const result: BookmarkNode[] = []

    for (const node of nodeList) {
      // 检查当前节点是否匹配所有激活的筛选器
      const matchesAllFilters = activeFilterFns.every(fn => fn(node))

      // ✅ 修复：不依赖 type 字段，直接检查 children 是否存在
      if (
        node.children &&
        Array.isArray(node.children) &&
        node.children.length > 0
      ) {
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
        result.push(node)
      }
    }

    return result
  }

  return filterNodes(nodes)
}

/**
 * 执行筛选（组合文本搜索 + 快捷筛选器）
 */
const executeFilter = async () => {
  try {
    const hasTextQuery = query.value.trim().length > 0
    const hasActiveFilters = activeFilters.value.size > 0

    console.log('[BookmarkSearchInput] executeFilter 开始:', {
      hasTextQuery,
      hasActiveFilters,
      activeFilters: Array.from(activeFilters.value),
      dataLength: props.data?.length
    })

    // 如果既无文本又无筛选器，清空结果
    if (!hasTextQuery && !hasActiveFilters) {
      clear()
      localFilteredCount.value = 0 // ✅ 清空本地计数
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
    }

    // 步骤 2: 应用快捷筛选器
    if (hasActiveFilters) {
      results = applyQuickFilters(results)
    }

    // ✅ 统计最终结果中的项目数量（根据筛选类型智能判断统计书签还是文件夹）
    localFilteredCount.value = countFilteredItems(results)

    // 发送最终结果
    emit('search-complete', results)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    localFilteredCount.value = 0 // ✅ 出错时清空计数
    emit('search-error', error)
  }
}

// 防抖搜索
const debouncedSearch = useDebounceFn(executeFilter, props.debounce)

// 监听搜索关键词变化
watch(query, () => {
  debouncedSearch()
})

// ✅ showQuickTags 跟随 showPanel 同步变化
watch(showPanel, visible => {
  showQuickTags.value = visible
})

// ✅ 监听 traitFilterStore 的 activeFilters，同步到组件内部状态
// 用于支持从 URL 参数（popup 跳转）激活筛选
watch(
  () => traitFilterStore.activeFilters,
  storeFilters => {
    console.log('[BookmarkSearchInput] traitFilterStore.activeFilters 变化:', {
      storeFilters,
      enableTraitFilters: props.enableTraitFilters,
      syncWithStore: props.syncWithStore
    })

    // 只有启用特征筛选且开启 store 同步时才处理
    if (!props.enableTraitFilters || !props.syncWithStore) return

    // ✅ 确保 storeFilters 是数组，防止类型错误
    const filtersArray = Array.isArray(storeFilters) ? storeFilters : []

    // 将 store 的 activeFilters (TraitTag[]) 同步到组件的 activeFilters (Set<string>)
    const newFilters = new Set(filtersArray)

    // 只有当筛选器真正变化时才更新（避免循环更新）
    const currentFilters = new Set(activeFilters.value)
    const hasChanges =
      newFilters.size !== currentFilters.size ||
      Array.from(newFilters).some(f => !currentFilters.has(f))

    if (hasChanges) {
      activeFilters.value = newFilters

      // 如果有激活的筛选器，自动展开搜索框
      if (newFilters.size > 0 && !isExpanded.value) {
        isExpanded.value = true
      }

      // 触发筛选
      executeFilter()
    }
  },
  { deep: true, immediate: true }
)

/**
 * 处理搜索框展开/收起动画完成事件
 */
const handleSearchBoxTransitionEnd = (event: TransitionEvent) => {
  // 只处理 width 属性的过渡（搜索框展开/收起动画）
  if (event.propertyName !== 'width') return

  if (isExpanded.value && !showPanel.value) {
    // 展开完成 → 显示面板
    showPanel.value = true
  } else if (!isExpanded.value && !showPanel.value) {
    // 收起完成
    isCollapsing.value = false
  }
}

/**
 * 处理面板出场/离场动画完成事件
 */
const handlePanelTransitionEnd = () => {
  if (!showPanel.value && isCollapsing.value) {
    // 面板离场完成 → 收起搜索框
    isExpanded.value = false
  }
}

// 处理图标点击
const handleIconClick = async () => {
  if (query.value) {
    // 如果有内容，点击清空
    handleClear()
  } else if (isExpanded.value) {
    // 如果已展开且无内容，收起
    // 步骤1：先让面板离场
    if (!isCollapsing.value) {
      isCollapsing.value = true
      showPanel.value = false
      // 面板动画完成后，handlePanelTransitionEnd 会收起搜索框
    }
  } else {
    // 展开
    // 步骤1：先展开搜索框
    isExpanded.value = true
    await nextTick()
    inputRef.value?.$el?.querySelector('input')?.focus()
    // 搜索框展开完成后，handleSearchBoxTransitionEnd 会显示面板
  }
}

// 处理 ESC 键
const handleEscape = () => {
  if (query.value) {
    handleClear()
  } else if (isExpanded.value && !isCollapsing.value) {
    // 收起：先让面板离场
    isCollapsing.value = true
    showPanel.value = false
  }
}

// 清空搜索
const handleClear = () => {
  clear()
  activeFilters.value.clear() // ✅ 清空激活的筛选器
  localFilteredCount.value = 0 // ✅ 重置本地计数
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

// ==================== 生命周期 ====================

/**
 * 组件挂载时初始化特征统计
 */
onMounted(() => {
  if (props.enableTraitFilters) {
    // 初始加载特征统计
    updateTraitCounts()
  }
})

/**
 * 监听书签数据同步消息，自动刷新特征统计
 */
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'acuity-bookmarks-db-synced') {
      // 使用 queueMicrotask 避免阻塞消息处理
      queueMicrotask(() => {
        void updateTraitCounts()
      })
    }
  })
}

defineExpose({
  search,
  getResults,
  clear: clearSearch,
  isSearching,
  totalResults
})
</script>

<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list -- 搜索输入组件使用特定尺寸 */

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
  border: 1px solid var(--color-border);
  border-radius: 16px; /* 完全圆形 */
  outline: 3px solid transparent; /* 使用 outline 代替 box-shadow，避免位移 */
  outline-offset: 0;
  background: var(--color-surface);
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s ease,
    outline-color 0.2s ease;
  overflow: visible; /* 改为 visible，让绝对定位的子元素可见 */
}

/* 展开状态 */
.search-wrapper.expanded {
  width: 280px;
}

/* 搜索中状态 */
.search-wrapper.searching {
  border-color: var(--color-primary);
}

/* 悬停效果 */
.search-wrapper:hover {
  border-color: var(--color-primary-hover);
}

/* 聚焦状态 */
.search-wrapper:has(.search-input:focus) {
  border-color: var(--color-primary);
  outline-color: var(--color-primary-soft);
}

/* 输入框容器 */
.input-container {
  width: 0;
  height: 100%;
  padding-right: 32px; /* 为绝对定位的搜索按钮留出空间 */
  opacity: 0;
  transition:
    opacity 0.2s ease 0.1s,
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.search-wrapper.expanded .input-container {
  width: 100%;
  opacity: 1;
}

/* 输入框样式 */
.search-input {
  width: 100%;
  height: 100%;
}

.search-input :deep(.acuity-input-container.acuity-input-container--borderless) {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 0 var(--spacing-3); /* 覆盖 borderless 的 padding: 0 */
}

.search-input :deep(.acuity-input) {
  height: 30px; /* 明确设置高度 */
  font-size: var(--text-sm);
  line-height: 30px; /* 与容器高度一致，确保文本垂直居中 */
}

/* 搜索图标按钮 - 使用绝对定位固定在右侧 */
.search-icon-button {
  position: absolute;
  top: 0;
  right: -1px; /* 抵消容器边框 */
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  border: none;
  border-radius: 50%;
  outline: none;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.search-icon-button:hover {
  background: var(--color-bg-hover);
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
}

.search-icon-button:active {
  background: var(--color-bg-active);
  opacity: 0.8;
  box-shadow: 0 1px 2px rgb(0 0 0 / 10%);
}

/* 当有查询内容时，按钮更明显 */
.search-icon-button.has-query {
  background: var(--color-error-subtle);
}

.search-icon-button.has-query:hover {
  background: var(--color-error);
  box-shadow: 0 2px 6px rgb(239 68 68 / 30%);
}

.search-icon-button.has-query:hover :deep(.acuity-icon) {
  color: var(--color-text-on-primary);
}

/* 搜索结果面板（包含筛选标签 + 搜索结果） */
.search-result-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--color-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

/* 统计信息（在面板内） */
.search-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--border-radius-sm);
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-background);
}

.stats-time {
  color: var(--color-text-tertiary);
}

/* 错误提示（绝对定位在搜索框下方） */
.search-error {
  position: absolute;
  top: calc(100% + 8px); /* 在搜索框下方 8px */
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  max-width: 280px;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-error);
  border-radius: var(--border-radius-md);
  font-size: var(--text-xs);
  background: var(--color-error-subtle);
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
}

.error-text {
  flex: 1;
  color: var(--color-error-emphasis);
}

/* 快捷筛选标签容器（在面板内） */
.filter-quick-tags {
  display: grid;
  gap: var(--spacing-2);
  grid-template-columns: 1fr 1fr;
}

/* 单个筛选标签按钮 */
.filter-tag {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-1);
  width: 100%;
  min-height: 32px;
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  cursor: pointer;

  /* ✅ 增强过渡效果，添加 transform 和 font-weight */
  transition:
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-tag:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
  background: var(--color-bg-hover);
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.filter-tag.active {
  border-color: var(--color-primary);
  font-weight: 500;
  color: var(--color-text-on-primary);
  background: var(--color-primary);
  box-shadow: 0 2px 4px rgb(59 130 246 / 30%);
}

.filter-tag.active:hover {
  border-color: var(--color-primary-hover);
  background: var(--color-primary-hover);
}

.filter-tag .filter-label {
  flex: 1;
  font-weight: 500;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 激活状态下覆盖 CountIndicator 样式 */
.filter-tag.active .filter-count {
  color: var(--color-text-on-primary);
  background: rgb(255 255 255 / 25%);
}

/* 过渡动画 */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

/* 入场：从上方向下渐入 */
.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

/* 离场：向上渐出 */
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 错误提示动画 */
.error-fade-enter-active,
.error-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
