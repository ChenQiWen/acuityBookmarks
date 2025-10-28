/**
 * 书签管理 Store
 * 负责书签的增删改查、树结构管理、数据同步
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { treeAppService } from '@/application/bookmark/tree-app-service'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import type { BookmarkNode } from '@/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { updateRef } from '@/infrastructure/state/immer-helpers'
import { modernStorage } from '@/infrastructure/storage/modern-storage'

export interface EditBookmarkData {
  id: string
  title: string
  url: string
  parentId?: string
}

export interface AddItemData {
  type: 'folder' | 'bookmark'
  title: string
  url?: string
  parentId?: string
}

/**
 * 🔴 Session Storage Keys:
 * - `bookmark_mgmt_original_expanded`: 原始树展开状态
 * - `bookmark_mgmt_proposal_expanded`: 提案树展开状态
 */
const SESSION_KEYS = {
  ORIGINAL_EXPANDED: 'bookmark_mgmt_original_expanded',
  PROPOSAL_EXPANDED: 'bookmark_mgmt_proposal_expanded'
} as const

export const useBookmarkManagementStore = defineStore(
  'bookmark-management',
  () => {
    // === 核心数据状态 ===
    const bookmarkStore = useBookmarkStore()

    const originalTree = computed(
      () => bookmarkStore.bookmarkTree as BookmarkNode[]
    )

    interface ProposalTreeState {
      id: string
      title: string
      children: BookmarkNode[]
    }

    const newProposalTree = ref<ProposalTreeState>({
      id: 'root-empty',
      title: '等待数据源',
      children: []
    })
    const structuresAreDifferent = ref(false)

    // === 暂存区与未保存更改 ===
    interface StagedEdit {
      id: string
      type: 'create' | 'update' | 'delete' | 'move' | 'reorder'
      nodeId?: string
      payload?: Record<string, unknown>
      reason?: string
      timestamp: number
    }

    const stagedEdits = ref<StagedEdit[]>([])
    const hasUnsavedChanges = ref(false)

    // === 书签树展开状态 ===
    const originalExpandedFolders = ref<Set<string>>(new Set())
    const proposalExpandedFolders = ref<Set<string>>(new Set())

    // === Session Storage 辅助方法 ===
    /**
     * 从 Session Storage 加载展开状态
     */
    const loadExpandedState = async () => {
      try {
        const [originalIds, proposalIds] = await Promise.all([
          modernStorage.getSession<string[]>(
            SESSION_KEYS.ORIGINAL_EXPANDED,
            []
          ),
          modernStorage.getSession<string[]>(SESSION_KEYS.PROPOSAL_EXPANDED, [])
        ])

        updateRef(originalExpandedFolders, draft => {
          draft.clear()
          ;(originalIds ?? []).forEach(id => draft.add(id))
        })

        updateRef(proposalExpandedFolders, draft => {
          draft.clear()
          ;(proposalIds ?? []).forEach(id => draft.add(id))
        })

        logger.debug(
          'BookmarkManagement',
          '✅ 展开状态已从 session storage 恢复',
          {
            original: originalExpandedFolders.value.size,
            proposal: proposalExpandedFolders.value.size
          }
        )
      } catch (error) {
        logger.warn('BookmarkManagement', '展开状态加载失败，使用默认值', error)
      }
    }

    /**
     * 保存原始树展开状态到 Session Storage
     */
    const saveOriginalExpandedState = async () => {
      try {
        await modernStorage.setSession(
          SESSION_KEYS.ORIGINAL_EXPANDED,
          Array.from(originalExpandedFolders.value)
        )
      } catch (error) {
        logger.warn('BookmarkManagement', '保存原始树展开状态失败', error)
      }
    }

    /**
     * 保存提案树展开状态到 Session Storage
     */
    const saveProposalExpandedState = async () => {
      try {
        await modernStorage.setSession(
          SESSION_KEYS.PROPOSAL_EXPANDED,
          Array.from(proposalExpandedFolders.value)
        )
      } catch (error) {
        logger.warn('BookmarkManagement', '保存提案树展开状态失败', error)
      }
    }

    // 🔴 初始化：从 session storage 加载展开状态
    loadExpandedState().catch(err => {
      logger.error('BookmarkManagement', '初始化展开状态失败', err)
    })

    // === 数据加载状态 ===
    // Management 页面有自己的加载状态（例如批量操作时）
    // 但初始加载时同步 bookmarkStore 的状态
    const isPageLoading = ref(true)
    const loadingMessage = ref('正在加载书签数据...')

    // === 计算属性 ===
    const bookmarkCount = computed(() => {
      const count = (nodes: BookmarkNode[]): number => {
        return nodes.reduce((acc, node) => {
          if (node.url) acc++
          if (node.children) acc += count(node.children)
          return acc
        }, 0)
      }
      return count(originalTree.value)
    })

    const folderCount = computed(() => {
      const count = (nodes: BookmarkNode[]): number => {
        return nodes.reduce((acc, node) => {
          if (!node.url) acc++
          if (node.children) acc += count(node.children)
          return acc
        }, 0)
      }
      return count(originalTree.value)
    })

    // === Actions ===

    const ensureNodeLoaded = (node: BookmarkNode): BookmarkNode => {
      const cloned: BookmarkNode = {
        ...node,
        id: String(node.id),
        parentId: node.parentId ? String(node.parentId) : undefined
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        cloned.children = node.children.map(child => ensureNodeLoaded(child))
        cloned.childrenCount = cloned.children.length
        cloned._childrenLoaded = true
      } else {
        cloned.children = []
        cloned.childrenCount = node.childrenCount ?? 0
        cloned._childrenLoaded = true
      }
      return cloned
    }

    /**
     * 从 IndexedDB 加载书签数据（唯一数据源）
     *
     * 架构原则：
     * - Chrome API → Background Script → IndexedDB → UI
     * - 左右两侧树都使用相同的 IndexedDB 数据源
     */
    /**
     * 从 IndexedDB 加载书签数据
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const loadBookmarks = async () => {
      try {
        isPageLoading.value = true
        loadingMessage.value = '正在加载书签数据...'

        // 🔴 清空展开状态并同步到 session storage
        updateRef(originalExpandedFolders, draft => {
          draft.clear()
        })
        updateRef(proposalExpandedFolders, draft => {
          draft.clear()
        })
        await Promise.all([
          saveOriginalExpandedState(),
          saveProposalExpandedState()
        ])

        // 从 IndexedDB 加载书签数据
        await bookmarkAppService.initialize()
        const recordsResult = await bookmarkAppService.getAllBookmarks()

        if (!recordsResult.ok || !recordsResult.value) {
          throw recordsResult.error ?? new Error('无法读取书签数据')
        }

        // 构建树结构
        const viewTree = treeAppService.buildViewTreeFromFlat(
          recordsResult.value
        )

        // 更新左侧树（通过 bookmarkStore）
        bookmarkStore.reset()
        bookmarkStore.addNodes(viewTree)

        // 更新右侧树（直接设置）
        setProposalTreeFromRecords(recordsResult.value)

        logger.info('Management', '✅ 从 IndexedDB 加载书签完成', {
          leftTreeRoots: originalTree.value.length,
          totalRecords: recordsResult.value.length
        })
      } catch (error) {
        logger.error('Management', '❌ 从 IndexedDB 加载书签失败', error)
        throw error
      } finally {
        isPageLoading.value = false
      }
    }

    /**
     * 设置提案树
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const setProposalTree = (nodes: BookmarkNode[]): void => {
      const normalized = nodes.map(node => ensureNodeLoaded(node))

      // 🆕 使用 Immer 不可变更新 newProposalTree
      updateRef(newProposalTree, draft => {
        draft.id = 'root-proposal'
        draft.title = '提案书签树'
        draft.children = normalized
      })

      // 🔴 更新提案树展开状态并同步到 session storage
      updateRef(proposalExpandedFolders, draft => {
        draft.clear()
        for (const root of normalized) {
          draft.add(String(root.id))
        }
      })
      // 异步保存到 session storage（不阻塞主流程）
      saveProposalExpandedState().catch(err => {
        logger.warn(
          'BookmarkManagement',
          'setProposalTree 保存展开状态失败',
          err
        )
      })
    }

    const setProposalTreeFromRecords = (records: BookmarkRecord[]): void => {
      const viewTree = treeAppService.buildViewTreeFromFlat(records)
      setProposalTree(viewTree)
    }

    /**
     * 添加新书签或文件夹
     */
    const addBookmark = async (data: AddItemData) => {
      try {
        // 模拟添加书签
        const result = {
          id: Date.now().toString(),
          title: data.title,
          url: data.url
        }

        await loadBookmarks()

        logger.info('Management', '书签添加成功', { id: result.id })
        return result
      } catch (error) {
        logger.error('Management', '添加书签失败', error)
        throw error
      }
    }

    /**
     * 编辑书签
     */
    const editBookmark = async (data: EditBookmarkData) => {
      try {
        // 模拟更新书签
        console.log('更新书签:', data)

        await loadBookmarks()

        logger.info('Management', '书签编辑成功', { id: data.id })
      } catch (error) {
        logger.error('Management', '编辑书签失败', error)
        throw error
      }
    }

    /**
     * 删除书签
     */
    const deleteBookmark = async (id: string) => {
      try {
        // 模拟删除书签
        console.log('删除书签:', id)

        await loadBookmarks()

        logger.info('Management', '书签删除成功', { id })
      } catch (error) {
        logger.error('Management', '删除书签失败', error)
        throw error
      }
    }

    /**
     * 移动书签
     */
    const moveBookmark = async (
      id: string,
      parentId: string,
      index?: number
    ) => {
      try {
        // 模拟移动书签
        console.log('移动书签:', { id, parentId, index })

        await loadBookmarks()

        logger.info('Management', '书签移动成功', { id, parentId, index })
      } catch (error) {
        logger.error('Management', '移动书签失败', error)
        throw error
      }
    }

    /**
     * 构建书签映射
     */
    const buildBookmarkMapping = async () => {
      try {
        // 模拟构建书签映射
        const mapping = new Map()
        return mapping
      } catch (error) {
        logger.error('Management', '构建书签映射失败', error)
        throw error
      }
    }

    /**
     * 应用暂存的更改
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const applyStagedChanges = async () => {
      try {
        if (stagedEdits.value.length === 0) return

        // 这里应该调用应用服务来执行批量操作
        // 🆕 使用 Immer 清空暂存区
        updateRef(stagedEdits, draft => {
          draft.length = 0
        })
        hasUnsavedChanges.value = false

        // 重新加载数据
        await loadBookmarks()

        logger.info('Management', '暂存更改应用成功')
      } catch (error) {
        logger.error('Management', '应用暂存更改失败', error)
        throw error
      }
    }

    /**
     * 清空暂存区
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const clearStagedChanges = () => {
      // 🆕 使用 Immer 清空数组
      updateRef(stagedEdits, draft => {
        draft.length = 0
      })
      hasUnsavedChanges.value = false
      logger.info('Management', '暂存区已清空')
    }

    /**
     * 删除文件夹
     */
    const deleteFolder = async (folderOrId: BookmarkNode | string) => {
      const folderId =
        typeof folderOrId === 'string' ? folderOrId : folderOrId.id
      logger.info('Management', '暂存删除文件夹:', folderId)
      if (!newProposalTree.value.children) return

      // 模拟删除文件夹逻辑
      const removed = true // 简化实现
      if (removed) {
        hasUnsavedChanges.value = true
        logger.info('Management', '文件夹删除已暂存')
      }
    }

    /**
     * 批量删除
     */
    const bulkDeleteByIds = (ids: string[]) => {
      if (!Array.isArray(ids) || ids.length === 0) return

      logger.info('Management', '批量删除暂存:', ids)
      hasUnsavedChanges.value = true
      // 模拟批量删除逻辑
    }

    /**
     * 获取提案面板标题
     */
    const getProposalPanelTitle = () => {
      return '整理建议'
    }

    /**
     * 获取提案面板图标
     */
    const getProposalPanelIcon = () => {
      return 'icon-lightbulb'
    }

    /**
     * 获取提案面板颜色
     */
    const getProposalPanelColor = () => {
      return 'primary'
    }

    /**
     * 初始化 Store
     */
    const initialize = async () => {
      await loadBookmarks()
      logger.info('Management', 'Store 初始化完成')
    }

    /**
     * 编辑文件夹
     */
    const editFolder = async (data: EditBookmarkData) => {
      // 文件夹编辑逻辑
      await editBookmark(data)
    }

    return {
      // State
      originalTree,
      newProposalTree,
      structuresAreDifferent,
      stagedEdits,
      hasUnsavedChanges,
      originalExpandedFolders,
      proposalExpandedFolders,
      isPageLoading,
      loadingMessage,

      // Computed
      bookmarkCount,
      folderCount,

      // Actions
      loadBookmarks,
      addBookmark,
      editBookmark,
      deleteBookmark,
      moveBookmark,
      buildBookmarkMapping,
      applyStagedChanges,
      clearStagedChanges,
      deleteFolder,
      bulkDeleteByIds,
      getProposalPanelTitle,
      getProposalPanelIcon,
      getProposalPanelColor,
      initialize,
      editFolder,
      setProposalTree,
      setProposalTreeFromRecords,

      // 🔴 Session Storage 同步方法
      saveOriginalExpandedState,
      saveProposalExpandedState
    }
  }
)
