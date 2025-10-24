import type { BookmarkNode } from '@/types/domain/bookmark'

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
