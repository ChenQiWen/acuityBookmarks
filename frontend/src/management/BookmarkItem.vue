<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useManagementStore } from '../stores/management-store';
import { PERFORMANCE_CONFIG, BOOKMARK_CONFIG } from '../config/constants';
// import { useFavicon } from '../composables/useFavicon';  // 暂时禁用
// import { FaviconLoadPriority } from '../services/favicon-service';  // 暂时禁用
import { Icon, Button, Chip } from '../components/ui';
import type { BookmarkNode } from '../types';

// === 使用 Pinia Store ===
const managementStore = useManagementStore();

const props = defineProps<{
  node: BookmarkNode;
  isSortable?: boolean;
  isTopLevel?: boolean;
  searchQuery?: string;
  hoveredBookmarkId?: string | null;
  isOriginal?: boolean;
  cleanupMode?: boolean;
}>();

// 注意：不再使用emit事件，直接使用store actions
// const emit = defineEmits(['delete-bookmark', 'edit-bookmark', 'bookmark-hover', 'scroll-to-bookmark', 'copy-success', 'copy-failed', 'copy-loading']);

// Copy loading state
const isCopying = ref(false);
// Lazy load state
const isVisible = ref(false);
const observerRef = ref<IntersectionObserver | null>(null);
// 容器元素引用
const containerEl = ref<HTMLElement | null>(null);

// 暂时使用简单的favicon URL生成（恢复功能优先）
const faviconUrl = computed(() => {
  if (!props.node?.url) return ''
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(props.node.url).hostname}&sz=16`
  } catch {
    return ''
  }
})

const editBookmark = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  managementStore.editBookmark(props.node);
};

const copyLink = async (e: Event) => {
  e.preventDefault();
  e.stopPropagation();

  if (isCopying.value) return; // Prevent multiple clicks

  if (props.node.url) {
    isCopying.value = true;
    // copy-loading事件不再需要，由store统一管理

    try {
      // Simulate network delay for better UX - 使用配置常量
      await new Promise(resolve => setTimeout(resolve, PERFORMANCE_CONFIG.COPY_SIMULATION_DELAY));
      await navigator.clipboard.writeText(props.node.url);
      // 使用store action显示成功反馈
      managementStore.handleCopySuccess();
    } catch {
      // 使用store action显示失败反馈
      managementStore.handleCopyFailed();
    } finally {
      isCopying.value = false;
      // copy-loading事件不再需要，由store统一管理
    }
  } else {
    // No URL to copy
    managementStore.handleCopyFailed();
  }
};

const deleteBookmark = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  managementStore.deleteBookmark(props.node);
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

// 清理模式相关计算属性 - 🎯 直接从节点属性读取
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

const highlightedTitle = computed(() => {
  if (!props.searchQuery) {
    return props.node.title;
  }
  const regex = new RegExp(`(${props.searchQuery})`, 'gi');
  return props.node.title.replace(regex, '<mark>$1</mark>');
});

// Handle hover events - 使用store action
const handleMouseEnter = () => {
  managementStore.setBookmarkHover({ id: bookmarkId.value, node: props.node, isOriginal: !!props.isOriginal });
};

const handleMouseLeave = () => {
  managementStore.setBookmarkHover(null);
};

onMounted(() => {
  const target = containerEl.value;
  if (!(target instanceof Element)) {
    // 兜底：无法获取元素时直接认为可见，避免报错
    isVisible.value = true;
    return;
  }
  observerRef.value = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          isVisible.value = true;
          observerRef.value?.disconnect();
          break;
        }
      }
    },
    { 
      root: null, 
      rootMargin: BOOKMARK_CONFIG.OBSERVER_ROOT_MARGIN, 
      threshold: BOOKMARK_CONFIG.OBSERVER_THRESHOLD 
    }
  );
  observerRef.value.observe(target);
});

onUnmounted(() => {
  observerRef.value?.disconnect();
  observerRef.value = null;
});
</script>

<template>
  <a
    :href="node.url"
    target="_blank"
    class="bookmark-item"
    :class="{ 'bookmark-highlighted': isHighlighted }"
    :data-bookmark-id="bookmarkId"
    :data-native-id="node && node.id ? String(node.id) : undefined"
    ref="containerEl"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @dragstart.prevent.stop
    @drag.prevent.stop
  >
    <!-- 拖拽图标 -->
    <Icon 
      v-if="isSortable && !isOriginal" 
      name="mdi-drag" 
      :size="16" 
      class="drag-handle" 
      @click.prevent.stop 
      @dragstart.prevent.stop 
      @drag.prevent.stop
    />
    <Icon 
      v-if="isOriginal" 
      name="mdi-drag" 
      :size="16" 
      class="drag-handle original-only" 
    />
    
    <!-- 书签图标 -->
    <div class="bookmark-icon">
      <img
        v-if="faviconUrl"
        :src="faviconUrl"
        alt=""
        width="20"
        height="20"
        @error="(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }"
      />
      <Icon name="mdi-bookmark-outline" :size="16" class="hidden fallback-icon" />
    </div>
    
    <!-- 书签标题 -->
    <div class="bookmark-title">
      <span v-html="highlightedTitle" class="title-text"></span>
      <!-- 🏷️ 问题标签 -->
      <div v-if="problemTags.length > 0" class="problem-tags">
        <Chip
          v-for="tag in problemTags"
          :key="tag.type"
          :color="(tag.color as 'error' | 'warning' | 'info')"
          variant="soft"
          size="sm"
        >
          <Icon :name="tag.icon" :size="12" />
          {{ tag.label }}
        </Chip>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="bookmark-actions">
      <template v-if="!isOriginal">
        <Button 
          variant="ghost" 
          size="sm" 
          icon 
          @click.prevent="editBookmark"
          title="编辑"
        >
          <Icon name="mdi-pencil" :size="16" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          icon 
          @click.prevent="copyLink"
          :title="isCopying ? '复制中...' : '复制链接'"
          :loading="isCopying"
          :disabled="isCopying"
        >
          <Icon name="mdi-link-variant" :size="16" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          icon 
          @click.prevent="deleteBookmark"
          title="删除"
        >
          <Icon name="mdi-delete-outline" :size="16" />
        </Button>
      </template>
    </div>
  </a>
</template>

<style scoped>
/* 书签项 */
.bookmark-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  text-decoration: none;
  color: inherit;
  transition: all var(--transition-base);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bookmark-item:hover {
  background: var(--color-surface-hover);
  color: inherit;
  text-decoration: none;
}

.bookmark-item.bookmark-highlighted {
  background: var(--color-primary-alpha-10);
  border: 1px solid var(--color-primary-alpha-30);
}

/* 拖拽图标 */
.drag-handle {
  cursor: grab;
  transition: all var(--transition-base);
  opacity: 0.6;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.drag-handle.original-only {
  opacity: 0;
  cursor: default;
}

.bookmark-item:hover .drag-handle:not(.original-only) {
  opacity: 1;
  color: var(--color-primary);
}

.drag-handle:active {
  cursor: grabbing;
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
  border-radius: var(--radius-sm);
}

/* 书签图标 */
.bookmark-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.bookmark-icon img {
  border-radius: 2px;
}

.hidden {
  display: none !important;
}

.fallback-icon {
  color: var(--color-text-secondary);
}

/* 书签标题 */
.bookmark-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.title-text {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 问题标签 */
.problem-tags {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

/* 操作按钮 */
.bookmark-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
  flex-shrink: 0;
}

.bookmark-item:hover .bookmark-actions {
  opacity: 1;
}
</style>
