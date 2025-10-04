import type { BookmarkRecord } from './indexeddb-schema'
import type { BookmarkNode } from '../types'

/**
 * 构建树：将 IndexedDB 的书签记录转换为通用 BookmarkNode 树
 * - 基于 parentId 建立父子关系
 * - 按 id 去重，避免重复插入导致的重影
 * - 按 index 排序，保持与原始顺序一致
 * - 过滤掉 Chrome 的根占位节点 id === '0'
 */
export function buildBookmarkTree(records: Array<BookmarkRecord | any>): BookmarkNode[] {
  if (!Array.isArray(records) || records.length === 0) return []

  // 1) 输入按 id 去重
  const uniqueById = new Map<string, any>()
  for (const r of records) uniqueById.set(String(r.id), r)
  const items = Array.from(uniqueById.values())

  // 2) 构建节点映射（统一成 BookmarkNode）
  const nodeMap = new Map<string, BookmarkNode>()
  const toNode = (item: any): BookmarkNode => ({
    id: String(item.id),
    title: item.title,
    url: item.url,
    children: item.url ? undefined : [],
    // 透传 IndexedDB 预处理字段，便于后续定位/搜索/统计
    pathIds: Array.isArray(item.pathIds) ? item.pathIds.map((x: any) => String(x)) : undefined,
    ancestorIds: Array.isArray(item.ancestorIds) ? item.ancestorIds.map((x: any) => String(x)) : undefined,
    depth: typeof item.depth === 'number' ? item.depth : undefined,
    domain: typeof item.domain === 'string' ? item.domain : undefined,
    titleLower: typeof item.titleLower === 'string' ? item.titleLower : undefined,
    urlLower: typeof item.urlLower === 'string' ? item.urlLower : undefined,
    childrenCount: typeof item.childrenCount === 'number' ? item.childrenCount : undefined
  })

  for (const it of items) nodeMap.set(String(it.id), toNode(it))

  // 3) 建立父子关系（对子列表也做去重）
  const roots: BookmarkNode[] = []
  for (const it of items) {
    const id = String(it.id)
    const parentId = it.parentId ? String(it.parentId) : undefined
    const node = nodeMap.get(id)!
    if (parentId && nodeMap.has(parentId) && parentId !== '0') {
      const parent = nodeMap.get(parentId)!
      if (parent.children) {
        const exists = parent.children.some(c => String(c.id) === id)
        if (!exists) parent.children.push(node)
      }
    } else {
      // 根节点（过滤掉 id === '0'）
      if (id !== '0' && (!roots.some(r => r.id === id))) roots.push(node)
    }
  }

  // 4) 按 index 排序（若存在）
  const getIndex = (id: string) => {
    const raw = uniqueById.get(id)
    return (raw && typeof raw.index === 'number') ? raw.index : 0
  }
  const sortChildren = (nodes: BookmarkNode[]) => {
    nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id))
    for (const n of nodes) if (n.children && n.children.length) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}