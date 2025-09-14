<template>
  <div class="super-cache-demo">
    <div class="demo-header">
      <h1>🚀 超级书签缓存 - 性能对比演示</h1>
      <p>对比传统递归计算 vs 超级缓存预计算的性能差异</p>
    </div>

    <!-- 初始化控制区 -->
    <Card class="init-controls">
      <template #header>
        <div class="card-header">
          <Icon name="mdi-rocket-launch" color="primary" />
          <span>初始化控制</span>
        </div>
      </template>
      
      <div class="control-row">
        <Button 
          @click="initializeSuperCache"
          :loading="isInitializing"
          :disabled="isCacheReady"
          variant="primary"
        >
          <Icon name="mdi-rocket" />
          初始化超级缓存
        </Button>
        
        <Button 
          @click="clearCache"
          :disabled="!isCacheReady"
          variant="outline"
        >
          <Icon name="mdi-trash-can" />
          清空缓存
        </Button>
        
        <Button 
          @click="refreshCache"
          :loading="isRefreshing"
          :disabled="!isCacheReady"
          variant="outline"
        >
          <Icon name="mdi-refresh" />
          刷新缓存
        </Button>
      </div>
      
      <div v-if="initError" class="error-message">
        <Icon name="mdi-alert-circle" />
        {{ initError }}
      </div>
      
      <div v-if="isCacheReady" class="success-message">
        <Icon name="mdi-check-circle" />
        超级缓存已就绪！处理时间: {{ processingTime }}ms
      </div>
    </Card>

    <!-- 缓存状态面板 -->
    <Card v-if="isCacheReady" class="cache-status">
      <template #header>
        <div class="card-header">
          <Icon name="mdi-chart-line" color="success" />
          <span>缓存状态 & 统计</span>
        </div>
      </template>
      
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">书签总数</div>
          <div class="stat-value primary">{{ globalStats.totalBookmarks }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">文件夹总数</div>
          <div class="stat-value secondary">{{ globalStats.totalFolders }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">最大深度</div>
          <div class="stat-value">{{ globalStats.maxDepth }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">平均深度</div>
          <div class="stat-value">{{ globalStats.avgDepth }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">索引数量</div>
          <div class="stat-value success">{{ globalStats.memoryUsage.indexCount }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">内存使用</div>
          <div class="stat-value">{{ formatBytes(globalStats.memoryUsage.estimatedBytes) }}</div>
        </div>
      </div>

      <div class="top-domains">
        <h4>Top 域名分布</h4>
        <div class="domain-list">
          <div 
            v-for="domain in globalStats.topDomains.slice(0, 8)" 
            :key="domain.domain"
            class="domain-item"
          >
            <span class="domain-name">{{ domain.domain }}</span>
            <span class="domain-count">{{ domain.count }}</span>
          </div>
        </div>
      </div>
    </Card>

    <!-- 性能测试区 -->
    <Card class="performance-tests">
      <template #header>
        <div class="card-header">
          <Icon name="mdi-speedometer" color="warning" />
          <span>性能对比测试</span>
        </div>
      </template>
      
      <div class="test-controls">
        <Button 
          @click="runPerformanceTest"
          :loading="isTestRunning"
          :disabled="!isCacheReady"
          variant="primary"
        >
          <Icon name="mdi-play" />
          运行性能测试
        </Button>
        
        <div class="test-options">
          <label>
            <input v-model="testIterations" type="number" min="10" max="10000" />
            测试次数
          </label>
        </div>
      </div>
      
      <div v-if="performanceResults" class="performance-results">
        <h4>🎯 性能测试结果</h4>
        
        <div class="result-comparison">
          <div class="result-item traditional">
            <div class="result-title">
              <Icon name="mdi-turtle" />
              传统递归计算
            </div>
            <div class="result-metrics">
              <div class="metric">
                <span class="metric-label">总耗时:</span>
                <span class="metric-value">{{ performanceResults.traditional.totalTime.toFixed(2) }}ms</span>
              </div>
              <div class="metric">
                <span class="metric-label">平均耗时:</span>
                <span class="metric-value">{{ performanceResults.traditional.avgTime.toFixed(3) }}ms</span>
              </div>
              <div class="metric">
                <span class="metric-label">最大耗时:</span>
                <span class="metric-value">{{ performanceResults.traditional.maxTime.toFixed(3) }}ms</span>
              </div>
            </div>
          </div>
          
          <div class="result-item optimized">
            <div class="result-title">
              <Icon name="mdi-rocket" />
              超级缓存预计算
            </div>
            <div class="result-metrics">
              <div class="metric">
                <span class="metric-label">总耗时:</span>
                <span class="metric-value">{{ performanceResults.optimized.totalTime.toFixed(2) }}ms</span>
              </div>
              <div class="metric">
                <span class="metric-label">平均耗时:</span>
                <span class="metric-value">{{ performanceResults.optimized.avgTime.toFixed(3) }}ms</span>
              </div>
              <div class="metric">
                <span class="metric-label">最大耗时:</span>
                <span class="metric-value">{{ performanceResults.optimized.maxTime.toFixed(3) }}ms</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="improvement-summary">
          <div class="improvement-item">
            <Icon name="mdi-trending-up" color="success" />
            <span>性能提升: {{ performanceResults.improvement.toFixed(1) }}x</span>
          </div>
          <div class="improvement-item">
            <Icon name="mdi-clock-fast" color="success" />
            <span>节省时间: {{ performanceResults.timeSaved.toFixed(2) }}ms</span>
          </div>
          <div class="improvement-item">
            <Icon name="mdi-percent" color="success" />
            <span>效率提升: {{ performanceResults.efficiencyGain.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </Card>

    <!-- 实时对比演示 -->
    <div class="demo-comparison">
      <Card class="demo-section">
        <template #header>
          <div class="card-header">
            <Icon name="mdi-turtle" color="warning" />
            <span>传统递归计算 (慢)</span>
          </div>
        </template>
        
        <div v-if="isCacheReady" class="tree-demo">
          <BookmarkTreeNode
            v-for="node in bookmarkTree"
            :key="'traditional-' + node.id"
            :node="node"
            :level="0"
            :expanded-folders="expandedFolders"
            @toggle-folder="handleFolderToggle"
          />
        </div>
      </Card>
      
      <Card class="demo-section">
        <template #header>
          <div class="card-header">
            <Icon name="mdi-rocket" color="success" />
            <span>超级缓存预计算 (快)</span>
          </div>
        </template>
        
        <div v-if="isCacheReady" class="tree-demo">
          <BookmarkTreeNodeSuper
            v-for="node in superBookmarkTree"
            :key="'super-' + node.id"
            :node="node"
            :level="0"
            :expanded-folders="expandedFolders"
            @toggle-folder="handleFolderToggle"
          />
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Card, Button, Icon } from '../components/ui'
import BookmarkTreeNode from '../components/BookmarkTreeNode.vue'
import BookmarkTreeNodeSuper from '../components/BookmarkTreeNodeSuper.vue'
import { superGlobalBookmarkCache } from '../utils/super-global-cache'
import type { BookmarkNode } from '../types'
import type { SuperEnhancedBookmarkNode } from '../types/enhanced-bookmark'

// 状态管理
const isInitializing = ref(false)
const isRefreshing = ref(false)
const isTestRunning = ref(false)
const isCacheReady = ref(false)
const initError = ref('')
const processingTime = ref(0)

// 性能测试配置
const testIterations = ref(1000)

// 书签数据
const bookmarkTree = ref<BookmarkNode[]>([])
const superBookmarkTree = ref<SuperEnhancedBookmarkNode[]>([])
const expandedFolders = ref<Set<string>>(new Set())

// 性能测试结果
const performanceResults = ref<{
  traditional: {
    totalTime: number
    avgTime: number
    maxTime: number
  }
  optimized: {
    totalTime: number
    avgTime: number
    maxTime: number
  }
  improvement: number
  timeSaved: number
  efficiencyGain: number
} | null>(null)

// 全局统计
const globalStats = computed(() => {
  if (!isCacheReady.value) {
    return {
      totalBookmarks: 0,
      totalFolders: 0,
      maxDepth: 0,
      avgDepth: 0,
      topDomains: [],
      memoryUsage: { indexCount: 0, estimatedBytes: 0 }
    }
  }
  
  return superGlobalBookmarkCache.getGlobalStats()
})

// 方法
const initializeSuperCache = async () => {
  isInitializing.value = true
  initError.value = ''
  
  try {
    const startTime = performance.now()
    await superGlobalBookmarkCache.initialize()
    processingTime.value = Math.round(performance.now() - startTime)
    
    // 获取数据用于对比演示
    const chromeData = await getChromeBookmarkData()
    bookmarkTree.value = transformToBookmarkNode(chromeData)
    superBookmarkTree.value = superGlobalBookmarkCache.getBookmarkTree()
    
    isCacheReady.value = true
    
  } catch (error) {
    console.error('初始化失败:', error)
    initError.value = error instanceof Error ? error.message : '未知错误'
  } finally {
    isInitializing.value = false
  }
}

const clearCache = async () => {
  await superGlobalBookmarkCache.clearCache()
  isCacheReady.value = false
  bookmarkTree.value = []
  superBookmarkTree.value = []
  performanceResults.value = null
  processingTime.value = 0
}

const refreshCache = async () => {
  isRefreshing.value = true
  
  try {
    await superGlobalBookmarkCache.refresh(true)
    superBookmarkTree.value = superGlobalBookmarkCache.getBookmarkTree()
  } catch (error) {
    console.error('刷新失败:', error)
  } finally {
    isRefreshing.value = false
  }
}

const runPerformanceTest = async () => {
  if (!isCacheReady.value) return
  
  isTestRunning.value = true
  
  try {
    // 测试传统递归计算性能
    const traditionalResults = await testTraditionalPerformance()
    
    // 测试超级缓存性能
    const optimizedResults = await testOptimizedPerformance()
    
    // 计算性能提升
    const improvement = traditionalResults.avgTime / optimizedResults.avgTime
    const timeSaved = traditionalResults.totalTime - optimizedResults.totalTime
    const efficiencyGain = ((traditionalResults.avgTime - optimizedResults.avgTime) / traditionalResults.avgTime) * 100
    
    performanceResults.value = {
      traditional: traditionalResults,
      optimized: optimizedResults,
      improvement,
      timeSaved,
      efficiencyGain
    }
    
  } catch (error) {
    console.error('性能测试失败:', error)
  } finally {
    isTestRunning.value = false
  }
}

// 传统递归计算性能测试
const testTraditionalPerformance = async () => {
  const times: number[] = []
  
  for (let i = 0; i < testIterations.value; i++) {
    const startTime = performance.now()
    
    // 模拟传统递归计算
    let totalCount = 0
    const countBookmarks = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          totalCount++
        } else if (node.children) {
          countBookmarks(node.children)
        }
      }
    }
    
    countBookmarks(bookmarkTree.value)
    
    const endTime = performance.now()
    times.push(endTime - startTime)
  }
  
  return {
    totalTime: times.reduce((sum, time) => sum + time, 0),
    avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
    maxTime: Math.max(...times)
  }
}

// 超级缓存性能测试
const testOptimizedPerformance = async () => {
  const times: number[] = []
  
  for (let i = 0; i < testIterations.value; i++) {
    const startTime = performance.now()
    
    // 使用超级缓存的O(1)查询
    const stats = superGlobalBookmarkCache.getGlobalStats()
    console.log('Super cache stats:', stats.totalBookmarks)
    
    const endTime = performance.now()
    times.push(endTime - startTime)
  }
  
  return {
    totalTime: times.reduce((sum, time) => sum + time, 0),
    avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
    maxTime: Math.max(...times)
  }
}

const handleFolderToggle = (folderId: string) => {
  if (expandedFolders.value.has(folderId)) {
    expandedFolders.value.delete(folderId)
  } else {
    // 互斥展开：关闭其他同级文件夹
    const siblingIds = superGlobalBookmarkCache.getSiblingIds(folderId)
    siblingIds.forEach(id => expandedFolders.value.delete(id))
    
    expandedFolders.value.add(folderId)
  }
}

// 辅助方法
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getChromeBookmarkData = async (): Promise<chrome.bookmarks.BookmarkTreeNode[]> => {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.getTree((tree) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(tree)
      })
    } else {
      // 模拟数据
      resolve([{
        id: '0',
        title: '',
        dateAdded: Date.now(),
        syncing: false,
        children: [
          {
            id: '1',
            title: '书签栏',
            dateAdded: Date.now(),
            syncing: false,
            children: [
              {
                id: '2',
                title: 'Vue.js',
                url: 'https://vuejs.org/',
                dateAdded: Date.now() - 86400000,
                syncing: false
              }
            ]
          }
        ]
      }])
    }
  })
}

const transformToBookmarkNode = (chromeNodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkNode[] => {
  return chromeNodes.map(node => ({
    id: node.id,
    title: node.title,
    url: node.url,
    parentId: node.parentId,
    dateAdded: node.dateAdded,
    index: node.index,
    children: node.children ? transformToBookmarkNode(node.children) : undefined
  }))
}

// 生命周期
onMounted(() => {
  // 自动检查缓存状态
  const status = superGlobalBookmarkCache.getCacheStatus()
  if (status === 'fresh' || status === 'stale') {
    isCacheReady.value = true
    try {
      superBookmarkTree.value = superGlobalBookmarkCache.getBookmarkTree()
    } catch (error) {
      console.warn('获取缓存数据失败:', error)
      isCacheReady.value = false
    }
  }
})
</script>

<style scoped>
.super-cache-demo {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.demo-header {
  text-align: center;
  margin-bottom: 32px;
}

.demo-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.demo-header p {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.control-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.error-message, .success-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-weight: 500;
}

.error-message {
  background: var(--color-error-alpha-10);
  color: var(--color-error);
  border: 1px solid var(--color-error-alpha-30);
}

.success-message {
  background: var(--color-success-alpha-10);
  color: var(--color-success);
  border: 1px solid var(--color-success-alpha-30);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  background: var(--color-surface-variant);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-value.primary { color: var(--color-primary); }
.stat-value.secondary { color: var(--color-text-secondary); }
.stat-value.success { color: var(--color-success); }

.top-domains h4 {
  margin: 0 0 12px 0;
  color: var(--color-text-primary);
}

.domain-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.domain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-surface);
  border-radius: 6px;
  font-size: 13px;
}

.domain-name {
  color: var(--color-text-primary);
  font-weight: 500;
}

.domain-count {
  color: var(--color-text-secondary);
  background: var(--color-surface-variant);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.test-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.test-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.test-options input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.performance-results h4 {
  margin: 0 0 20px 0;
  color: var(--color-text-primary);
}

.result-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.result-item {
  padding: 20px;
  border-radius: 12px;
  border: 2px solid;
}

.result-item.traditional {
  background: var(--color-warning-alpha-5);
  border-color: var(--color-warning-alpha-30);
}

.result-item.optimized {
  background: var(--color-success-alpha-5);
  border-color: var(--color-success-alpha-30);
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 16px;
}

.result-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-surface-variant);
  border-radius: 6px;
}

.metric-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.metric-value {
  font-weight: 600;
  color: var(--color-text-primary);
}

.improvement-summary {
  display: flex;
  justify-content: center;
  gap: 32px;
  padding: 20px;
  background: linear-gradient(135deg, var(--color-success-alpha-10), var(--color-primary-alpha-10));
  border-radius: 12px;
  border: 1px solid var(--color-success-alpha-30);
}

.improvement-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--color-success);
}

.demo-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.demo-section {
  height: 600px;
}

.tree-demo {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
}

@media (max-width: 768px) {
  .demo-comparison {
    grid-template-columns: 1fr;
  }
  
  .result-comparison {
    grid-template-columns: 1fr;
  }
  
  .improvement-summary {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
}
</style>
