<script setup lang="ts">
import { ref } from 'vue';

// Define the props for the component
defineProps<{
  nodes: chrome.bookmarks.BookmarkTreeNode[] | any[]; // Use any[] for proposal nodes
  isProposal?: boolean;
}>();

// A recursive component needs a name
defineOptions({
  name: 'BookmarkTree'
});

// State for managing folder collapse/expand
const collapsedFolders = ref<Record<string, boolean>>({});

const toggleFolder = (id: string) => {
  collapsedFolders.value[id] = !collapsedFolders.value[id];
};

const getFaviconUrl = (url: string | undefined) => {
  if (!url) return '/images/icon16.png';
  // Use Google's favicon service as a fallback
  return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=16`;
};
</script>

<template>
  <ul class="bookmark-tree">
    <li v-for="node in nodes" :key="node.id">
      <!-- If it's a folder -->
      <div v-if="node.children" class="folder-container">
        <div class="folder-header" @click="toggleFolder(node.id)">
          <i class="material-icons">
            {{ collapsedFolders[node.id] ? 'folder' : 'folder_open' }}
          </i>
          <span class="folder-title">{{ node.title || '未命名' }}</span>
        </div>
        <BookmarkTree 
          v-if="!collapsedFolders[node.id]" 
          :nodes="node.children" 
          :is-proposal="isProposal" 
        />
      </div>

      <!-- If it's a bookmark -->
      <div v-else class="bookmark-item">
        <img :src="getFaviconUrl(node.url)" class="favicon" alt="">
        <a :href="node.url" target="_blank" class="bookmark-title" :title="node.title">
          {{ node.title }}
        </a>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.bookmark-tree {
  list-style: none;
  padding-left: 20px;
  margin: 8px 0;
  font-size: 14px;
}

.folder-container {
  margin: 4px 0;
}

.folder-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}
.folder-header:hover {
  background-color: #f1ecf4;
}
.folder-header i {
  margin-right: 8px;
  color: #2962ff;
}
.folder-title {
  font-weight: 500;
}

.bookmark-item {
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}
.bookmark-item:hover {
  background-color: #f1ecf4;
}
.favicon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  flex-shrink: 0;
}
.bookmark-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #49454f;
  text-decoration: none;
}
.bookmark-title:hover {
  text-decoration: underline;
}
</style>
