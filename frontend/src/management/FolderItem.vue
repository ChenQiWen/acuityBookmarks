<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { useManagementStore } from '../stores/management-store'
import { Sortable } from 'sortablejs-vue3';
import BookmarkTree from './BookmarkTree.vue';
import type { BookmarkNode, BookmarkHoverPayload, FolderToggleData, ReorderEvent } from '../types'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

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
      let parentChildren: BookmarkNode[] = currentChildren;
      
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
        newIndex: newIndex,
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
  managementStore.handleReorder(event);
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
}

const handleFolderClick = () => {
    if (props.isOriginal) {
      managementStore.toggleOriginalFolder(props.node.id);
    } else {
      managementStore.toggleProposalFolder(props.node.id);
    }
}

// 简化的 isExpanded computed，只读
const isExpanded = computed(() => !!(props.expandedFolders && props.expandedFolders.has(props.node.id)));

// 🎯 清理模式相关计算属性 - 直接从节点属性读取
const cleanupProblems = computed(() => {
  if (!props.cleanupMode) {
    return []
  }
  // 🎯 新架构：直接从节点的 _cleanupProblems 属性读取
  const problems = (props.node as any)._cleanupProblems || []
  
  return problems
});

// 🏷️ 获取问题标签配置（根据图例可见性过滤）
const problemTags = computed(() => {
  if (!props.cleanupMode || cleanupProblems.value.length === 0) {
    return []
  }
  
  const legendVisibility = managementStore.cleanupState?.legendVisibility
  if (!legendVisibility) return []
  
  const tags: Array<{
    type: string
    label: string
    color: string
    icon: string
  }> = []
  
  const problemTypes = [...new Set(cleanupProblems.value.map((p: any) => p.type))]
  
  problemTypes.forEach(type => {
    // 🎯 只显示图例中启用的问题类型标签
    const isVisible = legendVisibility.all || legendVisibility[type as keyof typeof legendVisibility]
    if (!isVisible) return
    
    switch (type) {
      case '404':
        tags.push({
          type: '404',
          label: '404错误',
          color: 'error',
          icon: 'mdi-link-off'
        })
        break
      case 'duplicate':
        tags.push({
          type: 'duplicate',
          label: '重复',
          color: 'warning',
          icon: 'mdi-content-duplicate'
        })
        break
      case 'empty':
        tags.push({
          type: 'empty',
          label: '空文件夹',
          color: 'info',
          icon: 'mdi-folder-outline'
        })
        break
      case 'invalid':
        tags.push({
          type: 'invalid',
          label: '格式错误',
          color: 'secondary',
          icon: 'mdi-alert-circle-outline'
        })
        break
    }
  })
  
  return tags
});


</script>

<template>
  <v-list-group :model-value="isExpanded">
    <template v-slot:activator="{ props: activatorProps, isOpen }">
      <v-list-item
        v-bind="activatorProps"
        class="folder-item"
        :class="{ 'folder-item-top-level': isTopLevel || isBuiltInTopLevel }"
        :data-native-id="node && node.id ? String(node.id) : undefined"
        @dragstart.prevent.stop
        @drag.prevent.stop
        @click="handleFolderClick"
      >
        <template v-slot:prepend>
          <v-icon v-if="isSortable && !isTopLevel && !isBuiltInTopLevel && !isOriginal" size="small" class="drag-handle" style="cursor: grab;" @click.prevent.stop @dragstart.prevent.stop @drag.prevent.stop>mdi-drag</v-icon>
          <v-icon v-if="isOriginal && isSortable && !isTopLevel && !isBuiltInTopLevel" size="small" class="drag-handle original-only" style="cursor: default; opacity: 0;">mdi-drag</v-icon>
          <v-icon>{{ isOpen ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}</v-icon>
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
          <!-- 🏷️ 问题标签 -->
          <div v-if="problemTags.length > 0" class="problem-tags">
            <v-chip
              v-for="tag in problemTags"
              :key="tag.type"
              :color="tag.color"
              size="x-small"
              variant="flat"
              class="ml-2"
            >
              <v-icon :icon="tag.icon" size="x-small" class="mr-1"></v-icon>
              {{ tag.label }}
            </v-chip>
          </div>
        </v-list-item-title>

        <template v-slot:append>


          <div v-if="!isBuiltInTopLevel && !isOriginal" class="actions">
            <v-btn @click="addNewItem" icon="mdi-plus" size="x-small" variant="text" title="新增"></v-btn>
            <v-btn @click.stop.prevent="startEditing" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
            <v-btn @click.stop.prevent="deleteFolder" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
          </div>
          <div v-if="!isBuiltInTopLevel && isOriginal" class="actions original-only">
            <!-- 左侧面板的占位符，保持布局一致但不显示操作按钮 -->
          </div>
        </template>
      </v-list-item>
    </template>
    <div class="nested-tree" :key="`children-${node.id}`">
      <!-- 统一渲染逻辑 -->
      <template v-if="isExpanded">
        <!-- 可拖拽模式使用 Sortable -->
        <Sortable
          v-if="isSortable"
        :key="`sortable-${node.id}`"
        :list="node.children || []"
        item-key="id"
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
            :is-proposal="isProposal"
            :is-sortable="isSortable"
            :hovered-bookmark-id="hoveredBookmarkId"
            :is-original="isOriginal"
            :expanded-folders="expandedFolders"
            :cleanup-mode="cleanupMode"
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
              :is-proposal="isProposal"
              :is-sortable="isSortable"
              :hovered-bookmark-id="hoveredBookmarkId"
              :is-original="isOriginal"
              :expanded-folders="expandedFolders"
              :cleanup-mode="cleanupMode"
              @bookmark-hover="(payload: BookmarkHoverPayload) => managementStore.setBookmarkHover(payload)"
              @scroll-to-bookmark="() => {/* scroll功能由父组件处理 */}"
              @folder-toggle="(data: FolderToggleData) => props.isOriginal ? managementStore.toggleOriginalFolder(data.nodeId) : managementStore.toggleProposalFolder(data.nodeId)"
              @delete-folder="(node: BookmarkNode) => managementStore.deleteFolder(node)"
            />
          </div>
        </div>
      </template>
    </div>
  </v-list-group>
</template>

<style scoped>
.actions, .drag-handle {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

/* 🏷️ 问题标签样式 */
.problem-tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

/* 确保标题和标签在同一行 */
.v-list-item-title {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 4px !important;
}
/* 右侧面板始终显示拖拽图标，hover时显示操作按钮 */
.drag-handle:not(.original-only) {
  visibility: visible;
  opacity: 0.6;
}
.v-list-item:hover .actions:not(.original-only),
.v-list-item:hover .drag-handle:not(.original-only) {
  visibility: visible;
  opacity: 1;
}

/* PC浏览器优化 - 增强交互体验 */
.folder-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.folder-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* 优化拖拽手柄的交互 */
.drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease, color 0.2s ease;
  border-radius: 4px;
  padding: 2px;
}

.drag-handle:hover {
  color: #1976d2;
}

.drag-handle:active {
  cursor: grabbing;
  color: #1565c0;
  background-color: rgba(21, 101, 192, 0.12);
}
.nested-tree {
  padding-left: 16px;
  max-height: none; /* 移除高度限制，让内容自然展开 */
  min-height: auto; /* 自动最小高度 */
  overflow: visible; /* 让内容自然展开，不产生额外滚动条 */
  overflow-x: hidden;
  transition: max-height 0.3s ease; /* 平滑展开过渡 */
}

/* 确保v-list-group展开时内容自然展开 */
:deep(.v-list-group__items) {
  overflow: visible !important;
  max-height: none !important;
}

/* 优化列表项的间距 */
:deep(.v-list-item) {
  min-height: 36px !important;
  padding: 8px 16px !important;
}

/* 优化嵌套列表的样式 */
:deep(.v-list) {
  background: transparent !important;
}

/* 移除嵌套滚动条样式，统一由父容器管理滚动 */

/* PC浏览器优化 - 提供最佳桌面体验 */
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
/* Grid布局间距调整 */
:deep(.v-list-item) {
    gap: 4px !important;
    column-gap: 4px !important;
    grid-column-gap: 4px !important;
}

/* 控制prepend容器宽度 - 默认适合有拖拽手柄的情况 */
:deep(.v-list-item__prepend),
:deep(.v-list-item--prepend) {
    width: auto !important;
    min-width: auto !important;
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
}

/* 顶级文件夹（只有单个图标）的特殊处理 */
.folder-item-top-level :deep(.v-list-item__prepend),
.folder-item-top-level :deep(.v-list-item--prepend) {
    width: 24px !important;
    min-width: 24px !important;
}

/* 控制文件夹icon大小 */
:deep(.v-list-item__prepend .v-icon),
:deep(.v-list-item--prepend .v-icon) {
    width: 20px !important;
    height: 20px !important;
    font-size: 20px !important;
    margin: 0 !important;
}

/* 控制拖拽手柄大小 */
:deep(.v-list-item__prepend .drag-handle),
:deep(.v-list-item--prepend .drag-handle) {
    width: 16px !important;
    height: 16px !important;
    margin: 0 !important;
}
.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>
