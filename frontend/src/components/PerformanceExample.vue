<!--
  性能监控集成示例组件
  展示如何在Vue组件中使用性能监控工具
-->

<template>
  <div class="performance-example pa-4">
    <v-card>
      <v-card-title class="text-h6">
        <v-icon class="mr-2">mdi-speedometer</v-icon>
        性能监控示例
      </v-card-title>
      
      <v-card-text>
        <!-- 性能指标显示 -->
        <div class="metrics-section mb-4">
          <h3 class="text-h6 mb-2">📊 实时性能指标</h3>
          
          <v-row>
            <v-col cols="12" md="3">
              <v-card color="primary" dark>
                <v-card-text>
                  <div class="text-h4">{{ startupTime.toFixed(0) }}ms</div>
                  <div>页面启动时间</div>
                </v-card-text>
              </v-card>
            </v-col>
            
            <v-col cols="12" md="3">
              <v-card color="success" dark>
                <v-card-text>
                  <div class="text-h4">{{ memoryUsage }}MB</div>
                  <div>内存使用</div>
                </v-card-text>
              </v-card>
            </v-col>
            
            <v-col cols="12" md="3">
              <v-card color="info" dark>
                <v-card-text>
                  <div class="text-h4">{{ aiAnalysisCount }}</div>
                  <div>AI分析次数</div>
                </v-card-text>
              </v-card>
            </v-col>
            
            <v-col cols="12" md="3">
              <v-card color="warning" dark>
                <v-card-text>
                  <div class="text-h4">{{ userActionCount }}</div>
                  <div>用户操作次数</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>
        
        <!-- 测试操作区域 -->
        <div class="test-section mb-4">
          <h3 class="text-h6 mb-2">🧪 性能测试操作</h3>
          
          <v-row>
            <v-col cols="12" md="6">
              <v-btn
                @click="simulateAIAnalysis"
                :loading="isAnalyzing"
                color="primary"
                block
                large
              >
                <v-icon left>mdi-brain</v-icon>
                模拟AI分析 ({{ mockBookmarks.length }}项)
              </v-btn>
            </v-col>
            
            <v-col cols="12" md="6">
              <v-btn
                @click="simulateSearch"
                :loading="isSearching"
                color="secondary"
                block
                large
              >
                <v-icon left>mdi-magnify</v-icon>
                模拟智能搜索
              </v-btn>
            </v-col>
          </v-row>
          
          <v-row class="mt-2">
            <v-col cols="12" md="6">
              <v-btn
                @click="checkMemoryUsage"
                color="info"
                block
                outlined
              >
                <v-icon left>mdi-memory</v-icon>
                检查内存使用
              </v-btn>
            </v-col>
            
            <v-col cols="12" md="6">
              <v-btn
                @click="generateTestData"
                color="success"
                block
                outlined
              >
                <v-icon left>mdi-database-plus</v-icon>
                生成测试数据
              </v-btn>
            </v-col>
          </v-row>
        </div>
        
        <!-- 性能日志 -->
        <div class="logs-section">
          <h3 class="text-h6 mb-2">📋 性能日志</h3>
          
          <v-card outlined max-height="300" style="overflow-y: auto;">
            <v-list dense>
              <v-list-item
                v-for="(log, index) in performanceLogs"
                :key="index"
                class="text-caption"
              >
                <v-list-item-content>
                  <div class="d-flex align-center">
                    <v-icon
                      :color="getLogColor(log.type)"
                      size="16"
                      class="mr-2"
                    >
                      {{ getLogIcon(log.type) }}
                    </v-icon>
                    <span class="mr-2 grey--text">{{ formatTime(log.timestamp) }}</span>
                    <span>{{ log.message }}</span>
                  </div>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-card>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { performanceMonitor } from '../utils/performance-monitor'

// 响应式状态
const startupTime = ref(0)
const memoryUsage = ref(0)
const aiAnalysisCount = ref(0)
const userActionCount = ref(0)
const isAnalyzing = ref(false)
const isSearching = ref(false)
const performanceLogs = ref<Array<{
  timestamp: number
  type: string
  message: string
}>>([])

// 模拟数据
const mockBookmarks = ref([
  { id: '1', title: 'Vue.js 官方文档', url: 'https://vuejs.org' },
  { id: '2', title: 'TypeScript 手册', url: 'https://typescriptlang.org' },
  { id: '3', title: 'GitHub', url: 'https://github.com' },
  { id: '4', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { id: '5', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }
])

// 定时器引用
let memoryCheckInterval: NodeJS.Timeout | null = null

/**
 * 组件挂载时的初始化
 */
onMounted(() => {
  console.log('🚀 PerformanceExample 组件已挂载')
  
  // 测量组件启动时间
  const timer = performanceMonitor.measureStartupTime()
  startupTime.value = timer.end()
  
  addLog('startup', `组件启动完成，耗时 ${startupTime.value.toFixed(2)}ms`)
  
  // 定期检查内存使用
  memoryCheckInterval = setInterval(() => {
    checkMemoryUsage()
  }, 10000) // 每10秒检查一次
  
  // 追踪组件挂载事件
  performanceMonitor.trackUserAction('component_mounted', {
    component: 'PerformanceExample'
  })
})

/**
 * 组件卸载时的清理
 */
onUnmounted(() => {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval)
  }
  
  performanceMonitor.trackUserAction('component_unmounted', {
    component: 'PerformanceExample',
    duration: Date.now() - startupTime.value
  })
})

/**
 * 模拟AI分析过程
 */
async function simulateAIAnalysis() {
  if (isAnalyzing.value) return
  
  isAnalyzing.value = true
  addLog('ai', '开始AI分析...')
  
  try {
    await performanceMonitor.measureAIAnalysis(
      async () => {
        // 模拟AI分析延迟
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
        
        // 模拟分析结果
        return mockBookmarks.value.map(bookmark => ({
          id: bookmark.id,
          category: Math.random() > 0.5 ? 'tech' : 'general',
          confidence: Math.random() * 0.3 + 0.7
        }))
      },
      mockBookmarks.value.length,
      'classification'
    )
    
    aiAnalysisCount.value++
    addLog('ai', `AI分析完成，处理了 ${mockBookmarks.value.length} 个书签`)
    
  } catch (error) {
    addLog('error', `AI分析失败: ${(error as Error).message}`)
  } finally {
    isAnalyzing.value = false
  }
}

/**
 * 模拟智能搜索
 */
async function simulateSearch() {
  if (isSearching.value) return
  
  isSearching.value = true
  addLog('search', '开始智能搜索...')
  
  try {
    const searchQuery = ['Vue', 'TypeScript', 'JavaScript', 'React'][Math.floor(Math.random() * 4)]
    
    await performanceMonitor.measureAIAnalysis(
      async () => {
        // 模拟搜索延迟
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
        
        // 模拟搜索结果
        return mockBookmarks.value.filter(() => Math.random() > 0.5)
      },
      mockBookmarks.value.length,
      'search'
    )
    
    addLog('search', `搜索完成，查询: "${searchQuery}"`)
    
    performanceMonitor.trackUserAction('search_performed', {
      query: searchQuery,
      results_count: Math.floor(Math.random() * 5) + 1
    })
    
  } catch (error) {
    addLog('error', `搜索失败: ${(error as Error).message}`)
  } finally {
    isSearching.value = false
  }
}

/**
 * 检查内存使用情况
 */
function checkMemoryUsage() {
  performanceMonitor.monitorMemoryUsage()
  
  // 更新显示的内存使用（模拟）
  if ('memory' in performance) {
    const memory = (performance as any).memory
    memoryUsage.value = Math.round(memory.usedJSHeapSize / 1024 / 1024)
  } else {
    memoryUsage.value = Math.round(20 + Math.random() * 30) // 模拟值
  }
  
  addLog('memory', `内存使用: ${memoryUsage.value}MB`)
}

/**
 * 生成测试数据
 */
function generateTestData() {
  const newBookmarkCount = Math.floor(Math.random() * 10) + 5
  
  for (let i = 0; i < newBookmarkCount; i++) {
    mockBookmarks.value.push({
      id: `generated_${Date.now()}_${i}`,
      title: `测试书签 ${i + 1}`,
      url: `https://example${i}.com`
    })
  }
  
  addLog('data', `生成了 ${newBookmarkCount} 个测试书签`)
  
  performanceMonitor.trackUserAction('test_data_generated', {
    count: newBookmarkCount,
    total_bookmarks: mockBookmarks.value.length
  })
  
  userActionCount.value++
}

/**
 * 添加日志条目
 */
function addLog(type: string, message: string) {
  performanceLogs.value.unshift({
    timestamp: Date.now(),
    type,
    message
  })
  
  // 限制日志数量
  if (performanceLogs.value.length > 50) {
    performanceLogs.value = performanceLogs.value.slice(0, 50)
  }
}

/**
 * 获取日志图标
 */
function getLogIcon(type: string): string {
  const icons: Record<string, string> = {
    startup: 'mdi-rocket-launch',
    ai: 'mdi-brain',
    search: 'mdi-magnify',
    memory: 'mdi-memory',
    data: 'mdi-database',
    error: 'mdi-alert-circle'
  }
  return icons[type] || 'mdi-information'
}

/**
 * 获取日志颜色
 */
function getLogColor(type: string): string {
  const colors: Record<string, string> = {
    startup: 'success',
    ai: 'primary',
    search: 'info',
    memory: 'warning',
    data: 'success',
    error: 'error'
  }
  return colors[type] || 'grey'
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<style scoped>
.performance-example {
  max-width: 1200px;
  margin: 0 auto;
}

.metrics-section .v-card {
  text-align: center;
}

.logs-section .v-list-item {
  min-height: 32px !important;
}
</style>
