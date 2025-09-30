<template>
  <App theme="light" class="app-container">
    <Overlay :show="isPageLoading" persistent class="loading-overlay">
      <Card class="loading-card" elevation="high">
        <div class="loading-content">
          <Spinner color="primary" size="xl" class="loading-spinner" />
          <div class="loading-text">{{ loadingMessage }}</div>
          <div class="loading-subtitle">正在准备您的书签数据...</div>
        </div>
      </Card>
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
                />
              </div>
            </Card>
          </Grid>

          <!-- Center Control Panel -->
          <Grid is="col" cols="2" class="control-panel">
            <div class="control-actions">
              <Button variant="secondary" size="lg" icon class="control-btn" :disabled="true">
                <Icon name="mdi-compare-horizontal" />
              </Button>
              <div class="control-label">对比</div>
              <div class="control-label">应用</div>
            </div>
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
                </div>
              </template>
              <Divider />
              <div class="panel-content">
                 <!-- 语义搜索与混合排序 -->
                 <div class="semantic-search-panel">
                   <div class="semantic-controls">
                     <Input v-model="semanticQuery" placeholder="语义搜索..." variant="outlined" class="semantic-input" />
                     <Input v-model.number="semanticTopK" label="TopK" type="number" min="1" max="200" class="semantic-topk" />
                     <Input v-model.number="semanticMinSim" label="阈值(0-1)" type="number" step="0.05" min="0" max="1" class="semantic-minsim" />
                     <Button :disabled="isSemanticSearching" color="primary" size="sm" class="ml-1" @click="runSemanticSearch">
                       <template #prepend>
                         <Icon name="mdi-magnify" />
                       </template>
                       搜索
                     </Button>
                     <Button variant="text" size="sm" class="ml-1" @click="hybridMode = !hybridMode">混合: {{ hybridMode ? '开' : '关' }}</Button>
                   </div>
                   <div v-if="isSemanticSearching" class="semantic-loading">
                     <Spinner color="primary" size="sm" />
                     <span class="semantic-loading-text">正在进行语义搜索...</span>
                   </div>
                   <div class="semantic-results" v-if="(hybridMode ? combinedResults : semanticResults).length > 0">
                     <div class="semantic-item" v-for="item in (hybridMode ? combinedResults : semanticResults)" :key="item.id" @click="handleSemanticResultClick(item)">
                       <div class="semantic-title">{{ item.title || '未命名' }}</div>
                       <div class="semantic-url" v-if="item.url">{{ item.url }}</div>
                       <div class="semantic-score">相似度: {{ (item.score || 0).toFixed(3) }}</div>
                     </div>
                   </div>
                 </div>
                 <CleanupLegend v-if="cleanupState && cleanupState.isFiltering" />
                <div v-if="newProposalTree.children && newProposalTree.children.length > 0" class="pa-2">
                  <small class="text-grey"> 📊 右侧面板数据: {{ filteredProposalTree.length }} 个顶层文件夹</small>
                </div>
                <SimpleBookmarkTree
                  :nodes="filteredProposalTree"
                  height="100%"
                  size="comfortable"
                  :draggable="!(cleanupState && cleanupState.isFiltering)"
                  :editable="true"
                  :show-toolbar="true"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  @node-edit="handleNodeEdit"
                  @node-delete="handleNodeDelete"
                  @folder-add="handleFolderAdd"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @drag-reorder="handleDragReorder"
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
import { ref, computed, onMounted } from 'vue';
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

// 语义搜索与混合排序状态
const semanticQuery = ref('');
const semanticTopK = ref(50);
const semanticMinSim = ref(0.2);
const hybridMode = ref(true);
const isSemanticSearching = ref(false);
const semanticResults = ref<Array<{ id: string; title?: string; url?: string; domain?: string; score: number }>>([]);
const combinedResults = ref<Array<{ id: string; title?: string; url?: string; domain?: string; score: number }>>([]);
let hybridWorker: Worker | null = null;

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
  try {
    // 初始化混合排序 Web Worker
    hybridWorker = new Worker(new URL('../workers/hybridSearchWorker.ts', import.meta.url), { type: 'module' });
  } catch (e) {
    console.warn('HybridSearchWorker 初始化失败，回退到主线程合并:', e);
    hybridWorker = null;
  }
});

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

// 执行语义搜索与混合排序
const runSemanticSearch = async () => {
  const q = semanticQuery.value.trim();
  if (!q) {
    semanticResults.value = [];
    combinedResults.value = [];
    return;
  }
  isSemanticSearching.value = true;
  try {
    const sem = await unifiedBookmarkAPI.semanticSearch(q, semanticTopK.value);
    const filteredSem = sem.filter(r => (r.score || 0) >= (semanticMinSim.value || 0));
    semanticResults.value = filteredSem;

    if (hybridMode.value) {
      const kw = await unifiedBookmarkAPI.searchBookmarks(q, { limit: 100 });
      if (hybridWorker) {
        const worker = hybridWorker;
        await new Promise<void>((resolve) => {
          const handler = (evt: MessageEvent) => {
            combinedResults.value = (evt.data?.results || []) as any[];
            worker.removeEventListener('message', handler);
            resolve();
          };
          worker.addEventListener('message', handler);
        });
        worker.postMessage({
          keywordResults: kw,
          semanticResults: filteredSem,
          weights: { keyword: 0.4, semantic: 0.6 },
          minCombinedScore: semanticMinSim.value,
        });
      } else {
        // 主线程回退合并
        const semMap = new Map(filteredSem.map(r => [r.id, r]));
        let maxKw = 1;
        kw.forEach(r => { if ((r.score || 0) > maxKw) maxKw = r.score || 1; });
        const idSet = new Set<string>();
        kw.forEach(r => idSet.add(r.bookmark.id));
        filteredSem.forEach(r => idSet.add(r.id));
        const merged: Array<{ id: string; title?: string; url?: string; domain?: string; score: number }> = [];
        idSet.forEach((id) => {
          const kwItem = kw.find(x => x.bookmark.id === id);
          const semItem = semMap.get(id);
          const kwScoreNorm = kwItem ? ((kwItem.score || 0) / (maxKw || 1)) : 0;
          const semScore = semItem ? (semItem.score || 0) : 0;
          const score = (0.4 * kwScoreNorm) + (0.6 * semScore);
          if (score >= (semanticMinSim.value || 0)) {
            merged.push({
              id,
              title: kwItem?.bookmark.title ?? semItem?.title,
              url: kwItem?.bookmark.url ?? semItem?.url,
              domain: kwItem?.bookmark.domain ?? semItem?.domain,
              score,
            });
          }
        });
        merged.sort((a, b) => b.score - a.score);
        combinedResults.value = merged;
      }
    } else {
      combinedResults.value = [];
    }
  } catch (error: any) {
    showNotification(`语义搜索失败：${error?.message || String(error)}`, 'error');
  } finally {
    isSemanticSearching.value = false;
  }
};

const handleSemanticResultClick = (item: any) => {
  if (item?.url) {
    window.open(item.url, '_blank');
  }
};

</script>

<style scoped>
.ai-status-right {
  margin-left: 12px;
}
</style>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-card {
  padding: 48px;
  text-align: center;
}

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
  flex: 1;
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
