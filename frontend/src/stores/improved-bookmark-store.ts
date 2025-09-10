/**
 * 🚀 改进版书签状态管理
 * 采用类似React的不可变数据更新模式，解决Vue响应式问题
 */

import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import type { BookmarkNode, ChromeBookmarkTreeNode } from '../types'

// 🔧 不可变数据更新工具函数
const immerLike = {
  /**
   * 更新嵌套树结构中的节点标题
   */
  updateNodeTitle: (tree: BookmarkNode[], nodeId: string, newTitle: string): BookmarkNode[] => {
    return tree.map(node => {
      if (node.id === nodeId) {
        return { ...node, title: newTitle }
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: immerLike.updateNodeTitle(node.children, nodeId, newTitle)
        }
      }
      return node
    })
  },

  /**
   * 重新排序节点
   */
  reorderNodes: (tree: BookmarkNode[], parentId: string, newOrder: BookmarkNode[]): BookmarkNode[] => {
    if (parentId === 'root') {
      return [...newOrder]
    }
    
    return tree.map(node => {
      if (node.id === parentId) {
        return { ...node, children: [...newOrder] }
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: immerLike.reorderNodes(node.children, parentId, newOrder)
        }
      }
      return node
    })
  },

  /**
   * 删除节点
   */
  removeNode: (tree: BookmarkNode[], nodeId: string): BookmarkNode[] => {
    return tree.filter(node => {
      if (node.id === nodeId) {
        return false
      }
      if (node.children && node.children.length > 0) {
        node.children = immerLike.removeNode(node.children, nodeId)
      }
      return true
    })
  }
}

// 📊 状态变化日志
const stateLogger = {
  log: (action: string, payload: any, stateBefore: any, stateAfter: any) => {
    console.group(`🔄 [状态变化] ${action}`)
    console.log('📥 载荷:', payload)
    console.log('📊 变化前:', JSON.stringify(stateBefore).slice(0, 200) + '...')
    console.log('📊 变化后:', JSON.stringify(stateAfter).slice(0, 200) + '...')
    console.log('⏰ 时间:', new Date().toISOString())
    console.groupEnd()
  }
}

export const useImprovedBookmarkStore = defineStore('improvedBookmarks', () => {
  // 🏗️ 核心状态
  const originalTree = ref<ChromeBookmarkTreeNode[]>([])
  const proposalTree = ref<BookmarkNode[]>([])
  const hasChanges = ref(false)
  const lastUpdateTime = ref<number>(0)

  // 🧮 计算属性
  const structuresAreDifferent = computed(() => {
    return hasChanges.value && proposalTree.value.length > 0
  })

  const changeCount = computed(() => {
    // 简单的变化计数逻辑
    return lastUpdateTime.value > 0 ? 1 : 0
  })

  // 🎯 统一的状态更新方法

  /**
   * 初始化书签数据
   */
  const initializeBookmarks = (chromeTree: ChromeBookmarkTreeNode[]) => {
    const before = { originalTree: originalTree.value, proposalTree: proposalTree.value }
    
    originalTree.value = [...chromeTree]
    proposalTree.value = JSON.parse(JSON.stringify(chromeTree)) // 深拷贝
    hasChanges.value = false
    lastUpdateTime.value = Date.now()
    
    const after = { originalTree: originalTree.value, proposalTree: proposalTree.value }
    stateLogger.log('INITIALIZE_BOOKMARKS', { chromeTree }, before, after)
  }

  /**
   * 更新节点标题
   */
  const updateNodeTitle = async (nodeId: string, newTitle: string) => {
    const before = { proposalTree: proposalTree.value }
    
    proposalTree.value = immerLike.updateNodeTitle(proposalTree.value, nodeId, newTitle)
    hasChanges.value = true
    lastUpdateTime.value = Date.now()
    
    const after = { proposalTree: proposalTree.value }
    stateLogger.log('UPDATE_NODE_TITLE', { nodeId, newTitle }, before, after)
    
    // 确保Vue检测到变化
    await nextTick()
    console.log('✅ 标题更新完成，Vue已检测到变化')
  }

  /**
   * 重新排序节点
   */
  const reorderNodes = async (parentId: string, newOrder: BookmarkNode[]) => {
    const before = { proposalTree: proposalTree.value }
    
    proposalTree.value = immerLike.reorderNodes(proposalTree.value, parentId, newOrder)
    hasChanges.value = true
    lastUpdateTime.value = Date.now()
    
    const after = { proposalTree: proposalTree.value }
    stateLogger.log('REORDER_NODES', { parentId, newOrder }, before, after)
    
    await nextTick()
    console.log('✅ 重排序完成，Vue已检测到变化')
  }

  /**
   * 删除节点
   */
  const removeNode = async (nodeId: string) => {
    const before = { proposalTree: proposalTree.value }
    
    proposalTree.value = immerLike.removeNode(proposalTree.value, nodeId)
    hasChanges.value = true
    lastUpdateTime.value = Date.now()
    
    const after = { proposalTree: proposalTree.value }
    stateLogger.log('REMOVE_NODE', { nodeId }, before, after)
    
    await nextTick()
    console.log('✅ 删除完成，Vue已检测到变化')
  }

  /**
   * 应用所有更改到Chrome书签
   */
  const applyChangesToChrome = async (): Promise<void> => {
    console.log('🚀 开始应用更改到Chrome书签...')
    
    try {
      // 获取当前Chrome书签
      const currentChromeTree = await new Promise<ChromeBookmarkTreeNode[]>((resolve, reject) => {
        chrome.bookmarks.getTree((tree) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(tree as ChromeBookmarkTreeNode[])
          }
        })
      })

      // 比较并应用更改
      await applyChangesRecursively(currentChromeTree[0].children || [], proposalTree.value)
      
      // 刷新原始数据
      originalTree.value = JSON.parse(JSON.stringify(proposalTree.value))
      hasChanges.value = false
      lastUpdateTime.value = Date.now()
      
      console.log('✅ 所有更改已成功应用到Chrome书签')
      
    } catch (error) {
      console.error('❌ 应用更改失败:', error)
      throw error
    }
  }

  /**
   * 递归应用更改
   */
  const applyChangesRecursively = async (
    currentNodes: ChromeBookmarkTreeNode[],
    proposalNodes: BookmarkNode[]
  ): Promise<void> => {
    // 1. 处理重命名
    for (const proposalNode of proposalNodes) {
      const currentNode = currentNodes.find(n => n.id === (proposalNode as any).id)
      if (currentNode && currentNode.title !== proposalNode.title) {
        await new Promise<void>((resolve, reject) => {
          chrome.bookmarks.update((proposalNode as any).id, {
            title: proposalNode.title
          }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              console.log(`✅ 重命名成功: ${proposalNode.title}`)
              resolve()
            }
          })
        })
      }
    }

    // 2. 处理重排序
    const needsReordering = currentNodes.some((current, index) => {
      const proposalNode = proposalNodes[index]
      return !proposalNode || current.id !== (proposalNode as any).id
    })

    if (needsReordering) {
      // 使用chrome.bookmarks.move进行重排序
      for (let i = 0; i < proposalNodes.length; i++) {
        const proposalNode = proposalNodes[i]
        const currentIndex = currentNodes.findIndex(n => n.id === (proposalNode as any).id)
        
        if (currentIndex !== -1 && currentIndex !== i) {
          await new Promise<void>((resolve, reject) => {
            chrome.bookmarks.move((proposalNode as any).id, {
              index: i
            }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError)
              } else {
                console.log(`✅ 移动成功: ${proposalNode.title} -> 位置 ${i}`)
                resolve()
              }
            })
          })
        }
      }
    }

    // 3. 递归处理子节点
    for (const proposalNode of proposalNodes) {
      if (proposalNode.children && proposalNode.children.length > 0) {
        const currentNode = currentNodes.find(n => n.id === (proposalNode as any).id)
        if (currentNode && currentNode.children) {
          await applyChangesRecursively(currentNode.children, proposalNode.children)
        }
      }
    }
  }

  /**
   * 重置所有更改
   */
  const resetChanges = () => {
    const before = { proposalTree: proposalTree.value }
    
    proposalTree.value = JSON.parse(JSON.stringify(originalTree.value))
    hasChanges.value = false
    lastUpdateTime.value = Date.now()
    
    const after = { proposalTree: proposalTree.value }
    stateLogger.log('RESET_CHANGES', {}, before, after)
  }

  return {
    // 状态
    originalTree,
    proposalTree,
    hasChanges,
    lastUpdateTime,
    
    // 计算属性
    structuresAreDifferent,
    changeCount,
    
    // 方法
    initializeBookmarks,
    updateNodeTitle,
    reorderNodes,
    removeNode,
    applyChangesToChrome,
    resetChanges
  }
})
