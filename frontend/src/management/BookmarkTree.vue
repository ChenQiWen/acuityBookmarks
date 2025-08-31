<script setup lang="ts">
import BookmarkItem from './BookmarkItem.vue';
import FolderItem from './FolderItem.vue';

// Define the props for the component
defineProps<{
  nodes: any[]; // Using any[] to accommodate both chrome bookmarks and proposal nodes
  isProposal?: boolean;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark']);

const handleDelete = (id: string) => {
  emit('delete-bookmark', id);
};

const handleEdit = (node: any) => {
  emit('edit-bookmark', node);
}

// A recursive component needs a name
defineOptions({
  name: 'BookmarkTree'
});
</script>

<template>
  <v-list dense>
    <template v-for="node in nodes" :key="node.id">
      <!-- If it's a folder, use the new FolderItem component -->
      <FolderItem 
        v-if="node.children" 
        :node="node" 
        :is-proposal="isProposal"
        @delete-bookmark="handleDelete"
        @edit-bookmark="handleEdit"
      />

      <!-- If it's a bookmark, use the BookmarkItem component -->
      <BookmarkItem 
        v-else 
        :node="node" 
        @delete-bookmark="handleDelete" 
        @edit-bookmark="handleEdit"
      />
    </template>
  </v-list>
</template>

<style scoped>
/* Reduce padding for nested lists */
.v-list-group {
  --v-list-item-padding-inline-start: 16px;
}
</style>
