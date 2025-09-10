<script setup lang="ts">
import { computed } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

// 解构清理相关状态
const { cleanupState } = storeToRefs(managementStore)

// 筛选类型配置（与CleanupToolbar保持一致）
const filterTypes = [
  {
    key: '404',
    label: '404错误',
    color: '#f44336',
    icon: 'mdi-link-off'
  },
  {
    key: 'duplicate', 
    label: '重复书签',
    color: '#ff9800',
    icon: 'mdi-content-duplicate'
  },
  {
    key: 'empty',
    label: '空文件夹',
    color: '#2196f3',
    icon: 'mdi-folder-outline'
  },
  {
    key: 'invalid',
    label: '格式错误',
    color: '#9c27b0',
    icon: 'mdi-alert-circle'
  }
]

// 计算总数和各类型数量
const legendData = computed(() => {
  if (!cleanupState.value?.filterResults) return []

  const results = cleanupState.value.filterResults
  let totalCount = 0

  const data = filterTypes.map(type => {
    const count = Array.from(results.values())
      .reduce((sum, nodeProblems) => {
        return sum + nodeProblems.filter(problem => problem.type === type.key).length
      }, 0)
    
    totalCount += count
    
    return {
      ...type,
      count,
      visible: cleanupState.value?.legendVisibility?.[type.key as keyof typeof cleanupState.value.legendVisibility] ?? false
    }
  })

  // 添加全部选项
  return [
    {
      key: 'all',
      label: '全部',
      color: '#757575',
      icon: 'mdi-select-all',
      count: totalCount,
      visible: cleanupState.value?.legendVisibility?.all ?? true
    },
    ...data
  ]
})

// 处理图例点击
const handleLegendClick = (legendKey: string) => {
  managementStore.toggleCleanupLegendVisibility(legendKey)
}
</script>

<template>
  <div v-if="cleanupState?.isFiltering" class="cleanup-legend">
    <div class="legend-header">
      <v-icon start size="small">mdi-tag-multiple</v-icon>
      <span class="text-caption">筛选结果 (点击控制标签显示)</span>
    </div>
    
    <div class="legend-items">
      <v-chip
        v-for="item in legendData"
        :key="item.key"
        :color="item.visible ? item.color : 'grey-lighten-2'"
        :variant="item.visible ? 'flat' : 'outlined'"
        size="small"
        class="legend-chip"
        clickable
        @click="handleLegendClick(item.key)"
      >
        <v-icon start size="16">
          {{ item.icon }}
        </v-icon>
        {{ item.label }} ({{ item.count }})
      </v-chip>
    </div>
  </div>
</template>

<style scoped>
.cleanup-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.legend-header {
  display: flex;
  align-items: center;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 500;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.legend-chip {
  transition: all 0.2s ease;
  font-size: 12px !important;
}

.legend-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.legend-chip.v-chip--disabled {
  opacity: 0.5;
}
</style>
