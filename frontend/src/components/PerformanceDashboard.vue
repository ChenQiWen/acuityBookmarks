<!--
  🚀 Phase 2 Step 3: 性能监控仪表板
  实时显示搜索性能、缓存状态、系统资源使用等指标
-->

<template>
  <div class="performance-dashboard">
    <!-- 仪表板标题 -->
    <div class="dashboard-header">
      <div class="header-info">
        <h3 class="header-title">
          <Icon name="mdi-speedometer" />
          性能监控
        </h3>
        <Badge variant="soft" :color="performanceStatus.color">
          {{ performanceStatus.text }}
        </Badge>
      </div>
      <div class="header-actions">
        <Button
          variant="ghost"
          size="sm"
          @click="refreshMetrics"
          :loading="isRefreshing"
        >
          <Icon name="mdi-refresh" />
          刷新
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="toggleAutoRefresh"
          :color="autoRefresh ? 'primary' : 'neutral'"
        >
          <Icon :name="autoRefresh ? 'mdi-pause' : 'mdi-play'" />
          {{ autoRefresh ? '暂停' : '自动' }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          @click="forceOptimization"
          :loading="isOptimizing"
        >
          <Icon name="mdi-tune" />
          立即优化
        </Button>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <div class="metrics-grid">
      <!-- 搜索性能 -->
      <Card class="metric-card search-performance">
        <div class="metric-header">
          <Icon name="mdi-magnify" class="metric-icon" />
          <div>
            <div class="metric-title">搜索性能</div>
            <div class="metric-subtitle">响应时间与吞吐量</div>
          </div>
        </div>
        <div class="metric-content">
          <div class="metric-primary">
            {{ metrics.searchLatency.toFixed(1) }}ms
          </div>
          <div class="metric-stats">
            <div class="stat-item">
              <span class="stat-label">吞吐量</span>
              <span class="stat-value">{{ metrics.searchThroughput.toFixed(1) }}/s</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">缓存命中</span>
              <span class="stat-value">{{ (metrics.cacheHitRate * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div class="metric-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: Math.min(100 - metrics.searchLatency, 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </Card>

      <!-- 内存使用 -->
      <Card class="metric-card memory-usage">
        <div class="metric-header">
          <Icon name="mdi-memory" class="metric-icon" />
          <div>
            <div class="metric-title">内存使用</div>
            <div class="metric-subtitle">缓存与系统内存</div>
          </div>
        </div>
        <div class="metric-content">
          <div class="metric-primary">
            {{ metrics.memoryUsage.toFixed(1) }}MB
          </div>
          <div class="metric-stats">
            <div class="stat-item">
              <span class="stat-label">内存压力</span>
              <span 
                class="stat-value"
                :class="{
                  'stat-warning': metrics.memoryPressure > 0.7,
                  'stat-danger': metrics.memoryPressure > 0.9
                }"
              >
                {{ (metrics.memoryPressure * 100).toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="metric-progress">
            <div class="progress-bar memory">
              <div 
                class="progress-fill" 
                :class="{
                  'progress-warning': metrics.memoryPressure > 0.7,
                  'progress-danger': metrics.memoryPressure > 0.9
                }"
                :style="{ width: (metrics.memoryPressure * 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </Card>

      <!-- 推荐性能 -->
      <Card class="metric-card recommendation-performance">
        <div class="metric-header">
          <Icon name="mdi-lightbulb" class="metric-icon" />
          <div>
            <div class="metric-title">推荐性能</div>
            <div class="metric-subtitle">生成速度与准确率</div>
          </div>
        </div>
        <div class="metric-content">
          <div class="metric-primary">
            {{ metrics.recommendationLatency.toFixed(1) }}ms
          </div>
          <div class="metric-stats">
            <div class="stat-item">
              <span class="stat-label">准确率</span>
              <span class="stat-value">{{ (metrics.recommendationAccuracy * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div class="metric-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: Math.min(100 - metrics.recommendationLatency / 2, 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </Card>

      <!-- 数据库性能 -->
      <Card class="metric-card database-performance">
        <div class="metric-header">
          <Icon name="mdi-database" class="metric-icon" />
          <div>
            <div class="metric-title">数据库性能</div>
            <div class="metric-subtitle">连接池与查询速度</div>
          </div>
        </div>
        <div class="metric-content">
          <div class="metric-primary">
            {{ metrics.dbQueryTime.toFixed(1) }}ms
          </div>
          <div class="metric-stats">
            <div class="stat-item">
              <span class="stat-label">连接池</span>
              <span class="stat-value">{{ dbStats.available }}/{{ dbStats.total }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">等待队列</span>
              <span class="stat-value">{{ dbStats.pending }}</span>
            </div>
          </div>
          <div class="metric-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: (dbStats.available / dbStats.total * 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- 缓存详情 -->
    <div class="cache-section">
      <h4 class="section-title">
        <Icon name="mdi-cached" />
        缓存状态
      </h4>
      <div class="cache-grid">
        <Card class="cache-card">
          <div class="cache-header">
            <Icon name="mdi-magnify-scan" />
            <span>搜索缓存</span>
          </div>
          <div class="cache-stats">
            <div class="cache-stat">
              <span class="cache-label">条目</span>
              <span class="cache-value">{{ cacheStats.search.size }}</span>
            </div>
            <div class="cache-stat">
              <span class="cache-label">大小</span>
              <span class="cache-value">{{ formatBytes(cacheStats.search.totalSize) }}</span>
            </div>
            <div class="cache-stat">
              <span class="cache-label">命中率</span>
              <span class="cache-value">{{ (cacheStats.search.hitRate * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </Card>

        <Card class="cache-card">
          <div class="cache-header">
            <Icon name="mdi-lightbulb-outline" />
            <span>推荐缓存</span>
          </div>
          <div class="cache-stats">
            <div class="cache-stat">
              <span class="cache-label">条目</span>
              <span class="cache-value">{{ cacheStats.recommendations.size }}</span>
            </div>
            <div class="cache-stat">
              <span class="cache-label">大小</span>
              <span class="cache-value">{{ formatBytes(cacheStats.recommendations.totalSize) }}</span>
            </div>
            <div class="cache-stat">
              <span class="cache-label">命中率</span>
              <span class="cache-value">{{ (cacheStats.recommendations.hitRate * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- 任务队列状态 -->
    <div class="queue-section">
      <h4 class="section-title">
        <Icon name="mdi-format-list-bulleted" />
        任务队列
      </h4>
      <Card class="queue-card">
        <div class="queue-stats">
          <div class="queue-stat">
            <Icon name="mdi-clock-outline" />
            <div>
              <div class="queue-value">{{ queueStats.queueSize }}</div>
              <div class="queue-label">等待中</div>
            </div>
          </div>
          <div class="queue-stat">
            <Icon name="mdi-play-circle" />
            <div>
              <div class="queue-value">{{ queueStats.running }}</div>
              <div class="queue-label">执行中</div>
            </div>
          </div>
          <div class="queue-stat">
            <Icon name="mdi-check-circle" />
            <div>
              <div class="queue-value">{{ queueStats.processed }}</div>
              <div class="queue-label">已完成</div>
            </div>
          </div>
          <div class="queue-stat">
            <Icon name="mdi-alert-circle" />
            <div>
              <div class="queue-value">{{ queueStats.failed }}</div>
              <div class="queue-label">失败</div>
            </div>
          </div>
        </div>
        <div class="queue-progress">
          <div class="progress-info">
            <span>成功率: {{ (queueStats.successRate * 100).toFixed(1) }}%</span>
            <span>平均执行时间: {{ queueStats.avgExecutionTime.toFixed(1) }}ms</span>
          </div>
        </div>
      </Card>
    </div>

    <!-- 优化历史 -->
    <div class="optimization-section" v-if="optimizationHistory.length > 0">
      <h4 class="section-title">
        <Icon name="mdi-history" />
        优化历史
      </h4>
      <div class="optimization-list">
        <Card 
          v-for="(optimization, index) in optimizationHistory.slice(0, 3)" 
          :key="index"
          class="optimization-item"
        >
          <div class="optimization-header">
            <div class="optimization-time">
              {{ formatTime(optimization.timestamp) }}
            </div>
            <Badge 
              variant="soft" 
              :color="optimization.performanceGain > 0 ? 'success' : 'neutral'"
            >
              {{ optimization.performanceGain > 0 ? '+' : '' }}{{ optimization.performanceGain.toFixed(1) }}%
            </Badge>
          </div>
          <div class="optimization-actions">
            <div class="action-list">
              <span 
                v-for="action in optimization.optimizationsApplied"
                :key="action"
                class="action-tag"
              >
                {{ action }}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getPerformanceOptimizer } from '../services/realtime-performance-optimizer'

// Props
interface Props {
  autoRefreshInterval?: number
  showDetailed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoRefreshInterval: 5000,
  showDetailed: true
})

// State
const performanceOptimizer = getPerformanceOptimizer()
const metrics = ref(performanceOptimizer.getCurrentMetrics())
const cacheStats = ref(performanceOptimizer.getCacheStats())
const dbStats = ref(performanceOptimizer.getDbStats())
const queueStats = ref(performanceOptimizer.getTaskQueueStats())
const optimizationHistory = ref<any[]>([])

const isRefreshing = ref(false)
const isOptimizing = ref(false)
const autoRefresh = ref(true)
const refreshTimer = ref<number | null>(null)

// Computed
const performanceStatus = computed(() => {
  const latency = metrics.value.searchLatency
  const memoryPressure = metrics.value.memoryPressure
  
  if (latency < 50 && memoryPressure < 0.7) {
    return { text: '优秀', color: 'success' }
  } else if (latency < 100 && memoryPressure < 0.8) {
    return { text: '良好', color: 'warning' }
  } else {
    return { text: '需要优化', color: 'danger' }
  }
})

// Methods
const refreshMetrics = async () => {
  isRefreshing.value = true
  try {
    metrics.value = performanceOptimizer.getCurrentMetrics()
    cacheStats.value = performanceOptimizer.getCacheStats()
    dbStats.value = performanceOptimizer.getDbStats()
    queueStats.value = performanceOptimizer.getTaskQueueStats()
  } catch (error) {
    console.error('刷新性能指标失败:', error)
  } finally {
    isRefreshing.value = false
  }
}

const forceOptimization = async () => {
  isOptimizing.value = true
  try {
    const result = await performanceOptimizer.forceOptimization()
    optimizationHistory.value.unshift({
      ...result,
      timestamp: Date.now()
    })
    // 限制历史记录数量
    if (optimizationHistory.value.length > 10) {
      optimizationHistory.value = optimizationHistory.value.slice(0, 10)
    }
    await refreshMetrics()
  } catch (error) {
    console.error('执行优化失败:', error)
  } finally {
    isOptimizing.value = false
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  if (refreshTimer.value) return
  
  refreshTimer.value = window.setInterval(() => {
    refreshMetrics()
  }, props.autoRefreshInterval)
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 60000) { // < 1分钟
    return '刚刚'
  } else if (diffMs < 3600000) { // < 1小时
    return Math.floor(diffMs / 60000) + '分钟前'
  } else if (diffMs < 86400000) { // < 1天
    return Math.floor(diffMs / 3600000) + '小时前'
  } else {
    return date.toLocaleDateString()
  }
}

// Lifecycle
onMounted(() => {
  refreshMetrics()
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.performance-dashboard {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.metric-card {
  padding: 20px;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.metric-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
}

.metric-title {
  font-weight: 600;
  font-size: 14px;
}

.metric-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-primary {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-color);
}

.metric-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
}

.stat-warning {
  color: var(--warning-color);
}

.stat-danger {
  color: var(--error-color);
}

.metric-progress {
  margin-top: 8px;
}

.progress-bar {
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-warning {
  background: var(--warning-color);
}

.progress-danger {
  background: var(--error-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.cache-section {
  margin-bottom: 32px;
}

.cache-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.cache-card {
  padding: 16px;
}

.cache-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 14px;
}

.cache-stats {
  display: flex;
  justify-content: space-between;
}

.cache-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.cache-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.cache-value {
  font-size: 14px;
  font-weight: 600;
}

.queue-section {
  margin-bottom: 32px;
}

.queue-card {
  padding: 20px;
}

.queue-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
}

.queue-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.queue-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-color);
}

.queue-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.queue-progress {
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

.optimization-section {
  margin-bottom: 32px;
}

.optimization-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.optimization-item {
  padding: 16px;
}

.optimization-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.optimization-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.optimization-actions {
  margin-top: 8px;
}

.action-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-secondary);
  border-radius: 12px;
  font-size: 11px;
  color: var(--text-secondary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .performance-dashboard {
    padding: 12px;
  }
  
  .dashboard-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .cache-grid {
    grid-template-columns: 1fr;
  }
  
  .queue-stats {
    flex-direction: column;
    gap: 16px;
  }
  
  .progress-info {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
