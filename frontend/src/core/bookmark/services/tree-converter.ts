import { logger } from '@/infrastructure/logging/logger'
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
    // 只有 parentId 为 '0' 的节点才是真正的根节点
    // Chrome 书签结构中，'0' 表示根容器（不显示），'1' 是书签栏，'2' 是其他书签
    // 排除 id='0' 的根容器节点，它不应该出现在树中
    if ((node.parentId === '0' || !node.parentId) && node.id !== '0') {
      roots.push(node)
      logger.info(
        'TreeConverter',
        `📌 根节点: id=${node.id}, title="${node.title}", parentId=${node.parentId}, children=${node.children?.length || 0}`
      )
    }
  })

  // 按 index 排序根节点
  roots.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  logger.info(
    'TreeConverter',
    `✅ 树构建完成: ${roots.length} 个根节点, 总节点数: ${nodeMap.size}`
  )

  // 检查每个根节点的 children 数量
  roots.forEach(root => {
    const childCount = root.children?.length || 0
    logger.info(
      'TreeConverter',
      `  - ${root.title} (id=${root.id}): ${childCount} 个直接子节点`
    )
  })

  return roots
}
