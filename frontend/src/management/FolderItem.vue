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

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder', 'bookmark-hover', 'scroll-to-bookmark', 'folder-toggle']);

const isEditing = ref(false);
const newTitle = ref(props.node.title);
const inputRef = ref<HTMLInputElement | null>(null);

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
    alert(`功能待实现: 删除文件夹 "${props.node.title}"`);
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
      >
        <template v-slot:prepend>
          <v-icon v-if="isSortable && !isTopLevel" size="small" class="drag-handle mr-2" style="cursor: move;" @click.prevent.stop>mdi-drag-horizontal-variant</v-icon>
          <v-icon class="mr-1">{{ isOpen ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}</v-icon>
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
          <div class="actions">
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
}

.drag-handle:hover {
  color: #1976d2;
}

.drag-handle:active {
  cursor: grabbing;
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
  padding: 4px 16px !important;
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
