import type { BookmarkNode } from './bookmark'

export interface CleanupProblem {
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  severity: 'high' | 'medium' | 'low'
  description: string
  details?: string
  canAutoFix: boolean
  bookmarkId: string
  relatedNodeIds?: string[]
}

export interface CleanupTask {
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled'
  processed: number
  total: number
  foundIssues: number
  estimatedTime?: string
  error?: string
}

export interface CleanupSettings {
  '404': {
    timeout: number
    skipHttps: boolean
    followRedirects: boolean
    userAgent: string
    ignoreCors: boolean
  }
  duplicate: {
    compareUrl: boolean
    compareTitle: boolean
    titleSimilarity: number
    ignoreDomain: boolean
    keepNewest: 'newest' | 'oldest' | 'manual'
  }
  empty: {
    recursive: boolean
    preserveStructure: boolean
    minDepth: number
  }
  invalid: {
    checkProtocol: boolean
    checkDomain: boolean
    allowLocalhost: boolean
    customPatterns: string
  }
}

export interface CleanupState {
  isFiltering: boolean
  activeFilters: Array<'404' | 'duplicate' | 'empty' | 'invalid'>
  isScanning: boolean
  isExecuting?: boolean
  justCompleted?: boolean
  tasks: CleanupTask[]
  filterResults: Map<string, CleanupProblem[]>
  showLegend?: boolean
  legendVisibility: {
    all: boolean
    '404': boolean
    duplicate: boolean
    empty: boolean
    invalid: boolean
  }
  showSettings: boolean
  settingsTab: string
  activeSettingsTab?: string
  settings: CleanupSettings
}

export interface CleanupScanResult {
  nodeId: string
  problems: CleanupProblem[]
  originalNode: BookmarkNode
}
