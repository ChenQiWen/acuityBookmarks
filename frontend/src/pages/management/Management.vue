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

    <!-- 📤 分享弹窗 -->
    <ShareDialog
      v-model:show="showShareDialog"
      :bookmarks="shareBookmarks"
      :share-type="shareType"
      :folder-name="shareFolderName"
      @share-complete="handleShareComplete"
    />

    <!-- 🔍 特征检测进度对话框 - 已移除，改为后台静默运行 -->

    <!-- 🤖 AI 整理进度对话框 -->
    <Dialog
      :show="showOrganizeProgress"
      :title="t('management_ai_organize_bookmarks')"
      persistent
      max-width="500px"
    >
      <div class="trait-scan-progress">
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
          <span>{{ t('management_ai_generated_badge') }}</span>
        </div>

        <!-- 统计信息 -->
        <div class="statistics-section">
          <h3 class="section-title">{{ t('management_changes_overview') }}</h3>
          <div class="statistics-grid">
            <div class="stat-item">
              <span class="stat-label">{{ t('management_new_folders') }}</span>
              <span class="stat-value">{{
                diffResult?.statistics.newFolders || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_new_bookmarks') }}</span>
              <span class="stat-value">{{
                diffResult?.statistics.newBookmarks || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_moved') }}</span>
              <span class="stat-value">{{
                diffResult?.statistics.move || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_edited') }}</span>
              <span class="stat-value">{{
                diffResult?.statistics.edit || 0
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_deleted') }}</span>
              <span class="stat-value error">{{
                diffResult?.statistics.delete || 0
              }}</span>
            </div>
            <div class="stat-item total">
              <span class="stat-label">{{ t('management_total') }}</span>
              <span class="stat-value">{{
                diffResult?.statistics.total || 0
              }}</span>
            </div>
          </div>
        </div>

        <!-- 详细列表（仅在操作数 < 100 时显示完整列表，100-500 显示汇总，>500 只显示统计） -->
        <div v-if="diffResult" class="details-section">
          <div v-if="diffResult.statistics.total < 100" class="detailed-list">
            <h3 class="section-title">{{ t('management_detailed_operations') }}</h3>
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
            <h3 class="section-title">{{ t('management_grouped_summary') }}</h3>
            <details
              v-if="diffResult.statistics.create > 0"
              class="summary-group"
              open
            >
              <summary>
                <Icon name="icon-add" color="success" />
                <span>{{ t('management_create_nodes', String(diffResult.statistics.create)) }}</span>
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
                  {{ t('management_more_items', String(getOperationsByType('create').length - 50)) }}
                </div>
              </div>
            </details>
            <details
              v-if="diffResult.statistics.move > 0"
              class="summary-group"
            >
              <summary>
                <Icon name="icon-swap" color="primary" />
                <span>{{ t('management_move_nodes', String(diffResult.statistics.move)) }}</span>
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
                  {{ t('management_more_items', String(getOperationsByType('move').length - 50)) }}
                </div>
              </div>
            </details>
            <details
              v-if="diffResult.statistics.edit > 0"
              class="summary-group"
            >
              <summary>
                <Icon name="icon-edit" color="warning" />
                <span>{{ t('management_edit_nodes', String(diffResult.statistics.edit)) }}</span>
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
                  {{ t('management_more_items', String(getOperationsByType('edit').length - 50)) }}
                </div>
              </div>
            </details>
            <details
              v-if="diffResult.statistics.delete > 0"
              class="summary-group"
            >
              <summary>
                <Icon name="icon-delete" color="error" />
                <span>{{ t('management_delete_nodes', String(diffResult.statistics.delete)) }}</span>
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
                  {{ t('management_more_items', String(getOperationsByType('delete').length - 50)) }}
                </div>
              </div>
            </details>
          </div>
          <div v-else class="large-operation-warning">
            <Icon name="icon-warning" color="warning" size="48" />
            <h3>{{ t('management_large_operation_warning') }}</h3>
            <p v-html="t('management_large_operation_desc', String(diffResult.statistics.total))"></p>
            <p class="warning-text">{{ t('management_large_operation_warning_text') }}</p>
          </div>
        </div>
      </div>

      <template #actions>
        <Button variant="text" @click="showApplyConfirmDialog = false">
          {{ t('common_cancel') }}
        </Button>
        <Button color="primary" @click="confirmApplyChanges">
          {{ t('common_apply') }}
        </Button>
      </template>
    </Dialog>

    <!-- 📈 应用更改进度对话框 -->
    <Dialog
      :show="bookmarkManagementStore.applyProgress.isApplying"
      :title="t('management_applying_changes')"
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
          {{ t('management_estimated_time', estimatedRemainingTime) }}
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
                    <span class="panel-title">{{ t('management_my_bookmarks') }}</span>
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
                        leftExpandAll ? t('management_collapse_all') : t('management_expand_all')
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
                  size="spacious"
                  :loading="isPageLoading"
                  :editable="false"
                  :show-toolbar="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(originalExpandedFolders)"
                  :virtual="true"
                  :selectable="false"
                  :show-favorite-button="false"
                  :show-edit-button="false"
                  :show-delete-button="false"
                  :show-add-button="false"
                  :show-open-new-tab-button="false"
                  :show-copy-url-button="false"
                  :show-share-button="false"
                  :show-more-button="false"
                  @ready="handleLeftTreeReady"
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
                          <span>{{ t('management_apply') }}</span>
                        </Button>
                      </span>
                      <div class="panel-actions-divider"></div>
                      <Button
                        variant="primary"
                        size="sm"
                        :disabled="
                          isPageLoading || isOrganizing || isCleanupLoading
                        "
                        @click="handleAIOrganize"
                      >
                        <Icon name="icon-sparkles" :spin="isOrganizing" />
                        <span>{{
                          isOrganizing ? t('management_organizing') : t('management_ai_organize')
                        }}</span>
                      </Button>
                      <div class="panel-actions-divider"></div>
                      <!-- 分享按钮 -->
                      <span class="btn-wrapper" :title="shareButtonTooltip">
                        <Button
                          variant="outline"
                          size="sm"
                          :disabled="rightSelectedIds.length === 0 || isPreparingShare"
                          :loading="isPreparingShare"
                          @click="handleShareSelected"
                        >
                          <Icon v-if="!isPreparingShare" name="icon-share" />
                          <span>{{ isPreparingShare ? '准备中...' : '分享' }}</span>
                        </Button>
                      </span>
                      <div class="panel-actions-divider"></div>
                      <BookmarkSearchInput
                        mode="memory"
                        :data="newProposalTree.children"
                        :debounce="300"
                        :enable-trait-filters="true"
                        :sync-with-store="true"
                        @search-complete="handleRightSearch"
                        @search-clear="handleRightSearchClear"
                      />
                      <Button
                        variant="text"
                        size="sm"
                        icon
                        :title="
                          rightExpandAll ? t('management_collapse_all') : t('management_expand_all')
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
                <!-- 特征筛选面板已移至 BookmarkSearchInput 组件 -->
                <BookmarkTree
                  ref="rightTreeRef"
                  :nodes="rightTreeData"
                  :selected-desc-counts="rightTreeSelectedDescCounts"
                  height="100%"
                  size="spacious"
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
                  @request-clear-filters="traitFilterStore.clearFilters()"
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
                        ? t('management_all_selected')
                        : t('management_selected')
                    }}</span>
                    <span class="count"
                      ><AnimatedNumber :value="selectedCounts.bookmarks"
                    /></span>
                    <span class="text">{{ t('management_bookmarks_count') }}</span>
                    <span class="gap"></span>
                    <span class="count"
                      ><AnimatedNumber :value="selectedCounts.folders"
                    /></span>
                    <span class="text">{{ t('management_folders_count') }}</span>
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
                        {{ t('management_clear_selection', String(rightSelectedIds.length)) }}
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
                        @click="handleBulkDelete"
                      >
                        <template #prepend>
                          <Icon name="icon-delete" />
                        </template>
                        {{ t('common_delete') }}
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
      :title="t('management_edit_bookmark')"
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
          :label="t('management_bookmark_title')"
          variant="outlined"
          class="form-field"
          :error="!!editFormErrors.title"
          :error-message="editFormErrors.title"
        />
        <UrlInput
          v-model="dialogStore.editBookmarkDialog.url"
          :label="t('management_bookmark_url')"
          variant="outlined"
          density="compact"
          :error="!!editFormErrors.url"
          :error-message="editFormErrors.url"
        />
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">
          {{ t('common_cancel') }}
        </Button>
        <Button
          color="primary"
          :disabled="!isEditDirty"
          :loading="isEditingBookmark"
          @click="confirmEditBookmark"
        >
          {{ t('management_update') }}
        </Button>
      </template>
    </ConfirmableDialog>

    <!-- Edit Folder Dialog -->
    <ConfirmableDialog
      :show="dialogStore.editFolderDialog.isOpen"
      :title="t('management_edit_folder')"
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
          :label="t('management_folder_title')"
          variant="outlined"
          class="form-field"
          :error="!!folderEditFormErrors.title"
          :error-message="folderEditFormErrors.title"
        />
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">
          {{ t('common_cancel') }}
        </Button>
        <Button
          color="primary"
          :disabled="!isEditFolderDirty"
          :loading="isEditingFolder"
          @click="confirmEditFolder"
        >
          {{ t('management_update') }}
        </Button>
      </template>
    </ConfirmableDialog>

    <!-- Delete Folder Confirm Dialog (统一为 ConfirmableDialog) -->
    <ConfirmableDialog
      :show="isConfirmDeleteDialogOpen"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :title="t('management_confirm_delete')"
      icon="icon-delete"
      :persistent="true"
      :enable-cancel-guard="false"
      max-width="480px"
      min-width="480px"
      @update:show="(v: boolean) => (isConfirmDeleteDialogOpen = v)"
      @confirm="confirmDeleteFolder"
    >
      <div class="confirm-content">
        {{ t('management_delete_folder_confirm', String(deleteFolderBookmarkCount)) }}
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">
          {{ t('common_cancel') }}
        </Button>
        <Button
          color="error"
          :loading="isDeletingFolder"
          @click="confirmDeleteFolder"
        >
          {{ t('management_confirm_delete') }}
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
            { value: 'bookmark', text: t('management_bookmark') },
            { value: 'folder', text: t('management_folder') }
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
                :label="t('management_title')"
                variant="outlined"
                class="form-field"
                autofocus
                :error="!!addFormErrors.title"
                :error-message="addFormErrors.title"
              />
              <UrlInput
                v-model="dialogStore.addItemDialog.url"
                :label="t('management_url')"
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
                :label="t('management_folder_name')"
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
          {{ t('common_cancel') }}
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
import { t } from '@/utils/i18n-helpers'

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
  useTraitFilterStore
} from '@/stores'
import type { TraitTag } from '@/types/domain/trait'
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
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
// 导入现代书签服务：以 side-effect 方式初始化并设置事件监听与消息桥接
import '@/services/modern-bookmark-service'
import { DataValidator } from '@/core/common/store-error'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
// 数据健康检查已移除，使用特征检测代替
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import ShareDialog from '@/components/business/ShareDialog/ShareDialog.vue'
import { shareService } from '@/application/share/share-service'
import { ShareError } from '@/application/share/types'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
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
const traitFilterStore = useTraitFilterStore()
const { isAuthenticated } = useSupabaseAuth()

const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(
  bookmarkManagementStore
)

// 特征检测进度状态（已废弃，改为后台静默运行）
// const traitDetectionProgress = ref({
//   current: 0,
//   total: 0,
//   percentage: 0,
//   message: t('management_preparing_scan')
// })
// const showTraitDetectionProgress = ref(false)

// 应用更改相关状态
const showApplyConfirmDialog = ref(false)
const diffResult = ref<DiffResult | null>(null)
const applyStartTime = ref(0)

// AI 整理相关状态
const isOrganizing = ref(false)
const organizeProgress = ref({
  current: 0,
  total: 0,
  message: t('management_preparing_organize')
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
    return t('management_tooltip_page_loading')
  }

  // 2. 清理面板正在处理
  if (isCleanupLoading.value) {
    return t('management_tooltip_processing')
  }

  // 3. 没有未保存的更改
  if (!bookmarkManagementStore.hasUnsavedChanges) {
    return t('management_tooltip_no_changes')
  }

  // 4. 正常可用状态
  return t('management_tooltip_apply_ready')
})

/**
 * 动态生成"清除选择"按钮的 tooltip
 */
const clearSelectionTooltip = computed(() => {
  if (rightSelectedIds.value.length === 0) {
    return t('management_tooltip_no_selection')
  }
  return t('management_tooltip_clear_selection')
})

/**
 * 动态生成"删除"按钮的 tooltip
 */
const deleteButtonTooltip = computed(() => {
  if (
    selectedCounts.value.bookmarks === 0 &&
    selectedCounts.value.folders === 0
  ) {
    return t('management_tooltip_no_selection')
  }
  const parts = []
  if (selectedCounts.value.bookmarks > 0) {
    parts.push(`${selectedCounts.value.bookmarks} ${t('management_bookmarks_count')}`)
  }
  if (selectedCounts.value.folders > 0) {
    parts.push(`${selectedCounts.value.folders} ${t('management_folders_count')}`)
  }
  return t('management_tooltip_delete_selected', parts.join('和'))
})

/**
 * 动态生成"分享"按钮的 tooltip
 */
const shareButtonTooltip = computed(() => {
  if (rightSelectedIds.value.length === 0) {
    return '请先选择要分享的书签'
  }
  const bookmarkCount = selectedCounts.value.bookmarks
  if (bookmarkCount === 0) {
    return '只能分享书签，不能分享空文件夹'
  }
  if (bookmarkCount > 50) {
    return `已选 ${bookmarkCount} 个书签（建议不超过 50 个）`
  }
  return `分享 ${bookmarkCount} 个书签`
})

/**
 * 清理面板专用的加载状态
 * 与全局 isPageLoading 区分，避免左侧树等无关区域被蒙层阻塞
 */
const isCleanupLoading = computed(() => traitFilterStore.isDetecting ?? false)

/**
 * 自动更新特征标签（后台静默运行）
 * ✅ 不显示弹窗，用户无感知
 * ✅ 使用 Worker 在后台扫描，避免阻塞主线程
 */
const autoRefreshTraitTags = async () => {
  if (isCleanupLoading.value) return

  try {
    // ✅ 静默触发特征检测，不显示弹窗
    logger.info('Management', '开始后台特征检测（静默模式）')
    
    // 使用 Worker 扫描（不阻塞主线程）
    await traitFilterStore.startTraitDetection()

    logger.info('Management', '后台特征检测完成')
  } catch (error) {
    logger.error('Management', '后台特征检测失败', error)
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

const MSG_CANCEL_EDIT = t('management_cancel_edit_message')
const MSG_CANCEL_ADD = t('management_cancel_add_message')
const addDialogTitle = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark' ? t('management_add_new_bookmark') : t('management_add_new_folder')
)
const addDialogIcon = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark'
    ? 'icon-bookmark'
    : 'icon-folder'
)
const addConfirmText = computed(() => t('management_add'))

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

const pendingTagSelection = ref<TraitTag[] | null>(null)

const leftTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightSelectedIds = ref<string[]>([])

// ==================== 分享功能状态 ====================
const showShareDialog = ref(false)
const shareBookmarks = ref<BookmarkNode[]>([])
const shareType = ref<'favorites' | 'folder'>('favorites')
const shareFolderName = ref<string | undefined>(undefined)

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
      // 这是一个书签
      bookmarkIds.add(id)
    } else {
      // 这是一个文件夹
      // ✅ 修复：排除顶层根节点（书签栏、其他书签等）
      // Chrome 书签结构：'0' 是根容器，'1' 是书签栏，'2' 是其他书签
      // 只统计用户可见的子文件夹，不包括这些顶层容器
      const isTopLevelRoot = !node.parentId || node.parentId === '0' || node.id === '1' || node.id === '2'
      
      if (!isTopLevelRoot) {
        selectedFolderIds.add(id)
      }
      
      // 遍历该文件夹的所有子节点
      const stack: string[] = [id]
      while (stack.length > 0) {
        const currentId = stack.pop()!
        const current = rightTreeIndex.getNode(currentId)
        
        if (!current) continue
        
        if (current.url) {
          // 子节点是书签
          bookmarkIds.add(currentId)
        } else {
          // 子节点是文件夹
          // ✅ 所有子文件夹都应该被计入 selectedFolderIds（除了顶层根节点）
          if (currentId !== id) {
            const isChildTopLevelRoot = !current.parentId || current.parentId === '0' || current.id === '1' || current.id === '2'
            if (!isChildTopLevelRoot) {
              selectedFolderIds.add(currentId)
            }
          }
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
    // 清除待选中标签（已经应用筛选）
    pendingTagSelection.value = null
    
    // 使用 traitFilterStore 的 filterResultIds 获取筛选结果
    const ids = traitFilterStore.filterResultIds
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
 * 右侧面板：删除节点（仅内存操作）
 */
const handleRightNodeDelete = (node: BookmarkNode) => {
  const success = bookmarkManagementStore.deleteNodeFromProposal(node.id)

  if (!success) {
    console.error('删除提案树节点失败:', node.id)
  }
}

/**
 * 右侧面板：添加书签/文件夹（仅内存操作）
 */
const handleRightFolderAdd = (node: BookmarkNode) => {
  dialogStore.openAddItemDialog('bookmark', node)
}

/**
 * 检查 URL 是否为浏览器内部协议
 */
const isInternalProtocolUrl = (url: string): boolean => {
  if (!url) return false
  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.startsWith('chrome://') ||
    lowerUrl.startsWith('chrome-extension://') ||
    lowerUrl.startsWith('about:') ||
    lowerUrl.startsWith('file://') ||
    lowerUrl.startsWith('edge://') ||
    lowerUrl.startsWith('brave://')
  )
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (!node.url) {
    notificationService.notify(t('management_no_valid_url'), { level: 'warning' })
    return
  }

  // 检查是否为内部协议书签（优先检查标签，兜底检查 URL）
  const hasInternalTag = node.traitTags?.includes('internal')
  const isInternalUrl = isInternalProtocolUrl(node.url)
  
  if (hasInternalTag || isInternalUrl) {
    notificationService.notify(t('management_cannot_open_internal'), { level: 'warning' })
    logger.warn('Management', '尝试打开内部协议书签:', node.url)
    return
  }

  try {
    const newWindow = window.open(node.url, '_blank')
    
    // 检查是否被浏览器阻止
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      notificationService.notify(t('management_link_blocked'), { level: 'warning' })
      logger.warn('Management', '链接被浏览器阻止:', node.url)
    }
  } catch (error) {
    notificationService.notify(t('management_open_link_failed'), { level: 'error' })
    logger.error('Management', '打开链接失败:', error, node.url)
  }
}

const confirmAddNewItem = async () => {
  const title = (dialogStore.addItemDialog.title || '').trim()
  if (!title) {
    addFormErrors.value.title = t('management_title_required')
    return
  }
  if (dialogStore.addItemDialog.type === 'bookmark') {
    const url = (dialogStore.addItemDialog.url || '').trim()
    if (!DataValidator.validateUrl(url)) {
      addFormErrors.value.url = t('management_url_invalid')
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
    notificationService.notify(t('management_bookmark_added', itemType), { level: 'success' })
  } catch (error) {
    console.error('添加失败:', error)
    notificationService.notify(t('management_add_failed'), { level: 'error' })
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
    editFormErrors.value.title = t('management_title_required')
    return
  }
  const url = (dialogStore.editBookmarkDialog.url || '').trim()
  if (!DataValidator.validateUrl(url)) {
    editFormErrors.value.url = t('management_url_invalid')
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
    notificationService.notify(t('management_bookmark_updated'), { level: 'success' })
  } catch (error) {
    console.error('编辑书签失败:', error)
    notificationService.notify(t('management_edit_failed'), { level: 'error' })
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
    folderEditFormErrors.value.title = t('management_title_required')
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
    notificationService.notify(t('management_folder_updated'), { level: 'success' })
  } catch (error) {
    console.error('编辑文件夹失败:', error)
    notificationService.notify(t('management_edit_failed'), { level: 'error' })
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

      try {
        await deleteFolder(folder.id)
      } catch (error) {
        logger.error('Management', '删除文件夹失败', error)
        notificationService.notify(t('management_delete_failed'), { level: 'error' })
      } finally {
        isDeletingFolder.value = false
      }
    } catch (error) {
      logger.error('Management', '删除文件夹失败', error)
      notificationService.notify(t('management_delete_failed'), { level: 'error' })
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
    notificationService.notify(t('management_external_change_detected'), {
      level: 'info'
    })
  } catch (error) {
    logger.error('Management', '静默刷新失败', error)
    notificationService.notify(t('management_refresh_failed'), { level: 'error' })
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
  initializeStore()

  // 1. 从 session storage 读取初始筛选参数（优先级最高）
  let pendingTags: TraitTag[] = []
  try {
    const result = await chrome.storage.session.get('managementInitialFilter')
    if (result.managementInitialFilter) {
      const filter = result.managementInitialFilter as { tags?: string[]; timestamp?: number }
      const { tags, timestamp } = filter
      // 检查时间戳，避免使用过期的筛选状态（5秒内有效）
      if (tags && timestamp && Date.now() - timestamp < 5000) {
        pendingTags = tags.filter((tag: string): tag is TraitTag =>
          ['duplicate', 'invalid', 'internal'].includes(tag)
        )
        logger.info('Management', '从 session storage 读取筛选参数:', pendingTags)
        // 使用后立即清除，避免影响下次打开
        await chrome.storage.session.remove('managementInitialFilter')
      }
    }
  } catch (error) {
    logger.warn('Management', '读取 session storage 失败:', error)
  }

  // 2. 兜底：从 URL 参数读取（向后兼容）
  if (pendingTags.length === 0) {
    try {
      const params = new URLSearchParams(window.location.search)
      const tagsParam = params.get('tags')
      if (tagsParam) {
        pendingTags = tagsParam
          .split(',')
          .map(tag => tag.trim())
          .filter((tag): tag is TraitTag =>
            ['duplicate', 'invalid', 'internal'].includes(tag)
          )
        logger.info('Management', '从 URL 参数读取筛选:', pendingTags)
      }
    } catch (error) {
      logger.warn('Management', '解析 URL 参数失败:', error)
    }
  }

  // 3. 特征检测扫描完成后应用筛选
  autoRefreshTraitTags()
    .then(async () => {
      if (pendingTags.length > 0) {
        logger.info('Management', '✅ 特征检测扫描完成，准备激活筛选:', pendingTags)
        
        // 等待下一帧，确保 UI 已更新
        await nextTick()
        
        // 设置筛选状态（会触发 BookmarkSearchInput 的 watch）
        traitFilterStore.setActiveFilters(pendingTags)
        logger.info('Management', '✅ traitFilterStore.setActiveFilters 已调用')
        
        // 设置待选中的节点（用于自动选中问题节点）
        pendingTagSelection.value = pendingTags
        logger.info('Management', '✅ pendingTagSelection 已设置')
        
        // 再等待一帧，确保筛选已应用
        await nextTick()
        logger.info('Management', '✅ 筛选应该已经生效，当前 activeFilters:', traitFilterStore.activeFilters)
      }
    })
    .catch((error: unknown) => {
      logger.error('Management', '❌ 自动健康扫描失败', error)
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
      message: t('management_bookmark_moved'),
      key: 'bookmark-moved',
      duration: 2 // duration 单位为秒
    })
  } catch (error) {
    logger.error('Management', '移动书签失败', error)
    notification.error({
      message: t('management_move_failed'),
      description: t('management_move_failed_retry'),
      duration: 3 // duration 单位为秒
    })
  }
}

// ==================== 分享功能方法 ====================

/**
 * 分享功能的 loading 状态
 */
const isPreparingShare = ref(false)

/**
 * 处理分享选中的书签
 */
const handleShareSelected = async () => {
  // 防重复点击
  if (isPreparingShare.value) {
    return
  }

  // 检查登录状态
  if (!isAuthenticated.value) {
    notificationService.notify(
      '分享功能需要登录后使用，请先登录',
      { 
        level: 'warning',
        timeoutMs: 4000 // 使用 timeoutMs 而不是 duration
      }
    )
    logger.warn('Management', '⚠️ 用户未登录，无法使用分享功能')
    return
  }

  if (rightSelectedIds.value.length === 0) {
    notificationService.notify('请先选择要分享的书签', { level: 'warning' })
    return
  }

  // 开始准备分享
  isPreparingShare.value = true

  try {
    // 收集选中的书签（只收集书签，不包括文件夹）
    const bookmarks: BookmarkNode[] = []
    const processedIds = new Set<string>() // 防止重复收集
    
    for (const id of rightSelectedIds.value) {
      const node = rightTreeIndex.getNode(id)
      if (!node) continue
      
      if (node.url) {
        // 是书签，直接添加（检查是否已处理）
        if (!processedIds.has(node.id)) {
          bookmarks.push(node)
          processedIds.add(node.id)
        }
      } else {
        // 是文件夹，递归收集其中的书签
        const folderBookmarks = collectBookmarksFromNode(node)
        for (const bookmark of folderBookmarks) {
          if (!processedIds.has(bookmark.id)) {
            bookmarks.push(bookmark)
            processedIds.add(bookmark.id)
          }
        }
      }
    }

    if (bookmarks.length === 0) {
      notificationService.notify('选中的内容中没有书签', { level: 'warning' })
      return
    }

    logger.info('Management', `📤 准备分享 ${bookmarks.length} 个书签`)

    // 预检查：尝试编码数据，检查是否超出限制
    const encoded = shareService.encodeShareData(bookmarks)
    logger.info('Management', `✅ 数据大小检查通过（${encoded.length} 字符）`)
    
    // 检查 URL 长度（二维码限制）
    const shareUrl = shareService.generateShareUrl(encoded)
    if (shareUrl.length > 2000) {
      // URL 太长，二维码可能装不下
      const ratio = 2000 / shareUrl.length
      const suggestedCount = Math.floor(bookmarks.length * ratio * 0.9)
      
      notificationService.notify(
        `分享链接过长（${shareUrl.length} 字符），二维码可能无法生成\n` +
        `当前 ${bookmarks.length} 个书签，建议减少到 ${suggestedCount} 个以内`,
        { 
          level: 'warning',
          timeoutMs: 6000 // 使用 timeoutMs 而不是 duration
        }
      )
      logger.warn('Management', '⚠️ 分享链接过长，可能影响二维码生成', {
        urlLength: shareUrl.length,
        bookmarkCount: bookmarks.length,
        suggestedCount
      })
    }
    
    // 设置分享数据
    shareBookmarks.value = bookmarks
    shareType.value = 'favorites' // Management 页面的分享统一使用 'favorites' 类型
    shareFolderName.value = undefined
    
    // 打开分享弹窗
    showShareDialog.value = true
    
    logger.info('Management', '✅ 分享弹窗已打开')
  } catch (error) {
    // 处理所有错误（包括数据过大、编码失败等）
    if (error instanceof ShareError) {
      // ShareError 已经有友好的错误信息
      notificationService.notify(error.message, { 
        level: 'error',
        timeoutMs: 5000 // 使用 timeoutMs 而不是 duration
      })
      logger.error('Management', `❌ 分享准备失败: ${error.code}`, error)
    } else if (error instanceof Error) {
      // 其他错误
      notificationService.notify(error.message, { 
        level: 'error',
        timeoutMs: 5000 // 使用 timeoutMs 而不是 duration
      })
      logger.error('Management', '❌ 分享准备失败', error)
    } else {
      // 未知错误
      notificationService.notify('分享准备失败，请重试', { level: 'error' })
      logger.error('Management', '❌ 分享准备失败（未知错误）', error)
    }
  } finally {
    // 确保 loading 状态被清除（无论成功还是失败）
    isPreparingShare.value = false
  }
}

/**
 * 递归收集节点中的所有书签
 */
const collectBookmarksFromNode = (node: BookmarkNode): BookmarkNode[] => {
  const bookmarks: BookmarkNode[] = []
  
  if (!node.children) {
    return bookmarks
  }
  
  for (const child of node.children) {
    if (child.url) {
      // 是书签，添加到列表
      bookmarks.push(child)
    } else if (child.children) {
      // 是文件夹，递归收集
      bookmarks.push(...collectBookmarksFromNode(child))
    }
  }
  
  return bookmarks
}

/**
 * 处理分享完成
 */
const handleShareComplete = () => {
  logger.info('Management', '✅ 分享完成')
  // 关闭分享弹窗
  showShareDialog.value = false
  // 可选：清除选择
  // clearRightSelection()
}
/**
 * 批量删除选中的书签和文件夹
 * 
 * ✅ 直接执行删除，不需要确认对话框
 * 因为右侧面板的所有操作都需要点击"应用"才会真实生效
 * 应用时会有全面的确认提示
 */
const handleBulkDelete = async () => {
  const ids = rightSelectedIds.value.filter(Boolean)
  if (!ids.length) return

  if (isBulkDeleting.value) return // 防止重复点击

  try {
    isBulkDeleting.value = true

    bulkDeleteByIds(ids)
    
    // 清空选择，避免再次误删
    try {
      rightTreeRef.value?.clearSelection?.()
    } catch {}
  } catch (error) {
    logger.error('Management', '批量删除失败', error)
    notificationService.notify(t('management_bulk_delete_failed'), { level: 'error' })
  } finally {
    isBulkDeleting.value = false
  }
}

// ==================== 应用更改相关方法 ====================

/**
 * 确认对话框标题
 */
const applyConfirmTitle = computed(() => {
  if (!diffResult.value) return t('management_apply')

  const total = diffResult.value.statistics.total
  if (total < 100) {
    return t('management_confirm_apply_changes')
  } else if (total < 500) {
    return '⚠️ ' + t('management_confirm_apply_changes')
  } else {
    return '⚠️ ' + t('management_large_operation_warning')
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
    return t('management_calculating')
  }

  const elapsed = Date.now() - applyStartTime.value
  const avgTimePerOp = elapsed / progress.currentIndex
  const remaining = Math.ceil(
    ((progress.totalOperations - progress.currentIndex) * avgTimePerOp) / 1000
  )

  if (remaining < 60) {
    return t('management_about_seconds', String(remaining))
  } else {
    const minutes = Math.ceil(remaining / 60)
    return t('management_about_minutes', String(minutes))
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
      notificationService.notify(t('management_no_bookmarks_to_organize'), { level: 'info' })
      return
    }

    organizeProgress.value = {
      current: 0,
      total: bookmarkRecords.length,
      message: t('management_organizing_bookmarks', String(bookmarkRecords.length))
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
          traitTags: [],
          traitMetadata: [],
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
      t('management_organize_success', [String(bookmarkRecords.length), String(categories.length)]),
      'AI 整理'
    )
  } catch (error) {
    logger.error('AI 整理失败', error)
    notificationService.notifyError(t('management_organize_failed'), 'AI 整理')
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
        notificationService.notify(t('management_no_changes_detected'), {
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
    notificationService.notify(t('management_no_changes_detected'), { level: 'info' })
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
      notificationService.notify(t('management_all_changes_applied'), { level: 'success' })
    } else {
      notificationService.notify(
        t('management_some_changes_failed', String(result.errors.length)),
        { level: 'warning' }
      )
      logger.error('Management', '应用更改部分失败', result.errors)
    }

    // 清空差异结果
    diffResult.value = null
  } catch (error) {
    logger.error('Management', '应用更改失败', error)
    notificationService.notify(t('management_apply_changes_failed'), { level: 'error' })
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
/* 特征扫描进度对话框样式 */
.trait-scan-progress {
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
