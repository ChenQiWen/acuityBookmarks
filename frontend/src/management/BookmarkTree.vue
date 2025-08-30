<script setup lang="ts">
// Define the props for the component
defineProps<{
  nodes: any[]; // Using any[] to accommodate both chrome bookmarks and proposal nodes
  isProposal?: boolean;
}>();

// A recursive component needs a name
defineOptions({
  name: 'BookmarkTree'
});
</script>

<template>
  <v-list dense>
    <template v-for="node in nodes" :key="node.id">
      <!-- If it's a folder, use v-list-group -->
      <v-list-group v-if="node.children" :value="node.id">
        <template v-slot:activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-folder-outline"
            :title="node.title || '未命名'"
          ></v-list-item>
        </template>
        <!-- Recursively call the component for children -->
        <BookmarkTree :nodes="node.children" :is-proposal="isProposal" />
      </v-list-group>

      <!-- If it's a bookmark, use v-list-item -->
      <v-list-item v-else :href="node.url" target="_blank" class="bookmark-item">
        <template v-slot:prepend>
          <v-icon size="small">mdi-bookmark-outline</v-icon>
        </template>
        <v-list-item-title v-text="node.title"></v-list-item-title>
        <template v-slot:append>
          <div class="bookmark-actions">
            <v-btn icon="mdi-pencil" size="x-small" variant="text"></v-btn>
            <v-btn icon="mdi-link-variant" size="x-small" variant="text"></v-btn>
            <v-btn icon="mdi-open-in-new" size="x-small" variant="text"></v-btn>
          </div>
        </template>
      </v-list-item>
    </template>
  </v-list>
</template>

<style scoped>
/* Reduce padding for nested lists */
.v-list-group {
  --v-list-item-padding-inline-start: 16px;
}

.bookmark-item .bookmark-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
}

.bookmark-item:hover .bookmark-actions {
  opacity: 1;
  pointer-events: auto;
}
</style>
