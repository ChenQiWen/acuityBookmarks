<script setup lang="ts">
import FolderItem from './FolderItem.vue';
import BookmarkItem from './BookmarkItem.vue';

// A recursive component needs a name
defineOptions({
  name: 'BookmarkTree'
});

defineProps<{
  nodes: any[];
  isProposal?: boolean;
  isSortable?: boolean;
  isTopLevel?: boolean;
  searchQuery?: string;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
  expandedFolders?: Set<string>;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder', 'bookmark-hover', 'scroll-to-bookmark', 'folder-toggle', 'copy-success', 'copy-failed', 'add-new-item', 'delete-folder']);

const handleDelete = (id: string) => emit('delete-bookmark', id);
const handleEdit = (node: any) => emit('edit-bookmark', node);
const handleReorder = () => emit('reorder');

</script>

<template>
  <v-list dense class="py-0">
    <div v-for="node in nodes" :key="node.id">
      <FolderItem
        v-if="node.children && node.children.length > 0"
        :node="node"
        :is-proposal="isProposal"
        :is-sortable="isSortable"
        :is-top-level="isTopLevel"
        :hovered-bookmark-id="hoveredBookmarkId"
        :is-original="isOriginal"
        :expanded-folders="expandedFolders"
        @delete-bookmark="handleDelete"
        @edit-bookmark="handleEdit"
        @reorder="handleReorder"
        @bookmark-hover="(payload) => emit('bookmark-hover', payload)"
        @scroll-to-bookmark="(element) => emit('scroll-to-bookmark', element)"
        @folder-toggle="(data) => emit('folder-toggle', data)"
        @add-new-item="(node) => emit('add-new-item', node)"
        @delete-folder="(node) => emit('delete-folder', node)"
      />
      <BookmarkItem
        v-else
        :node="node"
        :is-sortable="isSortable"
        :is-top-level="isTopLevel"
        :search-query="searchQuery"
        :hovered-bookmark-id="hoveredBookmarkId"
        :is-original="isOriginal"
        @delete-bookmark="handleDelete"
        @edit-bookmark="handleEdit"
        @bookmark-hover="(payload) => emit('bookmark-hover', payload)"
        @scroll-to-bookmark="(element) => emit('scroll-to-bookmark', element)"
        @copy-success="() => emit('copy-success')"
        @copy-failed="() => emit('copy-failed')"
      />
    </div>
  </v-list>
</template>
