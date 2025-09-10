<script setup lang="ts">
import { useManagementStore } from '../stores/management-store'
import FolderItem from './FolderItem.vue';
import BookmarkItem from './BookmarkItem.vue';
import type { BookmarkNode, BookmarkHoverPayload } from '../types'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

// A recursive component needs a name
defineOptions({
  name: 'BookmarkTree'
});

defineProps<{
  nodes: BookmarkNode[];
  isProposal?: boolean;
  isSortable?: boolean;
  isTopLevel?: boolean;
  searchQuery?: string;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
  expandedFolders?: Set<string>;
  cleanupMode?: boolean;
}>();

// 注意：不再使用emit事件，直接使用store actions
// const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder', 'bookmark-hover', 'scroll-to-bookmark', 'folder-toggle', 'copy-success', 'copy-failed', 'add-new-item', 'delete-folder']);

// 使用store actions代替 emit 事件透传
const handleDelete = (payload: BookmarkNode) => managementStore.deleteBookmark(payload);
const handleEdit = (node: BookmarkNode) => managementStore.editBookmark(node);
const handleReorder = () => managementStore.handleReorder();

</script>

<template>
  <v-list dense class="py-0">
    <div v-for="node in nodes" :key="node.id">
      
      <FolderItem
        v-if="Array.isArray(node.children)"
        :node="node"
        :is-proposal="isProposal"
        :is-sortable="isSortable"
        :is-top-level="isTopLevel"
        :hovered-bookmark-id="hoveredBookmarkId"
        :is-original="isOriginal"
        :expanded-folders="expandedFolders"
        :cleanup-mode="cleanupMode"
        @delete-bookmark="handleDelete"
        @edit-bookmark="handleEdit"
        @reorder="handleReorder"
        @bookmark-hover="(payload: BookmarkHoverPayload) => managementStore.setBookmarkHover(payload)"
        @scroll-to-bookmark="() => {/* scroll功能由父组件处理 */}"
        @add-new-item="(node: BookmarkNode) => managementStore.addNewItem(node)"
        @delete-folder="(node: BookmarkNode) => managementStore.deleteFolder(node)"
      />
      <BookmarkItem
        v-else
        :node="node"
        :is-sortable="isSortable"
        :is-top-level="isTopLevel"
        :search-query="searchQuery"
        :hovered-bookmark-id="hoveredBookmarkId"
        :is-original="isOriginal"
        :cleanup-mode="cleanupMode"
        @delete-bookmark="handleDelete"
        @edit-bookmark="handleEdit"
        @bookmark-hover="(payload: BookmarkHoverPayload) => managementStore.setBookmarkHover(payload)"
        @scroll-to-bookmark="() => {/* scroll功能由父组件处理 */}"
        @copy-success="() => managementStore.handleCopySuccess()"
        @copy-failed="() => managementStore.handleCopyFailed()"
      />
    </div>
  </v-list>
</template>
