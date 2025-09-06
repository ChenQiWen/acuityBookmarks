<script setup lang="ts">
import { ref, nextTick, computed, watchEffect } from 'vue';
import { logger } from '../utils/logger';
import { Sortable } from 'sortablejs-vue3';
import BookmarkTree from './BookmarkTree.vue';

const props = defineProps<{
  node: any;
  isProposal?: boolean;
  isSortable?: boolean;
  isTopLevel?: boolean;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
  expandedFolders?: Set<string>;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder', 'bookmark-hover', 'scroll-to-bookmark', 'folder-toggle', 'add-new-item', 'delete-folder']);

const isEditing = ref(false);
const newTitle = ref(props.node.title);
const inputRef = ref<HTMLInputElement | null>(null);

// 判断是否为浏览器内置的顶级书签容器
const isBuiltInTopLevel = computed(() => {
  // Chrome浏览器内置的顶级书签容器标题
  const builtInTitles = ['书签栏', '其他书签'];
  const result = props.isTopLevel && builtInTitles.includes(props.node.title);



  return result;
});

const sortableOptions = {
  group: 'bookmarks',
  handle: '.drag-handle',
  animation: 150,
  fallbackOnBody: true,
  swapThreshold: 0.65,
  ghostClass: 'ghost-item',
  onEnd: (event: any) => {
    // 拖拽结束后立即触发重新排序
    handleReorder(event);
  }
};

const handleDelete = (payload: any) => emit('delete-bookmark', payload);
const handleEdit = (node: any) => emit('edit-bookmark', node);
const handleReorder = (event?: any) => {
  emit('reorder', event);
};

const addNewItem = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
  emit('add-new-item', props.node);
};

const startEditing = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
  isEditing.value = true;
  newTitle.value = props.node.title;
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    }
  });
};

const finishEditing = () => {
  if (isEditing.value && newTitle.value.trim() && newTitle.value !== props.node.title) {
    props.node.title = newTitle.value.trim();
  }
  isEditing.value = false;
};

const deleteFolder = () => {
    console.log('FolderItem: 删除文件夹被点击', props.node.title);
    emit('delete-folder', props.node);
}

// 本地可响应的展开状态：解决在非响应式 node.expanded 上切换无效的问题
const expandedState = ref<boolean>(false);
watchEffect(() => {
  const auto = props.expandedFolders && props.expandedFolders.has(props.node.id);
  const nodeExpanded = !!props.node.expanded;
  expandedState.value = auto || nodeExpanded || expandedState.value;
  try {
    logger.info('FolderItem', 'render', props.node.title, 'auto:', !!auto, 'nodeExpanded:', nodeExpanded, 'expandedState:', expandedState.value, 'children:', Array.isArray(props.node.children) ? props.node.children.length : 0);
  } catch {}
});

const isExpanded = computed({
  get: () => expandedState.value,
  set: (value) => {
    expandedState.value = value;
    // 同步回节点，兼容外部可能读取
    props.node.expanded = value;
    try {
      logger.info('FolderItem', 'toggle', props.node.title, '=>', value, 'children:', Array.isArray(props.node.children) ? props.node.children.length : 0);
    } catch {}
    emit('folder-toggle', { nodeId: props.node.id, expanded: value });
  }
});


</script>

<template>
  <v-list-group v-model="isExpanded">
    <template v-slot:activator="{ props: activatorProps, isOpen }">
      <v-list-item
        v-bind="activatorProps"
        class="folder-item"
        :class="{ 'folder-item-top-level': isTopLevel || isBuiltInTopLevel }"
        :data-native-id="node && node.id ? String(node.id) : undefined"
        @click.stop="isExpanded = !isExpanded"
        @dragstart.prevent.stop
        @drag.prevent.stop
      >
        <template v-slot:prepend>
          <v-icon v-if="isSortable && !isTopLevel && !isBuiltInTopLevel && !isOriginal" size="small" class="drag-handle" style="cursor: grab;" @click.prevent.stop @dragstart.prevent.stop @drag.prevent.stop>mdi-grip-vertical</v-icon>
          <v-icon v-if="isOriginal && isSortable && !isTopLevel && !isBuiltInTopLevel" size="small" class="drag-handle original-only" style="cursor: default; opacity: 0;">mdi-grip-vertical</v-icon>
          <v-icon>{{ isOpen ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}</v-icon>
        </template>
        <v-list-item-title>
          <span v-if="!isEditing">{{ node.title || '未命名' }}</span>
          <input
            v-else
            ref="inputRef"
            v-model="newTitle"
            class="title-input"
            @blur="finishEditing"
            @keydown.enter="finishEditing"
            @click.stop.prevent
          />
        </v-list-item-title>

        <template v-slot:append>


          <div v-if="!isBuiltInTopLevel && !isOriginal" class="actions">
            <v-btn @click.stop.prevent="addNewItem" icon="mdi-plus" size="x-small" variant="text" title="新增"></v-btn>
            <v-btn @click.stop.prevent="startEditing" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
            <v-btn @click.stop.prevent="deleteFolder" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
          </div>
          <div v-if="!isBuiltInTopLevel && isOriginal" class="actions original-only">
            <!-- 左侧面板的占位符，保持布局一致但不显示操作按钮 -->
          </div>
        </template>
      </v-list-item>
    </template>
    <div class="nested-tree" :key="`children-${node.id}`">
      <!-- 非可拖拽模式下，直接渲染子节点，避免 Sortable 影响展开渲染 -->
      <template v-if="isExpanded && !isSortable">
        <div v-for="childNode in (node.children || [])" :key="childNode.id">
          <BookmarkTree
            @delete-bookmark="handleDelete"
            @edit-bookmark="handleEdit"
            @reorder="handleReorder"
            :nodes="[childNode]"
            :is-proposal="isProposal"
            :is-sortable="isSortable"
            :hovered-bookmark-id="hoveredBookmarkId"
            :is-original="isOriginal"
            :expanded-folders="expandedFolders"
            @bookmark-hover="(payload: any) => emit('bookmark-hover', payload)"
            @scroll-to-bookmark="(element: Element) => emit('scroll-to-bookmark', element)"
          />
        </div>
      </template>

      <!-- 可拖拽模式保留 Sortable -->
      <Sortable
        v-else-if="isExpanded && isSortable"
        :key="`sortable-${node.id}`"
        :list="node.children || []"
        item-key="id"
        tag="div"
        :options="sortableOptions"
        :disabled="!isSortable"
        @end="handleReorder"
      >
        <template #item="{ element: childNode }">
          <BookmarkTree
            :key="(childNode as any).id"
            @delete-bookmark="handleDelete"
            @edit-bookmark="handleEdit"
            @reorder="handleReorder"
            :nodes="[childNode as any]"
            :is-proposal="isProposal"
            :is-sortable="isSortable"
            :hovered-bookmark-id="hoveredBookmarkId"
            :is-original="isOriginal"
            :expanded-folders="expandedFolders"
            @bookmark-hover="(payload: any) => emit('bookmark-hover', payload)"
            @scroll-to-bookmark="(element: Element) => emit('scroll-to-bookmark', element)"
          />
        </template>
      </Sortable>
    </div>
  </v-list-group>
</template>

<style scoped>
.actions, .drag-handle {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}
/* 只在右侧面板显示操作按钮 */
.folder-item:hover .actions:not(.original-only),
.folder-item:hover .drag-handle:not(.original-only) {
  visibility: visible;
  opacity: 1;
}

/* PC浏览器优化 - 增强交互体验 */
.folder-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.folder-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* 优化拖拽手柄的交互 */
.drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease, color 0.2s ease;
  border-radius: 4px;
  padding: 2px;
}

.drag-handle:hover {
  color: #1976d2;
  background-color: rgba(25, 118, 210, 0.08);
}

.drag-handle:active {
  cursor: grabbing;
  color: #1565c0;
  background-color: rgba(21, 101, 192, 0.12);
}
.nested-tree {
  padding-left: 16px;
  max-height: none; /* 移除高度限制，让内容自然展开 */
  min-height: auto; /* 自动最小高度 */
  overflow: visible; /* 让内容自然展开，不产生额外滚动条 */
  overflow-x: hidden;
  transition: max-height 0.3s ease; /* 平滑展开过渡 */
}

/* 确保v-list-group展开时内容自然展开 */
:deep(.v-list-group__items) {
  overflow: visible !important;
  max-height: none !important;
}

/* 优化列表项的间距 */
:deep(.v-list-item) {
  min-height: 36px !important;
  padding: 8px 16px !important;
}

/* 优化嵌套列表的样式 */
:deep(.v-list) {
  background: transparent !important;
}

/* 移除嵌套滚动条样式，统一由父容器管理滚动 */

/* PC浏览器优化 - 提供最佳桌面体验 */
.title-input {
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  width: 100%;
  border-bottom: 1px solid currentColor;
}
/* Grid布局间距调整 */
:deep(.v-list-item) {
    gap: 4px !important;
    column-gap: 4px !important;
    grid-column-gap: 4px !important;
}

/* 控制prepend容器宽度 - 默认适合有拖拽手柄的情况 */
:deep(.v-list-item__prepend),
:deep(.v-list-item--prepend) {
    width: auto !important;
    min-width: auto !important;
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
}

/* 顶级文件夹（只有单个图标）的特殊处理 */
.folder-item-top-level :deep(.v-list-item__prepend),
.folder-item-top-level :deep(.v-list-item--prepend) {
    width: 24px !important;
    min-width: 24px !important;
}

/* 控制文件夹icon大小 */
:deep(.v-list-item__prepend .v-icon),
:deep(.v-list-item--prepend .v-icon) {
    width: 20px !important;
    height: 20px !important;
    font-size: 20px !important;
    margin: 0 !important;
}

/* 控制拖拽手柄大小 */
:deep(.v-list-item__prepend .drag-handle),
:deep(.v-list-item--prepend .drag-handle) {
    width: 16px !important;
    height: 16px !important;
    margin: 0 !important;
}
.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>
