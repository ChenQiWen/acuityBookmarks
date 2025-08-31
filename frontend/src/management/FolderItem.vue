<script setup lang="ts">
import { ref, nextTick } from 'vue';
import BookmarkTree from './BookmarkTree.vue';

const props = defineProps<{
  node: any;
  isProposal?: boolean;
}>();

const emit = defineEmits(['delete-bookmark', 'delete-folder']);

const isEditing = ref(false);
const newTitle = ref(props.node.title);
const inputRef = ref<HTMLInputElement | null>(null);

const handleDelete = (id: string) => {
  emit('delete-bookmark', id);
};

const startEditing = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
  isEditing.value = true;
  newTitle.value = props.node.title;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
};

const finishEditing = () => {
  if (isEditing.value && newTitle.value.trim() && newTitle.value !== props.node.title) {
    // In a real app, you'd emit an event to update the state
    props.node.title = newTitle.value.trim();
  }
  isEditing.value = false;
};

const deleteFolder = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    alert(`功能待实现: 删除文件夹 "${props.node.title}"`);
}
</script>

<template>
  <v-list-group :value="node.id">
    <template v-slot:activator="{ props: activatorProps }">
      <v-list-item
        v-bind="activatorProps"
        prepend-icon="mdi-folder-outline"
        class="folder-item"
      >
        <v-list-item-title>
          <span v-if="!isEditing">{{ node.title || '未命名' }}</span>
          <input
            v-else
            ref="inputRef"
            v-model="newTitle"
            class="title-input"
            @blur="finishEditing"
            @keydown.enter="finishEditing"
            @click.stop.prevent
          />
        </v-list-item-title>

        <template v-slot:append>
          <div class="folder-actions">
            <v-btn @click="startEditing" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
            <v-btn @click="deleteFolder" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
          </div>
        </template>
      </v-list-item>
    </template>
    <BookmarkTree @delete-bookmark="handleDelete" :nodes="node.children" :is-proposal="isProposal" />
  </v-list-group>
</template>

<style scoped>
.folder-item {
  /* These variables are used by v-list-item to control its style */
  --v-list-item-padding-inline-end: 16px;
}

.folder-item .folder-actions {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.folder-item:hover .folder-actions {
  visibility: visible;
  opacity: 1;
}

.title-input {
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  width: 100%;
  border-bottom: 1px solid currentColor;
}
</style>
