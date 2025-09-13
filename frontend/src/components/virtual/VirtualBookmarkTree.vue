<!--
  VirtualBookmarkTree - 虚拟化书签树组件
  使用@tanstack/vue-virtual实现高性能大量数据渲染
  支持万条书签的流畅操作
-->
<template>
  <div ref="parentRef" class="virtual-tree" :style="containerStyle">
    <div
      :style="{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }"
    >
      <div
        v-for="item in virtualizer.getVirtualItems()"
        :key="String(item.key)"
        :data-index="item.index"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${item.size}px`,
          transform: `translateY(${item.start}px)`,
        }"
      >
        <VirtualTreeItem 
          :item="flattenedItems[item.index]"
          :level="flattenedItems[item.index]?.level || 0"
          :expanded="expandedIds"
          :selected="selectedIds"
          :hovered="hoveredId"
          :searchQuery="searchQuery"
          :cleanupMode="cleanupMode"
          @toggle="handleToggle"
          @select="handleSelect"
          @hover="handleHover"
          @context-menu="handleContextMenu"
        />
      </div>
    </div>
    
    <!-- 批量操作提示 -->
    <div v-if="batchOperationInProgress" class="virtual-tree__batch-indicator">
      <AcuityIcon name="loading" spin />
      <span>{{ batchOperationText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import VirtualTreeItem from './VirtualTreeItem.vue';
import AcuityIcon from '../ui/Icon.vue';
import type { BookmarkNode } from '../../types';

interface Props {
  // 数据
  bookmarks: BookmarkNode[]
  
  // 状态
  expandedIds: Set<string>
  selectedIds?: Set<string>
  hoveredId?: string | null
  
  // 搜索
  searchQuery?: string
  
  // 模式
  cleanupMode?: boolean
  
  // 虚拟化配置
  height?: number | string
  itemHeight?: number
  overscan?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 400,
  itemHeight: 32,
  overscan: 10
});

const emit = defineEmits<{
  toggle: [id: string]
  select: [id: string, event: Event]
  hover: [id: string | null]
  contextMenu: [id: string, event: Event]
  batchOperation: [type: string, data: any]
}>();

// Refs
const parentRef = ref<HTMLElement>();
const batchOperationInProgress = ref(false);
const batchOperationText = ref('');

// 扁平化树结构用于虚拟化
const flattenedItems = computed(() => {
  const startTime = performance.now();
  
  const flatten = (items: BookmarkNode[], level = 0, parentPath = ''): Array<BookmarkNode & { level: number; path: string }> => {
    const result: Array<BookmarkNode & { level: number; path: string }> = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemPath = parentPath ? `${parentPath}/${item.title}` : item.title;
      
      // 添加当前项
      result.push({ 
        ...item, 
        level, 
        path: itemPath,
        index: i // 在同级中的索引
      });
      
      // 如果有子项且已展开，递归添加子项
      if (item.children && 
          item.children.length > 0 && 
          props.expandedIds.has(item.id)) {
        result.push(...flatten(item.children, level + 1, itemPath));
      }
    }
    
    return result;
  };
  
  const result = flatten(props.bookmarks);
  
  // 性能监控
  const endTime = performance.now();
  if (endTime - startTime > 10) {
    console.log(`🔍 树扁平化耗时: ${(endTime - startTime).toFixed(2)}ms, 节点数: ${result.length}`);
  }
  
  return result;
});

// 虚拟化器配置
const virtualizer = useVirtualizer({
  count: flattenedItems.value.length,
  getScrollElement: () => parentRef.value || null,
  estimateSize: () => props.itemHeight,
  overscan: props.overscan
});

// 容器样式
const containerStyle = computed((): CSSProperties => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  overflow: 'auto',
  contain: 'strict' // 性能优化
}));

// 事件处理
const handleToggle = (id: string) => {
  const startTime = performance.now();
  emit('toggle', id);
  
  // 性能监控
  requestAnimationFrame(() => {
    const endTime = performance.now();
    console.log(`🔍 切换文件夹耗时: ${(endTime - startTime).toFixed(2)}ms`);
  });
};

const handleSelect = (id: string, event: Event) => {
  emit('select', id, event);
};

const handleHover = (id: string | null) => {
  emit('hover', id);
};

const handleContextMenu = (id: string, event: Event) => {
  emit('contextMenu', id, event);
};

// 批量操作
const executeBatchOperation = async (type: 'expand-all' | 'collapse-all' | 'select-all', data?: any) => {
  batchOperationInProgress.value = true;
  
  const startTime = performance.now();
  
  try {
    switch (type) {
      case 'expand-all':
        batchOperationText.value = '展开所有文件夹...';
        break;
      case 'collapse-all':
        batchOperationText.value = '收起所有文件夹...';
        break;
      case 'select-all':
        batchOperationText.value = '选择所有项目...';
        break;
    }
    
    // 使用 requestIdleCallback 避免阻塞UI
    await new Promise<void>((resolve) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          emit('batchOperation', type, data);
          resolve();
        });
      } else {
        setTimeout(() => {
          emit('batchOperation', type, data);
          resolve();
        }, 0);
      }
    });
    
  } finally {
    const endTime = performance.now();
    console.log(`🚀 批量操作 ${type} 耗时: ${(endTime - startTime).toFixed(2)}ms`);
    
    batchOperationInProgress.value = false;
    batchOperationText.value = '';
  }
};

// 滚动到指定项目
const scrollToItem = (index: number, behavior: ScrollBehavior = 'smooth') => {
  if (parentRef.value) {
    const {itemHeight} = props;
    const scrollTop = index * itemHeight;
    parentRef.value.scrollTo({
      top: scrollTop,
      behavior
    });
  }
};

// 滚动到指定书签
const scrollToBookmark = (id: string) => {
  const index = flattenedItems.value.findIndex(item => item.id === id);
  if (index !== -1) {
    scrollToItem(index);
  }
};

// 监听展开状态变化，保持滚动位置
watch(() => props.expandedIds.size, (newSize, oldSize) => {
  // 如果是批量操作，不需要保持滚动位置
  if (Math.abs(newSize - oldSize) > 50) {
    return;
  }
  
  // 在下一帧重新定位
  requestAnimationFrame(() => {
    if (parentRef.value) {
      // 简单保持当前滚动位置
      const currentScrollTop = parentRef.value.scrollTop;
      parentRef.value.scrollTop = currentScrollTop;
    }
  });
});

// 导出方法供父组件使用
defineExpose({
  scrollToBookmark,
  scrollToItem,
  executeBatchOperation,
  virtualizer
});
</script>

<style scoped>
.virtual-tree {
  position: relative;
  background-color: var(--color-surface);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border);
}

.virtual-tree__batch-indicator {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  z-index: var(--z-sticky);
}

/* 滚动条样式 */
.virtual-tree::-webkit-scrollbar {
  width: 6px;
}

.virtual-tree::-webkit-scrollbar-track {
  background: transparent;
}

.virtual-tree::-webkit-scrollbar-thumb {
  background: var(--color-border-hover);
  border-radius: var(--radius-full);
}

.virtual-tree::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

/* 性能优化 */
.virtual-tree {
  /* 启用硬件加速 */
  transform: translateZ(0);
  /* 优化滚动性能 */
  will-change: scroll-position;
  /* 内容包含 */
  contain: layout style paint;
}

/* 加载状态 */
.virtual-tree--loading {
  pointer-events: none;
  opacity: 0.7;
}

/* 空状态 */
.virtual-tree--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: var(--space-8);
}

/* 聚焦状态 */
.virtual-tree:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}
</style>
