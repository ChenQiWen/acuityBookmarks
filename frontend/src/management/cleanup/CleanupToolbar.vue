<script setup lang="ts">
import { computed, ref } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'
import { Button, Icon, Card, Spinner, Spacer } from '../../components/ui'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

// 解构清理相关状态（将在store中添加）
const {
  cleanupState
} = storeToRefs(managementStore)

// 组件状态
const showConfigMenu = ref(false)

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

// 点击外部关闭菜单
const handleClickOutside = () => {
  showConfigMenu.value = false
}
</script>

<template>
  <div class="cleanup-toolbar">
    <!-- 主按钮组 -->
    <div class="button-group">
      <!-- 主操作按钮 -->
      <Button
        :color="buttonState.color"
        :disabled="buttonState.disabled"
        @click="handleMainAction"
        class="main-button"
      >
        <Icon v-if="!cleanupState?.isScanning" :name="buttonState.icon" slot="prepend" />
        <Spinner 
          v-if="cleanupState?.isScanning"
          size="sm"
          color="primary"
          class="spinner"
        />
        {{ buttonState.text }}
      </Button>

      <!-- 配置下拉按钮 -->
      <Button
        :color="buttonState.color"
        :disabled="cleanupState?.isScanning"
        variant="secondary"
        icon
        @click="showConfigMenu = !showConfigMenu"
        class="config-button"
      >
        <Icon name="mdi-chevron-down" />
      </Button>
    </div>

    <!-- 配置菜单 -->
    <Teleport to="body">
      <div v-if="showConfigMenu" class="menu-overlay" @click="handleClickOutside">
        <Card 
          class="config-menu" 
          elevation="high"
          @click.stop
        >
          <template #header>
            <div class="config-header">
              <Icon name="mdi-tune" color="primary" />
              <span class="config-title">筛选配置</span>
            </div>
          </template>
          
          <div class="filter-list">
            <div
              v-for="filterType in filterTypes"
              :key="filterType.key"
              @click="handleFilterToggle(filterType.key)"
              class="filter-item"
            >
              <input 
                type="checkbox"
                :checked="cleanupState?.activeFilters?.includes(filterType.key as '404' | 'duplicate' | 'empty' | 'invalid') ?? false"
                @click.stop="handleFilterToggle(filterType.key)"
                class="filter-checkbox"
              />
              
              <div class="filter-content">
                <div class="filter-title">
                  <Icon :name="filterType.icon" :style="{ color: filterType.color }" />
                  <span>{{ filterType.label }}</span>
                </div>
                <div class="filter-desc">{{ filterType.description }}</div>
              </div>
            </div>
          </div>
          
          <template #footer>
            <div class="config-actions">
              <Button 
                variant="ghost" 
                @click="managementStore.resetCleanupFilters"
                :disabled="!cleanupState?.activeFilters?.length"
                size="sm"
              >
                重置
              </Button>
              
              <Spacer />
              
              <Button 
                variant="ghost" 
                @click="handleOpenSettings"
                color="primary"
                size="sm"
              >
                <Icon name="mdi-cog" slot="prepend" />
                高级设置
              </Button>
            </div>
          </template>
        </Card>
      </div>
    </Teleport>

    <!-- 进度指示器 -->
    <div
      v-if="cleanupState?.isScanning"
      class="progress-container"
    >
      <div class="progress-bar progress-bar--indeterminate" />
    </div>
  </div>
</template>

<style scoped>
.cleanup-toolbar {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.button-group {
  display: flex;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.main-button {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}

.config-button {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  min-width: 40px;
}

.spinner {
  margin-right: var(--spacing-sm);
}

/* 菜单覆盖层 */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
}

.config-menu {
  min-width: 280px;
  max-width: 320px;
}

.config-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.config-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.filter-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.filter-item:hover {
  background-color: var(--color-surface-hover);
}

.filter-checkbox {
  margin-top: 2px;
  accent-color: var(--color-primary);
}

.filter-content {
  flex: 1;
  min-width: 0;
}

.filter-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.filter-desc {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-tight);
}

.config-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

/* 进度条 */
.progress-container {
  position: absolute;
  bottom: -8px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.progress-bar--indeterminate {
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-primary),
    transparent
  );
  background-size: 50% 100%;
  animation: progress-indeterminate 1.5s infinite;
}

@keyframes progress-indeterminate {
  0% {
    background-position: -50% 0;
  }
  100% {
    background-position: 150% 0;
  }
}
</style>