<!--
  📄 简化版书签树节点组件
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
      :draggable="config.draggable"
      @click="handleFolderToggleClick"
      @mouseenter="onHover"
      @mouseleave="onHoverLeave"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <!-- 展开/收起图标（仅在目录包含书签时显示） -->
      <div v-if="shouldShowExpand" class="expand-icon">
        <Icon
          :name="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
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
                ? 'mdi-folder-open-outline'
                : 'mdi-folder-outline'
              : isExpanded
                ? 'mdi-folder-open'
                : 'mdi-folder'
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
          <Icon name="mdi-plus" :size="14" />
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
          <Icon name="mdi-pencil" :size="14" />
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
          <Icon name="mdi-delete" :size="14" />
        </Button>
      </div>
    </div>

    <!-- 书签节点 -->
    <div
      v-else
      class="node-content bookmark-content"
      :draggable="config.draggable"
      @click="handleBookmarkClick"
      @mouseenter="onHover"
      @mouseleave="onHoverLeave"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
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
      <!-- 书签图标/Favicon -->
      <div class="bookmark-icon">
        <img
          v-if="faviconUrl"
          :src="faviconUrl"
          :alt="node.title"
          :style="{ width: '16px', height: '16px' }"
          @error="handleFaviconError"
        />
        <Icon v-else name="mdi-web" :size="16" color="secondary" />
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
          <Icon name="mdi-open-in-new" :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          title="复制链接"
          @click.stop="handleCopyUrl"
        >
          <Icon name="mdi-content-copy" :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          title="编辑书签"
          @click.stop="handleEdit"
        >
          <Icon name="mdi-pencil" :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          color="error"
          title="删除书签"
          @click.stop="handleDelete"
        >
          <Icon name="mdi-delete" :size="14" />
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
        :node="child"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        :selected-nodes="selectedNodes"
        :search-query="searchQuery"
        :config="config"
        :active-id="activeId"
        :hovered-id="hoveredId"
        @node-click="(node, event) => $emit('node-click', node, event)"
        @folder-toggle="
          (folderId, node) => $emit('folder-toggle', folderId, node)
        "
        @node-select="(nodeId, node) => $emit('node-select', nodeId, node)"
        @node-edit="node => $emit('node-edit', node)"
        @node-delete="node => $emit('node-delete', node)"
        @folder-add="parentNode => $emit('folder-add', parentNode)"
        @bookmark-open-new-tab="node => $emit('bookmark-open-new-tab', node)"
        @bookmark-copy-url="node => $emit('bookmark-copy-url', node)"
        @node-hover="node => $emit('node-hover', node)"
        @node-hover-leave="node => $emit('node-hover-leave', node)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Button, Checkbox, Chip, Icon } from './ui'
import type { BookmarkNode } from '../types'
import { logger } from '@/utils/logger'

// === Props 定义 ===
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
    draggable?: boolean
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
}
const props = withDefaults(defineProps<Props>(), {
  level: 0,
  searchQuery: '',
  highlightMatches: true,
  isVirtualMode: false,
  strictOrder: false
})

// === Emits 定义 ===
const emit = defineEmits<{
  'node-click': [node: BookmarkNode, event: MouseEvent]
  'folder-toggle': [folderId: string, node: BookmarkNode]
  'node-select': [nodeId: string, node: BookmarkNode]
  'node-edit': [node: BookmarkNode]
  'node-delete': [node: BookmarkNode]
  'folder-add': [parentNode: BookmarkNode]
  'bookmark-open-new-tab': [node: BookmarkNode]
  'bookmark-copy-url': [node: BookmarkNode]
  'drag-drop': [
    dragData: Record<string, unknown>,
    targetNode: BookmarkNode,
    dropPosition: 'before' | 'after' | 'inside'
  ]
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
const isHovered = ref(false)
const isDragOver = ref(false)
const isDragging = ref(false)

// === 计算属性 ===

const isFolder = computed(() => !props.node.url)
const isEmptyFolder = computed(() => {
  return (
    isFolder.value && (!props.node.children || props.node.children.length === 0)
  )
})
// 仅当目录包含书签（递归计数 > 0）时显示展开箭头
const shouldShowExpand = computed(() => {
  if (!isFolder.value) return false
  return bookmarkCount.value > 0
})
const isExpanded = computed(() => props.expandedFolders.has(props.node.id))
// 根目录（level === 0）不允许编辑/删除
const isRootFolder = computed(() => isFolder.value && props.level === 0)

const showCount = computed(() => {
  return isFolder.value && props.config.size !== 'compact'
})

const bookmarkCount = computed(() => {
  if (!isFolder.value || !props.node.children) return 0
  return countBookmarks(props.node.children)
})

// 半选中：文件夹且部分子项被选中但非全选
const descendantIds = (node: BookmarkNode): string[] => {
  const ids: string[] = []
  if (node.children) {
    for (const c of node.children) {
      ids.push(String(c.id))
      ids.push(...descendantIds(c as BookmarkNode))
    }
  }
  return ids
}

const isIndeterminate = computed(() => {
  if (!isFolder.value) return false
  const ids = descendantIds(props.node)
  if (ids.length === 0) return false
  let selected = 0
  for (const id of ids) {
    if (props.selectedNodes.has(id)) selected++
  }
  return selected > 0 && selected < ids.length
})

const faviconUrl = computed(() => {
  if (!props.node.url) return ''
  try {
    const url = new URL(props.node.url)
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`
  } catch {
    return ''
  }
})

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

// 渲染用子节点：严格模式则原样返回；否则按 id 去重
const renderChildren = computed(() => {
  const children = Array.isArray(props.node.children) ? props.node.children : []
  if (props.strictOrder) return children
  const seen = new Set<string>()
  const result: BookmarkNode[] = []
  for (const c of children) {
    const cid = String(c.id)
    if (seen.has(cid)) continue
    seen.add(cid)
    result.push(c)
  }
  return result
})

const nodeClasses = computed(() => ({
  'node--folder': isFolder.value,
  'node--bookmark': !isFolder.value,
  'node--expanded': isExpanded.value,
  'node--drag-over': isDragOver.value,
  // 统一转成字符串比较，避免 id 存在 number/string 混用导致联动失效
  'node--active': String(props.activeId ?? '') === String(props.node.id ?? ''),
  'node--hovered':
    String(props.hoveredId ?? '') === String(props.node.id ?? ''),
  [`node--level-${props.level}`]: true,
  [`node--${props.config.size || 'comfortable'}`]: true
}))

const nodeStyle = computed(() => ({
  paddingLeft: `${props.level * getIndentSize()}px`
}))

// 仅当节点带有实际复选框时允许 Shift 触发选中：
// - 书签：config.showSelectionCheckbox 且 selectable==='multiple'
// - 文件夹：同上，且不是根级（根级不显示复选框）
const hasSelectionCheckbox = computed(() => {
  if (
    props.config.selectable !== 'multiple' ||
    !props.config.showSelectionCheckbox
  )
    return false
  if (isFolder.value) return !isRootFolder.value
  return true // 书签节点
})

// === 事件处理 ===

// 鼠标悬停，仅在书签节点上抛出联动事件（目录不触发）
const onHover = () => {
  isHovered.value = true
  const isBookmark = !isFolder.value && !!props.node.url
  if (isBookmark) {
    emit('node-hover', props.node)
  }
}

// 悬停移出：用于清除跨面板的程序化 hover
const onHoverLeave = () => {
  isHovered.value = false
  const isBookmark = !isFolder.value && !!props.node.url
  if (isBookmark) {
    emit('node-hover-leave', props.node)
  }
}

// 🆕 文件夹点击整行展开收起
const handleFolderToggleClick = (event: MouseEvent) => {
  // 如果点击的是操作按钮区域，不处理展开收起
  if ((event.target as HTMLElement).closest('.node-actions')) {
    return
  }
  // 空或不含书签的目录不支持展开
  if (!shouldShowExpand.value) {
    // 仅当该节点有可见复选框时，才允许 Shift 选择
    if (hasSelectionCheckbox.value && (event as MouseEvent).shiftKey) {
      emit('node-select', String(props.node.id), props.node)
    }
    return
  }

  // 如果是拖拽操作，不处理点击
  if (isDragging.value) {
    return
  }
  // 支持 Shift 切换选中（不展开折叠），前提：该节点有复选框
  if (hasSelectionCheckbox.value && (event as MouseEvent).shiftKey) {
    emit('node-select', String(props.node.id), props.node)
    return
  }

  // 先发送点击事件
  emit('node-click', props.node, event)

  // 然后处理展开收起
  emit('folder-toggle', props.node.id, props.node)
}

const handleBookmarkClick = (event: MouseEvent) => {
  // 如果点击的是操作按钮区域，不处理选择
  if ((event.target as HTMLElement).closest('.node-actions')) {
    return
  }

  // 如果是拖拽操作，不处理点击
  if (isDragging.value) {
    return
  }

  // 新增：按住 Shift 键时，且该节点显示复选框，才切换选中状态
  if (hasSelectionCheckbox.value && event.shiftKey) {
    emit('node-select', props.node.id, props.node)
    return
  }

  if (props.config.selectable === 'single') {
    emit('node-select', String(props.node.id), props.node)
  }
  emit('node-click', props.node, event)
}

// 复选框切换：委托父组件处理选中集合
const isSelected = computed(() =>
  props.selectedNodes.has(String(props.node.id))
)
const toggleSelection = () => {
  emit('node-select', String(props.node.id), props.node)
}

// === 操作处理方法 ===

// 编辑节点（文件夹或书签）
const handleEdit = () => {
  // 顶级文件夹禁止编辑
  if (isFolder.value && props.level === 0) return
  emit('node-edit', props.node)
}

// 删除节点（文件夹或书签）
const handleDelete = () => {
  // 顶级文件夹禁止删除
  if (isFolder.value && props.level === 0) return
  emit('node-delete', props.node)
}

// 添加项到文件夹
const handleAddItem = () => {
  emit('folder-add', props.node)
}

// 在新标签页打开书签
const handleOpenInNewTab = () => {
  if (props.node.url) {
    emit('bookmark-open-new-tab', props.node)
  }
}

// 复制书签URL
const handleCopyUrl = async () => {
  if (props.node.url) {
    try {
      await navigator.clipboard.writeText(props.node.url)
      emit('bookmark-copy-url', props.node)
    } catch (error) {
      logger.error('复制URL失败:', error)
    }
  }
}

// === 拖拽处理方法 ===

// 处理拖拽悬停
const handleDragOver = (event: DragEvent) => {
  if (!props.config.draggable) return

  event.preventDefault()
  event.stopPropagation()

  // 设置允许拖放
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

// 处理拖拽进入
const handleDragEnter = (event: DragEvent) => {
  if (!props.config.draggable) return

  event.preventDefault()
  event.stopPropagation()

  isDragOver.value = true

  // 添加拖拽悬停样式
  const target = event.currentTarget as HTMLElement
  target.classList.add('drag-over')
}

// 处理拖拽离开
const handleDragLeave = (event: DragEvent) => {
  if (!props.config.draggable) return

  event.preventDefault()
  event.stopPropagation()

  // 只有当真正离开节点时才移除样式（防止子元素触发）
  const target = event.currentTarget as HTMLElement
  const relatedTarget = event.relatedTarget as HTMLElement

  if (!target.contains(relatedTarget)) {
    isDragOver.value = false
    target.classList.remove('drag-over')
  }
}

// 处理拖拽放置
const handleDrop = (event: DragEvent) => {
  if (!props.config.draggable) return

  event.preventDefault()
  event.stopPropagation()

  isDragOver.value = false

  // 移除拖拽样式
  const target = event.currentTarget as HTMLElement
  target.classList.remove('drag-over')

  try {
    // 获取拖拽数据
    const dragData = JSON.parse(
      event.dataTransfer?.getData('application/json') || '{}'
    )

    if (!dragData.nodeId) {
      logger.warn('❌ 无效的拖拽数据:', dragData)
      return
    }

    // 防止拖拽到自身
    if (dragData.nodeId === props.node.id) {
      logger.info('⚠️ 不能拖拽到自身')
      return
    }

    logger.info('📦 拖拽放置:', {
      from: dragData.nodeTitle,
      to: props.node.title,
      dragData,
      targetNode: props.node
    })

    // 确定放置位置
    const rect = target.getBoundingClientRect()
    const mouseY = event.clientY - rect.top
    const nodeHeight = rect.height

    let dropPosition: 'before' | 'after' | 'inside' = 'inside'

    if (isFolder.value) {
      // 文件夹：上1/3为before，中1/3为inside，下1/3为after
      if (mouseY < nodeHeight * 0.33) {
        dropPosition = 'before'
      } else if (mouseY > nodeHeight * 0.67) {
        dropPosition = 'after'
      } else {
        dropPosition = 'inside'
      }
    } else {
      // 书签：上半部分为before，下半部分为after
      dropPosition = mouseY < nodeHeight * 0.5 ? 'before' : 'after'
    }

    logger.info('🎯 放置位置:', dropPosition, { mouseY, nodeHeight })

    // 发送拖拽事件
    emit('drag-drop', dragData, props.node, dropPosition)
  } catch (error) {
    logger.error('❌ 处理拖拽放置失败:', error)
  }
}

// 处理拖拽开始
const handleDragStart = (event: DragEvent) => {
  if (!props.config.draggable) return

  logger.info('🎯 开始拖拽:', props.node.title)

  // 设置拖拽状态
  isDragging.value = true

  // 设置拖拽数据
  const dragData = {
    nodeId: props.node.id,
    nodeTitle: props.node.title,
    nodeUrl: props.node.url,
    isFolder: isFolder.value,
    parentId: props.node.parentId
  }

  event.dataTransfer?.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer?.setData('text/plain', props.node.title)

  // 设置拖拽效果
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
  }

  // 添加拖拽样式到整个节点
  const target = event.currentTarget as HTMLElement
  const nodeElement = target.closest('.simple-tree-node') as HTMLElement
  if (nodeElement) {
    nodeElement.classList.add('dragging')
  }
}

// 处理拖拽结束
const handleDragEnd = (event: DragEvent) => {
  logger.info('🏁 结束拖拽:', props.node.title)

  // 重置拖拽状态
  setTimeout(() => {
    isDragging.value = false
  }, 100) // 延迟重置，避免与点击事件冲突

  // 移除拖拽样式
  const target = event.currentTarget as HTMLElement
  const nodeElement = target.closest('.simple-tree-node') as HTMLElement
  if (nodeElement) {
    nodeElement.classList.remove('dragging')
  }
}

const handleFaviconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// === 工具函数 ===

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
</script>

<style scoped>
.simple-tree-node {
  position: relative;
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding: 4px var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  /* 避免几何动画：仅过渡背景与阴影 */
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  min-height: var(--item-height, 32px);
}

.node-content:hover {
  background: var(--color-surface-hover);
}

.node-content:active {
  background: var(--color-surface-active);
}

/* 可拖拽节点的样式 */
.node-content[draggable='true'] {
  cursor: grab;
}

.node-content[draggable='true']:active {
  cursor: grabbing;
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

/* 由 UI Checkbox 渲染样式，无需原生复选框尺寸 */

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

/* 书签URL */
.bookmark-url {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: var(--color-surface-variant);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-radius: var(--border-radius-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.bookmark-tags {
  display: flex;
  gap: var(--spacing-1);
  margin-left: var(--spacing-sm);
  flex-wrap: wrap;
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
  /* 🎯 确保操作按钮不会影响整行布局 */
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
  min-height: 28px;
  padding: var(--spacing-0-5) var(--spacing-1-5);
}

.node--compact .node-title {
  font-size: var(--text-sm);
}

.node--spacious .node-content {
  min-height: 40px;
  padding: var(--spacing-1-5) var(--spacing-3);
  gap: var(--spacing-sm);
}

.node--spacious .node-title {
  font-size: var(--text-base);
}

/* 层级样式 */
.node--level-0 .node-content {
  font-weight: 500;
}

/* 🎯 拖拽相关样式 */

/* 拖拽中的节点样式 */
.simple-tree-node.dragging {
  opacity: 0.6;
  z-index: 1000;
}

.simple-tree-node.dragging .node-content {
  background: var(--color-primary-subtle);
  border: 2px dashed var(--color-primary);
  border-radius: var(--border-radius-md);
  box-shadow: var(--md-sys-elevation-level3, 0 4px 12px rgba(0, 0, 0, 0.15));
}

/* 拖拽悬停目标样式 */
.simple-tree-node.node--drag-over .node-content {
  background: var(--color-success-subtle);
  border: 2px solid var(--color-success);
  border-radius: var(--border-radius-md);
  /* 以内描边/阴影增强反馈，避免缩放造成视觉位移 */
  box-shadow: 0 0 0 2px var(--color-success) inset;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

/* 拖拽放置区域指示 */
.simple-tree-node .node-content.drag-over {
  background: var(--color-success-subtle);
  border: 2px solid var(--color-success);
  border-radius: var(--border-radius-md);
  position: relative;
}

/* 拖拽插入位置指示线 */
.simple-tree-node .node-content.drag-over::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-success);
  border-radius: 1px;
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-standard);
}

.simple-tree-node .node-content.drag-over.drop-before::before {
  opacity: 1;
  top: -2px;
}

.simple-tree-node .node-content.drag-over::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-success);
  border-radius: 1px;
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-standard);
}

.simple-tree-node .node-content.drag-over.drop-after::after {
  opacity: 1;
  bottom: -2px;
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
