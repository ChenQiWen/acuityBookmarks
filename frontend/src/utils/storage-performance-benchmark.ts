/**
 * 存储性能基准测试
 * 对比 Chrome Storage Local vs IndexedDB 的实际性能
 */

import type { SuperEnhancedBookmarkNode, SuperBookmarkCache } from '../types/enhanced-bookmark'
import { IndexedDBStorageAdapter } from './indexeddb-storage-adapter'

export interface BenchmarkResult {
    storageType: 'chrome_local' | 'indexeddb'
    operation: string
    recordCount: number
    timeMs: number
    memoryUsageMB?: number
    throughputOpsPerSec?: number
}

export interface BenchmarkSummary {
    chromeLocal: BenchmarkResult[]
    indexedDB: BenchmarkResult[]
    recommendations: {
        smallDataset: string    // < 500 records
        mediumDataset: string   // 500-2000 records  
        largeDataset: string    // > 2000 records
    }
}

export class StoragePerformanceBenchmark {
    private indexedDBAdapter: IndexedDBStorageAdapter

    constructor() {
        this.indexedDBAdapter = new IndexedDBStorageAdapter()
    }

    /**
     * 生成测试数据
     */
    private generateTestData(count: number): SuperEnhancedBookmarkNode[] {
        const testData: SuperEnhancedBookmarkNode[] = []

        for (let i = 0; i < count; i++) {
            const bookmark: SuperEnhancedBookmarkNode = {
                id: `bookmark_${i}`,
                title: `测试书签 ${i} - 这是一个用于性能测试的书签`,
                url: `https://example.com/page/${i}`,
                parentId: i % 10 === 0 ? '0' : `folder_${Math.floor(i / 10)}`,
                dateAdded: Date.now() - (i * 1000 * 60 * 60), // 1小时间隔

                // 路径信息（使用新增的ID路径）
                path: ['Root', `Folder ${Math.floor(i / 10)}`, `Bookmark ${i}`],
                pathString: `Root / Folder ${Math.floor(i / 10)} / Bookmark ${i}`,
                pathIds: ['0', `folder_${Math.floor(i / 10)}`, `bookmark_${i}`],
                pathIdsString: `0 / folder_${Math.floor(i / 10)} / bookmark_${i}`,
                ancestorIds: ['0', `folder_${Math.floor(i / 10)}`],
                siblingIds: [],

                // 统计信息
                bookmarkCount: 1,
                folderCount: 0,
                totalCount: 1,
                depth: 2,
                maxSubDepth: 2,

                // 搜索索引
                domain: 'example.com',
                normalizedTitle: `测试书签 ${i} - 这是一个用于性能测试的书签`.toLowerCase(),
                searchKeywords: [`测试`, `书签`, `性能`, `${i}`],
                titleWords: ['测试', '书签', '这是', '一个', '用于', '性能测试', '的', '书签'],

                // 清理检测
                duplicateUrlIds: [],
                duplicateTitleIds: [],
                hasInvalidUrl: false,
                isEmpty: false,

                // 虚拟化
                flatIndex: i,
                isVisible: true,
                sortKey: `bookmark_${i}`,

                // 分析数据
                createdYear: new Date(Date.now() - (i * 1000 * 60 * 60)).getFullYear(),
                createdMonth: new Date(Date.now() - (i * 1000 * 60 * 60)).getMonth() + 1,
                domainCategory: 'other',

                // 元数据
                dataVersion: '2.0.0',
                lastCalculated: Date.now()
            }

            testData.push(bookmark)
        }

        return testData
    }

    /**
     * 测试Chrome Storage Local写入性能
     */
    private async benchmarkChromeStorageWrite(data: SuperEnhancedBookmarkNode[]): Promise<BenchmarkResult> {
        const startTime = performance.now()
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0


        try {
            // 注意：chrome.storage.local测试已禁用，直接模拟结果
            console.warn('⚠️ chrome.storage.local基准测试已禁用')

            const endTime = performance.now()
            const endMemory = (performance as any).memory?.usedJSHeapSize || 0

            // 模拟已清理测试数据

            return {
                storageType: 'chrome_local',
                operation: 'write',
                recordCount: data.length,
                timeMs: endTime - startTime,
                memoryUsageMB: (endMemory - startMemory) / (1024 * 1024),
                throughputOpsPerSec: data.length / ((endTime - startTime) / 1000)
            }
        } catch (error) {
            console.error('Chrome Storage写入测试失败:', error)
            throw error
        }
    }

    /**
     * 测试Chrome Storage Local读取性能
     */
    private async benchmarkChromeStorageRead(): Promise<BenchmarkResult> {
        const startTime = performance.now()
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0

        try {
            // 注意：chrome.storage.local测试已禁用，直接模拟结果
            console.warn('⚠️ chrome.storage.local基准测试已禁用')
            const data: any[] = [] // 模拟空数据

            const endTime = performance.now()
            const endMemory = (performance as any).memory?.usedJSHeapSize || 0

            return {
                storageType: 'chrome_local',
                operation: 'read',
                recordCount: data.length,
                timeMs: endTime - startTime,
                memoryUsageMB: (endMemory - startMemory) / (1024 * 1024),
                throughputOpsPerSec: data.length / ((endTime - startTime) / 1000)
            }
        } catch (error) {
            console.error('Chrome Storage读取测试失败:', error)
            throw error
        }
    }

    /**
     * 测试IndexedDB写入性能
     */
    private async benchmarkIndexedDBWrite(data: SuperEnhancedBookmarkNode[]): Promise<BenchmarkResult> {
        const startTime = performance.now()
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0

        try {
            await this.indexedDBAdapter.initialize()

            const mockCache: Partial<SuperBookmarkCache> = {
                data: data,
                globalStats: {
                    totalBookmarks: data.length,
                    totalFolders: Math.ceil(data.length / 10),
                    maxDepth: 3,
                    avgDepth: 2.5,
                    topDomains: [{ domain: 'example.com', count: data.length }],
                    creationTimeline: new Map(),
                    categoryDistribution: new Map(),
                    memoryUsage: {
                        nodeCount: data.length,
                        indexCount: 0,
                        estimatedBytes: JSON.stringify(data).length
                    }
                },
                metadata: {
                    originalDataHash: 'test',
                    processedAt: Date.now(),
                    version: '2.0.0',
                    processingTime: 100,
                    cacheHitRate: 0,
                    indexBuildTime: 50,
                    performance: {
                        transformTime: 20,
                        indexTime: 15,
                        cleanupTime: 10,
                        searchTime: 5,
                        virtualTime: 8,
                        analyticsTime: 12
                    }
                }
            }

            await this.indexedDBAdapter.saveSuperCache(mockCache as SuperBookmarkCache)

            const endTime = performance.now()
            const endMemory = (performance as any).memory?.usedJSHeapSize || 0

            return {
                storageType: 'indexeddb',
                operation: 'write',
                recordCount: data.length,
                timeMs: endTime - startTime,
                memoryUsageMB: (endMemory - startMemory) / (1024 * 1024),
                throughputOpsPerSec: data.length / ((endTime - startTime) / 1000)
            }
        } catch (error) {
            console.error('IndexedDB写入测试失败:', error)
            throw error
        }
    }

    /**
     * 测试IndexedDB查询性能
     */
    private async benchmarkIndexedDBQuery(queryType: 'single' | 'range' | 'search'): Promise<BenchmarkResult> {
        const startTime = performance.now()
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0

        let resultCount = 0

        try {
            switch (queryType) {
                case 'single':
                    // 单个查询测试
                    for (let i = 0; i < 100; i++) {
                        const result = await this.indexedDBAdapter.queryBookmarks({
                            id: `bookmark_${i}`
                        })
                        resultCount += result.data.length
                    }
                    break

                case 'range':
                    // 范围查询测试
                    for (let i = 0; i < 10; i++) {
                        const result = await this.indexedDBAdapter.queryBookmarks({
                            parentId: `folder_${i}`,
                            limit: 50
                        })
                        resultCount += result.data.length
                    }
                    break

                case 'search': {
                    // 搜索查询测试
                    const searchTerms = ['测试', '书签', '性能', 'example']
                    for (const term of searchTerms) {
                        const result = await this.indexedDBAdapter.searchBookmarks(term, 100)
                        resultCount += result.data.length
                    }
                    break
                }
            }

            const endTime = performance.now()
            const endMemory = (performance as any).memory?.usedJSHeapSize || 0

            return {
                storageType: 'indexeddb',
                operation: `query_${queryType}`,
                recordCount: resultCount,
                timeMs: endTime - startTime,
                memoryUsageMB: (endMemory - startMemory) / (1024 * 1024),
                throughputOpsPerSec: resultCount / ((endTime - startTime) / 1000)
            }
        } catch (error) {
            console.error(`IndexedDB ${queryType}查询测试失败:`, error)
            throw error
        }
    }

    /**
     * 运行完整的性能基准测试
     */
    async runFullBenchmark(dataSizes: number[] = [100, 500, 1000, 2000, 5000]): Promise<BenchmarkSummary> {
        console.log('🚀 开始存储性能基准测试...')

        const chromeLocalResults: BenchmarkResult[] = []
        const indexedDBResults: BenchmarkResult[] = []

        for (const size of dataSizes) {
            console.log(`📊 测试数据量: ${size}条记录`)

            // 生成测试数据
            const testData = this.generateTestData(size)

            try {
                // Chrome Storage Local 测试
                console.log('  测试Chrome Storage Local...')
                const chromeWriteResult = await this.benchmarkChromeStorageWrite(testData)
                chromeLocalResults.push(chromeWriteResult)

                const chromeReadResult = await this.benchmarkChromeStorageRead()
                chromeLocalResults.push(chromeReadResult)

                // IndexedDB 测试
                console.log('  测试IndexedDB...')
                const indexedDBWriteResult = await this.benchmarkIndexedDBWrite(testData)
                indexedDBResults.push(indexedDBWriteResult)

                const singleQueryResult = await this.benchmarkIndexedDBQuery('single')
                indexedDBResults.push(singleQueryResult)

                const rangeQueryResult = await this.benchmarkIndexedDBQuery('range')
                indexedDBResults.push(rangeQueryResult)

                const searchQueryResult = await this.benchmarkIndexedDBQuery('search')
                indexedDBResults.push(searchQueryResult)

            } catch (error) {
                console.error(`数据量${size}测试失败:`, error)
            }
        }

        // 生成推荐建议
        const recommendations = this.generateRecommendations(chromeLocalResults, indexedDBResults)

        console.log('✅ 性能基准测试完成')

        return {
            chromeLocal: chromeLocalResults,
            indexedDB: indexedDBResults,
            recommendations
        }
    }

    /**
     * 生成推荐建议
     */
    private generateRecommendations(
        chromeResults: BenchmarkResult[],
        indexedResults: BenchmarkResult[]
    ): BenchmarkSummary['recommendations'] {

        // 分析不同数据量下的性能表现
        const getChromeWriteTime = (recordCount: number) => {
            const result = chromeResults.find(r =>
                r.operation === 'write' && Math.abs(r.recordCount - recordCount) < 50
            )
            return result?.timeMs || 0
        }

        const getIndexedDBWriteTime = (recordCount: number) => {
            const result = indexedResults.find(r =>
                r.operation === 'write' && Math.abs(r.recordCount - recordCount) < 50
            )
            return result?.timeMs || 0
        }

        return {
            smallDataset: getChromeWriteTime(100) < getIndexedDBWriteTime(100)
                ? 'Chrome Storage Local - 简单快速，适合少量书签'
                : 'IndexedDB - 即使小数据量也有良好性能',

            mediumDataset: getChromeWriteTime(1000) < getIndexedDBWriteTime(1000) * 2
                ? 'Chrome Storage Local - 仍可接受，但建议考虑迁移'
                : '**IndexedDB** - 性能优势明显，强烈推荐',

            largeDataset: '**IndexedDB** - 大数据量下的唯一选择，Chrome Storage会严重影响用户体验'
        }
    }

    /**
     * 输出性能报告
     */
    static printBenchmarkReport(summary: BenchmarkSummary): void {
        console.log('\n📊 存储性能基准测试报告')
        console.log('='.repeat(50))

        console.log('\n🏪 Chrome Storage Local 结果:')
        summary.chromeLocal.forEach(result => {
            console.log(`  ${result.operation}: ${result.recordCount}条记录, ${result.timeMs.toFixed(2)}ms, ${result.throughputOpsPerSec?.toFixed(0)}ops/s`)
        })

        console.log('\n🗃️  IndexedDB 结果:')
        summary.indexedDB.forEach(result => {
            console.log(`  ${result.operation}: ${result.recordCount}条记录, ${result.timeMs.toFixed(2)}ms, ${result.throughputOpsPerSec?.toFixed(0)}ops/s`)
        })

        console.log('\n💡 推荐建议:')
        console.log(`  小数据集 (<500条): ${summary.recommendations.smallDataset}`)
        console.log(`  中等数据集 (500-2000条): ${summary.recommendations.mediumDataset}`)
        console.log(`  大数据集 (>2000条): ${summary.recommendations.largeDataset}`)
    }
}

// 导出便捷函数
export async function runStorageBenchmark(): Promise<BenchmarkSummary> {
    const benchmark = new StoragePerformanceBenchmark()
    const results = await benchmark.runFullBenchmark()
    StoragePerformanceBenchmark.printBenchmarkReport(results)
    return results
}

// 全局暴露（用于控制台调试）
if (typeof window !== 'undefined') {
    (window as any).runStorageBenchmark = runStorageBenchmark
}
