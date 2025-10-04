<!--
  通用书签搜索框组件
  
  提供标准的搜索输入与数据输出（数组），不包含下拉结果UI
  消费方负责根据输出数据自行渲染结果列表
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
      
      <!-- 合并 append 插槽，避免重复定义同一插槽 -->
      <template #append>
        <Spinner v-if="isSearching" size="sm" />
        <button v-if="enableSemanticSearch" class="semantic-btn" :disabled="isSemanticSearching" @click="runSemanticSearch">语义</button>
      </template>
    </Input>
    <!-- 调试开关与高级配置，仅在debug开启时显示 -->
    <div class="semantic-config" v-if="enableSemanticSearch && showDebugToggle">
      <button class="debug-toggle" @click="debugVisible = !debugVisible">{{ debugVisible ? '隐藏配置' : '显示配置' }}</button>
      <div v-if="debugVisible" class="semantic-config-panel">
        <div class="config-row">
          <label>TopK</label>
          <input type="number" min="1" max="200" v-model.number="semanticTopKLocal" />
          <label>阈值(0-1)</label>
          <input type="number" step="0.01" min="0" max="1" v-model.number="semanticMinSimLocal" />
          <button class="hybrid-toggle" @click="hybridModeLocal = !hybridModeLocal">混合: {{ hybridModeLocal ? '开' : '关' }}</button>
        </div>
      </div>
    </div>
    
    <!-- 错误提示（数据输出组件仍保留错误信息区） -->
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
import { unifiedBookmarkAPI } from '../utils/unified-bookmark-api'

export interface BookmarkSearchBoxProps {
  // 受控输入值
  modelValue?: string
  // 搜索配置
  bookmarkTree?: BookmarkNode[]
  searchOptions?: BookmarkSearchOptions
  
  // 语义搜索能力配置
  enableSemanticSearch?: boolean
  semanticTopK?: number
  semanticMinSim?: number
  enableHybridMode?: boolean
  showDebugToggle?: boolean
  
  // 输入框属性
  placeholder?: string
  type?: 'text' | 'search' | 'password' | 'email' | 'url' | 'number'
  variant?: 'outlined' | 'filled' | 'underlined'
  density?: 'default' | 'comfortable' | 'compact'
  clearable?: boolean
  disabled?: boolean
  
  // 样式类名（调用方自定义下拉在外部实现）
  class?: string
}

const props = withDefaults(defineProps<BookmarkSearchBoxProps>(), {
  placeholder: '搜索书签...',
  type: 'text',
  variant: 'outlined',
  density: 'compact',
  clearable: true,
  disabled: false,
  enableSemanticSearch: false,
  semanticTopK: 50,
  semanticMinSim: 0.2,
  enableHybridMode: true,
  showDebugToggle: true
})

// 事件定义
const emit = defineEmits<{
  // 输入变更（v-model）
  'update:modelValue': [value: string]
  // 主动输出搜索结果数据数组
  'results': [results: EnhancedBookmarkResult[], context: { query: string; stats: any }]
  // 兼容事件：沿用旧签名
  'search': [query: string, results: EnhancedBookmarkResult[]]
  'clear': []
  'focus': []
  'blur': []
  'enter': [query: string]
  // 可选：输出语义/混合结果
  'semantic-results': [results: Array<{ id: string; title?: string; url?: string; score: number }>]
}>()

// 使用搜索composable
const {
  searchQuery,
  searchResults,
  isSearching,
  error,
  stats,
  // 操作方法
  searchImmediate,
  clearSearch
} = useBookmarkSearch({
  bookmarkTree: props.bookmarkTree,
  autoSearch: true,
  ...props.searchOptions
})

// input 值与 v-model 同步
const inputValue = ref(props.modelValue ?? '')
watch(() => props.modelValue, (v) => {
  if (v !== undefined && v !== inputValue.value) inputValue.value = v
})
watch(inputValue, (v) => {
  emit('update:modelValue', v)
  // 同步到搜索引擎
  searchQuery.value = v
})

// 计算属性
const searchBoxClasses = computed(() => [
  props.class,
  {
    'bookmark-search-box--disabled': props.disabled,
    'bookmark-search-box--error': !!error.value,
    'bookmark-search-box--searching': isSearching.value
  }
])

// 已移除内部下拉展示逻辑，由父组件渲染

// 语义搜索本地状态
const isSemanticSearching = ref(false)
const semanticResults = ref<Array<{ id: string; title?: string; url?: string; domain?: string; score: number }>>([])
const combinedSemanticResults = ref<Array<{ id: string; title?: string; url?: string; domain?: string; score: number }>>([])
const debugVisible = ref(false)
const semanticTopKLocal = ref(props.semanticTopK)
const semanticMinSimLocal = ref(props.semanticMinSim)
const hybridModeLocal = ref(props.enableHybridMode)

let hybridWorker: Worker | null = null
try {
  hybridWorker = new Worker(new URL('../workers/hybridSearchWorker.ts', import.meta.url), { type: 'module' })
} catch (e) {
  hybridWorker = null
}

// 语义结果切片交由父组件处理（此处仅维护完整列表）

// 已移除 AI 建议点击逻辑

// 事件处理
const handleFocus = () => { emit('focus') }

const handleBlur = () => {
  emit('blur')
}

const handleEnterKey = () => {
  // Enter 触发一次搜索
  searchImmediate()
  emit('enter', searchQuery.value)
}

// 工具方法
// 图标与错误处理已不在本组件内使用，由父组件决定渲染与降级

// 已移除内部键盘导航（由父级在自己的列表中实现）

// 监听搜索结果变化，触发事件
watch([searchQuery, searchResults], ([query, results]) => {
  emit('search', query, results)
  emit('results', results, { query, stats: stats.value })
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
  runSemanticSearch,
  focus: () => {
    // 可以添加focus方法
  }
})

// 运行语义搜索（统一API + Worker合并 + 超时兜底）
async function runSemanticSearch() {
  const q = searchQuery.value.trim()
  if (!q) {
    semanticResults.value = []
    combinedSemanticResults.value = []
    return
  }
  isSemanticSearching.value = true
  try {
    const sem = await unifiedBookmarkAPI.semanticSearch(q, semanticTopKLocal.value)
    const filteredSem = sem.filter(r => (r.score || 0) >= (semanticMinSimLocal.value || 0))
    semanticResults.value = filteredSem

    if (hybridModeLocal.value) {
      const kw = await unifiedBookmarkAPI.searchBookmarks(q, { limit: 100 })

      const doLocalMerge = () => {
        const semMap = new Map(filteredSem.map(r => [r.id, r]))
        let maxKw = 1
        kw.forEach(r => { if ((r.score || 0) > maxKw) maxKw = r.score || 1 })
        const idSet = new Set<string>()
        kw.forEach(r => idSet.add(r.bookmark.id))
        filteredSem.forEach(r => idSet.add(r.id))
        const merged: Array<{ id: string; title?: string; url?: string; domain?: string; score: number }> = []
        idSet.forEach((id) => {
          const kwItem = kw.find(x => x.bookmark.id === id)
          const semItem = semMap.get(id)
          const kwScoreNorm = kwItem ? ((kwItem.score || 0) / (maxKw || 1)) : 0
          const semScore = semItem ? (semItem.score || 0) : 0
          const score = (0.4 * kwScoreNorm) + (0.6 * semScore)
          if (score >= (semanticMinSimLocal.value || 0)) {
            merged.push({
              id,
              title: kwItem?.bookmark.title ?? semItem?.title,
              url: kwItem?.bookmark.url ?? semItem?.url,
              domain: kwItem?.bookmark.domain ?? semItem?.domain,
              score,
            })
          }
        })
        merged.sort((a, b) => b.score - a.score)
        return merged
      }

      if (hybridWorker) {
        const worker = hybridWorker
        const req = {
          keywordResults: kw,
          semanticResults: filteredSem,
          weights: { keyword: 0.4, semantic: 0.6 },
          minCombinedScore: semanticMinSimLocal.value,
        }

        const timeoutMs = 2500
        const resp: any = await new Promise((resolve) => {
          const handler = (evt: MessageEvent) => {
            clearTimeout(tid as any)
            worker.removeEventListener('message', handler)
            resolve(evt.data)
          }
          worker.addEventListener('message', handler)
          const tid = setTimeout(() => {
            worker.removeEventListener('message', handler)
            resolve({ results: [], error: 'timeout' })
          }, timeoutMs)
          worker.postMessage(req)
        })

        const merged = (resp?.results || []) as any[]
        combinedSemanticResults.value = merged.length ? merged : doLocalMerge()
      } else {
        combinedSemanticResults.value = doLocalMerge()
      }
    } else {
      combinedSemanticResults.value = []
    }
  } catch (error) {
    combinedSemanticResults.value = []
  } finally {
    isSemanticSearching.value = false
  }
  // 语义/混合输出交给父组件渲染
  try {
    const out = hybridModeLocal.value ? combinedSemanticResults.value : semanticResults.value
    emit('semantic-results', out)
  } catch {}
}
</script>

<style scoped>
.bookmark-search-box {
  position: relative;
}

.bookmark-search-input {
  width: 100%;
}

.semantic-btn {
  margin-left: 6px;
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
}

.semantic-config {
  margin-top: var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.debug-toggle, .hybrid-toggle {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
}

.semantic-config-panel {
  width: 100%;
}

.config-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
