<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { useManagementStore } from '../stores/management-store';
import { Sortable } from 'sortablejs-vue3';
import BookmarkTree from './BookmarkTree.vue';
import { List, Icon, Button } from '../components/ui';
import type { BookmarkNode, BookmarkHoverPayload, FolderToggleData, ReorderEvent } from '../types';

// === 使用 Pinia Store ===
const managementStore = useManagementStore();

// 解构响应式状态
// const { proposalExpandedFolders } = storeToRefs(managementStore) // 暂时未使用

const props = defineProps<{
  node: BookmarkNode;
  isProposal?: boolean;
  isSortable?: boolean;
  isTopLevel?: boolean;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
  expandedFolders?: Set<string>;
  cleanupMode?: boolean;
}>();

// 注意：不再使用emit事件，直接使用store actions
// const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'reorder', 'bookmark-hover', 'scroll-to-bookmark', 'folder-toggle', 'add-new-item', 'delete-folder']);

const isEditing = ref(false);
const newTitle = ref(props.node.title);
const inputRef = ref<HTMLInputElement | null>(null);

// 判断是否为浏览器内置的顶级书签容器
const isBuiltInTopLevel = computed(() => {
  // Chrome浏览器内置的顶级书签容器标题
  const builtInTitles = ['书签栏', '其他书签'];
  const result = props.isTopLevel && builtInTitles.includes(props.node.title);
  return result;
});

const sortableOptions = {
  group: 'bookmarks',
  handle: '.drag-handle',
  animation: 150,
  fallbackOnBody: true,
  swapThreshold: 0.65,
  ghostClass: 'ghost-item',
  onEnd: (event: any) => {
    console.log('🎯 Sortable onEnd 事件触发:', {
      oldIndex: event.oldIndex,
      newIndex: event.newIndex,
      from: event.from,
      to: event.to,
      item: event.item
    });

    // 🎯 获取拖拽的元素信息
    const draggedElement = event.item;
    const draggedId = draggedElement?.getAttribute('data-native-id');
    
    if (!draggedId) {
      console.error('❌ 无法获取拖拽元素的ID');
      return;
    }

    // 🎯 真正的重排序逻辑：同步 Vue 数据结构与 DOM 顺序
    const reorderChildren = () => {
      const store = managementStore;
      const currentChildren = store.newProposalTree.children || [];
      
      // 找到被拖拽的节点
      let draggedNode: BookmarkNode | null = null;
      const parentChildren: BookmarkNode[] = currentChildren;
      
      // 先从当前层级移除拖拽的节点
      for (let i = 0; i < parentChildren.length; i++) {
        if (parentChildren[i].id === draggedId) {
          draggedNode = parentChildren.splice(i, 1)[0];
          break;
        }
      }
      
      if (!draggedNode) {
        console.error('❌ 未找到拖拽的节点:', draggedId);
        return;
      }
      
      // 插入到新位置
      const newIndex = Math.min(event.newIndex, parentChildren.length);
      parentChildren.splice(newIndex, 0, draggedNode);
      
      console.log('✅ Vue数据重排序完成:', {
        draggedTitle: draggedNode.title,
        newIndex,
        newOrder: parentChildren.map((node, idx) => `${idx}:${node.title}`)
      });
      
      // 更新 store 数据结构
      store.newProposalTree = {
        ...store.newProposalTree,
        children: [...parentChildren],
        dateAdded: Date.now()
      };
      
      // 触发相关更新
      handleReorder({
        oldIndex: event.oldIndex,
        newIndex: event.newIndex,
        item: event.item,
        from: event.from,
        to: event.to
      } as ReorderEvent);
    };
    
    // 延迟执行确保 DOM 更新完成
    setTimeout(reorderChildren, 10);
  }
};

// 使用store actions代替 emit
const handleDelete = (payload: BookmarkNode) => managementStore.deleteBookmark(payload);
const handleEdit = (node: BookmarkNode) => managementStore.editBookmark(node);
const handleReorder = (event?: ReorderEvent) => {
  if (!event) {
    managementStore.handleReorder();
    return;
  }
  
  // 转换ReorderEvent到管理store期望的格式
  // 这里需要根据实际需要补充逻辑
  const params = {
    nodeId: props.node.id,
    newParentId: props.node.parentId || '1', // 默认父级
    newIndex: event.newIndex
  };
  
  managementStore.handleReorder(params);
};

const addNewItem = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
  managementStore.addNewItem(props.node);
};

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
    const newTitleValue = newTitle.value.trim();
    const oldTitleValue = props.node.title;
    
    console.log('🎯 开始重命名文件夹:', {
      nodeId: props.node.id,
      oldTitle: oldTitleValue,
      newTitle: newTitleValue
    });
    
    // ✅ 正确的方式：通过不可变更新替换整个树结构
    const updateNodeTitle = (node: BookmarkNode, targetId: string, newTitle: string): BookmarkNode => {
      if (node.id === targetId) {
        return { ...node, title: newTitle };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(child => updateNodeTitle(child, targetId, newTitle))
        };
      }
      return node;
    };
    
    // 更新 proposalTree
    const updatedTree = {
      ...managementStore.newProposalTree,
      children: managementStore.newProposalTree.children?.map(child => 
        updateNodeTitle(child, props.node.id, newTitleValue)
      ) || []
    };
    
    // ⚡ 强制触发 Vue 响应式更新
    managementStore.newProposalTree = updatedTree;
    
    // 设置变更标记
    managementStore.hasDragChanges = true;
    managementStore.structuresAreDifferent = true;
    
    console.log('✅ 文件夹重命名完成，已更新 store:', {
      nodeId: props.node.id,
      newTitle: newTitleValue,
      treeUpdated: true
    });
  }
  isEditing.value = false;
};

const deleteFolder = () => {
    managementStore.deleteFolder(props.node);
};

const handleFolderClick = () => {
    if (props.isOriginal) {
      managementStore.toggleOriginalFolder(props.node.id);
    } else {
      managementStore.toggleProposalFolder(props.node.id);
    }
};

// 简化的 isExpanded computed，只读
const isExpanded = computed(() => !!(props.expandedFolders && props.expandedFolders.has(props.node.id)));

// 🎯 清理模式相关计算属性 - 直接从节点属性读取
const cleanupProblems = computed(() => {
  if (!props.cleanupMode) {
    return [];
  }
  // 🎯 新架构：直接从节点的 _cleanupProblems 属性读取
  const problems = (props.node as any)._cleanupProblems || [];
  
  return problems;
});

// 🏷️ 获取问题标签配置（根据图例可见性过滤）
const problemTags = computed(() => {
  if (!props.cleanupMode || cleanupProblems.value.length === 0) {
    return [];
  }
  
  const legendVisibility = managementStore.cleanupState?.legendVisibility;
  if (!legendVisibility) return [];
  
  const tags: Array<{
    type: string
    label: string
    color: string
    icon: string
  }> = [];
  
  const problemTypes = [...new Set(cleanupProblems.value.map((p: any) => p.type))];
  
  problemTypes.forEach(type => {
    // 🎯 只显示图例中启用的问题类型标签
    const isVisible = legendVisibility.all || legendVisibility[type as keyof typeof legendVisibility];
    if (!isVisible) return;
    
    switch (type) {
      case '404':
        tags.push({
          type: '404',
          label: '404错误',
          color: 'error',
          icon: 'mdi-link-off'
        });
        break;
      case 'duplicate':
        tags.push({
          type: 'duplicate',
          label: '重复',
          color: 'warning',
          icon: 'mdi-content-duplicate'
        });
        break;
      case 'empty':
        tags.push({
          type: 'empty',
          label: '空文件夹',
          color: 'info',
          icon: 'mdi-folder-outline'
        });
        break;
      case 'invalid':
        tags.push({
          type: 'invalid',
          label: '格式错误',
          color: 'secondary',
          icon: 'mdi-alert-circle-outline'
        });
        break;
    }
  });
  
  return tags;
});
</script>

<template>
  <div class="folder-group" :key="`folder-${node.id}-${expandedFolders?.size || 0}`">
    <!-- 文件夹标题行 -->
    <List 
      is="item" 
      clickable
      class="folder-item"
      :class="{ 'folder-item-top-level': isTopLevel || isBuiltInTopLevel }"
      :data-native-id="node && node.id ? String(node.id) : undefined"
      @click="handleFolderClick"
      @dragstart.prevent.stop
      @drag.prevent.stop
    >
      <!-- 拖拽图标 -->
      <Icon 
        v-if="isSortable && !isTopLevel && !isBuiltInTopLevel && !isOriginal" 
        name="mdi-drag" 
        :size="16" 
        class="drag-handle" 
        @click.prevent.stop 
        @dragstart.prevent.stop 
        @drag.prevent.stop
      />
      <Icon 
        v-if="isOriginal && isSortable && !isTopLevel && !isBuiltInTopLevel" 
        name="mdi-drag" 
        :size="16" 
        class="drag-handle original-only" 
      />
      
      <!-- 文件夹图标 -->
      <Icon 
        :name="isExpanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline'" 
        :size="20" 
        class="folder-icon"
      />
      
      <!-- 文件夹标题 -->
      <div class="folder-title">
        <span v-if="!isEditing" class="title-text">{{ node.title || '未命名' }}</span>
        <input
          v-else
          ref="inputRef"
          v-model="newTitle"
          class="title-input"
          @blur="finishEditing"
          @keydown.enter="finishEditing"
          @click.stop.prevent
        />
        <!-- 🏷️ 问题标签 -->
        <div v-if="problemTags.length > 0" class="problem-tags">
          <div
            v-for="tag in problemTags"
            :key="tag.type"
            :class="`problem-tag problem-tag--${tag.color}`"
          >
            <Icon :name="tag.icon" :size="12" />
            <span>{{ tag.label }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="folder-actions">
        <template v-if="!isOriginal">
          <!-- 新增按钮 - 所有文件夹都可以新增 -->
          <Button 
            variant="ghost" 
            size="sm" 
            icon 
            @click.stop="addNewItem"
            title="新增"
          >
            <Icon name="mdi-plus" :size="16" />
          </Button>
          <!-- 编辑和删除按钮 - 只有非内置顶级文件夹才显示 -->
          <template v-if="!isBuiltInTopLevel">
            <Button 
              variant="ghost" 
              size="sm" 
              icon 
              @click.stop.prevent="startEditing"
              title="编辑"
            >
              <Icon name="mdi-pencil" :size="16" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              icon 
              @click.stop.prevent="deleteFolder"
              title="删除"
            >
              <Icon name="mdi-delete-outline" :size="16" />
            </Button>
          </template>
        </template>
      </div>
    </List>
    <div class="nested-tree" :key="`children-${node.id}`">
      <!-- 统一渲染逻辑 -->
      <template v-if="isExpanded">
        <!-- 可拖拽模式使用 Sortable -->
        <Sortable
          v-if="isSortable"
        :key="`sortable-${node.id}`"
        :list="node.children || []"
        itemKey="id"
        tag="div"
        :options="sortableOptions"
        :disabled="!isSortable"
        @end="handleReorder"
      >
        <template #item="{ element: childNode }">
          <BookmarkTree
            :key="(childNode as any).id"
            @delete-bookmark="handleDelete"
            @edit-bookmark="handleEdit"
            @reorder="handleReorder"
            :nodes="[childNode as any]"
            :isProposal="isProposal"
            :isSortable="isSortable"
            :hoveredBookmarkId="hoveredBookmarkId"
            :isOriginal="isOriginal"
            :expandedFolders="expandedFolders"
            :cleanupMode="cleanupMode"
            @bookmark-hover="(payload: BookmarkHoverPayload) => managementStore.setBookmarkHover(payload)"
            @scroll-to-bookmark="() => {/* scroll功能由父组件处理 */}"
            @folder-toggle="(data: FolderToggleData) => props.isOriginal ? managementStore.toggleOriginalFolder(data.nodeId) : managementStore.toggleProposalFolder(data.nodeId)"
            @delete-folder="(node: BookmarkNode) => managementStore.deleteFolder(node)"
          />
        </template>
        </Sortable>
        
        <!-- 非拖拽模式直接渲染 -->
        <div v-else>
          <div v-for="childNode in (node.children || [])" :key="childNode.id">
            <BookmarkTree
              @delete-bookmark="handleDelete"
              @edit-bookmark="handleEdit"
              @reorder="handleReorder"
              :nodes="[childNode]"
              :isProposal="isProposal"
              :isSortable="isSortable"
              :hoveredBookmarkId="hoveredBookmarkId"
              :isOriginal="isOriginal"
              :expandedFolders="expandedFolders"
              :cleanupMode="cleanupMode"
              @bookmark-hover="(payload: BookmarkHoverPayload) => managementStore.setBookmarkHover(payload)"
              @scroll-to-bookmark="() => {/* scroll功能由父组件处理 */}"
              @folder-toggle="(data: FolderToggleData) => props.isOriginal ? managementStore.toggleOriginalFolder(data.nodeId) : managementStore.toggleProposalFolder(data.nodeId)"
              @delete-folder="(node: BookmarkNode) => managementStore.deleteFolder(node)"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 文件夹组 */
.folder-group {
  width: 100%;
}

/* 文件夹项 */
.folder-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-base);
  border-radius: var(--radius-sm);
}

.folder-item:hover {
  background: var(--color-surface-hover);
}

.folder-item.folder-item-top-level {
  font-weight: var(--font-semibold);
  background: var(--color-surface-variant);
}

/* 拖拽图标 */
.drag-handle {
  cursor: grab;
  transition: all var(--transition-base);
  opacity: 0.6;
  color: var(--color-text-secondary);
}

.drag-handle.original-only {
  opacity: 0;
  cursor: default;
}

.folder-item:hover .drag-handle:not(.original-only) {
  opacity: 1;
  color: var(--color-primary);
}

.drag-handle:active {
  cursor: grabbing;
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
  border-radius: var(--radius-sm);
}

/* 文件夹图标 */
.folder-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

/* 文件夹标题 */
.folder-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.title-text {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.title-input {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--text-sm);
  outline: none;
  min-width: 120px;
}

.title-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha-20);
}

/* 问题标签 */
.problem-tags {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.problem-tag {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.problem-tag--error {
  background: var(--color-error-alpha-10);
  color: var(--color-error);
}

.problem-tag--warning {
  background: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.problem-tag--info {
  background: var(--color-info-alpha-10);
  color: var(--color-info);
}

/* 操作按钮 */
.folder-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.folder-item:hover .folder-actions {
  opacity: 1;
}

/* 嵌套树 */
.nested-tree {
  padding-left: var(--spacing-lg);
  overflow: visible;
  transition: all var(--transition-base);
}

/* 拖拽时的幽灵元素样式 */
.ghost-item {
  opacity: 0.5;
  background: var(--color-primary-alpha-20);
  border-radius: var(--radius-sm);
}
</style>
