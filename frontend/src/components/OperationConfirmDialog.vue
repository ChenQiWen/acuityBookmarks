<!--
操作确认对话框
展示即将应用的操作记录，支持手动操作和AI操作两种场景
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
// @ts-ignore - Used in template
import { Dialog, Button, Icon, Spacer } from './ui'
import {
  OperationSource,
  type OperationSession,
  type DiffResult
} from '../types/operation-record'

interface Props {
  show: boolean
  session: OperationSession | null
  diffResult: DiffResult | null
  isApplying?: boolean
  operationProgress?: {
    total: number
    completed: number
    currentOperation: string
    percentage: number
  }
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  isApplying: false,
  operationProgress: () => ({
    total: 0,
    completed: 0,
    currentOperation: '',
    percentage: 0
  })
})

const emit = defineEmits<Emits>()

// 计算属性
// @ts-ignore - Used in template
const isAIOperation = computed(
  () => props.session?.source === OperationSource.AI
)

// @ts-ignore - Used in template
const operationRecords = computed(() => {
  // 如果有 diffResult，使用 diffResult 的数据
  if (props.diffResult) {
    const operations: Array<{
      type: 'delete' | 'create' | 'move' | 'update'
      icon: string
      color: string
      text: string
      count: number
    }> = []

    // 从 diffResult 的真实数据解析操作
    if (props.diffResult.hasChanges && props.diffResult.summary) {
      const { summary } = props.diffResult

      // 只显示有实际变更的操作类型
      if (summary.deleted > 0) {
        operations.push({
          type: 'delete',
          icon: 'mdi-delete-outline',
          color: 'error',
          text: '删除项目',
          count: summary.deleted
        })
      }

      if (summary.created > 0) {
        operations.push({
          type: 'create',
          icon: 'mdi-plus',
          color: 'success',
          text: '创建新项目',
          count: summary.created
        })
      }

      if (summary.moved > 0) {
        operations.push({
          type: 'move',
          icon: 'mdi-cursor-move',
          color: 'warning',
          text: '移动重排序',
          count: summary.moved
        })
      }

      if (summary.updated > 0) {
        operations.push({
          type: 'update',
          icon: 'mdi-pencil',
          color: 'info',
          text: '更新标题/URL',
          count: summary.updated
        })
      }
    }

    return operations.filter(op => op.count > 0)
  }

  // 如果没有真实数据且有 session，显示通用操作提示
  if (props.session) {
    return [
      {
        type: 'update' as const,
        icon: 'mdi-sync',
        color: 'primary',
        text: '同步书签结构变更',
        count: 1
      }
    ]
  }

  // 完全没有数据时，返回空数组
  return []
})

// @ts-ignore - Used in template
const activeTab = ref('overview')

// @ts-ignore - Used in template
const detailedOperations = computed(() => {
  if (!props.diffResult?.operations) {
    return {
      deleteBookmarks: [],
      deleteFolders: [],
      createBookmarks: [],
      createFolders: [],
      updateBookmarkTitle: [],
      updateBookmarkUrl: [],
      updateFolderTitle: [],
      moveOperations: []
    }
  }

  const result = {
    deleteBookmarks: [] as Array<{ title: string; url?: string }>,
    deleteFolders: [] as Array<{ title: string; childrenCount: number }>,
    createBookmarks: [] as Array<{ title: string; url: string }>,
    createFolders: [] as Array<{ title: string }>,
    updateBookmarkTitle: [] as Array<{
      oldTitle: string
      newTitle: string
      url: string
    }>,
    updateBookmarkUrl: [] as Array<{
      title: string
      oldUrl: string
      newUrl: string
    }>,
    updateFolderTitle: [] as Array<{ oldTitle: string; newTitle: string }>,
    moveOperations: [] as Array<{ title: string; from: string; to: string }>
  }

  // 解析操作记录 (目前使用模拟数据，实际需要根据真实数据结构调整)
  if (props.diffResult.operations) {
    props.diffResult.operations.forEach((op: any) => {
      switch (op.type) {
        case 'DELETE':
          if (op.nodeType === 'bookmark') {
            result.deleteBookmarks.push({
              title: op.data?.node?.title || '未知书签',
              url: op.data?.node?.url
            })
          } else {
            result.deleteFolders.push({
              title: op.data?.node?.title || '未知文件夹',
              childrenCount: op.data?.childrenCount || 0
            })
          }
          break

        case 'CREATE':
          if (op.nodeType === 'bookmark') {
            result.createBookmarks.push({
              title: op.data?.node?.title || '新书签',
              url: op.data?.node?.url || ''
            })
          } else {
            result.createFolders.push({
              title: op.data?.node?.title || '新文件夹'
            })
          }
          break

        case 'UPDATE':
          if (op.data?.changes) {
            op.data.changes.forEach((change: any) => {
              if (change.field === 'title') {
                if (op.nodeType === 'bookmark') {
                  result.updateBookmarkTitle.push({
                    oldTitle: change.oldValue,
                    newTitle: change.newValue,
                    url: op.data?.node?.url || ''
                  })
                } else {
                  result.updateFolderTitle.push({
                    oldTitle: change.oldValue,
                    newTitle: change.newValue
                  })
                }
              } else if (change.field === 'url') {
                result.updateBookmarkUrl.push({
                  title: op.data?.node?.title || '',
                  oldUrl: change.oldValue,
                  newUrl: change.newValue
                })
              }
            })
          }
          break

        case 'MOVE':
          result.moveOperations.push({
            title: op.data?.node?.title || '未知项目',
            from: `位置 ${op.data?.from?.index || 0}`,
            to: `位置 ${op.data?.to?.index || 0}`
          })
          break
      }
    })
  }

  return result
})

// @ts-ignore - Used in template
const availableTabs = computed(() => {
  const tabs = [
    { key: 'overview', label: '总览', count: operationRecords.value.length }
  ]

  const details = detailedOperations.value
  if (details.deleteBookmarks.length > 0) {
    tabs.push({
      key: 'delete-bookmarks',
      label: '删除书签',
      count: details.deleteBookmarks.length
    })
  }
  if (details.deleteFolders.length > 0) {
    tabs.push({
      key: 'delete-folders',
      label: '删除文件夹',
      count: details.deleteFolders.length
    })
  }
  if (details.createBookmarks.length > 0) {
    tabs.push({
      key: 'create-bookmarks',
      label: '创建书签',
      count: details.createBookmarks.length
    })
  }
  if (details.createFolders.length > 0) {
    tabs.push({
      key: 'create-folders',
      label: '创建文件夹',
      count: details.createFolders.length
    })
  }
  if (details.updateBookmarkTitle.length > 0) {
    tabs.push({
      key: 'update-bookmark-title',
      label: '修改书签名称',
      count: details.updateBookmarkTitle.length
    })
  }
  if (details.updateBookmarkUrl.length > 0) {
    tabs.push({
      key: 'update-bookmark-url',
      label: '修改书签URL',
      count: details.updateBookmarkUrl.length
    })
  }
  if (details.updateFolderTitle.length > 0) {
    tabs.push({
      key: 'update-folder-title',
      label: '修改文件夹名称',
      count: details.updateFolderTitle.length
    })
  }
  if (details.moveOperations.length > 0) {
    tabs.push({
      key: 'move-operations',
      label: '移动操作',
      count: details.moveOperations.length
    })
  }

  return tabs
})

// @ts-ignore - Used in template
const totalOperations = computed(() => {
  return operationRecords.value.reduce((sum, op) => sum + op.count, 0)
})

// 方法
// @ts-ignore - Used in template
const handleConfirm = () => {
  emit('confirm')
}

// @ts-ignore - Used in template
const handleCancel = () => {
  emit('update:show', false)
  emit('cancel')
}
</script>

<template>
  <Dialog
    :show="show"
    persistent
    minWidth="600px"
    enterToConfirm
    @update:show="emit('update:show', $event)"
    @confirm="handleConfirm"
  >
    <template #header>
      <div class="custom-header">
        <Icon v-if="isAIOperation" name="mdi-robot" color="primary" size="md" />
        <Icon v-else name="mdi-account-edit" color="primary" size="md" />
        <span>{{ isAIOperation ? 'AI智能重组确认' : '确认应用更改' }}</span>
      </div>
    </template>

    <div class="operation-content">
      <div class="explanation">
        <Icon name="mdi-information" color="info" size="sm" />
        <span>
          {{
            isAIOperation
              ? '当前右侧面板显示的是AI重新设计的全新书签结构。将完全替换您现有的书签目录结构。'
              : '检测到书签结构变更，将应用这些更改到您的Chrome书签。'
          }}
        </span>
      </div>

      <div class="execution-info">
        <div v-if="isAIOperation">
          🔄 执行方式: 全量重建 (删除原有 → 构建新结构)
        </div>
        <div v-else>✅ 将使用增量修改方式精确应用这些更改</div>

        <div v-if="isAIOperation">⏱️ 预计耗时: 30-60秒 (取决于书签数量)</div>
        <div v-else>⚡ 预计耗时: 2-15秒</div>

        <div v-if="isAIOperation">
          💡 提示: 如需微调结构，建议应用后再进行手动调整
        </div>
      </div>

      <!-- 操作记录显示 (确认前显示) -->
      <div
        v-if="!isApplying && operationRecords.length > 0"
        class="operations-section"
      >
        <div class="operations-header">
          <Icon name="mdi-format-list-bulleted" color="primary" size="sm" />
          <span class="operations-title">将要执行的操作</span>
        </div>

        <!-- Tab 切换面板 -->
        <div class="operations-tabs">
          <div class="tab-buttons">
            <button
              v-for="tab in availableTabs"
              :key="tab.key"
              class="tab-button"
              :class="[{ active: activeTab === tab.key }]"
              @click="activeTab = tab.key"
            >
              <span class="tab-label">{{ tab.label }}</span>
              <span class="tab-count">{{ tab.count }}</span>
            </button>
          </div>

          <!-- 总览 Tab -->
          <div v-if="activeTab === 'overview'" class="tab-content">
            <div class="operations-list">
              <div
                v-for="operation in operationRecords"
                :key="operation.type"
                class="operation-item"
                :class="operation.type"
              >
                <Icon
                  :name="operation.icon"
                  :color="operation.color"
                  size="sm"
                />
                <span class="operation-text">{{ operation.text }}</span>
                <span class="operation-count">{{ operation.count }}项</span>
              </div>
            </div>
          </div>

          <!-- 删除书签 Tab -->
          <div v-if="activeTab === 'delete-bookmarks'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.deleteBookmarks"
                :key="index"
                class="detail-item delete"
              >
                <Icon name="mdi-bookmark-outline" color="error" size="sm" />
                <div class="detail-content">
                  <div class="detail-title">{{ item.title }}</div>
                  <div v-if="item.url" class="detail-url">{{ item.url }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 删除文件夹 Tab -->
          <div v-if="activeTab === 'delete-folders'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.deleteFolders"
                :key="index"
                class="detail-item delete"
              >
                <Icon name="mdi-folder-outline" color="error" size="sm" />
                <div class="detail-content">
                  <div class="detail-title">{{ item.title }}</div>
                  <div class="detail-meta">
                    包含 {{ item.childrenCount }} 个子项
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 创建书签 Tab -->
          <div v-if="activeTab === 'create-bookmarks'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.createBookmarks"
                :key="index"
                class="detail-item create"
              >
                <Icon
                  name="mdi-bookmark-plus-outline"
                  color="success"
                  size="sm"
                />
                <div class="detail-content">
                  <div class="detail-title">{{ item.title }}</div>
                  <div class="detail-url">{{ item.url }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 创建文件夹 Tab -->
          <div v-if="activeTab === 'create-folders'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.createFolders"
                :key="index"
                class="detail-item create"
              >
                <Icon
                  name="mdi-folder-plus-outline"
                  color="success"
                  size="sm"
                />
                <div class="detail-content">
                  <div class="detail-title">{{ item.title }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 修改书签名称 Tab -->
          <div v-if="activeTab === 'update-bookmark-title'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.updateBookmarkTitle"
                :key="index"
                class="detail-item update"
              >
                <Icon name="mdi-pencil" color="info" size="sm" />
                <div class="detail-content">
                  <div class="detail-change">
                    <span class="old-value">{{ item.oldTitle }}</span>
                    <Icon name="mdi-arrow-right" color="muted" size="xs" />
                    <span class="new-value">{{ item.newTitle }}</span>
                  </div>
                  <div class="detail-url">{{ item.url }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 修改书签URL Tab -->
          <div v-if="activeTab === 'update-bookmark-url'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.updateBookmarkUrl"
                :key="index"
                class="detail-item update"
              >
                <Icon name="mdi-link-variant" color="info" size="sm" />
                <div class="detail-content">
                  <div class="detail-title">{{ item.title }}</div>
                  <div class="detail-change">
                    <span class="old-value">{{ item.oldUrl }}</span>
                    <Icon name="mdi-arrow-right" color="muted" size="xs" />
                    <span class="new-value">{{ item.newUrl }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 修改文件夹名称 Tab -->
          <div v-if="activeTab === 'update-folder-title'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.updateFolderTitle"
                :key="index"
                class="detail-item update"
              >
                <Icon name="mdi-folder-edit-outline" color="info" size="sm" />
                <div class="detail-content">
                  <div class="detail-change">
                    <span class="old-value">{{ item.oldTitle }}</span>
                    <Icon name="mdi-arrow-right" color="muted" size="xs" />
                    <span class="new-value">{{ item.newTitle }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 移动操作 Tab -->
          <div v-if="activeTab === 'move-operations'" class="tab-content">
            <div class="detail-list">
              <div
                v-for="(item, index) in detailedOperations.moveOperations"
                :key="index"
                class="detail-item move"
              >
                <Icon name="mdi-cursor-move" color="warning" size="sm" />
                <div class="detail-content">
                  <div class="detail-title">{{ item.title }}</div>
                  <div class="detail-change">
                    <span class="old-value">{{ item.from }}</span>
                    <Icon name="mdi-arrow-right" color="muted" size="xs" />
                    <span class="new-value">{{ item.to }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="operations-summary">
          <Icon name="mdi-calculator" color="primary" size="sm" />
          <span>总计：{{ totalOperations }}项操作</span>
        </div>
      </div>

      <!-- 进度条显示 (只在应用过程中显示) -->
      <div
        v-if="isApplying && operationProgress.total > 0"
        class="progress-section"
      >
        <div class="progress-header">
          <Icon name="mdi-cog" color="primary" size="sm" class="spinning" />
          <span class="progress-title">正在应用操作...</span>
          <span class="progress-percentage"
            >{{ operationProgress.percentage }}%</span
          >
        </div>

        <div class="progress-bar-container">
          <div
            class="progress-bar"
            :style="`width: ${operationProgress.percentage}%`"
          ></div>
        </div>

        <div class="progress-details">
          <div class="current-operation">
            {{ operationProgress.currentOperation }}
          </div>
          <div class="operation-count">
            {{ operationProgress.completed }} /
            {{ operationProgress.total }} 操作已完成
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <Button variant="text" :disabled="isApplying" @click="handleCancel">
        取消
      </Button>

      <Spacer />

      <Button color="primary" :loading="isApplying" @click="handleConfirm">
        {{ isApplying ? '应用中...' : '确认应用' }}
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
.operation-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.explanation,
.warning {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.explanation {
  background-color: var(--color-info-container);
  border-left: 4px solid var(--color-info);
}

.warning {
  background-color: var(--color-warning-container);
  border-left: 4px solid var(--color-warning);
}

.execution-info {
  padding: var(--spacing-md);
  background-color: var(--color-surface-variant);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.execution-info div {
  margin-bottom: var(--spacing-xs);
}

.execution-info div:last-child {
  margin-bottom: 0;
}

.operations-section {
  padding: var(--spacing-lg);
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-outline-variant);
}

.operations-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.operations-title {
  font-weight: 500;
  color: var(--color-on-surface);
  font-size: var(--text-md);
}

.operations-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.operation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant);
}

.operation-item.delete {
  border-left: 3px solid var(--color-error);
}

.operation-item.create {
  border-left: 3px solid var(--color-success);
}

.operation-item.move {
  border-left: 3px solid var(--color-warning);
}

.operation-item.update {
  border-left: 3px solid var(--color-info);
}

.operation-text {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-on-surface);
}

.operation-count {
  font-size: var(--text-xs);
  color: var(--color-on-surface-variant);
  font-weight: 500;
  background-color: var(--color-outline-variant);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.operations-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-primary-container);
  border-radius: var(--radius-sm);
  font-weight: 500;
  color: var(--color-on-primary-container);
}

/* Tab 切换面板样式 */
.operations-tabs {
  margin-bottom: var(--spacing-md);
}

.tab-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-xs);
  background-color: var(--color-surface-container);
  border-radius: var(--radius-md);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: var(--text-sm);
  font-weight: 500;
}

.tab-button:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.tab-button.active {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-label {
  white-space: nowrap;
}

.tab-count {
  font-size: var(--text-xs);
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  min-width: 20px;
  text-align: center;
}

.tab-button.active .tab-count {
  background-color: rgba(255, 255, 255, 0.3);
}

.tab-content {
  min-height: 120px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 详细操作列表样式 */
.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant);
  border-left: 3px solid transparent;
}

.detail-item.delete {
  border-left-color: var(--color-error);
  background-color: rgba(var(--color-error-rgb), 0.05);
}

.detail-item.create {
  border-left-color: var(--color-success);
  background-color: rgba(var(--color-success-rgb), 0.05);
}

.detail-item.update {
  border-left-color: var(--color-info);
  background-color: rgba(var(--color-info-rgb), 0.05);
}

.detail-item.move {
  border-left-color: var(--color-warning);
  background-color: rgba(var(--color-warning-rgb), 0.05);
}

.detail-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.detail-title {
  font-weight: 500;
  color: var(--color-on-surface);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.detail-url {
  font-size: var(--text-xs);
  color: var(--color-on-surface-variant);
  word-break: break-all;
  line-height: 1.3;
}

.detail-meta {
  font-size: var(--text-xs);
  color: var(--color-on-surface-variant);
  font-style: italic;
}

.detail-change {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  font-size: var(--text-xs);
}

.old-value {
  color: var(--color-error);
  background-color: rgba(var(--color-error-rgb), 0.1);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  word-break: break-all;
}

.new-value {
  color: var(--color-success);
  background-color: rgba(var(--color-success-rgb), 0.1);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  word-break: break-all;
}

.progress-section {
  padding: var(--spacing-lg);
  background-color: var(--color-primary-container);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-primary);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.progress-title {
  font-weight: 500;
  color: var(--color-on-primary-container);
  flex: 1;
  margin-left: var(--spacing-xs);
}

.progress-percentage {
  font-weight: 600;
  color: var(--color-primary);
  font-size: var(--text-lg);
}

.progress-bar-container {
  width: 100%;
  height: var(--spacing-sm);
  background-color: var(--color-surface-variant);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--spacing-md);
}

.progress-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-primary) 0%,
    var(--color-secondary) 100%
  );
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.current-operation {
  font-size: var(--text-sm);
  color: var(--color-on-primary-container);
  font-weight: 500;
}

.operation-count {
  font-size: var(--text-xs);
  color: var(--color-on-surface-variant);
}

.spinning {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
