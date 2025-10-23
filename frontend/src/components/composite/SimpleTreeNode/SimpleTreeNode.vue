<!--
  📄 性能优化版书签树节点组件
  
  优化策略：
  1. 使用 shallowRef 减少深度响应式开销
  2. 使用 computed 缓存复杂计算
  3. 使用 v-memo 优化条件渲染
  4. 优化事件处理函数
  5. 减少不必要的响应式数据
-->

<template>
  <div
    ref="rootRef"
    class="simple-tree-node"
    :class="nodeClasses"
    :style="nodeStyle"
    :data-node-id="String(node.id)"
  >
    <!-- 文件夹节点 -->
    <div
      v-if="isFolder"
      class="node-content folder-content"
      :style="itemStyle"
      @click="handleFolderToggleClick"
      @mouseenter="onHover"
      @mouseleave="onHoverLeave"
    >
      <!-- 展开/收起图标（仅在目录包含书签时显示） -->
      <div v-if="shouldShowExpand" class="expand-icon">
        <Icon
          :name="isExpanded ? 'icon-chevron-down' : 'icon-chevron-right'"
          :size="16"
        />
      </div>

      <!-- 选择复选框（当允许选择时） -->
      <Checkbox
        v-if="
          config.showSelectionCheckbox &&
          config.selectable === 'multiple' &&
          !isRootFolder
        "
        class="select-checkbox"
        :model-value="isSelected"
        :indeterminate="isIndeterminate"
        size="md"
        :title="isSelected ? '取消选择' : '选择'"
        @update:model-value="toggleSelection"
      />

      <!-- 文件夹图标 -->
      <div class="folder-icon">
        <Icon
          :name="
            isEmptyFolder
              ? isExpanded
                ? 'icon-folder-open-outline'
                : 'icon-folder-outline'
              : isExpanded
                ? 'icon-folder-open'
                : 'icon-folder'
          "
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

      <!-- 文件夹操作项 (hover显示) -->
      <div
        v-show="config.editable"
        class="node-actions folder-actions"
        :class="{ 'actions-visible': isHovered }"
      >
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          :title="'添加到 ' + node.title"
          @click.stop="handleAddItem"
        >
          <Icon name="icon-plus" :size="14" />
        </Button>
        <!-- 顶级文件夹不允许编辑/删除 -->
        <Button
          v-if="!isRootFolder"
          variant="ghost"
          size="sm"
          density="compact"
          title="编辑文件夹"
          @click.stop="handleEdit"
        >
          <Icon name="icon-pencil" :size="14" />
        </Button>
        <Button
          v-if="!isRootFolder"
          variant="ghost"
          size="sm"
          density="compact"
          color="error"
          title="删除文件夹"
          @click.stop="handleDelete"
        >
          <Icon name="icon-delete" :size="14" />
        </Button>
      </div>
    </div>

    <!-- 书签节点 -->
    <div
      v-else
      class="node-content bookmark-content"
      :style="itemStyle"
      @click="handleBookmarkClick"
      @mouseenter="onHover"
      @mouseleave="onHoverLeave"
    >
      <!-- 书签选择复选框（仅书签节点显示，且为多选模式时） -->
      <Checkbox
        v-if="config.showSelectionCheckbox && config.selectable === 'multiple'"
        class="select-checkbox"
        :model-value="isSelected"
        :indeterminate="false"
        size="md"
        :title="isSelected ? '取消选择' : '选择书签'"
        @update:model-value="toggleSelection"
      />
      <!-- 书签图标/Favicon（带懒加载） -->
      <div class="bookmark-icon">
        <!-- 加载成功时显示favicon图片 -->
        <img
          v-if="safeFaviconUrl"
          :src="safeFaviconUrl"
          :alt="node.title"
          :style="{ width: '16px', height: '16px' }"
          loading="lazy"
          decoding="async"
          @load="handleFaviconLoad"
          @error="handleFaviconError"
        />
        <!-- 加载失败或无URL时显示备用图标 -->
        <Icon v-else name="icon-web" :size="16" color="secondary" />
      </div>

      <!-- 书签标题 -->
      <div class="node-title" :title="bookmarkTooltip">
        <span v-html="highlightedTitle"></span>
      </div>

      <!-- AI标签 -->
      <div
        v-if="Array.isArray(node.tags) && node.tags.length > 0"
        class="bookmark-tags"
      >
        <Chip v-for="tag in node.tags" :key="tag" size="sm" variant="outlined">
          {{ tag }}
        </Chip>
      </div>

      <!-- 书签URL (spacious模式显示) -->
      <div v-if="config.size === 'spacious' && node.url" class="bookmark-url">
        {{ truncatedUrl }}
      </div>

      <!-- 书签操作项 (hover显示) -->
      <div
        v-show="config.editable"
        class="node-actions bookmark-actions"
        :class="{ 'actions-visible': isHovered }"
      >
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          title="在新标签页打开"
          @click.stop="handleOpenInNewTab"
        >
          <Icon name="icon-open-in-new" :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          title="复制链接"
          @click.stop="handleCopyUrl"
        >
          <Icon name="icon-content-copy" :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          title="编辑书签"
          @click.stop="handleEdit"
        >
          <Icon name="icon-pencil" :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          color="error"
          title="删除书签"
          @click.stop="handleDelete"
        >
          <Icon name="icon-delete" :size="14" />
        </Button>
      </div>
    </div>

    <!-- 子节点：仅允许可展开目录显示子节点（去重渲染以防重影） -->
    <div
      v-if="
        isFolder &&
        shouldShowExpand &&
        isExpanded &&
        node.children &&
        !isVirtualMode
      "
      class="children"
    >
      <SimpleTreeNode
        v-for="child in renderChildren"
        :key="child.id"
        v-memo="[
          child.id,
          child.title,
          child.url,
          isChildExpanded(child.id),
          isChildSelected(child.id)
        ]"
        :node="child"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        :selected-nodes="selectedNodes"
        :loading-children="loadingChildren"
        :search-query="searchQuery"
        :config="config"
        :active-id="activeId"
        :hovered-id="hoveredId"
        :loading-more-folders="loadingMoreFolders"
        @node-click="handleChildNodeClick"
        @folder-toggle="handleChildFolderToggle"
        @node-select="handleChildNodeSelect"
        @node-edit="handleChildNodeEdit"
        @node-delete="handleChildNodeDelete"
        @folder-add="handleChildFolderAdd"
        @bookmark-open-new-tab="handleChildBookmarkOpenNewTab"
        @bookmark-copy-url="handleChildBookmarkCopyUrl"
        @node-hover="handleChildNodeHover"
        @node-hover-leave="handleChildNodeHoverLeave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, shallowRef } from 'vue'
import { Button, Checkbox, Chip, Icon } from '@/components'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import { useLazyFavicon } from '@/composables/useLazyFavicon'

const ALLOWED_FAVICON_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:'])

function sanitizeFaviconUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined
  try {
    const parsed = new URL(rawUrl, window.location.origin)
    if (!ALLOWED_FAVICON_PROTOCOLS.has(parsed.protocol)) {
      return undefined
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

// ✅ 设置组件名称，方便调试与日志定位
/**
 * SimpleTreeNode - 树节点渲染单元
 * - 负责单个节点的交互与展示
 */
defineOptions({ name: 'SimpleTreeNode' })

// const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'blob:', 'data:'])

// function sanitizeIconUrl(rawUrl: string | undefined): string | undefined {
//   if (!rawUrl) return undefined
//   try {
//     const parsed = new URL(rawUrl, window.location.origin)
//     if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
//       return undefined
//     }
//     return parsed.toString()
//   } catch {
//     return undefined
//   }
// }

// === Props 定义 ===
/**
 * 🌿 节点组件支持的属性集合
 * - 结合父级树控件传入的状态
 * - 所有属性均补充中文说明，便于协作
 */
interface Props {
  node: BookmarkNode
  level?: number
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  loadingChildren: Set<string>
  searchQuery?: string
  /** 是否对标题进行关键字高亮 */
  highlightMatches?: boolean
  config: {
    size?: 'compact' | 'comfortable' | 'spacious'
    searchable?: boolean
    selectable?: boolean | 'single' | 'multiple'
    editable?: boolean
    showSelectionCheckbox?: boolean
  }
  isVirtualMode?: boolean
  /** 严格顺序渲染：不对 children 去重/重排 */
  strictOrder?: boolean
  /** 当前激活高亮的节点ID */
  activeId?: string
  /** 程序化 hover 的节点ID（用于跨面板联动时模拟 hover 效果） */
  hoveredId?: string
  /** 正在自动加载更多子节点的文件夹ID集合 */
  loadingMoreFolders?: Set<string>
  /** 已选后代计数 Map（folderId -> 已选书签数）*/
  selectedDescCounts?: Map<string, number>
}
const props = withDefaults(defineProps<Props>(), {
  level: 0,
  searchQuery: '',
  highlightMatches: true,
  isVirtualMode: false,
  strictOrder: false,
  loadingChildren: () => new Set(),
  loadingMoreFolders: () => new Set()
})

// === Emits 定义 ===
/**
 * 组件对外抛出的事件列表
 * - 与父组件联动，完成节点操作
 */
const emit = defineEmits<{
  'node-click': [node: BookmarkNode, event: MouseEvent]
  'folder-toggle': [folderId: string, node: BookmarkNode]
  'node-select': [nodeId: string, node: BookmarkNode]
  'node-edit': [node: BookmarkNode]
  'node-delete': [node: BookmarkNode]
  'folder-add': [parentNode: BookmarkNode]
  'bookmark-open-new-tab': [node: BookmarkNode]
  'bookmark-copy-url': [node: BookmarkNode]
  'node-hover': [node: BookmarkNode]
  'node-hover-leave': [node: BookmarkNode]
  // 🆕 节点挂载/卸载事件，用于构建元素注册表以提升滚动性能
  'node-mounted': [id: string, el: HTMLElement]
  'node-unmounted': [id: string]
}>()

// 根元素引用与生命周期上报，用于构建元素注册表以优化滚动定位
const rootRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (rootRef.value) {
    emit('node-mounted', String(props.node.id), rootRef.value)
  }
})

onUnmounted(() => {
  emit('node-unmounted', String(props.node.id))
})

// === 响应式状态 ===
// 🚀 性能优化：使用 shallowRef 减少深度响应式开销
const isHovered = shallowRef(false)

// === 计算属性 ===
// 🚀 性能优化：缓存基础计算属性
const isFolder = computed(() => !props.node.url)
// ✅ 确定文件夹是否为空，辅助 UI 渲染
const isEmptyFolder = computed(() => {
  if (!isFolder.value) return false

  // 如果有 childrenCount 且为 0，则是空文件夹
  if (props.node.childrenCount === 0) return true

  // 如果没有 childrenCount 但 children 已加载且为空，则是空文件夹
  if (
    props.node._childrenLoaded &&
    (!props.node.children || props.node.children.length === 0)
  ) {
    return true
  }

  return false
})

// 🚀 性能优化：缓存展开状态检查
const isExpanded = computed(() => props.expandedFolders.has(props.node.id))
const isSelected = computed(() =>
  props.selectedNodes.has(String(props.node.id))
)

// 文件夹节点总是显示展开箭头（即使为空文件夹）
const shouldShowExpand = computed(() => {
  return isFolder.value
})

// 根目录（level === 0）不允许编辑/删除
const isRootFolder = computed(() => isFolder.value && props.level === 0)

// ✅ 显示书签数量提示
const showCount = computed(() => {
  return isFolder.value && props.config.size !== 'compact'
})

// ✅ 计算目录下书签数量，优先使用预聚合数据
const bookmarkCount = computed(() => {
  if (!isFolder.value) return 0

  // ✅ 优先使用 bookmarksCount (来自 IndexedDB 的递归总数)
  // 如果没有 bookmarksCount，则使用 childrenCount 或递归统计已加载的 children
  if (props.node.bookmarksCount !== undefined) {
    return props.node.bookmarksCount
  }

  if (props.node.childrenCount !== undefined) {
    return props.node.childrenCount
  }

  if (!props.node.children) return 0
  return countBookmarks(props.node.children)
})

// 🚀 性能优化：缓存半选中状态计算
const isIndeterminate = computed(() => {
  if (!isFolder.value) return false
  const counts = props.selectedDescCounts
  if (!counts) return false
  const selected = counts.get(String(props.node.id)) || 0
  const total =
    (props.node.bookmarksCount as number | undefined) ??
    (props.node.childrenCount as number | undefined) ??
    0
  return total > 0 && selected > 0 && selected < total
})

// ✅ 使用懒加载Favicon服务（带缓存、域名复用、可视区域加载）
const {
  faviconUrl,
  // isError: faviconLoadFailed,
  handleLoad: handleFaviconLoad,
  handleError: handleFaviconErrorNew
} = useLazyFavicon({
  url: toRef(() => props.node.url),
  rootEl: rootRef,
  enabled: false // ⚠️ 临时禁用懒加载，立即加载所有favicon以快速填充缓存
})

const safeFaviconUrl = computed(() => sanitizeFaviconUrl(faviconUrl.value))

// 🚀 性能优化：缓存高亮标题计算
const highlightedTitle = computed(() => {
  if (!props.node.title) return ''
  if (!props.highlightMatches) return props.node.title
  if (!props.searchQuery) return props.node.title
  const query = props.searchQuery
  const title = props.node.title
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  return title.replace(regex, '<mark>$1</mark>')
})

const truncatedUrl = computed(() => {
  if (!props.node.url) return ''
  const maxLength = 40
  return props.node.url.length > maxLength
    ? `${props.node.url.substring(0, maxLength)}...`
    : props.node.url
})

const bookmarkTooltip = computed(() => {
  const parts = [props.node.title]
  if (props.node.url) parts.push(props.node.url)
  return parts.join('\n')
})

// 渲染用子节点：保持传入顺序，不做去重
const renderChildren = computed(() => {
  const children = Array.isArray(props.node.children) ? props.node.children : []
  return children
})

// === 性能优化：缓存节点样式类
const nodeClasses = computed(() => ({
  'node--folder': isFolder.value,
  'node--bookmark': !isFolder.value,
  'node--expanded': isExpanded.value,
  'node--active': String(props.activeId ?? '') === String(props.node.id ?? ''),
  'node--hovered':
    String(props.hoveredId ?? '') === String(props.node.id ?? ''),
  [`node--level-${props.level}`]: true,
  [`node--${props.config.size || 'comfortable'}`]: true
}))

const nodeStyle = computed(() => ({
  paddingLeft: `${props.level * getIndentSize()}px`
}))

/**
 * 固定行高样式：结合 size 映射到统一高度。
 */
const itemStyle = computed(() => {
  const size = props.config.size || 'comfortable'
  const heightMap: Record<'compact' | 'comfortable' | 'spacious', number> = {
    compact: 30,
    comfortable: 36,
    spacious: 44
  }
  return {
    '--item-height': `${heightMap[size]}px`
  }
})

// 仅当节点带有实际复选框时允许 Shift 触发选中：
const hasSelectionCheckbox = computed(() => {
  if (
    props.config.selectable !== 'multiple' ||
    !props.config.showSelectionCheckbox
  )
    return false
  if (isFolder.value) return !isRootFolder.value
  return true // 书签节点
})

// === 性能优化：缓存子节点状态检查函数 ===
const isChildExpanded = (childId: string) => props.expandedFolders.has(childId)
const isChildSelected = (childId: string) => props.selectedNodes.has(childId)

// === 事件处理 ===
// 🚀 性能优化：使用箭头函数避免重复创建
const onHover = () => {
  isHovered.value = true
  const isBookmark = !isFolder.value && !!props.node.url
  if (isBookmark) {
    emit('node-hover', props.node)
  }
}

const onHoverLeave = () => {
  isHovered.value = false
  const isBookmark = !isFolder.value && !!props.node.url
  if (isBookmark) {
    emit('node-hover-leave', props.node)
  }
}

const handleFolderToggleClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('.node-actions')) {
    return
  }

  // 如果是文件夹，总是处理展开/收起逻辑
  if (isFolder.value) {
    if (hasSelectionCheckbox.value && (event as MouseEvent).shiftKey) {
      emit('node-select', String(props.node.id), props.node)
      return
    }

    emit('node-click', props.node, event)
    emit('folder-toggle', props.node.id, props.node)
    return
  }

  // 对于非文件夹节点（书签），处理选择逻辑
  if (hasSelectionCheckbox.value && (event as MouseEvent).shiftKey) {
    emit('node-select', String(props.node.id), props.node)
    return
  }

  if (props.config.selectable === 'single') {
    emit('node-select', String(props.node.id), props.node)
  }
  emit('node-click', props.node, event)
}

const handleBookmarkClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('.node-actions')) {
    return
  }

  if (hasSelectionCheckbox.value && event.shiftKey) {
    emit('node-select', props.node.id, props.node)
    return
  }

  if (props.config.selectable === 'single') {
    emit('node-select', String(props.node.id), props.node)
  }
  emit('node-click', props.node, event)
}

const toggleSelection = () => {
  emit('node-select', String(props.node.id), props.node)
}

// === 操作处理方法 ===
const handleEdit = () => {
  if (isFolder.value && props.level === 0) return
  emit('node-edit', props.node)
}

const handleDelete = () => {
  if (isFolder.value && props.level === 0) return
  emit('node-delete', props.node)
}

const handleAddItem = () => {
  emit('folder-add', props.node)
}

const handleOpenInNewTab = () => {
  if (props.node.url) {
    emit('bookmark-open-new-tab', props.node)
  }
}

const handleCopyUrl = async () => {
  if (props.node.url) {
    try {
      await navigator.clipboard.writeText(props.node.url)
      emit('bookmark-copy-url', props.node)
    } catch (error) {
      logger.error('Component', '复制URL失败:', error)
    }
  }
}

const handleFaviconError = () => {
  handleFaviconErrorNew()
}

// === 工具函数 ===
const handleChildNodeClick = (node: BookmarkNode, event: MouseEvent) => {
  emit('node-click', node, event)
}

const handleChildFolderToggle = (folderId: string, node: BookmarkNode) => {
  emit('folder-toggle', folderId, node)
}

const handleChildNodeSelect = (nodeId: string, node: BookmarkNode) => {
  emit('node-select', nodeId, node)
}

const handleChildNodeEdit = (node: BookmarkNode) => {
  emit('node-edit', node)
}

const handleChildNodeDelete = (node: BookmarkNode) => {
  emit('node-delete', node)
}

const handleChildFolderAdd = (parentNode: BookmarkNode) => {
  emit('folder-add', parentNode)
}

const handleChildBookmarkOpenNewTab = (node: BookmarkNode) => {
  emit('bookmark-open-new-tab', node)
}

const handleChildBookmarkCopyUrl = (node: BookmarkNode) => {
  emit('bookmark-copy-url', node)
}

const handleChildNodeHover = (node: BookmarkNode) => {
  emit('node-hover', node)
}

const handleChildNodeHoverLeave = (node: BookmarkNode) => {
  emit('node-hover-leave', node)
}

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
    case 'compact':
      return 16
    case 'spacious':
      return 24
    default:
      return 20
  }
}

// 已由 O(1) 计数方案替代；保留占位，避免误用
// function descendantIds(node: BookmarkNode): string[] {
//   const ids: string[] = []
//   if (node.children) {
//     for (const c of node.children) {
//       ids.push(String(c.id))
//       ids.push(...descendantIds(c as BookmarkNode))
//     }
//   }
//   return ids
// }
</script>

<style scoped>
.simple-tree-node {
  position: relative;
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: 0 var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  min-height: var(--item-height, 32px);
  height: var(--item-height, 32px);
}

.node-content:hover {
  background: var(--color-surface-hover);
}

.node-content:active {
  background: var(--color-surface-active);
}

/* 展开图标 */
.expand-icon {
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: var(--border-radius-xs);
  transition: transform var(--md-sys-motion-duration-short3)
    var(--md-sys-motion-easing-standard);
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
.bookmark-icon {
  display: flex;
  align-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* 复选框样式，与行高对齐 */
.select-checkbox {
  display: inline-flex;
  align-items: center;
  margin-right: var(--spacing-1-5);
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
  font-size: var(--text-base);
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
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  background: var(--color-surface-variant);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  font-weight: 500;
}

/* 操作按钮组 */
.node-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-0-5);
  margin-left: auto;
  padding-left: var(--spacing-sm);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard),
    visibility var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard);
  background: var(--color-surface);
  border-radius: var(--border-radius-sm);
  padding: var(--spacing-0-5);
  flex-shrink: 0;
  position: relative;
}

.node-actions.actions-visible {
  opacity: 1;
  visibility: visible;
}

.node-actions .btn {
  min-width: 24px;
  height: 24px;
  padding: 0;
  border-radius: var(--border-radius-xs);
}

.node-actions .btn:hover {
  background: var(--color-surface-variant);
}

.node-actions .btn[color='error']:hover {
  background: var(--color-error-subtle);
  color: var(--color-error-emphasis);
}

/* 文件夹操作项特殊样式 */
.folder-actions .btn[title*='添加'] {
  color: var(--color-success);
}

.folder-actions .btn[title*='添加']:hover {
  background: var(--color-success-subtle);
  color: var(--color-success-emphasis);
}

/* 书签操作项特殊样式 */
.bookmark-actions .btn[title*='新标签页'] {
  color: var(--color-primary);
}

.bookmark-actions .btn[title*='新标签页']:hover {
  background: var(--color-primary-subtle);
  color: var(--color-primary-emphasis);
}

/* 子节点 */
.children {
  position: relative;
}

.children::before {
  content: '';
  position: absolute;
  left: calc(var(--indent-size, 20px) + var(--spacing-sm));
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-border);
  opacity: 0.3;
}

/* 尺寸变体 */
.node--compact .node-content {
  padding: 0 var(--spacing-1);
}

.node--compact .node-title {
  font-size: var(--text-sm);
}

.node--spacious .node-content {
  padding: 0 var(--spacing-2);
  gap: var(--spacing-1-5);
}

.node--spacious .node-title {
  font-size: var(--text-base);
}

/* 层级样式 */
.node--level-0 .node-content {
  font-weight: 500;
}

/* 动画 */
.children {
  animation: slideDown var(--md-sys-motion-duration-medium1)
    var(--md-sys-motion-easing-standard-decelerate);
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

/* 🔆 高亮激活态（左侧联动） */
.simple-tree-node.node--active .node-content {
  background: var(--color-primary-subtle);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 🖱️ 程序化 hover 态（跨面板联动） */
.simple-tree-node.node--hovered .node-content {
  background: var(--color-surface-hover);
}

/* 当处于程序化 hover 态时，显示操作按钮以模拟鼠标悬停效果 */
.simple-tree-node.node--hovered .node-actions {
  opacity: 1;
  visibility: visible;
}
</style>
