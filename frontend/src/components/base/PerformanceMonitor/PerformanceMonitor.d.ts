export interface PerformanceMonitorProps {
  // 性能监控面板属性
  showFPS?: boolean // 是否显示帧率
  showMemory?: boolean // 是否显示内存占用
  interval?: number // 刷新间隔（毫秒）
}

export interface PerformanceMonitorEmits {} // 性能监控面板事件
