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
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder']);

const handleDelete = (id: string) => emit('delete-bookmark', id);
const handleEdit = (node: any) => emit('edit-bookmark', node);
const handleReorder = () => emit('reorder');

</script>

<template>
  <v-list dense class="py-0">
    <div v-for="node in nodes" :key="node.id">
      <FolderItem 
        v-if="node.children" 
        :node="node" 
        :is-proposal="isProposal"
        :is-sortable="isSortable"
        :is-top-level="isTopLevel"
        @delete-bookmark="handleDelete"
        @edit-bookmark="handleEdit"
        @reorder="handleReorder"
      />
      <BookmarkItem 
        v-else 
        :node="node" 
        :is-sortable="isSortable"
        :is-top-level="isTopLevel"
        :search-query="searchQuery"
        @delete-bookmark="handleDelete" 
        @edit-bookmark="handleEdit" 
      />
    </div>
  </v-list>
</template>
