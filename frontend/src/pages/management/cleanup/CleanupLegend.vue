<script setup lang="ts">
import { computed } from 'vue'
import { useCleanupStore } from '@/stores'
import { Icon } from '@/components'
import type { CleanupProblem } from '@/types/cleanup'

// === 使用新的 Cleanup Store ===
const cleanupStore = useCleanupStore()

// 筛选类型配置（与CleanupToolbar保持一致）
const filterTypes = [
  {
    key: '404',
    label: '404错误',
    color: '#f44336',
    icon: 'icon-link-off'
  },
  {
    key: 'duplicate',
    label: '重复书签',
    color: '#ff9800',
    icon: 'icon-content-duplicate'
  },
  {
    key: 'empty',
    label: '空文件夹',
    color: '#2196f3',
    icon: 'icon-folder-outline'
  },
  {
    key: 'invalid',
    label: '格式错误',
    color: '#9c27b0',
    icon: 'icon-alert-circle'
  }
]

// 计算总数和各类型数量
const legendData = computed(() => {
  if (!cleanupStore.cleanupState.filterResults) return []

  const results = cleanupStore.cleanupState.filterResults
  let totalCount = 0

  const data = filterTypes.map(type => {
    const count = Array.from(results.values()).reduce(
      (sum: number, nodeProblems: CleanupProblem[]) => {
        return (
          sum +
          nodeProblems.filter(
            (problem: CleanupProblem) => problem.type === type.key
          ).length
        )
      },
      0
    )

    totalCount += count

    return {
      ...type,
      count,
      visible:
        cleanupStore.cleanupState.legendVisibility?.[
          type.key as keyof typeof cleanupStore.cleanupState.legendVisibility
        ] ?? false
    }
  })

  // 添加全部选项
  return [
    {
      key: 'all',
      label: '全部',
      color: '#757575',
      icon: 'icon-select-all',
      count: totalCount,
      visible: cleanupStore.cleanupState.legendVisibility?.all ?? true
    },
    ...data
  ]
})

// 处理图例点击
const handleLegendClick = (legendKey: string) => {
  // 切换图例可见性
  const current =
    cleanupStore.cleanupState.legendVisibility[
      legendKey as keyof typeof cleanupStore.cleanupState.legendVisibility
    ]
  cleanupStore.cleanupState.legendVisibility[
    legendKey as keyof typeof cleanupStore.cleanupState.legendVisibility
  ] = !current
}
</script>

<template>
  <div v-if="cleanupStore.cleanupState?.isFiltering" class="cleanup-legend">
    <div class="legend-header">
      <Icon name="icon-tag-multiple" :size="16" color="text-secondary" />
      <span class="legend-title">筛选结果 (点击控制标签显示)</span>
    </div>

    <div class="legend-items">
      <div
        v-for="item in legendData"
        :key="item.key"
        class="legend-chip"
        :class="[
          {
            'legend-chip--active': item.visible,
            'legend-chip--inactive': !item.visible
          }
        ]"
        :style="{
          backgroundColor: item.visible ? item.color : 'transparent',
          borderColor: item.color,
          color: item.visible ? 'white' : item.color
        }"
        @click="handleLegendClick(item.key)"
      >
        <Icon :name="item.icon" :size="14" />
        <span class="legend-text">{{ item.label }} ({{ item.count }})</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cleanup-legend {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
}

.legend-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.legend-title {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
  user-select: none;
}

.legend-chip:hover {
  /* 无几何位移，使用阴影/亮度反馈 */
  box-shadow: var(--shadow-sm);
  opacity: 0.98;
}

.legend-chip--active {
  /* 激活状态由内联样式控制（此处保留 class 供选择器权重使用） */
}

.legend-chip--inactive {
  background-color: var(--color-surface) !important;
  opacity: 0.7;
}

.legend-text {
  white-space: nowrap;
}
</style>
