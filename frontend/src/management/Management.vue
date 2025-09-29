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
import CleanupToolbar from './cleanup/CleanupToolbar.vue';
import CleanupLegend from './cleanup/CleanupLegend.vue';
import CleanupProgress from './cleanup/CleanupProgress.vue';
import CleanupSettings from './cleanup/CleanupSettings.vue';

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

</script>

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
</style>
