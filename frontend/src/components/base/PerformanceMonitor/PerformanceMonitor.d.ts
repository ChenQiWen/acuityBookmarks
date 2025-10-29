export interface PerformanceMonitorProps {
  /** 是否显示帧率 */
  showFPS?: boolean
  /** 是否显示内存占用 */
  showMemory?: boolean
  /** 刷新间隔（毫秒） */
  interval?: number
}

export interface PerformanceMonitorEmits {}
