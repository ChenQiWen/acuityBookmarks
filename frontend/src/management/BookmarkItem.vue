<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  node: any;
  isSortable?: boolean;
  isTopLevel?: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark']);

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

const highlightedTitle = computed(() => {
  if (!props.searchQuery) {
    return props.node.title;
  }
  const regex = new RegExp(`(${props.searchQuery})`, 'gi');
  return props.node.title.replace(regex, '<mark>$1</mark>');
});
</script>

<template>
  <v-list-item
    :href="node.url"
    target="_blank"
    class="bookmark-item"
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
</style>
