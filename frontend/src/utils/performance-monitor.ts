/**
 * Chrome扩展性能监控工具
 * 用于追踪扩展启动时间、AI分析性能、内存使用等关键指标
 */

export interface PerformanceMetrics {
  timestamp: number;
  type: 'startup' | 'ai_analysis' | 'memory' | 'user_action';
  data: Record<string, any>;
}

export class ExtensionPerformance {
  private static instance: ExtensionPerformance;
  private metricsBuffer: PerformanceMetrics[] = [];
  private startupTime: number = 0;

  static getInstance(): ExtensionPerformance {
    if (!this.instance) {
      this.instance = new ExtensionPerformance();
    }
    return this.instance;
  }

  /**
   * 测量启动时间
   */
  measureStartupTime(): { end: () => number } {
    const startTime = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.startupTime = duration;
        
        // 记录启动性能
        this.recordMetric({
          timestamp: Date.now(),
          type: 'startup',
          data: {
            duration_ms: duration,
            page: document.title || 'unknown'
          }
        });
        
        console.log(`🚀 页面启动耗时: ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  }

  /**
   * 测量AI分析性能
   */
  async measureAIAnalysis<T>(
    operation: () => Promise<T>,
    itemCount: number,
    operationType: string = 'classification'
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      const itemsPerSecond = itemCount / (duration / 1000);
      
      // 记录AI分析性能
      this.recordMetric({
        timestamp: Date.now(),
        type: 'ai_analysis',
        data: {
          operation_type: operationType,
          duration_ms: duration,
          item_count: itemCount,
          items_per_second: itemsPerSecond,
          efficiency_score: this.calculateEfficiencyScore(itemsPerSecond, operationType)
        }
      });
      
      console.log(`AI分析性能 [${operationType}]: ${itemsPerSecond.toFixed(1)} 项/秒`);
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // 记录失败的分析
      this.recordMetric({
        timestamp: Date.now(),
        type: 'ai_analysis',
        data: {
          operation_type: operationType,
          duration_ms: duration,
          item_count: itemCount,
          error: (error as Error).message,
          success: false
        }
      });
      
      throw error;
    }
  }

  /**
   * 监控内存使用
   */
  monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryData = {
        used_heap_mb: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total_heap_mb: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        heap_limit_mb: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
        usage_percent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
      };
      
      // 记录内存使用
      this.recordMetric({
        timestamp: Date.now(),
        type: 'memory',
        data: memoryData
      });
      
      console.log(`💾 内存使用: ${memoryData.used_heap_mb}MB (${memoryData.usage_percent}%)`);
      
      // 内存使用过高警告
      if (memoryData.usage_percent > 80) {
        console.warn('⚠️ 内存使用过高，建议优化');
      }
    }
  }

  /**
   * 追踪用户操作
   */
  trackUserAction(action: string, metadata?: Record<string, any>): void {
    this.recordMetric({
      timestamp: Date.now(),
      type: 'user_action',
      data: {
        action,
        ...metadata,
        session_duration: Date.now() - (this.startupTime || Date.now())
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`👆 用户操作: ${action}`, metadata);
    }
  }

  /**
   * 记录性能指标
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metricsBuffer.push(metric);
    
    // 缓冲区满时批量发送
    if (this.metricsBuffer.length >= 20) {
      this.flushMetrics();
    }
  }

  /**
   * 批量发送指标到后端
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;
    
    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    try {
      // 存储到Chrome本地存储
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          performance_metrics: metrics
        });
      }
      
      // 开发环境下输出详细信息
      if (process.env.NODE_ENV === 'development') {
        console.group('📊 性能指标批量上报');
        metrics.forEach(metric => {
          console.log(`${metric.type}:`, metric.data);
        });
        console.groupEnd();
      }
      
    } catch (error) {
      console.error('性能指标发送失败:', error);
      // 发送失败时重新加入缓冲区
      this.metricsBuffer.unshift(...metrics);
    }
  }

  /**
   * 计算效率评分
   */
  private calculateEfficiencyScore(itemsPerSecond: number, operationType: string): number {
    // 根据操作类型设定基准值
    const benchmarks = {
      classification: 10,  // 10项/秒为基准
      search: 50,         // 50项/秒为基准
      sorting: 100,       // 100项/秒为基准
      analysis: 5         // 5项/秒为基准
    };
    
    const benchmark = benchmarks[operationType as keyof typeof benchmarks] || 10;
    return Math.min(100, Math.round((itemsPerSecond / benchmark) * 100));
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): Record<string, any> {
    const recentMetrics = this.metricsBuffer.slice(-10);
    
    return {
      startup_time: this.startupTime,
      metrics_count: this.metricsBuffer.length,
      recent_actions: recentMetrics.filter(m => m.type === 'user_action').length,
      recent_ai_operations: recentMetrics.filter(m => m.type === 'ai_analysis').length,
      last_memory_check: recentMetrics.find(m => m.type === 'memory')?.data
    };
  }

  /**
   * 手动触发指标发送
   */
  async flushAll(): Promise<void> {
    await this.flushMetrics();
  }
}

// 全局实例
export const performanceMonitor = ExtensionPerformance.getInstance();

// 页面加载时自动开始监控
if (typeof window !== 'undefined') {
  const startup = performanceMonitor.measureStartupTime();
  
  window.addEventListener('load', () => {
    startup.end();
    
    // 定期监控内存使用
    setInterval(() => {
      performanceMonitor.monitorMemoryUsage();
    }, 30000); // 每30秒检查一次
  });
  
  // 页面卸载时发送剩余指标
  window.addEventListener('beforeunload', () => {
    performanceMonitor.flushAll();
  });
}
