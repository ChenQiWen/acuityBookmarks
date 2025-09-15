/**
 * 应用初始化器
 * 处理IndexedDB架构迁移和应用启动逻辑
 */

import { MigrationManager, type MigrationStatus } from './migration-manager'
import { IndexedDBBookmarkManager } from './indexeddb-bookmark-manager'

export interface InitializationResult {
    success: boolean
    migrationRequired: boolean
    migrationResult?: MigrationStatus
    error?: string
    initTime: number
}

export interface InitializationOptions {
    autoMigrate?: boolean
    showMigrationUI?: boolean
    onMigrationProgress?: (status: MigrationStatus) => void
    onInitProgress?: (step: string, progress: number) => void
}

/**
 * 应用初始化器
 * 统一管理应用启动、迁移、数据初始化
 */
export class AppInitializer {
    private migrationManager: MigrationManager
    private bookmarkManager: IndexedDBBookmarkManager

    constructor() {
        this.migrationManager = new MigrationManager()
        this.bookmarkManager = IndexedDBBookmarkManager.getInstance()
    }

    /**
     * 完整的应用初始化流程
     */
    async initialize(options: InitializationOptions = {}): Promise<InitializationResult> {
        const startTime = performance.now()

        const opts: Required<InitializationOptions> = {
            autoMigrate: true,
            showMigrationUI: false,
            onMigrationProgress: () => { },
            onInitProgress: () => { },
            ...options
        }

        console.log('🚀 开始应用初始化...')

        try {
            let migrationResult: MigrationStatus | undefined

            // 第1步：检查迁移需求
            opts.onInitProgress('检查迁移需求', 20)
            const needsMigration = await this.migrationManager.needsMigration()

            if (needsMigration) {
                console.log('📊 检测到需要执行架构迁移')

                if (opts.autoMigrate) {
                    // 第2步：执行迁移
                    opts.onInitProgress('执行架构迁移', 30)
                    migrationResult = await this.migrationManager.performMigration(
                        {
                            preserveOldData: true,
                            performValidation: true,
                            cleanupAfterMigration: true
                        },
                        opts.onMigrationProgress
                    )

                    if (!migrationResult.isCompleted) {
                        throw new Error('架构迁移未完成')
                    }
                } else {
                    return {
                        success: false,
                        migrationRequired: true,
                        error: '需要执行架构迁移，但自动迁移已禁用',
                        initTime: performance.now() - startTime
                    }
                }
            }

            // 第3步：初始化IndexedDB书签管理器
            opts.onInitProgress('初始化数据管理器', 60)
            await this.bookmarkManager.initialize()

            // 第4步：验证数据完整性
            opts.onInitProgress('验证数据完整性', 80)
            await this.validateDataIntegrity()

            // 第5步：完成初始化
            opts.onInitProgress('初始化完成', 100)

            const initTime = performance.now() - startTime

            console.log(`✅ 应用初始化完成，耗时: ${initTime.toFixed(2)}ms`)

            return {
                success: true,
                migrationRequired: needsMigration,
                migrationResult,
                initTime
            }

        } catch (error) {
            console.error('❌ 应用初始化失败:', error)

            return {
                success: false,
                migrationRequired: await this.migrationManager.needsMigration(),
                error: (error as Error).message,
                initTime: performance.now() - startTime
            }
        }
    }

    /**
     * 验证数据完整性
     */
    private async validateDataIntegrity(): Promise<void> {
        try {
            const globalStats = await this.bookmarkManager.getGlobalStats()

            if (!globalStats) {
                throw new Error('缺少全局统计数据')
            }

            if (globalStats.totalBookmarks === 0 && globalStats.totalFolders === 0) {
                console.warn('⚠️ 书签数据为空，可能需要重新同步')
                // 尝试从Chrome API重新加载
                await this.bookmarkManager.loadFromChrome()
            }

            console.log('✅ 数据完整性验证通过')

        } catch (error) {
            console.error('❌ 数据完整性验证失败:', error)
            throw error
        }
    }

    /**
     * 获取迁移状态
     */
    async getMigrationStatus(): Promise<MigrationStatus | null> {
        return await this.migrationManager.getMigrationStatus()
    }

    /**
     * 强制执行迁移
     */
    async forceMigration(
        onProgress?: (status: MigrationStatus) => void
    ): Promise<MigrationStatus> {
        return await this.migrationManager.performMigration(
            {
                preserveOldData: true,
                performValidation: true,
                cleanupAfterMigration: true
            },
            onProgress
        )
    }

    /**
     * 重置应用数据
     */
    async resetApp(): Promise<void> {
        console.log('🔄 重置应用数据...')

        try {
            // 重置迁移状态
            await this.migrationManager.resetMigrationStatus()

            // 重新从Chrome API加载数据
            await this.bookmarkManager.loadFromChrome()

            console.log('✅ 应用数据重置完成')

        } catch (error) {
            console.error('❌ 重置应用数据失败:', error)
            throw error
        }
    }

    /**
     * 获取应用健康状态
     */
    async getHealthStatus(): Promise<{
        isHealthy: boolean
        indexedDB: boolean
        bookmarkManager: boolean
        dataIntegrity: boolean
        errors: string[]
    }> {
        const errors: string[] = []
        let indexedDBOK = false
        let bookmarkManagerOK = false
        let dataIntegrityOK = false

        try {
            // 检查IndexedDB
            const dbInfo = await this.bookmarkManager.getDatabaseInfo()
            indexedDBOK = dbInfo.bookmarkCount >= 0
        } catch (error) {
            errors.push(`IndexedDB检查失败: ${(error as Error).message}`)
        }

        try {
            // 检查书签管理器
            const stats = await this.bookmarkManager.getGlobalStats()
            bookmarkManagerOK = stats !== null
        } catch (error) {
            errors.push(`书签管理器检查失败: ${(error as Error).message}`)
        }

        try {
            // 检查数据完整性
            await this.validateDataIntegrity()
            dataIntegrityOK = true
        } catch (error) {
            errors.push(`数据完整性检查失败: ${(error as Error).message}`)
        }

        const isHealthy = indexedDBOK && bookmarkManagerOK && dataIntegrityOK

        return {
            isHealthy,
            indexedDB: indexedDBOK,
            bookmarkManager: bookmarkManagerOK,
            dataIntegrity: dataIntegrityOK,
            errors
        }
    }
}

/**
 * 单例初始化器
 */
let appInitializerInstance: AppInitializer | null = null

export function getAppInitializer(): AppInitializer {
    if (!appInitializerInstance) {
        appInitializerInstance = new AppInitializer()
    }
    return appInitializerInstance
}
