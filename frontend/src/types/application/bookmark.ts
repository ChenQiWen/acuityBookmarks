import type { BookmarkNode } from '@/types/domain/bookmark'
import type { SmartBookmarkExecutor } from '@/core/bookmark/services/executor'
import type { ProgressCallback } from '@/core/bookmark/services/executor'

export interface BookmarkImportPayload {
  fileName: string
  size: number
  importedAt: number
}

export interface BookmarkChangeSummary {
  created: number
  updated: number
  deleted: number
  moved: number
}

export interface BookmarkDiffPayload {
  before: BookmarkNode[]
  after: BookmarkNode[]
  summary: BookmarkChangeSummary
}

export interface PlanAndExecuteOptions {
  dryRun?: boolean
  maxConcurrent?: number
  retry?: {
    maxAttempts: number
    delayMs: number
  }
  executor?: SmartBookmarkExecutor
  onProgress?: ProgressCallback
}
