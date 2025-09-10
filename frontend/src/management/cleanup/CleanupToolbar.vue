<script setup lang="ts">
import { computed } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

// 解构清理相关状态（将在store中添加）
const {
  cleanupState
} = storeToRefs(managementStore)

// 筛选类型配置
const filterTypes = [
  {
    key: '404',
    label: '404错误链接',
    color: '#f44336', // 红色
    icon: 'mdi-link-off',
    description: '检测无法访问的链接'
  },
  {
    key: 'duplicate',
    label: '重复书签',
    color: '#ff9800', // 橙色  
    icon: 'mdi-content-duplicate',
    description: '查找相同URL的书签'
  },
  {
    key: 'empty',
    label: '空文件夹',
    color: '#2196f3', // 蓝色
    icon: 'mdi-folder-outline',
    description: '查找没有内容的文件夹'
  },
  {
    key: 'invalid',
    label: '格式错误URL',
    color: '#9c27b0', // 紫色
    icon: 'mdi-alert-circle',
    description: '检测URL格式问题'
  }
]

// 计算当前按钮状态
const buttonState = computed(() => {
  if (!cleanupState.value) {
    return {
      text: '一键筛选',
      color: 'primary',
      icon: 'mdi-filter',
      disabled: false
    }
  }

  if (cleanupState.value.isScanning) {
    return {
      text: '扫描中...',
      color: 'warning',
      icon: 'mdi-loading',
      disabled: true
    }
  }

  if (cleanupState.value.isFiltering) {
    // 🎯 计算当前筛选后可见的问题数量（基于图例可见性）
    const visibleProblems = Array.from(cleanupState.value.filterResults.entries())
      .reduce((sum, [, problems]) => {
        const legendVisibility = cleanupState.value!.legendVisibility
        
        // 如果"全部"选中，保留所有问题
        if (legendVisibility.all) {
          return sum + problems.length
        }
        
        // 否则只计算当前可见类型的问题
        const visibleNodeProblems = problems.filter(problem => 
          legendVisibility[problem.type as keyof typeof legendVisibility] === true
        )
        return sum + visibleNodeProblems.length
      }, 0)
    
    return {
      text: `一键清理 (${visibleProblems}项)`,
      color: 'error',
      icon: 'mdi-delete-sweep',
      disabled: visibleProblems === 0
    }
  }

  if (cleanupState.value.justCompleted) {
    return {
      text: '✅ 检测完成',
      color: 'success',
      icon: 'mdi-check-circle',
      disabled: true
    }
  }

  return {
    text: '一键筛选',
    color: 'primary', 
    icon: 'mdi-filter',
    disabled: false
  }
})

// 事件处理
const handleMainAction = () => {
  if (!cleanupState.value) return

  if (cleanupState.value.isFiltering) {
    // 执行清理
    managementStore.executeCleanup()
  } else {
    // 开始筛选
    managementStore.startCleanupScan()
  }
}

const handleFilterToggle = async (filterKey: string) => {
  await managementStore.toggleCleanupFilter(filterKey as '404' | 'duplicate' | 'empty' | 'invalid')
}

const handleOpenSettings = async () => {
  await managementStore.showCleanupSettings()
}
</script>

<template>
  <div class="cleanup-toolbar">
    <!-- 主按钮 -->
    <v-btn-group variant="elevated" divided>
      <!-- 主操作按钮 -->
      <v-btn
        :color="buttonState.color"
        :disabled="buttonState.disabled"
        @click="handleMainAction"
        size="default"
      >
        <v-icon :start="!cleanupState?.isScanning">
          {{ buttonState.icon }}
        </v-icon>
        <v-progress-circular
          v-if="cleanupState?.isScanning"
          indeterminate
          size="16"
          width="2"
          class="mr-2"
        />
        {{ buttonState.text }}
      </v-btn>

      <!-- 筛选配置下拉菜单 -->
      <v-menu offset-y>
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            :color="buttonState.color"
            icon
            :disabled="cleanupState?.isScanning"
          >
            <v-icon>mdi-chevron-down</v-icon>
          </v-btn>
        </template>

        <v-card min-width="280">
          <v-card-title class="text-subtitle-1 py-2">
            <v-icon start>mdi-tune</v-icon>
            筛选配置
          </v-card-title>
          <v-divider />
          
          <v-list density="compact">
            <v-list-item
              v-for="filterType in filterTypes"
              :key="filterType.key"
              @click="handleFilterToggle(filterType.key)"
              class="filter-type-item"
            >
              <template v-slot:prepend>
                <v-checkbox
                  :model-value="cleanupState?.activeFilters?.includes(filterType.key as '404' | 'duplicate' | 'empty' | 'invalid') ?? false"
                  :color="filterType.color"
                  hide-details
                  @click.stop="handleFilterToggle(filterType.key)"
                />
              </template>

              <v-list-item-title class="d-flex align-center">
                <v-icon :color="filterType.color" class="mr-2">
                  {{ filterType.icon }}
                </v-icon>
                {{ filterType.label }}
              </v-list-item-title>
              
              <v-list-item-subtitle>
                {{ filterType.description }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-divider />
          <v-card-actions class="px-4 py-2">
            <v-btn 
              size="small" 
              variant="text"
              @click="managementStore.resetCleanupFilters"
              :disabled="!cleanupState?.activeFilters?.length"
            >
              重置
            </v-btn>
            
            <v-spacer />
            
            <v-btn 
              size="small" 
              variant="text"
              color="primary"
              @click="handleOpenSettings"
              prepend-icon="mdi-cog"
            >
              高级设置
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
    </v-btn-group>
  </div>
</template>

<style scoped>
.cleanup-toolbar {
  display: inline-flex;
}

.filter-type-item {
  transition: background-color 0.2s ease;
}

.filter-type-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}
</style>
