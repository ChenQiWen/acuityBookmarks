<!--
  示例组件：展示如何迁移到新的 Store 架构
  
  这个组件展示了：
  1. 新的 Store 导入方式
  2. 统一的错误处理
  3. 简化的状态管理
-->

<template>
  <div class="example-component">
    <!-- 错误提示 -->
    <div v-if="hasError" class="error-message">
      {{ userErrorMessage }}
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading">
      {{ loadingMessage }}
    </div>

    <!-- 主要内容 -->
    <div v-else class="content">
      <h2>示例组件</h2>
      <p>书签总数: {{ totalBookmarks }}</p>
      <p>文件夹总数: {{ totalFolders }}</p>

      <!-- 操作按钮 -->
      <div class="actions">
        <button @click="handleRefresh" :disabled="isLoading">刷新数据</button>
        <button @click="handleSearch" :disabled="isSearching">搜索书签</button>
      </div>

      <!-- 搜索结果 -->
      <div v-if="searchResults.length > 0" class="search-results">
        <h3>搜索结果</h3>
        <ul>
          <li v-for="result in searchResults" :key="result.id">
            {{ result.title }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useManagementStore, useBookmarkStore, useUIStore } from '@/stores'
import { useErrorHandling } from '@/infrastructure/error-handling'

// === Store 使用 ===

// 管理页面 Store
const managementStore = useManagementStore()
const {
  isPageLoading,
  hasError: managementHasError,
  userErrorMessage: managementErrorMessage,
  searchResults,
  isSearching
} = storeToRefs(managementStore)

// 书签 Store
const bookmarkStore = useBookmarkStore()
const {
  totalBookmarks,
  totalFolders,
  hasError: bookmarkHasError,
  userErrorMessage: bookmarkErrorMessage
} = storeToRefs(bookmarkStore)

// UI Store
const uiStore = useUIStore()
const { hasError: uiHasError, userErrorMessage: uiErrorMessage } =
  storeToRefs(uiStore)

// === 错误处理 ===
const { handleError } = useErrorHandling()

// === 计算属性 ===
const isLoading = computed(() => {
  return isPageLoading.value
})

const hasError = computed(() => {
  return managementHasError.value || bookmarkHasError.value || uiHasError.value
})

const userErrorMessage = computed(() => {
  return (
    managementErrorMessage.value ||
    bookmarkErrorMessage.value ||
    uiErrorMessage.value ||
    '未知错误'
  )
})

const loadingMessage = computed(() => {
  if (isSearching.value) return '正在搜索...'
  if (isPageLoading.value) return '正在加载...'
  return '处理中...'
})

// === 方法 ===

/**
 * 处理刷新操作
 */
const handleRefresh = async () => {
  try {
    await bookmarkStore.refresh()
    await managementStore.loadInitialData()
  } catch (error) {
    await handleError(error as Error, {
      component: 'ExampleComponent',
      operation: 'refresh'
    })
  }
}

/**
 * 处理搜索操作
 */
const handleSearch = async () => {
  try {
    await managementStore.searchBookmarks('示例搜索')
  } catch (error) {
    await handleError(error as Error, {
      component: 'ExampleComponent',
      operation: 'search'
    })
  }
}

/**
 * 组件初始化
 */
const initialize = async () => {
  try {
    // 初始化所有 Store
    await Promise.all([
      managementStore.initialize(),
      bookmarkStore.initialize(),
      uiStore.initialize()
    ])
  } catch (error) {
    await handleError(error as Error, {
      component: 'ExampleComponent',
      operation: 'initialize'
    })
  }
}

// === 生命周期 ===
onMounted(() => {
  void initialize()
})
</script>

<style scoped>
.example-component {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  border-left: 4px solid #c62828;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.actions {
  margin: 20px 0;
  display: flex;
  gap: 12px;
}

.actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.actions button:hover:not(:disabled) {
  background: #f5f5f5;
}

.actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-results {
  margin-top: 20px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 4px;
}

.search-results ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.search-results li {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.search-results li:last-child {
  border-bottom: none;
}
</style>
