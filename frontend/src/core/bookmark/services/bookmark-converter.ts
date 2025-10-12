/**
 * 书签转换器 - 核心业务逻辑
 *
 * 职责：
 * - 在不同数据源之间进行书签结构转换
 * - 统一书签数据格式
 * - 处理树形结构的构建和扁平化
 */

import type { BookmarkNode } from '../domain/bookmark'

/**
 * 最小树节点形状（用于结构化转换）
 * 避免对具体数据源的强绑定
 */
export interface MinimalTreeNode {
  id: string
  title: string
  url?: string
  children?: MinimalTreeNode[]
  parentId?: string
  index?: number
  dateAdded?: number
}

/**
 * IndexedDB 记录接口（临时定义，后续会从 schema 导入）
 */
interface BookmarkRecord {
  id: string | number
  title: string
  url?: string
  parentId?: string | number
  index?: number
  dateAdded?: number
  pathIds?: Array<string | number>
  ancestorIds?: Array<string | number>
  depth?: number
  domain?: string
  titleLower?: string
  urlLower?: string
  childrenCount?: number
}

/**
 * 书签转换器
 */
export class BookmarkConverter {
  /**
   * 将任意最小树节点数组转换为 BookmarkNode[]
   * 保持"叶子节点带 url、文件夹 children 至少为空数组"的约定
   */
  static listToBookmarkNodes<T extends MinimalTreeNode>(
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

  /**
   * 从 Chrome 书签树转换
   * 接受最小节点形状，避免对 chrome.bookmarks.* 的强绑定
   */
  static chromeToBookmarkNodes(nodes: MinimalTreeNode[]): BookmarkNode[] {
    return this.listToBookmarkNodes(nodes)
  }

  /**
   * 从提案草稿树转换
   * 结构相同：id/title/url/children
   */
  static proposalsToBookmarkNodes(nodes: MinimalTreeNode[]): BookmarkNode[] {
    return this.listToBookmarkNodes(nodes)
  }

  /**
   * 从 IndexedDB 的扁平记录构建 BookmarkNode 树
   * 对扁平结构进行合并与重建，生成可视化树
   */
  static recordsToBookmarkNodes(records: BookmarkRecord[]): BookmarkNode[] {
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
          if (!parent.children.some(c => String(c.id) === id)) {
            parent.children.push(node)
          }
        }
      } else {
        if (id !== '0' && !roots.some(r => r.id === id)) {
          roots.push(node)
        }
      }
    }

    // 排序（若存在 index）
    const getIndex = (id: string) => {
      const raw = unique.get(id)
      return raw && typeof raw.index === 'number' ? raw.index : 0
    }

    const sortChildren = (nodes: BookmarkNode[]) => {
      nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id))
      for (const n of nodes) {
        if (n.children?.length) {
          sortChildren(n.children)
        }
      }
    }

    sortChildren(roots)
    return roots
  }

  /**
   * 将 BookmarkNode 树扁平化为记录数组
   * 用于存储到 IndexedDB
   */
  static bookmarkNodesToRecords(
    nodes: BookmarkNode[],
    parentId?: string
  ): BookmarkRecord[] {
    const records: BookmarkRecord[] = []

    for (const node of nodes) {
      const record: BookmarkRecord = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        childrenCount: node.children?.length || 0
      }

      records.push(record)

      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        const childRecords = this.bookmarkNodesToRecords(node.children, node.id)
        records.push(...childRecords)
      }
    }

    return records
  }

  /**
   * 验证书签节点数据完整性
   */
  static validateBookmarkNode(node: BookmarkNode): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!node.id) {
      errors.push('缺少节点ID')
    }

    if (!node.title || node.title.trim() === '') {
      errors.push('缺少节点标题')
    }

    // 书签必须有URL
    if (!node.url && !node.children) {
      errors.push('书签节点必须包含URL或子节点')
    }

    // 文件夹不能有URL
    if (node.url && node.children) {
      errors.push('文件夹节点不能同时包含URL和子节点')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 清理和标准化书签数据
   */
  static sanitizeBookmarkNode(node: BookmarkNode): BookmarkNode {
    return {
      ...node,
      id: String(node.id).trim(),
      title: node.title?.trim() || '',
      url: node.url?.trim() || undefined,
      children: node.children?.map(child => this.sanitizeBookmarkNode(child))
    }
  }
}
