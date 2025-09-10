<script setup lang="ts">
import { computed } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'

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
  <v-dialog 
    :model-value="cleanupState?.isScanning ?? false" 
    persistent 
    max-width="500"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon start>mdi-radar</v-icon>
        正在扫描书签问题
        
        <v-spacer />
        
        <!-- 总体进度环形进度条 -->
        <v-progress-circular
          :model-value="overallProgress"
          :color="overallProgress === 100 ? 'success' : 'primary'"
          size="32"
          width="3"
        >
          <span class="text-caption">{{ overallProgress }}%</span>
        </v-progress-circular>
      </v-card-title>

      <v-divider />

      <v-card-text class="py-4">
        <!-- 任务进度列表 -->
        <div v-for="task in taskProgress" :key="task.type" class="task-progress-item">
          <div class="task-header">
            <v-icon 
              :color="task.isCompleted ? 'success' : task.hasError ? 'error' : task.color"
              size="20"
              class="mr-3"
            >
              <template v-if="task.isCompleted">mdi-check-circle</template>
              <template v-else-if="task.hasError">mdi-alert-circle</template>
              <template v-else-if="task.isRunning">mdi-loading mdi-spin</template>
              <template v-else>{{ task.icon }}</template>
            </v-icon>
            
            <div class="task-info">
              <div class="task-label">{{ task.label }}</div>
              <div class="task-status">
                {{ getProgressText(task) }}
                <span v-if="task.estimatedTime && task.isRunning" class="ml-2 text-caption">
                  预计剩余: {{ task.estimatedTime }}
                </span>
              </div>
            </div>
            
            <div class="task-percentage">
              {{ task.percentage }}%
            </div>
          </div>
          
          <!-- 进度条 -->
          <v-progress-linear
            :model-value="task.percentage"
            :color="task.isCompleted ? 'success' : task.hasError ? 'error' : task.color"
            height="4"
            rounded
            class="mt-2"
          />
        </div>

        <!-- 扫描状态说明 -->
        <div v-if="taskProgress.length > 0" class="mt-4">
          <v-alert
            :color="overallProgress === 100 ? 'success' : 'info'"
            variant="tonal"
            density="compact"
          >
            <template v-slot:prepend>
              <v-icon>
                {{ overallProgress === 100 ? 'mdi-check-circle' : 'mdi-information' }}
              </v-icon>
            </template>
            
            <span v-if="overallProgress === 100">
              扫描完成！共发现 {{ taskProgress.reduce((sum, task) => sum + (task.foundIssues || 0), 0) }} 个问题
            </span>
            <span v-else>
              正在扫描您的书签，请稍候...
            </span>
          </v-alert>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        
        <!-- 取消按钮 -->
        <v-btn
          v-if="overallProgress < 100"
          variant="text"
          @click="handleCancel"
        >
          取消扫描
        </v-btn>
        
        <!-- 完成按钮 -->
        <v-btn
          v-else
          color="primary"
          @click="managementStore.completeCleanupScan"
        >
          查看结果
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.task-progress-item {
  margin-bottom: 16px;
}

.task-progress-item:last-child {
  margin-bottom: 0;
}

.task-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-label {
  font-weight: 500;
  font-size: 14px;
  line-height: 1.2;
}

.task-status {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  line-height: 1.2;
  margin-top: 2px;
}

.task-percentage {
  font-weight: 500;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.8);
  margin-left: 12px;
}

/* 旋转动画 */
.mdi-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
