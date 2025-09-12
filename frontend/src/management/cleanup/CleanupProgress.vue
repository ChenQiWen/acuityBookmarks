<script setup lang="ts">
import { computed } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'
import { Dialog, Button, Icon, Spacer } from '../../components/ui'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

// 解构清理相关状态
const { cleanupState } = storeToRefs(managementStore)

// 任务类型配置
const taskConfigs = {
  '404': {
    label: '检测404链接',
    icon: 'mdi-link-off',
    color: '#f44336'
  },
  duplicate: {
    label: '查找重复书签', 
    icon: 'mdi-content-duplicate',
    color: '#ff9800'
  },
  empty: {
    label: '扫描空文件夹',
    icon: 'mdi-folder-outline', 
    color: '#2196f3'
  },
  invalid: {
    label: '验证URL格式',
    icon: 'mdi-alert-circle',
    color: '#9c27b0'
  }
}

// 计算任务进度数据
const taskProgress = computed(() => {
  if (!cleanupState.value?.tasks) return []

  return cleanupState.value.tasks
    .filter(task => cleanupState.value?.activeFilters?.includes(task.type))
    .map(task => {
      const config = taskConfigs[task.type as keyof typeof taskConfigs]
      const percentage = task.total > 0 ? Math.round((task.processed / task.total) * 100) : 0
      
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
const overallProgress = computed(() => {
  if (!taskProgress.value.length) return 0
  
  const totalPercentage = taskProgress.value.reduce((sum, task) => sum + task.percentage, 0)
  return Math.round(totalPercentage / taskProgress.value.length)
})

// 格式化进度文本
const getProgressText = (task: any) => {
  if (task.hasError) return '出错'
  if (task.isCompleted) return '完成'
  if (task.isPending) return '等待中'
  if (task.total === 0) return '准备中...'
  return `${task.processed}/${task.total}`
}

// 处理取消操作
const handleCancel = () => {
  managementStore.cancelCleanupScan()
}
</script>

<template>
  <!-- 扫描进度对话框 -->
  <Dialog 
    :show="cleanupState?.isScanning ?? false" 
    persistent 
    max-width="500px"
    title="正在扫描书签问题"
    icon="mdi-radar"
    icon-color="primary"
  >
    <template #header-actions>
      <!-- 总体进度环形进度条 -->
      <div class="circular-progress">
        <svg class="progress-ring" width="32" height="32">
          <circle
            class="progress-ring-circle-bg"
            stroke="var(--color-border)"
            stroke-width="3"
            fill="transparent"
            r="13"
            cx="16"
            cy="16"
          />
          <circle
            class="progress-ring-circle"
            :stroke="overallProgress === 100 ? 'var(--color-success)' : 'var(--color-primary)'"
            stroke-width="3"
            fill="transparent"
            r="13"
            cx="16"
            cy="16"
            :stroke-dasharray="`${2 * Math.PI * 13}`"
            :stroke-dashoffset="`${2 * Math.PI * 13 * (1 - overallProgress / 100)}`"
          />
        </svg>
        <span class="progress-text">{{ overallProgress }}%</span>
      </div>
    </template>

    <!-- 任务进度列表 -->
    <div v-for="task in taskProgress" :key="task.type" class="task-progress-item">
      <div class="task-header">
        <Icon 
          :name="task.isCompleted ? 'mdi-check-circle' : task.hasError ? 'mdi-alert-circle' : task.isRunning ? 'mdi-loading' : task.icon"
          :color="task.isCompleted ? 'success' : task.hasError ? 'error' : 'primary'"
          size="md"
          :class="{ 'spinning': task.isRunning }"
        />
        
        <div class="task-info">
          <div class="task-label">{{ task.label }}</div>
          <div class="task-status">
            {{ getProgressText(task) }}
            <span v-if="task.estimatedTime && task.isRunning" class="estimated-time">
              预计剩余: {{ task.estimatedTime }}
            </span>
          </div>
        </div>
        
        <div class="task-percentage">
          {{ task.percentage }}%
        </div>
      </div>
      
      <!-- 自定义进度条 -->
      <div class="progress-bar">
        <div 
          class="progress-fill"
          :style="{ 
            width: task.percentage + '%',
            backgroundColor: task.isCompleted ? 'var(--color-success)' : task.hasError ? 'var(--color-error)' : 'var(--color-primary)'
          }"
        ></div>
      </div>
    </div>

    <!-- 扫描状态说明 -->
    <div v-if="taskProgress.length > 0" class="scan-status">
      <div class="status-alert" :class="{ 'success': overallProgress === 100 }">
        <Icon 
          :name="overallProgress === 100 ? 'mdi-check-circle' : 'mdi-information'"
          :color="overallProgress === 100 ? 'success' : 'info'"
          size="sm"
        />
        
        <span v-if="overallProgress === 100">
          扫描完成！共发现 {{ taskProgress.reduce((sum, task) => sum + (task.foundIssues || 0), 0) }} 个问题
        </span>
        <span v-else>
          正在扫描您的书签，请稍候...
        </span>
      </div>
    </div>

    <template #actions>
      <Spacer />
      
      <!-- 取消按钮 -->
      <Button
        v-if="overallProgress < 100"
        variant="text"
        @click="handleCancel"
      >
        取消扫描
      </Button>
      
      <!-- 完成按钮 -->
      <Button
        v-else
        color="primary"
        @click="managementStore.completeCleanupScan"
      >
        查看结果
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
/* 圆形进度条 */
.circular-progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.3s ease-in-out;
}

.progress-text {
  position: absolute;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
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

/* 自定义进度条 */
.progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease-in-out;
  border-radius: var(--radius-full);
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
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
