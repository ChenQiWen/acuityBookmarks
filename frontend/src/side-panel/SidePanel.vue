<template>
  <div class="side-panel-container">
    <!-- 头部 -->
    <AppBar color="primary" dense>
      <template #title>
        <div class="title-section">
          <Icon name="mdi-bookmark" :size="20" />
          <span class="title-text">AcuityBookmarks</span>
        </div>
      </template>
      
      <template #actions>
        <Button
          variant="text"
          icon="mdi-cog"
          size="md"
          @click="openManagement"
          title="打开完整管理页面"
        />
      </template>
    </AppBar>

    <!-- 主内容 -->
    <div class="panel-content">
      <!-- 搜索栏 -->
      <div class="search-section">
        <Input
          v-model="searchQuery"
          placeholder="搜索书签..."
          type="search"
          variant="outlined"
          density="compact"
          :loading="isSearching"
          clearable
          @input="handleSearch"
        >
          <template #prepend>
            <Icon name="mdi-magnify" :size="16" />
          </template>
        </Input>
      </div>

      <!-- 快速操作 -->
      <div class="quick-actions">
        <Button
          variant="primary"
          color="primary"
          size="sm"
          block
          @click="triggerAIOrganization"
          :loading="isAIProcessing"
        >
          <Icon name="mdi-auto-fix" :size="16" />
          AI整理书签
        </Button>
      </div>

      <!-- 书签列表 -->
      <div class="bookmarks-list">
        <div v-if="isLoading" class="loading-state">
          <Spinner size="sm" />
          <span>加载中...</span>
        </div>
        
        <div v-else-if="filteredBookmarks.length === 0" class="empty-state">
          <Icon name="mdi-bookmark-outline" :size="48" color="muted" />
          <p>{{ searchQuery ? '未找到相关书签' : '暂无书签' }}</p>
        </div>
        
        <div v-else class="bookmark-items">
          <div
            v-for="bookmark in filteredBookmarks"
            :key="bookmark.id"
            class="bookmark-item"
            @click="openBookmark(bookmark)"
          >
            <div class="bookmark-icon">
              <img 
                v-if="(bookmark as any).favIconUrl" 
                :src="(bookmark as any).favIconUrl" 
                alt=""
                @error="handleIconError"
              />
              <Icon v-else name="mdi-web" :size="16" />
            </div>
            
            <div class="bookmark-content">
              <div class="bookmark-title" :title="bookmark.title">
                {{ bookmark.title || '无标题' }}
              </div>
              <div class="bookmark-url" :title="bookmark.url">
                {{ formatUrl(bookmark.url) }}
              </div>
            </div>
            
            <Button
              variant="text"
              icon="mdi-open-in-new"
              size="sm"
              @click.stop="openInNewTab(bookmark)"
              title="在新标签页打开"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Toast通知 -->
    <Toast
      v-model:show="toast.show"
      :text="toast.text"
      :color="toast.color"
      :timeout="3000"
      location="bottom"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useBookmarkStore } from '../stores/bookmark-store';
// import { useManagementStore } from '../stores/management-store' // 当前未使用
import { AppBar, Button, Input, Icon, Spinner, Toast } from '../components/ui';
import type { BookmarkNode } from '../types';

// Store
const bookmarkStore = useBookmarkStore();
// const managementStore = useManagementStore() // 当前未使用

// 响应式状态
const searchQuery = ref('');
const isSearching = ref(false);
const isLoading = ref(true);
const isAIProcessing = ref(false);

// Toast
const toast = ref({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error' | 'info'
});

// 计算属性
const filteredBookmarks = computed(() => {
  if (!bookmarkStore.bookmarks) return [];
  
  if (!searchQuery.value.trim()) {
    // 返回最近的书签
    return bookmarkStore.bookmarks
      .filter((b: any) => b.url) // 只要有URL的书签
      .slice(0, 20); // 限制显示数量
  }
  
  const query = searchQuery.value.toLowerCase();
    return bookmarkStore.bookmarks
    .filter((bookmark: any) => 
      bookmark.url && (
        bookmark.title?.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query)
      )
    )
    .slice(0, 20);
});

// 方法
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return;
  
  isSearching.value = true;
  try {
    // 这里可以实现更复杂的搜索逻辑
    await new Promise(resolve => setTimeout(resolve, 300)); // 防抖
  } finally {
    isSearching.value = false;
  }
};

const openBookmark = (bookmark: BookmarkNode) => {
  if (bookmark.url) {
    chrome.tabs.update({ url: bookmark.url });
  }
};

const openInNewTab = (bookmark: BookmarkNode) => {
  if (bookmark.url) {
    chrome.tabs.create({ url: bookmark.url });
  }
};

const openManagement = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('management.html') });
};

const triggerAIOrganization = async () => {
  isAIProcessing.value = true;
  try {
    // await managementStore.triggerAIProcessing() // 方法不存在，使用基础方法
    await chrome.runtime.sendMessage({ action: 'smart-bookmark' });
    showToast('AI整理已开始，请稍候...', 'info');
  } catch (error) {
    console.error('AI处理失败:', error);
    showToast('AI整理失败，请稍后重试', 'error');
  } finally {
    isAIProcessing.value = false;
  }
};

const formatUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
};

const showToast = (text: string, color: 'success' | 'error' | 'info' = 'success') => {
  toast.value = { show: true, text, color };
};

// 初始化
onMounted(async () => {
  try {
    // await bookmarkStore.loadBookmarks() // 方法名可能不同
    console.log('Side Panel初始化完成');
  } catch (error) {
    console.error('加载书签失败:', error);
    showToast('加载书签失败', 'error');
  } finally {
    isLoading.value = false;
  }
});

// 监听搜索变化
watch(searchQuery, () => {
  if (searchQuery.value.trim()) {
    handleSearch();
  }
});
</script>

<style scoped>
.side-panel-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-size: 16px;
  font-weight: 500;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  overflow: hidden;
}

.search-section {
  flex-shrink: 0;
}

.quick-actions {
  flex-shrink: 0;
}

.bookmarks-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--md-sys-color-on-surface-variant);
  gap: 12px;
}

.empty-state p {
  margin: 0;
  text-align: center;
}

.bookmark-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bookmark-item {
  display: flex;
  align-items: center;
  padding: 8px;
  gap: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.bookmark-item:hover {
  background: var(--md-sys-color-surface-variant);
}

.bookmark-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-icon img {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.bookmark-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bookmark-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--md-sys-color-on-surface);
}

.bookmark-url {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
