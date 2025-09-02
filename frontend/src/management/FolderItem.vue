<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
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
  return props.isTopLevel && builtInTitles.includes(props.node.title);
});

const sortableOptions = {
  group: 'bookmarks',
  handle: '.drag-handle',
  animation: 150,
  fallbackOnBody: true,
  swapThreshold: 0.65,
  ghostClass: 'ghost-item',
};

const handleDelete = (id: string) => emit('delete-bookmark', id);
const handleEdit = (node: any) => emit('edit-bookmark', node);
const handleReorder = () => emit('reorder');

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

const deleteFolder = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    emit('delete-folder', props.node);
}

const isExpanded = computed({
  get: () => {
    const isInExpandedSet = props.expandedFolders && props.expandedFolders.has(props.node.id);
    const nodeExpanded = props.node.expanded || false;

    console.log(`📁 Folder "${props.node.title}" (ID: ${props.node.id}) [${Date.now()}]:`);
    console.log(`   - expandedFolders size: ${props.expandedFolders ? props.expandedFolders.size : 'null'}`);
    console.log(`   - expandedFolders contents: ${props.expandedFolders ? Array.from(props.expandedFolders) : 'null'}`);
    console.log(`   - In expandedFolders: ${isInExpandedSet}`);
    console.log(`   - Node expanded: ${nodeExpanded}`);
    console.log(`   - Final result: ${isInExpandedSet || nodeExpanded}`);

    // If this folder is in the expanded set (auto-expansion), return true
    if (isInExpandedSet) {
      console.log(`   ✅ Auto-expanded: ${props.node.title}`);
      return true;
    }
    // Otherwise use the node's own expanded state
    console.log(`   📝 Using node state: ${props.node.title} = ${nodeExpanded}`);
    return nodeExpanded;
  },
  set: (value) => {
    console.log(`🔧 Manual toggle: ${props.node.title} -> ${value}`);
    props.node.expanded = value;
    // When user manually toggles, emit event for potential parent handling
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
        @dragstart.prevent.stop
        @drag.prevent.stop
      >
        <template v-slot:prepend>
          <v-icon v-if="isSortable && !isTopLevel && !isBuiltInTopLevel" size="small" class="drag-handle mr-2" style="cursor: grab;" @click.prevent.stop @dragstart.prevent.stop @drag.prevent.stop>mdi-grip-vertical</v-icon>
          <v-icon class="mr-2">{{ isOpen ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}</v-icon>
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
          <div v-if="!isBuiltInTopLevel" class="actions">
            <v-btn @click="addNewItem" icon="mdi-plus" size="x-small" variant="text" title="新增"></v-btn>
            <v-btn @click="startEditing" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
            <v-btn @click="deleteFolder" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
          </div>
        </template>
      </v-list-item>
    </template>
    <div class="nested-tree">
      <Sortable
        :list="node.children"
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
            @bookmark-hover="(id) => emit('bookmark-hover', id)"
            @scroll-to-bookmark="(element) => emit('scroll-to-bookmark', element)"
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
.folder-item:hover .actions,
.folder-item:hover .drag-handle {
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
.v-list-item--prepend > .v-icon {
    margin-inline-end: 12px;
}
.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>
