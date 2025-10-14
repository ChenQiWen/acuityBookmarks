/**
 * 书签管理 Store
 * 负责书签的增删改查、树结构管理、数据同步
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import type { ChromeBookmarkTreeNode, ProposalNode } from '@/types'
import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'

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

export const useBookmarkManagementStore = defineStore(
  'bookmark-management',
  () => {
    // === 核心数据状态 ===
    const originalTree = ref<ChromeBookmarkTreeNode[]>([])
    const newProposalTree = ref<ProposalNode>({
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

    // === 数据加载状态 ===
    const isPageLoading = ref(true)
    const loadingMessage = ref('正在加载书签数据...')

    // === 计算属性 ===
    const bookmarkCount = computed(() => {
      const count = (nodes: ChromeBookmarkTreeNode[]): number => {
        return nodes.reduce((acc, node) => {
          if (node.url) acc++
          if (node.children) acc += count(node.children)
          return acc
        }, 0)
      }
      return count(originalTree.value)
    })

    const folderCount = computed(() => {
      const count = (nodes: ChromeBookmarkTreeNode[]): number => {
        return nodes.reduce((acc, node) => {
          if (!node.url) acc++
          if (node.children) acc += count(node.children)
          return acc
        }, 0)
      }
      return count(originalTree.value)
    })

    // === Actions ===

    /**
     * 加载书签数据
     */
    const loadBookmarks = async () => {
      try {
        isPageLoading.value = true
        loadingMessage.value = '正在加载书签数据...'

        // 模拟获取书签数据
        const bookmarks: ChromeBookmarkTreeNode[] = [
          {
            id: '1',
            title: '示例书签',
            url: 'https://example.com',
            children: []
          }
        ]
        originalTree.value = bookmarks

        logger.info('Management', '书签数据加载完成', {
          count: bookmarks.length
        })
      } catch (error) {
        logger.error('Management', '加载书签数据失败', error)
        throw error
      } finally {
        isPageLoading.value = false
      }
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

        // 重新加载数据
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

        // 重新加载数据
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

        // 重新加载数据
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

        // 重新加载数据
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
     * 应用暂存更改
     */
    const applyStagedChanges = async () => {
      try {
        if (stagedEdits.value.length === 0) return

        // 这里应该调用应用服务来执行批量操作
        // 暂时清空暂存区
        stagedEdits.value = []
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
     */
    const clearStagedChanges = () => {
      stagedEdits.value = []
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
      return '提案书签树'
    }

    /**
     * 获取提案面板图标
     */
    const getProposalPanelIcon = () => {
      return 'mdi-lightbulb-outline'
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
      editFolder
    }
  }
)
