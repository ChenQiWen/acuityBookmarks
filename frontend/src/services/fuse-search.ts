import Fuse from 'fuse.js'

export interface FuseRecord {
  id: string
  title: string
  url: string
  domain?: string
  parentId?: string
  dateAdded?: number
  dateLastUsed?: number
}

export interface FuseIndexBundle {
  fuse: Fuse<FuseRecord>
  records: FuseRecord[]
  builtAt: number
}

export function getDefaultFuseOptions(): Fuse.IFuseOptions<FuseRecord> {
  return {
    includeScore: true,
    threshold: 0.35,
    distance: 100,
    ignoreLocation: false,
    minMatchCharLength: 2,
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'url', weight: 0.3 },
      { name: 'domain', weight: 0.2 }
    ]
  }
}

export function createFuseIndex(records: FuseRecord[], options?: Fuse.IFuseOptions<FuseRecord>): FuseIndexBundle {
  const opts = options || getDefaultFuseOptions()
  const fuse = new Fuse(records, opts)
  return { fuse, records, builtAt: Date.now() }
}

export async function fetchFuseRecordsFromChrome(): Promise<FuseRecord[]> {
  const tree = await chrome.bookmarks.getTree()
  const out: FuseRecord[] = []

  const pushNode = (node: chrome.bookmarks.BookmarkTreeNode) => {
    if (node.url) {
      let domain: string | undefined
      try { domain = new URL(node.url).hostname } catch { domain = undefined }
      out.push({
        id: String(node.id),
        title: String(node.title || ''),
        url: String(node.url || ''),
        domain,
        parentId: node.parentId ? String(node.parentId) : undefined,
        dateAdded: typeof node.dateAdded === 'number' ? node.dateAdded : undefined,
        dateLastUsed: (node as any).dateLastUsed
      })
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) pushNode(child)
    }
  }

  for (const root of tree) pushNode(root)
  return out
}

export function scoreFromFuse(rawScore: number | undefined): number {
  if (typeof rawScore !== 'number') return 0
  // Fuse 分数越小越好，这里转换为 0-100 高分更好
  const normalized = Math.max(0, Math.min(1, 1 - rawScore))
  return Math.round(normalized * 100)
}