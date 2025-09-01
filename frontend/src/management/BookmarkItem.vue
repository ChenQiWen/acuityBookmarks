<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  node: any;
  isSortable?: boolean;
  isTopLevel?: boolean;
  searchQuery?: string;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'bookmark-hover', 'scroll-to-bookmark']);

const getFaviconUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch (e) {
    return '';
  }
};

const editBookmark = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  emit('edit-bookmark', props.node);
};

const copyLink = async (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  if (props.node.url) {
    await navigator.clipboard.writeText(props.node.url);
    // Consider a less intrusive notification, like a temporary checkmark icon
  }
};

const deleteBookmark = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  if (confirm(`确定要删除书签 "${props.node.title}" 吗?`)) {
    emit('delete-bookmark', props.node.id);
  }
};

// Get bookmark ID from node
const bookmarkId = computed(() => {
  return props.node.uniqueId || '';
});

// Check if this bookmark should be highlighted
const isHighlighted = computed(() => {
  const highlighted = props.hoveredBookmarkId === bookmarkId.value;
  if (highlighted) {
    console.log('BookmarkItem isHighlighted:', bookmarkId.value, 'hoveredBookmarkId:', props.hoveredBookmarkId);
  }
  return highlighted;
});

const highlightedTitle = computed(() => {
  if (!props.searchQuery) {
    return props.node.title;
  }
  const regex = new RegExp(`(${props.searchQuery})`, 'gi');
  return props.node.title.replace(regex, '<mark>$1</mark>');
});

// Handle hover events
const handleMouseEnter = () => {
  if (props.node.url) {
    console.log('BookmarkItem mouseenter:', bookmarkId.value, 'node:', props.node);
    emit('bookmark-hover', bookmarkId.value);
  }
};

const handleMouseLeave = () => {
  console.log('BookmarkItem mouseleave');
  emit('bookmark-hover', null);
};
</script>

<template>
  <v-list-item
    :href="node.url"
    target="_blank"
    class="bookmark-item"
    :class="{ 'bookmark-highlighted': isHighlighted }"
    :data-bookmark-id="bookmarkId"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <template v-slot:prepend>
      <v-icon v-if="isSortable" size="small" class="drag-handle mr-2" style="cursor: move;" @click.prevent.stop>mdi-drag-horizontal-variant</v-icon>
      <v-avatar size="20" class="mr-3">
        <v-img :src="node.faviconUrl || getFaviconUrl(node.url)" alt="">
          <template v-slot:error>
            <v-icon size="small">mdi-bookmark-outline</v-icon>
          </template>
        </v-img>
      </v-avatar>
    </template>

    <v-list-item-title v-html="highlightedTitle"></v-list-item-title>

    <template v-slot:append>
      <div class="actions">
        <v-btn @click="editBookmark" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
        <v-btn @click="copyLink" icon="mdi-link-variant" size="x-small" variant="text" title="复制链接"></v-btn>
        <v-btn @click="deleteBookmark" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
      </div>
    </template>
  </v-list-item>
</template>

<style scoped>
.actions, .drag-handle {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}
.v-list-item:hover .actions,
.v-list-item:hover .drag-handle {
  visibility: visible;
  opacity: 1;
}
.v-list-item--prepend > .v-avatar {
    margin-inline-end: 12px;
}

/* 高亮样式 */
.bookmark-highlighted {
    background-color: rgba(255, 193, 7, 0.1) !important;
    border-left: 3px solid #ffc107 !important;
    transition: all 0.2s ease;
}

.bookmark-highlighted:hover {
    background-color: rgba(255, 193, 7, 0.15) !important;
}
</style>
