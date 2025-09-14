<template>
  <div class="super-cache-dashboard">
    <!-- 顶部导航 -->
    <div class="dashboard-header">
      <h1>🚀 超级书签缓存系统 - 控制台</h1>
      <p>全面管理和监控超级书签缓存系统的性能与状态</p>
      
      <div class="header-actions">
        <Button 
          @click="refreshAllData"
          :loading="isRefreshing"
          variant="primary"
          size="lg"
        >
          <Icon name="mdi-refresh" />
          刷新所有数据
        </Button>
        
        <Button 
          @click="openDemo"
          variant="outline"
          size="lg"
        >
          <Icon name="mdi-play-circle" />
          性能对比演示
        </Button>
      </div>
    </div>

    <!-- 系统状态总览 -->
    <Card class="status-overview">
      <template #header>
        <div class="card-header">
          <Icon name="mdi-gauge" color="primary" />
          <span>系统状态总览</span>
          <div class="status-indicator" :class="systemStatusClass">
            <div class="status-dot"></div>
            {{ systemStatusText }}
          </div>
        </div>
      </template>
      
      <div class="overview-grid">
        <div class="overview-item">
          <div class="overview-icon primary">
            <Icon name="mdi-database" />
          </div>
          <div class="overview-content">
            <div class="overview-value">{{ cacheStatus }}</div>
            <div class="overview-label">缓存状态</div>
          </div>
        </div>
        
        <div class="overview-item">
          <div class="overview-icon success">
            <Icon name="mdi-bookmark-multiple" />
          </div>
          <div class="overview-content">
            <div class="overview-value">{{ totalBookmarks }}</div>
            <div class="overview-label">书签总数</div>
          </div>
        </div>
        
        <div class="overview-item">
          <div class="overview-icon warning">
            <Icon name="mdi-folder-multiple" />
          </div>
          <div class="overview-content">
            <div class="overview-value">{{ totalFolders }}</div>
            <div class="overview-label">文件夹总数</div>
          </div>
        </div>
        
        <div class="overview-item">
          <div class="overview-icon info">
            <Icon name="mdi-speedometer" />
          </div>
          <div class="overview-content">
            <div class="overview-value">{{ processingTime }}ms</div>
            <div class="overview-label">处理时间</div>
          </div>
        </div>
        
        <div class="overview-item">
          <div class="overview-icon secondary">
            <Icon name="mdi-memory" />
          </div>
          <div class="overview-content">
            <div class="overview-value">{{ formatBytes(memoryUsage) }}</div>
            <div class="overview-label">内存使用</div>
          </div>
        </div>
        
        <div class="overview-item">
          <div class="overview-icon error">
            <Icon name="mdi-chart-line" />
          </div>
          <div class="overview-content">
            <div class="overview-value">{{ maxDepth }}</div>
            <div class="overview-label">最大深度</div>
          </div>
        </div>
      </div>
    </Card>

    <!-- 缓存详细信息 -->
    <div class="dashboard-grid">
      <!-- 缓存元数据 -->
      <Card class="cache-metadata">
        <template #header>
          <div class="card-header">
            <Icon name="mdi-information" color="info" />
            <span>缓存元数据</span>
          </div>
        </template>
        
        <div class="metadata-list">
          <div class="metadata-item">
            <span class="metadata-key">版本号:</span>
            <span class="metadata-value">{{ cacheVersion }}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-key">创建时间:</span>
            <span class="metadata-value">{{ formatTime(processedAt) }}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-key">数据哈希:</span>
            <span class="metadata-value mono">{{ dataHash }}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-key">索引数量:</span>
            <span class="metadata-value">{{ indexCount }}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-key">缓存命中率:</span>
            <span class="metadata-value">{{ (cacheHitRate * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </Card>

      <!-- 性能统计 -->
      <Card class="performance-stats">
        <template #header>
          <div class="card-header">
            <Icon name="mdi-chart-timeline" color="success" />
            <span>性能统计</span>
          </div>
        </template>
        
        <div class="performance-chart">
          <div class="performance-item">
            <div class="performance-label">数据转换</div>
            <div class="performance-bar">
              <div class="performance-fill" :style="{ width: getPerformancePercent('transformTime') + '%' }"></div>
            </div>
            <div class="performance-time">{{ performanceStats.transformTime?.toFixed(2) }}ms</div>
          </div>
          
          <div class="performance-item">
            <div class="performance-label">索引构建</div>
            <div class="performance-bar">
              <div class="performance-fill" :style="{ width: getPerformancePercent('indexTime') + '%' }"></div>
            </div>
            <div class="performance-time">{{ performanceStats.indexTime?.toFixed(2) }}ms</div>
          </div>
          
          <div class="performance-item">
            <div class="performance-label">清理检测</div>
            <div class="performance-bar">
              <div class="performance-fill" :style="{ width: getPerformancePercent('cleanupTime') + '%' }"></div>
            </div>
            <div class="performance-time">{{ performanceStats.cleanupTime?.toFixed(2) }}ms</div>
          </div>
          
          <div class="performance-item">
            <div class="performance-label">搜索索引</div>
            <div class="performance-bar">
              <div class="performance-fill" :style="{ width: getPerformancePercent('searchTime') + '%' }"></div>
            </div>
            <div class="performance-time">{{ performanceStats.searchTime?.toFixed(2) }}ms</div>
          </div>
          
          <div class="performance-item">
            <div class="performance-label">虚拟化</div>
            <div class="performance-bar">
              <div class="performance-fill" :style="{ width: getPerformancePercent('virtualTime') + '%' }"></div>
            </div>
            <div class="performance-time">{{ performanceStats.virtualTime?.toFixed(2) }}ms</div>
          </div>
        </div>
      </Card>
    </div>

    <!-- 域名分析 -->
    <Card class="domain-analysis">
      <template #header>
        <div class="card-header">
          <Icon name="mdi-web" color="warning" />
          <span>域名分布分析 (Top 20)</span>
        </div>
      </template>
      
      <div class="domain-list">
        <div 
          v-for="domain in topDomains" 
          :key="domain.domain"
          class="domain-item"
        >
          <div class="domain-info">
            <div class="domain-name">{{ domain.domain }}</div>
            <div class="domain-count">{{ domain.count }} 个书签</div>
          </div>
          <div class="domain-bar">
            <div 
              class="domain-fill" 
              :style="{ width: (domain.count / maxDomainCount * 100) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </Card>

    <!-- 操作工具 -->
    <Card class="operation-tools">
      <template #header>
        <div class="card-header">
          <Icon name="mdi-tools" color="secondary" />
          <span>操作工具</span>
        </div>
      </template>
      
      <div class="tools-grid">
        <Button 
          @click="clearCache"
          :loading="isClearing"
          variant="outline"
          color="error"
          block
        >
          <Icon name="mdi-delete-sweep" />
          清空缓存
        </Button>
        
        <Button 
          @click="exportCacheData"
          variant="outline"
          block
        >
          <Icon name="mdi-export" />
          导出缓存数据
        </Button>
        
        <Button 
          @click="runPerformanceTest"
          :loading="isTestRunning"
          variant="outline"
          block
        >
          <Icon name="mdi-test-tube" />
          性能测试
        </Button>
        
        <Button 
          @click="analyzeCleanupIssues"
          variant="outline"
          block
        >
          <Icon name="mdi-magnify" />
          清理分析
        </Button>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
/* eslint-env browser */
import { ref, computed, onMounted } from 'vue'
import { Card, Button, Icon } from '../components/ui'
import { superGlobalBookmarkCache } from '../utils/super-global-cache'

// 状态管理
const isRefreshing = ref(false)
const isClearing = ref(false)
const isTestRunning = ref(false)

// 缓存数据
const cacheMetadata = ref<any>({})
const globalStats = ref<any>({})

// 计算属性
const cacheStatus = computed(() => {
  const status = superGlobalBookmarkCache.getCacheStatus()
  const statusMap = {
    fresh: '新鲜',
    stale: '过期',
    invalid: '无效',
    missing: '缺失'
  }
  return statusMap[status] || '未知'
})

const systemStatusClass = computed(() => {
  const status = superGlobalBookmarkCache.getCacheStatus()
  return {
    'status-fresh': status === 'fresh',
    'status-stale': status === 'stale',
    'status-invalid': status === 'invalid' || status === 'missing'
  }
})

const systemStatusText = computed(() => {
  const status = superGlobalBookmarkCache.getCacheStatus()
  const textMap = {
    fresh: '运行正常',
    stale: '需要刷新',
    invalid: '需要重建',
    missing: '未初始化'
  }
  return textMap[status] || '状态未知'
})

const totalBookmarks = computed(() => globalStats.value.totalBookmarks || 0)
const totalFolders = computed(() => globalStats.value.totalFolders || 0)
const maxDepth = computed(() => globalStats.value.maxDepth || 0)
const processingTime = computed(() => cacheMetadata.value.processingTime || 0)
const memoryUsage = computed(() => globalStats.value.memoryUsage?.estimatedBytes || 0)
const indexCount = computed(() => globalStats.value.memoryUsage?.indexCount || 0)
const cacheHitRate = computed(() => cacheMetadata.value.cacheHitRate || 0)
const cacheVersion = computed(() => cacheMetadata.value.version || 'N/A')
const processedAt = computed(() => cacheMetadata.value.processedAt || 0)
const dataHash = computed(() => cacheMetadata.value.originalDataHash || 'N/A')
const performanceStats = computed(() => cacheMetadata.value.performance || {})
const topDomains = computed(() => globalStats.value.topDomains || [])
const maxDomainCount = computed(() => {
  return Math.max(...topDomains.value.map((d: any) => d.count), 1)
})

// 方法
const refreshAllData = async () => {
  isRefreshing.value = true
  try {
    await superGlobalBookmarkCache.refresh(true)
    loadData()
  } catch (error) {
    console.error('刷新数据失败:', error)
  } finally {
    isRefreshing.value = false
  }
}

const loadData = () => {
  try {
    globalStats.value = superGlobalBookmarkCache.getGlobalStats()
    cacheMetadata.value = superGlobalBookmarkCache.getCacheMetadata()
  } catch (error) {
    console.warn('加载缓存数据失败:', error)
  }
}

const clearCache = async () => {
  if (!confirm('确定要清空所有缓存数据吗？这将需要重新处理所有书签数据。')) {
    return
  }
  
  isClearing.value = true
  try {
    await superGlobalBookmarkCache.clearCache()
    loadData()
  } catch (error) {
    console.error('清空缓存失败:', error)
  } finally {
    isClearing.value = false
  }
}

const exportCacheData = () => {
  try {
    const data = {
      globalStats: globalStats.value,
      metadata: cacheMetadata.value,
      timestamp: Date.now()
    }
    
    // eslint-disable-next-line no-undef
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `super-cache-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败：' + (error as Error).message)
  }
}

const runPerformanceTest = () => {
  // 跳转到性能对比演示页面
  openDemo()
}

const analyzeCleanupIssues = () => {
  try {
    const duplicateUrls = superGlobalBookmarkCache.getDuplicateUrlGroups()
    const invalidUrls = superGlobalBookmarkCache.getInvalidUrlIds()
    const emptyFolders = superGlobalBookmarkCache.getEmptyFolderIds()
    
    const analysis = {
      duplicateGroups: duplicateUrls.size,
      invalidUrls: invalidUrls.length,
      emptyFolders: emptyFolders.length
    }
    
    alert(`清理分析结果：\n重复URL组: ${analysis.duplicateGroups}\n无效URL: ${analysis.invalidUrls}\n空文件夹: ${analysis.emptyFolders}`)
  } catch (error) {
    console.error('分析失败:', error)
  }
}

const openDemo = () => {
  // 这里可以导航到演示页面
  window.open('/demo.html', '_blank')
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatTime = (timestamp: number): string => {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString()
}

const getPerformancePercent = (key: string): number => {
  const value = performanceStats.value[key] || 0
  const max = Math.max(...Object.values(performanceStats.value).map(v => Number(v) || 0), 1)
  return (value / max) * 100
}

// 生命周期
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.super-cache-dashboard {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 32px;
}

.dashboard-header h1 {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.dashboard-header p {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0 0 24px 0;
}

.header-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.status-indicator {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 16px;
}

.status-indicator.status-fresh {
  background: var(--color-success-alpha-10);
  color: var(--color-success);
}

.status-indicator.status-stale {
  background: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.status-indicator.status-invalid {
  background: var(--color-error-alpha-10);
  color: var(--color-error);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface-variant);
  border-radius: 12px;
}

.overview-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: white;
}

.overview-icon.primary { background: var(--color-primary); }
.overview-icon.success { background: var(--color-success); }
.overview-icon.warning { background: var(--color-warning); }
.overview-icon.info { background: var(--color-info); }
.overview-icon.secondary { background: var(--color-text-secondary); }
.overview-icon.error { background: var(--color-error); }

.overview-content {
  flex: 1;
}

.overview-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.overview-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.metadata-list, .performance-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.metadata-key {
  font-weight: 500;
  color: var(--color-text-secondary);
}

.metadata-value {
  font-weight: 600;
  color: var(--color-text-primary);
}

.metadata-value.mono {
  font-family: monospace;
  font-size: 12px;
}

.performance-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.performance-label {
  width: 80px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.performance-bar {
  flex: 1;
  height: 8px;
  background: var(--color-surface-variant);
  border-radius: 4px;
  overflow: hidden;
}

.performance-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-success));
  transition: width 0.3s ease;
}

.performance-time {
  width: 60px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.domain-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: var(--color-surface-variant);
  border-radius: 8px;
}

.domain-info {
  min-width: 200px;
}

.domain-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.domain-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.domain-bar {
  flex: 1;
  height: 6px;
  background: var(--color-surface);
  border-radius: 3px;
  overflow: hidden;
}

.domain-fill {
  height: 100%;
  background: var(--color-warning);
  transition: width 0.3s ease;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .overview-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
}
</style>
