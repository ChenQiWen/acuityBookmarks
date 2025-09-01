<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { Sortable } from 'sortablejs-vue3';
import BookmarkTree from './BookmarkTree.vue';

const props = defineProps<{
  node: any;
  isProposal?: boolean;
  isSortable?: boolean;
  isTopLevel?: boolean;
}>();

const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder']);

const isEditing = ref(false);
const newTitle = ref(props.node.title);
const inputRef = ref<HTMLInputElement | null>(null);

const sortableOptions = {
  group: 'bookmarks',
  handle: '.drag-handle',
  animation: 150,
  fallbackOnBody: true,
  swapThreshold: 0.65,
  ghostClass: 'ghost-item',
};

const handleDelete = (id: string) => emit('delete-bookmark', id);
const handleEdit = (node: any) => emit('edit-bookmark', node);
const handleReorder = () => emit('reorder');

const startEditing = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
  isEditing.value = true;
  newTitle.value = props.node.title;
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    }
  });
};

const finishEditing = () => {
  if (isEditing.value && newTitle.value.trim() && newTitle.value !== props.node.title) {
    props.node.title = newTitle.value.trim();
  }
  isEditing.value = false;
};

const deleteFolder = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    alert(`功能待实现: 删除文件夹 "${props.node.title}"`);
}

const isExpanded = computed({
  get: () => props.node.expanded,
  set: (value) => {
    props.node.expanded = value;
  }
});
</script>

<template>
  <v-list-group v-model="isExpanded">
    <template v-slot:activator="{ props: activatorProps, isOpen }">
      <v-list-item
        v-bind="activatorProps"
        class="folder-item"
      >
        <template v-slot:prepend>
          <v-icon v-if="isSortable && !isTopLevel" size="small" class="drag-handle mr-2" style="cursor: move;" @click.prevent.stop>mdi-drag-horizontal-variant</v-icon>
          <v-icon class="mr-1">{{ isOpen ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}</v-icon>
        </template>
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
          <div class="actions">
            <v-btn @click="startEditing" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
            <v-btn @click="deleteFolder" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
          </div>
        </template>
      </v-list-item>
    </template>
    <div class="nested-tree">
      <Sortable
        :list="node.children"
        item-key="id"
        tag="div"
        :options="sortableOptions"
        :disabled="!isSortable"
        @end="handleReorder"
      >
        <template #item="{ element: childNode }">
          <BookmarkTree 
            :key="childNode.id"
            @delete-bookmark="handleDelete" 
            @edit-bookmark="handleEdit"
            @reorder="handleReorder"
            :nodes="[childNode]" 
            :is-proposal="isProposal" 
            :is-sortable="isSortable"
          />
        </template>
      </Sortable>
    </div>
  </v-list-group>
</template>

<style scoped>
.actions, .drag-handle {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}
.folder-item:hover .actions,
.folder-item:hover .drag-handle {
  visibility: visible;
  opacity: 1;
}
.nested-tree {
  padding-left: 16px;
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
.v-list-item--prepend > .v-icon {
    margin-inline-end: 12px;
}
.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>
