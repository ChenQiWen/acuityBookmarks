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
          <kbd class="keyboard-hint">ESC</kbd>
        </Button>
        <Button color="primary" @click="confirmApplyChanges">
          确认应用
          <kbd class="keyboard-hint">⏎</kbd>
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
                    <!-- 
                     健康度筛选已内置在组件中，可通过以下 props 控制：
                     :enable-health-filters="true"  - 启用健康度筛选标签（默认）
                     :enable-health-filters="false" - 禁用健康度筛选标签
                     :show-quick-filters="false"    - 隐藏所有快捷标签
                   -->
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
                  :selected-desc-counts="new Map()"
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
                        :title="'一键整理书签栏，使用 AI 自动分类书签'"
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
                  :show-favorite-button="true"
                  :show-edit-button="true"
                  :show-delete-button="true"
                  :show-add-button="true"
                  :show-open-new-tab-button="true"
                  :show-copy-url-button="true"
                  @request-clear-filters="cleanupStore.clearFilters()"
                  @node-edit="handleRightNodeEdit"
                  @node-delete="handleRightNodeDelete"
                  @folder-add="handleRightFolderAdd"
                  @selection-change="onRightSelectionChange"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
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

    <Toast
      v-model:show="snackbar.show"
      :text="snackbar.text"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    />

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
          <kbd class="keyboard-hint">ESC</kbd>
        </Button>
        <Button
          color="primary"
          :disabled="!isEditDirty"
          @click="confirmEditBookmark"
        >
          更新
          <kbd class="keyboard-hint">⏎</kbd>
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
          <kbd class="keyboard-hint">ESC</kbd>
        </Button>
        <Button color="error" @click="confirmBulkDeleteSelected">
          确认删除
          <kbd class="keyboard-hint">⏎</kbd>
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
          <kbd class="keyboard-hint">ESC</kbd>
        </Button>
        <Button
          color="primary"
          :disabled="!isEditFolderDirty"
          @click="confirmEditFolder"
        >
          更新
          <kbd class="keyboard-hint">⏎</kbd>
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
          <kbd class="keyboard-hint">ESC</kbd>
        </Button>
        <Button color="error" @click="confirmDeleteFolder">
          确认删除
          <kbd class="keyboard-hint">⏎</kbd>
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
        />
        <!-- ✅ 添加 Transition 实现 tab 切换动画 -->
        <TransitionGroup
          name="tab-slide"
          mode="out-in"
          tag="div"
          class="form-fields"
        >
          <Input
            key="title"
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
            key="url"
            v-model="dialogStore.addItemDialog.url"
            label="链接地址"
            variant="outlined"
            density="compact"
            class="form-field"
            :error="!!addFormErrors.url"
            :error-message="addFormErrors.url"
          />
        </TransitionGroup>
      </div>
      <template #actions="{ requestClose }">
        <Button variant="text" @click="requestClose(false)">
          取消
          <kbd class="keyboard-hint">ESC</kbd>
        </Button>
        <Button color="primary" @click="confirmAddNewItem">
          {{ addConfirmText }}
          <kbd class="keyboard-hint">⏎</kbd>
        </Button>
      </template>
    </ConfirmableDialog>

    <!-- External Update Prompt (不可取消) -->
    <Dialog
      :show="showUpdatePrompt"
      title="⚠️ 检测到外部书签变更"
      icon="icon-sync"
      :persistent="true"
      :close-on-overlay="false"
      :esc-to-close="false"
      :enter-to-confirm="false"
      :hide-close="true"
      :cancelable="false"
      max-width="520px"
      min-width="520px"
    >
      <div class="update-prompt-content">
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 12px">
          {{ updatePromptMessage }}
        </p>
        <div
          style="
            margin-top: 16px;
            padding: 12px;
            background: var(--color-warning-surface, #fff3cd);
            border-left: 4px solid var(--color-warning, #ffc107);
            border-radius: 4px;
          "
        >
          <strong style="color: var(--color-warning-text, #856404)"
            >⚠️ 注意：</strong
          >
          <span
            style="color: var(--color-warning-text, #856404); font-size: 13px"
          >
            您必须刷新数据才能继续操作，以避免数据冲突。
          </span>
        </div>
      </div>
      <template #actions>
        <Button
          variant="primary"
          color="primary"
          size="lg"
          @click="confirmExternalUpdate"
        >
          <Icon name="icon-refresh" />
          <span>立即刷新页面</span>
          <kbd class="keyboard-hint">⏎</kbd>
        </Button>
      </template>
    </Dialog>
  </App>
</template>

<script setup lang="ts">
import { schedulerService } from '@/application/scheduler/scheduler-service'
import {
  computed,
  defineOptions,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch
} from 'vue'

defineOptions({
  name: 'ManagementPage'
})
import { storeToRefs } from 'pinia'
// useManagementStore 已迁移到新的专业化 Store
import {
  useDialogStore,
  useBookmarkManagementStore,
  useCleanupStore,
  useUIStore
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
  Toast,
  UrlInput,
  Checkbox
} from '@/components'
import { AB_EVENTS } from '@/constants/events'
import { notificationService } from '@/application/notification/notification-service'
import { ConfirmableDialog } from '@/components'
import { onEvent } from '@/infrastructure/events/event-bus'
import BookmarkTree from '@/components/composite/BookmarkTree/BookmarkTree.vue'
import { useEventListener } from '@vueuse/core'
import { queryWorkerAdapter } from '@/services/query-worker-adapter'
// 导入现代书签服务：以 side-effect 方式初始化并设置事件监听与消息桥接
import '@/services/modern-bookmark-service'
import { DataValidator } from '@/core/common/store-error'
import { useBookmarkStore } from '@/stores/bookmarkStore'
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

// managementStore 已迁移到新的专业化 Store
const dialogStore = useDialogStore()
const bookmarkManagementStore = useBookmarkManagementStore()
const cleanupStore = useCleanupStore()

// UI 状态从 UIStore 获取
const uiStore = useUIStore()
const { snackbar } = storeToRefs(uiStore)

// 书签树展开状态从 BookmarkManagementStore 获取
const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(
  bookmarkManagementStore
)

// 清理状态从新的 CleanupStore 获取
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

/**
 * ♿ 动态生成"应用"按钮的 tooltip 提示文字
 *
 * 作用：让用户明确了解按钮为何被禁用
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
 * ♿ 动态生成"清除选择"按钮的 tooltip
 */
const clearSelectionTooltip = computed(() => {
  if (rightSelectedIds.value.length === 0) {
    return '💡 提示：当前没有选中任何书签\n\n请先勾选需要操作的书签或文件夹'
  }
  return '清除所有选中状态'
})

/**
 * ♿ 动态生成"删除"按钮的 tooltip
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
 * 点击健康同步时的封装处理：使用 Worker 避免阻塞 UI
 */
const handleCleanupRefreshClick = async () => {
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

    // 使用 Worker 版本扫描（不阻塞主线程）
    await cleanupStore.startHealthScanWorker({
      onProgress: (progress: HealthScanProgress) => {
        healthScanProgress.value = progress
      }
    })

    // 完成
    uiStore.showSuccess('健康度扫描完成')
  } catch (error) {
    logger.error('Management', '刷新健康标签失败', error)
    uiStore.showError('刷新健康标签失败，请稍后重试')
  } finally {
    showHealthScanProgress.value = false
  }
}

// 书签管理状态从新的 BookmarkManagementStore 获取
const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
  storeToRefs(bookmarkManagementStore)

// ✅ SimpleBookmarkTree 必需的 props（纯 UI 组件）
// 这些值由组件内部维护，父组件只需提供空容器
const rightTreeSelectedDescCounts = shallowRef(new Map<string, number>())

const {
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor,
  initialize: initializeStore,
  deleteFolder,
  bulkDeleteByIds,
  setProposalTree
} = bookmarkManagementStore

// 📌 搜索状态
// 左侧面板（我的书签）搜索结果
const leftSearchResults = ref<BookmarkNode[]>([])
const isLeftSearchActive = ref(false)

// 右侧面板（整理建议）搜索结果
const rightSearchResults = ref<BookmarkNode[]>([])
const isRightSearchActive = ref(false)

// 搜索处理函数
const handleLeftSearch = async (results: BookmarkNode[]) => {
  leftSearchResults.value = results
  // ✅ 只要收到搜索结果（不管是否为空），都设置为激活状态
  // 区分"搜索无结果"和"清空搜索"的关键在于 search-clear 事件
  isLeftSearchActive.value = true

  if (results.length > 0) {
    // 🔍 有筛选结果：自动展开所有文件夹，方便用户查看匹配的书签
    await nextTick()
    leftTreeRef.value?.expandAll?.()
    // ✅ 同步更新展开/收起按钮的状态
    leftExpandAll.value = true
  } else {
    // 🔍 搜索但无结果：显示空状态
    leftTreeRef.value?.collapseAll?.()
    leftExpandAll.value = false
  }
}

// 清空搜索时重置为非激活状态
const handleLeftSearchClear = () => {
  isLeftSearchActive.value = false
  leftSearchResults.value = []
  leftTreeRef.value?.collapseAll?.()
  leftExpandAll.value = false
}

const handleRightSearch = async (results: BookmarkNode[]) => {
  rightSearchResults.value = results
  // ✅ 只要收到搜索结果（不管是否为空），都设置为激活状态
  isRightSearchActive.value = true

  if (results.length > 0) {
    // 🔍 有筛选结果：自动展开所有文件夹，方便用户查看匹配的书签
    await nextTick()
    rightTreeRef.value?.expandAll?.()
    // ✅ 同步更新展开/收起按钮的状态
    rightExpandAll.value = true
  } else {
    // 🔍 搜索但无结果：显示空状态
    rightTreeRef.value?.collapseAll?.()
    rightExpandAll.value = false
  }
}

// 清空搜索时重置为非激活状态
const handleRightSearchClear = () => {
  isRightSearchActive.value = false
  rightSearchResults.value = []
  rightTreeRef.value?.collapseAll?.()
  rightExpandAll.value = false
}

// 计算属性：左侧树的数据源（搜索结果 or 原始树）
const leftTreeData = computed(() =>
  isLeftSearchActive.value ? leftSearchResults.value : originalTree.value
)

// 计算属性：右侧树的数据源（搜索结果 or 原始建议树）
// ✅ 修复：统一由 BookmarkSearchInput 处理筛选逻辑，避免重复筛选
const rightTreeData = computed(() =>
  isRightSearchActive.value
    ? rightSearchResults.value
    : newProposalTree.value.children || []
)

// 统一的确认文案（减少重复与便于维护）
const MSG_CANCEL_EDIT = '您有更改尚未保存，确定取消并丢弃更改吗？'
const MSG_CANCEL_ADD = '您有更改尚未添加，确定取消并丢弃输入吗？'

// === 添加新项目对话框：标题/图标随 Tab，但底部按钮固定文案 ===
const addDialogTitle = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark' ? '添加新书签' : '添加新文件夹'
)
const addDialogIcon = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark'
    ? 'icon-bookmark'
    : 'icon-folder'
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

// 🔔 外部变更更新提示
const showUpdatePrompt = ref(false)
const pendingUpdateDetail = ref<Record<string, unknown> | null>(null)
const pendingTagSelection = ref<HealthTag[] | null>(null)
const updatePromptMessage = ref(
  '其他浏览器窗口或外部工具已修改了书签数据。为了避免数据冲突和丢失更改，您当前页面的数据已过期，必须立即刷新到最新版本。'
)
// 📊 同步进度状态由全局 GlobalSyncProgress 组件管理

// ✅ 页面打开时间戳（用于过滤初始化误触发）
const pageOpenTime = Date.now()

// 一键展开/收起 - 状态与引用
const leftTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
// 组件化后不再直接引用内部 input 元素
const rightSelectedIds = ref<string[]>([])
// 批量删除确认弹窗开关
const isConfirmBulkDeleteDialogOpen = ref(false)

// 当前显示的数据索引：只包含 rightTreeData 中的节点（用于选择计数）
const rightTreeDataIndex = computed(() => {
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
    walk(rightTreeData.value)
  } catch {}
  return map
})

// 已选择计数（文件夹=包含其下所有书签），去重
// ✅ 只统计当前显示的数据（rightTreeData）范围内的选中项
const selectedCounts = computed(() => {
  const bookmarkIds = new Set<string>()
  const selectedFolderIds = new Set<string>()

  // ✅ 构建当前显示数据的节点集合（用于限制递归范围）
  const visibleNodeIds = new Set<string>()
  const buildVisibleSet = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      if (!node || !node.id) continue
      visibleNodeIds.add(String(node.id))
      if (node.children && node.children.length) {
        buildVisibleSet(node.children)
      }
    }
  }
  buildVisibleSet(rightTreeData.value)

  // ✅ 递归计算文件夹下的书签数量（只计算当前显示的数据范围内的）
  const addBookmarksUnder = (node: BookmarkNode) => {
    if (!node) return
    if (node.url) {
      // ✅ 只统计在当前显示数据范围内的书签
      if (visibleNodeIds.has(String(node.id))) {
        bookmarkIds.add(String(node.id))
      }
      return
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) {
        // ✅ 只处理当前显示数据范围内的子节点
        if (visibleNodeIds.has(String(c.id))) {
          addBookmarksUnder(c)
        }
      }
    }
  }

  // ✅ 只统计当前显示的数据范围内的选中项
  for (const rawId of rightSelectedIds.value) {
    const id = String(rawId)
    // ✅ 跳过不在当前显示数据范围内的选中项
    if (!visibleNodeIds.has(id)) continue

    const node = rightTreeDataIndex.value.get(id)
    if (!node) continue

    if (node.url) {
      bookmarkIds.add(id)
    } else {
      selectedFolderIds.add(id)
      addBookmarksUnder(node)
    }
  }

  return { bookmarks: bookmarkIds.size, folders: selectedFolderIds.size }
})

// ✨ 监听未保存更改，更新徽章提示
watch(
  () => bookmarkManagementStore.hasUnsavedChanges,
  hasChanges => {
    if (hasChanges) {
      // 有未保存更改：显示徽章
      notificationService.updateBadge('!', '#faad14')
    } else {
      // 无未保存更改：清除徽章
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

// ✅ 监听右侧面板书签树数据变化，自动清除选择状态
// 这样无论是什么原因导致数据变化（搜索、筛选、切换视图等），都会自动重置选择
watch(
  () => rightTreeData.value,
  () => {
    clearRightSelection()
  },
  { deep: true }
)

// 展开/收起搜索并自动聚焦到输入框；同时让按钮失焦，避免出现聚焦边框
// 切换逻辑由 PanelInlineSearch 内部托管

// 防止并发触发导致状态错乱或视觉异常（如蒙层显得加深）
const isExpanding = ref(false)
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

// 组件就绪：仅在原始树已有数据时解除加载态，避免空数据时过早隐藏蒙层
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

// ✅ 删除动画状态：正在执行删除动画的节点 ID 集合
const deletingNodeIds = ref<Set<string>>(new Set())

// ==================== 右侧面板（仅内存操作） ====================

/**
 * 右侧面板：编辑节点（仅内存）
 * ✅ 打开编辑对话框，让用户修改标题/URL
 */
const handleRightNodeEdit = (node: BookmarkNode) => {
  // 判断节点类型：文件夹还是书签
  if (node.url) {
    // 书签：打开书签编辑对话框
    dialogStore.openEditBookmarkDialog(node)
  } else {
    // 文件夹：打开文件夹编辑对话框
    dialogStore.openEditFolderDialog(node)
  }
}

/**
 * 递归收集文件夹的所有子节点 ID（包括所有层级的子节点）
 * @param node 要删除的节点
 * @param treeData 完整的树数据（用于查找节点）
 * @returns 所有子节点的 ID 数组（包括节点本身）
 */
const collectAllDescendantIds = (
  node: BookmarkNode,
  treeData: BookmarkNode[] = rightTreeData.value
): string[] => {
  const ids: string[] = []

  // 递归查找节点并收集所有子节点
  const findAndCollect = (nodes: BookmarkNode[]): void => {
    for (const n of nodes) {
      if (n.id === node.id) {
        // 找到目标节点，收集所有子节点
        const collectChildren = (child: BookmarkNode): void => {
          ids.push(child.id)
          if (child.children && child.children.length > 0) {
            for (const c of child.children) {
              collectChildren(c)
            }
          }
        }

        if (n.children && n.children.length > 0) {
          for (const child of n.children) {
            collectChildren(child)
          }
        }
        return
      }
      if (n.children && n.children.length > 0) {
        findAndCollect(n.children)
      }
    }
  }

  findAndCollect(treeData)
  return ids
}

/**
 * 批量更新删除节点集合（性能优化：减少响应式更新）
 * @param ids 要添加或删除的节点 ID 数组
 * @param add 是否添加（true）或删除（false）
 */
const batchUpdateDeletingNodes = (ids: string[], add: boolean) => {
  if (ids.length === 0) return

  // ✅ 批量更新：创建新 Set，一次性更新，减少响应式触发次数
  const newSet = new Set(deletingNodeIds.value)
  if (add) {
    ids.forEach(id => newSet.add(id))
  } else {
    ids.forEach(id => newSet.delete(id))
  }
  deletingNodeIds.value = newSet
}

/**
 * 右侧面板：删除节点（仅内存）
 * ✅ 添加离场动画：从左往右消失
 * ✅ 如果是文件夹，所有子节点也会一起执行删除动画
 * ✅ 性能优化：批量更新 Set，减少响应式更新
 */
const handleRightNodeDelete = (node: BookmarkNode) => {
  // 1️⃣ 收集所有需要删除的节点 ID
  const nodeIdsToDelete: string[] = [node.id]

  // ✅ 如果是文件夹，收集所有子节点
  if (!node.url && node.children && node.children.length > 0) {
    const descendantIds = collectAllDescendantIds(node)
    nodeIdsToDelete.push(...descendantIds)
  }

  // 2️⃣ 批量将所有节点添加到删除动画集合，触发 CSS 动画
  batchUpdateDeletingNodes(nodeIdsToDelete, true)

  // 3️⃣ 等待动画完成后再真正删除节点
  setTimeout(() => {
    // ✅ 删除文件夹时，只需要删除文件夹本身，子节点会一起被删除
    const success = bookmarkManagementStore.deleteNodeFromProposal(node.id)

    if (!success) {
      console.error('删除提案树节点失败:', node.id)
    }

    // 4️⃣ 批量从删除集合中移除所有节点
    batchUpdateDeletingNodes(nodeIdsToDelete, false)
  }, 400) // 动画时长 300ms + 100ms 缓冲
}

/**
 * 右侧面板：添加书签/文件夹（仅内存）
 */
const handleRightFolderAdd = (node: BookmarkNode) => {
  // ✅ 打开添加对话框，默认显示书签 tab
  dialogStore.openAddItemDialog('bookmark', node)
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
  try {
    // ✅ 先保存类型信息（关闭对话框后会重置）
    const itemType =
      dialogStore.addItemDialog.type === 'bookmark' ? '书签' : '文件夹'

    // 添加新书签
    const res = await bookmarkManagementStore.addBookmark({
      type: dialogStore.addItemDialog.type,
      title: dialogStore.addItemDialog.title,
      url: dialogStore.addItemDialog.url,
      parentId: dialogStore.addItemDialog.parentFolder?.id
    })

    // ✅ 添加成功后关闭对话框
    dialogStore.closeAddItemDialog()

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

    // ✅ 最后显示成功通知（避免与其他操作的通知冲突）
    await nextTick()
    notificationService.notify(`${itemType}已添加`, { level: 'success' })
  } catch (error) {
    console.error('添加失败:', error)
    notificationService.notify('添加失败，请重试', { level: 'error' })
  }
}

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

const confirmEditBookmark = async () => {
  // 未发生更改则不提交
  if (!isEditDirty.value) {
    dialogStore.closeEditBookmarkDialog()
    return
  }
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

  try {
    await bookmarkManagementStore.editBookmark({
      id: dialogStore.editBookmarkDialog.bookmark!.id,
      title: dialogStore.editBookmarkDialog.title,
      url: dialogStore.editBookmarkDialog.url,
      parentId: dialogStore.editBookmarkDialog.parentId
    })

    // ✅ 编辑成功后关闭对话框
    dialogStore.closeEditBookmarkDialog()

    // ✅ 显示成功通知
    await nextTick()
    notificationService.notify('书签已更新', { level: 'success' })
  } catch (error) {
    console.error('编辑书签失败:', error)
    notificationService.notify('编辑失败，请重试', { level: 'error' })
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

  try {
    await bookmarkManagementStore.editBookmark({
      id: dialogStore.editFolderDialog.folder!.id,
      title: dialogStore.editFolderDialog.title,
      url: '', // 文件夹没有 URL
      parentId: undefined
    })

    // ✅ 编辑成功后关闭对话框
    dialogStore.closeEditFolderDialog()

    // ✅ 显示成功通知
    await nextTick()
    notificationService.notify('文件夹已更新', { level: 'success' })
  } catch (error) {
    console.error('编辑文件夹失败:', error)
    notificationService.notify('编辑失败，请重试', { level: 'error' })
  }
}

// 取消与关闭逻辑已由 ConfirmableDialog 统一处理

// 统一关闭确认由 ConfirmableDialog 托管

// === 删除确认对话框：确认与取消 ===
const confirmDeleteFolder = () => {
  if (deleteTargetFolder.value) {
    const folder = deleteTargetFolder.value

    // ✅ 收集所有子节点 ID（包括文件夹本身）
    const nodeIdsToDelete: string[] = [folder.id]
    const descendantIds = collectAllDescendantIds(folder)
    nodeIdsToDelete.push(...descendantIds)

    // ✅ 批量将所有节点添加到删除动画集合，触发 CSS 动画
    batchUpdateDeletingNodes(nodeIdsToDelete, true)

    // ✅ 等待动画完成后执行删除
    setTimeout(async () => {
      try {
        await deleteFolder(folder.id)
      } catch (error) {
        logger.error('Management', '删除文件夹失败', error)
        notificationService.notify('删除失败，请重试', { level: 'error' })
      } finally {
        // ✅ 批量从删除集合中移除所有节点
        batchUpdateDeletingNodes(nodeIdsToDelete, false)
      }
    }, 400) // 动画时长 300ms + 100ms 缓冲
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
 * 处理收藏/取消收藏书签
 */
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
    const bookmarkStore = useBookmarkStore()
    const success = isFavorite
      ? await favoriteAppService.addToFavorites(node.id)
      : await favoriteAppService.removeFromFavorites(node.id)

    if (success) {
      notificationService.notify(isFavorite ? `书签已收藏` : `书签已取消收藏`, {
        level: 'success'
      })
      // 刷新书签树以更新 UI
      await bookmarkStore.loadFromIndexedDB()
    } else {
      notificationService.notify('操作失败，请重试', { level: 'error' })
    }
  } catch (error) {
    logger.error('Component', 'Management', '❌ 切换收藏状态失败:', error)
    notificationService.notify('操作失败，请重试', { level: 'error' })
  }
}

// 键盘行为统一由 Dialog 组件处理（Enter=confirm，Esc=close）

// === 精细化更新辅助函数 ===
// ⚠️ 已移除：现在统一使用弹窗提醒用户手动刷新，而不是自动执行精细化更新
// 原有的 refreshSingleBookmark、updateSingleBookmark、removeSingleBookmark 函数已删除

/**
 * 处理数据同步事件
 *
 * 🆕 使用 Event Bus 替代直接监听 Chrome 消息
 *
 * 后台已完成 IndexedDB 同步时的快速刷新：
 * 根据事件类型执行精细化或全量更新
 */
const handleDbSynced = async (data: {
  eventType:
    | 'created'
    | 'changed'
    | 'moved'
    | 'removed'
    | 'full-sync'
    | 'incremental'
    | string
  bookmarkId?: string
  timestamp: number
}) => {
  // 0️⃣ ✅ 忽略后台自动同步事件（非真正的外部变更）
  if (data.eventType === 'full-sync' || data.eventType === 'incremental') {
    logger.debug(
      'Management',
      `忽略后台自动同步事件: ${data.eventType}（非外部变更）`
    )
    return
  }

  // 1️⃣ 如果正在应用自己的更改，忽略
  if (bookmarkManagementStore.isApplyingOwnChanges) {
    logger.info('Management', '检测到自己触发的变更，忽略（不弹窗）', data)
    return
  }

  // 2️⃣ 如果页面正在加载中，忽略（可能是初始化事件）
  if (isPageLoading.value) {
    logger.info('Management', '页面加载中，忽略同步事件（不弹窗）', data)
    return
  }

  // 3️⃣ 如果弹窗已显示，忽略重复事件
  if (showUpdatePrompt.value) {
    logger.info('Management', '弹窗已显示，忽略重复事件', data)
    return
  }

  // 4️⃣ 防抖：页面打开后的前 5 秒内忽略事件（防止初始化/Service Worker 重启误触发）
  const timeSinceOpen = Date.now() - pageOpenTime
  if (timeSinceOpen < 5000) {
    logger.info(
      'Management',
      `页面打开不足 5 秒 (${timeSinceOpen}ms)，忽略事件（防止初始化误触发）`,
      data
    )
    return
  }

  // ✅ 真正的外部变更：弹窗提醒用户手动刷新
  logger.warn('Management', '✅ 检测到外部书签变更，弹窗提示用户', data)
  pendingUpdateDetail.value = data
  showUpdatePrompt.value = true
}

/**
 * 🆕 使用 Event Bus 监听数据同步事件
 *
 * 在组件设置阶段订阅事件，确保生命周期钩子在同步代码中注册
 */
const unsubscribeDbSynced = onEvent('data:synced', handleDbSynced)

/**
 * 组件卸载时清理监听器
 *
 * 注意：
 * - useEventListener 会自动清理 window 事件监听器
 * - useTimeoutFn 会自动清理定时器
 * - 只需手动清理 Event Bus 订阅
 */
onUnmounted(() => {
  // 🆕 清理 Event Bus 订阅
  unsubscribeDbSynced()

  // 📊 全局进度订阅由 GlobalSyncProgress 管理，无需手动清理

  // 暂存更改保护已迁移到 BookmarkManagementStore
  // bookmarkManagementStore.detachUnsavedChangesGuard()
})

onMounted(async () => {
  // 📊 同步进度由全局 GlobalSyncProgress 组件管理，无需本地订阅

  // 首先进行数据健康检查，确保数据完整性
  await checkOnPageLoad({ autoRecover: true, showNotification: false })

  initializeStore()

  // 解析来自 Popup 的搜索参数
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

  // 后台静默扫描健康度（使用 Worker，不阻塞 UI）
  // 如果有待处理的标签，等待扫描完成后再激活筛选
  cleanupStore
    .startHealthScanWorker()
    .then(() => {
      console.log('[Management] 健康扫描完成，检查待处理标签:', pendingTags)
      // ✅ 健康扫描完成后，如果有待处理的标签，激活筛选
      if (pendingTags.length > 0) {
        console.log('[Management] 激活筛选:', pendingTags)
        cleanupStore.setActiveFilters(pendingTags)
        pendingTagSelection.value = pendingTags
      }
    })
    .catch((error: unknown) => {
      logger.error('Management', '后台健康扫描失败', error)
    })

  // 未保存更改离开提醒
  // 暂存更改保护已迁移到 BookmarkManagementStore
  // bookmarkManagementStore.attachUnsavedChangesGuard()

  // ✅ 实时同步：监听来自后台/书签API的变更事件
  const handleBookmarkUpdated = (evt: Event) => {
    const detail = (evt as CustomEvent)?.detail ?? {}

    // 1️⃣ 如果正在应用自己的更改，忽略
    if (bookmarkManagementStore.isApplyingOwnChanges) {
      logger.info('Management', '检测到自己触发的变更，忽略（不弹窗）', detail)
      return
    }

    // 2️⃣ 如果页面正在加载中，忽略
    if (isPageLoading.value) {
      logger.info('Management', '页面加载中，忽略更新事件（不弹窗）', detail)
      return
    }

    // 3️⃣ 如果弹窗已显示，忽略重复事件
    if (showUpdatePrompt.value) {
      logger.info('Management', '弹窗已显示，忽略重复事件', detail)
      return
    }

    // 4️⃣ 防抖：页面打开后的前 5 秒内忽略事件
    const timeSinceOpen = Date.now() - pageOpenTime
    if (timeSinceOpen < 5000) {
      logger.info(
        'Management',
        `页面打开不足 5 秒 (${timeSinceOpen}ms)，忽略事件（防止初始化误触发）`,
        detail
      )
      return
    }

    // ✅ 真正的外部变更：弹窗提醒用户手动刷新
    logger.warn('Management', '✅ 检测到外部书签变更，弹窗提示用户', detail)
    pendingUpdateDetail.value = detail
    showUpdatePrompt.value = true
  }

  /**
   * 🆕 使用 VueUse useEventListener 替代 window.addEventListener
   *
   * 优势：自动清理、更简洁的 API
   */
  useEventListener(
    window,
    AB_EVENTS.BOOKMARK_UPDATED,
    handleBookmarkUpdated as (e: Event) => void
  )

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

// 清空选择：调用树组件 API，状态通过 selection-change 事件自动同步
const clearRightSelection = () => {
  try {
    rightTreeRef.value?.clearSelection?.()
    // ✅ 状态通过 selection-change 事件自动同步，无需手动设置
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

// ✅ 统计右侧树数据中的实际书签和文件夹数量（用于调试和验证）
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

// ✅ 调试：监控右侧树数据统计（帮助排查数量不一致问题）
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

// 获取右侧树所有节点 ID（只返回当前显示的数据，不包括隐藏的节点）
const getAllRightTreeNodeIds = (): string[] => {
  const allIds: string[] = []
  // ✅ 使用 rightTreeData，它已经根据筛选条件返回了当前显示的数据
  // - 如果有搜索：返回 rightSearchResults.value（筛选后的结果）
  // - 如果没有搜索：返回 newProposalTree.value.children（完整数据）
  const nodes = rightTreeData.value

  const collectIds = (nodeList: BookmarkNode[]) => {
    for (const node of nodeList) {
      if (node.id) {
        allIds.push(String(node.id))
      }
      // ✅ 递归收集子节点，确保选择所有当前显示的数据
      if (node.children && node.children.length > 0) {
        collectIds(node.children)
      }
    }
  }

  collectIds(nodes)
  return allIds
}

// 全选/取消全选切换
const toggleRightSelectAll = (checked: boolean) => {
  if (checked) {
    // 全选
    const allIds = getAllRightTreeNodeIds()
    rightTreeRef.value?.selectNodesByIds?.(allIds, { append: false })
    // ✅ 全选后自动展开所有文件夹，方便用户确认选中内容（与搜索时的行为保持一致）
    nextTick(() => {
      rightTreeRef.value?.expandAll?.()
      rightExpandAll.value = true
    })
  } else {
    // 取消全选：显式传递空数组，确保所有节点（包括文件夹）都被取消选中
    rightTreeRef.value?.selectNodesByIds?.([], { append: false })
    // ✅ 状态通过 selection-change 事件自动同步，无需手动设置
  }
}

// 📣 更新提示动作（用户确认后刷新页面数据）
const confirmExternalUpdate = async () => {
  try {
    showUpdatePrompt.value = false
    // 重新初始化 Store（内部会通过 Application Service 初始化 IndexedDB）
    await initializeStore()
    // 同步刷新搜索索引（Worker）
    try {
      await queryWorkerAdapter.initFromIDB()
    } catch {}
    // ✅ 只在完成后显示一次通知，避免闪烁
    notificationService.notify('数据已更新', { level: 'success' })
    // 清理待处理的更新数据
    pendingUpdateDetail.value = null
  } catch (e) {
    console.error('confirmExternalUpdate error:', e)
    notificationService.notify('更新失败', { level: 'error' })
  }
}

// 处理书签拖拽移动
const handleBookmarkMove = async (data: {
  sourceId: string
  targetId: string
  position: 'before' | 'inside' | 'after'
}) => {
  logger.info('Management', '拖拽移动书签', data)

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

    notificationService.notify('书签已移动', { level: 'success' })
  } catch (error) {
    logger.error('Management', '移动书签失败', error)
    notificationService.notify('移动失败，请重试', { level: 'error' })
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
        // ✅ 如果有爬虫元数据，一起发送（提高分类准确率，token 增加不多）
        ...(record.hasMetadata &&
          record.metaDescriptionLower && {
            metaDescription: record.metaDescriptionLower, // 使用小写版本（已存在）
            metaKeywords: record.metaKeywordsTokens?.slice(0, 5) // 只取前 5 个关键词
          })
      }))
    )

    // 创建 BookmarkRecord ID 到分类的映射
    const recordIdToCategory = new Map<string, string>()
    for (const result of results) {
      recordIdToCategory.set(result.id, result.category || '其他')
    }

    // ✅ 关键：保留原始 BookmarkRecord 的所有字段，只根据分类结果调整层级结构
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
      // 使用第一个已有记录作为模板（如果存在），否则创建最小完整记录
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

    // 3. ✅ 将书签分配到对应分类，保留原始 BookmarkRecord 的所有字段，只更新层级相关字段
    for (const record of bookmarkRecords) {
      const category = recordIdToCategory.get(String(record.id)) || '其他'
      const bookmarks = categoryBookmarks.get(category)!

      // ✅ 保留原始记录的所有字段，只更新 parentId、index 和路径相关字段
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
        // ✅ 修复：如果实际没有差异，重置标志位，禁用按钮
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
    // ✅ 修复：如果实际没有差异，重置标志位，禁用按钮
    bookmarkManagementStore.hasUnsavedChanges = false
    notificationService.notify('没有检测到任何更改', { level: 'info' })
    return
  }

  diffResult.value = diff
  showApplyConfirmDialog.value = true
}

/**
 * 获取临时节点信息
 */
const getTempNodesInfo = (
  nodes: BookmarkNode[]
): { count: number; ids: string[] } => {
  const info = { count: 0, ids: [] as string[] }

  const traverse = (nodeList: BookmarkNode[]) => {
    for (const node of nodeList) {
      if (node.id.startsWith('temp_')) {
        info.count++
        info.ids.push(node.id)
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }

  traverse(nodes)
  return info
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
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
}

/* 应用更改对话框样式 */
.apply-confirm-dialog {
  padding: var(--spacing-4);
  max-height: 60vh;
  overflow-y: auto;
}

.ai-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: var(--color-primary-surface, rgba(25, 118, 210, 0.08));
  border-left: 4px solid var(--color-primary);
  border-radius: 4px;
  margin-bottom: var(--spacing-4);
  font-size: var(--font-size-body-medium);
  color: var(--color-primary);
  font-weight: 500;
}

.statistics-section {
  margin-bottom: var(--spacing-4);
}

.section-title {
  font-size: var(--font-size-body-large);
  font-weight: 600;
  margin-bottom: var(--spacing-3);
  color: var(--color-text-primary);
}

.statistics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-3);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-3);
  background: var(--color-surface-variant);
  border-radius: 8px;
}

.stat-item.total {
  background: var(--color-primary-surface, rgba(25, 118, 210, 0.12));
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
  overflow-y: auto;
  border: 1px solid var(--color-outline);
  border-radius: 8px;
  padding: var(--spacing-2);
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
  font-size: var(--font-size-body-small);
  font-weight: 500;
  min-width: 48px;
}

.operation-title {
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grouped-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.summary-group {
  border: 1px solid var(--color-outline);
  border-radius: 8px;
  padding: var(--spacing-3);
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
  margin-top: var(--spacing-3);
  padding-left: var(--spacing-6);
  max-height: 200px;
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
  color: var(--color-text-tertiary);
  font-style: italic;
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
  font-size: var(--font-size-body-medium);
  color: var(--color-text-secondary);
  margin: 0;
}

.warning-text {
  color: var(--color-warning) !important;
  font-weight: 500 !important;
}

.apply-progress {
  padding: var(--spacing-4);
}

.progress-tip {
  margin-top: var(--spacing-3);
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
  text-align: center;
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
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  background: var(--color-surface);
  padding: var(--spacing-2) var(--spacing-3);
}
/* 选择统计：避免数字变化导致文本整体"抖动" */
.selection-summary {
  font-weight: 600;
  display: inline-flex;
  align-items: center; /* 让 Checkbox 与文字垂直居中对齐 */
  gap: var(--spacing-2);
  /* 消除模板空白带来的字符间距 */
  font-size: 0;
  /* ✅ 强化：防止点击时文本被选中（多浏览器兼容） */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.select-all-checkbox {
  flex-shrink: 0;
  /* ✅ 增加点击区域，减少误触文本 */
  padding: var(--spacing-2);
  margin: calc(var(--spacing-2) * -1);
  /* ✅ 确保点击事件不穿透到文本 */
  position: relative;
  z-index: 1;
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
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

/* 左侧面板：增加视觉权重，使用更深的背景 */
.panel-col:first-child .panel-card {
  flex: 1.2;
  background: var(--color-bg-primary);
}

/* 右侧卡片：弱化背景，突出内容 */
.right-panel-card {
  overflow: hidden;
  flex: 1;
  background: var(--color-bg-secondary);
}

.panel-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  position: relative; /* 作为浮层定位参照 */
  overflow: visible; /* 放行浮层 */
  flex-wrap: nowrap; /* 防止按钮换行 */
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
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: nowrap;
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
  flex: 1;
  min-height: 0; /* 允许内部子元素计算高度，避免超出无法滚动 */
  display: flex;
  flex-direction: column;
  /* 使左右面板内容可滚动（包含 legend 和树） */
  overflow-y: auto;
}

/* 中间分隔区样式 */
.divider-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.panel-divider {
  display: flex;
  align-items: center;
  justify-content: center;
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
  padding-left: var(--spacing-3);
  padding-right: var(--spacing-3);
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
  position: relative;
  overflow: hidden;
}

/* ✅ Tab 切换滑动动画 */
.tab-slide-enter-active,
.tab-slide-leave-active {
  transition: all 0.3s ease;
}

.tab-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.tab-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.tab-slide-move {
  transition: transform 0.3s ease;
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
