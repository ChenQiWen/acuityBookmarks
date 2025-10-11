import type { BookmarkNode } from '@/types'
import type { BookmarkRecord } from '@/utils/indexeddb-schema'

// 最小树节点形状（用于结构化转换）
// 说明：以通用字段（id/title/url/children）表达树结构，避免强绑定具体来源
export interface MinimalTreeNode {
  id: string
  title: string
  url?: string
  children?: MinimalTreeNode[]
  parentId?: string
  index?: number
  dateAdded?: number
}

// 通用：将任意最小树节点数组转换为 BookmarkNode[]（递归）
// 设计：保持“叶子节点带 url、文件夹 children 至少为空数组”的约定，便于后续处理
export function listToBookmarkNodes<T extends MinimalTreeNode>(
  nodes: T[]
): BookmarkNode[] {
  const mapNode = (n: MinimalTreeNode): BookmarkNode => ({
    id: String(n.id),
    title: n.title,
    url: n.url,
    parentId: n.parentId,
    index: typeof n.index === 'number' ? n.index : undefined,
    dateAdded: n.dateAdded,
    children: n.children?.length
      ? n.children.map(mapNode)
      : n.url
        ? undefined
        : []
  })
  return Array.isArray(nodes) ? nodes.map(mapNode) : []
}

// 从 Chrome/同构 书签树转换（直接递归映射）
// 接受最小节点形状，避免对 chrome.bookmarks.* 的强绑定
export function chromeToBookmarkNodes(
  nodes: MinimalTreeNode[]
): BookmarkNode[] {
  return listToBookmarkNodes(nodes)
}

// 从 Proposal 草稿树转换（结构相同：id/title/url/children）
export function proposalsToBookmarkNodes(
  nodes: MinimalTreeNode[]
): BookmarkNode[] {
  return listToBookmarkNodes(nodes)
}

// 从 IndexedDB 的扁平记录构建 BookmarkNode 树
// 说明：对扁平结构（含 parentId/index 等）进行合并与重建，生成可视化树
export function recordsToBookmarkNodes(
  records: BookmarkRecord[]
): BookmarkNode[] {
  if (!Array.isArray(records) || records.length === 0) return []

  // 去重后构建节点映射
  const unique = new Map<string, BookmarkRecord>()
  for (const r of records) unique.set(String(r.id), r)
  const items = Array.from(unique.values())

  const nodeMap = new Map<string, BookmarkNode>()
  for (const it of items) {
    nodeMap.set(String(it.id), {
      id: String(it.id),
      title: it.title,
      url: it.url,
      children: it.url ? undefined : [],
      pathIds: it.pathIds,
      ancestorIds: it.ancestorIds,
      depth: it.depth,
      domain: it.domain,
      titleLower: it.titleLower,
      urlLower: it.urlLower,
      childrenCount: it.childrenCount
    } as BookmarkNode)
  }

  const roots: BookmarkNode[] = []
  for (const it of items) {
    const id = String(it.id)
    const parentId = it.parentId ? String(it.parentId) : undefined
    const node = nodeMap.get(id)!
    if (parentId && nodeMap.has(parentId) && parentId !== '0') {
      const parent = nodeMap.get(parentId)!
      if (parent.children) {
        if (!parent.children.some(c => String(c.id) === id))
          parent.children.push(node)
      }
    } else {
      if (id !== '0' && !roots.some(r => r.id === id)) roots.push(node)
    }
  }

  // 排序（若存在 index）
  const getIndex = (id: string) => {
    const raw = unique.get(id)
    return raw && typeof raw.index === 'number' ? raw.index : 0
  }
  const sortChildren = (nodes: BookmarkNode[]) => {
    nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id))
    for (const n of nodes) if (n.children?.length) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}
