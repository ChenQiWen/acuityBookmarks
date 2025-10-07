import type {
  BookmarkRecord,
  SearchResult
} from '@/infrastructure/indexeddb/manager'

export interface SearchStrategy {
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[]
}

export class SearchEngine {
  constructor(private strategy: SearchStrategy) {}

  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[] {
    const q = String(query || '').trim()
    if (!q) return []
    return this.strategy.search(q, bookmarks)
  }
}
