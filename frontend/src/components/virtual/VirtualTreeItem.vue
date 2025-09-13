<!--
  VirtualTreeItem - 虚拟化树节点组件
  极轻量级的树节点实现，专为性能优化
-->
<template>
  <div 
    :class="itemClasses"
    :style="itemStyle"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @contextmenu="handleContextMenu"
  >
    <!-- 缩进 -->
    <div 
      class="tree-item__indent" 
      :style="{ width: `${level * 20}px` }"
    ></div>
    
    <!-- 展开/收起按钮 -->
    <button
      v-if="hasChildren"
      class="tree-item__toggle"
      @click.stop="handleToggle"
      :aria-expanded="isExpanded"
      :aria-label="isExpanded ? '收起' : '展开'"
    >
      <AcuityIcon 
        :name="isExpanded ? 'chevron-down' : 'chevron-right'"
        size="sm"
      />
    </button>
    
    <!-- 占位符（保持对齐） -->
    <div v-else class="tree-item__toggle tree-item__toggle--placeholder"></div>
    
    <!-- 图标 -->
    <div class="tree-item__icon">
      <AcuityIcon 
        :name="itemIcon" 
        :color="iconColor"
        size="md"
      />
    </div>
    
    <!-- 内容 -->
    <div class="tree-item__content">
      <div class="tree-item__title" :title="item.title">
        <span v-if="searchQuery" v-html="highlightedTitle"></span>
        <span v-else>{{ item.title }}</span>
      </div>
      
      <!-- URL (仅书签显示) -->
      <div v-if="item.url" class="tree-item__url" :title="item.url">
        {{ item.url }}
      </div>
      
      <!-- 统计信息 -->
      <div v-if="showStats" class="tree-item__stats">
        <span v-if="hasChildren" class="tree-item__count">
          {{ childrenCount }} 项
        </span>
      </div>
    </div>
    
    <!-- 清理模式标识 -->
    <div v-if="cleanupMode && problemTypes.length > 0" class="tree-item__problems">
      <span 
        v-for="type in problemTypes" 
        :key="type"
        :class="`tree-item__problem tree-item__problem--${type}`"
        :title="getProblemTitle(type)"
      >
        <AcuityIcon :name="getProblemIcon(type)" size="xs" />
      </span>
    </div>
    
    <!-- 操作按钮 -->
    <div v-if="showActions" class="tree-item__actions">
      <AcuityButton
        v-if="!hasChildren"
        variant="ghost"
        size="sm"
        iconLeft="open-in-new"
        @click.stop="openBookmark"
        title="打开书签"
      />
      <AcuityButton
        variant="ghost"
        size="sm"
        iconLeft="dots-vertical"
        @click.stop="showContextMenu"
        title="更多操作"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import AcuityIcon from '../ui/Icon.vue';
import AcuityButton from '../ui/Button.vue';
import type { BookmarkNode } from '../../types';

interface Props {
  item: BookmarkNode & { level: number; path?: string }
  level: number
  expanded: Set<string>
  selected?: Set<string>
  hovered?: string | null
  searchQuery?: string
  cleanupMode?: boolean
  showStats?: boolean
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showStats: true,
  showActions: false
});

const emit = defineEmits<{
  toggle: [id: string]
  select: [id: string, event: Event]
  hover: [id: string | null]
  contextMenu: [id: string, event: Event]
}>();

// 计算属性
const hasChildren = computed(() => 
  Array.isArray(props.item.children) && props.item.children.length > 0
);

const isExpanded = computed(() => 
  props.expanded.has(props.item.id)
);

const isSelected = computed(() => 
  props.selected?.has(props.item.id) || false
);

const isHovered = computed(() => 
  props.hovered === props.item.id
);

const childrenCount = computed(() => 
  props.item.children?.length || 0
);

// 图标逻辑
const itemIcon = computed(() => {
  if (hasChildren.value) {
    return isExpanded.value ? 'folder-open' : 'folder';
  }
  return 'bookmark';
});

const iconColor = computed(() => {
  if (props.cleanupMode && problemTypes.value.length > 0) {
    return '--color-error';
  }
  if (hasChildren.value) {
    return '--color-warning';
  }
  return '--color-info';
});

// 清理模式问题类型
const problemTypes = computed(() => {
  if (!props.cleanupMode || hasChildren.value) return [];
  
  const problems: string[] = [];
  
  // 检查各种问题
  if (!props.item.url || props.item.url === '') {
    problems.push('invalid');
  } else {
    try {
      new URL(props.item.url);
    } catch {
      problems.push('invalid');
    }
  }
  
  // 这里可以添加更多问题检查逻辑
  // 404检查、重复检查等会在实际扫描时添加
  
  return problems;
});

// 搜索高亮
const highlightedTitle = computed(() => {
  if (!props.searchQuery || !props.item.title) {
    return props.item.title;
  }
  
  const query = props.searchQuery.toLowerCase();
  const {title} = props.item;
  const index = title.toLowerCase().indexOf(query);
  
  if (index === -1) return title;
  
  const before = title.substring(0, index);
  const match = title.substring(index, index + query.length);
  const after = title.substring(index + query.length);
  
  return `${before}<mark class="search-highlight">${match}</mark>${after}`;
});

// 样式
const itemClasses = computed(() => [
  'tree-item',
  {
    'tree-item--folder': hasChildren.value,
    'tree-item--bookmark': !hasChildren.value,
    'tree-item--expanded': isExpanded.value,
    'tree-item--selected': isSelected.value,
    'tree-item--hovered': isHovered.value,
    'tree-item--has-problems': problemTypes.value.length > 0
  }
]);

const itemStyle = computed((): CSSProperties => ({
  paddingLeft: `${props.level * 20 + 8}px`
}));

// 事件处理
const handleClick = (event: Event) => {
  emit('select', props.item.id, event);
};

const handleDoubleClick = () => {
  if (hasChildren.value) {
    handleToggle();
  } else if (props.item.url) {
    openBookmark();
  }
};

const handleToggle = () => {
  emit('toggle', props.item.id);
};

const handleMouseEnter = () => {
  emit('hover', props.item.id);
};

const handleMouseLeave = () => {
  emit('hover', null);
};

const handleContextMenu = (event: Event) => {
  event.preventDefault();
  emit('contextMenu', props.item.id, event);
};

// 操作方法
const openBookmark = () => {
  if (props.item.url) {
    window.open(props.item.url, '_blank');
  }
};

const showContextMenu = (event?: Event) => {
  if (event) {
    emit('contextMenu', props.item.id, event);
  }
};

// 问题相关方法
const getProblemIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    '404': 'link-off',
    'duplicate': 'content-duplicate',
    'empty': 'folder-outline',
    'invalid': 'alert-circle'
  };
  return iconMap[type] || 'alert';
};

const getProblemTitle = (type: string): string => {
  const titleMap: Record<string, string> = {
    '404': '链接无法访问',
    'duplicate': '重复书签',
    'empty': '空文件夹',
    'invalid': 'URL格式错误'
  };
  return titleMap[type] || '未知问题';
};
</script>

<style scoped>
.tree-item {
  /* 基础样式 */
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-radius: var(--radius-sm);
  
  /* 性能优化 */
  contain: layout style;
  will-change: background-color;
}

/* === 状态样式 === */
.tree-item:hover,
.tree-item--hovered {
  background-color: var(--color-surface-hover);
}

.tree-item--selected {
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
}

.tree-item--has-problems {
  border-left: 3px solid var(--color-error);
}

/* === 缩进 === */
.tree-item__indent {
  flex-shrink: 0;
}

/* === 展开/收起按钮 === */
.tree-item__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  margin-right: var(--space-1);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  flex-shrink: 0;
}

.tree-item__toggle:hover {
  background-color: var(--color-surface-variant);
}

.tree-item__toggle--placeholder {
  cursor: default;
}

.tree-item__toggle--placeholder:hover {
  background-color: transparent;
}

/* === 图标 === */
.tree-item__icon {
  display: flex;
  align-items: center;
  margin-right: var(--space-2);
  flex-shrink: 0;
}

/* === 内容区域 === */
.tree-item__content {
  flex: 1;
  min-width: 0; /* 允许文本截断 */
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tree-item__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-item__url {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-family-mono);
}

.tree-item__stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.tree-item__count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background-color: var(--color-surface-variant);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

/* === 问题标识 === */
.tree-item__problems {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-right: var(--space-2);
}

.tree-item__problem {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.tree-item__problem--404 {
  background-color: var(--color-error-light);
  color: var(--color-error-dark);
}

.tree-item__problem--duplicate {
  background-color: var(--color-warning-light);
  color: var(--color-warning-dark);
}

.tree-item__problem--empty {
  background-color: var(--color-info-light);
  color: var(--color-info-dark);
}

.tree-item__problem--invalid {
  background-color: var(--color-error-light);
  color: var(--color-error-dark);
}

/* === 操作按钮 === */
.tree-item__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tree-item:hover .tree-item__actions {
  opacity: 1;
}

/* === 搜索高亮 === */
:deep(.search-highlight) {
  background-color: var(--color-warning-light);
  color: var(--color-warning-dark);
  font-weight: var(--font-weight-semibold);
  padding: 0 2px;
  border-radius: 2px;
}

/* === 键盘导航 === */
.tree-item:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* === 拖拽支持 === */
.tree-item[draggable="true"] {
  cursor: grab;
}

.tree-item[draggable="true"]:active {
  cursor: grabbing;
}

.tree-item--drag-over {
  background-color: var(--color-primary-100);
  border: 2px dashed var(--color-primary);
}

/* === 不同类型的特殊样式 === */
.tree-item--folder .tree-item__title {
  font-weight: var(--font-weight-semibold);
}

.tree-item--bookmark .tree-item__title {
  font-weight: var(--font-weight-normal);
}

/* === 性能优化 === */
.tree-item {
  /* 避免重绘 */
  transform: translateZ(0);
  /* 布局包含 */
  contain: layout;
}

/* === 响应式 === */
@container (max-width: 400px) {
  .tree-item__url,
  .tree-item__stats {
    display: none;
  }
  
  .tree-item__title {
    font-size: var(--font-size-xs);
  }
}
</style>
