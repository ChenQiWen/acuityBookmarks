/**
 * Management页面IndexedDB适配器
 * 提供给Management页面使用IndexedDB数据的接口
 * 保持与原有管理接口的兼容性
 */

import { IndexedDBBookmarkManager } from './indexeddb-bookmark-manager'

export interface BookmarkTreeData {
    bookmarks: any[]
    folders: any[]
    totalCount: number
    lastUpdate: number
}

export interface BookmarkStats {
    bookmarks: number
    folders: number
    totalUrls: number
    duplicates: number
    emptyFolders: number
}

/**
 * Management页面的IndexedDB适配器
 */
export class ManagementIndexedDBAdapter {
    private static instance: ManagementIndexedDBAdapter | null = null
    private bookmarkManager: IndexedDBBookmarkManager

    private constructor() {
        this.bookmarkManager = IndexedDBBookmarkManager.getInstance()
    }

    static getInstance(): ManagementIndexedDBAdapter {
        if (!ManagementIndexedDBAdapter.instance) {
            ManagementIndexedDBAdapter.instance = new ManagementIndexedDBAdapter()
        }
        return ManagementIndexedDBAdapter.instance
    }

    /**
     * 初始化适配器
     */
    async initialize(): Promise<void> {
        await this.bookmarkManager.initialize()
    }

    /**
     * 获取书签树数据（兼容原有接口）
     */
    async getBookmarkTreeData(): Promise<BookmarkTreeData> {
        try {
            // 发送消息到Service Worker获取所有书签
            const response = await new Promise<{ success: boolean, data: any[] }>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'GET_BOOKMARK_TREE' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message))
                        } else {
                            resolve(response)
                        }
                    }
                )
            })

            if (!response.success) {
                throw new Error('Failed to get bookmark tree data')
            }

            const bookmarks = response.data || []
            const folders = bookmarks.filter(b => b.isFolder)

            return {
                bookmarks: bookmarks, // 返回所有书签（包括文件夹和URL）
                folders: folders,
                totalCount: bookmarks.length,
                lastUpdate: Date.now()
            }
        } catch (error) {
            console.error('❌ ManagementIndexedDBAdapter获取书签树失败:', error)
            throw error
        }
    }

    /**
     * 获取书签统计信息
     */
    async getBookmarkStats(): Promise<BookmarkStats> {
        try {
            const response = await new Promise<{ success: boolean, data: any }>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'GET_STATS' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message))
                        } else {
                            resolve(response)
                        }
                    }
                )
            })

            if (response.success && response.data) {
                return {
                    bookmarks: response.data.bookmarks || 0,
                    folders: response.data.folders || 0,
                    totalUrls: response.data.totalBookmarks || response.data.bookmarks || 0,
                    duplicates: response.data.duplicates || 0,
                    emptyFolders: response.data.emptyFolders || 0
                }
            }

            // 🚀 降级策略：返回基础统计而不是抛出错误
            console.warn('IndexedDB统计数据不可用，使用基础Chrome API')

            // 尝试直接从Chrome API获取基础统计
            const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => {
                chrome.bookmarks.getTree((result) => {
                    resolve(result || [])
                })
            })

            let bookmarks = 0
            let folders = 0

            const countNodes = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
                nodes.forEach(node => {
                    if (node.url) {
                        bookmarks++
                    } else {
                        folders++
                    }
                    if (node.children) {
                        countNodes(node.children)
                    }
                })
            }

            countNodes(tree)

            console.log('✅ Chrome API降级统计完成:', { bookmarks, folders })

            return {
                bookmarks,
                folders,
                totalUrls: bookmarks,
                duplicates: 0,
                emptyFolders: 0
            }
        } catch (error: any) {
            console.error('❌ ManagementIndexedDBAdapter获取统计失败:', error)
            // 抛出错误让上层处理，不要返回误导性的空值
            throw new Error(`无法获取书签统计数据: ${error.message}`)
        }
    }

    /**
     * 搜索书签（兼容原有接口）
     */
    async searchBookmarks(query: string, limit = 50): Promise<any[]> {
        try {
            const response = await new Promise<{ success: boolean, data: any[] }>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        type: 'SEARCH_BOOKMARKS',
                        data: { query, limit }
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message))
                        } else {
                            resolve(response)
                        }
                    }
                )
            })

            if (response.success) {
                return response.data || []
            }

            return []
        } catch (error) {
            console.error('❌ ManagementIndexedDBAdapter搜索失败:', error)
            return []
        }
    }

    /**
     * 同步书签数据
     */
    async syncBookmarks(): Promise<boolean> {
        try {
            const response = await new Promise<{ success: boolean, changed: boolean }>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'SYNC_BOOKMARKS' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message))
                        } else {
                            resolve(response)
                        }
                    }
                )
            })

            return response.success && response.changed
        } catch (error) {
            console.error('❌ ManagementIndexedDBAdapter同步失败:', error)
            return false
        }
    }

    /**
     * 打开管理页面
     */
    async openManagementPage(): Promise<void> {
        try {
            await new Promise<void>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'OPEN_MANAGEMENT_PAGE' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message))
                        } else if (response.success) {
                            resolve()
                        } else {
                            reject(new Error(response.error))
                        }
                    }
                )
            })
        } catch (error) {
            console.error('❌ ManagementIndexedDBAdapter打开管理页面失败:', error)
            // 降级到直接打开
            chrome.tabs.create({ url: chrome.runtime.getURL('management.html') })
        }
    }

    /**
     * 检查IndexedDB连接状态
     */
    async checkConnection(): Promise<boolean> {
        try {
            await this.getBookmarkStats()
            return true
        } catch (error) {
            console.error('❌ IndexedDB连接检查失败:', error)
            return false
        }
    }
}

// 导出单例实例
export const managementIndexedDBAdapter = ManagementIndexedDBAdapter.getInstance()
