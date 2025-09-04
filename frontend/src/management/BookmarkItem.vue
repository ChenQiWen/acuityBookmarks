<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  node: any;
  isSortable?: boolean;
  isTopLevel?: boolean;
  searchQuery?: string;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'bookmark-hover', 'scroll-to-bookmark', 'copy-success', 'copy-failed', 'copy-loading']);

// Favicon cache to avoid repeated requests for the same domain
const faviconCache = new Map<string, string>();

// Copy loading state
const isCopying = ref(false);

const getFaviconUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const hostname = new URL(url).hostname;

    // Check cache first
    if (faviconCache.has(hostname)) {
      return faviconCache.get(hostname)!;
    }

    // Generate URL and cache it
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    faviconCache.set(hostname, faviconUrl);

    return faviconUrl;
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

  if (isCopying.value) return; // Prevent multiple clicks

  if (props.node.url) {
    isCopying.value = true;
    emit('copy-loading', true);

    try {
      // Simulate network delay for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      await navigator.clipboard.writeText(props.node.url);
      // Emit event to show success feedback
      emit('copy-success');
    } catch (error) {
      // Emit event to show failure feedback
      emit('copy-failed');
    } finally {
      isCopying.value = false;
      emit('copy-loading', false);
    }
  } else {
    // No URL to copy
    emit('copy-failed');
  }
};

const deleteBookmark = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  emit('delete-bookmark', props.node);
};

// Get bookmark ID from node
const bookmarkId = computed(() => {
  return props.node.uniqueId || '';
});

// Check if this bookmark should be highlighted
const isHighlighted = computed(() => {
  const highlighted = props.hoveredBookmarkId === bookmarkId.value;
  if (highlighted) {
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
    emit('bookmark-hover', bookmarkId.value);
  }
};

const handleMouseLeave = () => {
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
    @dragstart.prevent.stop
    @drag.prevent.stop
  >
    <template v-slot:prepend>
      <v-icon v-if="isSortable && !isOriginal" size="small" class="drag-handle mr-2" style="cursor: grab;" @click.prevent.stop @dragstart.prevent.stop @drag.prevent.stop>mdi-grip-vertical</v-icon>
      <v-icon v-if="isOriginal" size="small" class="drag-handle original-only mr-2" style="cursor: default; opacity: 0;">mdi-grip-vertical</v-icon>
      <v-avatar size="20" class="mr-2">
        <v-img :src="node.faviconUrl || getFaviconUrl(node.url)" alt="">
          <template v-slot:error>
            <v-icon size="small">mdi-bookmark-outline</v-icon>
          </template>
        </v-img>
      </v-avatar>
    </template>

    <v-list-item-title v-html="highlightedTitle"></v-list-item-title>

    <template v-slot:append>
      <div v-if="!isOriginal" class="actions">
        <v-btn @click="editBookmark" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
        <v-btn
          @click="copyLink"
          :icon="isCopying ? undefined : 'mdi-link-variant'"
          size="x-small"
          variant="text"
          :title="isCopying ? '复制中...' : '复制链接'"
          :loading="isCopying"
          :disabled="isCopying"
        >
          <template v-if="isCopying">复制中</template>
        </v-btn>
        <v-btn @click="deleteBookmark" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
      </div>
      <div v-if="isOriginal" class="actions original-only">
        <!-- 左侧面板的占位符，保持布局一致但不显示操作按钮 -->
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
/* 只在右侧面板显示操作按钮 */
.v-list-item:hover .actions:not(.original-only),
.v-list-item:hover .drag-handle:not(.original-only) {
  visibility: visible;
  opacity: 1;
}
.v-list-item--prepend > .v-avatar {
    margin-inline-end: 8px !important;
}

/* 拖拽手柄样式优化 */
.drag-handle {
  cursor: grab;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px;
  opacity: 0.6;
}

.drag-handle:hover {
  opacity: 1;
  color: #1976d2;
  background-color: rgba(25, 118, 210, 0.08);
}

.drag-handle:active {
  cursor: grabbing;
  color: #1565c0;
  background-color: rgba(21, 101, 192, 0.12);
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
