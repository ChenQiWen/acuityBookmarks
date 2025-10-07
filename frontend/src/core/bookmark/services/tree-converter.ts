import { logger } from '@/utils/logger'
import type { ChromeBookmarkTreeNode } from '@/types'

// 定义缓存项的类型
interface CachedBookmarkItem {
  id: string
  parentId?: string
  title: string
  url?: string
  index?: number
  dateAdded?: number
  dateModified?: number
  children?: CachedBookmarkItem[]
}

// Convert cached flat/partial tree data into ChromeBookmarkTreeNode[]
export function convertCachedToTreeNodes(
  cached: CachedBookmarkItem[]
): ChromeBookmarkTreeNode[] {
  if (cached.length > 0 && cached[0].children !== undefined) {
    const convert = (item: CachedBookmarkItem): ChromeBookmarkTreeNode => {
      const node: ChromeBookmarkTreeNode = {
        id: item.id,
        parentId: item.parentId,
        title: item.title,
        url: item.url,
        index: item.index,
        dateAdded: item.dateAdded,
        dateModified: item.dateModified
      }
      if (item.children && item.children.length > 0) {
        node.children = item.children.map(convert)
      }
      return node
    }
    return cached.map(convert)
  }

  logger.info(
    'TreeConverter',
    '🔄 重建书签树形结构，扁平数据长度:',
    cached.length
  )
  const nodeMap = new Map<string, ChromeBookmarkTreeNode>()
  const convert = (item: CachedBookmarkItem): ChromeBookmarkTreeNode => ({
    id: item.id,
    parentId: item.parentId,
    title: item.title,
    url: item.url,
    index: item.index || 0,
    dateAdded: item.dateAdded,
    dateModified: item.dateModified
  })

  cached.forEach(item => {
    nodeMap.set(item.id, convert(item))
  })

  cached.forEach(item => {
    const node = nodeMap.get(item.id)!
    if (!node) return
    const pid = item.parentId
    if (pid && nodeMap.has(pid)) {
      const parent = nodeMap.get(pid)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    }
  })

  const roots: ChromeBookmarkTreeNode[] = []
  nodeMap.forEach(node => {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      roots.push(node)
    }
  })

  return roots
}
