<template>
  <App theme="light" class="app-container">
    <Overlay :show="isPageLoading" persistent :opacity="0.12" :blur="true">
      <div class="loading-content">
        <Spinner color="primary" size="xl" class="loading-spinner" />
        <div class="loading-text">{{ loadingMessage }}</div>
      </div>
    </Overlay>

    <AppBar app flat class="app-bar-style">
      <template #prepend>
        <ThemeSwitcher class="theme-switcher-top" />
      </template>
      <template #title>
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">AcuityBookmarks</div>
      </template>
      <template #actions>
        <div v-if="!isPageLoading" class="app-bar-search-container">
          <BookmarkSearchBox v-model="searchQuery" placeholder="搜索书签..." class="app-bar-search-input"
            :enableSemanticSearch="true" :enableHybridMode="true" :showDebugToggle="true"
            @result-click="handleSearchResultClick" />
        </div>
        <Button size="sm" color="primary" variant="outline" class="ml-2" :disabled="isGeneratingEmbeddings"
          @click="generateEmbeddings">
          <template #prepend>
            <Icon name="mdi-brain" />
          </template>
          生成嵌入
        </Button>
        <Button size="sm" color="warning" variant="text" class="ml-1" :disabled="isGeneratingEmbeddings"
          @click="forceOverwriteEmbeddings = !forceOverwriteEmbeddings">
          覆盖: {{ forceOverwriteEmbeddings ? '开' : '关' }}
        </Button>
        <Spinner v-if="isGeneratingEmbeddings" color="primary" size="sm" class="ml-2" />
        
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
                  <div class="panel-title-section">
                    <Icon name="mdi-folder-open-outline" color="primary" />
                    <span class="panel-title">当前书签</span>
                  </div>
                  <Button variant="text" size="sm" icon title="一键展开/收起" :disabled="isPageLoading"
                    @click="toggleLeftExpandAll">
                    <span class="expand-toggle-icon" :class="{ expanded: leftExpandAll, expanding: isPageLoading }">
                      <Icon :name="leftExpandAll ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'" />
                    </span>
                  </Button>
                </div>
              </template>
<div class="panel-content">
                <SimpleBookmarkTree source="management" height="100%" size="comfortable" :editable="false"
                  :show-toolbar="false" :initial-expanded="Array.from(originalExpandedFolders)" @ready="handleLeftTreeReady" ref="leftTreeRef" />
              </div>
            </Card>
          </Grid>


          <!-- Middle Control Panel -->
          <Grid is="col" cols="2" class="panel-col">
            <Card class="panel-card fill-height" elevation="low" borderless :padding="false">
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
                </div>
              </div>
            </Card>
          </Grid>

          <!-- Right Panel -->
          <Grid is="col" cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">

                  <div class="panel-title-section">
                    <Icon :name="getProposalPanelIcon()" :color="getProposalPanelColor()" />
                    <span class="panel-title">{{ getProposalPanelTitle() }}</span>
                  </div>
              <div class="panel-title-section">
                  <CleanupToolbar v-if="newProposalTree.children && newProposalTree.children.length > 0" />
                  <Button variant="text" size="sm" icon title="一键展开/收起" :disabled="isPageLoading"
                    @click="toggleRightExpandAll">
                    <span class="expand-toggle-icon" :class="{ expanded: rightExpandAll, expanding: isPageLoading }">
                      <Icon :name="rightExpandAll ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'" />
                    </span>
                  </Button>
                  <!-- 悬停折叠开关：悬停时是否排他折叠其它分支 -->
                  <Button variant="text" size="sm" icon :disabled="isPageLoading" title="悬停时排他折叠"
                    @click="hoverExclusiveCollapse = !hoverExclusiveCollapse">
                    <span class="expand-toggle-icon" :class="{ expanding: isPageLoading }">
                      <Icon :name="hoverExclusiveCollapse ? 'mdi-lock' : 'mdi-lock-open-outline'" />
                    </span>
                  </Button>
              </div>
                </div>
              </template>
              <div class="panel-content">
                <CleanupLegend v-if="cleanupState && cleanupState.isFiltering" />

                <SimpleBookmarkTree :nodes="filteredProposalTree" height="100%" size="comfortable"
                  :draggable="!(cleanupState && cleanupState.isFiltering)" :editable="true" :show-toolbar="true"
                  :toolbar-expand-collapse="false" :initial-expanded="Array.from(proposalExpandedFolders)"
                  @node-edit="handleNodeEdit" @node-delete="handleNodeDelete" @folder-add="handleFolderAdd"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab" @bookmark-copy-url="handleBookmarkCopyUrl"
                  @drag-reorder="handleDragReorder" @node-hover="handleRightNodeHover" @node-hover-leave="handleRightNodeHoverLeave" ref="rightTreeRef" />
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
    <ConfirmableDialog
      :show="isEditBookmarkDialogOpen"
      @update:show="(v) => (isEditBookmarkDialogOpen = v)"
      @confirm="confirmEditBookmark"
      title="编辑书签"
      icon="mdi-pencil"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_EDIT"
      :is-dirty="isEditDirty"
      max-width="500px"
      min-width="500px">
      <div class="edit-form">
        <Input
          v-model="editTitle"
          label="书签标题"
          variant="outlined"
          class="form-field"
          :error="!!editFormErrors.title"
          :error-message="editFormErrors.title"
        />
        <UrlInput
          v-model="editUrl"
          label="书签链接"
          variant="outlined"
          density="compact"
          :error="!!editFormErrors.url"
          :error-message="editFormErrors.url"
        />
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button color="primary" :disabled="!isEditDirty" @click="confirmEditBookmark">更新</Button>
      </template>
    </ConfirmableDialog>
    
    <!-- Edit Folder Dialog -->
    <ConfirmableDialog
      :show="isEditFolderDialogOpen"
      @update:show="(v) => (isEditFolderDialogOpen = v)"
      @confirm="confirmEditFolder"
      title="编辑文件夹"
      icon="mdi-folder-edit"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_EDIT"
      :is-dirty="isEditFolderDirty"
      max-width="500px"
      min-width="500px">
      <div class="edit-form">
        <Input
          v-model="editFolderTitle"
          label="文件夹标题"
          variant="outlined"
          class="form-field"
          :error="!!folderEditFormErrors.title"
          :error-message="folderEditFormErrors.title"
        />
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button color="primary" :disabled="!isEditFolderDirty" @click="confirmEditFolder">更新</Button>
      </template>
    </ConfirmableDialog>

    <!-- Delete Folder Confirm Dialog (统一为 ConfirmableDialog) -->
    <ConfirmableDialog
      :show="isConfirmDeleteDialogOpen"
      @update:show="(v) => (isConfirmDeleteDialogOpen = v)"
      @confirm="confirmDeleteFolder"
      :esc-to-close="true"
      title="确认删除"
      icon="mdi-delete"
      :persistent="true"
      :enable-cancel-guard="false"
      max-width="480px"
      min-width="480px">
      <div class="confirm-content">
        是否确认删除该目录及其包含的 {{ deleteFolderBookmarkCount }} 条书签？
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button color="error" @click="confirmDeleteFolder">确认删除</Button>
      </template>
    </ConfirmableDialog>

    <!-- Add New Item Dialog -->
    <ConfirmableDialog
      :show="isAddNewItemDialogOpen"
      @update:show="(v) => (isAddNewItemDialogOpen = v)"
      @confirm="confirmAddNewItem"
      :title="addDialogTitle"
      :icon="addDialogIcon"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_ADD"
      :is-dirty="isAddDirty"
      :body-min-height="addDialogMinHeight"
      max-width="500px"
      min-width="500px">
      <div class="add-item-form" ref="addDialogContentRef">
        <Tabs v-model="addItemType" :tabs="[{ value: 'bookmark', text: '书签' }, { value: 'folder', text: '文件夹' }]"
          grow />
        <div class="form-fields">
          <Input
            v-model="newItemTitle"
            label="标题"
            variant="outlined"
            class="form-field"
            autofocus
            :error="!!addFormErrors.title"
            :error-message="addFormErrors.title"
          />
          <UrlInput
            v-if="addItemType === 'bookmark'"
            v-model="newItemUrl"
            label="链接地址"
            variant="outlined"
            density="compact"
            class="form-field"
            :error="!!addFormErrors.url"
            :error-message="addFormErrors.url"
          />
        </div>
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button color="primary" @click="confirmAddNewItem">{{ addConfirmText }}</Button>
      </template>
    </ConfirmableDialog>

    <!-- External Update Prompt (不可取消) -->
    <Dialog
      :show="showUpdatePrompt"
      :title="'外部已更新书签，需立即刷新'"
      icon="mdi-sync-alert"
      :persistent="true"
      :cancelable="false"
      :esc-to-close="false"
      :enter-to-confirm="false"
      max-width="500px"
      min-width="500px">
      <div class="update-prompt-content">
        <p>{{ updatePromptMessage }}</p>
        <div class="update-detail" v-if="pendingUpdateDetail">
          <small>类型：{{ pendingUpdateDetail.eventType }}，ID：{{ pendingUpdateDetail.id }}</small>
        </div>
      </div>
      <template #actions>
        <Button color="primary" @click="confirmExternalUpdate">理解并更新</Button>
      </template>
    </Dialog>

  </App>
</template>

<script setup lang="ts">
import ThemeSwitcher from '../components/ThemeSwitcher.vue'
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useManagementStore } from '../stores/management-store';
import {
  App, Main, AppBar, Button, Card, Grid, Icon, Overlay, Spinner, Toast, Dialog, Tabs, Input, UrlInput
} from '../components/ui';
import ConfirmableDialog from '../components/ui/ConfirmableDialog.vue';
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue';
import BookmarkSearchBox from '../components/BookmarkSearchBox.vue';
import CleanupToolbar from './cleanup/CleanupToolbar.vue';
import CleanupLegend from './cleanup/CleanupLegend.vue';
import CleanupProgress from './cleanup/CleanupProgress.vue';
import CleanupSettings from './cleanup/CleanupSettings.vue';
import { unifiedBookmarkAPI } from '../utils/unified-bookmark-api';
// 导入现代书签服务：以 side-effect 方式初始化并设置事件监听与消息桥接
import '../services/modern-bookmark-service';
import { DataValidator } from '../utils/error-handling';

const managementStore = useManagementStore();

const {
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
  editingBookmark,
  editTitle,
  editUrl,
  // 文件夹编辑
  isEditFolderDialogOpen,
  editingFolder,
  editFolderTitle,
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
  editFolder,
  deleteBookmark,
  deleteFolder,
  handleReorder,
  showNotification,
  openAddNewItemDialog,
} = managementStore;

// 统一的确认文案（减少重复与便于维护）
const MSG_CANCEL_EDIT = '您有更改尚未保存，确定取消并丢弃更改吗？';
const MSG_CANCEL_ADD = '您有更改尚未添加，确定取消并丢弃输入吗？';

// 统一文案由 ConfirmableDialog 使用，已移除旧的通用处理函数
// === 添加新项目对话框：标题/图标随 Tab，但底部按钮固定文案 ===
const addDialogTitle = computed(() => addItemType.value === 'bookmark' ? '添加新书签' : '添加新文件夹');
const addDialogIcon = computed(() => addItemType.value === 'bookmark' ? 'mdi-bookmark-plus' : 'mdi-folder-plus');
// 按需求固定为“添加”，不随 Tab 切换变化
const addConfirmText = computed(() => '添加');

// 为固定弹窗高度：以“书签”Tab 的内容高度为准
const addDialogContentRef = ref<HTMLElement | null>(null);
const addDialogMinHeight = ref<string | undefined>(undefined);

// 在弹窗打开后测量当前内容高度（通常为“书签”Tab）并固定
watch(isAddNewItemDialogOpen, async (open) => {
  if (open) {
    await nextTick();
    requestAnimationFrame(() => {
      const el = addDialogContentRef.value;
      if (el) {
        const h = el.offsetHeight;
        if (h && h > 0) {
          addDialogMinHeight.value = `${h}px`;
        }
      }
    });
  } else {
    // 关闭时恢复默认，避免残留影响下次弹窗
    addDialogMinHeight.value = undefined;
  }
});

// 已移除未使用的 leftPanelRef，减少无意义的响应式状态
const searchQuery = ref('');
const isGeneratingEmbeddings = ref(false);
const forceOverwriteEmbeddings = ref(false);
// 🔔 外部变更更新提示
const showUpdatePrompt = ref(false);
const pendingUpdateDetail = ref<any>(null);
const updatePromptMessage = ref(
  '检测到外部书签发生变更。为避免基于旧数据继续编辑导致冲突，需刷新到最新数据后再继续。'
);
// 一键展开/收起 - 状态与引用
const leftTreeRef = ref<any | null>(null)
const rightTreeRef = ref<any | null>(null)
const leftExpandAll = ref(false)
const rightExpandAll = ref(false)

// 悬停折叠开关（默认关闭：悬停只滚动与高亮，不改变结构）
const hoverExclusiveCollapse = ref(false)
// 右侧悬停 -> 左侧联动 的防抖与去重，避免频繁渲染和滚动抖动
let hoverDebounceTimer: number | null = null
let lastHoverId: string | null = null
// 防止并发触发导致状态错乱或视觉异常（如蒙层显得加深）
const isExpanding = ref(false)
// 局部蒙层已移除，统一复用全局 isPageLoading

// 已移除顶部数量展示，相关统计计算不再需要

// === 表单内联错误状态（顶层） ===
const editFormErrors = ref<{ title: string; url: string }>({ title: '', url: '' });
const addFormErrors = ref<{ title: string; url: string }>({ title: '', url: '' });

// 输入时动态清除错误提示
watch(editUrl, (val) => {
  if (editFormErrors.value.url && (val || '').trim()) {
    editFormErrors.value.url = '';
  }
});
watch(newItemUrl, (val) => {
  if (addFormErrors.value.url && (val || '').trim()) {
    addFormErrors.value.url = '';
  }
});
// 标题输入时清除错误
watch(editTitle, (val) => {
  if (editFormErrors.value.title && (val || '').trim()) {
    editFormErrors.value.title = '';
  }
});
watch(newItemTitle, (val) => {
  if (addFormErrors.value.title && (val || '').trim()) {
    addFormErrors.value.title = '';
  }
});
// Tab 切换时清空输入内容与错误
watch(addItemType, () => {
  if (!isAddNewItemDialogOpen.value) return;
  newItemTitle.value = '';
  newItemUrl.value = '';
  addFormErrors.value.title = '';
  addFormErrors.value.url = '';
});

const filteredProposalTree = computed(() => {
  return newProposalTree.value.children || [];
});

// 组件就绪：左侧目录树加载完成后，解除页面加载态（仅在加载中时）
const handleLeftTreeReady = () => {
  if (isPageLoading.value) {
    isPageLoading.value = false;
  }
}

// === 新增对话框脏状态：仅输入内容发生变化时提示二次确认 ===
const isAddDirty = computed(() => {
  const t = (newItemTitle.value || '').trim();
  const u = (newItemUrl.value || '').trim();
  if (addItemType.value === 'bookmark') {
    return !!t || !!u;
  }
  // 文件夹仅标题
  return !!t;
});

// === 编辑对话框脏状态：仅当标题或链接发生变化时视为已更改 ===
const isEditDirty = computed(() => {
  const originalTitle = (editingBookmark.value?.title || '').trim();
  const originalUrl = (editingBookmark.value?.url || '').trim();
  const curTitle = (editTitle.value || '').trim();
  const curUrl = (editUrl.value || '').trim();
  return originalTitle !== curTitle || originalUrl !== curUrl;
});

// === 编辑文件夹对话框脏状态与错误 ===
const isEditFolderDirty = computed(() => {
  const originalTitle = (editingFolder.value?.title || '').trim();
  const curTitle = (editFolderTitle.value || '').trim();
  return originalTitle !== curTitle;
});
const folderEditFormErrors = ref<{ title: string }>({ title: '' });
watch(editFolderTitle, (val) => {
  if (folderEditFormErrors.value.title && (val || '').trim()) {
    folderEditFormErrors.value.title = '';
  }
});

// 🗑️ 删除确认对话框状态
const isConfirmDeleteDialogOpen = ref(false);
const deleteTargetFolder = ref<any | null>(null);
const deleteFolderBookmarkCount = ref(0);

const handleSearchResultClick = (result: any) => {
  console.log('Search result clicked:', result);
};

const handleNodeEdit = (node: any) => {
  if (node?.url) {
    editBookmark(node);
  } else {
    editFolder(node);
  }
};

const handleNodeDelete = (node: any) => {
  if (node.children) {
    // 统计该目录下的书签数量（递归）
    const countBookmarks = (nodes: any[]): number => {
      if (!Array.isArray(nodes)) return 0;
      let total = 0;
      for (const n of nodes) {
        if (n?.url) total++;
        if (n?.children && n.children.length) total += countBookmarks(n.children);
      }
      return total;
    };
    const count = countBookmarks(node.children || []);
    if (count > 0) {
      deleteTargetFolder.value = node;
      deleteFolderBookmarkCount.value = count;
      isConfirmDeleteDialogOpen.value = true;
    } else {
      deleteFolder(node);
    }
  } else {
    deleteBookmark(node);
  }
};

const handleFolderAdd = (node: any) => {
  openAddNewItemDialog('bookmark', node);
};

const handleBookmarkOpenNewTab = (node: any) => {
  if (node.url) {
    window.open(node.url, '_blank');
  }
};

// === 对话框键盘绑定与提交/取消 ===
const confirmAddNewItem = async () => {
  // 标题必填校验（书签与文件夹通用）
  const title = (newItemTitle.value || '').trim();
  if (!title) {
    addFormErrors.value.title = '标题不能为空';
    return;
  }
  // 表单校验：仅在书签模式下校验 URL
  if (addItemType.value === 'bookmark') {
    const url = (newItemUrl.value || '').trim();
    if (!DataValidator.validateUrl(url)) {
      // 显示内联错误并阻止保存
      addFormErrors.value.url = '链接地址格式不正确。示例：https://example.com/path';
      return;
    }
  }
  // 暂存到右侧面板
  const res = managementStore.confirmAddNewItemStaged();
  // 自动滚动并高亮定位到新节点
  if (res && rightTreeRef.value && typeof rightTreeRef.value.focusNodeById === 'function') {
    await nextTick();
    try {
      await rightTreeRef.value.focusNodeById(res.id, { pathIds: res.pathIds, collapseOthers: true, scrollIntoViewCenter: true })
    } catch (e) {
      console.error('新增后定位失败:', e)
    }
  }
};

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

const confirmEditBookmark = () => {
  // 未发生更改则不提交
  if (!isEditDirty.value) return;
  // 标题必填校验
  const title = (editTitle.value || '').trim();
  if (!title) {
    editFormErrors.value.title = '标题不能为空';
    return;
  }
  // 表单校验：编辑书签时校验 URL
  const url = (editUrl.value || '').trim();
  if (!DataValidator.validateUrl(url)) {
    editFormErrors.value.url = '链接地址格式不正确。示例：https://example.com/path';
    return;
  }
  managementStore.saveEditedBookmark();
};

const confirmEditFolder = () => {
  if (!isEditFolderDirty.value) return;
  const title = (editFolderTitle.value || '').trim();
  if (!title) {
    folderEditFormErrors.value.title = '标题不能为空';
    return;
  }
  managementStore.saveEditedFolder();
};

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

// 统一关闭确认由 ConfirmableDialog 托管

// === 删除确认对话框：确认与取消 ===
const confirmDeleteFolder = () => {
  if (deleteTargetFolder.value) {
    deleteFolder(deleteTargetFolder.value);
  }
  isConfirmDeleteDialogOpen.value = false;
  deleteTargetFolder.value = null;
  deleteFolderBookmarkCount.value = 0;
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

// 键盘行为统一由 Dialog 组件处理（Enter=confirm，Esc=close）

onMounted(() => {
  initializeStore();

  // 未保存更改离开提醒
  managementStore.attachUnsavedChangesGuard();

  // ✅ 实时同步：监听来自后台/书签API的变更事件（提示确认）
  const handleBookmarkUpdated = (evt: Event) => {
    const detail = (evt as any)?.detail ?? {};
    pendingUpdateDetail.value = detail;
    showUpdatePrompt.value = true;
    showNotification('检测到外部书签变更', 'info');
  };
  window.addEventListener('acuity-bookmark-updated', handleBookmarkUpdated as (e: Event) => void);

  // 组件卸载时清理监听器
  onUnmounted(() => {
    window.removeEventListener('acuity-bookmark-updated', handleBookmarkUpdated as (e: Event) => void);
    managementStore.detachUnsavedChangesGuard();
  });

  // 暴露全局测试方法，便于在浏览器控制台直接调用
  const g = window as any
  g.AB_setFolderExpanded = (id: string, expanded?: boolean) => {
    const comp = leftTreeRef.value
    if (!comp) return
    const sid = String(id)
    // 未传第二个参数时，默认取反（切换）
    if (expanded === undefined) {
      if (typeof comp.toggleFolderById === 'function') comp.toggleFolderById(sid)
      return
    }
    if (expanded) {
      if (typeof comp.expandFolderById === 'function') comp.expandFolderById(sid)
    } else {
      if (typeof comp.collapseFolderById === 'function') comp.collapseFolderById(sid)
    }
  }
  g.AB_toggleFolder = (id: string) => {
    const comp = leftTreeRef.value
    if (!comp) return
    const sid = String(id)
    if (typeof comp.toggleFolderById === 'function') comp.toggleFolderById(sid)
  }
  g.AB_focusBookmark = (id: string, opts?: { collapseOthers?: boolean; scrollIntoViewCenter?: boolean; pathIds?: string[] }) => {
    const comp = leftTreeRef.value
    if (!comp || !comp.focusNodeById) return
    comp.focusNodeById(String(id), opts || { collapseOthers: true, scrollIntoViewCenter: true })
  }
})


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

// 📣 更新提示动作（简化为“同步 + 重新初始化页面”）
const confirmExternalUpdate = async () => {
  try {
    showUpdatePrompt.value = false;
    // 同步最新书签到 IndexedDB
    showNotification('正在同步书签...', 'info');
    await unifiedBookmarkAPI.initialize();
    const changed = await unifiedBookmarkAPI.syncBookmarks();
    if (!changed) {
      showNotification('同步完成：无变化', 'info');
    } else {
      showNotification('同步完成：已检测到变化', 'success');
    }
    // 重新初始化页面（由 store 内部负责恢复 UI 初始状态与数据）
    showNotification('正在刷新视图...', 'info');
    await initializeStore();
    showNotification('数据已更新', 'success');
  } catch (e) {
    console.error('confirmExternalUpdate error:', e);
    showNotification('更新失败', 'error');
  }
};



// 右侧悬停联动：让左侧只读树按 pathIds 展开父链并高亮对应ID，滚动居中
// 性能优化：防抖与去重 + 悬停不折叠其它分支，减少重渲染
const handleRightNodeHover = (node: any) => {
  const id = node?.id
  // 先打印右侧节点的 pathIds 以便调试
  console.log('[右侧 hover] pathIds =', node?.pathIds, 'id =', id)
  if (!id || !leftTreeRef.value) return
  if (lastHoverId === String(id)) return
  lastHoverId = String(id)
  // 如果右侧节点带有 IndexedDB 预处理的 pathIds，直接复用祖先链，避免在左侧再计算
  const pathIds = Array.isArray(node?.pathIds) ? node.pathIds.map((x: any) => String(x)) : undefined
  if (hoverDebounceTimer) {
    clearTimeout(hoverDebounceTimer)
    hoverDebounceTimer = null
  }
  try { performance.mark('hover_to_scroll_start') } catch {}
  hoverDebounceTimer = window.setTimeout(() => {
    try {
      leftTreeRef.value?.focusNodeById(String(id), { collapseOthers: hoverExclusiveCollapse.value, scrollIntoViewCenter: true, pathIds })
    } catch {}
  }, 60)
}

// 右侧悬停移出：清除左侧的程序化 hover 高亮
const handleRightNodeHoverLeave = () => {
  const comp = leftTreeRef.value
  if (comp && typeof comp.clearHoverAndActive === 'function') {
    try { comp.clearHoverAndActive() } catch {}
  }
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
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.panel-title-section {
  display: flex;
  gap: 12px;
  align-items: center;
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
  height: 100%;
}

.control-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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

.edit-form,
.add-item-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-fields {
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

.semantic-input {
  flex: 1;
  min-width: 160px;
}

.semantic-topk {
  width: 120px;
}

.semantic-minsim {
  width: 140px;
}

.semantic-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.semantic-loading-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-results {
  padding: 8px 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.semantic-item {
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
}

.semantic-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.semantic-title {
  font-weight: 500;
}

.semantic-url {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-score {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
const handleApply = async () => {
  await managementStore.applyStagedChanges();
};
