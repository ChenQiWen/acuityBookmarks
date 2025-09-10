<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useManagementStore } from '../stores/management-store'
import { PERFORMANCE_CONFIG, BOOKMARK_CONFIG } from '../config/constants'
import { getFaviconUrlForUrl, hasFaviconForUrl } from '../utils/faviconCache';
import type { BookmarkNode } from '../types'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

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
// 注意：v-list-item 是组件，ref 拿到的是组件实例，需要取 $el 才是真实 DOM
const containerEl = ref<{ $el: HTMLElement } | null>(null);

// Get favicon URL with shared cache, only when visible or in cache
const resolvedFaviconUrl = computed(() => {
  if (!props.node?.url) return '';
  if (isVisible.value || hasFaviconForUrl(props.node.url)) {
    return getFaviconUrlForUrl(props.node.url);
  }
  return '';
});

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
    } catch (error) {
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
  let target: HTMLElement | null = containerEl.value?.$el || null;
  // 处理Vue组件实例的$el属性
  if (target && '$el' in target) {
    target = (target as { $el: HTMLElement }).$el;
  }
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
  <v-list-item
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
    <template v-slot:prepend>
      <v-icon v-if="isSortable && !isOriginal" size="small" class="drag-handle" style="cursor: grab;" @click.prevent.stop @dragstart.prevent.stop @drag.prevent.stop>mdi-drag</v-icon>
      <v-icon v-if="isOriginal" size="small" class="drag-handle original-only" style="cursor: default; opacity: 0;">mdi-drag</v-icon>
      <v-avatar size="20">
        <v-img :src="node.faviconUrl || resolvedFaviconUrl" alt="">
          <template v-slot:error>
            <v-icon size="small">mdi-bookmark-outline</v-icon>
          </template>
        </v-img>
      </v-avatar>
    </template>

    <v-list-item-title>
      <span v-html="highlightedTitle"></span>
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
          <v-icon :icon="tag.icon" size="12" class="mr-1"></v-icon>
          {{ tag.label }}
        </v-chip>
      </div>
    </v-list-item-title>

    <template v-slot:append>
      <div v-if="!isOriginal" class="actions">
        <v-btn @click="editBookmark" icon="mdi-pencil" size="x-small" variant="text" title="编辑"></v-btn>
        <v-btn
          @click="copyLink"
          icon="mdi-link-variant"
          size="x-small"
          variant="text"
          :title="isCopying ? '复制中...' : '复制链接'"
          :loading="isCopying"
          :disabled="isCopying"
        >
        </v-btn>
        <v-btn @click="deleteBookmark" icon="mdi-delete-outline" size="x-small" variant="text" title="删除"></v-btn>
      </div>
      <div v-if="isOriginal" class="actions original-only">
        <!-- 左侧面板的占位符，保持布局一致但不显示操作按钮 -->
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

/* 🏷️ 问题标签样式 */
.problem-tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

/* 标签内图标和文字的间距 */
:deep(.v-chip__content) {
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
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
/* Grid布局间距调整 */
:deep(.v-list-item) {
    gap: 4px !important;
    column-gap: 4px !important;
    grid-column-gap: 4px !important;
}

/* 控制prepend容器宽度 - 需要容纳拖拽手柄+头像 */
:deep(.v-list-item__prepend),
:deep(.v-list-item--prepend) {
    width: auto !important;
    min-width: auto !important;
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
}

/* 控制avatar大小 */
:deep(.v-list-item__prepend .v-avatar),
:deep(.v-list-item--prepend .v-avatar) {
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
    margin: 0 !important;
}

/* 控制拖拽手柄大小 */
:deep(.v-list-item__prepend .drag-handle),
:deep(.v-list-item--prepend .drag-handle) {
    width: 16px !important;
    height: 16px !important;
    margin: 0 !important;
}

/* 拖拽手柄样式优化 */
.drag-handle {
  cursor: grab;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px;
  opacity: 0.6;
}

.drag-handle:hover {
  opacity: 1;
  color: #1976d2;
  background-color: rgba(25, 118, 210, 0.08);
}

.drag-handle:active {
  cursor: grabbing;
  color: #1565c0;
  background-color: rgba(21, 101, 192, 0.12);
}

/* 高亮样式 */
.bookmark-highlighted {
    background-color: rgba(255, 193, 7, 0.1) !important;
    border-left: 3px solid #ffc107 !important;
    transition: all 0.2s ease;
}

.bookmark-highlighted:hover {
    background-color: rgba(255, 193, 7, 0.15) !important;
}
</style>
