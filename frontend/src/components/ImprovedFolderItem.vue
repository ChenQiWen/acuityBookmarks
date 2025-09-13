<!--
🚀 改进版文件夹组件
采用不可变数据更新模式，解决数据同步问题
-->

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useImprovedBookmarkStore } from '../stores/improved-bookmark-store';
import { Icon, Button } from './ui';
import type { BookmarkNode } from '../types';

const props = defineProps<{
  node: BookmarkNode
  isOriginal?: boolean
}>();

// 🏪 使用改进版状态管理
const bookmarkStore = useImprovedBookmarkStore();

// 🎯 本地状态
const isEditing = ref(false);
const newTitle = ref(props.node.title);

// 🧮 计算属性
const canEdit = computed(() => !props.isOriginal);
const hasChanges = computed(() => bookmarkStore.hasChanges);

// 📝 编辑相关方法
const inputRef = ref<HTMLInputElement | null>(null);

const startEditing = () => {
  if (!canEdit.value) return;
  
  isEditing.value = true;
  newTitle.value = props.node.title;
  
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    }
  });
  
  console.log('📝 开始编辑:', {
    nodeId: props.node.id,
    currentTitle: props.node.title
  });
};

const finishEditing = async () => {
  if (!isEditing.value) return;
  
  const trimmedTitle = newTitle.value.trim();
  
  if (trimmedTitle && trimmedTitle !== props.node.title) {
    console.log('💾 保存编辑:', {
      nodeId: props.node.id,
      oldTitle: props.node.title,
      newTitle: trimmedTitle
    });
    
    try {
      // 🎯 使用统一的状态更新方法
      await bookmarkStore.updateNodeTitle(props.node.id, trimmedTitle);
      console.log('✅ 标题更新成功');
    } catch (error) {
      console.error('❌ 标题更新失败:', error);
      // 恢复原始值
      newTitle.value = props.node.title;
    }
  }
  
  isEditing.value = false;
};

const cancelEditing = () => {
  isEditing.value = false;
  newTitle.value = props.node.title;
  console.log('❌ 取消编辑');
};

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    finishEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
};

// 🗑️ 删除方法
const deleteFolder = async () => {
  if (!canEdit.value) return;
  
  const confirmed = confirm(`确定要删除文件夹"${props.node.title}"吗？`);
  if (!confirmed) return;
  
  try {
    console.log('🗑️ 删除文件夹:', props.node.id);
    await bookmarkStore.removeNode(props.node.id);
    console.log('✅ 文件夹删除成功');
  } catch (error) {
    console.error('❌ 文件夹删除失败:', error);
  }
};

// 🎯 拖拽处理（简化版）
const handleDragStart = (event: DragEvent) => {
  if (!canEdit.value) return;
  
  event.dataTransfer?.setData('text/plain', props.node.id);
  console.log('🎯 开始拖拽:', props.node.id);
};

const handleDrop = async (event: DragEvent) => {
  if (!canEdit.value) return;
  
  event.preventDefault();
  const draggedNodeId = event.dataTransfer?.getData('text/plain');
  
  if (draggedNodeId && draggedNodeId !== props.node.id) {
    console.log('📥 处理拖拽放置:', {
      draggedNodeId,
      targetNodeId: props.node.id
    });
    
    // 这里需要实现具体的重排序逻辑
    // 为了简化，暂时只记录日志
  }
};

// 🔍 调试方法
const debugNodeState = () => {
  console.group('🔍 节点状态调试');
  console.log('📊 节点数据:', props.node);
  console.log('📝 编辑状态:', isEditing.value);
  console.log('🏪 Store状态:', {
    hasChanges: bookmarkStore.hasChanges,
    lastUpdate: bookmarkStore.lastUpdateTime
  });
  console.groupEnd();
};

// 开发模式下暴露调试方法
if (import.meta.env.DEV) {
  (window as any).debugNodeState = debugNodeState;
}
</script>

<template>
  <div 
    class="folder-item"
    :class="{ 
      'folder-item--editing': isEditing,
      'folder-item--readonly': !canEdit,
      'folder-item--has-changes': hasChanges 
    }"
    :draggable="canEdit"
    @dragstart="handleDragStart"
    @drop="handleDrop"
    @dragover.prevent
  >
    <!-- 📁 文件夹图标 -->
    <div class="folder-item__icon">
      <Icon name="mdi-folder-outline" color="primary" size="md" />
    </div>

    <!-- 📝 标题编辑区域 -->
    <div class="folder-item__title">
      <!-- 显示模式 -->
      <span 
        v-if="!isEditing"
        class="folder-item__title-display"
        @dblclick="startEditing"
      >
        {{ node.title }}
      </span>

      <!-- 编辑模式 -->
      <div v-if="isEditing" class="folder-item__title-edit">
        <input
          ref="inputRef"
          v-model="newTitle"
          type="text"
          class="folder-item__input"
          @blur="finishEditing"
          @keydown="handleKeydown"
        />
      </div>
    </div>

    <!-- 🎛️ 操作按钮 -->
    <div v-if="canEdit" class="folder-item__actions">
      <Button
        v-if="!isEditing"
        icon="mdi-pencil"
        size="sm"
        variant="text"
        @click="startEditing"
        :title="'重命名'"
      />
      
      <Button
        v-if="!isEditing"
        icon="mdi-delete-outline"
        size="sm"
        variant="text"
        color="error"
        @click="deleteFolder"
        :title="'删除'"
      />

      <!-- 调试按钮（仅开发模式） -->
      <Button
        v-if="import.meta.env.DEV"
        icon="mdi-bug-outline"
        size="sm"
        variant="text"
        @click="debugNodeState"
        :title="'调试状态'"
      />
    </div>

    <!-- 📊 状态指示器 -->
    <div class="folder-item__status">
      <span
        v-if="hasChanges"
        class="folder-item__status-chip"
      >
        有更改
      </span>
    </div>
  </div>
</template>

<style scoped>
.folder-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  gap: 8px;
}

.folder-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.folder-item--editing {
  background-color: rgba(33, 150, 243, 0.08);
}

.folder-item--readonly {
  opacity: 0.7;
}

.folder-item--has-changes {
  border-left: 3px solid #ff9800;
}

.folder-item__icon {
  flex-shrink: 0;
}

.folder-item__title {
  flex: 1;
  min-width: 0;
}

.folder-item__title-display {
  cursor: pointer;
  display: block;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.folder-item__title-display:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.folder-item__title-edit {
  width: 100%;
}

.folder-item__input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  line-height: var(--line-height-normal);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.folder-item__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha-10);
}

.folder-item__actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.folder-item:hover .folder-item__actions {
  opacity: 1;
}

.folder-item__status {
  flex-shrink: 0;
}

.folder-item__status-chip {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-warning);
  color: var(--color-surface);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-full);
  line-height: 1;
}

/* 🎯 拖拽样式 */
.folder-item[draggable="true"] {
  cursor: grab;
}

.folder-item[draggable="true"]:active {
  cursor: grabbing;
}
</style>
