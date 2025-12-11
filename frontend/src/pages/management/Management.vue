<template>
  <App class="app-container">
    <Overlay :show="isPageLoading" persistent :opacity="0.12" :blur="true">
      <div class="overlay-loading">
        <Spinner color="primary" size="xl" class="loading-spinner" />
        <div class="loading-text" data-testid="progress-text">
          {{ loadingMessage }}
        </div>
      </div>
    </Overlay>

    <!-- 📊 全局书签同步进度对话框 -->
    <GlobalSyncProgress />

    <!-- ⚡ 全局快速添加书签对话框 -->
    <GlobalQuickAddBookmark />

    <!-- 🔍 健康扫描进度对话框 -->
    <Dialog
      :show="showHealthScanProgress"
      title="健康度扫描"
      persistent
      max-width="500px"
    >
      <div class="health-scan-progress">
        <div class="progress-info">
          <div class="progress-message">{{ healthScanProgress.message }}</div>
          <div class="progress-stats">
            {{ healthScanProgress.current }} / {{ healthScanProgress.total }}
          </div>
        </div>
        <ProgressBar
          :value="healthScanProgress.percentage"
          :show-label="true"
          color="primary"
          :height="8"
        />
      </div>
    </Dialog>

    <!-- 🤖 AI 整理进度对话框 -->
    <Dialog
      :show="showOrganizeProgress"
      title="AI 整理书签"
      persistent
      max-width="500px"
    >
      <div class="health-scan-progress">
        <div class="progress-info">
          <div class="progress-message">{{ organizeProgress.message }}</div>
          <div class="progress-stats">
            {{ organizeProgress.current }} / {{ organizeProgress.total }}
          </div>
        </div>
        <ProgressBar
          :value="
            organizeProgress.total > 0
              ? (organizeProgress.current / organizeProgress.total) * 100
              : 0
          "
          :show-label="true"
          color="primary"
          :height="8"
        />
      </div>
    </Dialog>

    <!-- 📝 应用更改确认对话框 -->
    <Dialog
      :show="showApplyConfirmDialog"
      :title="applyConfirmTitle"
      :icon="applyConfirmIcon"
      persistent
      :enter-to-confirm="true"
      max-width="600px"
      @update:show="showApplyConfirmDialog = $event"
      @confirm="confirmApplyChanges"
    >
      <div class="apply-confirm-dialog">
        <!-- AI 生成标记 -->
        <div v-if="bookmarkManagementStore.isAIGenerated" class="ai-badge">
          <Icon name="icon-sparkles" color="primary" />
          <span>此提案由 AI 生成</span>
        </div>

        <!-- 统计信息 -->
        <div class="statistics-section">
          <h3 class="section-title">📊 变更概览</h3>
          <div class="statistics-grid">
            <div class="stat-item">
              <span class="stat-label">新增文件夹</span>
              <span class="stat-value">{{
                diffResult?.statistics.newFolders || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">新增书签</span>
              <span class="stat-value">{{
                diffResult?.statistics.newBookmarks || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">移动</span>
              <span class="stat-value">{{
                diffResult?.statistics.move || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">编辑</span>
              <span class="stat-value">{{
                diffResult?.statistics.edit || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">删除</span>
              <span class="stat-value error">{{
                diffResult?.statistics.delete || 0
              }}</span>
            </div>
            <div class="stat-item total">
              <span class="stat-label">总计</span>
              <span class="stat-value">{{
                diffResult?.statistics.total || 0
              }}</span>
            </div>
          </div>
        </div>

        <!-- 详细列表（仅在操作数 < 100 时显示完整列表，100-500 显示汇总，>500 只显示统计） -->
        <div v-if="diffResult" class="details-section">
          <div v-if="diffResult.statistics.total < 100" class="detailed-list">
            <h3 class="section-title">详细操作列表</h3>
            <div class="operations-list">
              <div
                v-for="(op, index) in diffResult.operations.slice(0, 100)"
                :key="index"
                class="operation-item"
              >
                <Icon
                  :name="getOperationIcon(op.type)"
                  :color="getOperationColor(op.type)"
                />
                <span class="operation-type">{{
                  getOperationTypeText(op.type)
                }}</span>
                <span class="operation-title">{{ op.title }}</span>
              </div>
            </div>
          </div>
          <div
            v-else-if="diffResult.statistics.total < 500"
            class="grouped-summary"
          >
            <h3 class="section-title">分组汇总</h3>
            <details
              v-if="diffResult.statistics.create > 0"
              class="summary-group"
              open
            >
              <summary>
                <Icon name="icon-add" color="success" />
                <span>新增 {{ diffResult.statistics.create }} 个节点</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('create').slice(
                    0,
                    50
                  )"
                  :key="index"
                  class="group-item"
                >
                  {{ op.isFolder ? '📁' : '📄' }} {{ op.title }}
                </div>
                <div
                  v-if="getOperationsByType('create').length > 50"
                  class="more-items"
                >
                  还有 {{ getOperationsByType('create').length - 50 }} 项...
                </div>
              </div>
            </details>
            <details
              v-if="diffResult.statistics.move > 0"
              class="summary-group"
            >
              <summary>
                <Icon name="icon-swap" color="primary" />
                <span>移动 {{ diffResult.statistics.move }} 个节点</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('move').slice(
                    0,
                    50
                  )"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div
                  v-if="getOperationsByType('move').length > 50"
                  class="more-items"
                >
                  还有 {{ getOperationsByType('move').length - 50 }} 项...
                </div>
              </div>
            </details>
            <details
              v-if="diffResult.statistics.edit > 0"
              class="summary-group"
            >
              <summary>
                <Icon name="icon-edit" color="warning" />
                <span>编辑 {{ diffResult.statistics.edit }} 个节点</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('edit').slice(
                    0,
                    50
                  )"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div
                  v-if="getOperationsByType('edit').length > 50"
                  class="more-items"
                >
                  还有 {{ getOperationsByType('edit').length - 50 }} 项...
                </div>
              </div>
            </details>
            <details
              v-if="diffResult.statistics.delete > 0"
              class="summary-group"
            >
              <summary>
                <Icon name="icon-delete" color="error" />
                <span>删除 {{ diffResult.statistics.delete }} 个节点</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('delete').slice(
                    0,
                    50
                  )"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div
                  v-if="getOperationsByType('delete').length > 50"
                  class="more-items"
                >
                  还有 {{ getOperationsByType('delete').length - 50 }} 项...
                </div>
              </div>
            </details>
          </div>
          <div v-else class="large-operation-warning">
            <Icon name="icon-warning" color="warning" size="48" />
            <h3>大规模更改</h3>
            <p>
              此操作将影响
              <strong>{{ diffResult.statistics.total }}</strong> 个书签节点。
            </p>
            <p class="warning-text">⚠️ 此操作无法撤销，请确认后再继续。</p>
          </div>
        </div>
      </div>

      <template #actions>
        <Button variant="text" @click="showApplyConfirmDialog = false">
          取消
        </Button>
        <Button color="primary" @click="confirmApplyChanges">
          确认应用
        </Button>
      </template>
    </Dialog>

    <!-- 📈 应用更改进度对话框 -->
    <Dialog
      :show="bookmarkManagementStore.applyProgress.isApplying"
      title="正在应用更改"
      persistent
      :close-on-overlay="false"
      :esc-to-close="false"
      max-width="500px"
    >
      <div class="apply-progress">
        <div class="progress-info">
          <div class="progress-message">
            {{ bookmarkManagementStore.applyProgress.currentOperation }}
          </div>
          <div class="progress-stats">
            {{ bookmarkManagementStore.applyProgress.currentIndex }} /
            {{ bookmarkManagementStore.applyProgress.totalOperations }}
          </div>
        </div>
        <ProgressBar
          :value="bookmarkManagementStore.applyProgress.percentage"
          :show-label="true"
          color="primary"
          :height="8"
        />
        <div class="progress-tip">
          ⏱️ 预计剩余时间：{{ estimatedRemainingTime }}
        </div>
      </div>
    </Dialog>

    <AppHeader :show-side-panel-toggle="false" />

    <Main padding class="main-content">
      <Grid is="container" fluid class="fill-height management-container">
        <Grid is="row" class="fill-height" align="stretch">
          <!-- Left Panel -->
          <Grid is="col" :cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <Icon name="icon-folder" color="primary" />
                    <span class="panel-title">我的书签</span>
                  </div>
                  <div class="panel-title-section">
                    <BookmarkSearchInput
                      mode="memory"
                      :data="originalTree"
                      :debounce="300"
                      @search-complete="handleLeftSearch"
                      @search-clear="handleLeftSearchClear"
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
                <BookmarkTree
                  ref="leftTreeRef"
                  :nodes="leftTreeData"
                  source="management"
                  height="100%"
                  size="comfortable"
                  :loading="isPageLoading"
                  :editable="false"
                  :show-toolbar="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(originalExpandedFolders)"
                  :virtual="true"
                  :selectable="false"
                  :show-favorite-button="true"
                  @ready="handleLeftTreeReady"
                  @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
                />
              </div>
            </Card>
          </Grid>

          <!-- Middle Divider -->
          <Grid is="col" :cols="1" class="panel-col divider-col">
            <div class="panel-divider">
              <Icon name="icon-arrow-right-double" :size="24" color="muted" />
            </div>
          </Grid>

          <!-- Right Panel -->
          <Grid is="col" :cols="6" class="panel-col">
            <Card
              class="panel-card right-panel-card"
              elevation="medium"
              :footer-visible="true"
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
                    <div class="panel-actions">
                      <!-- ✅ 使用包装元素解决禁用状态下 tooltip 不显示的问题 -->
                      <span class="btn-wrapper" :title="applyButtonTooltip">
                        <Button
                          variant="primary"
                          size="sm"
                          :disabled="
                            isCleanupLoading ||
                            isPageLoading ||
                            !bookmarkManagementStore.hasUnsavedChanges
                          "
                          @click="handleApply"
                        >
                          <Icon name="icon-approval" />
                          <span>应用</span>
                        </Button>
                      </span>
                      <div class="panel-actions-divider"></div>
                      <Button
                        variant="primary"
                        size="sm"
                        :disabled="
                          isPageLoading || isOrganizing || isCleanupLoading
                        "
                        title="一键整理书签栏，使用 AI 自动分类书签"
                        @click="handleAIOrganize"
                      >
                        <Icon name="icon-sparkles" :spin="isOrganizing" />
                        <span>{{
                          isOrganizing ? '整理中...' : '一键整理'
                        }}</span>
                      </Button>
                      <div class="panel-actions-divider"></div>
                      <BookmarkSearchInput
                        mode="memory"
                        :data="newProposalTree.children"
                        :debounce="300"
                        :enable-health-filters="true"
                        :sync-with-store="true"
                        @search-complete="handleRightSearch"
                        @search-clear="handleRightSearchClear"
                      />
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
                </div>
              </template>

              <div class="panel-content">
                <div v-if="cleanupState" class="cleanup-summary"></div>
                <BookmarkTree
                  ref="rightTreeRef"
                  :nodes="rightTreeData"
                  :selected-desc-counts="rightTreeSelectedDescCounts"
                  :deleting-node-ids="deletingNodeIds"
                  height="100%"
                  size="comfortable"
                  :loading="isCleanupLoading"
                  :editable="true"
                  :show-toolbar="true"
                  :draggable="true"
                  selectable="multiple"
                  :show-selection-checkbox="true"
                  :toolbar-expand-collapse="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  :virtual="true"
                  :show-favorite-button="false"
                  :show-edit-button="true"
                  :show-delete-button="true"
                  :show-add-button="true"
                  :show-open-new-tab-button="true"
                  :show-copy-url-button="true"
                  @desc-counts-updated="rightTreeSelectedDescCounts = $event"
                  @request-clear-filters="cleanupStore.clearFilters()"
                  @node-edit="handleRightNodeEdit"
                  @node-delete="handleRightNodeDelete"
                  @folder-add="handleRightFolderAdd"
                  @selection-change="onRightSelectionChange"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @bookmark-move="handleBookmarkMove"
                />
              </div>
              <template #footer>
                <!-- 右侧面板内底部批量操作条（始终显示） -->
                <div class="bulk-delete-in-panel">
                  <div class="selection-summary">
                    <Checkbox
                      :model-value="rightSelectAllState.checked"
                      :indeterminate="rightSelectAllState.indeterminate"
                      size="md"
                      class="select-all-checkbox"
                      @update:model-value="toggleRightSelectAll"
                    />
                    <!-- ✅ 全选时文案变化 -->
                    <span class="text">{{
                      rightSelectAllState.checked &&
                      !rightSelectAllState.indeterminate
                        ? '已全选'
                        : '已选择'
                    }}</span>
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
                    <!-- ✅ 清除选择按钮包装器 -->
                    <span class="btn-wrapper" :title="clearSelectionTooltip">
                      <Button
                        variant="text"
                        size="sm"
                        class="clear-selection"
                        :disabled="rightSelectedIds.length === 0"
                        @click="clearRightSelection"
                      >
                        清除选择 ({{ rightSelectedIds.length }})
                      </Button>
                    </span>
                    <!-- ✅ 删除按钮包装器 -->
                    <span class="btn-wrapper" :title="deleteButtonTooltip">
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
                    </span>
                  </div>
                </div>
              </template>
            </Card>
          </Grid>
        </Grid>
      </Grid>
    </Main>

    <!-- Edit Bookmark Dialog -->
    <ConfirmableDialog
      :show="dialogStore.editBookmarkDialog.isOpen"
      title="编辑书签"
      icon="icon-edit-bookmark"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
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
        <Button variant="text" @click="requestClose(false)">
          取消
        </Button>
        <Button
          color="primary"
          :disabled="!isEditDirty"
          :loading="isEditingBookmark"
          @click="confirmEditBookmark"
        >
          更新
        </Button>
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
        <Button variant="text" @click="requestClose(false)">
          取消
        </Button>
        <Button
          color="error"
          :loading="isBulkDeleting"
          @click="confirmBulkDeleteSelected"
        >
          确认删除
        </Button>
      </template>
    </ConfirmableDialog>

    <!-- Edit Folder Dialog -->
    <ConfirmableDialog
      :show="dialogStore.editFolderDialog.isOpen"
      title="编辑文件夹"
      icon="icon-folder-edit"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
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
        <Button variant="text" @click="requestClose(false)">
          取消
        </Button>
        <Button
          color="primary"
          :disabled="!isEditFolderDirty"
          :loading="isEditingFolder"
          @click="confirmEditFolder"
        >
          更新
        </Button>
      </template>
    </ConfirmableDialog>

    <!-- Delete Folder Confirm Dialog (统一为 ConfirmableDialog) -->
    <ConfirmableDialog
      :show="isConfirmDeleteDialogOpen"
      :esc-to-close="true"
      :enter-to-confirm="true"
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
        <Button variant="text" @click="requestClose(false)">
          取消
        </Button>
        <Button
          color="error"
          :loading="isDeletingFolder"
          @click="confirmDeleteFolder"
        >
          确认删除
        </Button>
      </template>
    </ConfirmableDialog>

    <!-- Add New Item Dialog -->
    <ConfirmableDialog
      :show="dialogStore.addItemDialog.isOpen"
      :title="addDialogTitle"
      :icon="addDialogIcon"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
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
          animated
        >
          <template #default="{ activeTab }">
            <!-- 书签表单 -->
            <div
              v-if="activeTab === 'bookmark'"
              class="form-fields"
            >
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
                v-model="dialogStore.addItemDialog.url"
                label="链接地址"
                variant="outlined"
                density="compact"
                class="form-field"
                :error="!!addFormErrors.url"
                :error-message="addFormErrors.url"
              />
            </div>
            <!-- 文件夹表单 -->
            <div
              v-else
              class="form-fields"
            >
              <Input
                v-model="dialogStore.addItemDialog.title"
                label="文件夹名称"
                variant="outlined"
                class="form-field"
                autofocus
                :error="!!addFormErrors.title"
                :error-message="addFormErrors.title"
              />
            </div>
          </template>
        </Tabs>
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">
          取消
        </Button>
        <Button
          color="primary"
          :loading="isAddingItem"
          @click="confirmAddNewItem"
        >
          {{ addConfirmText }}
        </Button>
      </template>
    </ConfirmableDialog>
  </App>
</template>

<script setup lang="ts">
import { schedulerService } from '@/application/scheduler/scheduler-service'
import { useNotification } from '@/composables/useNotification'
import { useThemeSync } from '@/composables/useThemeSync'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'

defineOptions({
  name: 'ManagementPage'
})

// 启用主题同步
useThemeSync('Management')
import { storeToRefs } from 'pinia'
// useManagementStore 已迁移到新的专业化 Store
import {
  useDialogStore,
  useBookmarkManagementStore,
  useCleanupStore
} from '@/stores'
import type { HealthTag } from '@/stores/cleanup/cleanup-store'
import type { HealthScanProgress } from '@/services/health-scan-worker-service'
import {
  App,
  AppHeader,
  BookmarkSearchInput,
  Button,
  Card,
  Dialog,
  Grid,
  Icon,
  Input,
  Main,
  Overlay,
  ProgressBar,
  Spinner,
  Tabs,
  UrlInput,
  Checkbox,
  AnimatedNumber
} from '@/components'
import { notificationService } from '@/application/notification/notification-service'
import { ConfirmableDialog } from '@/components'
import { onEvent } from '@/infrastructure/events/event-bus'
import BookmarkTree from '@/components/composite/BookmarkTree/BookmarkTree.vue'
// 导入现代书签服务：以 side-effect 方式初始化并设置事件监听与消息桥接
import '@/services/modern-bookmark-service'
import { DataValidator } from '@/core/common/store-error'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
import { checkOnPageLoad } from '@/services/data-health-client'
import GlobalSyncProgress from '@/components/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/GlobalQuickAddBookmark.vue'
import type {
  DiffResult,
  BookmarkOperation,
  BookmarkOperationType
} from '@/application/bookmark/bookmark-diff-service'
import { aiAppService } from '@/application/ai/ai-app-service'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { treeAppService } from '@/application/bookmark/tree-app-service'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { enableEnvSnapshotBridge } from '@/devtools/env-snapshot'
import { createBookmarkIndex } from '@/services/bookmark-index-service'

const dialogStore = useDialogStore()
const bookmarkManagementStore = useBookmarkManagementStore()
const cleanupStore = useCleanupStore()

const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(
  bookmarkManagementStore
)

const { cleanupState } = storeToRefs(cleanupStore)

// 健康扫描进度状态
const healthScanProgress = ref({
  current: 0,
  total: 0,
  percentage: 0,
  message: '准备扫描...'
})
const showHealthScanProgress = ref(false)

// 应用更改相关状态
const showApplyConfirmDialog = ref(false)
const diffResult = ref<DiffResult | null>(null)
const applyStartTime = ref(0)

// AI 整理相关状态
const isOrganizing = ref(false)
const organizeProgress = ref({
  current: 0,
  total: 0,
  message: '准备整理...'
})
const showOrganizeProgress = ref(false)

let envSnapshotCleanup: (() => void) | null = null
const shouldExposeEnvSnapshot =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('abDevtools') === '1')

if (shouldExposeEnvSnapshot) {
  onMounted(() => {
    envSnapshotCleanup = enableEnvSnapshotBridge()
  })
  onUnmounted(() => {
    envSnapshotCleanup?.()
    envSnapshotCleanup = null
  })
}

/**
 * 动态生成"应用"按钮的 tooltip 提示文字
 * 让用户明确了解按钮为何被禁用
 */
const applyButtonTooltip = computed(() => {
  // 1. 页面加载中
  if (isPageLoading.value) {
    return '⏳ 页面加载中，请稍候...'
  }

  // 2. 清理面板正在处理
  if (isCleanupLoading.value) {
    return '⏳ 正在处理中，请稍候...'
  }

  // 3. 没有未保存的更改
  if (!bookmarkManagementStore.hasUnsavedChanges) {
    return '💡 提示：没有可应用的更改\n\n当前整理建议与原始书签完全一致。\n请先拖拽、编辑或删除书签来创建改动。'
  }

  // 4. 正常可用状态
  return '✅ 应用整理建议到我的书签\n\n点击后将显示详细的改动清单供您确认'
})

/**
 * 动态生成"清除选择"按钮的 tooltip
 */
const clearSelectionTooltip = computed(() => {
  if (rightSelectedIds.value.length === 0) {
    return '💡 提示：当前没有选中任何书签\n\n请先勾选需要操作的书签或文件夹'
  }
  return '清除所有选中状态'
})

/**
 * 动态生成"删除"按钮的 tooltip
 */
const deleteButtonTooltip = computed(() => {
  if (
    selectedCounts.value.bookmarks === 0 &&
    selectedCounts.value.folders === 0
  ) {
    return '💡 提示：当前没有选中任何书签\n\n请先勾选需要删除的书签或文件夹'
  }
  const parts = []
  if (selectedCounts.value.bookmarks > 0) {
    parts.push(`${selectedCounts.value.bookmarks} 条书签`)
  }
  if (selectedCounts.value.folders > 0) {
    parts.push(`${selectedCounts.value.folders} 个文件夹`)
  }
  return `删除选中的 ${parts.join('和')}`
})

/**
 * 清理面板专用的加载状态
 * 与全局 isPageLoading 区分，避免左侧树等无关区域被蒙层阻塞
 */
const isCleanupLoading = computed(() => cleanupState.value?.isScanning ?? false)

/**
 * 自动更新健康标签
 * 使用 Worker 在后台扫描，避免阻塞主线程
 */
const autoRefreshHealthTags = async () => {
  if (isCleanupLoading.value) return

  try {
    // 显示进度对话框
    showHealthScanProgress.value = true
    healthScanProgress.value = {
      current: 0,
      total: 0,
      percentage: 0,
      message: '准备扫描...'
    }

    // 使用 Worker 扫描（不阻塞主线程）
    await cleanupStore.startHealthScanWorker({
      onProgress: (progress: HealthScanProgress) => {
        healthScanProgress.value = progress
      }
    })

    logger.info('Management', '健康度扫描完成')
  } catch (error) {
    logger.error('Management', '自动刷新健康标签失败', error)
  } finally {
    showHealthScanProgress.value = false
  }
}

const isAddingItem = ref(false)
const isEditingBookmark = ref(false)
const isEditingFolder = ref(false)
const isDeletingFolder = ref(false)
const isBulkDeleting = ref(false)

const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
  storeToRefs(bookmarkManagementStore)

const rightTreeSelectedDescCounts = ref(new Map<string, number>())

const rightTreeIndex = createBookmarkIndex()

const {
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor,
  initialize: initializeStore,
  deleteFolder,
  bulkDeleteByIds,
  setProposalTree
} = bookmarkManagementStore

const leftSearchResults = ref<BookmarkNode[]>([])
const isLeftSearchActive = ref(false)

const rightSearchResults = ref<BookmarkNode[]>([])
const isRightSearchActive = ref(false)
const handleLeftSearch = async (results: BookmarkNode[]) => {
  leftSearchResults.value = results
  isLeftSearchActive.value = true

  if (results.length > 0) {
    await nextTick()
    leftTreeRef.value?.expandAll?.()
    leftExpandAll.value = true
  } else {
    leftTreeRef.value?.collapseAll?.()
    leftExpandAll.value = false
  }
}

const handleLeftSearchClear = () => {
  isLeftSearchActive.value = false
  leftSearchResults.value = []
  leftTreeRef.value?.collapseAll?.()
  leftExpandAll.value = false
}

const handleRightSearch = async (results: BookmarkNode[]) => {
  rightSearchResults.value = results
  isRightSearchActive.value = true

  if (results.length > 0) {
    await nextTick()
    rightTreeRef.value?.expandAll?.()
    rightExpandAll.value = true
  } else {
    rightTreeRef.value?.collapseAll?.()
    rightExpandAll.value = false
  }
}

const handleRightSearchClear = () => {
  isRightSearchActive.value = false
  rightSearchResults.value = []
  rightTreeRef.value?.collapseAll?.()
  rightExpandAll.value = false
}

const leftTreeData = computed(() =>
  isLeftSearchActive.value ? leftSearchResults.value : originalTree.value
)

const rightTreeData = computed(() =>
  isRightSearchActive.value
    ? rightSearchResults.value
    : newProposalTree.value.children || []
)

const MSG_CANCEL_EDIT = '您有更改尚未保存，确定取消并丢弃更改吗？'
const MSG_CANCEL_ADD = '您有更改尚未添加，确定取消并丢弃输入吗？'
const addDialogTitle = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark' ? '添加新书签' : '添加新文件夹'
)
const addDialogIcon = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark'
    ? 'icon-bookmark'
    : 'icon-folder'
)
const addConfirmText = computed(() => '添加')

const addDialogContentRef = ref<HTMLElement | null>(null)
const addDialogMinHeight = ref<string | undefined>(undefined)

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
      addDialogMinHeight.value = undefined
    }
  }
)

const pendingTagSelection = ref<HealthTag[] | null>(null)

const leftTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightSelectedIds = ref<string[]>([])
const isConfirmBulkDeleteDialogOpen = ref(false)

watch(
  () => rightTreeData.value,
  (newData) => {
    if (Array.isArray(newData) && newData.length > 0) {
      rightTreeIndex.buildFromTree(newData)
      logger.info('Management', `右侧树索引已更新: ${rightTreeIndex.getSize()} 个节点`)
    }
  },
  { immediate: true, deep: false }
)

const selectedCounts = computed(() => {
  const bookmarkIds = new Set<string>()
  const selectedFolderIds = new Set<string>()

  for (const rawId of rightSelectedIds.value) {
    const id = String(rawId)
    const node = rightTreeIndex.getNode(id)
    if (!node) continue

    if (node.url) {
      bookmarkIds.add(id)
    } else {
      selectedFolderIds.add(id)
      
      const stack: string[] = [id]
      while (stack.length > 0) {
        const currentId = stack.pop()!
        const current = rightTreeIndex.getNode(currentId)
        
        if (!current) continue
        
        if (current.url) {
          bookmarkIds.add(currentId)
        } else {
          const childrenIds = rightTreeIndex.getChildrenIds(currentId)
          stack.push(...Array.from(childrenIds))
        }
      }
    }
  }

  return { bookmarks: bookmarkIds.size, folders: selectedFolderIds.size }
})

watch(
  () => bookmarkManagementStore.hasUnsavedChanges,
  hasChanges => {
    if (hasChanges) {
      notificationService.updateBadge('!', '#faad14')
    } else {
      notificationService.clearBadge()
    }
  },
  { immediate: true }
)

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
const leftExpandAll = ref(false)
const rightExpandAll = ref(false)

watch(
  () => rightTreeData.value,
  () => {
    clearRightSelection()
  },
  { deep: true }
)

const isExpanding = ref(false)
const editFormErrors = ref<{ title: string; url: string }>({
  title: '',
  url: ''
})
const addFormErrors = ref<{ title: string; url: string }>({
  title: '',
  url: ''
})

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

const handleLeftTreeReady = () => {
  try {
    const hasData =
      Array.isArray(originalTree.value) && originalTree.value.length > 0
    if (isPageLoading.value && hasData) {
      isPageLoading.value = false
    }
  } catch (error) {
    logger.error('Management', '❌ handleLeftTreeReady 失败', error)
  }
}
const isAddDirty = computed(() => {
  const t = (dialogStore.addItemDialog.title || '').trim()
  const u = (dialogStore.addItemDialog.url || '').trim()
  if (dialogStore.addItemDialog.type === 'bookmark') {
    return !!t || !!u
  }
  return !!t
})
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

const isConfirmDeleteDialogOpen = ref(false)
const deleteTargetFolder = ref<BookmarkNode | null>(null)
const deleteFolderBookmarkCount = ref(0)

const deletingNodeIds = ref<Set<string>>(new Set())

/**
 * 右侧面板：编辑节点（仅内存操作）
 */
const handleRightNodeEdit = (node: BookmarkNode) => {
  if (node.url) {
    dialogStore.openEditBookmarkDialog(node)
  } else {
    dialogStore.openEditFolderDialog(node)
  }
}

/**
 * 收集节点的所有子孙节点 ID
 */
const collectAllDescendantIds = (node: BookmarkNode): string[] => {
  const ids: string[] = []
  const nodeId = String(node.id)
  
  const stack: string[] = []
  const childrenIds = rightTreeIndex.getChildrenIds(nodeId)
  stack.push(...Array.from(childrenIds))
  
  while (stack.length > 0) {
    const currentId = stack.pop()!
    ids.push(currentId)
    
    const children = rightTreeIndex.getChildrenIds(currentId)
    if (children.size > 0) {
      stack.push(...Array.from(children))
    }
  }
  
  return ids
}

/**
 * 批量更新删除节点集合
 */
const batchUpdateDeletingNodes = (ids: string[], add: boolean) => {
  if (ids.length === 0) return

  const newSet = new Set(deletingNodeIds.value)
  if (add) {
    ids.forEach(id => newSet.add(id))
  } else {
    ids.forEach(id => newSet.delete(id))
  }
  deletingNodeIds.value = newSet
}

/**
 * 右侧面板：删除节点（仅内存操作）
 */
const handleRightNodeDelete = (node: BookmarkNode) => {
  const nodeIdsToDelete: string[] = [node.id]

  if (!node.url && node.children && node.children.length > 0) {
    const descendantIds = collectAllDescendantIds(node)
    nodeIdsToDelete.push(...descendantIds)
  }

  batchUpdateDeletingNodes(nodeIdsToDelete, true)

  setTimeout(() => {
    const success = bookmarkManagementStore.deleteNodeFromProposal(node.id)

    if (!success) {
      console.error('删除提案树节点失败:', node.id)
    }

    batchUpdateDeletingNodes(nodeIdsToDelete, false)
  }, 400)
}

/**
 * 右侧面板：添加书签/文件夹（仅内存操作）
 */
const handleRightFolderAdd = (node: BookmarkNode) => {
  dialogStore.openAddItemDialog('bookmark', node)
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (node.url) {
    window.open(node.url, '_blank')
  }
}

const confirmAddNewItem = async () => {
  const title = (dialogStore.addItemDialog.title || '').trim()
  if (!title) {
    addFormErrors.value.title = '标题不能为空'
    return
  }
  if (dialogStore.addItemDialog.type === 'bookmark') {
    const url = (dialogStore.addItemDialog.url || '').trim()
    if (!DataValidator.validateUrl(url)) {
      addFormErrors.value.url =
        '链接地址格式不正确。示例：https://example.com/path'
      return
    }
  }

  if (isAddingItem.value) return

  try {
    isAddingItem.value = true

    const itemType =
      dialogStore.addItemDialog.type === 'bookmark' ? '书签' : '文件夹'

    const res = await bookmarkManagementStore.addBookmark({
      type: dialogStore.addItemDialog.type,
      title: dialogStore.addItemDialog.title,
      url: dialogStore.addItemDialog.url,
      parentId: dialogStore.addItemDialog.parentFolder?.id
    })

    dialogStore.closeAddItemDialog()

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

    await nextTick()
    notificationService.notify(`${itemType}已添加`, { level: 'success' })
  } catch (error) {
    console.error('添加失败:', error)
    notificationService.notify('添加失败，请重试', { level: 'error' })
  } finally {
    isAddingItem.value = false
  }
}

const confirmEditBookmark = async () => {
  if (!isEditDirty.value) {
    dialogStore.closeEditBookmarkDialog()
    return
  }
  const title = (dialogStore.editBookmarkDialog.title || '').trim()
  if (!title) {
    editFormErrors.value.title = '标题不能为空'
    return
  }
  const url = (dialogStore.editBookmarkDialog.url || '').trim()
  if (!DataValidator.validateUrl(url)) {
    editFormErrors.value.url =
      '链接地址格式不正确。示例：https://example.com/path'
    return
  }

  if (isEditingBookmark.value) return

  try {
    isEditingBookmark.value = true

    await bookmarkManagementStore.editBookmark({
      id: dialogStore.editBookmarkDialog.bookmark!.id,
      title: dialogStore.editBookmarkDialog.title,
      url: dialogStore.editBookmarkDialog.url,
      parentId: dialogStore.editBookmarkDialog.parentId
    })

    dialogStore.closeEditBookmarkDialog()

    await nextTick()
    notificationService.notify('书签已更新', { level: 'success' })
  } catch (error) {
    console.error('编辑书签失败:', error)
    notificationService.notify('编辑失败，请重试', { level: 'error' })
  } finally {
    isEditingBookmark.value = false
  }
}

const confirmEditFolder = async () => {
  if (!isEditFolderDirty.value) {
    dialogStore.closeEditFolderDialog()
    return
  }
  const title = (dialogStore.editFolderDialog.title || '').trim()
  if (!title) {
    folderEditFormErrors.value.title = '标题不能为空'
    return
  }

  if (isEditingFolder.value) return

  try {
    isEditingFolder.value = true

    await bookmarkManagementStore.editBookmark({
      id: dialogStore.editFolderDialog.folder!.id,
      title: dialogStore.editFolderDialog.title,
      url: '',
      parentId: undefined
    })

    dialogStore.closeEditFolderDialog()

    await nextTick()
    notificationService.notify('文件夹已更新', { level: 'success' })
  } catch (error) {
    console.error('编辑文件夹失败:', error)
    notificationService.notify('编辑失败，请重试', { level: 'error' })
  } finally {
    isEditingFolder.value = false
  }
}
const confirmDeleteFolder = async () => {
  if (deleteTargetFolder.value) {
    const folder = deleteTargetFolder.value

    if (isDeletingFolder.value) return

    try {
      isDeletingFolder.value = true

      const nodeIdsToDelete: string[] = [folder.id]
      const descendantIds = collectAllDescendantIds(folder)
      nodeIdsToDelete.push(...descendantIds)

      batchUpdateDeletingNodes(nodeIdsToDelete, true)

      setTimeout(async () => {
        try {
          await deleteFolder(folder.id)
        } catch (error) {
          logger.error('Management', '删除文件夹失败', error)
          notificationService.notify('删除失败，请重试', { level: 'error' })
        } finally {
          batchUpdateDeletingNodes(nodeIdsToDelete, false)
          isDeletingFolder.value = false
        }
      }, 400)
    } catch (error) {
      logger.error('Management', '删除文件夹失败', error)
      notificationService.notify('删除失败，请重试', { level: 'error' })
      isDeletingFolder.value = false
    }
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
const handleBookmarkToggleFavorite = async (
  node: BookmarkNode,
  isFavorite: boolean
) => {
  logger.info(
    'Management',
    `${isFavorite ? '⭐ 收藏' : '🗑️ 取消收藏'}书签:`,
    node.title
  )
  try {
    const { favoriteAppService } = await import(
      '@/application/bookmark/favorite-app-service'
    )
    
    const success = isFavorite
      ? await favoriteAppService.addToFavorites(node.id)
      : await favoriteAppService.removeFromFavorites(node.id)

    if (success) {
      notificationService.notify(isFavorite ? `书签已收藏` : `书签已取消收藏`, {
        level: 'success'
      })
      
      // ✅ favoriteAppService 已经调用了 bookmarkStore.updateNode()
      // 左侧树会自动更新（因为依赖 bookmarkStore.bookmarkTree）
      // 右侧树不需要更新（已移除收藏按钮）
      
      logger.debug('Management', '✅ 书签收藏状态已更新')
    } else {
      notificationService.notify('操作失败，请重试', { level: 'error' })
    }
  } catch (error) {
    logger.error('Component', 'Management', '❌ 切换收藏状态失败:', error)
    notificationService.notify('操作失败，请重试', { level: 'error' })
  }
}

/**
 * 处理外部书签变更事件
 * 当检测到外部书签变更时（如 Chrome Sync、其他设备、书签管理器），
 * 如果用户没有未保存的修改，则静默刷新数据
 */
const handleExternalChange = async (data: {
  eventType: 'created' | 'changed' | 'moved' | 'removed'
  bookmarkId?: string
  timestamp: number
}) => {
  if (bookmarkManagementStore.isApplyingOwnChanges) {
    logger.debug('Management', '检测到自己触发的变更，忽略', data)
    return
  }

  logger.info('Management', '🔄 检测到外部书签变更', data)

  if (bookmarkManagementStore.hasUnsavedChanges) {
    logger.warn('Management', '用户有未保存的修改，暂不自动刷新')
    return
  }

  try {
    await initializeStore()
    logger.info('Management', '✅ 已静默刷新书签数据')
    notificationService.notify('检测到外部书签变更，数据已自动更新', {
      level: 'info'
    })
  } catch (error) {
    logger.error('Management', '静默刷新失败', error)
    notificationService.notify('书签数据刷新失败', { level: 'error' })
  }
}

const unsubscribeExternalChange = onEvent('data:synced', handleExternalChange)
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (bookmarkManagementStore.hasUnsavedChanges) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onUnmounted(() => {
  unsubscribeExternalChange()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onMounted(async () => {
  await checkOnPageLoad({ autoRecover: true, showNotification: false })

  initializeStore()

  let pendingTags: HealthTag[] = []
  try {
    const params = new URLSearchParams(window.location.search)
    const tagsParam = params.get('tags')
    console.log('[Management] URL 参数:', {
      search: window.location.search,
      tagsParam
    })
    pendingTags = tagsParam
      ? tagsParam
          .split(',')
          .map(tag => tag.trim())
          .filter((tag): tag is HealthTag =>
            ['duplicate', 'invalid'].includes(tag)
          )
      : []
    console.log('[Management] 解析的 pendingTags:', pendingTags)
  } catch {}

  autoRefreshHealthTags()
    .then(() => {
      console.log('[Management] 健康扫描完成，检查待处理标签:', pendingTags)
      if (pendingTags.length > 0) {
        console.log('[Management] 激活筛选:', pendingTags)
        cleanupStore.setActiveFilters(pendingTags)
        pendingTagSelection.value = pendingTags
      }
    })
    .catch((error: unknown) => {
      logger.error('Management', '自动健康扫描失败', error)
    })

  window.addEventListener('beforeunload', handleBeforeUnload)

  const g = window as unknown as Record<string, unknown>
  g.AB_setFolderExpanded = (id: string, expanded?: boolean) => {
    const comp = leftTreeRef.value
    if (!comp) return
    const sid = String(id)
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

const toggleLeftExpandAll = async () => {
  if (!leftTreeRef.value) return
  if (isExpanding.value) return
  isExpanding.value = true
  schedulerService.scheduleUIUpdate(() => {
    isPageLoading.value = true
    loadingMessage.value = leftExpandAll.value ? '正在收起...' : '正在展开...'
  })
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

// 清空选择：调用树组件 API，状态通过 selection-change 事件自动同步
const clearRightSelection = () => {
  try {
    rightTreeRef.value?.clearSelection?.()
  } catch {}
}

// 计算右侧树的全选状态
const rightSelectAllState = computed(() => {
  const totalNodes = getAllRightTreeNodeIds()
  const selectedCount = rightSelectedIds.value.length

  if (selectedCount === 0) {
    return { checked: false, indeterminate: false }
  }

  if (selectedCount === totalNodes.length) {
    return { checked: true, indeterminate: false }
  }

  return { checked: false, indeterminate: true }
})

// 统计右侧树数据中的实际书签和文件夹数量（用于调试和验证）
const rightTreeDataStats = computed(() => {
  let bookmarkCount = 0
  let folderCount = 0

  const countNodes = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      if (!node || !node.id) continue
      if (node.url) {
        bookmarkCount++
      } else {
        folderCount++
      }
      if (node.children && node.children.length) {
        countNodes(node.children)
      }
    }
  }

  countNodes(rightTreeData.value)
  return { bookmarkCount, folderCount, total: bookmarkCount + folderCount }
})

// 监控右侧树数据统计（用于调试数量不一致问题）
watch(
  () => rightTreeDataStats.value,
  stats => {
    logger.debug('Management', '右侧树数据统计', {
      bookmarks: stats.bookmarkCount,
      folders: stats.folderCount,
      total: stats.total
    })
  },
  { immediate: true }
)

/**
 * 获取右侧树所有节点 ID
 * 直接从索引获取，O(1) 操作
 * 
 * @returns 所有节点 ID 数组
 */
const getAllRightTreeNodeIds = (): string[] => {
  return rightTreeIndex.getAllNodeIds()
}

// 全选/取消全选切换
const toggleRightSelectAll = (checked: boolean) => {
  if (checked) {
    // 全选
    const allIds = getAllRightTreeNodeIds()
    rightTreeRef.value?.selectNodesByIds?.(allIds, { append: false })
    // 全选后自动展开所有文件夹，方便用户确认选中内容
    nextTick(() => {
      rightTreeRef.value?.expandAll?.()
      rightExpandAll.value = true
    })
  } else {
    // 取消全选：显式传递空数组，确保所有节点（包括文件夹）都被取消选中
    rightTreeRef.value?.selectNodesByIds?.([], { append: false })
  }
}

// 使用 Notification 组件
const notification = useNotification()

const handleBookmarkMove = async (data: {
  sourceId: string
  targetId: string
  position: 'before' | 'inside' | 'after'
}) => {
  const callTime = Date.now()
  logger.info('Management', '🔵 拖拽移动书签开始', { ...data, callTime })

  try {
    const result = await bookmarkManagementStore.moveBookmark(data)

    if (result) {
      logger.info('Management', '📦 移动结果（可用于 Chrome API）', {
        nodeId: result.nodeId,
        newParentId: result.newParentId,
        newIndex: result.newIndex,
        chromeApiCall: `chrome.bookmarks.move('${result.nodeId}', { parentId: '${result.newParentId}', index: ${result.newIndex} })`
      })
    }

    notification.success({
      message: '书签已移动',
      key: 'bookmark-moved',
      duration: 2
    })
  } catch (error) {
    logger.error('Management', '移动书签失败', error)
    notification.error({
      message: '移动失败',
      description: '请重试',
      duration: 3
    })
  }
}
const openConfirmBulkDelete = () => {
  if (!rightSelectedIds.value.length) return
  isConfirmBulkDeleteDialogOpen.value = true
}

const confirmBulkDeleteSelected = async () => {
  const ids = rightSelectedIds.value.filter(Boolean)
  if (!ids.length) {
    isConfirmBulkDeleteDialogOpen.value = false
    return
  }

  if (isBulkDeleting.value) return // 防止重复点击

  try {
    isBulkDeleting.value = true

    bulkDeleteByIds(ids)
    isConfirmBulkDeleteDialogOpen.value = false
    // 清空选择，避免再次误删
    try {
      rightTreeRef.value?.clearSelection?.()
    } catch {}
  } catch (error) {
    logger.error('Management', '批量删除失败', error)
    notificationService.notify('批量删除失败，请重试', { level: 'error' })
  } finally {
    isBulkDeleting.value = false
  }
}

// ==================== 应用更改相关方法 ====================

/**
 * 确认对话框标题
 */
const applyConfirmTitle = computed(() => {
  if (!diffResult.value) return '应用更改'

  const total = diffResult.value.statistics.total
  if (total < 100) {
    return '确认应用更改'
  } else if (total < 500) {
    return '⚠️ 确认大量更改'
  } else {
    return '⚠️ 确认大规模更改'
  }
})

/**
 * 确认对话框图标
 */
const applyConfirmIcon = computed(() => {
  if (!diffResult.value) return 'icon-check'

  const total = diffResult.value.statistics.total
  if (total < 100) {
    return 'icon-check'
  } else {
    return 'icon-warning'
  }
})

/**
 * 预计剩余时间
 */
const estimatedRemainingTime = computed(() => {
  const progress = bookmarkManagementStore.applyProgress
  if (!progress.isApplying || progress.currentIndex === 0) {
    return '计算中...'
  }

  const elapsed = Date.now() - applyStartTime.value
  const avgTimePerOp = elapsed / progress.currentIndex
  const remaining = Math.ceil(
    ((progress.totalOperations - progress.currentIndex) * avgTimePerOp) / 1000
  )

  if (remaining < 60) {
    return `约 ${remaining} 秒`
  } else {
    const minutes = Math.ceil(remaining / 60)
    return `约 ${minutes} 分钟`
  }
})

/**
 * 获取操作图标
 */
const getOperationIcon = (type: BookmarkOperationType): string => {
  const icons: Record<BookmarkOperationType, string> = {
    create: 'icon-add',
    move: 'icon-swap',
    edit: 'icon-edit',
    delete: 'icon-delete'
  }
  return icons[type] || 'icon-bookmark'
}

/**
 * 获取操作颜色
 */
const getOperationColor = (type: BookmarkOperationType): string => {
  const colors: Record<BookmarkOperationType, string> = {
    create: 'success',
    move: 'primary',
    edit: 'warning',
    delete: 'error'
  }
  return colors[type] || 'default'
}

/**
 * 获取操作类型文本
 */
const getOperationTypeText = (type: BookmarkOperationType): string => {
  const texts: Record<BookmarkOperationType, string> = {
    create: '新增',
    move: '移动',
    edit: '编辑',
    delete: '删除'
  }
  return texts[type] || type
}

/**
 * 按类型获取操作列表
 */
const getOperationsByType = (
  type: BookmarkOperationType
): BookmarkOperation[] => {
  if (!diffResult.value) return []
  return diffResult.value.operations.filter(op => op.type === type)
}

/**
 * 一键整理书签栏（AI 自动分类）
 */
async function handleAIOrganize() {
  if (isOrganizing.value || isPageLoading.value) {
    return
  }

  try {
    isOrganizing.value = true
    showOrganizeProgress.value = true
    organizeProgress.value = {
      current: 0,
      total: 0,
      message: '正在加载书签...'
    }

    // 获取所有书签（只获取书签，不包括文件夹）
    const allBookmarksResult = await bookmarkAppService.getAllBookmarks()
    if (!allBookmarksResult.ok) {
      notificationService.notifyError('获取书签失败', 'AI 整理')
      return
    }

    const allBookmarks = allBookmarksResult.value
    // 过滤出书签（有 URL 的），排除文件夹和 Chrome 内部链接
    const bookmarkRecords = allBookmarks.filter(
      record => record.url && !record.url.startsWith('chrome://')
    )

    if (bookmarkRecords.length === 0) {
      notificationService.notify('没有找到可整理的书签', { level: 'info' })
      return
    }

    organizeProgress.value = {
      current: 0,
      total: bookmarkRecords.length,
      message: `正在整理 ${bookmarkRecords.length} 个书签...`
    }

    // 调用 AI 整理服务（发送标题、URL 和元数据，用于分类判断）
    // LLM 返回分类结果后，我们会保留原始 BookmarkRecord 的所有字段
    const results = await aiAppService.organizeBookmarks(
      bookmarkRecords.map(record => ({
        id: String(record.id),
        title: record.title,
        url: record.url || '',
        // 如果有爬虫元数据，一起发送（提高分类准确率）
        ...(record.hasMetadata &&
          record.metaDescriptionLower && {
            metaDescription: record.metaDescriptionLower,
            metaKeywords: record.metaKeywordsTokens?.slice(0, 5)
          })
      }))
    )

    // 创建 BookmarkRecord ID 到分类的映射
    const recordIdToCategory = new Map<string, string>()
    for (const result of results) {
      recordIdToCategory.set(result.id, result.category || '其他')
    }

    // 保留原始 BookmarkRecord 的所有字段，只根据分类结果调整层级结构
    // 1. 先构建所有原始 BookmarkRecord 的映射（保留完整信息）
    const recordMap = new Map<string, BookmarkRecord>()
    for (const record of allBookmarks) {
      recordMap.set(String(record.id), record)
    }

    // 2. 按分类组织书签，创建分类文件夹的 BookmarkRecord
    const categoryFolders = new Map<string, BookmarkRecord>()
    const categoryBookmarks = new Map<string, BookmarkRecord[]>()

    // 初始化分类文件夹
    const categories = Array.from(
      new Set(results.map(r => r.category || '其他'))
    )
    for (const category of categories) {
      const folderId = `temp_folder_${category}`
      // 使用第一个已有文件夹记录作为模板（如果存在），否则创建最小完整记录
      const baseRecord = allBookmarks.find(r => r.isFolder) || allBookmarks[0]

      if (!baseRecord) {
        // 如果没有记录，创建一个最小完整记录
        categoryFolders.set(category, {
          id: folderId,
          title: category,
          parentId: bookmarkManagementStore.newProposalTree.id,
          index: categories.indexOf(category),
          isFolder: true,
          path: [category],
          pathString: category,
          pathIds: [folderId],
          pathIdsString: folderId,
          ancestorIds: [],
          siblingIds: [],
          depth: 0,
          titleLower: category.toLowerCase(),
          urlLower: undefined,
          domain: undefined,
          keywords: [],
          childrenCount: 0,
          bookmarksCount: 0,
          folderCount: 0,
          tags: [],
          healthTags: [],
          healthMetadata: [],
          dateAdded: Date.now(),
          dateGroupModified: Date.now(),
          createdYear: new Date().getFullYear(),
          createdMonth: new Date().getMonth() + 1,
          isInvalid: false,
          isDuplicate: false,
          dataVersion: 1,
          lastCalculated: Date.now()
        } as BookmarkRecord)
      } else {
        // 使用已有记录作为模板，覆盖需要的字段
        categoryFolders.set(category, {
          ...baseRecord,
          id: folderId,
          title: category,
          parentId: bookmarkManagementStore.newProposalTree.id,
          index: categories.indexOf(category),
          isFolder: true,
          url: undefined,
          urlLower: undefined,
          path: [category],
          pathString: category,
          pathIds: [folderId],
          pathIdsString: folderId,
          ancestorIds: [],
          siblingIds: [],
          depth: 0,
          titleLower: category.toLowerCase(),
          keywords: [],
          childrenCount: 0,
          bookmarksCount: 0,
          folderCount: 0,
          dateAdded: Date.now()
        } as BookmarkRecord)
      }
      categoryBookmarks.set(category, [])
    }

    // 3. 将书签分配到对应分类，保留原始 BookmarkRecord 的所有字段，只更新层级相关字段
    for (const record of bookmarkRecords) {
      const category = recordIdToCategory.get(String(record.id)) || '其他'
      const bookmarks = categoryBookmarks.get(category)!

      // 保留原始记录的所有字段，只更新 parentId、index 和路径相关字段
      const updatedRecord: BookmarkRecord = {
        ...record, // 保留所有原始字段
        parentId: `temp_folder_${category}`, // 只更新 parentId
        index: bookmarks.length, // 只更新 index（在文件夹内的顺序）
        // 更新路径相关字段（反映新的层级结构）
        path: [category, ...(record.path || [])],
        pathString: `${category}/${record.pathString || record.title}`,
        pathIds: [`temp_folder_${category}`, ...(record.pathIds || [])],
        pathIdsString: `temp_folder_${category},${record.pathIdsString || record.id}`,
        ancestorIds: [`temp_folder_${category}`, ...(record.ancestorIds || [])],
        depth: 1 // 更新深度（分类文件夹是第 0 层）
      }
      bookmarks.push(updatedRecord)
    }

    // 4. 更新分类文件夹的 childrenCount
    for (const [category, folder] of categoryFolders.entries()) {
      const bookmarks = categoryBookmarks.get(category)!
      folder.childrenCount = bookmarks.length
    }

    // 5. 构建完整的 BookmarkRecord 数组（文件夹 + 书签）
    const organizedRecords: BookmarkRecord[] = []
    for (const category of categories) {
      const folder = categoryFolders.get(category)!
      organizedRecords.push(folder)
      organizedRecords.push(...categoryBookmarks.get(category)!)
    }

    // 6. 使用 treeAppService 构建树结构（确保格式正确）
    const organizedTree = treeAppService.buildViewTreeFromFlat(organizedRecords)

    // 7. 使用 setProposalTree 方法设置提案树（确保数据格式正确）
    setProposalTree(organizedTree)

    bookmarkManagementStore.hasUnsavedChanges = true

    notificationService.notifySuccess(
      `成功整理 ${bookmarkRecords.length} 个书签到 ${categories.length} 个分类`,
      'AI 整理'
    )
  } catch (error) {
    logger.error('AI 整理失败', error)
    notificationService.notifyError('整理失败，请稍后重试', 'AI 整理')
  } finally {
    isOrganizing.value = false
    showOrganizeProgress.value = false
  }
}

/**
 * 点击应用更改按钮
 */
const handleApplyClick = () => {
  // 检查是否有临时节点
  const tempNodeInfo = getTempNodesInfo(
    bookmarkManagementStore.newProposalTree.children
  )

  if (tempNodeInfo.count > 0) {
    const message =
      `⚠️ 检测到 ${tempNodeInfo.count} 个未保存的新增节点。\n\n` +
      `说明：新添加的节点（ID 以 temp_ 开头）尚未保存到浏览器书签。\n` +
      `这些节点的顺序调整无法应用，因为它们还不存在于浏览器中。\n\n` +
      `建议操作流程：\n` +
      `1. 如果这些是误添加的节点，请刷新页面丢弃它们\n` +
      `2. 如果需要保留这些节点，暂时不支持保存（功能开发中）`

    if (window.confirm(message)) {
      // 用户选择了解，继续显示差异（已过滤临时节点）
      const diff = bookmarkManagementStore.calculateDiff()

      if (!diff || diff.statistics.total === 0) {
        // 如果实际没有差异，重置标志位，禁用按钮
        bookmarkManagementStore.hasUnsavedChanges = false
        notificationService.notify('过滤临时节点后，没有可应用的更改', {
          level: 'info'
        })
        return
      }

      diffResult.value = diff
      showApplyConfirmDialog.value = true
    }
    return
  }

  // 计算差异
  const diff = bookmarkManagementStore.calculateDiff()

  if (!diff || diff.statistics.total === 0) {
    // 如果实际没有差异，重置标志位，禁用按钮
    bookmarkManagementStore.hasUnsavedChanges = false
    notificationService.notify('没有检测到任何更改', { level: 'info' })
    return
  }

  diffResult.value = diff
  showApplyConfirmDialog.value = true
}

/**
 * 获取临时节点信息
 * 直接从索引获取所有 ID 并过滤，避免递归遍历
 * 
 * @param _nodes 节点数组（未使用，保留兼容性）
 * @returns 临时节点信息
 */
const getTempNodesInfo = (
  _nodes: BookmarkNode[]
): { count: number; ids: string[] } => {
  const allIds = rightTreeIndex.getAllNodeIds()
  const tempIds = allIds.filter(id => id.startsWith('temp_'))
  
  return {
    count: tempIds.length,
    ids: tempIds
  }
}

/**
 * 确认应用更改
 */
const confirmApplyChanges = async () => {
  if (!diffResult.value) return

  try {
    // 关闭确认对话框
    showApplyConfirmDialog.value = false

    // 记录开始时间
    applyStartTime.value = Date.now()

    // 应用更改
    const result = await bookmarkManagementStore.applyChanges(
      diffResult.value.operations,
      (current, total, operation) => {
        // 进度回调（已在 store 中更新状态）
        logger.debug('Management', `应用进度: ${current}/${total}`, {
          operation
        })
      }
    )

    // 显示结果
    if (result.success) {
      notificationService.notify('✅ 所有更改已成功应用', { level: 'success' })
    } else {
      notificationService.notify(
        `⚠️ 部分更改失败（${result.errors.length} 个错误）`,
        { level: 'warning' }
      )
      logger.error('Management', '应用更改部分失败', result.errors)
    }

    // 清空差异结果
    diffResult.value = null
  } catch (error) {
    logger.error('Management', '应用更改失败', error)
    notificationService.notify('❌ 应用更改失败', { level: 'error' })
  }
}

/**
 * 顶部"应用"按钮点击事件
 */
const handleApply = () => {
  // 复用 handleApplyClick 的逻辑
  handleApplyClick()
}

// =============================
</script>

<style scoped>
/* 健康扫描进度对话框样式 */
.health-scan-progress {
  padding: var(--spacing-4);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.progress-message {
  font-size: var(--font-size-body-medium);
  color: var(--color-text-primary);
}

.progress-stats {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

/* 应用更改对话框样式 */
.apply-confirm-dialog {
  max-height: 60vh;
  padding: var(--spacing-4);
  overflow-y: auto;
}

.ai-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-body-medium);
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-surface, rgb(25 118 210 / 8%));
}

.statistics-section {
  margin-bottom: var(--spacing-4);
}

.section-title {
  margin-bottom: var(--spacing-3);
  font-size: var(--font-size-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
}

.statistics-grid {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(3, 1fr);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.stat-item.total {
  background: var(--color-primary-surface, rgb(25 118 210 / 12%));
}

.stat-label {
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: var(--font-size-heading-small);
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-value.error {
  color: var(--color-error);
}

.details-section {
  margin-top: var(--spacing-4);
}

.operations-list {
  max-height: 300px;
  padding: var(--spacing-2);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
  overflow-y: auto;
}

.operation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border-bottom: 1px solid var(--color-outline-variant);
}

.operation-item:last-child {
  border-bottom: none;
}

.operation-type {
  min-width: 48px;
  font-size: var(--font-size-body-small);
  font-weight: 500;
}

.operation-title {
  flex: 1;
  font-size: var(--font-size-body-small);
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.grouped-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.summary-group {
  padding: var(--spacing-3);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
}

.summary-group summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-body-medium);
  font-weight: 500;
  cursor: pointer;
  list-style: none;
}

.summary-group summary::-webkit-details-marker {
  display: none;
}

.group-items {
  max-height: 200px;
  margin-top: var(--spacing-3);
  padding-left: var(--spacing-6);
  overflow-y: auto;
}

.group-item {
  padding: var(--spacing-1) 0;
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

.more-items {
  padding: var(--spacing-2) 0;
  font-size: var(--font-size-body-small);
  font-style: italic;
  color: var(--color-text-tertiary);
}

.large-operation-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  text-align: center;
}

.large-operation-warning h3 {
  font-size: var(--font-size-heading-medium);
  font-weight: 600;
  color: var(--color-warning);
}

.large-operation-warning p {
  margin: 0;
  font-size: var(--font-size-body-medium);
  color: var(--color-text-secondary);
}

/* 警告文本 - 高特异性覆盖父元素样式 */
.large-operation-warning .warning-text,
p.warning-text {
  font-weight: 500;
  color: var(--color-warning);
}

.apply-progress {
  padding: var(--spacing-4);
}

.progress-tip {
  margin-top: var(--spacing-3);
  font-size: var(--font-size-body-small);
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
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
.bulk-delete-in-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-surface);
}

/* 选择统计：避免数字变化导致文本整体"抖动" */
.selection-summary {
  display: inline-flex;
  align-items: center; /* 让 Checkbox 与文字垂直居中对齐 */
  gap: var(--spacing-2);

  /* 消除模板空白带来的字符间距 */
  font-size: 0;
  font-weight: 600;

  /* ✅ 强化：防止点击时文本被选中（多浏览器兼容） */
  user-select: none;
}

.select-all-checkbox {
  /* ✅ 确保点击事件不穿透到文本 */
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  margin: calc(var(--spacing-2) * -1);

  /* ✅ 增加点击区域，减少误触文本 */
  padding: var(--spacing-2);
}

.selection-summary .text {
  font-size: 1rem; /* 恢复正常字号 */
}

.selection-summary .count {
  display: inline-block;

  /* 至少两位宽度（按字符单位），右对齐以保持文案稳定 */
  min-width: 3ch;

  /* 移除外边距，由显式 gap 控制空隙 */
  margin: 0;
  font-size: 1rem; /* 恢复正常字号 */
  font-weight: 800;
  text-align: center;

  /* 使用等宽数字和固定宽度避免横向位移 */
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

.selection-summary .gap {
  display: inline-block;
  width: var(--spacing-2-5);
  height: 1em;
}

.bulk-delete-btn {
  border: 1px solid var(--color-error);
  color: var(--color-text-on-primary);
  background: var(--color-error);
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
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
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

.main-content {
  flex: none;
  height: calc(100vh - var(--spacing-16));
  overflow: hidden;
}

.management-container {
  height: 100%;
}

.panel-col {
  display: flex;
  flex-direction: column;
  height: 100%;

  /* 允许子项在 Flex 布局中收缩，从而使内部产生滚动 */
  min-height: 0;
}

.panel-card {
  display: flex;
  flex-direction: column;
  flex: 1;

  /* 允许内容区域计算高度并滚动 */
  min-height: 0;
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
  overflow: hidden;
}

/* 左侧面板：增加视觉权重，使用更深的背景 */
.panel-col:first-child .panel-card {
  flex: 1.2;
  background: var(--color-bg-primary);
}

/* 右侧卡片：弱化背景，突出内容 */
.right-panel-card {
  flex: 1;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.panel-header {
  position: relative; /* 作为浮层定位参照 */
  display: flex;
  flex-wrap: nowrap; /* 防止按钮换行 */
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  width: 100%;
  overflow: visible; /* 放行浮层 */
}

.panel-title-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* 标题区域：可以灵活缩小 */
.panel-title-section:first-child {
  flex: 1 1 auto;
  min-width: 0; /* 允许文字缩略 */
}

/* 按钮区域：保持固定宽度 */
.panel-title-section:last-child {
  flex: 0 0 auto;
}

.panel-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--spacing-2);
}

.panel-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* 允许内部子元素计算高度，避免超出无法滚动 */

  /* 使左右面板内容可滚动（包含 legend 和树） */
  overflow-y: auto;
}

/* 中间分隔区样式 */
.divider-col {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
}

.panel-divider {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  opacity: 0.3;
  transition: opacity var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.panel-divider:hover {
  opacity: 0.6;
}

/* 右侧面板操作区的分隔符 */
.panel-actions-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  opacity: 0.5;
}

/* ✅ 按钮包装器：用于在禁用状态下显示 tooltip */
.btn-wrapper {
  display: inline-flex;

  /* 确保 wrapper 不影响布局 */
  line-height: 0;
}

/* 优化"应用"按钮样式 */
.panel-actions .btn:first-child {
  padding-right: var(--spacing-3);
  padding-left: var(--spacing-3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  height: 100%;
  color: var(--color-text-secondary);
}

.edit-form,
.add-item-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.form-fields {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  overflow: hidden;
}


/* 语义搜索样式 */
.semantic-search-panel {
  padding: var(--spacing-sm) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.semantic-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
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
  display: grid;
  gap: var(--spacing-1-5);
  grid-template-columns: 1fr;
  padding: var(--spacing-sm) 0;
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

/* 局部：底部批量操作条入场/出场动画（出现：自下而上；消失：向下） */
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
  opacity: 0;
  transform: translateY(var(--spacing-4));
}

.card-footer-slide-leave-to {
  opacity: 0;
  transform: translateY(var(--spacing-4));
}

.control-btn--icon {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
}

.control-btn--icon .btn__icon {
  margin: 0;
}
</style>
