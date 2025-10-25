<template>
  <App theme="light" class="app-container">
    <Overlay :show="isPageLoading" persistent :opacity="0.12" :blur="true">
      <div class="overlay-loading">
        <Spinner color="primary" size="xl" class="loading-spinner" />
        <div class="loading-text" data-testid="progress-text">
          {{ loadingMessage }}
        </div>
      </div>
    </Overlay>

    <AppBar app flat class="app-bar-style">
      <template #prepend></template>
      <template #title>
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">AcuityBookmarks</div>
      </template>
      <template #actions>
        <ThemeToggle />
        <Button
          size="sm"
          variant="outline"
          class="ml-2"
          borderless
          @click="openSettings"
        >
          <Icon name="icon-setting" :size="24" />
        </Button>
      </template>
    </AppBar>

    <Main with-app-bar padding class="main-content">
      <Grid is="container" fluid class="fill-height management-container">
        <Grid is="row" class="fill-height" align="stretch">
          <!-- Left Panel -->
          <Grid is="col" :cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <Icon name="icon-folder" color="primary" />
                    <span class="panel-title">当前书签</span>
                  </div>
                  <div class="panel-title-section">
                    <PanelInlineSearch
                      v-model="leftSearchQuery"
                      v-model:open="leftSearchOpen"
                      button-title="搜索当前面板"
                      :min-width="140"
                      @enter="focusLeftFirst"
                      @esc="clearLeftSearch"
                      @blur="onLeftSearchBlur"
                    />
                    <Button
                      variant="text"
                      size="sm"
                      icon
                      :title="
                        leftExpandAll ? '收起全部文件夹' : '展开全部文件夹'
                      "
                      :disabled="isPageLoading"
                      @click="toggleLeftExpandAll"
                    >
                      <span
                        class="expand-toggle-icon"
                        :class="{
                          expanded: leftExpandAll,
                          expanding: isPageLoading
                        }"
                      >
                        <Icon
                          :name="
                            leftExpandAll
                              ? 'icon-collapse-All'
                              : 'icon-expand-All'
                          "
                        />
                      </span>
                    </Button>
                  </div>
                </div>
              </template>
              <div class="panel-content">
                <SimpleBookmarkTree
                  ref="leftTreeRef"
                  source="management"
                  height="100%"
                  size="comfortable"
                  :loading="isPageLoading"
                  :editable="false"
                  :show-toolbar="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(originalExpandedFolders)"
                  :virtual="true"
                  @ready="handleLeftTreeReady"
                />
              </div>
            </Card>
          </Grid>

          <!-- Middle Control Panel -->
          <Grid is="col" :cols="2" class="panel-col">
            <Card
              class="panel-card fill-height"
              elevation="low"
              borderless
              :padding="false"
            >
              <div class="panel-content control-panel">
                <div class="control-actions">
                  <Icon name="icon-comparison" :size="32" />
                  <Button
                    title="应用"
                    variant="ghost"
                    size="lg"
                    color="primary"
                    borderless
                    @click="handleApply"
                  >
                    <Icon name="icon-approval" :size="32" />
                  </Button>
                </div>
              </div>
            </Card>
          </Grid>

          <!-- Right Panel -->
          <Grid is="col" :cols="5" class="panel-col">
            <Card
              class="panel-card right-panel-card"
              elevation="medium"
              :footer-visible="
                selectedCounts.bookmarks > 0 || selectedCounts.folders > 0
              "
              footer-transition="card-footer-slide"
            >
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <Icon
                      :name="getProposalPanelIcon()"
                      :color="getProposalPanelColor()"
                    />
                    <span class="panel-title">{{
                      getProposalPanelTitle()
                    }}</span>
                  </div>
                  <div class="panel-title-section">
                    <PanelInlineSearch
                      v-model="rightSearchQuery"
                      v-model:open="rightSearchOpen"
                      button-title="搜索当前面板"
                      :min-width="140"
                      @enter="focusRightFirst"
                      @esc="clearRightSearch"
                      @blur="onRightSearchBlur"
                    />

                    <div class="panel-actions">
                      <Button
                        variant="text"
                        size="sm"
                        icon
                        :disabled="isCleanupLoading || isPageLoading"
                        :title="isCleanupLoading ? '同步中...' : '同步健康标签'"
                        @click="handleCleanupRefreshClick"
                      >
                        <Icon name="icon-refresh" :spin="isCleanupLoading" />
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        icon
                        :title="
                          rightExpandAll ? '收起全部文件夹' : '展开全部文件夹'
                        "
                        :disabled="isCleanupLoading || isPageLoading"
                        @click="toggleRightExpandAll"
                      >
                        <span
                          class="expand-toggle-icon"
                          :class="{
                            expanded: rightExpandAll,
                            expanding: isCleanupLoading
                          }"
                        >
                          <Icon
                            :name="
                              rightExpandAll
                                ? 'icon-collapse-All'
                                : 'icon-expand-All'
                            "
                          />
                        </span>
                      </Button>
                    </div>
                  </div>
                  <!-- 将快捷标签浮层放到 header 内，绝对定位到右上角 -->
                  <transition name="tag-quick-fade">
                    <div
                      v-show="
                        rightSearchOpen &&
                        newProposalTree.children &&
                        newProposalTree.children.length > 0
                      "
                      class="quick-tags-popover"
                      @mouseenter="onQuickTagsMouseEnter"
                      @mouseleave="onQuickTagsMouseLeave"
                    >
                      <CleanupTagPicker :floating="true" />
                    </div>
                  </transition>
                </div>
              </template>
              <div class="panel-content">
                <div v-if="cleanupState" class="cleanup-summary"></div>
                <SimpleBookmarkTree
                  ref="rightTreeRef"
                  :nodes="filteredProposalTree"
                  height="100%"
                  size="comfortable"
                  :loading="isCleanupLoading"
                  :editable="true"
                  :show-toolbar="true"
                  selectable="multiple"
                  :show-selection-checkbox="true"
                  :toolbar-expand-collapse="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  :virtual="true"
                  @request-clear-filters="cleanupStore.clearFilters()"
                  @node-edit="handleNodeEdit"
                  @node-delete="handleNodeDelete"
                  @folder-add="handleFolderAdd"
                  @selection-change="onRightSelectionChange"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @node-hover="handleRightNodeHover"
                  @node-hover-leave="handleRightNodeHoverLeave"
                />
              </div>
              <template #footer>
                <!-- 右侧面板内底部批量操作条（仅在选择时出现） -->
                <div class="bulk-delete-in-panel">
                  <div class="selection-summary">
                    <span class="text">已选择</span>
                    <span class="count"
                      ><AnimatedNumber :value="selectedCounts.bookmarks"
                    /></span>
                    <span class="text">条书签</span>
                    <span class="gap"></span>
                    <span class="count"
                      ><AnimatedNumber :value="selectedCounts.folders"
                    /></span>
                    <span class="text">个文件夹</span>
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
                      :disabled="
                        selectedCounts.bookmarks === 0 &&
                        selectedCounts.folders === 0
                      "
                      @click="openConfirmBulkDelete"
                    >
                      <template #prepend>
                        <Icon name="icon-delete" />
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

    <Toast
      v-model:show="snackbar.show"
      :text="snackbar.text"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    />
    <!-- 清理高级设置已迁移至设置页（settings.html?tab=cleanup），此处不再展示对话框 -->
    <!-- <CleanupSettings /> -->

    <!-- Edit Bookmark Dialog -->
    <ConfirmableDialog
      :show="dialogStore.editBookmarkDialog.isOpen"
      title="编辑书签"
      icon="icon-pencil"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_EDIT"
      :is-dirty="isEditDirty"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openEditBookmarkDialog(
                dialogStore.editBookmarkDialog.bookmark!
              )
            : dialogStore.closeEditBookmarkDialog()
      "
      @confirm="confirmEditBookmark"
    >
      <div class="edit-form">
        <Input
          v-model="dialogStore.editBookmarkDialog.title"
          label="书签标题"
          variant="outlined"
          class="form-field"
          :error="!!editFormErrors.title"
          :error-message="editFormErrors.title"
        />
        <UrlInput
          v-model="dialogStore.editBookmarkDialog.url"
          label="书签链接"
          variant="outlined"
          density="compact"
          :error="!!editFormErrors.url"
          :error-message="editFormErrors.url"
        />
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button
          color="primary"
          :disabled="!isEditDirty"
          @click="confirmEditBookmark"
          >更新</Button
        >
      </template>
    </ConfirmableDialog>

    <!-- Bulk Delete Confirm Dialog -->
    <ConfirmableDialog
      :show="isConfirmBulkDeleteDialogOpen"
      title="确认批量删除"
      icon="icon-delete-sweep"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      max-width="480px"
      min-width="480px"
      @update:show="(v: boolean) => (isConfirmBulkDeleteDialogOpen = v)"
      @confirm="confirmBulkDeleteSelected"
    >
      <div class="confirm-content">
        是否确认删除所选的 {{ selectedCounts.bookmarks }} 条书签、{{
          selectedCounts.folders
        }}
        个文件夹？
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button color="error" @click="confirmBulkDeleteSelected"
          >确认删除</Button
        >
      </template>
    </ConfirmableDialog>

    <!-- Edit Folder Dialog -->
    <ConfirmableDialog
      :show="dialogStore.editFolderDialog.isOpen"
      title="编辑文件夹"
      icon="icon-folder-edit"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_EDIT"
      :is-dirty="isEditFolderDirty"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openEditFolderDialog(
                dialogStore.editFolderDialog.folder!
              )
            : dialogStore.closeEditFolderDialog()
      "
      @confirm="confirmEditFolder"
    >
      <div class="edit-form">
        <Input
          v-model="dialogStore.editFolderDialog.title"
          label="文件夹标题"
          variant="outlined"
          class="form-field"
          :error="!!folderEditFormErrors.title"
          :error-message="folderEditFormErrors.title"
        />
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button
          color="primary"
          :disabled="!isEditFolderDirty"
          @click="confirmEditFolder"
          >更新</Button
        >
      </template>
    </ConfirmableDialog>

    <!-- Delete Folder Confirm Dialog (统一为 ConfirmableDialog) -->
    <ConfirmableDialog
      :show="isConfirmDeleteDialogOpen"
      :esc-to-close="true"
      title="确认删除"
      icon="icon-delete"
      :persistent="true"
      :enable-cancel-guard="false"
      max-width="480px"
      min-width="480px"
      @update:show="(v: boolean) => (isConfirmDeleteDialogOpen = v)"
      @confirm="confirmDeleteFolder"
    >
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
      :show="dialogStore.addItemDialog.isOpen"
      :title="addDialogTitle"
      :icon="addDialogIcon"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_ADD"
      :is-dirty="isAddDirty"
      :body-min-height="addDialogMinHeight"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openAddItemDialog(
                dialogStore.addItemDialog.type,
                dialogStore.addItemDialog.parentFolder || undefined
              )
            : dialogStore.closeAddItemDialog()
      "
      @confirm="confirmAddNewItem"
    >
      <div ref="addDialogContentRef" class="add-item-form">
        <Tabs
          v-model="dialogStore.addItemDialog.type"
          :tabs="[
            { value: 'bookmark', text: '书签' },
            { value: 'folder', text: '文件夹' }
          ]"
          grow
        />
        <div class="form-fields">
          <Input
            v-model="dialogStore.addItemDialog.title"
            label="标题"
            variant="outlined"
            class="form-field"
            autofocus
            :error="!!addFormErrors.title"
            :error-message="addFormErrors.title"
          />
          <UrlInput
            v-if="dialogStore.addItemDialog.type === 'bookmark'"
            v-model="dialogStore.addItemDialog.url"
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
        <Button color="primary" @click="confirmAddNewItem">{{
          addConfirmText
        }}</Button>
      </template>
    </ConfirmableDialog>

    <!-- External Update Prompt (不可取消) -->
    <Dialog
      :show="showUpdatePrompt"
      :title="'外部已更新书签，需立即刷新'"
      icon="icon-sync-alert"
      :persistent="true"
      :cancelable="false"
      :esc-to-close="false"
      :enter-to-confirm="false"
      max-width="500px"
      min-width="500px"
    >
      <div class="update-prompt-content">
        <p>{{ updatePromptMessage }}</p>
        <div v-if="pendingUpdateDetail" class="update-detail">
          <small
            >类型：{{ pendingUpdateDetail.eventType }}，ID：{{
              pendingUpdateDetail.id
            }}</small
          >
        </div>
      </div>
      <template #actions>
        <Button color="primary" @click="confirmExternalUpdate"
          >理解并更新</Button
        >
      </template>
    </Dialog>
  </App>
</template>

<script setup lang="ts">
import { schedulerService } from '@/application/scheduler/scheduler-service'
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
// useManagementStore 已迁移到新的专业化 Store
import {
  useDialogStore,
  useBookmarkManagementStore,
  useCleanupStore,
  useUIStore
} from '@/stores'
import type { HealthTag } from '@/stores/cleanup/cleanup-store'
import { type CleanupProblem } from '@/core/bookmark/domain/cleanup-problem'
import {
  App,
  AppBar,
  Button,
  Card,
  Grid,
  Icon,
  Input,
  Main,
  Overlay,
  Spinner,
  Tabs,
  ThemeToggle,
  Toast,
  UrlInput
} from '@/components'
import PanelInlineSearch from '@/components/composite/PanelInlineSearch/PanelInlineSearch.vue'
import { AB_EVENTS } from '@/constants/events'
import { notificationService } from '@/application/notification/notification-service'
import { ConfirmableDialog } from '@/components'
import SimpleBookmarkTree from '@/components/composite/SimpleBookmarkTree/SimpleBookmarkTree.vue'
// 移除顶部/全局搜索，不再引入搜索盒与下拉
import CleanupTagPicker from './cleanup/CleanupTagPicker.vue'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { searchWorkerAdapter } from '@/services/search-worker-adapter'
// 导入现代书签服务：以 side-effect 方式初始化并设置事件监听与消息桥接
import '@/services/modern-bookmark-service'
import { DataValidator } from '@/core/common/store-error'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'

// managementStore 已迁移到新的专业化 Store
const dialogStore = useDialogStore()
const bookmarkManagementStore = useBookmarkManagementStore()
const cleanupStore = useCleanupStore()

// UI 状态从 UIStore 获取
const uiStore = useUIStore()
const { snackbar } = storeToRefs(uiStore)

// 书签树展开状态从 BookmarkManagementStore 获取
const { originalExpandedFolders, proposalExpandedFolders, hasUnsavedChanges } =
  storeToRefs(bookmarkManagementStore)

// 清理状态从新的 CleanupStore 获取
const { cleanupState } = storeToRefs(cleanupStore)

/**
 * 清理面板专用的加载态，当健康扫描进行中时仅锁定右侧树和相关操作。
 */
/**
 * 清理面板专用的加载状态。
 *
 * - 与全局 `isPageLoading` 区分，避免左侧树等无关区域被蒙层阻塞。
 * - 直接依据 CleanupStore 的扫描标记，确保与后端同步进度保持一致。
 */
const isCleanupLoading = computed(() => cleanupState.value?.isScanning ?? false)

/**
 * 点击健康同步时的封装处理：避免并发请求，并将重负载流程调度到后台任务队列。
 */
const handleCleanupRefreshClick = async () => {
  if (isCleanupLoading.value) return

  try {
    const result = schedulerService.scheduleBackground(async () => {
      try {
        await cleanupStore.refreshHealthFromIndexedDB({ silent: false })
      } catch (error) {
        logger.error('Management', '刷新健康标签失败', error)
        uiStore.showError('刷新健康标签失败，请稍后重试')
      }
    })

    if (!result.ok) {
      throw result.error
    }
  } catch (error) {
    logger.error('Management', '调度健康同步任务失败', error)
    uiStore.showError('系统繁忙，稍后再试')
  }
}

// 书签管理状态从新的 BookmarkManagementStore 获取
const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
  storeToRefs(bookmarkManagementStore)

const {
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor,
  initialize: initializeStore,
  editBookmark,
  editFolder,
  deleteBookmark,
  deleteFolder,
  bulkDeleteByIds
} = bookmarkManagementStore

// openAddNewItemDialog 已迁移到 DialogStore
const { openAddItemDialog } = dialogStore

// 统一的确认文案（减少重复与便于维护）
const MSG_CANCEL_EDIT = '您有更改尚未保存，确定取消并丢弃更改吗？'
const MSG_CANCEL_ADD = '您有更改尚未添加，确定取消并丢弃输入吗？'

// 统一文案由 ConfirmableDialog 使用，已移除旧的通用处理函数
// === 添加新项目对话框：标题/图标随 Tab，但底部按钮固定文案 ===
const addDialogTitle = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark' ? '添加新书签' : '添加新文件夹'
)
const addDialogIcon = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark'
    ? 'icon-bookmark-plus'
    : 'icon-folder-plus'
)
// 按需求固定为"添加"，不随 Tab 切换变化
const addConfirmText = computed(() => '添加')

// 为固定弹窗高度：以"书签"Tab 的内容高度为准
const addDialogContentRef = ref<HTMLElement | null>(null)
const addDialogMinHeight = ref<string | undefined>(undefined)

// 在弹窗打开后测量当前内容高度（通常为"书签"Tab）并固定
watch(
  () => dialogStore.addItemDialog.isOpen,
  async open => {
    if (open) {
      await nextTick()
      requestAnimationFrame(() => {
        const el = addDialogContentRef.value
        if (el) {
          const h = el.offsetHeight
          if (h && h > 0) {
            addDialogMinHeight.value = `${h}px`
          }
        }
      })
    } else {
      // 关闭时恢复默认，避免残留影响下次弹窗
      addDialogMinHeight.value = undefined
    }
  }
)

// 已移除未使用的 leftPanelRef，减少无意义的响应式状态
// 顶部全局搜索已移除
// 配置功能已迁移到设置页，此处不再包含嵌入/向量相关控制
// 🔔 外部变更更新提示
const showUpdatePrompt = ref(false)
const pendingUpdateDetail = ref<Record<string, unknown> | null>(null)
const pendingTagSelection = ref<HealthTag[] | null>(null)
const updatePromptMessage = ref(
  '检测到外部书签发生变更。为避免基于旧数据继续编辑导致冲突，需刷新到最新数据后再继续。'
)
// 外部变更自动刷新去抖计时器
let autoRefreshTimer: number | null = null

// 一键展开/收起 - 状态与引用
const leftTreeRef = ref<InstanceType<typeof SimpleBookmarkTree> | null>(null)
const rightTreeRef = ref<InstanceType<typeof SimpleBookmarkTree> | null>(null)
// 面板内联搜索
const leftSearchOpen = ref(false)
const rightSearchOpen = ref(false)
const leftSearchQuery = ref('')
const rightSearchQuery = ref('')
// 组件化后不再直接引用内部 input 元素
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
  const map = new Map<string, BookmarkNode>()
  const walk = (nodes: BookmarkNode[] | undefined) => {
    if (!Array.isArray(nodes)) return
    for (const n of nodes) {
      if (!n || !n.id) continue
      map.set(String(n.id), n)
      if (n.children && n.children.length) walk(n.children)
    }
  }
  try {
    walk(newProposalTree.value?.children as BookmarkNode[])
  } catch {}
  return map
})

// 已选择计数（文件夹=包含其下所有书签），去重
const selectedCounts = computed(() => {
  const bookmarkIds = new Set<string>()
  const selectedFolderIds = new Set<string>()
  const addBookmarksUnder = (node: BookmarkNode) => {
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

watch(leftSearchQuery, q => {
  const comp = leftTreeRef.value
  if (!comp || typeof comp.setSearchQuery !== 'function') return
  comp.setSearchQuery(q)
  const hasQuery = !!(q && q.trim())
  if (hasQuery) {
    // 首次进入搜索时记录当前展开状态
    if (!leftPrevExpanded.value && comp.expandedFolders) {
      try {
        const cur: Set<string> = comp.expandedFolders
        leftPrevExpanded.value = Array.from(
          cur instanceof Set ? cur : new Set()
        )
      } catch {}
    }
    if (typeof comp.expandAll === 'function') comp.expandAll()
  } else {
    // 恢复之前的展开状态
    if (leftPrevExpanded.value && Array.isArray(leftPrevExpanded.value)) {
      if (typeof comp.collapseAll === 'function') comp.collapseAll()
      if (typeof comp.expandFolderById === 'function') {
        for (const id of leftPrevExpanded.value)
          comp.expandFolderById(String(id))
      }
    }
    leftPrevExpanded.value = null
  }
})

watch(rightSearchQuery, q => {
  const comp = rightTreeRef.value
  if (!comp || typeof comp.setSearchQuery !== 'function') return
  comp.setSearchQuery(q)
  const hasQuery = !!(q && q.trim())
  if (hasQuery) {
    if (!rightPrevExpanded.value && comp.expandedFolders) {
      try {
        const cur: Set<string> = comp.expandedFolders
        rightPrevExpanded.value = Array.from(
          cur instanceof Set ? cur : new Set()
        )
      } catch {}
    }
    if (typeof comp.expandAll === 'function') comp.expandAll()
  } else {
    if (rightPrevExpanded.value && Array.isArray(rightPrevExpanded.value)) {
      if (typeof comp.collapseAll === 'function') comp.collapseAll()
      if (typeof comp.expandFolderById === 'function') {
        for (const id of rightPrevExpanded.value)
          comp.expandFolderById(String(id))
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
const onQuickTagsMouseEnter = () => {
  isInteractingWithQuickTags.value = true
}
const onQuickTagsMouseLeave = () => {
  // 延迟一个tick，确保点击事件先处理完成再允许输入框收起
  setTimeout(() => {
    isInteractingWithQuickTags.value = false
  }, 0)
}
const focusLeftFirst = async () => {
  if (!leftTreeRef.value || !leftTreeRef.value.getFirstVisibleBookmarkId) return
  const id = leftTreeRef.value.getFirstVisibleBookmarkId()
  if (id)
    await leftTreeRef.value.focusNodeById(id, {
      collapseOthers: false,
      scrollIntoViewCenter: true
    })
}
const focusRightFirst = async () => {
  if (!rightTreeRef.value || !rightTreeRef.value.getFirstVisibleBookmarkId)
    return
  const id = rightTreeRef.value.getFirstVisibleBookmarkId()
  if (id)
    await rightTreeRef.value.focusNodeById(id, {
      collapseOthers: false,
      scrollIntoViewCenter: true
    })
}

watch(
  () => bookmarkManagementStore.newProposalTree,
  async newTree => {
    if (!newTree || !pendingTagSelection.value?.length) return
    await nextTick()
    const tags = pendingTagSelection.value
    pendingTagSelection.value = null
    const ids = cleanupStore.findProblemNodesByTags(tags)
    if (!ids.length || !rightTreeRef.value) return
    try {
      const instance = rightTreeRef.value
      if (!instance) return
      if (typeof instance.selectNodesByIds === 'function') {
        instance.selectNodesByIds(ids, { append: false })
      }
      const firstId = ids[0]
      if (firstId && typeof instance.focusNodeById === 'function') {
        await instance.focusNodeById(firstId, {
          scrollIntoViewCenter: true
        })
      }
    } catch (error) {
      console.warn('Management', '自动选中健康问题节点失败', error)
    }
  },
  { deep: false }
)
const clearLeftSearch = () => {
  leftSearchQuery.value = ''
  leftSearchOpen.value = false
}
const clearRightSearch = () => {
  rightSearchQuery.value = ''
  rightSearchOpen.value = false
}
const leftExpandAll = ref(false)
const rightExpandAll = ref(false)

// 展开/收起搜索并自动聚焦到输入框；同时让按钮失焦，避免出现聚焦边框
// 切换逻辑由 PanelInlineSearch 内部托管

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
const editFormErrors = ref<{ title: string; url: string }>({
  title: '',
  url: ''
})
const addFormErrors = ref<{ title: string; url: string }>({
  title: '',
  url: ''
})

// 输入时动态清除错误提示
watch(
  () => dialogStore.editBookmarkDialog.url,
  val => {
    if (editFormErrors.value.url && (val || '').trim()) {
      editFormErrors.value.url = ''
    }
  }
)
watch(
  () => dialogStore.addItemDialog.url,
  val => {
    if (addFormErrors.value.url && (val || '').trim()) {
      addFormErrors.value.url = ''
    }
  }
)
// 标题输入时清除错误
watch(
  () => dialogStore.editBookmarkDialog.title,
  val => {
    if (editFormErrors.value.title && (val || '').trim()) {
      editFormErrors.value.title = ''
    }
  }
)
watch(
  () => dialogStore.addItemDialog.title,
  val => {
    if (addFormErrors.value.title && (val || '').trim()) {
      addFormErrors.value.title = ''
    }
  }
)
// Tab 切换时清空输入内容与错误
watch(
  () => dialogStore.addItemDialog.type,
  () => {
    if (!dialogStore.addItemDialog.isOpen) return
    dialogStore.addItemDialog.title = ''
    dialogStore.addItemDialog.url = ''
    addFormErrors.value.title = ''
    addFormErrors.value.url = ''
  }
)

const filteredProposalTree = computed(() => {
  const all = newProposalTree.value.children || []
  const cs = cleanupState.value
  if (
    !cs ||
    !cs.isFiltering ||
    !Array.isArray(cs.activeFilters) ||
    cs.activeFilters.length === 0
  ) {
    return all
  }
  const active = new Set<string>(cs.activeFilters as unknown as string[])
  // 允许的节点：存在与任一过滤类型匹配的问题
  const matchedIds = new Set<string>()
  try {
    for (const [nodeId, problems] of cs.filterResults.entries()) {
      if (!problems || problems.length === 0) continue
      let hit = false
      for (const p of problems as CleanupProblem[]) {
        if (active.has(String(p.type))) {
          hit = true
          // 若为重复，包含相关节点，使整组都可见
          if (p.type === 'duplicate' && Array.isArray(p.relatedNodeIds)) {
            for (const rid of p.relatedNodeIds) matchedIds.add(String(rid))
          }
        }
      }
      if (hit) matchedIds.add(String(nodeId))
    }
  } catch {}

  // 从根递归拷贝仅包含匹配节点所在分支
  const cloneFiltered = (nodes: BookmarkNode[]): BookmarkNode[] => {
    const out: BookmarkNode[] = []
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
})

// 组件就绪：仅在原始树已有数据时解除加载态，避免空数据时过早隐藏蒙层
const handleLeftTreeReady = () => {
  try {
    const hasData =
      Array.isArray(originalTree.value) && originalTree.value.length > 0
    if (isPageLoading.value && hasData) {
      isPageLoading.value = false
    }
  } catch {
    // 忽略
  }
}

// === 新增对话框脏状态：仅输入内容发生变化时提示二次确认 ===
const isAddDirty = computed(() => {
  const t = (dialogStore.addItemDialog.title || '').trim()
  const u = (dialogStore.addItemDialog.url || '').trim()
  if (dialogStore.addItemDialog.type === 'bookmark') {
    return !!t || !!u
  }
  // 文件夹仅标题
  return !!t
})

// === 编辑对话框脏状态：仅当标题或链接发生变化时视为已更改 ===
const isEditDirty = computed(() => {
  const originalTitle = (
    dialogStore.editBookmarkDialog.bookmark?.title || ''
  ).trim()
  const originalUrl = (
    dialogStore.editBookmarkDialog.bookmark?.url || ''
  ).trim()
  const curTitle = (dialogStore.editBookmarkDialog.title || '').trim()
  const curUrl = (dialogStore.editBookmarkDialog.url || '').trim()
  return originalTitle !== curTitle || originalUrl !== curUrl
})

// === 编辑文件夹对话框脏状态与错误 ===
const isEditFolderDirty = computed(() => {
  const originalTitle = (
    dialogStore.editFolderDialog.folder?.title || ''
  ).trim()
  const curTitle = (dialogStore.editFolderDialog.title || '').trim()
  return originalTitle !== curTitle
})
const folderEditFormErrors = ref<{ title: string }>({ title: '' })
watch(
  () => dialogStore.editFolderDialog.title,
  val => {
    if (folderEditFormErrors.value.title && (val || '').trim()) {
      folderEditFormErrors.value.title = ''
    }
  }
)

// 🗑️ 删除确认对话框状态
const isConfirmDeleteDialogOpen = ref(false)
const deleteTargetFolder = ref<BookmarkNode | null>(null)
const deleteFolderBookmarkCount = ref(0)

const handleNodeEdit = (node: BookmarkNode) => {
  if (node?.url) {
    editBookmark({
      id: node.id,
      title: node.title,
      url: node.url || '',
      parentId: node.parentId
    })
  } else {
    editFolder({
      id: node.id,
      title: node.title,
      url: '',
      parentId: node.parentId
    })
  }
}

const handleNodeDelete = (node: BookmarkNode) => {
  if (node.children) {
    // 统计该目录下的书签数量（递归）
    const countBookmarks = (nodes: BookmarkNode[]): number => {
      if (!Array.isArray(nodes)) return 0
      let total = 0
      for (const n of nodes) {
        if (n?.url) total++
        if (n?.children && n.children.length)
          total += countBookmarks(n.children)
      }
      return total
    }
    const count = countBookmarks(node.children || [])
    if (count > 0) {
      deleteTargetFolder.value = node
      deleteFolderBookmarkCount.value = count
      isConfirmDeleteDialogOpen.value = true
    } else {
      deleteFolder(node)
    }
  } else {
    deleteBookmark(node.id)
  }
}

const handleFolderAdd = (node: BookmarkNode) => {
  openAddItemDialog('bookmark', node)
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (node.url) {
    window.open(node.url, '_blank')
  }
}

// === 对话框键盘绑定与提交/取消 ===
const confirmAddNewItem = async () => {
  // 标题必填校验（书签与文件夹通用）
  const title = (dialogStore.addItemDialog.title || '').trim()
  if (!title) {
    addFormErrors.value.title = '标题不能为空'
    return
  }
  // 表单校验：仅在书签模式下校验 URL
  if (dialogStore.addItemDialog.type === 'bookmark') {
    const url = (dialogStore.addItemDialog.url || '').trim()
    if (!DataValidator.validateUrl(url)) {
      // 显示内联错误并阻止保存
      addFormErrors.value.url =
        '链接地址格式不正确。示例：https://example.com/path'
      return
    }
  }
  // 添加新书签
  const res = await bookmarkManagementStore.addBookmark({
    type: dialogStore.addItemDialog.type,
    title: dialogStore.addItemDialog.title,
    url: dialogStore.addItemDialog.url,
    parentId: dialogStore.addItemDialog.parentFolder?.id
  })
  // 自动滚动并高亮定位到新节点
  if (
    res &&
    rightTreeRef.value &&
    typeof rightTreeRef.value.focusNodeById === 'function'
  ) {
    await nextTick()
    try {
      await rightTreeRef.value.focusNodeById(res.id, {
        collapseOthers: true,
        scrollIntoViewCenter: true
      })
    } catch (e) {
      console.error('新增后定位失败:', e)
    }
  }
}

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

const confirmEditBookmark = async () => {
  // 未发生更改则不提交
  if (!isEditDirty.value) return
  // 标题必填校验
  const title = (dialogStore.editBookmarkDialog.title || '').trim()
  if (!title) {
    editFormErrors.value.title = '标题不能为空'
    return
  }
  // 表单校验：编辑书签时校验 URL
  const url = (dialogStore.editBookmarkDialog.url || '').trim()
  if (!DataValidator.validateUrl(url)) {
    editFormErrors.value.url =
      '链接地址格式不正确。示例：https://example.com/path'
    return
  }
  await bookmarkManagementStore.editBookmark({
    id: dialogStore.editBookmarkDialog.bookmark!.id,
    title: dialogStore.editBookmarkDialog.title,
    url: dialogStore.editBookmarkDialog.url,
    parentId: dialogStore.editBookmarkDialog.parentId
  })
}

const confirmEditFolder = async () => {
  if (!isEditFolderDirty.value) return
  const title = (dialogStore.editFolderDialog.title || '').trim()
  if (!title) {
    folderEditFormErrors.value.title = '标题不能为空'
    return
  }
  await bookmarkManagementStore.editBookmark({
    id: dialogStore.editFolderDialog.folder!.id,
    title: dialogStore.editFolderDialog.title,
    url: '', // 文件夹没有 URL
    parentId: undefined
  })
}

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

// 统一关闭确认由 ConfirmableDialog 托管

// === 删除确认对话框：确认与取消 ===
const confirmDeleteFolder = () => {
  if (deleteTargetFolder.value) {
    deleteFolder(deleteTargetFolder.value)
  }
  isConfirmDeleteDialogOpen.value = false
  deleteTargetFolder.value = null
  deleteFolderBookmarkCount.value = 0
}

const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  if (node.url) {
    navigator.clipboard.writeText(node.url)
    notificationService.notify('URL copied!', { level: 'success' })
  }
}

// 键盘行为统一由 Dialog 组件处理（Enter=confirm，Esc=close）

onMounted(() => {
  initializeStore()
  cleanupStore.refreshHealthFromIndexedDB({ silent: true })

  // 解析来自 Popup 的筛选参数并启动清理扫描
  try {
    const params = new URLSearchParams(window.location.search)
    const tagsParam = params.get('tags')
    const tagList = tagsParam
      ? tagsParam
          .split(',')
          .map(tag => tag.trim())
          .filter((tag): tag is HealthTag =>
            ['404', 'duplicate', 'empty', 'invalid'].includes(tag)
          )
      : []

    if (tagList.length > 0) {
      cleanupStore.initializeCleanupState()
      cleanupStore.setActiveFilters(tagList)
      pendingTagSelection.value = tagList
    }
  } catch {}

  // 未保存更改离开提醒
  // 暂存更改保护已迁移到 BookmarkManagementStore
  // bookmarkManagementStore.attachUnsavedChangesGuard()

  // ✅ 实时同步：监听来自后台/书签API的变更事件（提示确认）
  const handleBookmarkUpdated = (evt: Event) => {
    const detail = (evt as CustomEvent)?.detail ?? {}
    pendingUpdateDetail.value = detail
    // 若没有未保存的更改，自动刷新（去抖合并连续事件）
    if (!hasUnsavedChanges.value) {
      if (autoRefreshTimer) {
        clearTimeout(autoRefreshTimer)
        autoRefreshTimer = null
      }
      autoRefreshTimer = window.setTimeout(() => {
        notificationService.notify('检测到外部更新，正在刷新数据...', {
          level: 'info'
        })
        void confirmExternalUpdate()
      }, 200)
      return
    }
    // 有未保存更改时，提示用户手动确认刷新
    showUpdatePrompt.value = true
    notificationService.notify('检测到外部书签变更', { level: 'info' })
  }
  window.addEventListener(
    AB_EVENTS.BOOKMARK_UPDATED,
    handleBookmarkUpdated as (e: Event) => void
  )

  // === 精细化更新辅助函数 ===

  /**
   * 刷新单个书签节点（创建或移动后）
   *
   * @param bookmarkId - 书签ID
   */
  async function refreshSingleBookmark(bookmarkId: string | undefined) {
    if (!bookmarkId) {
      console.warn(
        '[Management] refreshSingleBookmark: 缺少 bookmarkId，回退到全量刷新'
      )
      await initializeStore()
      return
    }

    try {
      // 从 IndexedDB 读取最新节点数据
      const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
      if (!bookmark) {
        console.warn('[Management] 书签不存在，可能已被删除:', bookmarkId)
        return
      }

      // 转换为 BookmarkNode 格式
      const node: BookmarkNode = {
        id: bookmark.id,
        parentId: bookmark.parentId,
        title: bookmark.title || '',
        url: bookmark.url,
        dateAdded: bookmark.dateAdded,
        dateGroupModified: bookmark.dateGroupModified,
        index: bookmark.index,
        isFolder: !bookmark.url,
        childrenCount: bookmark.childrenCount || 0,
        bookmarksCount: bookmark.bookmarksCount || 0
      }

      // 更新到 bookmarkStore
      const bookmarkStore = useBookmarkStore()
      bookmarkStore.upsertNode(node)

      console.log('[Management] ✅ 单个书签已刷新:', bookmark.title)
    } catch (error) {
      console.error('[Management] refreshSingleBookmark 失败:', error)
      // 失败时回退到全量刷新
      await initializeStore()
    }
  }

  /**
   * 更新单个书签节点（修改后）
   *
   * @param bookmarkId - 书签ID
   */
  async function updateSingleBookmark(bookmarkId: string | undefined) {
    if (!bookmarkId) {
      console.warn(
        '[Management] updateSingleBookmark: 缺少 bookmarkId，回退到全量刷新'
      )
      await initializeStore()
      return
    }

    try {
      // 从 IndexedDB 读取最新节点数据
      const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
      if (!bookmark) {
        console.warn('[Management] 书签不存在，可能已被删除:', bookmarkId)
        return
      }

      // 只更新变化的字段
      const bookmarkStore = useBookmarkStore()
      bookmarkStore.updateNode(bookmarkId, {
        title: bookmark.title || '',
        url: bookmark.url,
        dateGroupModified: bookmark.dateGroupModified
      })

      console.log('[Management] ✅ 单个书签已更新:', bookmark.title)
    } catch (error) {
      console.error('[Management] updateSingleBookmark 失败:', error)
      // 失败时回退到全量刷新
      await initializeStore()
    }
  }

  /**
   * 删除单个书签节点
   *
   * @param bookmarkId - 书签ID
   */
  async function removeSingleBookmark(bookmarkId: string | undefined) {
    if (!bookmarkId) {
      console.warn(
        '[Management] removeSingleBookmark: 缺少 bookmarkId，回退到全量刷新'
      )
      await initializeStore()
      return
    }

    try {
      const bookmarkStore = useBookmarkStore()
      bookmarkStore.removeNode(bookmarkId)

      console.log('[Management] ✅ 单个书签已删除:', bookmarkId)
    } catch (error) {
      console.error('[Management] removeSingleBookmark 失败:', error)
      // 失败时回退到全量刷新
      await initializeStore()
    }
  }

  // 后台已完成IDB同步时的快速刷新：根据事件类型执行精细化或全量更新
  const handleDbSynced = async (evt: Event) => {
    if (hasUnsavedChanges.value) return // 保持与更新提示一致，避免丢失暂存

    const detail = (evt as CustomEvent)?.detail ?? {}
    const { eventType, bookmarkId } = detail

    if (autoRefreshTimer) {
      clearTimeout(autoRefreshTimer)
      autoRefreshTimer = null
    }

    autoRefreshTimer = window.setTimeout(async () => {
      try {
        await indexedDBManager.initialize()

        // 根据事件类型执行不同的更新策略
        switch (eventType) {
          case 'created': {
            console.log('[Management] 📝 单个书签创建，精细化更新:', bookmarkId)
            await refreshSingleBookmark(bookmarkId)
            notificationService.notify('书签已创建', { level: 'success' })
            break
          }

          case 'changed': {
            console.log('[Management] ✏️ 单个书签修改，精细化更新:', bookmarkId)
            await updateSingleBookmark(bookmarkId)
            notificationService.notify('书签已更新', { level: 'success' })
            break
          }

          case 'removed': {
            console.log('[Management] 🗑️ 单个书签删除，精细化更新:', bookmarkId)
            await removeSingleBookmark(bookmarkId)
            notificationService.notify('书签已删除', { level: 'success' })
            break
          }

          case 'moved': {
            console.log('[Management] 📁 单个书签移动，精细化更新:', bookmarkId)
            await refreshSingleBookmark(bookmarkId)
            notificationService.notify('书签已移动', { level: 'success' })
            break
          }

          case 'full-sync':
          default: {
            // 全量同步或未知事件类型，执行完整刷新
            console.log('[Management] 🔄 全量同步，刷新所有数据')
            notificationService.notify('数据已同步，刷新中...', {
              level: 'info'
            })
            await initializeStore()
            // 搜索索引通常依赖书签全集变化，按需刷新
            try {
              await searchWorkerAdapter.initFromIDB()
            } catch {}
            notificationService.notify('已同步最新书签', { level: 'success' })
            break
          }
        }
      } catch (e) {
        notificationService.notify('同步失败', { level: 'error' })
        console.error('handleDbSynced error:', e)
      }
    }, 100)
  }
  window.addEventListener(
    AB_EVENTS.BOOKMARKS_DB_SYNCED,
    handleDbSynced as (e: Event) => void
  )

  // 组件卸载时清理监听器
  onUnmounted(() => {
    window.removeEventListener(
      AB_EVENTS.BOOKMARK_UPDATED,
      handleBookmarkUpdated as (e: Event) => void
    )
    window.removeEventListener(AB_EVENTS.BOOKMARKS_DB_SYNCED, handleDbSynced)
    if (autoRefreshTimer) {
      clearTimeout(autoRefreshTimer)
      autoRefreshTimer = null
    }
    // 暂存更改保护已迁移到 BookmarkManagementStore
    // bookmarkManagementStore.detachUnsavedChangesGuard()
  })

  // 暴露全局测试方法，便于在浏览器控制台直接调用
  const g = window as unknown as Record<string, unknown>
  g.AB_setFolderExpanded = (id: string, expanded?: boolean) => {
    const comp = leftTreeRef.value
    if (!comp) return
    const sid = String(id)
    // 未传第二个参数时，默认取反（切换）
    if (expanded === undefined) {
      if (typeof comp.toggleFolderById === 'function')
        comp.toggleFolderById(sid)
      return
    }
    if (expanded) {
      if (typeof comp.expandFolderById === 'function')
        comp.expandFolderById(sid)
    } else {
      if (typeof comp.collapseFolderById === 'function')
        comp.collapseFolderById(sid)
    }
  }
  g.AB_toggleFolder = (id: string) => {
    const comp = leftTreeRef.value
    if (!comp) return
    const sid = String(id)
    if (typeof comp.toggleFolderById === 'function') comp.toggleFolderById(sid)
  }
  g.AB_focusBookmark = (
    id: string,
    opts?: {
      collapseOthers?: boolean
      scrollIntoViewCenter?: boolean
      pathIds?: string[]
    }
  ) => {
    const comp = leftTreeRef.value
    if (!comp || !comp.focusNodeById) return
    comp.focusNodeById(
      String(id),
      opts || { collapseOthers: true, scrollIntoViewCenter: true }
    )
  }
})

// 一键展开/收起 - 事件处理
const toggleLeftExpandAll = async () => {
  if (!leftTreeRef.value) return
  if (isExpanding.value) return
  isExpanding.value = true
  schedulerService.scheduleUIUpdate(() => {
    isPageLoading.value = true
    loadingMessage.value = leftExpandAll.value ? '正在收起...' : '正在展开...'
  })
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
  schedulerService.scheduleUIUpdate(() => {
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
  try {
    rightTreeRef.value?.clearSelection?.()
  } catch {}
  rightSelectedIds.value = []
}

// 📣 更新提示动作（简化为"同步 + 重新初始化页面"）
const confirmExternalUpdate = async () => {
  try {
    showUpdatePrompt.value = false
    // 切换为本地刷新：重新初始化 DB 并刷新 Store
    notificationService.notify('正在刷新本地数据...', { level: 'info' })
    await indexedDBManager.initialize()
    await initializeStore()
    // 同步刷新搜索索引（Worker）
    try {
      await searchWorkerAdapter.initFromIDB()
    } catch {}
    notificationService.notify('数据已更新', { level: 'success' })
  } catch (e) {
    console.error('confirmExternalUpdate error:', e)
    notificationService.notify('更新失败', { level: 'error' })
  }
}

// 右侧悬停联动：让左侧只读树按 pathIds 展开父链并高亮对应ID，滚动居中
// 性能优化：防抖与去重 + 悬停不折叠其它分支，减少重渲染
const handleRightNodeHover = (node: BookmarkNode) => {
  const id = node?.id != null ? String(node.id) : ''
  // 先打印右侧节点的 pathIds 以便调试
  console.log('[右侧 hover] pathIds =', node?.pathIds, 'id =', id)
  if (!id || !leftTreeRef.value) return
  if (lastHoverId === id) return
  lastHoverId = id
  // 如果右侧节点带有 IndexedDB 预处理的 pathIds，直接复用祖先链，避免在左侧再计算
  const pathIds = Array.isArray(node?.pathIds)
    ? node.pathIds.map((x: string | number) => String(x))
    : undefined
  if (hoverDebounceTimer) {
    clearTimeout(hoverDebounceTimer)
    hoverDebounceTimer = null
  }
  try {
    performance.mark('hover_to_scroll_start')
  } catch {}
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
      comp.focusNodeById(id, {
        collapseOthers: hoverExclusiveCollapse.value,
        scrollIntoViewCenter: true,
        pathIds
      })
    } catch {}
  }, 100)
}

// 右侧悬停移出：清除左侧的程序化 hover 高亮
const handleRightNodeHoverLeave = () => {
  const comp = leftTreeRef.value
  if (comp && typeof comp.clearHoverAndActive === 'function') {
    try {
      comp.clearHoverAndActive()
    } catch {}
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
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : '/settings.html'
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
  try {
    rightTreeRef.value?.clearSelection?.()
  } catch {}
}

// 局部轻量数字动画（与 Popup 同一实现思路）
const AnimatedNumber = {
  name: 'AnimatedNumber',
  props: {
    value: { type: Number, required: true },
    duration: { type: Number, default: 500 }
  },
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
    watch(
      () => props.value,
      (nv: number) => animate(nv)
    )
    return () => h('span', display.value.toString())
  }
} as Record<string, unknown>

const handleApply = async () => {
  try {
    await bookmarkManagementStore.applyStagedChanges()
    notificationService.notify('已应用更改', { level: 'success' })
  } catch (e) {
    console.error('handleApply failed:', e)
    notificationService.notify('应用失败', { level: 'error' })
  }
}

// =============================
// 已移除：批量数据生成/删除测试代码
// =============================
</script>

<style scoped>
.ai-status-right {
  margin-left: var(--spacing-3);
}
</style>
<style scoped>
.mt-sm {
  margin-top: var(--spacing-2);
}
.expand-toggle-icon {
  display: inline-flex;
  transition:
    transform var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard);
}

.expand-toggle-icon.expanded {
  transform: rotate(180deg);
}

.expand-toggle-icon.expanding {
  opacity: 0.85;
}
</style>

<style scoped>
.quick-tags-popover {
  position: absolute;
  /* 锚定在右侧面板 header 的右上角 */
  top: 51px;
  right: var(--spacing-sm);
  z-index: 40; /* 保证浮层在上层 */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-1-5) var(--spacing-sm);
  box-shadow: var(--shadow-lg, 0 6px 20px rgba(0, 0, 0, 0.16));
}
.tag-quick-fade-enter-active,
.tag-quick-fade-leave-active {
  transition:
    opacity var(--md-sys-motion-duration-short3)
      var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short3)
      var(--md-sys-motion-easing-standard);
}
.tag-quick-fade-enter-from,
.tag-quick-fade-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--spacing-1)));
}

.bulk-delete-in-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  background: var(--color-error-subtle);
}
/* 选择统计：避免数字变化导致文本整体"抖动" */
.selection-summary {
  font-weight: 600;
  display: inline-flex;
  align-items: baseline; /* 让数字与汉字基线对齐，避免上下跳动 */
  /* 消除模板空白带来的字符间距 */
  font-size: 0;
}
.selection-summary .text {
  font-size: 1rem; /* 恢复正常字号 */
}
.selection-summary .count {
  /* 移除外边距，由显式 gap 控制空隙 */
  margin: 0;
  font-weight: 800;
  font-size: 1rem; /* 恢复正常字号 */
  /* 使用等宽数字和固定宽度避免横向位移 */
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  /* 至少两位宽度（按字符单位），右对齐以保持文案稳定 */
  min-width: 3ch;
  text-align: center;
  display: inline-block;
}
.selection-summary .gap {
  display: inline-block;
  width: var(--spacing-2-5);
  height: 1em;
}
.bulk-delete-btn {
  background: var(--color-error);
  color: var(--color-text-on-primary);
  border: 1px solid var(--color-error);
}
.bulk-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
  gap: var(--spacing-6);
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
  /* 高分屏自然尺寸 */
  height: var(--spacing-6);
  margin-right: var(--spacing-4);
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
  height: calc(100vh - var(--spacing-16));
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
  gap: var(--spacing-3);
  position: relative; /* 作为浮层定位参照 */
  overflow: visible; /* 放行浮层 */
}

.panel-title-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm) var(--gap-sm);
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
  margin: 0 var(--spacing-1);
}

.stats-change {
  margin-left: var(--spacing-sm);
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
  gap: var(--spacing-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  gap: var(--spacing-4);
}

.edit-form,
.add-item-form {
  padding: var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

/* 语义搜索样式 */
.semantic-search-panel {
  padding: var(--spacing-sm) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.semantic-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
  gap: var(--spacing-sm);
  padding: var(--spacing-1-5) 0;
}

.semantic-loading-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-results {
  padding: var(--spacing-sm) 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-1-5);
}

.semantic-item {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.semantic-item:hover {
  background: var(--color-surface-hover);
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

/* 局部：底部批量操作条入场/出场动画（出现：自下而上；消失：向下）*/
.card-footer-slide-enter-active,
.card-footer-slide-leave-active {
  transition:
    transform var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4)
      var(--md-sys-motion-easing-standard);
  will-change: transform, opacity;
}
.card-footer-slide-enter-from {
  transform: translateY(var(--spacing-4));
  opacity: 0;
}
.card-footer-slide-leave-to {
  transform: translateY(var(--spacing-4));
  opacity: 0;
}

.control-btn--icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  padding: 0;
}

.control-btn--icon .btn__icon {
  margin: 0;
}
</style>
