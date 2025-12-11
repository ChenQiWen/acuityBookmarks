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
    :data-node-id="String(node.id)"
  >
    <!-- 文件夹节点 -->
    <div
      v-if="isFolder"
      class="node-content folder-content"
      :style="itemStyle"
      @click="handleFolderToggleClick"
    >
      <!-- 选择复选框（图标变体） -->
      <Checkbox
        v-if="
          config.showSelectionCheckbox &&
          config.selectable === 'multiple' &&
          !isRootFolder
        "
        variant="icon"
        :model-value="isSelected"
        :indeterminate="isIndeterminate"
        size="md"
        class="select-checkbox"
        @update:model-value="toggleSelection"
      />

      <!-- 文件夹图标 -->
      <div class="folder-icon">
        <Icon
          :name="
            isEmptyFolder
              ? isExpanded
                ? 'icon-folder-open'
                : 'icon-folder'
              : isExpanded
                ? 'icon-folder-open'
                : 'icon-folder'
          "
          :size="18"
          class="folder-icon-svg"
        />
      </div>

      <!-- 文件夹标题 -->
      <div class="node-title" :title="node.title">
        <span v-html="highlightedTitle"></span>
      </div>

      <!-- 文件夹操作项 (hover显示) -->
      <div class="node-actions folder-actions">
        <!-- 添加子项按钮 -->
        <Button
          v-show="config.showAddButton || config.editable"
          variant="ghost"
          size="sm"
          density="compact"
          icon-left="icon-add-circle"
          :title="'添加到 ' + node.title"
          @click.stop="handleAddItem"
        />
        <!-- 编辑文件夹按钮（顶级文件夹不允许编辑） -->
        <Button
          v-show="!isRootFolder && (config.showEditButton || config.editable)"
          variant="ghost"
          size="sm"
          density="compact"
          icon-left="icon-edit-folder"
          title="编辑文件夹"
          @click.stop="handleEdit"
        />
        <!-- 删除文件夹按钮（顶级文件夹不允许删除） -->
        <Button
          v-show="!isRootFolder && (config.showDeleteButton || config.editable)"
          variant="ghost"
          size="sm"
          density="compact"
          color="error"
          icon-left="icon-folder-delete"
          title="删除文件夹"
          @click.stop="handleDelete"
        />
        <!-- 分享文件夹按钮 -->
        <Button
          v-show="config.showShareButton"
          variant="ghost"
          size="sm"
          density="compact"
          icon-left="icon-share"
          title="分享文件夹"
          @click.stop="handleShareFolder"
        />
        <!-- 书签计数 -->
        <CountIndicator v-if="showCount" class="folder-count" :count="bookmarkCount" />
      </div>
    </div>

    <!-- 书签节点 -->
    <div
      v-else
      class="node-content bookmark-content"
      :class="{ 'node-content--selected': isSelected }"
      :style="itemStyle"
      @click="handleBookmarkClick"
    >
      <!-- 书签选择复选框（图标变体） -->
      <Checkbox
        v-if="config.showSelectionCheckbox && config.selectable === 'multiple'"
        variant="icon"
        :model-value="isSelected"
        :indeterminate="false"
        size="md"
        class="select-checkbox"
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

      <!-- 收藏按钮（已收藏时始终显示，未收藏时 hover 显示） -->
      <Button
        v-show="config.showFavoriteButton"
        variant="ghost"
        size="sm"
        density="compact"
        icon-only
        :class="{
          'favorite-button-always-visible': isFavorited,
          'favorite-button-hover-visible': !isFavorited
        }"
        :title="isFavorited ? '取消收藏' : '收藏书签'"
        @click.stop="handleToggleFavorite"
      >
        <Icon
          :name="isFavorited ? 'icon-favorite-outline' : 'icon-favorite'"
          :size="20"
          :color="isFavorited ? 'warning' : undefined"
          class="favorite-icon"
        />
      </Button>

      <!-- 书签操作项 (hover显示) -->
      <div class="node-actions bookmark-actions">
        <!-- 在新标签页打开按钮 -->
        <Button
          v-show="config.showOpenNewTabButton || config.editable"
          variant="ghost"
          size="sm"
          density="compact"
          icon-left="icon-open-link"
          title="在新标签页打开"
          @click.stop="handleOpenInNewTab"
        />
        <!-- 复制链接按钮 -->
        <Button
          v-show="config.showCopyUrlButton || config.editable"
          variant="ghost"
          size="sm"
          density="compact"
          icon-left="icon-link"
          title="复制链接"
          @click.stop="handleCopyUrl"
        />
        <!-- 编辑按钮 -->
        <Button
          v-show="config.showEditButton || config.editable"
          variant="ghost"
          size="sm"
          density="compact"
          icon-left="icon-edit-bookmark"
          title="编辑书签"
          @click.stop="handleEdit"
        />
        <!-- 删除按钮 -->
        <Button
          v-show="config.showDeleteButton || config.editable"
          variant="ghost"
          size="sm"
          density="compact"
          color="error"
          icon-left="icon-bookmark-delete"
          title="删除书签"
          @click.stop="handleDelete"
        />
      </div>
    </div>

    <!-- 子节点：仅文件夹节点在展开时显示子节点 -->
    <div
      v-if="isFolder && isExpanded && node.children && !isVirtualMode"
      class="children"
    >
      <TreeNode
        v-for="child in renderChildren"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        :selected-nodes="selectedNodes"
        :search-query="searchQuery"
        :config="config"
        :active-id="activeId"
        :loading-more-folders="loadingMoreFolders"
        :drag-state="dragState"
        @node-click="handleChildNodeClick"
        @folder-toggle="handleChildFolderToggle"
        @node-select="handleChildNodeSelect"
        @node-edit="handleChildNodeEdit"
        @node-delete="handleChildNodeDelete"
        @folder-add="handleChildFolderAdd"
        @bookmark-open-new-tab="handleChildBookmarkOpenNewTab"
        @bookmark-copy-url="handleChildBookmarkCopyUrl"
        @bookmark-toggle-favorite="handleChildBookmarkToggleFavorite"
        @drag-start="$emit('drag-start', $event)"
        @drag-over="$emit('drag-over', $event)"
        @drag-leave="$emit('drag-leave', $event)"
        @drop="$emit('drop', $event)"
        @drag-end="$emit('drag-end')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import { Button, Checkbox, Chip, CountIndicator, Icon } from '@/components'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import { useLazyFavicon } from '@/composables/useLazyFavicon'
import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'

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
 * TreeNode - 树节点渲染单元
 * - 负责单个节点的交互与展示
 */
defineOptions({ name: 'TreeNode' })

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
  searchQuery?: string
  /** 是否对标题进行关键字高亮 */
  highlightMatches?: boolean
  config: {
    size?: 'compact' | 'comfortable' | 'spacious'
    searchable?: boolean
    selectable?: boolean | 'single' | 'multiple'
    editable?: boolean
    showSelectionCheckbox?: boolean
    draggable?: boolean // ✅ 是否启用拖拽
    // 细粒度按钮控制
    showFavoriteButton?: boolean
    showEditButton?: boolean
    showDeleteButton?: boolean
    showAddButton?: boolean
    showOpenNewTabButton?: boolean
    showCopyUrlButton?: boolean
    showShareButton?: boolean
  }
  isVirtualMode?: boolean
  /** 严格顺序渲染：不对 children 去重/重排 */
  strictOrder?: boolean
  /** 当前激活高亮的节点ID */
  activeId?: string
  /** 正在自动加载更多子节点的文件夹ID集合 */
  loadingMoreFolders?: Set<string>
  /** 已选后代计数 Map（folderId -> 已选书签数）*/
  selectedDescCounts?: Map<string, number>
  /** 正在执行删除动画的节点 ID 集合 */
  deletingNodeIds?: Set<string>
  /** 拖拽状态（由 BookmarkTree 传入） */
  dragState?: {
    isDragging: boolean
    dragSourceId: string | null
    dropTargetId: string | null
    dropPosition: 'before' | 'inside' | 'after' | null
  }
}
const props = withDefaults(defineProps<Props>(), {
  level: 0,
  searchQuery: '',
  highlightMatches: true,
  isVirtualMode: false,
  strictOrder: false,
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
  'bookmark-toggle-favorite': [node: BookmarkNode, isFavorite: boolean]
  // 🆕 节点挂载/卸载事件，用于构建元素注册表以提升滚动性能
  'node-mounted': [id: string, el: HTMLElement]
  'node-unmounted': [id: string]
  // ✅ 拖拽相关事件
  'drag-start': [node: BookmarkNode]
  'drag-over': [
    data: { node: BookmarkNode; position: 'before' | 'inside' | 'after' }
  ]
  'drag-leave': [node: BookmarkNode]
  drop: [
    data: {
      sourceId: string
      targetId: string
      position: 'before' | 'inside' | 'after'
    }
  ]
  'drag-end': []
  /** 分享文件夹 */
  'folder-share': [node: BookmarkNode]
}>()

// 根元素引用与生命周期上报，用于构建元素注册表以优化滚动定位
const rootRef = ref<HTMLElement | null>(null)
// ✅ 拖拽清理函数引用
let cleanupDrag: (() => void) | null = null

onMounted(() => {
  if (rootRef.value) {
    emit('node-mounted', String(props.node.id), rootRef.value)
  }

  // ✅ 启用拖拽功能
  if (props.config.draggable && rootRef.value) {
    cleanupDrag = combine(
      // 1️⃣ 将节点设置为可拖拽源
      draggable({
        element: rootRef.value,
        getInitialData: () => ({
          type: 'bookmark-node',
          nodeId: String(props.node.id),
          node: props.node
        }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // 🎨 生成自定义拖拽预览（类似 Chrome 书签管理器）
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: '16px',
              y: '8px'
            }),
            render: ({ container }) => {
              const preview = document.createElement('div')
              preview.className = 'bookmark-drag-preview'

              // 创建图标
              const icon = document.createElement('div')
              icon.className = 'preview-icon'

              if (props.node.url) {
                // 书签：显示 favicon
                const favicon = document.createElement('img')
                favicon.className = 'preview-favicon'
                favicon.src =
                  safeFaviconUrl.value ||
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23e0e0e0"/></svg>'
                favicon.onerror = () => {
                  favicon.style.display = 'none'
                  icon.innerHTML = '📄'
                  icon.style.fontSize = '16px'
                }
                icon.appendChild(favicon)
              } else {
                // 文件夹：显示文件夹图标
                icon.innerHTML = isExpanded.value ? '📂' : '📁'
                icon.style.fontSize = '16px'
              }

              // 创建标题
              const title = document.createElement('div')
              title.className = 'preview-title'
              title.textContent = props.node.title || '未命名'

              preview.appendChild(icon)
              preview.appendChild(title)
              container.appendChild(preview)
            }
          })
        },
        onDragStart: () => {
          logger.debug('TreeNode', '开始拖拽', { nodeId: props.node.id })
          emit('drag-start', props.node)
        },
        onDrop: () => {
          logger.debug('TreeNode', '拖拽结束', { nodeId: props.node.id })
          emit('drag-end')
        }
      }),

      // 2️⃣ 将节点设置为可放置目标
      dropTargetForElements({
        element: rootRef.value,
        canDrop: ({ source }) => {
          const sourceId = String(source.data.nodeId)
          const targetId = String(props.node.id)

          // ✅ 禁止自己拖到自己
          if (sourceId === targetId) {
            return false
          }

          // ✅ 禁止将父文件夹拖入其子文件夹（循环引用检查）
          // 检查目标节点是否在源节点的子树中
          const sourceNode = source.data.node as BookmarkNode | undefined
          if (sourceNode && !props.node.url) {
            // 如果目标节点的祖先链中包含源节点ID，则禁止
            const checkIsDescendant = (
              node: BookmarkNode,
              ancestorId: string
            ): boolean => {
              if (node.id === ancestorId) return true
              if (node.parentId === ancestorId) return true
              // 通过 ancestorIds 检查（如果有的话）
              if (
                Array.isArray(node.ancestorIds) &&
                node.ancestorIds.includes(ancestorId)
              ) {
                return true
              }
              return false
            }

            if (checkIsDescendant(props.node, sourceId)) {
              return false
            }
          }

          return true
        },
        getData: ({ input, element }) => {
          // 根据鼠标位置计算放置位置
          const rect = element.getBoundingClientRect()
          const relativeY = input.clientY - rect.top
          const height = rect.height
          const isFolder = !props.node.url

          let position: 'before' | 'inside' | 'after'

          if (isFolder) {
            // 📁 文件夹：上 1/4 为 before，中间 1/2 为 inside，下 1/4 为 after
            if (relativeY < height / 4) {
              position = 'before'
            } else if (relativeY > (height * 3) / 4) {
              position = 'after'
            } else {
              position = 'inside'
            }
          } else {
            // 📄 书签：只能 before/after，不能 inside（书签不能包含其他节点）
            position = relativeY < height / 2 ? 'before' : 'after'
          }

          return {
            type: 'bookmark-node-drop',
            nodeId: String(props.node.id),
            position
          }
        },
        onDragEnter: ({ self }) => {
          const position = self.data.position as 'before' | 'inside' | 'after'
          logger.debug('TreeNode', '拖拽进入', {
            nodeId: props.node.id,
            position
          })
          emit('drag-over', { node: props.node, position })
        },
        onDrag: ({ self }) => {
          const position = self.data.position as 'before' | 'inside' | 'after'
          emit('drag-over', { node: props.node, position })
        },
        onDragLeave: () => {
          logger.debug('TreeNode', '拖拽离开', { nodeId: props.node.id })
          emit('drag-leave', props.node)
        },
        onDrop: ({ source, self }) => {
          const sourceId = String(source.data.nodeId)
          const targetId = String(props.node.id)
          const position = self.data.position as 'before' | 'inside' | 'after'

          logger.info('TreeNode', '拖拽放置', {
            sourceId,
            targetId,
            position
          })

          emit('drop', { sourceId, targetId, position })
        }
      })
    )
  }
})

onUnmounted(() => {
  emit('node-unmounted', String(props.node.id))
  // ✅ 清理拖拽事件监听
  if (cleanupDrag) {
    cleanupDrag()
    cleanupDrag = null
  }
})

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

// ✅ 判断当前节点是否正在执行删除动画
const isDeleting = computed(() => {
  return props.deletingNodeIds?.has(String(props.node.id)) ?? false
})

// 🚀 性能优化：缓存展开状态检查
const isExpanded = computed(() => props.expandedFolders.has(props.node.id))
const isSelected = computed(() =>
  props.selectedNodes.has(String(props.node.id))
)

// 🆕 收藏状态
const isFavorited = computed(() => {
  return Boolean(props.node.isFavorite)
})

// 根目录（level === 0）不允许编辑/删除
const isRootFolder = computed(() => isFolder.value && props.level === 0)

// ✅ 显示书签数量提示
const showCount = computed(() => {
  return isFolder.value && props.config.size !== 'compact'
})

// ✅ 计算目录下直接子项数量（统一标准：只统计直接子项，不递归）
const bookmarkCount = computed(() => {
  if (!isFolder.value) return 0

  // ✅ 统一使用 childrenCount (直接子项数量)
  // 这样左右面板显示标准一致，与 Chrome 原生书签管理器行为一致
  if (props.node.childrenCount !== undefined) {
    return props.node.childrenCount
  }

  // 如果没有 childrenCount，使用已加载 children 的长度
  if (!props.node.children) return 0
  return props.node.children.length
})

// 🚀 性能优化：缓存半选中状态计算
const isIndeterminate = computed(() => {
  if (!isFolder.value) return false

  // 如果父节点本身被选中，则不显示半选中
  if (isSelected.value) return false

  // 如果有任何子孙节点被选中，则显示半选中
  const counts = props.selectedDescCounts
  if (!counts) return false
  const selected = counts.get(String(props.node.id)) || 0
  return selected > 0
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

// ✅ 拖拽状态计算属性
const isDraggingSource = computed(() => {
  return (
    props.dragState?.isDragging &&
    props.dragState.dragSourceId === String(props.node.id)
  )
})

const dropPosition = computed(() => {
  // 只有当前节点是放置目标时，才返回放置位置
  const isDropTarget = props.dragState?.dropTargetId === String(props.node.id)
  return isDropTarget ? props.dragState?.dropPosition : null
})

// === 性能优化：缓存节点样式类
const nodeClasses = computed(() => ({
  'node--folder': isFolder.value,
  'node--bookmark': !isFolder.value,
  'node--expanded': isExpanded.value,
  'node--active': String(props.activeId ?? '') === String(props.node.id ?? ''),
  'node--deleting': isDeleting.value,
  // ✅ 拖拽状态类
  'node--dragging': isDraggingSource.value,
  'node--drop-before': dropPosition.value === 'before',
  'node--drop-inside': dropPosition.value === 'inside',
  'node--drop-after': dropPosition.value === 'after',
  [`node--level-${props.level}`]: true,
  [`node--${props.config.size || 'comfortable'}`]: true
}))

/**
 * 固定行高样式：结合 size 映射到统一高度 + 缩进
 */
const itemStyle = computed(() => {
  const size = props.config.size || 'comfortable'
  const heightMap: Record<'compact' | 'comfortable' | 'spacious', number> = {
    compact: 30,
    comfortable: 36,
    spacious: 44
  }

  // ✅ 计算缩进 - 使用 margin-left 实现，避免 hover 背景色延伸到缩进区域
  const level = props.level ?? 0
  const indentSize = getIndentSize()
  const marginLeft = level * indentSize

  return {
    '--item-height': `${heightMap[size]}px`,
    marginLeft: `${marginLeft}px`
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

// ✅ 移除了 v-memo 优化，不再需要缓存子节点状态检查函数

// === 事件处理 ===

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

  // 点击书签触发选中/取消选中
  if (props.config.selectable) {
    emit('node-select', String(props.node.id), props.node)
  } else {
    // 如果不可选中，触发点击事件
    emit('node-click', props.node, event)
  }
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

const handleShareFolder = () => {
  logger.info('TreeNode', `📤 分享文件夹: ${props.node.title}`)
  emit('folder-share', props.node)
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

const handleToggleFavorite = () => {
  const newFavoriteState = !isFavorited.value
  logger.info(
    'TreeNode',
    `${newFavoriteState ? '⭐ 收藏' : '🗑️ 取消收藏'}书签:`,
    props.node.title
  )
  emit('bookmark-toggle-favorite', props.node, newFavoriteState)
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

const handleChildBookmarkToggleFavorite = (
  node: BookmarkNode,
  isFavorite: boolean
) => {
  emit('bookmark-toggle-favorite', node, isFavorite)
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getIndentSize(): number {
  switch (props.config.size) {
    case 'compact':
      return 20 // ✅ 增加缩进：16 → 20
    case 'spacious':
      return 32 // ✅ 增加缩进：24 → 32
    default:
      return 24 // ✅ 增加缩进：20 → 24
  }
}
</script>

<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list, color-no-hex -- 树节点组件使用特定尺寸和颜色 */

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes delete-slide-out {
  0% {
    opacity: 1;
    transform: translateX(0);
  }

  100% {
    opacity: 0;
    transform: translateX(100%);
  }
}

.simple-tree-node {
  position: relative;
  user-select: none;
}

.node-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--item-height, 32px);
  padding: 0 var(--spacing-sm);
  cursor: default;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

/* 文件夹悬停效果 - 淡黄色渐变 + 左侧橙色边框 */
.folder-content {
  min-height: 36px; /* 文件夹行高稍大 */
  border-left: 3px solid transparent;
  border-radius: 18px; /* 36px / 2 = 胶囊形状 */
  transition:
    background var(--transition-fast),
    border-left-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

/* 书签行高紧凑 */
.bookmark-content {
  min-height: 30px;
  border-left: 3px solid transparent; /* 与文件夹对齐 */
  border-radius: 15px; /* 30px / 2 = 胶囊形状 */
}

.folder-content:hover {
  background: linear-gradient(90deg, var(--color-folder-hover) 0%, transparent 100%);
  border-left-color: var(--color-folder);
}

/* 书签悬停效果 - 蓝色系 */
.bookmark-content:hover {
  background: var(--color-bookmark-hover);
}

/* 选中状态高亮（持久显示）- 通过增加特异性而非 !important */

/* 书签选中 - 蓝色系 */
.simple-tree-node .bookmark-content.node-content--selected {
  background: var(--color-bookmark-selected);
}

/* 书签选中 + hover */
.simple-tree-node .bookmark-content.node-content--selected:hover {
  background: color-mix(in srgb, var(--color-bookmark-selected), #000 5%);
}

/* 文件夹选中 - 黄色系（与 hover 保持一致） */
.simple-tree-node .folder-content.node-content--selected {
  background: var(--color-folder-selected);
  border-left-color: var(--color-folder);
}

/* 文件夹选中 + hover */
.simple-tree-node .folder-content.node-content--selected:hover {
  background: color-mix(in srgb, var(--color-folder-selected), #000 5%);
}


/* 点击反馈（未选中时）- 区分文件夹和书签 */

/* 书签点击 - 蓝色系 */
.simple-tree-node .bookmark-content:not(.node-content--selected):active {
  background: var(--color-bookmark-active);
}

/* 文件夹点击 - 黄色系 */
.simple-tree-node .folder-content:not(.node-content--selected):active {
  background: var(--color-folder-active);
  border-left-color: var(--color-folder);
}

/* 文件夹样式 */
.folder-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  margin-right: var(--spacing-0-5);
}

/* 文件夹图标颜色 - 橙黄色 */
.folder-icon-svg {
  color: var(--color-folder);
}

/* 书签样式 */
.bookmark-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
  margin-right: var(--spacing-0-5);
}

/* 选择复选框样式调整 */
.select-checkbox {
  margin-right: var(--spacing-0-5);
}

/* 文件夹行内的 Checkbox hover 使用黄色系 */
.folder-content .select-checkbox:hover :deep(.checkbox-icon-variant) {
  background: var(--color-folder-hover);
}

/* 书签行内的 Checkbox hover 使用蓝色系 */
.bookmark-content .select-checkbox:hover :deep(.checkbox-icon-variant) {
  background: color-mix(in srgb, var(--color-bookmark-hover), transparent 30%);
}

.bookmark-icon img {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  object-fit: cover;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

/* 标题 - 基础样式 */
.node-title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-base);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 文件夹标题 - 粗体 */
.folder-content .node-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

/* 书签标题 - 常规字体 */
.bookmark-content .node-title {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.node-title :deep(mark) {
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
  color: var(--color-warning-emphasis);
  background: var(--color-warning-subtle);
}

/* 文件夹计数（在 node-actions 内部） */
.folder-count {
  flex-shrink: 0;
  margin-right: var(--spacing-1);
}

/* 操作按钮组 */
.node-actions {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-0-5);
  margin-right: 0;
  margin-left: auto;
  padding: var(--spacing-1);
  border-radius: var(--border-radius-sm);

  /* background: var(--color-surface); */
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard),
    visibility var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard);
}

/* ✅ hover 时显示操作按钮 */
.node-content:hover .node-actions {
  opacity: 1;
  visibility: visible;
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
  color: var(--color-error-emphasis);
  background: var(--color-error-subtle);
}

/* 文件夹操作项特殊样式 */
.folder-actions .btn[title*='添加'] {
  color: var(--color-success);
}

.folder-actions .btn[title*='添加']:hover {
  color: var(--color-success-emphasis);
  background: var(--color-success-subtle);
}

/* 书签操作项特殊样式 */
.bookmark-actions .btn[title*='新标签页'] {
  color: var(--color-primary);
}

.bookmark-actions .btn[title*='新标签页']:hover {
  color: var(--color-primary-emphasis);
  background: var(--color-primary-subtle);
}

/* 子节点 */
.children {
  position: relative;

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;
  animation: slide-down var(--md-sys-motion-duration-medium1)
    var(--md-sys-motion-easing-standard-decelerate);
}

.children::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--indent-size, 24px) * 0.5 + var(--spacing-sm));
  width: 1.5px;
  border-radius: 1px;
  background: var(--color-border);
  opacity: 0.4;
  content: '';
}

/* 尺寸变体 */
.node--compact .node-content {
  padding: 0 var(--spacing-1);
}

.node--compact .node-title {
  font-size: var(--text-sm);
}

.node--spacious .node-content {
  gap: var(--spacing-1-5);
  padding: 0 var(--spacing-2);
}

.node--spacious .node-title {
  font-size: var(--text-base);
}

/* 层级样式 */
.node--level-0 > .node-content {
  padding-top: var(--spacing-0-5);
  padding-bottom: var(--spacing-0-5);
  font-size: var(--text-base);
  font-weight: 600;
}

.node--level-0 > .node-content .folder-icon {
  opacity: 1;
}

/* 增强各层级的视觉区分 */
.node--level-1 > .node-content {
  font-weight: 500;
}

.node--level-2 > .node-content,
.node--level-3 > .node-content,
.node--level-4 > .node-content,
.node--level-5 > .node-content {
  font-weight: 400;
}

/* ✅ 删除动画：从左往右消失 */
.simple-tree-node.node--deleting {
  pointer-events: none;
  animation: delete-slide-out 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;
}

/* 🔆 高亮激活态（左侧联动） */
.simple-tree-node.node--active .node-content {
  background: var(--color-primary-subtle);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* ✅ 拖拽状态样式（参考 Chrome 书签管理器） */

/* 拖拽源：半透明 */
.simple-tree-node.node--dragging {
  opacity: 0.4;
}

.simple-tree-node.node--dragging .node-content {
  cursor: grabbing;
}

/* 放置位置指示线（参考 Chrome 的蓝色线条） */
.simple-tree-node.node--drop-before::before,
.simple-tree-node.node--drop-after::after {
  position: absolute;
  right: 0;
  left: var(--indent-width, 0);
  z-index: 10;
  height: 2px;
  background: var(--color-primary, #1976d2);
  pointer-events: none;
  content: '';
  box-shadow: 0 0 4px rgb(25 118 210 / 50%);
}

.simple-tree-node.node--drop-before::before {
  top: -1px;
}

.simple-tree-node.node--drop-after::after {
  bottom: -1px;
}

/* 放置到文件夹内部：轻微高亮背景 + 左侧指示线 */
.simple-tree-node.node--drop-inside .node-content {
  position: relative;
  background: rgb(25 118 210 / 8%);
}

/* 文件夹内部放置时，左侧显示垂直指示线 */
.simple-tree-node.node--drop-inside .node-content::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--color-primary, #1976d2);
  content: '';
}

/* 拖拽时节点内容的光标（仅在启用拖拽时显示） */
.simple-tree-node .node-content:active {
  cursor: grabbing;
}

/* 拖拽时的光标样式 */
.simple-tree-node:not(.node--dragging) .node-content:hover {
  cursor: grab;
}

/* ✅ 收藏按钮样式（独立于 node-actions） */
.favorite-button-always-visible,
.favorite-button-hover-visible {
  min-width: 24px;
  height: 24px;
  margin-right: var(--spacing-1);
  padding: 0;
  border-radius: var(--border-radius-xs);
}

/* 已收藏：始终显示 */
.favorite-button-always-visible {
  opacity: 1;
  visibility: visible;
}

/* 未收藏：默认隐藏，hover 时显示 */
.favorite-button-hover-visible {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard),
    visibility var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard);
}

/* hover 效果（按特异性从低到高排序） */
.favorite-button-always-visible:hover,
.favorite-button-hover-visible:hover {
  background: var(--color-surface-variant);
}

.node-content:hover .favorite-button-hover-visible {
  opacity: 1;
  visibility: visible;
}

/* ✅ 收藏图标动画（仅使用允许的属性：color/opacity） */
.favorite-icon {
  transition:
    color 0.2s ease,
    opacity 0.2s ease;
}

/* 收藏时的高亮效果（使用不透明度） */
.favorite-button-always-visible:active .favorite-icon,
.favorite-button-hover-visible:active .favorite-icon {
  opacity: 0.7;
}
</style>

<style>
/* ✅ 暗色模式支持（使用 CSS 变量） */
@media (prefers-color-scheme: dark) {
  .bookmark-drag-preview {
    background: var(--color-surface, #2d2d2d);
    box-shadow:
      0 4px 12px rgb(0 0 0 / 30%),
      0 0 0 1px rgb(255 255 255 / 10%);
  }

  .bookmark-drag-preview .preview-title {
    color: var(--color-text-primary, #e8eaed);
  }
}

.bookmark-drag-preview {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 120px;
  max-width: 280px;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-sm);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-surface);

  /* ✅ 仅用于hover时的subtle scale效果，不包含rotate */
  transition: transform 0.2s ease;
  box-shadow:
    0 4px 12px rgb(0 0 0 / 15%),
    0 0 0 1px rgb(0 0 0 / 10%);
  backdrop-filter: blur(10px);
}

.bookmark-drag-preview .preview-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: var(--spacing-5);
  height: var(--spacing-5);
}

.bookmark-drag-preview .preview-favicon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 2px;
}

.bookmark-drag-preview .preview-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  white-space: nowrap;

  /* ✅ 使用 CSS 变量，自动适配深色模式 */
  color: var(--color-text-primary, #202124);
  overflow: hidden;
  text-overflow: ellipsis;
}

/**
 * ✅ 拖拽预览标签样式 - 设计规范
 *
 * 📐 设计理念：
 * - 模仿 Chrome 原生书签管理器的拖拽视觉效果
 * - 保持平直（无倾斜），确保文字清晰可读
 * - 使用毛玻璃效果（backdrop-filter）增强层次感
 *
 * 🎨 核心特征：
 * - ❌ 不使用 transform: rotate() - 倾斜会降低可读性
 * - ✅ 使用 box-shadow 营造浮起感
 * - ✅ 自适应深色模式
 * - ✅ 响应式宽度（120px-280px）
 *
 * 💡 为何不倾斜？
 * 倾斜效果虽然增加动感，但在书签管理场景中：
 * 1. 降低标题文字可读性（尤其是长标题）
 * 2. 与系统原生拖拽视觉不一致
 * 3. 增加用户认知负担
 *
 * @see https://www.figma.com/design-systems - Material Design Drag & Drop
 */
</style>
