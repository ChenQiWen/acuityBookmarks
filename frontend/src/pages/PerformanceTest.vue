<!--
  PerformanceTest - 性能测试页面
  用于测试虚拟化组件在大量数据下的性能表现
-->
<template>
  <div class="performance-test">
    <!-- 测试控制面板 -->
    <AcuityCard title="性能测试控制台" class="test-controls">
      <template #actions>
        <AcuityButton 
          v-if="!testRunning" 
          @click="runPerformanceTest"
          icon-left="play"
          variant="primary"
        >
          开始测试
        </AcuityButton>
        <AcuityButton 
          v-else
          @click="stopTest"
          icon-left="stop"
          variant="secondary"
        >
          停止测试
        </AcuityButton>
      </template>
      
      <div class="test-config">
        <div class="config-row">
          <label>数据量:</label>
          <select v-model="dataSize" :disabled="testRunning">
            <option value="1000">1,000 项</option>
            <option value="5000">5,000 项</option>
            <option value="10000">10,000 项</option>
            <option value="50000">50,000 项</option>
          </select>
        </div>
        
        <div class="config-row">
          <label>嵌套深度:</label>
          <input 
            v-model.number="maxDepth" 
            type="range" 
            min="3" 
            max="10" 
            :disabled="testRunning"
          />
          <span>{{ maxDepth }} 级</span>
        </div>
        
        <div class="config-row">
          <label>启用虚拟化:</label>
          <input 
            v-model="enableVirtualization" 
            type="checkbox" 
            :disabled="testRunning"
          />
        </div>
      </div>
      
      <!-- 测试结果 -->
      <div v-if="testResults" class="test-results">
        <h3>测试结果</h3>
        <div class="result-grid">
          <div class="result-item">
            <span class="result-label">数据生成:</span>
            <span class="result-value">{{ testResults.dataGeneration }}ms</span>
          </div>
          <div class="result-item">
            <span class="result-label">首次渲染:</span>
            <span class="result-value">{{ testResults.initialRender }}ms</span>
          </div>
          <div class="result-item">
            <span class="result-label">展开1000项:</span>
            <span class="result-value">{{ testResults.bulkExpand }}ms</span>
          </div>
          <div class="result-item">
            <span class="result-label">滚动性能:</span>
            <span class="result-value">{{ testResults.scrollPerformance }}ms</span>
          </div>
          <div class="result-item">
            <span class="result-label">内存使用:</span>
            <span class="result-value">{{ testResults.memoryUsage }}MB</span>
          </div>
          <div class="result-item">
            <span class="result-label">DOM节点数:</span>
            <span class="result-value">{{ testResults.domNodes }}</span>
          </div>
        </div>
        
        <!-- 性能评级 -->
        <div class="performance-rating">
          <span>性能评级: </span>
          <span :class="performanceRatingClass">{{ performanceRating }}</span>
        </div>
      </div>
    </AcuityCard>
    
    <!-- 实时性能监控 -->
    <AcuityCard title="实时性能监控" class="performance-monitor">
      <div class="monitor-grid">
        <div class="monitor-item">
          <span class="monitor-label">FPS:</span>
          <span class="monitor-value">{{ currentFPS }}</span>
        </div>
        <div class="monitor-item">
          <span class="monitor-label">渲染时间:</span>
          <span class="monitor-value">{{ renderTime }}ms</span>
        </div>
        <div class="monitor-item">
          <span class="monitor-label">可见节点:</span>
          <span class="monitor-value">{{ visibleNodes }}</span>
        </div>
        <div class="monitor-item">
          <span class="monitor-label">内存占用:</span>
          <span class="monitor-value">{{ memoryUsage }}MB</span>
        </div>
      </div>
    </AcuityCard>
    
    <!-- 测试数据展示 -->
    <div class="test-data-container">
      <AcuityCard 
        title="测试数据树" 
        :subtitle="`${testData.length} 项数据`"
        class="test-tree"
      >
        <template #actions>
          <AcuityButton 
            size="sm"
            variant="ghost"
            icon-left="refresh"
            @click="generateTestData"
            :disabled="testRunning"
          >
            重新生成
          </AcuityButton>
          <AcuityButton 
            size="sm"
            variant="ghost"
            icon-left="expand-all"
            @click="expandAll"
            :disabled="testRunning"
          >
            全部展开
          </AcuityButton>
          <AcuityButton 
            size="sm"
            variant="ghost"
            icon-left="collapse-all"
            @click="collapseAll"
            :disabled="testRunning"
          >
            全部收起
          </AcuityButton>
        </template>
        
        <!-- 虚拟化树 -->
        <VirtualBookmarkTree
          v-if="enableVirtualization"
          ref="virtualTreeRef"
          :bookmarks="testData"
          :expanded-ids="expandedIds"
          :selected-ids="selectedIds"
          :height="500"
          :item-height="32"
          @toggle="handleToggle"
          @select="handleSelect"
          @batch-operation="handleBatchOperation"
        />
        
        <!-- 传统树（用于对比） -->
        <div 
          v-else 
          class="traditional-tree"
          style="height: 500px; overflow-y: auto;"
        >
          <div v-for="item in testData" :key="item.id" class="tree-item">
            {{ item.title }} ({{ item.children?.length || 0 }} 子项)
          </div>
        </div>
      </AcuityCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { AcuityCard, AcuityButton } from '../components/ui'
import { VirtualBookmarkTree } from '../components/virtual'
import type { BookmarkNode } from '../types'

// 测试配置
const dataSize = ref(10000)
const maxDepth = ref(6)
const enableVirtualization = ref(true)
const testRunning = ref(false)

// 测试数据
const testData = ref<BookmarkNode[]>([])
const expandedIds = ref(new Set<string>())
const selectedIds = ref(new Set<string>())

// 性能监控
const currentFPS = ref(60)
const renderTime = ref(0)
const visibleNodes = ref(0)
const memoryUsage = ref(0)

// 测试结果
interface TestResults {
  dataGeneration: number
  initialRender: number
  bulkExpand: number
  scrollPerformance: number
  memoryUsage: number
  domNodes: number
}

const testResults = ref<TestResults | null>(null)

// 性能评级
const performanceRating = computed(() => {
  if (!testResults.value) return '未测试'
  
  const totalTime = testResults.value.initialRender + testResults.value.bulkExpand
  
  if (totalTime < 100) return '优秀'
  if (totalTime < 300) return '良好'
  if (totalTime < 1000) return '一般'
  return '需要优化'
})

const performanceRatingClass = computed(() => {
  const rating = performanceRating.value
  return {
    'rating-excellent': rating === '优秀',
    'rating-good': rating === '良好',
    'rating-fair': rating === '一般',
    'rating-poor': rating === '需要优化'
  }
})

// 生成测试数据
const generateTestData = () => {
  const start = performance.now()
  console.log(`🔄 开始生成 ${dataSize.value} 项测试数据...`)
  
  const generateId = () => Math.random().toString(36).substr(2, 9)
  
  const generateItem = (index: number, depth: number, parentPath = ''): BookmarkNode => {
    const id = generateId()
    const title = `${depth === 0 ? '根文件夹' : depth < 3 ? '文件夹' : '书签'} ${index + 1}`
    const path = parentPath ? `${parentPath}/${title}` : title
    
    const hasChildren = depth < maxDepth.value && Math.random() > 0.3
    
    const item: BookmarkNode = {
      id,
      title,
      url: hasChildren ? undefined : `https://example.com/${id}`,
      children: hasChildren ? [] : undefined
    }
    
    if (hasChildren && item.children) {
      const childCount = Math.floor(Math.random() * 10) + 1
      for (let i = 0; i < childCount; i++) {
        item.children.push(generateItem(i, depth + 1, path))
      }
    }
    
    return item
  }
  
  const data: BookmarkNode[] = []
  
  for (let i = 0; i < Math.min(10, dataSize.value); i++) {
    data.push(generateItem(i, 0))
  }
  
  testData.value = data
  
  const end = performance.now()
  console.log(`✅ 数据生成完成: ${(end - start).toFixed(2)}ms`)
  
  return end - start
}

// 运行性能测试
const runPerformanceTest = async () => {
  testRunning.value = true
  const results: Partial<TestResults> = {}
  
  try {
    // 1. 测试数据生成性能
    results.dataGeneration = generateTestData()
    
    // 2. 测试首次渲染性能
    const renderStart = performance.now()
    await new Promise(resolve => requestAnimationFrame(resolve))
    results.initialRender = performance.now() - renderStart
    
    // 3. 测试批量展开性能
    const expandStart = performance.now()
    await expandAll()
    results.bulkExpand = performance.now() - expandStart
    
    // 4. 测试滚动性能
    results.scrollPerformance = await testScrollPerformance()
    
    // 5. 测试内存使用
    results.memoryUsage = getMemoryUsage()
    
    // 6. 统计DOM节点数
    results.domNodes = document.querySelectorAll('*').length
    
    testResults.value = results as TestResults
    
  } catch (error) {
    console.error('性能测试失败:', error)
  } finally {
    testRunning.value = false
  }
}

// 测试滚动性能
const testScrollPerformance = (): Promise<number> => {
  return new Promise((resolve) => {
    const virtualTreeRef = document.querySelector('.virtual-tree')
    if (!virtualTreeRef) {
      resolve(0)
      return
    }
    
    const start = performance.now()
    let frameCount = 0
    const targetFrames = 60 // 测试60帧
    
    const scroll = () => {
      frameCount++
      virtualTreeRef.scrollTop = (frameCount * 10) % virtualTreeRef.scrollHeight
      
      if (frameCount < targetFrames) {
        requestAnimationFrame(scroll)
      } else {
        const end = performance.now()
        resolve(end - start)
      }
    }
    
    requestAnimationFrame(scroll)
  })
}

// 获取内存使用情况
const getMemoryUsage = (): number => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    return Math.round(memory.usedJSHeapSize / 1024 / 1024)
  }
  return 0
}

// 展开所有文件夹
const expandAll = async () => {
  const collectIds = (items: BookmarkNode[]): string[] => {
    const ids: string[] = []
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        ids.push(item.id)
        ids.push(...collectIds(item.children))
      }
    }
    return ids
  }
  
  const allIds = collectIds(testData.value)
  
  // 批量添加，触发单次响应式更新
  const newSet = new Set(expandedIds.value)
  allIds.forEach(id => newSet.add(id))
  expandedIds.value = newSet
  
  // 等待DOM更新
  await new Promise(resolve => requestAnimationFrame(resolve))
}

// 收起所有文件夹
const collapseAll = () => {
  expandedIds.value = new Set()
}

// 事件处理
const handleToggle = (id: string) => {
  const newSet = new Set(expandedIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  expandedIds.value = newSet
}

const handleSelect = (id: string) => {
  const newSet = new Set<string>()
  newSet.add(id)
  selectedIds.value = newSet
}

const handleBatchOperation = (type: string, data: any) => {
  console.log('批量操作:', type, data)
}

const stopTest = () => {
  testRunning.value = false
}

// 实时性能监控
const startPerformanceMonitoring = () => {
  let lastTime = performance.now()
  let frameCount = 0
  
  const monitor = () => {
    frameCount++
    const now = performance.now()
    
    if (now - lastTime >= 1000) {
      currentFPS.value = Math.round((frameCount * 1000) / (now - lastTime))
      frameCount = 0
      lastTime = now
      
      // 更新其他监控指标
      memoryUsage.value = getMemoryUsage()
      visibleNodes.value = document.querySelectorAll('.tree-item').length
    }
    
    requestAnimationFrame(monitor)
  }
  
  monitor()
}

// 生命周期
onMounted(() => {
  generateTestData()
  startPerformanceMonitoring()
})

// 监听数据变化
watch([dataSize, maxDepth], () => {
  if (!testRunning.value) {
    generateTestData()
  }
})
</script>

<style scoped>
.performance-test {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 1200px;
  margin: 0 auto;
}

.test-controls {
  margin-bottom: var(--space-4);
}

.test-config {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.config-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.config-row label {
  font-weight: var(--font-weight-medium);
  min-width: 80px;
}

.config-row select,
.config-row input[type="range"] {
  flex: 1;
}

.test-results {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  margin-top: var(--space-4);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2);
  background-color: var(--color-surface-variant);
  border-radius: var(--radius-base);
}

.result-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.result-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.performance-rating {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.rating-excellent { color: var(--color-success); }
.rating-good { color: var(--color-info); }
.rating-fair { color: var(--color-warning); }
.rating-poor { color: var(--color-error); }

.performance-monitor {
  margin-bottom: var(--space-4);
}

.monitor-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.monitor-item {
  text-align: center;
  padding: var(--space-3);
  background-color: var(--color-surface-variant);
  border-radius: var(--radius-base);
}

.monitor-label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}

.monitor-value {
  display: block;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.test-data-container {
  flex: 1;
  min-height: 0;
}

.test-tree {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.traditional-tree {
  padding: var(--space-2);
}

.tree-item {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

</style>