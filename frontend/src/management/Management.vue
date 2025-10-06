<template>
  <App theme="light" class="app-container">
    <Overlay :show="isPageLoading" persistent :opacity="0.12" :blur="true">
      <div class="loading-content">
        <Spinner color="primary" size="xl" class="loading-spinner" />
        <div class="loading-text">{{ loadingMessage }}</div>
      </div>
    </Overlay>

    <AppBar app flat class="app-bar-style">
      <template #prepend></template>
      <template #title>
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">AcuityBookmarks</div>
      </template>
      <template #actions>
        <Button size="sm" variant="outline" class="ml-2" @click="openSettings">
          <template #prepend>
            <Icon name="mdi-cog" />
          </template>
          打开设置
        </Button>
        
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
                  <div class="panel-title-section">
                    <Button
                      variant="text"
                      size="sm"
                      icon
                      title="搜索当前面板"
                      @click="onToggleLeftSearch"
                    >
                      <Icon name="mdi-magnify" />
                    </Button>
                    <div v-if="leftSearchOpen" class="panel-search-inline">
                      <Input
                        v-model="leftSearchQuery"
                        placeholder="筛选此面板..."
                        density="compact"
                        variant="underlined"
                        clearable
                        autofocus
                        ref="leftSearchRef"
                        @keydown.enter="focusLeftFirst"
                        @keydown.esc="clearLeftSearch"
                        @blur="onLeftSearchBlur"
                      />
                    </div>
                    <Button variant="text" size="sm" icon title="一键展开/收起" :disabled="isPageLoading"
                      @click="toggleLeftExpandAll">
                      <span class="expand-toggle-icon" :class="{ expanded: leftExpandAll, expanding: isPageLoading }">
                        <Icon :name="leftExpandAll ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'" />
                      </span>
                    </Button>
                  </div>
                </div>
              </template>
              <div class="panel-content">
                <SimpleBookmarkTree source="management" height="100%" size="comfortable" :editable="false"
                  :show-toolbar="false" :highlight-matches="false"
                  :initial-expanded="Array.from(originalExpandedFolders)" @ready="handleLeftTreeReady" ref="leftTreeRef" />
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
            <Card class="panel-card right-panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">

                  <div class="panel-title-section">
                    <Icon :name="getProposalPanelIcon()" :color="getProposalPanelColor()" />
                    <span class="panel-title">{{ getProposalPanelTitle() }}</span>
                  </div>
              <div class="panel-title-section">
                  <Button
                    variant="text"
                    size="sm"
                    icon
                    title="搜索当前面板"
                    @click="onToggleRightSearch"
                  >
                    <Icon name="mdi-magnify" />
                  </Button>
                  <div v-if="rightSearchOpen" class="panel-search-inline">
                    <Input
                      v-model="rightSearchQuery"
                      placeholder="筛选此面板..."
                      density="compact"
                      variant="underlined"
                      clearable
                      autofocus
                      ref="rightSearchRef"
                      @keydown.enter="focusRightFirst"
                      @keydown.esc="clearRightSearch"
                      @blur="onRightSearchBlur"
                    />
                  </div>
                  
                  <Button variant="text" size="sm" icon title="一键展开/收起" :disabled="isPageLoading"
                    @click="toggleRightExpandAll">
                    <span class="expand-toggle-icon" :class="{ expanded: rightExpandAll, expanding: isPageLoading }">
                      <Icon :name="rightExpandAll ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'" />
                    </span>
                  </Button>
              </div>
              <!-- 将快捷标签浮层放到 header 内，绝对定位到右上角 -->
              <transition name="tag-quick-fade">
                <div
                  class="quick-tags-popover"
                  v-show="rightSearchOpen && newProposalTree.children && newProposalTree.children.length > 0"
                  @mouseenter="onQuickTagsMouseEnter"
                  @mouseleave="onQuickTagsMouseLeave"
                >
                  <CleanupTagPicker :floating="true" />
                </div>
              </transition>
                </div>
              </template>
              <div class="panel-content">
                <CleanupLegend v-if="cleanupState && cleanupState.isFiltering" />

                <SimpleBookmarkTree :nodes="filteredProposalTree" height="100%" size="comfortable"
                  :draggable="!(cleanupState && cleanupState.isFiltering)" :editable="true" :show-toolbar="true"
                  selectable="multiple"
                  :show-selection-checkbox="true"
                  :toolbar-expand-collapse="false" :highlight-matches="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  @node-edit="handleNodeEdit" @node-delete="handleNodeDelete" @folder-add="handleFolderAdd"
                  @selection-change="onRightSelectionChange"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab" @bookmark-copy-url="handleBookmarkCopyUrl"
                  @drag-reorder="handleDragReorder" @node-hover="handleRightNodeHover" @node-hover-leave="handleRightNodeHoverLeave" ref="rightTreeRef" />
              </div>
              <template #footer v-if="selectedCounts.bookmarks > 0 || selectedCounts.folders > 0">
                <!-- 右侧面板内底部批量操作条（仅在选择时出现） -->
                <div class="bulk-delete-in-panel">
                  <div class="selection-summary">
                    已选择
                    <span class="count"><AnimatedNumber :value="selectedCounts.bookmarks" /></span>
                    条书签
                    <span class="gap"></span>
                    <span class="count"><AnimatedNumber :value="selectedCounts.folders" /></span>
                    个文件夹
                  </div>
                  <div class="bulk-actions">
                    <Button
                      variant="text"
                      size="sm"
                      class="clear-selection"
                      @click="clearRightSelection"
                    >
                      清除选择 ({{ rightSelectedIds.length }})
                    </Button>
                    <Button
                      color="error"
                      variant="primary"
                      size="lg"
                      class="bulk-delete-btn"
                      :disabled="selectedCounts.bookmarks === 0 && selectedCounts.folders === 0"
                      @click="openConfirmBulkDelete"
                    >
                      <template #prepend>
                        <Icon name="mdi-delete-forever-outline" />
                      </template>
                      删除
                    </Button>
                  </div>
                </div>
              </template>
            </Card>
          </Grid>
        </Grid>
      </Grid>
    </Main>

    <Toast v-model:show="snackbar" :text="snackbarText" :color="snackbarColor" :timeout="2000" />
  <CleanupProgress />
  <!-- 清理高级设置已迁移至设置页（settings.html?tab=cleanup），此处不再展示对话框 -->
  <!-- <CleanupSettings /> -->

    <!-- Edit Bookmark Dialog -->
    <ConfirmableDialog
      :show="isEditBookmarkDialogOpen"
      @update:show="(v: boolean) => (isEditBookmarkDialogOpen = v)"
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

    <!-- Bulk Delete Confirm Dialog -->
    <ConfirmableDialog
      :show="isConfirmBulkDeleteDialogOpen"
      @update:show="(v: boolean) => (isConfirmBulkDeleteDialogOpen = v)"
      @confirm="confirmBulkDeleteSelected"
      title="确认批量删除"
      icon="mdi-delete-sweep"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      max-width="480px"
      min-width="480px">
      <div class="confirm-content">
        是否确认删除所选的 {{ selectedCounts.bookmarks }} 条书签、{{ selectedCounts.folders }} 个文件夹？
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button color="error" @click="confirmBulkDeleteSelected">确认删除</Button>
      </template>
    </ConfirmableDialog>
    
    <!-- Edit Folder Dialog -->
    <ConfirmableDialog
      :show="isEditFolderDialogOpen"
      @update:show="(v: boolean) => (isEditFolderDialogOpen = v)"
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
      @update:show="(v: boolean) => (isConfirmDeleteDialogOpen = v)"
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
      @update:show="(v: boolean) => (isAddNewItemDialogOpen = v)"
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
import { ref, computed, onMounted, onUnmounted, nextTick, watch, h } from 'vue';
import { storeToRefs } from 'pinia';
import { useManagementStore } from '../stores/management-store';
import {
  App, Main, AppBar, Button, Card, Grid, Icon, Overlay, Spinner, Toast, Dialog, Tabs, Input, UrlInput
} from '../components/ui';
import { AB_EVENTS } from '@/constants/events';
import { notifySuccess, notifyInfo, notifyError } from '@/utils/notifications';
import ConfirmableDialog from '../components/ui/ConfirmableDialog.vue';
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue';
// 移除顶部/全局搜索，不再引入搜索盒与下拉
import CleanupTagPicker from './cleanup/CleanupTagPicker.vue';
import CleanupLegend from './cleanup/CleanupLegend.vue';
import CleanupProgress from './cleanup/CleanupProgress.vue';
import { indexedDBManager } from '@/infrastructure/indexeddb/manager';
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
  openAddNewItemDialog,
  bulkDeleteByIds,
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
// 顶部全局搜索已移除
// 配置功能已迁移到设置页，此处不再包含嵌入/向量相关控制
// 🔔 外部变更更新提示
const showUpdatePrompt = ref(false);
const pendingUpdateDetail = ref<any>(null);
const updatePromptMessage = ref(
  '检测到外部书签发生变更。为避免基于旧数据继续编辑导致冲突，需刷新到最新数据后再继续。'
);
// 一键展开/收起 - 状态与引用
const leftTreeRef = ref<any | null>(null)
const rightTreeRef = ref<any | null>(null)
// 面板内联搜索
const leftSearchOpen = ref(false)
const rightSearchOpen = ref(false)
const leftSearchQuery = ref('')
const rightSearchQuery = ref('')
const leftSearchRef = ref<any | null>(null)
const rightSearchRef = ref<any | null>(null)
const rightSelectedIds = ref<string[]>([])
// 批量删除确认弹窗开关
const isConfirmBulkDeleteDialogOpen = ref(false)
// 记录搜索前的展开状态，搜索清空后恢复
const leftPrevExpanded = ref<string[] | null>(null)
const rightPrevExpanded = ref<string[] | null>(null)
// 与浮动快捷标签交互时，避免 input 失焦立刻收起
const isInteractingWithQuickTags = ref(false)

// 右侧提案树索引：id => node（用于选择统计与快速检索）
const proposalIndex = computed(() => {
  const map = new Map<string, any>()
  const walk = (nodes: any[] | undefined) => {
    if (!Array.isArray(nodes)) return
    for (const n of nodes) {
      if (!n || !n.id) continue
      map.set(String(n.id), n)
      if (n.children && n.children.length) walk(n.children)
    }
  }
  try { walk(newProposalTree.value?.children as any) } catch {}
  return map
})

// 已选择计数（文件夹=包含其下所有书签），去重
const selectedCounts = computed(() => {
  const bookmarkIds = new Set<string>()
  const selectedFolderIds = new Set<string>()
  const addBookmarksUnder = (node: any) => {
    if (!node) return
    if (node.url) {
      bookmarkIds.add(String(node.id))
      return
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) addBookmarksUnder(c)
    }
  }
  for (const rawId of rightSelectedIds.value) {
    const id = String(rawId)
    const node = proposalIndex.value.get(id)
    if (!node) continue
    if (node.url) bookmarkIds.add(id)
    else {
      selectedFolderIds.add(id)
      addBookmarksUnder(node)
    }
  }
  return { bookmarks: bookmarkIds.size, folders: selectedFolderIds.size }
})

watch(leftSearchQuery, (q) => {
  const comp = leftTreeRef.value
  if (!comp || typeof comp.setSearchQuery !== 'function') return
  comp.setSearchQuery(q)
  const hasQuery = !!(q && q.trim())
  if (hasQuery) {
    // 首次进入搜索时记录当前展开状态
    if (!leftPrevExpanded.value && comp.expandedFolders) {
      try {
        const cur: Set<string> = comp.expandedFolders
        leftPrevExpanded.value = Array.from(cur instanceof Set ? cur : new Set())
      } catch {}
    }
    if (typeof comp.expandAll === 'function') comp.expandAll()
  } else {
    // 恢复之前的展开状态
    if (leftPrevExpanded.value && Array.isArray(leftPrevExpanded.value)) {
      if (typeof comp.collapseAll === 'function') comp.collapseAll()
      if (typeof comp.expandFolderById === 'function') {
        for (const id of leftPrevExpanded.value) comp.expandFolderById(String(id))
      }
    }
    leftPrevExpanded.value = null
  }
})

watch(rightSearchQuery, (q) => {
  const comp = rightTreeRef.value
  if (!comp || typeof comp.setSearchQuery !== 'function') return
  comp.setSearchQuery(q)
  const hasQuery = !!(q && q.trim())
  if (hasQuery) {
    if (!rightPrevExpanded.value && comp.expandedFolders) {
      try {
        const cur: Set<string> = comp.expandedFolders
        rightPrevExpanded.value = Array.from(cur instanceof Set ? cur : new Set())
      } catch {}
    }
    if (typeof comp.expandAll === 'function') comp.expandAll()
  } else {
    if (rightPrevExpanded.value && Array.isArray(rightPrevExpanded.value)) {
      if (typeof comp.collapseAll === 'function') comp.collapseAll()
      if (typeof comp.expandFolderById === 'function') {
        for (const id of rightPrevExpanded.value) comp.expandFolderById(String(id))
      }
    }
    rightPrevExpanded.value = null
  }
})

// 失焦且输入为空时收起输入框
const onLeftSearchBlur = () => {
  if (!(leftSearchQuery.value || '').trim()) leftSearchOpen.value = false
}
const onRightSearchBlur = () => {
  if (isInteractingWithQuickTags.value) return
  if (!(rightSearchQuery.value || '').trim()) rightSearchOpen.value = false
}
const onQuickTagsMouseEnter = () => { isInteractingWithQuickTags.value = true }
const onQuickTagsMouseLeave = () => {
  // 延迟一个tick，确保点击事件先处理完成再允许输入框收起
  setTimeout(() => { isInteractingWithQuickTags.value = false }, 0)
}
const focusLeftFirst = async () => {
  if (!leftTreeRef.value || !leftTreeRef.value.getFirstVisibleBookmarkId) return
  const id = leftTreeRef.value.getFirstVisibleBookmarkId()
  if (id) await leftTreeRef.value.focusNodeById(id, { collapseOthers: false, scrollIntoViewCenter: true })
}
const focusRightFirst = async () => {
  if (!rightTreeRef.value || !rightTreeRef.value.getFirstVisibleBookmarkId) return
  const id = rightTreeRef.value.getFirstVisibleBookmarkId()
  if (id) await rightTreeRef.value.focusNodeById(id, { collapseOthers: false, scrollIntoViewCenter: true })
}
const clearLeftSearch = () => { leftSearchQuery.value = ''; leftSearchOpen.value = false }
const clearRightSearch = () => { rightSearchQuery.value = ''; rightSearchOpen.value = false }
const leftExpandAll = ref(false)
const rightExpandAll = ref(false)


// 展开/收起搜索并自动聚焦到输入框；同时让按钮失焦，避免出现聚焦边框
const onToggleLeftSearch = async (e?: Event) => {
  leftSearchOpen.value = !leftSearchOpen.value
  try { (e?.currentTarget as HTMLElement | undefined)?.blur?.() } catch {}
  if (leftSearchOpen.value) {
    await nextTick()
    try {
      // Input 是包装组件，优先查找内部原生 input
      const root = (leftSearchRef.value?.$el as HTMLElement | undefined)
      const input = root?.querySelector('input') as HTMLInputElement | null
      input?.focus(); input?.select?.()
    } catch {}
  }
}

const onToggleRightSearch = async (e?: Event) => {
  rightSearchOpen.value = !rightSearchOpen.value
  try { (e?.currentTarget as HTMLElement | undefined)?.blur?.() } catch {}
  if (rightSearchOpen.value) {
    await nextTick()
    try {
      const root = (rightSearchRef.value?.$el as HTMLElement | undefined)
      const input = root?.querySelector('input') as HTMLInputElement | null
      input?.focus(); input?.select?.()
    } catch {}
  }
}

// 悬停排他展开：默认启用
const hoverExclusiveCollapse = ref(true)
// 右侧悬停 -> 左侧联动 的防抖与去重，避免频繁渲染和滚动抖动
let hoverDebounceTimer: number | null = null
let lastHoverId: string | null = null
let lastParentChainKey: string | null = null
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
  const all = newProposalTree.value.children || []
  const cs = cleanupState.value
  if (!cs || !cs.isFiltering || !Array.isArray(cs.activeFilters) || cs.activeFilters.length === 0) {
    return all
  }
  const active = new Set<string>(cs.activeFilters as unknown as string[])
  // 允许的节点：存在与任一过滤类型匹配的问题
  const matchedIds = new Set<string>()
  try {
    for (const [nodeId, problems] of cs.filterResults.entries()) {
      if (!problems || problems.length === 0) continue
      if (problems.some((p: any) => active.has(String(p.type)))) {
        matchedIds.add(String(nodeId))
      }
    }
  } catch {}

  // 从根递归拷贝仅包含匹配节点所在分支
  const cloneFiltered = (nodes: any[]): any[] => {
    const out: any[] = []
    for (const n of nodes) {
      const id = String(n.id)
      const children = Array.isArray(n.children) ? n.children : []
      const filteredChildren = children.length ? cloneFiltered(children) : []
      if (matchedIds.has(id) || filteredChildren.length > 0) {
        out.push({ ...n, children: filteredChildren })
      }
    }
    return out
  }
  return cloneFiltered(all)
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
    notifySuccess('URL copied!');
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

  // 解析来自 Popup 的筛选参数并启动清理扫描
  try {
    const params = new (window as any).URLSearchParams(window.location.search)
    const filterParam = params.get('filter')
    if (filterParam) {
      const map: Record<string, '404' | 'duplicate' | 'empty' | 'invalid'> = {
        '404': '404',
        'duplicate': 'duplicate',
        'empty': 'empty',
        'invalid': 'invalid'
      }
      const f = map[filterParam]
      if (f) {
        // 初始化清理状态并仅启用目标过滤器
        void managementStore.initializeCleanupState().then(async () => {
          if (managementStore.cleanupState) {
            managementStore.cleanupState.activeFilters = [f]
            managementStore.cleanupState.isFiltering = true
            await managementStore.startCleanupScan()
            // ✅ 扫描完成后：自动选中并定位首个匹配问题的书签
            try {
              const cs = managementStore.cleanupState
              const firstProblemNodeId = (() => {
                if (!cs) return undefined
                for (const [nodeId, problems] of cs.filterResults.entries()) {
                  // 只取当前筛选类型对应的问题
                  if (problems?.some(p => p.type === f)) return String(nodeId)
                }
                return undefined
              })()

              // 若没有问题节点，则回退到第一个可见书签
              const fallbackId = rightTreeRef.value?.getFirstVisibleBookmarkId?.()
              const toFocusId = firstProblemNodeId || fallbackId
              if (toFocusId && rightTreeRef.value) {
                // 先确保路径展开并滚动居中
                await rightTreeRef.value.focusNodeById(String(toFocusId), { collapseOthers: false, scrollIntoViewCenter: true })
                // 再进行选择（多选模式允许追加；此处不追加，保持唯一选择）
                try { rightTreeRef.value.selectNodeById(String(toFocusId), { append: false }) } catch {}
              }
            } catch (e) {
              console.warn('默认选中首项失败:', e)
            }
          }
        })
      }
    }
  } catch {}

  // 未保存更改离开提醒
  managementStore.attachUnsavedChangesGuard();

  // ✅ 实时同步：监听来自后台/书签API的变更事件（提示确认）
  const handleBookmarkUpdated = (evt: Event) => {
    const detail = (evt as any)?.detail ?? {};
    pendingUpdateDetail.value = detail;
    showUpdatePrompt.value = true;
    notifyInfo('检测到外部书签变更');
  };
  window.addEventListener(AB_EVENTS.BOOKMARK_UPDATED, handleBookmarkUpdated as (e: Event) => void);

  // 组件卸载时清理监听器
  onUnmounted(() => {
  window.removeEventListener(AB_EVENTS.BOOKMARK_UPDATED, handleBookmarkUpdated as (e: Event) => void);
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

// 右侧选择变化：用于批量删除
const onRightSelectionChange = (ids: string[]) => {
  rightSelectedIds.value = Array.isArray(ids) ? ids.map(String) : []
}

// 明确的清空选择：调用树API并同步本地状态，避免不触发 selection-change 时状态不同步
const clearRightSelection = () => {
  try { rightTreeRef.value?.clearSelection?.() } catch {}
  rightSelectedIds.value = []
}

// 📣 更新提示动作（简化为“同步 + 重新初始化页面”）
const confirmExternalUpdate = async () => {
  try {
    showUpdatePrompt.value = false;
    // 切换为本地刷新：重新初始化 DB 并刷新 Store
    notifyInfo('正在刷新本地数据...');
    await indexedDBManager.initialize();
    await initializeStore();
    notifySuccess('数据已更新');
  } catch (e) {
    console.error('confirmExternalUpdate error:', e);
    notifyError('更新失败');
  }
};



// 右侧悬停联动：让左侧只读树按 pathIds 展开父链并高亮对应ID，滚动居中
// 性能优化：防抖与去重 + 悬停不折叠其它分支，减少重渲染
const handleRightNodeHover = (node: any) => {
  const id = node?.id != null ? String(node.id) : ''
  // 先打印右侧节点的 pathIds 以便调试
  console.log('[右侧 hover] pathIds =', node?.pathIds, 'id =', id)
  if (!id || !leftTreeRef.value) return
  if (lastHoverId === id) return
  lastHoverId = id
  // 如果右侧节点带有 IndexedDB 预处理的 pathIds，直接复用祖先链，避免在左侧再计算
  const pathIds = Array.isArray(node?.pathIds) ? node.pathIds.map((x: any) => String(x)) : undefined
  if (hoverDebounceTimer) {
    clearTimeout(hoverDebounceTimer)
    hoverDebounceTimer = null
  }
  try { performance.mark('hover_to_scroll_start') } catch {}
  hoverDebounceTimer = window.setTimeout(() => {
    try {
      const comp = leftTreeRef.value
      if (!comp || typeof comp.focusNodeById !== 'function') return
      // 如果左侧正在滚动，跳过本次，避免滚动堆积
      if (comp.isScrolling) return
      // 相同路径短路（若右侧提供 pathIds）
      if (Array.isArray(pathIds) && pathIds.length) {
        const key = pathIds.join('>')
        if (lastParentChainKey === key) return
        lastParentChainKey = key
      }
      comp.focusNodeById(id, { collapseOthers: hoverExclusiveCollapse.value, scrollIntoViewCenter: true, pathIds })
    } catch {}
  }, 100)
}

// 右侧悬停移出：清除左侧的程序化 hover 高亮
const handleRightNodeHoverLeave = () => {
  const comp = leftTreeRef.value
  if (comp && typeof comp.clearHoverAndActive === 'function') {
    try { comp.clearHoverAndActive() } catch {}
  }
}

// 已移除：批量生成嵌入等操作迁移到设置页

// 自动嵌入设置与状态
// 已移除：自动嵌入设置展示与开关

// Vectorize 自动同步设置与状态
// 已移除：Vectorize 自动同步设置展示与开关

// 立即 Vectorize 同步
// 已移除：Vectorize 同步与一键生成+同步；请前往设置页

// 最近一次手动 Vectorize 统计（由 SW 写入 settings）
// 已移除：手动 Vectorize 统计展示

// 覆盖率统计（待嵌入数量）
// 已移除：覆盖率统计展示

// 自动任务参数设置
// 已移除：自动任务参数内联表单

function openSettings() {
  try {
    const url = chrome?.runtime?.getURL ? chrome.runtime.getURL('settings.html') : '/settings.html'
    window.open(url, '_blank')
  } catch {
    window.open('/settings.html', '_blank')
  }
}

// 标题区新增：删除所选（批量暂存删除）
const openConfirmBulkDelete = () => {
  if (!rightSelectedIds.value.length) return
  isConfirmBulkDeleteDialogOpen.value = true
}

const confirmBulkDeleteSelected = () => {
  const ids = rightSelectedIds.value.filter(Boolean)
  if (!ids.length) {
    isConfirmBulkDeleteDialogOpen.value = false
    return
  }
  bulkDeleteByIds(ids)
  isConfirmBulkDeleteDialogOpen.value = false
  // 清空选择，避免再次误删
  try { rightTreeRef.value?.clearSelection?.() } catch {}
}

// 局部轻量数字动画（与 Popup 同一实现思路）
const AnimatedNumber = {
  name: 'AnimatedNumber',
  props: { value: { type: Number, required: true }, duration: { type: Number, default: 500 } },
  setup(props: { value: number; duration: number }) {
    const display = ref(0)
    let startVal = 0
    let start = 0
    let raf: number | null = null
    const animate = (to: number) => {
  if (raf !== null) window.cancelAnimationFrame(raf)
      startVal = display.value
      start = performance.now()
      const delta = to - startVal
      const tick = () => {
        const p = Math.min(1, (performance.now() - start) / props.duration)
        const eased = 1 - Math.pow(1 - p, 3)
        display.value = Math.round(startVal + delta * eased)
        if (p < 1) raf = window.requestAnimationFrame(tick)
      }
      raf = window.requestAnimationFrame(tick)
    }
    onMounted(() => animate(props.value))
    watch(() => props.value, (nv: number) => animate(nv))
    return () => h('span', display.value.toString())
  }
} as any

// 中间控制区操作
const handleCompare = () => {
  notifyInfo('对比功能尚未实现');
};

const handleApply = async () => {
  try {
    await managementStore.applyStagedChanges();
    notifySuccess('已应用更改');
  } catch (e) {
    console.error('handleApply failed:', e)
    notifyError('应用失败');
  }
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
.panel-search-inline {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 260px;
  overflow: visible;
  z-index: 3;
}
.quick-tags-popover {
  position: absolute;
  /* 锚定在右侧面板 header 的右上角 */
  top: 51px;
  right: 8px;
  z-index: 40; /* 保证浮层在上层 */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 6px 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.16);
}
.tag-quick-fade-enter-active,
.tag-quick-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}
.tag-quick-fade-enter-from,
.tag-quick-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.bulk-delete-in-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--color-error-subtle);
}
.selection-summary { font-weight: 600; }
.selection-summary .count { margin: 0 6px; font-weight: 800; }
.selection-summary .gap { display: inline-block; width: 10px; }
.bulk-delete-btn {
  background: #fff0f0;
  color: var(--color-error);
  border: 1px solid rgba(255,255,255,0.6);
}
.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.clear-selection {
  color: var(--color-text-secondary);
}
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
  /* 降低展示尺寸以满足高分屏（DPR=2）对自然尺寸的要求 */
  height: 24px;
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
  /* 允许子项在 Flex 布局中收缩，从而使内部产生滚动 */
  min-height: 0;
}

.panel-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 允许内容区域计算高度并滚动 */
  min-height: 0;
}

/* 右侧卡片保持裁剪以确保圆角生效（快捷标签浮层已在 header 内，不再需要放行）*/
.right-panel-card {
  overflow: hidden;
}

.panel-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  position: relative; /* 作为浮层定位参照 */
  overflow: visible;  /* 放行浮层 */
}

.panel-title-section {
  display: flex;
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
  min-height: 0; /* 允许内部子元素计算高度，避免超出无法滚动 */
  display: flex;
  flex-direction: column;
  /* 使左右面板内容可滚动（包含 legend 和树） */
  overflow-y: auto;
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
