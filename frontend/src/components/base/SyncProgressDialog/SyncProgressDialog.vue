<template>
  <Dialog :show="show" persistent :hide-close="!showActions">
    <template #title>
      <div class="dialog-title" :class="{ 'is-error': isError }">
        <Icon
          :name="titleIcon"
          :spin="!isCompleted && !isError"
          class="title-icon"
        />
        <span>{{ dialogTitle }}</span>
      </div>
    </template>

    <template #content>
      <!-- ✅ 错误状态 -->
      <div v-if="isError" class="error-content">
        <div class="error-icon">
          <Icon name="icon-error" />
        </div>
        <div class="error-message">
          {{ progress.error?.message || '同步过程中发生错误' }}
        </div>
        <div v-if="progress.error?.type === 'timeout'" class="error-hint">
          <Icon name="icon-info" />
          <span>可能原因：网络缓慢、书签数量过多、或浏览器资源不足</span>
        </div>
        <div v-if="progress.error?.retryCount" class="retry-count">
          已重试 {{ progress.error.retryCount }} 次
        </div>
      </div>

      <!-- ✅ 正常进度 -->
      <div v-else class="sync-progress-content">
        <!-- 阶段指示器 -->
        <div class="phase-indicators">
          <div
            v-for="phase in phases"
            :key="phase.key"
            class="phase-item"
            :class="{
              active: progress.phase === phase.key,
              completed: isPhaseCompleted(phase.key)
            }"
          >
            <div class="phase-icon">
              <Icon
                :name="phase.icon"
                :class="{ spin: progress.phase === phase.key && !isCompleted }"
              />
            </div>
            <span class="phase-label">{{ phase.label }}</span>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${progress.percentage}%` }"
            />
          </div>
          <div class="progress-percentage">
            {{ Math.round(progress.percentage) }}%
          </div>
        </div>

        <!-- 详细信息 -->
        <div class="progress-details">
          <div class="progress-message">
            {{ progress.message }}
          </div>
          <div class="progress-stats">
            <span v-if="progress.total > 0" class="stat-item">
              <Icon name="icon-file" class="stat-icon" />
              {{ progress.current.toLocaleString() }} /
              {{ progress.total.toLocaleString() }}
            </span>
            <span
              v-if="
                progress.estimatedRemaining && progress.estimatedRemaining > 0
              "
              class="stat-item"
            >
              <Icon name="icon-clock" class="stat-icon" />
              剩余约 {{ formatTime(progress.estimatedRemaining) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template v-if="showActions" #actions>
      <!-- ✅ 错误时的操作 -->
      <template v-if="isError">
        <Button
          v-if="progress.error?.canRetry"
          variant="primary"
          @click="emit('retry')"
        >
          <Icon name="icon-refresh" />
          重试
        </Button>
        <Button variant="text" @click="emit('force-close')">
          忽略并继续
        </Button>
      </template>

      <!-- ✅ 完成时的操作 -->
      <Button v-else @click="emit('close')"> 关闭 </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, defineOptions } from 'vue'
import Dialog from '@/components/base/Dialog/Dialog.vue'
import Icon from '@/components/base/Icon/Icon.vue'
import Button from '@/components/base/Button/Button.vue'
import type { SyncProgress, SyncPhase } from '@/types/sync-progress'
import { SYNC_PHASES, PHASE_TITLES, formatTime } from '@/types/sync-progress'

defineOptions({
  name: 'SyncProgressDialog'
})

interface Props {
  /** 是否显示对话框 */
  show: boolean
  /** 进度数据 */
  progress: SyncProgress
}

interface Emits {
  (e: 'close'): void
  (e: 'retry'): void
  (e: 'force-close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/**
 * 所有阶段
 */
const phases = computed(() => {
  // 只显示前4个阶段（不包括 'completed'）
  return SYNC_PHASES.slice(0, 4)
})

/**
 * 是否已完成
 */
const isCompleted = computed(() => {
  return props.progress.phase === 'completed'
})

/**
 * 是否处于错误状态
 */
const isError = computed(() => {
  return props.progress.phase === 'failed' || props.progress.phase === 'timeout'
})

/**
 * 对话框标题
 */
const dialogTitle = computed(() => {
  if (isCompleted.value) return '同步完成'
  if (isError.value) return PHASE_TITLES[props.progress.phase]
  return PHASE_TITLES[props.progress.phase] || '正在同步'
})

/**
 * 标题图标
 */
const titleIcon = computed(() => {
  if (isCompleted.value) return 'icon-check'
  if (isError.value) return 'icon-warning'
  return 'icon-sync'
})

/**
 * 是否显示操作按钮
 */
const showActions = computed(() => {
  return isCompleted.value || isError.value
})

/**
 * 判断阶段是否已完成
 */
function isPhaseCompleted(phase: SyncPhase): boolean {
  const phaseOrder: SyncPhase[] = [
    'fetching',
    'converting',
    'writing',
    'indexing',
    'completed'
  ]
  const currentIndex = phaseOrder.indexOf(props.progress.phase)
  const checkIndex = phaseOrder.indexOf(phase)

  return checkIndex < currentIndex || props.progress.phase === 'completed'
}
</script>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.sync-progress-dialog {
  --dialog-width: 500px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
}

.dialog-title.is-error .title-icon {
  color: var(--error-color);
}

/* 错误状态 */
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
}

.error-icon :deep(svg) {
  width: 64px;
  height: 64px;
  color: var(--error-color);
}

.error-message {
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  color: var(--text-color);
}

.error-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 400px;
  padding: 12px 16px;
  border: 1px solid var(--warning-color, #ffc107);
  border-radius: 6px;
  font-size: 14px;
  color: var(--warning-color-dark, #856404);
  background: var(--warning-color-light, #fff3cd);
}

.error-hint :deep(svg) {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

.retry-count {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.sync-progress-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;
}

/* 阶段指示器 */
.phase-indicators {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
}

.phase-indicators::before {
  position: absolute;
  top: 18px;
  right: 24px;
  left: 24px;
  z-index: 0;
  height: 2px;
  background: var(--border-color);
  content: '';
}

.phase-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.phase-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  background: var(--background-color);
  transition: all 0.3s ease;
}

.phase-item.active .phase-icon {
  border-color: var(--primary-color);
  background: var(--primary-color-light);
  box-shadow: 0 0 0 4px var(--primary-color-lighter);
}

.phase-item.completed .phase-icon {
  border-color: var(--success-color);
  background: var(--success-color);
}

.phase-icon :deep(svg) {
  width: 18px;
  height: 18px;
  color: var(--text-color-secondary);
}

.phase-item.active .phase-icon :deep(svg) {
  color: var(--primary-color);
}

.phase-item.completed .phase-icon :deep(svg) {
  color: white;
}

.phase-icon :deep(svg.spin) {
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
  animation: spin 1s linear infinite;
}

.phase-label {
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-color-secondary);
}

.phase-item.active .phase-label {
  font-weight: 500;
  color: var(--primary-color);
}

.phase-item.completed .phase-label {
  color: var(--success-color);
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 12px;
  border-radius: 6px;
  background: var(--border-color);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--primary-color),
    var(--primary-color-dark)
  );
  transition: width 0.3s ease;
}

.progress-percentage {
  min-width: 48px;
  font-size: 16px;
  font-weight: 600;
  text-align: right;
  color: var(--text-color);
}

/* 详细信息 */
.progress-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-message {
  font-size: 14px;
  text-align: center;
  color: var(--text-color);
}

.progress-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.stat-icon {
  width: 14px;
  height: 14px;
}
</style>
