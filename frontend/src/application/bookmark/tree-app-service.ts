import type {
  ChromeBookmarkTreeNode,
  BookmarkNode,
  ProposalNode
} from '@/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import { smartBookmarkDiffEngine } from '@/core/bookmark/services/diff-engine'
import {
  chromeToBookmarkNodes,
  proposalsToBookmarkNodes
} from '@/utils/bookmark-converters'

export type ProposalNodeLike = ProposalNode

function deepCloneTree<T>(tree: T): T {
  return JSON.parse(JSON.stringify(tree))
}

function cloneToProposal(fullTree: ChromeBookmarkTreeNode[]): ProposalNodeLike {
  return {
    id: 'root-cloned',
    title: '克隆的书签结构',
    children: deepCloneTree(fullTree) as unknown as ProposalNodeLike[]
  }
}

type BookmarkMapping = Map<
  string,
  { proposedId?: string; title?: string; parentId?: string }
>

function buildBookmarkMapping(
  originalTree: ChromeBookmarkTreeNode[],
  proposedTree: ProposalNodeLike[]
): BookmarkMapping {
  // 基础版：按 id 直连；当 proposed 缺少 id 或有新增时，只建立可直连部分
  const map: BookmarkMapping = new Map()
  const proposedIndex = new Map<string, ProposalNodeLike>()

  const collectProposed = (nodes: ProposalNodeLike[]) => {
    for (const n of nodes) {
      if (n.id) proposedIndex.set(String(n.id), n)
      if (n.children?.length) collectProposed(n.children)
    }
  }
  collectProposed(proposedTree)

  const collectOriginal = (nodes: ChromeBookmarkTreeNode[]) => {
    for (const n of nodes) {
      const pid = String(n.id)
      const p = proposedIndex.get(pid)
      if (p)
        map.set(pid, { proposedId: pid, title: p.title, parentId: p.parentId })
      if (n.children?.length) collectOriginal(n.children)
    }
  }
  collectOriginal(originalTree)

  return map
}

export async function buildBookmarkMappingChunked(
  originalTree: ChromeBookmarkTreeNode[],
  proposedTree: ProposalNodeLike[],
  options: {
    chunkSize?: number
    onProgress?: (done: number, total: number) => void
  } = {}
): Promise<BookmarkMapping> {
  const chunkSize = Math.max(100, options.chunkSize ?? 2000)
  const map: BookmarkMapping = new Map()
  const proposedIndex = new Map<string, ProposalNodeLike>()

  const collectProposed = (nodes: ProposalNodeLike[]) => {
    for (const n of nodes) {
      if (n.id) proposedIndex.set(String(n.id), n)
      if (n.children?.length) collectProposed(n.children)
    }
  }
  collectProposed(proposedTree)

  const originalList: ChromeBookmarkTreeNode[] = []
  const flatten = (nodes: ChromeBookmarkTreeNode[]) => {
    for (const n of nodes) {
      originalList.push(n)
      if (n.children?.length) flatten(n.children)
    }
  }
  flatten(originalTree)

  const total = originalList.length
  let done = 0

  const processChunk = (start: number) =>
    new Promise<void>(resolve => {
      const end = Math.min(total, start + chunkSize)
      for (let i = start; i < end; i++) {
        const n = originalList[i]
        const pid = String(n.id)
        const p = proposedIndex.get(pid)
        if (p)
          map.set(pid, {
            proposedId: pid,
            title: p.title,
            parentId: p.parentId
          })
      }
      done = end
      options.onProgress?.(done, total)

      const schedule = (cb: () => void) => {
        if (
          typeof (
            window as Window & {
              requestIdleCallback?: (cb: () => void) => void
            }
          ).requestIdleCallback === 'function'
        ) {
          ;(
            window as Window & { requestIdleCallback: (cb: () => void) => void }
          ).requestIdleCallback(cb)
        } else {
          setTimeout(cb, 0)
        }
      }

      if (end < total) schedule(() => resolve())
      else resolve()
    })

  let idx = 0
  while (idx < total) {
    await processChunk(idx)
    idx += chunkSize
  }
  return map
}

export const treeAppService = {
  cloneToProposal,
  buildBookmarkMapping,
  buildBookmarkMappingChunked: (
    original: ChromeBookmarkTreeNode[],
    proposed: ProposalNodeLike[],
    options?: {
      chunkSize?: number
      onProgress?: (done: number, total: number) => void
    }
  ) => buildBookmarkMappingChunked(original, proposed, options),
  compareTrees: async (
    original: ChromeBookmarkTreeNode[],
    proposed: ProposalNodeLike[]
  ): Promise<boolean> => {
    // 在边界进行统一转换，确保 diff 引擎拿到 BookmarkNode 形状
    const originalNodes: BookmarkNode[] = chromeToBookmarkNodes(original)
    const proposedNodes: BookmarkNode[] = proposalsToBookmarkNodes(proposed)
    const diff = await smartBookmarkDiffEngine.computeDiff(
      originalNodes,
      proposedNodes
    )
    return (diff.operations?.length ?? 0) > 0
  },
  // 将扁平记录构建为通用 UI 书签树（提供给组件层使用）
  buildViewTreeFromFlat(records: BookmarkRecord[]): BookmarkNode[] {
    if (!Array.isArray(records) || records.length === 0) return []

    // 1) 输入按 id 去重
    const uniqueById = new Map<string, BookmarkRecord>()
    for (const r of records) uniqueById.set(String(r.id), r)
    const items = Array.from(uniqueById.values())

    // 2) 构建节点映射（统一成 BookmarkNode）
    const nodeMap = new Map<string, BookmarkNode>()
    const toNode = (item: BookmarkRecord): BookmarkNode => ({
      id: String(item.id),
      title: item.title,
      url: item.url,
      children: item.url ? undefined : [],
      // 透传 IndexedDB 预处理字段，便于后续定位/搜索/统计
      pathIds: Array.isArray(item.pathIds)
        ? item.pathIds.map((x: string | number) => String(x))
        : undefined,
      ancestorIds: Array.isArray(item.ancestorIds)
        ? item.ancestorIds.map((x: string | number) => String(x))
        : undefined,
      depth: typeof item.depth === 'number' ? item.depth : undefined,
      domain: typeof item.domain === 'string' ? item.domain : undefined,
      titleLower:
        typeof item.titleLower === 'string' ? item.titleLower : undefined,
      urlLower: typeof item.urlLower === 'string' ? item.urlLower : undefined,
      childrenCount:
        typeof item.childrenCount === 'number' ? item.childrenCount : undefined
    })

    for (const it of items) nodeMap.set(String(it.id), toNode(it))

    // 3) 建立父子关系（对子列表去重），并记录哪些节点作为子节点出现过
    const childIds = new Set<string>()
    for (const it of items) {
      const id = String(it.id)
      const parentId = it.parentId ? String(it.parentId) : undefined
      if (parentId && nodeMap.has(parentId) && parentId !== '0') {
        const parent = nodeMap.get(parentId)!
        const node = nodeMap.get(id)!
        if (parent.children) {
          const exists = parent.children.some(c => String(c.id) === id)
          if (!exists) parent.children.push(node)
        }
        childIds.add(id)
      }
    }

    // 4) 建立根列表：未作为子节点出现过、且 id !== '0' 的节点
    const roots: BookmarkNode[] = []
    for (const it of items) {
      const id = String(it.id)
      if (id !== '0' && !childIds.has(id)) {
        const node = nodeMap.get(id)
        if (node && !roots.some(r => r.id === id)) roots.push(node)
      }
    }

    // 5) 按 index 排序（若存在）
    const getIndex = (id: string) => {
      const raw = uniqueById.get(id)
      return raw && typeof raw.index === 'number' ? raw.index : 0
    }
    const sortChildren = (nodes: BookmarkNode[]) => {
      nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id))
      for (const n of nodes) if (n.children?.length) sortChildren(n.children)
    }
    sortChildren(roots)

    return roots
  }
}

export type { BookmarkMapping }

export type { ChromeBookmarkTreeNode }
