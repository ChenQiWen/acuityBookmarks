<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  node: any;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark']);

const isHovering = ref(false);

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
    alert('链接已复制!');
  }
};

const deleteBookmark = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  if (confirm(`确定要删除书签 "${props.node.title}" 吗?`)) {
    emit('delete-bookmark', props.node.id);
  }
};
</script>

<template>
  <v-list-item
    :href="node.url"
    target="_blank"
    @mouseover="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <template v-slot:prepend>
      <v-icon size="small">mdi-bookmark-outline</v-icon>
    </template>

    <v-list-item-title v-text="node.title"></v-list-item-title>

    <template v-slot:append>
      <div 
        class="bookmark-actions" 
        :style="{
          visibility: isHovering ? 'visible' : 'hidden',
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out'
        }"
      >
        <v-btn @click="editBookmark" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
        <v-btn @click="copyLink" icon="mdi-link-variant" size="x-small" variant="text" title="复制链接"></v-btn>
        <v-btn @click="deleteBookmark" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
      </div>
    </template>
  </v-list-item>
</template>
