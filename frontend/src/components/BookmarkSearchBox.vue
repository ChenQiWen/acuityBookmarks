<!--
  通用书签搜索框组件
  
  提供标准的搜索UI，基于useBookmarkSearch composable
  支持下拉结果展示和自定义样式
-->

<template>
  <div class="bookmark-search-box" :class="searchBoxClasses">
    <!-- 搜索输入框 -->
    <Input
      v-model="searchQuery"
      :placeholder="placeholder"
      :type="type"
      :variant="variant"
      :density="density"
      :clearable="clearable"
      :disabled="disabled"
      class="bookmark-search-input"
      @keydown.enter="handleEnterKey"
      @focus="handleFocus"
      @blur="handleBlur"
    >
      <template #prepend>
        <Icon name="mdi-magnify" :size="16" />
      </template>
      
      <template #append v-if="isSearching">
        <Spinner size="sm" />
      </template>
    </Input>
    
    <!-- 搜索结果下拉框 -->
    <div 
      v-if="showDropdown" 
      class="search-dropdown"
      :class="dropdownClasses"
    >
      <div class="search-dropdown-content">
        <!-- AI 建议区域 -->
        <div class="ai-suggestions" v-if="hasAISuggestions || isAiLoading || aiError">
          <div class="ai-suggestions-header">
            <Icon name="mdi-robot-outline" :size="16" />
            <span>AI 建议</span>
            <Spinner v-if="isAiLoading" size="sm" class="ai-spinner" />
          </div>
          <div v-if="aiError" class="ai-error">
            <Icon name="mdi-alert-circle-outline" :size="16" />
            {{ aiError }}
          </div>
          <div v-if="hasAISuggestions" class="ai-suggestion-list">
            <button
              v-for="(s, i) in aiSuggestions"
              :key="i"
              type="button"
              class="ai-suggestion-item"
              @click="handleAISuggestionClick(s)"
            >
              <Icon name="mdi-lightbulb-outline" :size="16" />
              <span class="ai-suggestion-text">{{ s }}</span>
            </button>
          </div>
        </div>
        <!-- 搜索统计 -->
        <div v-if="showStats" class="search-stats">
          找到 {{ stats.totalResults }} 个结果 ({{ stats.searchTime }}ms)
        </div>
        
        <!-- 搜索结果列表 -->
        <div class="search-results-list">
          <div
            v-for="(result, index) in displayResults"
            :key="result.id"
            class="search-result-item"
            :class="{ 'search-result-item--active': index === selectedIndex }"
            @click="handleResultClick(result, index)"
            @mouseenter="selectedIndex = index"
          >
            <!-- 自定义结果项插槽 -->
            <slot name="result-item" :result="result" :index="index">
              <!-- 默认结果项样式 -->
              <div class="search-result-content">
                <div class="search-result-icon">
                  <img 
                    v-if="result.url" 
                    :src="getFaviconUrl(result.url)"
                    alt=""
                    @error="handleIconError"
                  />
                  <Icon v-else name="mdi-folder-outline" :size="16" />
                </div>
                
                <div class="search-result-info">
                  <div class="search-result-title">
                    {{ result.title || '未命名' }}
                  </div>
                  <div v-if="showPath && result.path?.length" class="search-result-path">
                    {{ result.path.join(' > ') }}
                  </div>
                  <div v-if="showUrl && result.url" class="search-result-url">
                    {{ result.url }}
                  </div>
                </div>
              </div>
            </slot>
          </div>
        </div>
        
        <!-- 无结果提示 -->
        <div v-if="searchQuery && !hasResults && !isSearching && !isAiLoading && !hasAISuggestions" class="search-no-results">
          <Icon name="mdi-bookmark-remove-outline" :size="24" />
          <span>未找到匹配的书签</span>
        </div>
        
        <!-- 更多结果提示 -->
        <div v-if="hasMoreResults" class="search-more-results">
          还有 {{ searchResults.length - maxDisplayResults }} 个结果...
        </div>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="error" class="search-error">
      <Icon name="mdi-alert-circle-outline" :size="16" />
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Input, Icon, Spinner } from './ui'
import { useBookmarkSearch, type BookmarkSearchOptions, type EnhancedBookmarkResult } from '../composables/useBookmarkSearch'
import type { BookmarkNode } from '../types'

export interface BookmarkSearchBoxProps {
  // 搜索配置
  bookmarkTree?: BookmarkNode[]
  searchOptions?: BookmarkSearchOptions
  
  // 输入框属性
  placeholder?: string
  type?: 'text' | 'search' | 'password' | 'email' | 'url' | 'number'
  variant?: 'outlined' | 'filled' | 'underlined'
  density?: 'default' | 'comfortable' | 'compact'
  clearable?: boolean
  disabled?: boolean
  
  // 显示选项
  showDropdown?: boolean
  showStats?: boolean
  showPath?: boolean
  showUrl?: boolean
  maxDisplayResults?: number
  
  // 样式类名
  class?: string
  dropdownClass?: string
  
  // 键盘导航
  enableKeyboardNav?: boolean
}

const props = withDefaults(defineProps<BookmarkSearchBoxProps>(), {
  placeholder: '搜索书签...',
  type: 'text',
  variant: 'outlined',
  density: 'compact',
  clearable: true,
  disabled: false,
  showDropdown: true,
  showStats: false,
  showPath: true,
  showUrl: false,
  maxDisplayResults: 10,
  enableKeyboardNav: true
})

// 事件定义
const emit = defineEmits<{
  'result-click': [result: EnhancedBookmarkResult, index: number]
  'search': [query: string, results: EnhancedBookmarkResult[]]
  'clear': []
  'focus': []
  'blur': []
  'enter': [query: string]
}>()

// 使用搜索composable
const {
  searchQuery,
  searchResults,
  isSearching,
  error,
  stats,
  // AI 建议相关
  aiSuggestions,
  isAiLoading,
  aiError,
  // 操作方法
  searchImmediate,
  clearSearch
} = useBookmarkSearch({
  bookmarkTree: props.bookmarkTree,
  autoSearch: true,
  // 默认启用 AI 建议
  enableAiAssist: true,
  aiSuggestionLimit: 5,
  ...props.searchOptions
})

// 本地状态
const selectedIndex = ref(-1)
const isDropdownVisible = ref(false)

// 计算属性
const searchBoxClasses = computed(() => [
  props.class,
  {
    'bookmark-search-box--disabled': props.disabled,
    'bookmark-search-box--error': !!error.value,
    'bookmark-search-box--searching': isSearching.value
  }
])

const dropdownClasses = computed(() => [
  props.dropdownClass,
  'search-dropdown--visible'
])

const hasResults = computed(() => searchResults.value.length > 0)
const hasAISuggestions = computed(() => aiSuggestions.value && aiSuggestions.value.length > 0)

const displayResults = computed(() => 
  searchResults.value.slice(0, props.maxDisplayResults)
)

const hasMoreResults = computed(() => 
  searchResults.value.length > props.maxDisplayResults
)

const showDropdown = computed(() => 
  props.showDropdown &&
  isDropdownVisible.value &&
  searchQuery.value.trim() !== '' &&
  (hasResults.value || hasAISuggestions.value || isSearching.value || isAiLoading.value)
)

// 选择 AI 建议：填充查询并立即搜索
const handleAISuggestionClick = (suggestion: string) => {
  searchQuery.value = suggestion
  // 立即执行搜索，提高交互响应
  searchImmediate(suggestion)
}

// 事件处理
const handleFocus = () => {
  isDropdownVisible.value = true
  emit('focus')
}

const handleBlur = () => {
  // 延迟隐藏，允许点击结果项
  setTimeout(() => {
    isDropdownVisible.value = false
  }, 200)
  emit('blur')
}

const handleEnterKey = () => {
  if (selectedIndex.value >= 0 && selectedIndex.value < displayResults.value.length) {
    // 选中某个结果时，触发点击
    handleResultClick(displayResults.value[selectedIndex.value], selectedIndex.value)
  } else {
    // 否则触发搜索
    searchImmediate()
    emit('enter', searchQuery.value)
  }
}

const handleResultClick = (result: EnhancedBookmarkResult, index: number) => {
  selectedIndex.value = index
  emit('result-click', result, index)
}

// 工具方法
const getFaviconUrl = (url: string): string => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=20`
  } catch {
    return ''
  }
}

const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (img) {
    img.style.display = 'none'
  }
}

// 键盘导航
if (props.enableKeyboardNav) {
  watch(searchQuery, () => {
    selectedIndex.value = -1
  })
}

// 监听搜索结果变化，触发事件
watch([searchQuery, searchResults], ([query, results]) => {
  emit('search', query, results)
})

// 导出方法给父组件使用
defineExpose({
  searchQuery,
  searchResults,
  isSearching,
  error,
  stats,
  clearSearch,
  searchImmediate,
  focus: () => {
    // 可以添加focus方法
  }
})
</script>

<style scoped>
.bookmark-search-box {
  position: relative;
}

.bookmark-search-input {
  width: 100%;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  margin-top: var(--spacing-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 400px;
  overflow: hidden;
}

.search-dropdown-content {
  overflow-y: auto;
  max-height: 400px;
}

.search-stats {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-surface-variant);
}

.search-results-list {
  padding: var(--spacing-xs) 0;
}

.search-result-item {
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-divider-alpha-50);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover,
.search-result-item--active {
  background: var(--color-surface-variant);
}

.search-result-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.search-result-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-result-icon img {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
}

.search-result-info {
  flex: 1;
  min-width: 0;
}

.search-result-title {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-path {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-url {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  gap: var(--spacing-sm);
}

.search-more-results {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: var(--color-surface-variant);
  border-top: 1px solid var(--color-divider);
}

.search-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  margin-top: var(--spacing-xs);
  background: var(--color-error-alpha-10);
  border: 1px solid var(--color-error-alpha-30);
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: var(--text-sm);
}

.bookmark-search-box--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.bookmark-search-box--error .bookmark-search-input {
  border-color: var(--color-error);
}

.bookmark-search-box--searching .bookmark-search-input {
  border-color: var(--color-primary);
}
</style>
