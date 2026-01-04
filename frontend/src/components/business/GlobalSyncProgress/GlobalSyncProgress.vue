<!--
  全局同步进度对话框
  
  用法：在每个页面的根组件中添加此组件
  
  特点：
  - 全局单例，所有页面共享同一个进度状态
  - 自动订阅 BookmarkSyncService
  - 支持错误处理和重试
  - 强制关闭需要用户确认
-->

<script setup lang="ts">
import { defineOptions, onMounted, onUnmounted } from 'vue'
import { useGlobalSyncProgress } from '@/composables/useGlobalSyncProgress'
import { SyncProgressDialog } from '@/components'

defineOptions({
  name: 'GlobalSyncProgress'
})

const { progress, isVisible, initialize, dismiss, retry, forceClose } =
  useGlobalSyncProgress()

// 初始化全局订阅
onMounted(() => {
  initialize()
})

// 清理（可选，因为是全局单例）
onUnmounted(() => {
  // 不清理订阅，因为可能有其他页面还在使用
  // cleanup()
})

/**
 * 处理重试
 */
function handleRetry() {
  retry()
}

/**
 * 处理强制关闭（带警告）
 */
function handleForceClose() {
  // 🚨 警告用户
  const confirmed = window.confirm(
    '⚠️ 警告：同步尚未完成，强制关闭可能导致数据不完整。\n\n' +
      '建议：\n' +
      '• 点击"取消"，然后点击"重试"按钮\n' +
      '• 或等待同步自动重试\n\n' +
      '如果确定要强制关闭，请点击"确定"。\n\n' +
      '⚠️ 强制关闭后，您的书签数据可能不完整！'
  )

  if (confirmed) {
    forceClose()
  }
}

/**
 * 处理正常关闭（仅在完成时）
 */
function handleClose() {
  dismiss()
}
</script>

<template>
  <SyncProgressDialog
    :show="isVisible"
    :progress="progress"
    @close="handleClose"
    @retry="handleRetry"
    @force-close="handleForceClose"
  />
</template>
