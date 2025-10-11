/**
 * 核心：书签树工具（与 UI 解耦）
 *
 * 能力：
 * - 查找/插入/移除节点；
 * - 递归重建 index 字段，维持稳定顺序；
 *
 * 设计：
 * - 使用迭代/递归混合策略，兼顾可读性与性能；
 * - 保持纯函数签名，便于单元测试与复用。
 */

export interface GenericTreeNode {
  id: string
  title?: string
  url?: string
  parentId?: string
  index?: number
  children?: GenericTreeNode[]
}

export function findNodeById<T extends GenericTreeNode>(
  nodes: T[],
  id: string
): { node: T | null; parent: T | null } {
  const stack: Array<{ node: T; parent: T | null }> = []
  nodes.forEach(n => stack.push({ node: n, parent: null }))
  while (stack.length) {
    const { node, parent } = stack.pop() as { node: T; parent: T | null }
    if (node.id === id) return { node, parent }
    if (node.children)
      node.children.forEach(ch => stack.push({ node: ch as T, parent: node }))
  }
  return { node: null, parent: null }
}

export function removeNodeById<T extends GenericTreeNode>(
  nodes: T[],
  id: string
): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.id === id) {
      nodes.splice(i, 1)
      return true
    }
    if (n.children?.length) {
      const removed = removeNodeById(n.children as T[], id)
      if (removed) return true
    }
  }
  return false
}

export function insertNodeToParent<T extends GenericTreeNode>(
  nodes: T[],
  parentId: string | undefined,
  newNode: T,
  index = 0
): boolean {
  if (!parentId) return false
  const { node: parent } = findNodeById(nodes, parentId)
  if (!parent) return false
  if (!parent.children) parent.children = []
  const clampedIndex = Math.max(0, Math.min(index, parent.children.length))
  ;(parent.children as T[]).splice(clampedIndex, 0, newNode)
  // 重建index字段
  parent.children.forEach((c, i) => (c.index = i))
  return true
}

export function rebuildIndexesRecursively<T extends GenericTreeNode>(
  nodes: T[]
) {
  nodes.forEach((n, i) => {
    n.index = i
    if (n.children) rebuildIndexesRecursively(n.children as T[])
  })
}
