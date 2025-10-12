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
        <Button
          size="sm"
          variant="outline"
          class="ml-2"
          :disabled="isPageLoading || isBulkMutating"
          data-testid="btn-generate"
          @click="isGenerateDialogOpen = true"
        >
          <template #prepend>
            <Icon name="mdi-database-plus" />
          </template>
          生成书签
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="ml-2"
          :disabled="isPageLoading || isBulkMutating"
          data-testid="btn-delete"
          @click="isDeleteDialogOpen = true"
        >
          <template #prepend>
            <Icon name="mdi-database-minus" />
          </template>
          随机删书签
        </Button>
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
                      title="一键展开/收起"
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
                              ? 'mdi-unfold-less-horizontal'
                              : 'mdi-unfold-more-horizontal'
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
                  :nodes="originalTree as unknown as BookmarkNode[]"
                  source="management"
                  height="100%"
                  size="comfortable"
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
          <Grid is="col" cols="2" class="panel-col">
            <Card
              class="panel-card fill-height"
              elevation="low"
              borderless
              :padding="false"
            >
              <div class="panel-content control-panel">
                <div class="control-actions">
                  <Button variant="ghost" size="lg" @click="handleCompare">
                    <template #prepend>
                      <Icon name="mdi-compare" />
                    </template>
                    对比
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    color="primary"
                    @click="handleApply"
                  >
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

                    <Button
                      variant="text"
                      size="sm"
                      icon
                      title="一键展开/收起"
                      :disabled="isPageLoading"
                      @click="toggleRightExpandAll"
                    >
                      <span
                        class="expand-toggle-icon"
                        :class="{
                          expanded: rightExpandAll,
                          expanding: isPageLoading
                        }"
                      >
                        <Icon
                          :name="
                            rightExpandAll
                              ? 'mdi-unfold-less-horizontal'
                              : 'mdi-unfold-more-horizontal'
                          "
                        />
                      </span>
                    </Button>
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
                <CleanupLegend
                  v-if="cleanupState && cleanupState.isFiltering"
                />

                <SimpleBookmarkTree
                  ref="rightTreeRef"
                  :nodes="filteredProposalTree"
                  height="100%"
                  size="comfortable"
                  :editable="true"
                  :show-toolbar="true"
                  selectable="multiple"
                  :show-selection-checkbox="true"
                  :toolbar-expand-collapse="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  :virtual="true"
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

    <Toast
      v-model:show="snackbar"
      :text="snackbarText"
      :color="snackbarColor"
      :timeout="2000"
    />
    <CleanupProgress />
    <!-- 清理高级设置已迁移至设置页（settings.html?tab=cleanup），此处不再展示对话框 -->
    <!-- <CleanupSettings /> -->

    <!-- Edit Bookmark Dialog -->
    <ConfirmableDialog
      :show="isEditBookmarkDialogOpen"
      title="编辑书签"
      icon="mdi-pencil"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_EDIT"
      :is-dirty="isEditDirty"
      max-width="500px"
      min-width="500px"
      @update:show="(v: boolean) => (isEditBookmarkDialogOpen = v)"
      @confirm="confirmEditBookmark"
    >
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
        <Button
          color="primary"
          :disabled="!isEditDirty"
          @click="confirmEditBookmark"
          >更新</Button
        >
      </template>
    </ConfirmableDialog>

    <!-- Bulk Generate Dialog -->
    <ConfirmableDialog
      :show="isGenerateDialogOpen"
      title="生成测试数据"
      icon="mdi-database-plus"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      max-width="520px"
      min-width="520px"
      @update:show="(v: boolean) => (isGenerateDialogOpen = v)"
      @confirm="confirmGenerate"
    >
      <div class="add-item-form" data-testid="dlg-generate">
        <div class="form-fields">
          <Input
            v-model.number="genTotal"
            label="总条数"
            variant="outlined"
            class="form-field"
            data-testid="gen-total"
          />
          <Input
            v-model.number="genFolders"
            label="文件夹数"
            variant="outlined"
            class="form-field"
            data-testid="gen-folders"
          />
          <Input
            v-model.number="genPerFolder"
            label="每文件夹条数"
            variant="outlined"
            class="form-field"
            data-testid="gen-per-folder"
          />
        </div>
        <details class="mt-sm">
          <summary>高级参数</summary>
          <div class="form-fields mt-sm">
            <Input
              v-model.number="genYieldEvery"
              label="创建让出频率（每 N 条）"
              variant="outlined"
              class="form-field"
              data-testid="gen-yield-every"
            />
            <Input
              v-model.number="genPauseMsPerFolder"
              label="每个文件夹间隔（毫秒）"
              variant="outlined"
              class="form-field"
              data-testid="gen-pause-per-folder"
            />
            <Input
              v-model.number="genRetryAttempts"
              label="失败重试次数"
              variant="outlined"
              class="form-field"
              data-testid="gen-retry-attempts"
            />
            <Input
              v-model.number="genRetryDelayMs"
              label="重试基础延迟（毫秒）"
              variant="outlined"
              class="form-field"
              data-testid="gen-retry-delay"
            />
          </div>
        </details>
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button
          color="primary"
          data-testid="btn-generate-confirm"
          @click="confirmGenerate"
          >开始生成</Button
        >
      </template>
    </ConfirmableDialog>

    <!-- Bulk Delete Dialog -->
    <ConfirmableDialog
      :show="isDeleteDialogOpen"
      title="随机删除测试数据"
      icon="mdi-database-minus"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      max-width="520px"
      min-width="520px"
      @update:show="(v: boolean) => (isDeleteDialogOpen = v)"
      @confirm="confirmDeleteBulk"
    >
      <div class="add-item-form" data-testid="dlg-delete">
        <div class="form-fields">
          <Input
            v-model.number="delTarget"
            label="目标删除条数"
            variant="outlined"
            class="form-field"
            data-testid="del-target"
          />
          <label class="flex items-center gap-2" data-testid="del-clean-empty">
            <input v-model="delCleanEmptyFolders" type="checkbox" />
            清理空文件夹
          </label>
        </div>
        <details class="mt-sm">
          <summary>高级参数</summary>
          <div class="form-fields mt-sm">
            <Input
              v-model.number="delChunkSize"
              label="删除分片大小"
              variant="outlined"
              class="form-field"
              data-testid="del-chunk-size"
            />
            <Input
              v-model.number="delRetryAttempts"
              label="失败重试次数"
              variant="outlined"
              class="form-field"
              data-testid="del-retry-attempts"
            />
            <Input
              v-model.number="delRetryDelayMs"
              label="重试基础延迟（毫秒）"
              variant="outlined"
              class="form-field"
              data-testid="del-retry-delay"
            />
          </div>
        </details>
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">取消</Button>
        <Button
          color="error"
          data-testid="btn-delete-confirm"
          @click="confirmDeleteBulk"
          >开始删除</Button
        >
      </template>
    </ConfirmableDialog>

    <!-- Bulk Delete Confirm Dialog -->
    <ConfirmableDialog
      :show="isConfirmBulkDeleteDialogOpen"
      title="确认批量删除"
      icon="mdi-delete-sweep"
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
      :show="isEditFolderDialogOpen"
      title="编辑文件夹"
      icon="mdi-folder-edit"
      :persistent="true"
      :esc-to-close="true"
      :enable-cancel-guard="false"
      :confirm-message="MSG_CANCEL_EDIT"
      :is-dirty="isEditFolderDirty"
      max-width="500px"
      min-width="500px"
      @update:show="(v: boolean) => (isEditFolderDialogOpen = v)"
      @confirm="confirmEditFolder"
    >
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
      icon="mdi-delete"
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
      :show="isAddNewItemDialogOpen"
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
      @update:show="(v: boolean) => (isAddNewItemDialogOpen = v)"
      @confirm="confirmAddNewItem"
    >
      <div ref="addDialogContentRef" class="add-item-form">
        <Tabs
          v-model="addItemType"
          :tabs="[
            { value: 'bookmark', text: '书签' },
            { value: 'folder', text: '文件夹' }
          ]"
          grow
        />
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
        <Button color="primary" @click="confirmAddNewItem">{{
          addConfirmText
        }}</Button>
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
import { useManagementStore } from '../stores/management-store'
import { type BookmarkNode } from '@/core/bookmark/domain/bookmark'
import { type CleanupProblem } from '@/core/bookmark/domain/cleanup-problem'
import {
  App,
  AppBar,
  Button,
  Card,
  Dialog,
  Grid,
  Icon,
  Input,
  Main,
  Overlay,
  Spinner,
  Tabs,
  Toast,
  UrlInput
} from '../components/ui'
import PanelInlineSearch from '../components/PanelInlineSearch.vue'
import { AB_EVENTS } from '@/constants/events'
import { notificationService } from '@/application/notification/notification-service'
import ConfirmableDialog from '../components/ui/ConfirmableDialog.vue'
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue'
// 移除顶部/全局搜索，不再引入搜索盒与下拉
import CleanupTagPicker from './cleanup/CleanupTagPicker.vue'
import CleanupLegend from './cleanup/CleanupLegend.vue'
import CleanupProgress from './cleanup/CleanupProgress.vue'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { searchWorkerAdapter } from '@/services/search-worker-adapter'
// 导入现代书签服务：以 side-effect 方式初始化并设置事件监听与消息桥接
import '../services/modern-bookmark-service'
import { DataValidator } from '@/core/common/store-error'

const managementStore = useManagementStore()

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
  hasUnsavedChanges,
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
  newItemUrl
} = storeToRefs(managementStore)

const {
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor,
  initialize: initializeStore,
  editBookmark,
  editFolder,
  deleteBookmark,
  deleteFolder,
  openAddNewItemDialog,
  bulkDeleteByIds
} = managementStore

// 统一的确认文案（减少重复与便于维护）
const MSG_CANCEL_EDIT = '您有更改尚未保存，确定取消并丢弃更改吗？'
const MSG_CANCEL_ADD = '您有更改尚未添加，确定取消并丢弃输入吗？'

// 统一文案由 ConfirmableDialog 使用，已移除旧的通用处理函数
// === 添加新项目对话框：标题/图标随 Tab，但底部按钮固定文案 ===
const addDialogTitle = computed(() =>
  addItemType.value === 'bookmark' ? '添加新书签' : '添加新文件夹'
)
const addDialogIcon = computed(() =>
  addItemType.value === 'bookmark' ? 'mdi-bookmark-plus' : 'mdi-folder-plus'
)
// 按需求固定为“添加”，不随 Tab 切换变化
const addConfirmText = computed(() => '添加')

// 为固定弹窗高度：以“书签”Tab 的内容高度为准
const addDialogContentRef = ref<HTMLElement | null>(null)
const addDialogMinHeight = ref<string | undefined>(undefined)

// 在弹窗打开后测量当前内容高度（通常为“书签”Tab）并固定
watch(isAddNewItemDialogOpen, async open => {
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
})

// 已移除未使用的 leftPanelRef，减少无意义的响应式状态
// 顶部全局搜索已移除
// 配置功能已迁移到设置页，此处不再包含嵌入/向量相关控制
// 🔔 外部变更更新提示
const showUpdatePrompt = ref(false)
const pendingUpdateDetail = ref<Record<string, unknown> | null>(null)
const updatePromptMessage = ref(
  '检测到外部书签发生变更。为避免基于旧数据继续编辑导致冲突，需刷新到最新数据后再继续。'
)
// 批量变更标志：批量生成/删除期间抑制外部更新提示
const isBulkMutating = ref(false)
// 外部变更自动刷新去抖计时器
let autoRefreshTimer: number | null = null

// === 批量生成/删除 对话框参数 ===
const isGenerateDialogOpen = ref(false)
const genTotal = ref(10_000)
const genFolders = ref(100)
const genPerFolder = ref(100)
const genYieldEvery = ref(200) // 每创建 N 条让出主线程
const genPauseMsPerFolder = ref(0)
const genRetryAttempts = ref(2)
const genRetryDelayMs = ref(120)

const isDeleteDialogOpen = ref(false)
const delTarget = ref(10_000)
const delCleanEmptyFolders = ref(true)
const delChunkSize = ref(200)
const delRetryAttempts = ref(2)
const delRetryDelayMs = ref(120)
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
watch(editUrl, val => {
  if (editFormErrors.value.url && (val || '').trim()) {
    editFormErrors.value.url = ''
  }
})
watch(newItemUrl, val => {
  if (addFormErrors.value.url && (val || '').trim()) {
    addFormErrors.value.url = ''
  }
})
// 标题输入时清除错误
watch(editTitle, val => {
  if (editFormErrors.value.title && (val || '').trim()) {
    editFormErrors.value.title = ''
  }
})
watch(newItemTitle, val => {
  if (addFormErrors.value.title && (val || '').trim()) {
    addFormErrors.value.title = ''
  }
})
// Tab 切换时清空输入内容与错误
watch(addItemType, () => {
  if (!isAddNewItemDialogOpen.value) return
  newItemTitle.value = ''
  newItemUrl.value = ''
  addFormErrors.value.title = ''
  addFormErrors.value.url = ''
})

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
  const t = (newItemTitle.value || '').trim()
  const u = (newItemUrl.value || '').trim()
  if (addItemType.value === 'bookmark') {
    return !!t || !!u
  }
  // 文件夹仅标题
  return !!t
})

// === 编辑对话框脏状态：仅当标题或链接发生变化时视为已更改 ===
const isEditDirty = computed(() => {
  const originalTitle = (editingBookmark.value?.title || '').trim()
  const originalUrl = (editingBookmark.value?.url || '').trim()
  const curTitle = (editTitle.value || '').trim()
  const curUrl = (editUrl.value || '').trim()
  return originalTitle !== curTitle || originalUrl !== curUrl
})

// === 编辑文件夹对话框脏状态与错误 ===
const isEditFolderDirty = computed(() => {
  const originalTitle = (editingFolder.value?.title || '').trim()
  const curTitle = (editFolderTitle.value || '').trim()
  return originalTitle !== curTitle
})
const folderEditFormErrors = ref<{ title: string }>({ title: '' })
watch(editFolderTitle, val => {
  if (folderEditFormErrors.value.title && (val || '').trim()) {
    folderEditFormErrors.value.title = ''
  }
})

// 🗑️ 删除确认对话框状态
const isConfirmDeleteDialogOpen = ref(false)
const deleteTargetFolder = ref<BookmarkNode | null>(null)
const deleteFolderBookmarkCount = ref(0)

const handleNodeEdit = (node: BookmarkNode) => {
  if (node?.url) {
    editBookmark(node)
  } else {
    editFolder(node)
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
    deleteBookmark(node)
  }
}

const handleFolderAdd = (node: BookmarkNode) => {
  openAddNewItemDialog('bookmark', node)
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (node.url) {
    window.open(node.url, '_blank')
  }
}

// === 对话框键盘绑定与提交/取消 ===
const confirmAddNewItem = async () => {
  // 标题必填校验（书签与文件夹通用）
  const title = (newItemTitle.value || '').trim()
  if (!title) {
    addFormErrors.value.title = '标题不能为空'
    return
  }
  // 表单校验：仅在书签模式下校验 URL
  if (addItemType.value === 'bookmark') {
    const url = (newItemUrl.value || '').trim()
    if (!DataValidator.validateUrl(url)) {
      // 显示内联错误并阻止保存
      addFormErrors.value.url =
        '链接地址格式不正确。示例：https://example.com/path'
      return
    }
  }
  // 暂存到右侧面板
  const res = managementStore.confirmAddNewItemStaged()
  // 自动滚动并高亮定位到新节点
  if (
    res &&
    rightTreeRef.value &&
    typeof rightTreeRef.value.focusNodeById === 'function'
  ) {
    await nextTick()
    try {
      await rightTreeRef.value.focusNodeById(res.id, {
        pathIds: res.pathIds,
        collapseOthers: true,
        scrollIntoViewCenter: true
      })
    } catch (e) {
      console.error('新增后定位失败:', e)
    }
  }
}

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

const confirmEditBookmark = () => {
  // 未发生更改则不提交
  if (!isEditDirty.value) return
  // 标题必填校验
  const title = (editTitle.value || '').trim()
  if (!title) {
    editFormErrors.value.title = '标题不能为空'
    return
  }
  // 表单校验：编辑书签时校验 URL
  const url = (editUrl.value || '').trim()
  if (!DataValidator.validateUrl(url)) {
    editFormErrors.value.url =
      '链接地址格式不正确。示例：https://example.com/path'
    return
  }
  managementStore.saveEditedBookmark()
}

const confirmEditFolder = () => {
  if (!isEditFolderDirty.value) return
  const title = (editFolderTitle.value || '').trim()
  if (!title) {
    folderEditFormErrors.value.title = '标题不能为空'
    return
  }
  managementStore.saveEditedFolder()
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

  // 解析来自 Popup 的筛选参数并启动清理扫描
  try {
    const params = new URLSearchParams(window.location.search)
    const filterParam = params.get('filter')
    if (filterParam) {
      const map: Record<string, '404' | 'duplicate' | 'empty' | 'invalid'> = {
        '404': '404',
        duplicate: 'duplicate',
        empty: 'empty',
        invalid: 'invalid'
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
              const fallbackId =
                rightTreeRef.value?.getFirstVisibleBookmarkId?.()
              const toFocusId = firstProblemNodeId || fallbackId
              if (toFocusId && rightTreeRef.value) {
                // 先确保路径展开并滚动居中
                await rightTreeRef.value.focusNodeById(String(toFocusId), {
                  collapseOthers: false,
                  scrollIntoViewCenter: true
                })
                // 再进行选择（多选模式允许追加；此处不追加，保持唯一选择）
                try {
                  rightTreeRef.value.selectNodeById(String(toFocusId), {
                    append: false
                  })
                } catch {}
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
  managementStore.attachUnsavedChangesGuard()

  // ✅ 实时同步：监听来自后台/书签API的变更事件（提示确认）
  const handleBookmarkUpdated = (evt: Event) => {
    // 批量操作期间不弹外部更新提示，避免打断流程
    if (isBulkMutating.value) return
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

  // 后台已完成IDB同步时的快速刷新：更轻量的本地数据重载
  const handleDbSynced = () => {
    if (isBulkMutating.value) return
    if (hasUnsavedChanges.value) return // 保持与更新提示一致，避免丢失暂存
    if (autoRefreshTimer) {
      clearTimeout(autoRefreshTimer)
      autoRefreshTimer = null
    }
    autoRefreshTimer = window.setTimeout(async () => {
      notificationService.notify('数据已同步，快速刷新中...', { level: 'info' })
      try {
        await indexedDBManager.initialize()
        await initializeStore()
        // 搜索索引通常依赖书签全集变化，按需刷新；此处保持与自动刷新一致
        try {
          await searchWorkerAdapter.initFromIDB()
        } catch {}
        notificationService.notify('已同步最新书签', { level: 'success' })
      } catch (e) {
        notificationService.notify('快速刷新失败', { level: 'error' })
        console.error('handleDbSynced error:', e)
      }
    }, 100)
  }
  window.addEventListener(AB_EVENTS.BOOKMARKS_DB_SYNCED, handleDbSynced)

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
    managementStore.detachUnsavedChangesGuard()
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

// 📣 更新提示动作（简化为“同步 + 重新初始化页面”）
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

// 中间控制区操作
const handleCompare = () => {
  notificationService.notify('对比功能尚未实现', { level: 'info' })
}

const handleApply = async () => {
  try {
    await managementStore.applyStagedChanges()
    notificationService.notify('已应用更改', { level: 'success' })
  } catch (e) {
    console.error('handleApply failed:', e)
    notificationService.notify('应用失败', { level: 'error' })
  }
}

// =============================
// 批量数据生成 / 随机删除（真·书签）
// =============================
const TEST_FOLDER_NAME = 'AB Bulk Test'

async function findOtherBookmarksFolderId(): Promise<string | null> {
  try {
    const tree = await chrome.bookmarks.getTree()
    const root = tree?.[0]
    const candidates = (root?.children ||
      []) as chrome.bookmarks.BookmarkTreeNode[]
    // 常见本地化标题
    const titles = new Set([
      'Other bookmarks',
      'Other Bookmarks',
      '其他书签',
      '其它书签',
      'Other',
      '其他'
    ])
    // 优先按标题匹配
    const byTitle = candidates.find(
      n => !n.url && n.title && titles.has(n.title)
    )
    if (byTitle?.id) return byTitle.id
    // 次选：Chrome 常见 id 为 '2'
    const id2 = candidates.find(n => n.id === '2' && !n.url)?.id
    if (id2) return id2
    // 兜底：选择第一个可作为父级的根子节点
    return candidates.find(n => !n.url)?.id ?? null
  } catch (e) {
    console.warn('findOtherBookmarksFolderId failed:', e)
    return null
  }
}

// 在“其他书签”下确保唯一的测试根；如已存在多个，合并到一个并移除多余项
async function ensureTestRootFolder(
  retryAttempts = 1,
  retryDelayMs = 100
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const parentId = (await findOtherBookmarksFolderId()) || '1'

  // 1) 先在目标父级下查找同名文件夹，若有多个则做去重合并
  try {
    const [parent] = await chrome.bookmarks.getSubTree(parentId)
    const siblings = (parent?.children || []).filter(
      n => !n.url && n.title === TEST_FOLDER_NAME
    ) as chrome.bookmarks.BookmarkTreeNode[]
    if (siblings.length > 0) {
      // 存在一个或多个：若多个则将其子节点迁移到最早项并删除其余
      const keep = siblings
        .slice()
        .sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))[0]
      if (siblings.length > 1) {
        for (const dup of siblings) {
          if (dup.id === keep.id) continue
          // 获取最新 dup 子节点
          const [fresh] = await chrome.bookmarks.getSubTree(dup.id)
          const dupChildren = (fresh?.children ||
            []) as chrome.bookmarks.BookmarkTreeNode[]
          // 将 dup 的子节点迁移到 keep 下（顺序不强保证，避免额外复杂度）
          for (const c of dupChildren) {
            await withRetry(
              () => chrome.bookmarks.move(c.id, { parentId: keep.id }),
              retryAttempts,
              retryDelayMs
            )
          }
          // 删除重复的空文件夹
          try {
            await withRetry(
              () => chrome.bookmarks.removeTree(dup.id),
              retryAttempts,
              retryDelayMs
            )
          } catch {
            // 忽略删除失败（可能有并发写入）
          }
        }
      }
      return keep
    }
  } catch {
    // 忽略父级读取异常，继续全局兜底
  }

  // 2) 全局查找是否已有同名测试根（可能在其他父级下）
  try {
    const found = await chrome.bookmarks.search({ title: TEST_FOLDER_NAME })
    const folder = found.find(n => !n.url && n.title === TEST_FOLDER_NAME)
    if (folder) {
      // 若不在目标父级下，尝试迁移到目标父级，保证“唯一路径”
      if ((folder as chrome.bookmarks.BookmarkTreeNode).parentId !== parentId) {
        try {
          await withRetry(
            () =>
              chrome.bookmarks.move(
                (folder as chrome.bookmarks.BookmarkTreeNode).id,
                {
                  parentId
                }
              ),
            retryAttempts,
            retryDelayMs
          )
        } catch {
          // 移动失败则直接返回原位置的对象，避免阻塞后续逻辑
        }
      }
      return folder as chrome.bookmarks.BookmarkTreeNode
    }
  } catch {
    // 忽略全局搜索异常，继续创建
  }

  // 3) 均不存在则创建一个
  const created = await chrome.bookmarks.create({
    parentId,
    title: TEST_FOLDER_NAME
  })
  return created
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeRandomUrl(i: number): string {
  const bases = [
    'https://example.com',
    'https://www.wikipedia.org',
    'https://github.com',
    'https://developer.mozilla.org',
    'https://news.ycombinator.com',
    'https://medium.com',
    'https://stackoverflow.com',
    'https://www.reddit.com',
    'https://www.nytimes.com',
    'https://www.bbc.com'
  ]
  const segs = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf']
  const sCount = 1 + Math.floor(Math.random() * 3)
  const path = Array.from({ length: sCount }, () => randomFrom(segs)).join('/')
  const qp = new URLSearchParams({
    src: 'ab',
    k: String(i),
    t: String(Date.now() % 1_000_000)
  }).toString()
  return `${randomFrom(bases)}/${path}?${qp}`
}

function makeRandomTitle(i: number): string {
  const words = [
    'Alpha',
    'Bravo',
    'Charlie',
    'Delta',
    'Echo',
    'Foxtrot',
    'Golf',
    'Hotel',
    'India',
    'Juliet',
    'Kilo',
    'Lima',
    'Mike'
  ]
  return `Sample ${i} · ${randomFrom(words)}`
}

// legacy generateTenThousand removed; use generateBulk via dialog

async function collectBookmarksUnder(
  id: string
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const nodes = await chrome.bookmarks.getSubTree(id)
  const out: chrome.bookmarks.BookmarkTreeNode[] = []
  const walk = (n: chrome.bookmarks.BookmarkTreeNode) => {
    if (n.url) out.push(n)
    if (n.children) for (const c of n.children) walk(c)
  }
  if (nodes?.[0]) walk(nodes[0])
  return out
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 带重试的创建/删除封装
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i === attempts) break
      const delay = baseDelayMs * Math.pow(2, i)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

async function generateBulk(opts?: {
  total?: number
  folders?: number
  perFolder?: number
  yieldEvery?: number
  pauseMsPerFolder?: number
  retryAttempts?: number
  retryDelayMs?: number
}) {
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.create) {
    notificationService.notify('当前环境不支持书签 API', { level: 'error' })
    return
  }
  const total = Math.max(1, Math.floor(opts?.total ?? genTotal.value))
  const folders = Math.max(1, Math.floor(opts?.folders ?? genFolders.value))
  const perFolderDefault = Math.ceil(total / folders)
  const perFolder = Math.max(
    1,
    Math.floor(opts?.perFolder ?? genPerFolder.value ?? perFolderDefault)
  )
  const yieldEvery = Math.max(
    1,
    Math.floor(opts?.yieldEvery ?? genYieldEvery.value)
  )
  const pauseMsPerFolder = Math.max(
    0,
    Math.floor(opts?.pauseMsPerFolder ?? genPauseMsPerFolder.value)
  )
  const retryAttempts = Math.max(
    0,
    Math.floor(opts?.retryAttempts ?? genRetryAttempts.value)
  )
  const retryDelayMs = Math.max(
    0,
    Math.floor(opts?.retryDelayMs ?? genRetryDelayMs.value)
  )

  try {
    isBulkMutating.value = true
    isPageLoading.value = true
    loadingMessage.value = '准备创建测试数据…'

    const t0 = performance.now()
    const root = await ensureTestRootFolder(retryAttempts, retryDelayMs)
    let createdCount = 0
    const batchLabel = new Date().toISOString().slice(11, 19)

    // 让“总条数”成为硬目标：即使 folders * perFolder 不足，也会继续创建新的文件夹直到达到 total
    for (let fi = 0; createdCount < total; fi++) {
      loadingMessage.value = `正在创建文件夹 ${fi + 1}/${folders}… 已生成 ${createdCount}/${total}`
      const folder = await withRetry(
        () =>
          chrome.bookmarks.create({
            parentId: root.id,
            title: `AB Batch ${batchLabel} - ${fi + 1}`
          }),
        retryAttempts,
        retryDelayMs
      )

      // 本文件夹内的目标数量：不超过配置的每文件夹上限，但不少于完成总目标所需的剩余数量
      const toCreateHere = Math.min(perFolder, total - createdCount)
      for (let j = 0; j < toCreateHere && createdCount < total; j++) {
        const idx = fi * perFolder + j + 1
        await withRetry(
          () =>
            chrome.bookmarks.create({
              parentId: folder.id,
              title: makeRandomTitle(idx),
              url: makeRandomUrl(idx)
            }),
          retryAttempts,
          retryDelayMs
        )
        createdCount++
        if (createdCount % yieldEvery === 0) {
          loadingMessage.value = `正在创建… ${createdCount}/${total}`
          await new Promise(r => setTimeout(r, 0))
        }
      }
      if (pauseMsPerFolder > 0) {
        await new Promise(r => setTimeout(r, pauseMsPerFolder))
      }
    }

    const t1 = performance.now()
    const secs = Math.max(0.001, (t1 - t0) / 1000)
    const rate = (createdCount / secs).toFixed(1)

    // 触发 Service Worker 从 Chrome 同步到 IndexedDB，再刷新本地视图
    loadingMessage.value = '正在同步到 IndexedDB…'
    try {
      await new Promise<void>(resolve => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage)
          return resolve()
        chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' }, resp => {
          if (chrome?.runtime?.lastError) {
            console.warn(
              'Management',
              'SYNC_BOOKMARKS lastError:',
              chrome.runtime.lastError?.message
            )
            return resolve()
          }
          if (!resp || resp.ok !== true) {
            console.warn(
              'Management',
              'SYNC_BOOKMARKS unexpected response:',
              resp
            )
          }
          resolve()
        })
      })
    } catch {}

    // 简短轮询，等待 IDB 数据量有变更（避免同步滞后导致读到旧数据）
    try {
      await indexedDBManager.initialize()
      const beforeAll = await indexedDBManager.getAllBookmarks()
      const beforeCount = Array.isArray(beforeAll) ? beforeAll.length : 0
      const maxWaitMs = 8000
      const stepMs = 300
      let waited = 0
      while (waited < maxWaitMs) {
        const cur = await indexedDBManager.getAllBookmarks()
        const curCount = Array.isArray(cur) ? cur.length : 0
        if (
          curCount >=
          beforeCount + createdCount * 0.8 /* 估算，含文件夹增量 */
        )
          break
        await new Promise(r => setTimeout(r, stepMs))
        waited += stepMs
      }
    } catch {}

    loadingMessage.value = '正在刷新本地数据…'
    await initializeStore()
    try {
      await searchWorkerAdapter.initFromIDB()
    } catch {}

    notificationService.notify(
      `已创建 ${createdCount} 条（含分组）· 用时 ${secs.toFixed(2)}s · ${rate} ops/s`,
      { level: 'success' }
    )
  } catch (e) {
    console.error('generateBulk error:', e)
    notificationService.notify('生成失败', { level: 'error' })
  } finally {
    isPageLoading.value = false
    isBulkMutating.value = false
  }
}

async function cleanEmptyFoldersUnder(
  rootId: string,
  retryAttempts = 1,
  retryDelayMs = 100
): Promise<number> {
  const [root] = await chrome.bookmarks.getSubTree(rootId)
  if (!root) return 0
  type Node = chrome.bookmarks.BookmarkTreeNode & { __depth?: number }
  const folders: Node[] = []
  const walk = (n: Node, depth: number) => {
    if (!n.url) folders.push({ ...n, __depth: depth })
    if (n.children) for (const c of n.children as Node[]) walk(c, depth + 1)
  }
  walk(root as Node, 0)
  // 深度从大到小（先删叶子）且跳过根本身
  folders.sort((a, b) => (b.__depth ?? 0) - (a.__depth ?? 0))
  let removed = 0
  for (const f of folders) {
    if (!f || f.id === rootId) continue
    // 获取最新节点信息判断是否空
    const [fresh] = await chrome.bookmarks.getSubTree(f.id)
    const hasChildren = !!(fresh?.children && fresh.children.length > 0)
    if (!fresh?.url && !hasChildren) {
      try {
        await withRetry(
          () => chrome.bookmarks.removeTree(f.id),
          retryAttempts,
          retryDelayMs
        )
        removed++
      } catch {
        // 忽略删除失败（可能被并发写入）
      }
    }
  }
  return removed
}

async function deleteBulk(opts?: {
  target?: number
  chunkSize?: number
  retryAttempts?: number
  retryDelayMs?: number
  cleanEmptyFolders?: boolean
}) {
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.remove) {
    notificationService.notify('当前环境不支持书签 API', { level: 'error' })
    return
  }
  const targetCount = Math.max(1, Math.floor(opts?.target ?? delTarget.value))
  const chunkSz = Math.max(1, Math.floor(opts?.chunkSize ?? delChunkSize.value))
  const retryAttempts = Math.max(
    0,
    Math.floor(opts?.retryAttempts ?? delRetryAttempts.value)
  )
  const retryDelayMs = Math.max(
    0,
    Math.floor(opts?.retryDelayMs ?? delRetryDelayMs.value)
  )
  const cleanEmpty = !!(opts?.cleanEmptyFolders ?? delCleanEmptyFolders.value)

  try {
    isBulkMutating.value = true
    isPageLoading.value = true
    loadingMessage.value = '准备删除测试数据…'

    const t0 = performance.now()
    // 找到测试根（可能存在多个同名，全部纳入）
    const found = await chrome.bookmarks.search({ title: TEST_FOLDER_NAME })
    const roots = found.filter(n => !n.url && n.title === TEST_FOLDER_NAME)
    if (!roots.length) {
      notificationService.notify('未找到测试数据文件夹，无需删除', {
        level: 'info'
      })
      return
    }

    // 收集所有书签
    let all: chrome.bookmarks.BookmarkTreeNode[] = []
    for (const r of roots) {
      const list = await collectBookmarksUnder(r.id)
      all = all.concat(list)
    }
    if (all.length === 0) {
      notificationService.notify('测试数据文件夹中没有可删除的书签', {
        level: 'info'
      })
      return
    }
    shuffleInPlace(all)
    const target = all.slice(0, Math.min(targetCount, all.length))

    let removed = 0
    for (let i = 0; i < target.length; i += chunkSz) {
      const chunk = target.slice(i, i + chunkSz)
      await Promise.all(
        chunk.map(n =>
          withRetry(
            () => chrome.bookmarks.remove(n.id),
            retryAttempts,
            retryDelayMs
          )
            .then(() => (removed += 1))
            .catch(() => void 0)
        )
      )
      loadingMessage.value = `正在删除… ${Math.min(i + chunkSz, target.length)}/${target.length}`
      await new Promise(r => setTimeout(r, 0))
    }

    let pruned = 0
    if (cleanEmpty) {
      loadingMessage.value = '正在清理空文件夹…'
      for (const r of roots) {
        pruned += await cleanEmptyFoldersUnder(
          r.id,
          retryAttempts,
          retryDelayMs
        )
      }
    }

    const t1 = performance.now()
    const secs = Math.max(0.001, (t1 - t0) / 1000)
    const rate = (removed / secs).toFixed(1)

    loadingMessage.value = '正在刷新本地数据…'
    await indexedDBManager.initialize()
    await initializeStore()
    try {
      await searchWorkerAdapter.initFromIDB()
    } catch {}

    const suffix = cleanEmpty ? ` · 清理空文件夹 ${pruned}` : ''
    notificationService.notify(
      `已删除 ${removed} 条书签 · 用时 ${secs.toFixed(2)}s · ${rate} ops/s${suffix}`,
      { level: 'success' }
    )
  } catch (e) {
    console.error('deleteBulk error:', e)
    notificationService.notify('删除失败', { level: 'error' })
  } finally {
    isPageLoading.value = false
    isBulkMutating.value = false
  }
}

// 对话框确认事件
const confirmGenerate = async () => {
  isGenerateDialogOpen.value = false
  await generateBulk({
    total: genTotal.value,
    folders: genFolders.value,
    perFolder: genPerFolder.value,
    yieldEvery: genYieldEvery.value,
    pauseMsPerFolder: genPauseMsPerFolder.value,
    retryAttempts: genRetryAttempts.value,
    retryDelayMs: genRetryDelayMs.value
  })
}

const confirmDeleteBulk = async () => {
  isDeleteDialogOpen.value = false
  await deleteBulk({
    target: delTarget.value,
    chunkSize: delChunkSize.value,
    retryAttempts: delRetryAttempts.value,
    retryDelayMs: delRetryDelayMs.value,
    cleanEmptyFolders: delCleanEmptyFolders.value
  })
}
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
/* 选择统计：避免数字变化导致文本整体“抖动” */
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
  color: #fff;
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
  gap: var(--spacing-sm);
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
</style>
