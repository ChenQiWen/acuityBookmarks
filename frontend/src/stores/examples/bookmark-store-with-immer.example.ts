/**
 * Bookmark Store 使用 Immer 的示例
 *
 * 这个文件展示如何在 Pinia Store 中使用 Immer
 * 来简化复杂的状态更新操作
 *
 * 📝 注意：这是示例代码，用于参考和学习
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { updateRef, updateMap } from '@/infrastructure/state/immer-helpers'
import type { BookmarkNode } from '@/types/domain/bookmark'

export const useBookmarkStoreWithImmer = defineStore('bookmarks-immer', () => {
  // 状态
  const nodes = ref(new Map<string, BookmarkNode>())
  const selectedIds = ref<Set<string>>(new Set())

  /**
   * 示例 1: 更新单个书签（使用 Immer）
   *
   * Before（手动不可变更新）:
   * ```typescript
   * const node = nodes.value.get(id)
   * if (node) {
   *   nodes.value = new Map(nodes.value)  // 复制 Map
   *   nodes.value.set(id, { ...node, title: newTitle })  // 复制对象
   * }
   * ```
   *
   * After（使用 Immer）:
   */
  function updateBookmarkTitle(id: string, newTitle: string) {
    updateMap(nodes, draft => {
      const node = draft.get(id)
      if (node) {
        node.title = newTitle // 直接修改，Immer 处理不可变性
      }
    })
  }

  /**
   * 示例 2: 批量更新书签的多个字段
   */
  function updateBookmark(id: string, changes: Partial<BookmarkNode>) {
    updateMap(nodes, draft => {
      const node = draft.get(id)
      if (node) {
        Object.assign(node, changes) // 直接赋值
      }
    })
  }

  /**
   * 示例 3: 更新嵌套的树形结构
   *
   * Before（手动深拷贝）:
   * ```typescript
   * const node = nodes.value.get(parentId)
   * if (node && node.children) {
   *   nodes.value = new Map(nodes.value)
   *   nodes.value.set(parentId, {
   *     ...node,
   *     children: node.children.map(child =>
   *       child.id === childId
   *         ? { ...child, title: newTitle }
   *         : child
   *     )
   *   })
   * }
   * ```
   *
   * After（使用 Immer）:
   */
  function updateChildBookmark(
    parentId: string,
    childId: string,
    newTitle: string
  ) {
    updateMap(nodes, draft => {
      const parent = draft.get(parentId)
      if (parent && parent.children) {
        const child = parent.children.find(
          (c: BookmarkNode) => c.id === childId
        )
        if (child) {
          child.title = newTitle // 直接修改嵌套对象
        }
      }
    })
  }

  /**
   * 示例 4: 数组操作（添加、删除、排序）
   */
  function addChildToFolder(parentId: string, newChild: BookmarkNode) {
    updateMap(nodes, draft => {
      const parent = draft.get(parentId)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(newChild) // 直接 push
      }
    })
  }

  function removeChildFromFolder(parentId: string, childId: string) {
    updateMap(nodes, draft => {
      const parent = draft.get(parentId)
      if (parent && parent.children) {
        const index = parent.children.findIndex(
          (c: BookmarkNode) => c.id === childId
        )
        if (index !== -1) {
          parent.children.splice(index, 1) // 直接 splice
        }
      }
    })
  }

  function reorderChildren(
    parentId: string,
    oldIndex: number,
    newIndex: number
  ) {
    updateMap(nodes, draft => {
      const parent = draft.get(parentId)
      if (parent && parent.children) {
        const [removed] = parent.children.splice(oldIndex, 1)
        parent.children.splice(newIndex, 0, removed)
      }
    })
  }

  /**
   * 示例 5: 更新 Set（选中状态）
   */
  function toggleSelection(id: string) {
    updateRef(selectedIds, draft => {
      if (draft.has(id)) {
        draft.delete(id) // Set 操作也可以直接用
      } else {
        draft.add(id)
      }
    })
  }

  function selectMultiple(ids: string[]) {
    updateRef(selectedIds, draft => {
      ids.forEach(id => draft.add(id))
    })
  }

  function clearSelection() {
    selectedIds.value = new Set() // 简单的替换不需要 Immer
  }

  /**
   * 示例 6: 复杂的批量操作
   *
   * 一次性更新多个书签的多个字段
   */
  function batchUpdateBookmarks(
    updates: Array<{ id: string; changes: Partial<BookmarkNode> }>
  ) {
    updateMap(nodes, draft => {
      updates.forEach(({ id, changes }) => {
        const node = draft.get(id)
        if (node) {
          Object.assign(node, changes)
        }
      })
    })
  }

  return {
    nodes,
    selectedIds,

    // Actions
    updateBookmarkTitle,
    updateBookmark,
    updateChildBookmark,
    addChildToFolder,
    removeChildFromFolder,
    reorderChildren,
    toggleSelection,
    selectMultiple,
    clearSelection,
    batchUpdateBookmarks
  }
})

/**
 * 💡 总结：Immer 的优势
 *
 * 1. **代码可读性**: 直接修改，不需要深拷贝和展开运算符
 * 2. **减少错误**: 不会忘记拷贝某个层级，Immer 自动处理
 * 3. **性能优化**: Immer 使用结构共享，只复制变更的部分
 * 4. **类型安全**: TypeScript 能正确推断 draft 的类型
 *
 * 📌 最佳实践：
 *
 * - ✅ 复杂嵌套对象更新 → 使用 Immer
 * - ✅ 数组操作（push/splice/sort） → 使用 Immer
 * - ✅ Map/Set 操作 → 使用 Immer
 * - ❌ 简单的值替换 → 不需要 Immer (ref.value = newValue)
 * - ❌ 计算属性 → 不需要 Immer
 */
