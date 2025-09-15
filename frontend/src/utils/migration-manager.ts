/**
 * 迁移管理器 - 已禁用
 * 注意：chrome.storage.local迁移功能已完全移除
 * IndexedDB架构已完全就位
 */

import { IndexedDBCore } from './indexeddb-core'
import { BookmarkDataTransformer } from './bookmark-data-transformer'

export interface MigrationStatus {
    isCompleted: boolean
    isInProgress: boolean
    currentStep: string
    progress: number
    startTime: number
    endTime?: number
    errors: string[]
    migratedData: {
        bookmarks: number
        searchHistory: number
        settings: number
    }
}

export interface MigrationOptions {
    preserveOldData?: boolean      // 是否保留旧数据
    performValidation?: boolean    // 是否执行数据验证
    cleanupAfterMigration?: boolean // 迁移后是否清理
}

/**
 * 迁移管理器
 * 处理从旧架构到IndexedDB的完整迁移
 */
export class MigrationManager {
    private static readonly MIGRATION_KEY = 'indexeddb_migration_status'
    private db: IndexedDBCore
    private transformer: BookmarkDataTransformer
    private status: MigrationStatus

    constructor() {
        this.db = IndexedDBCore.getInstance()
        this.transformer = new BookmarkDataTransformer()

        this.status = {
            isCompleted: false,
            isInProgress: false,
            currentStep: '',
            progress: 0,
            startTime: 0,
            errors: [],
            migratedData: {
                bookmarks: 0,
                searchHistory: 0,
                settings: 0
            }
        }
    }

    /**
     * 检查是否需要迁移
     */
    async needsMigration(): Promise<boolean> {
        try {
            // 检查迁移状态
            const migrationStatus = await this.getMigrationStatus()
            if (migrationStatus?.isCompleted) {
                return false
            }

            // 注意：迁移功能已禁用，跳过旧数据检查
            const oldDataExists = false // await this.checkOldDataExists()

            // 检查IndexedDB是否为空
            const indexedDBEmpty = await this.isIndexedDBEmpty()

            return oldDataExists && indexedDBEmpty

        } catch (error) {
            console.warn('检查迁移需求失败:', error)
            return false
        }
    }

    /**
     * 执行完整迁移
     */
    async performMigration(
        options: MigrationOptions = {},
        onProgress?: (status: MigrationStatus) => void
    ): Promise<MigrationStatus> {
        const opts: Required<MigrationOptions> = {
            preserveOldData: true,
            performValidation: true,
            cleanupAfterMigration: true,
            ...options
        }

        console.log('🚀 开始IndexedDB架构迁移...')

        this.status = {
            isCompleted: false,
            isInProgress: true,
            currentStep: '初始化迁移',
            progress: 0,
            startTime: Date.now(),
            errors: [],
            migratedData: {
                bookmarks: 0,
                searchHistory: 0,
                settings: 0
            }
        }

        try {
            await this.saveMigrationStatus()

            // 第1步：初始化IndexedDB
            await this.updateProgress('初始化IndexedDB数据库', 10, onProgress)
            await this.db.initialize()

            // 第2步：迁移书签数据
            await this.updateProgress('迁移书签数据', 20, onProgress)
            await this.migrateBookmarkData()

            // 第3步：迁移搜索历史
            await this.updateProgress('迁移搜索历史', 60, onProgress)
            await this.migrateSearchHistory()

            // 第4步：迁移设置
            await this.updateProgress('迁移应用设置', 70, onProgress)
            await this.migrateSettings()

            // 第5步：数据验证
            if (opts.performValidation) {
                await this.updateProgress('验证迁移数据', 80, onProgress)
                await this.validateMigratedData()
            }

            // 第6步：清理旧数据
            if (opts.cleanupAfterMigration) {
                await this.updateProgress('清理旧数据', 90, onProgress)
                await this.cleanupOldData()
            }

            // 完成迁移
            await this.updateProgress('迁移完成', 100, onProgress)
            this.status.isCompleted = true
            this.status.isInProgress = false
            this.status.endTime = Date.now()

            await this.saveMigrationStatus()

            const duration = this.status.endTime - this.status.startTime
            console.log(`✅ IndexedDB架构迁移完成，耗时: ${duration}ms`)
            console.log(`📊 迁移数据统计:`, this.status.migratedData)

            return this.status

        } catch (error) {
            console.error('❌ 迁移失败:', error)

            this.status.errors.push((error as Error).message)
            this.status.isInProgress = false
            this.status.endTime = Date.now()

            await this.saveMigrationStatus()

            throw error
        }
    }

    /**
     * 迁移书签数据
     */
    private async migrateBookmarkData(): Promise<void> {
        try {
            // 直接从Chrome API获取最新数据，而不是迁移旧缓存
            console.log('📚 从Chrome API获取书签数据...')
            const result = await this.transformer.loadFromChromeAndProcess()

            this.status.migratedData.bookmarks = result.bookmarkCount + result.folderCount

            console.log(`✅ 书签数据迁移完成: ${this.status.migratedData.bookmarks} 个项目`)

        } catch (error) {
            console.error('❌ 书签数据迁移失败:', error)
            throw new Error(`书签数据迁移失败: ${(error as Error).message}`)
        }
    }

    /**
     * 迁移搜索历史
     */
    private async migrateSearchHistory(): Promise<void> {
        try {
            // 注意：迁移功能已禁用，跳过搜索历史迁移
            const chromeStorage = {} // await this.getChromeStorageData(['searchHistory', 'search_history'])

            let searchHistoryItems: string[] = []

            // 合并不同格式的搜索历史（已禁用）
            if ((chromeStorage as any).searchHistory && Array.isArray((chromeStorage as any).searchHistory)) {
                searchHistoryItems = [...(chromeStorage as any).searchHistory]
            }

            if ((chromeStorage as any).search_history && Array.isArray((chromeStorage as any).search_history)) {
                searchHistoryItems = [...searchHistoryItems, ...(chromeStorage as any).search_history]
            }

            // 去重并保留最近的20条
            const uniqueHistory = [...new Set(searchHistoryItems)].slice(0, 20)

            // 保存到IndexedDB
            for (const query of uniqueHistory) {
                if (query && query.trim()) {
                    await this.db.addSearchHistory(query.trim(), 0) // 历史数据结果数设为0
                }
            }

            this.status.migratedData.searchHistory = uniqueHistory.length

            console.log(`✅ 搜索历史迁移完成: ${uniqueHistory.length} 条记录`)

        } catch (error) {
            console.error('❌ 搜索历史迁移失败:', error)
            // 搜索历史迁移失败不应该阻止整个迁移过程
            this.status.errors.push(`搜索历史迁移失败: ${(error as Error).message}`)
        }
    }

    /**
     * 迁移设置
     */
    private async migrateSettings(): Promise<void> {
        try {
            const settingsToMigrate = [
                'cleanupSettings',
                'storage_strategy',
                'migrated_at',
                'lastSuperBookmarkUpdate'
            ]

            const chromeStorage = await this.getChromeStorageData(settingsToMigrate)

            let migratedCount = 0

            for (const [key, value] of Object.entries(chromeStorage)) {
                if (value !== undefined && value !== null) {
                    await this.db.saveSetting(key, value)
                    migratedCount++
                }
            }

            // 添加迁移标记
            await this.db.saveSetting('migrated_from_chrome_storage', true)
            await this.db.saveSetting('migration_timestamp', Date.now())

            this.status.migratedData.settings = migratedCount

            console.log(`✅ 设置迁移完成: ${migratedCount} 个设置`)

        } catch (error) {
            console.error('❌ 设置迁移失败:', error)
            this.status.errors.push(`设置迁移失败: ${(error as Error).message}`)
        }
    }

    /**
     * 验证迁移数据
     */
    private async validateMigratedData(): Promise<void> {
        try {
            // 验证书签数据
            const dbInfo = await this.db.getDatabaseInfo()
            if (dbInfo.bookmarkCount === 0) {
                throw new Error('迁移后书签数据为空')
            }

            // 验证全局统计
            const globalStats = await this.db.getGlobalStats()
            if (!globalStats) {
                throw new Error('缺少全局统计信息')
            }

            console.log('✅ 数据验证通过')
            console.log(`📊 验证结果: ${dbInfo.bookmarkCount} 个书签项目`)

        } catch (error) {
            console.error('❌ 数据验证失败:', error)
            throw new Error(`数据验证失败: ${(error as Error).message}`)
        }
    }

    /**
     * 清理旧数据
     */
    private async cleanupOldData(): Promise<void> {
        try {
            // 注意：迁移功能已禁用，跳过旧数据清理
            console.log('✅ 数据清理已跳过（IndexedDB架构已完全迁移）')
        } catch (error) {
            console.warn('清理旧数据时出现警告:', error)
            this.status.errors.push(`清理旧数据失败: ${(error as Error).message}`)
        }
    }

    /**
    }

    /**
     * 检查IndexedDB是否为空
     */
    private async isIndexedDBEmpty(): Promise<boolean> {
        try {
            const globalStats = await this.db.getGlobalStats()
            return !globalStats || globalStats.totalBookmarks === 0
        } catch (error) {
            // 如果获取统计信息失败，假设数据库为空
            return true
        }
    }

    /**
     * 获取Chrome Storage数据
     */
    private async getChromeStorageData(_keys: string[]): Promise<Record<string, any>> {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            return {}
        }

        try {
            // 注意：迁移功能已禁用，返回空对象
            // const result = await chrome.storage.local.get(keys)
            return {} // result
        } catch (error) {
            console.warn('获取Chrome Storage数据失败:', error)
            return {}
        }
    }

    /**
     * 更新进度
     */
    private async updateProgress(
        step: string,
        progress: number,
        onProgress?: (status: MigrationStatus) => void
    ): Promise<void> {
        this.status.currentStep = step
        this.status.progress = progress

        console.log(`📊 迁移进度: ${progress}% - ${step}`)

        if (onProgress) {
            onProgress({ ...this.status })
        }

        await this.saveMigrationStatus()
    }

    /**
     * 保存迁移状态
     */
    private async saveMigrationStatus(): Promise<void> {
        try {
            await this.db.saveSetting(MigrationManager.MIGRATION_KEY, this.status)
        } catch (error) {
            console.warn('保存迁移状态失败:', error)
        }
    }

    /**
     * 获取迁移状态
     */
    async getMigrationStatus(): Promise<MigrationStatus | null> {
        try {
            const status = await this.db.getSetting<MigrationStatus>(MigrationManager.MIGRATION_KEY)
            return status
        } catch (error) {
            console.warn('获取迁移状态失败:', error)
            return null
        }
    }

    /**
     * 重置迁移状态（用于重新迁移）
     */
    async resetMigrationStatus(): Promise<void> {
        try {
            await this.db.deleteSetting(MigrationManager.MIGRATION_KEY)
            console.log('✅ 迁移状态已重置')
        } catch (error) {
            console.warn('重置迁移状态失败:', error)
        }
    }

    /**
     * 获取迁移报告
     */
    generateMigrationReport(): string {
        const duration = this.status.endTime ?
            this.status.endTime - this.status.startTime :
            Date.now() - this.status.startTime

        return `
# AcuityBookmarks IndexedDB架构迁移报告

## 迁移概览
- 状态: ${this.status.isCompleted ? '✅ 完成' : this.status.isInProgress ? '🔄 进行中' : '❌ 失败'}
- 总耗时: ${duration}ms
- 最后步骤: ${this.status.currentStep}
- 进度: ${this.status.progress}%

## 迁移数据统计
- 书签项目: ${this.status.migratedData.bookmarks}
- 搜索历史: ${this.status.migratedData.searchHistory}
- 应用设置: ${this.status.migratedData.settings}

## 错误信息
${this.status.errors.length === 0 ? '无错误' : this.status.errors.map(error => `- ${error}`).join('\\n')}

## 迁移时间
- 开始时间: ${new Date(this.status.startTime).toLocaleString()}
- 结束时间: ${this.status.endTime ? new Date(this.status.endTime).toLocaleString() : '未完成'}
        `.trim()
    }
}
