export interface PerformanceMonitorProps {
  show?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  metrics?: string[]
}

export interface PerformanceMonitorEmits {
  cleanup: []
  toggleOptimizations: [enabled: boolean]
}
