/**
 * 应用层：树形结构协作服务
 *
 * 目的：
 * - 在“页面/组件层”与“核心 diff 引擎”之间做数据形状转换；
 * - 提供克隆、映射、分块构建与比较等高层接口；
 * - 通过 `requestIdleCallback`/`setTimeout` 进行分块调度，降低主线程阻塞；
 * - 保持纯函数与可预测性，便于测试与复用。
 */
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
} from '@/core/bookmark/services/bookmark-converters'

export type ProposalNodeLike = ProposalNode

/** 深拷贝树（用于避免原始结构被改动）。 */
function deepCloneTree<T>(tree: T): T {
  return JSON.parse(JSON.stringify(tree))
}

/** 将完整树克隆为 Proposal 形态，便于后续 diff 与映射。 */
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

/**
 * 建立原始树与提议树之间的映射（基础版）。
 * - 规则：按 id 直连；若提议缺少 id 或新增，则仅建立可直连部分。
 */
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

/**
 * 分块构建映射（大数据量场景）
 * - 支持 onProgress 回调；
 * - 优先使用 `requestIdleCallback`，否则退化为 `setTimeout(0)`。
 */
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

/**
 * 高层接口集合：对外暴露克隆、映射、分块映射与树比较。
 * - 在 compareTrees 中统一转换到 BookmarkNode 形状再交由 diff 引擎处理。
 */
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

    const t0 = performance.now()

    // 1) 不做按 id 去重：严格保持来自 IndexedDB 的真实数据与顺序
    //    假定 IndexedDB 的写入即遵循 Chrome API 顺序与 parentId/index 语义
    const items = records.slice() // 保留输入顺序

    // ✅ 性能优化：预先构建 id → index 的映射，避免后续 O(n) 查找
    const indexMap = new Map<string, number>()
    for (const it of items) {
      const id = String(it.id)
      indexMap.set(id, typeof it.index === 'number' ? it.index : 0)
    }
    const t1 = performance.now()
    console.log(
      `    [buildViewTreeFromFlat] 索引映射构建完成，耗时 ${(t1 - t0).toFixed(0)}ms`
    )

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
    const t2 = performance.now()
    console.log(
      `    [buildViewTreeFromFlat] 节点映射构建完成，耗时 ${(t2 - t1).toFixed(0)}ms`
    )

    // 3) 建立父子关系（对子列表去重），并记录哪些节点作为子节点出现过
    const childIds = new Set<string>()
    for (const it of items) {
      const id = String(it.id)
      const parentId = it.parentId ? String(it.parentId) : undefined
      if (parentId && nodeMap.has(parentId) && parentId !== '0') {
        const parent = nodeMap.get(parentId)!
        const node = nodeMap.get(id)!
        if (parent.children) parent.children.push(node)
        childIds.add(id)
      }
    }
    const t3 = performance.now()
    console.log(
      `    [buildViewTreeFromFlat] 父子关系构建完成，耗时 ${(t3 - t2).toFixed(0)}ms`
    )

    // 4) 建立根列表：未作为子节点出现过、且 id !== '0' 的节点
    // ✅ 性能优化：使用 Set 追踪已添加的根节点，避免 O(n) 的数组查找
    const roots: BookmarkNode[] = []
    const rootIds = new Set<string>()
    for (const it of items) {
      const id = String(it.id)
      if (id !== '0' && !childIds.has(id) && !rootIds.has(id)) {
        const node = nodeMap.get(id)
        if (node) {
          roots.push(node)
          rootIds.add(id)
        }
      }
    }
    const t4 = performance.now()
    console.log(
      `    [buildViewTreeFromFlat] 根节点列表构建完成，耗时 ${(t4 - t3).toFixed(0)}ms，${roots.length} 个根节点`
    )

    // 5) 按 index 排序（若存在）
    // ✅ 性能优化：使用预构建的 indexMap，避免每次都 O(n) 查找
    const getIndex = (id: string): number => indexMap.get(id) ?? 0
    const sortChildren = (nodes: BookmarkNode[]) => {
      nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id))
      for (const n of nodes) if (n.children?.length) sortChildren(n.children)
    }
    sortChildren(roots)
    const t5 = performance.now()
    console.log(
      `    [buildViewTreeFromFlat] 排序完成，耗时 ${(t5 - t4).toFixed(0)}ms`
    )
    console.log(
      `    [buildViewTreeFromFlat] ✅ 总耗时 ${(t5 - t0).toFixed(0)}ms`
    )

    return roots
  }
}

export type { BookmarkMapping }

export type { ChromeBookmarkTreeNode }
