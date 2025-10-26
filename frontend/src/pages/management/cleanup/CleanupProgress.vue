<script setup lang="ts">
import { computed, defineOptions } from 'vue'

defineOptions({
  name: 'CleanupProgress'
})
import { useCleanupStore } from '@/stores/cleanup/cleanup-store'
import { Button, Dialog, Icon, ProgressBar, Spacer } from '@/components'
import type { CleanupTask } from '@/types/domain/cleanup'

// === 使用新的 Cleanup Store ===
const cleanupStore = useCleanupStore()

// 任务类型配置
const taskConfigs = {
  '404': {
    label: '检测404链接',
    icon: 'icon-link-off',
    color: '#f44336'
  },
  duplicate: {
    label: '查找重复书签',
    icon: 'icon-duplicate',
    color: '#ff9800'
  },
  empty: {
    label: '扫描空文件夹',
    icon: 'icon-folder-outline',
    color: '#2196f3'
  },
  invalid: {
    label: '验证URL格式',
    icon: 'icon-open-link-off',
    color: '#9c27b0'
  }
}

// 计算任务进度数据
/**
 * 计算并装饰每个清理任务的进度信息。
 *
 * - 当未选择任何筛选标签时，默认展示全部任务，避免出现空白内容。
 * - 任务可读性字段（颜色、图标、状态标记）统一在此处计算，保证 UI 边界收敛。
 */
const taskProgress = computed(() => {
  const tasks = cleanupStore.cleanupState?.tasks ?? []
  if (tasks.length === 0) return []

  const activeFilters = cleanupStore.cleanupState?.activeFilters ?? []
  const shouldFilter = activeFilters.length > 0

  return tasks
    .filter((task: CleanupTask) =>
      shouldFilter
        ? activeFilters.includes(task.type as CleanupTask['type'])
        : true
    )
    .map((task: CleanupTask) => {
      const config = taskConfigs[task.type as keyof typeof taskConfigs]
      const percentage =
        task.total > 0 ? Math.round((task.processed / task.total) * 100) : 0

      return {
        ...task,
        ...config,
        percentage,
        isCompleted: task.status === 'completed',
        isRunning: task.status === 'running',
        isPending: task.status === 'pending',
        hasError: task.status === 'error'
      }
    })
})

// 计算总体进度
/**
 * 计算总体进度，若当前无任务则返回 0%，用于避免头部进度条闪烁。
 */
const overallProgress = computed(() => {
  if (!taskProgress.value.length) return 0

  const totalPercentage = taskProgress.value.reduce(
    (sum: number, task: { percentage: number }) => sum + task.percentage,
    0
  )
  return Math.round(totalPercentage / taskProgress.value.length)
})

// 格式化进度文本
const getProgressText = (task: {
  hasError?: boolean
  isCompleted?: boolean
  isPending?: boolean
  total: number
  processed: number
}) => {
  if (task.hasError) return '出错'
  if (task.isCompleted) return '完成'
  if (task.isPending) return '等待中'
  if (task.total === 0) return '准备中...'
  return `${task.processed}/${task.total}`
}

// 处理取消操作
const handleCancel = () => {
  // 取消清理扫描
  cleanupStore.cleanupState.isScanning = false
}
</script>

<template>
  <!-- 扫描进度对话框 -->
  <Dialog
    :show="cleanupStore.cleanupState?.isScanning ?? false"
    minWidth="500px"
    maxWidth="700px"
    title="正在扫描书签问题"
    icon="icon-radar"
    iconColor="primary"
  >
    <template #header-actions>
      <div class="overall-progress">
        <ProgressBar :value="overallProgress" :max="100" :height="6" />
        <span class="overall-progress__text">{{ overallProgress }}%</span>
      </div>
    </template>

    <!-- 任务进度列表 -->
    <div
      v-for="task in taskProgress"
      :key="task.type"
      class="task-progress-item"
    >
      <div class="task-header">
        <Icon
          :name="
            task.isCompleted
              ? 'icon-check-circle'
              : task.hasError
                ? 'icon-alert-circle'
                : task.isRunning
                  ? 'icon-loading'
                  : task.icon
          "
          :color="
            task.isCompleted ? 'success' : task.hasError ? 'error' : 'primary'
          "
          size="md"
          :class="{ spinning: task.isRunning }"
        />

        <div class="task-info">
          <div class="task-label">{{ task.label }}</div>
          <div class="task-status">
            {{ getProgressText(task) }}
            <span
              v-if="task.estimatedTime && task.isRunning"
              class="estimated-time"
            >
              预计剩余: {{ task.estimatedTime }}
            </span>
          </div>
        </div>

        <div class="task-percentage">{{ task.percentage }}%</div>
      </div>

      <ProgressBar
        :value="task.percentage"
        :max="100"
        :height="4"
        :color="
          task.isCompleted ? 'success' : task.hasError ? 'error' : 'primary'
        "
      />
    </div>

    <!-- 扫描状态说明 -->
    <div v-if="taskProgress.length > 0" class="scan-status">
      <div class="status-alert" :class="{ success: overallProgress === 100 }">
        <Icon
          :name="
            overallProgress === 100 ? 'icon-check-circle' : 'icon-information'
          "
          :color="overallProgress === 100 ? 'success' : 'info'"
          size="sm"
        />

        <span v-if="overallProgress === 100">
          扫描完成！共发现
          {{
            taskProgress.reduce(
              (sum: number, task: { foundIssues?: number }) =>
                sum + (task.foundIssues || 0),
              0
            )
          }}
          个问题
        </span>
        <span v-else> 正在扫描您的书签，请稍候... </span>
      </div>
    </div>

    <template #actions>
      <Spacer />

      <!-- 取消按钮 -->
      <Button v-if="overallProgress < 100" variant="text" @click="handleCancel">
        取消扫描
      </Button>

      <!-- 完成按钮 -->
      <Button
        v-else
        color="primary"
        @click="() => (cleanupStore.cleanupState.isScanning = false)"
      >
        查看结果
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
/* 总体进度 */
.overall-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 120px;
}

.overall-progress__text {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* 任务进度项 */
.task-progress-item {
  margin-bottom: var(--spacing-lg);
}

.task-progress-item:last-child {
  margin-bottom: 0;
}

.task-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-label {
  font-weight: var(--font-weight-medium);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.task-status {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-tight);
  margin-top: var(--spacing-xs);
}

.estimated-time {
  margin-left: var(--spacing-sm);
  color: var(--color-text-tertiary);
}

.task-percentage {
  font-weight: var(--font-weight-medium);
  font-size: var(--text-xs);
  color: var(--color-text-primary);
  flex-shrink: 0;
}

/* 扫描状态提示 */
.scan-status {
  margin-top: var(--spacing-lg);
}

.status-alert {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background-color: var(--color-info-container);
  border: 1px solid var(--color-info);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.status-alert.success {
  background-color: var(--color-success-container);
  border-color: var(--color-success);
  color: var(--color-text-primary);
}

/* 旋转动画 */
.spinning {
  animation: spin 1s linear infinite;
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
