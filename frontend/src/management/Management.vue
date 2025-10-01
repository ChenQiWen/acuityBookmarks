<template>
  <App theme="light" class="app-container">
    <Overlay :show="isPageLoading" persistent :opacity="0.12" :blur="true">
      <div class="loading-content">
        <Spinner color="primary" size="xl" class="loading-spinner" />
        <div class="loading-text">{{ loadingMessage }}</div>
      </div>
    </Overlay>

    <AppBar app flat class="app-bar-style">
      <template #title>
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">AcuityBookmarks</div>
      </template>
      <template #actions>
        <div v-if="!isPageLoading" class="app-bar-search-container">
          <BookmarkSearchBox
            v-model="searchQuery"
            placeholder="搜索书签..."
            class="app-bar-search-input"
            :enableSemanticSearch="true"
            :enableHybridMode="true"
            :showDebugToggle="true"
            @result-click="handleSearchResultClick"
          />
        </div>
        <Button
          size="sm"
          color="primary"
          variant="outline"
          class="ml-2"
          :disabled="isGeneratingEmbeddings"
          @click="generateEmbeddings"
        >
          <template #prepend>
            <Icon name="mdi-brain" />
          </template>
          生成嵌入
        </Button>
        <Button
          size="sm"
          color="warning"
          variant="text"
          class="ml-1"
          :disabled="isGeneratingEmbeddings"
          @click="forceOverwriteEmbeddings = !forceOverwriteEmbeddings"
        >
          覆盖: {{ forceOverwriteEmbeddings ? '开' : '关' }}
        </Button>
        <Spinner v-if="isGeneratingEmbeddings" color="primary" size="sm" class="ml-2" />
        <AIStatusBadge class="ai-status-right" />
      </template>
    </AppBar>

    <Main with-app-bar padding class="main-content">
      <Grid is="container" fluid class="fill-height management-container">
        <Grid is="row" class="fill-height" align="stretch">
          <!-- Left Panel -->
          <Grid is="col" cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <Icon name="mdi-folder-open-outline" color="primary" />
                  <span class="panel-title">当前书签目录</span>
                  <div class="panel-stats" :title="`包含 ${stats.original.bookmarks} 条书签，${stats.original.folders} 个文件夹`">
                    <span class="stats-bookmarks">{{ stats.original.bookmarks }}</span>
                    <span class="stats-separator">/</span>
                    <span class="stats-folders">{{ stats.original.folders }}</span>
                  </div>
                  <Button
                    variant="text"
                    size="sm"
                    icon
                    title="一键展开/收起"
                    :disabled="isPageLoading"
                    @click="toggleLeftExpandAll"
                  >
                    <span class="expand-toggle-icon" :class="{ expanded: leftExpandAll, expanding: isPageLoading }">
                      <Icon :name="leftExpandAll ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'" />
                    </span>
                  </Button>
                </div>
              </template>
              <Divider />
              <div class="panel-content" ref="leftPanelRef">
                <div v-if="originalTree.length === 0" class="empty-state">
                  <Icon :name="'mdi-folder-outline'" :size="48" color="secondary" />
                  <div class="empty-text">正在加载书签数据...</div>
                </div>
                <SimpleBookmarkTree
                  :nodes="originalTree"
                  height="100%"
                  size="comfortable"
                  :editable="false"
                  :show-toolbar="false"
                  :initial-expanded="Array.from(originalExpandedFolders)"
                  ref="leftTreeRef"
                />
              </div>
            </Card>
          </Grid>

          
          <!-- Middle Control Panel -->
          <Grid is="col" cols="2" class="panel-col">
            <Card class="panel-card" elevation="low">
              <div class="panel-content control-panel">
                <div class="control-actions">
                  <Button variant="ghost" size="lg" @click="handleCompare">
                    <template #prepend>
                      <Icon name="mdi-compare" />
                    </template>
                    对比
                  </Button>
                  <Button variant="ghost" size="lg" color="primary" @click="handleApply">
                    <template #prepend>
                      <Icon name="mdi-playlist-check" />
                    </template>
                    应用
                  </Button>
                  <div class="control-label">对比/应用操作</div>
                </div>
              </div>
            </Card>
          </Grid>

          <!-- Right Panel -->
          <Grid is="col" cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <Icon :name="getProposalPanelIcon()" :color="getProposalPanelColor()" />
                  <span class="panel-title">{{ getProposalPanelTitle() }}</span>
                   <div v-if="stats.proposed.total > 0" class="panel-stats">
                    <span class="stats-bookmarks">{{ stats.proposed.bookmarks }}</span>
                    <span class="stats-separator">/</span>
                    <span class="stats-folders">{{ stats.proposed.folders }}</span>
                    <span v-if="stats.difference.total !== 0" :class="['stats-change', stats.difference.total > 0 ? 'stats-increase' : 'stats-decrease']">
                      {{ stats.difference.total > 0 ? '+' : '' }}{{ stats.difference.total }}
                   </span>
                  </div>
                  <CleanupToolbar v-if="newProposalTree.children && newProposalTree.children.length > 0" />
                  <Button
                    variant="text"
                    size="sm"
                    icon
                    title="一键展开/收起"
                    :disabled="isPageLoading"
                    @click="toggleRightExpandAll"
                  >
                    <span class="expand-toggle-icon" :class="{ expanded: rightExpandAll, expanding: isPageLoading }">
                      <Icon :name="rightExpandAll ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'" />
                    </span>
                  </Button>
                </div>
              </template>
              <Divider />
              <div class="panel-content">
                 <CleanupLegend v-if="cleanupState && cleanupState.isFiltering" />
                
                <SimpleBookmarkTree
                  :nodes="filteredProposalTree"
                  height="100%"
                  size="comfortable"
                  :draggable="!(cleanupState && cleanupState.isFiltering)"
                  :editable="true"
                  :show-toolbar="true"
                  :toolbar-expand-collapse="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  @node-edit="handleNodeEdit"
                  @node-delete="handleNodeDelete"
                  @folder-add="handleFolderAdd"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @drag-reorder="handleDragReorder"
                  ref="rightTreeRef"
                />
              </div>
            </Card>
          </Grid>
        </Grid>
      </Grid>
    </Main>

    <Toast v-model:show="snackbar" :text="snackbarText" :color="snackbarColor" :timeout="2000" />
    <CleanupProgress />
    <CleanupSettings />

    <!-- Edit Bookmark Dialog -->
    <Dialog :show="isEditBookmarkDialogOpen" @update:show="isEditBookmarkDialogOpen = false" title="编辑书签" icon="mdi-pencil">
      <div class="edit-form">
          <Input v-model="editTitle" label="书签标题" variant="outlined" class="form-field" />
          <Input v-model="editUrl" label="书签链接" variant="outlined" type="url" class="form-field" />
      </div>
      <template #actions>
        <Button variant="text" @click="isEditBookmarkDialogOpen = false">取消</Button>
        <Button color="primary" @click="() => {} /* TODO: save edit */">保存</Button>
      </template>
    </Dialog>

    <!-- Add New Item Dialog -->
    <Dialog :show="isAddNewItemDialogOpen" @update:show="isAddNewItemDialogOpen = false" title="添加新项目">
       <div class="add-item-form">
          <Tabs v-model="addItemType" :tabs="[{value: 'bookmark', text: '书签'}, {value: 'folder', text: '文件夹'}]" grow />
          <div class="form-fields">
            <Input v-model="newItemTitle" label="标题" variant="outlined" class="form-field" autofocus />
            <Input v-if="addItemType === 'bookmark'" v-model="newItemUrl" label="链接地址" variant="outlined" type="url" class="form-field" />
          </div>
       </div>
      <template #actions>
        <Button variant="text" @click="isAddNewItemDialogOpen = false">取消</Button>
        <Button color="primary" @click="() => {} /* TODO: save new item */">添加</Button>
      </template>
    </Dialog>

  </App>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useManagementStore } from '../stores/management-store';
import { 
  App, Main, AppBar, Button, Card, Grid, Icon, Divider, Overlay, Spinner, Toast, Dialog, Tabs, Input
} from '../components/ui';
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue';
import BookmarkSearchBox from '../components/BookmarkSearchBox.vue';
import AIStatusBadge from '../components/AIStatusBadge.vue';
import CleanupToolbar from './cleanup/CleanupToolbar.vue';
import CleanupLegend from './cleanup/CleanupLegend.vue';
import CleanupProgress from './cleanup/CleanupProgress.vue';
import CleanupSettings from './cleanup/CleanupSettings.vue';
import { unifiedBookmarkAPI } from '../utils/unified-bookmark-api';

const managementStore = useManagementStore();

const {
  originalTree,
  newProposalTree,
  isPageLoading,
  loadingMessage,
  snackbar,
  snackbarText,
  snackbarColor,
  originalExpandedFolders,
  proposalExpandedFolders,
  cleanupState,
  isEditBookmarkDialogOpen,
  editTitle,
  editUrl,
  isAddNewItemDialogOpen,
  addItemType,
  newItemTitle,
  newItemUrl,
} = storeToRefs(managementStore);

const {
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor,
  initialize: initializeStore,
  editBookmark,
  deleteBookmark,
  deleteFolder,
  handleReorder,
  showNotification,
  openAddNewItemDialog,
} = managementStore;

const leftPanelRef = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const isGeneratingEmbeddings = ref(false);
const forceOverwriteEmbeddings = ref(false);
// 一键展开/收起 - 状态与引用
const leftTreeRef = ref<any | null>(null)
const rightTreeRef = ref<any | null>(null)
const leftExpandAll = ref(false)
const rightExpandAll = ref(false)
// 防止并发触发导致状态错乱或视觉异常（如蒙层显得加深）
const isExpanding = ref(false)
// 局部蒙层已移除，统一复用全局 isPageLoading

const stats = computed(() => {
    const original = { bookmarks: 0, folders: 0, total: 0 };
    const proposed = { bookmarks: 0, folders: 0, total: 0 };

    function count(nodes: any[]) {
        let bookmarks = 0, folders = 0;
        for (const node of nodes) {
            if (node.url) bookmarks++;
            else {
                folders++;
                if (node.children) {
                    const counts = count(node.children);
                    bookmarks += counts.bookmarks;
                    folders += counts.folders;
                }
            }
        }
        return { bookmarks, folders, total: bookmarks + folders };
    }

    if (originalTree.value) {
        const o = count(originalTree.value);
        original.bookmarks = o.bookmarks;
        original.folders = o.folders;
        original.total = o.total;
    }
    if (newProposalTree.value && newProposalTree.value.children) {
        const p = count(newProposalTree.value.children);
        proposed.bookmarks = p.bookmarks;
        proposed.folders = p.folders;
        proposed.total = p.total;
    }

    return {
        original,
        proposed,
        difference: {
            bookmarks: proposed.bookmarks - original.bookmarks,
            folders: proposed.folders - original.folders,
            total: proposed.total - original.total,
        }
    };
});

const filteredProposalTree = computed(() => {
  return newProposalTree.value.children || [];
});

const handleSearchResultClick = (result: any) => {
  console.log('Search result clicked:', result);
};

const handleNodeEdit = (node: any) => {
  editBookmark(node);
};

const handleNodeDelete = (node: any) => {
  if (node.children) {
    deleteFolder(node);
  } else {
    deleteBookmark(node);
  }
};

const handleFolderAdd = (node: any) => {
  openAddNewItemDialog('folder', node);
};

const handleBookmarkOpenNewTab = (node: any) => {
  if (node.url) {
    window.open(node.url, '_blank');
  }
};

const handleBookmarkCopyUrl = (node: any) => {
  if (node.url) {
    navigator.clipboard.writeText(node.url);
    showNotification('URL copied!', 'success');
  }
};

const handleDragReorder = (dragData: any, targetNode: any, dropPosition: string) => {
  handleReorder({
    nodeId: dragData.nodeId,
    newParentId: dropPosition === 'inside' ? targetNode.id : targetNode.parentId,
    newIndex: 0, // Simplified for now
  });
};

onMounted(() => {
  initializeStore();
});

// 一键展开/收起 - 事件处理
const toggleLeftExpandAll = async () => {
  if (!leftTreeRef.value) return
  if (isExpanding.value) return
  isExpanding.value = true
  isPageLoading.value = true
  loadingMessage.value = leftExpandAll.value ? '正在收起...' : '正在展开...'
  // 让出两帧以确保蒙层先绘制（处理主线程阻塞导致的晚出现）
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 0))
  if (leftExpandAll.value) {
    leftTreeRef.value.collapseAll()
    leftExpandAll.value = false
  } else {
    leftTreeRef.value.expandAll()
    leftExpandAll.value = true
  }
  requestAnimationFrame(() => { 
    isPageLoading.value = false
    isExpanding.value = false
  })
}

const toggleRightExpandAll = async () => {
  if (!rightTreeRef.value) return
  if (isExpanding.value) return
  isExpanding.value = true
  isPageLoading.value = true
  loadingMessage.value = rightExpandAll.value ? '正在收起...' : '正在展开...'
  // 让出两帧以确保蒙层先绘制（处理主线程阻塞导致的晚出现）
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 0))
  if (rightExpandAll.value) {
    rightTreeRef.value.collapseAll()
    rightExpandAll.value = false
  } else {
    rightTreeRef.value.expandAll()
    rightExpandAll.value = true
  }
  requestAnimationFrame(() => { 
    isPageLoading.value = false
    isExpanding.value = false
  })
}

const generateEmbeddings = async () => {
  try {
    isGeneratingEmbeddings.value = true;
    loadingMessage.value = '正在批量生成嵌入向量...';
    isPageLoading.value = true;
    const res = await unifiedBookmarkAPI.generateEmbeddings(forceOverwriteEmbeddings.value);
    if (res.success) {
      showNotification(`嵌入生成完成：${res.processed}/${res.total}，耗时 ${Math.round((res.duration || 0) / 1000)}s`, 'success');
    } else {
      showNotification(`嵌入生成失败：${res.error || '未知错误'}`, 'error');
    }
  } catch (error: any) {
    showNotification(`嵌入生成失败：${error?.message || String(error)}`, 'error');
  } finally {
    isPageLoading.value = false;
    isGeneratingEmbeddings.value = false;
  }
};

// 中间控制区操作（占位实现）
const handleCompare = () => {
  showNotification('对比功能尚未实现', 'info');
};

const handleApply = () => {
  showNotification('应用功能尚未实现', 'info');
};

 

</script>

<style scoped>
.ai-status-right {
  margin-left: 12px;
}
</style>
<style scoped>
.expand-toggle-icon {
  display: inline-flex;
  transition: transform 200ms ease, opacity 200ms ease;
}
.expand-toggle-icon.expanded {
  transform: rotate(180deg);
}
.expand-toggle-icon.expanding {
  opacity: 0.85;
}
</style>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
}

/* 使用 Overlay 组件自身的全屏蒙版，已通过 props 统一透明度与模糊 */

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.loading-text {
  font-size: 1.2rem;
  font-weight: 500;
}

.loading-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.app-bar-style {
  border-bottom: 1px solid var(--color-border);
}

.app-bar-logo {
  height: 32px;
  margin-right: 16px;
}

.app-bar-title-text {
  font-weight: 600;
  font-size: 1.2rem;
}

.app-bar-search-container {
  width: 400px;
}

.main-content {
  flex: none;
  height: calc(100vh - 64px);
  overflow: hidden;
}

.management-container {
  height: 100%;
}

.panel-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.panel-title {
  font-weight: 600;
  flex: 1;
}

.panel-stats {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.stats-separator {
  margin: 0 4px;
}

.stats-change {
  margin-left: 8px;
  font-weight: 500;
}

.stats-increase {
  color: var(--color-success);
}

.stats-decrease {
  color: var(--color-error);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.control-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  gap: 16px;
}

.edit-form, .add-item-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-fields {
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 语义搜索样式 */
.semantic-search-panel {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}
.semantic-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.semantic-input { flex: 1; min-width: 160px; }
.semantic-topk { width: 120px; }
.semantic-minsim { width: 140px; }
.semantic-loading { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.semantic-loading-text { font-size: 0.85rem; color: var(--color-text-secondary); }
.semantic-results { padding: 8px 0; display: grid; grid-template-columns: 1fr; gap: 6px; }
.semantic-item { padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; }
.semantic-item:hover { background: rgba(0,0,0,0.03); }
.semantic-title { font-weight: 500; }
.semantic-url { font-size: 0.85rem; color: var(--color-text-secondary); }
.semantic-score { font-size: 0.8rem; color: var(--color-text-secondary); }
</style>
