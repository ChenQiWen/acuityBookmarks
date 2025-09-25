/**
 * 统一书签搜索服务使用示例
 * 
 * 这个文件展示了如何在不同场景下使用BookmarkSearchService
 * 可以作为开发参考或者测试用例
 */

import { bookmarkSearchService, type LocalSearchOptions } from './bookmark-search-service'
import { searchPopupAPI, popupAPI, sidePanelAPI } from '../utils/unified-bookmark-api'

/**
 * 示例1: 基础搜索功能
 */
export async function basicSearchExample() {
    console.log('🔍 === 基础搜索示例 ===')

    try {
        // 简单搜索
        const { results, stats } = await bookmarkSearchService.search('vue')

        console.log(`搜索关键词: ${stats.query}`)
        console.log(`搜索耗时: ${stats.duration}ms`)
        console.log(`找到结果: ${stats.totalResults}条`)
        console.log(`返回结果: ${stats.returnedResults}条`)

        // 显示前3个结果
        results.slice(0, 3).forEach((result, index) => {
            console.log(`${index + 1}. ${result.title} (分数: ${result.score})`)
            console.log(`   ${result.url}`)
            console.log(`   匹配字段: ${result.matchedFields.join(', ')}`)
        })

    } catch (error) {
        console.error('搜索失败:', error)
    }
}

/**
 * 示例2: 高级搜索选项
 */
export async function advancedSearchExample() {
    console.log('🎯 === 高级搜索示例 ===')

    const searchOptions: LocalSearchOptions = {
        mode: 'accurate',
        fields: ['title', 'url', 'keywords', 'tags'],
        limit: 10,
        minScore: 20,
        enableHighlight: true,
        sortBy: 'relevance'
    }

    try {
        const { results, stats } = await bookmarkSearchService.search('javascript', searchOptions)

        console.log(`高级搜索结果: ${results.length}条`)
        console.log(`平均分数: ${stats.avgScore}`)
        console.log(`最高分数: ${stats.maxScore}`)

        // 显示高亮信息
        results.forEach(result => {
            if (result.highlights) {
                console.log(`${result.title} - 高亮:`, result.highlights)
            }
        })

    } catch (error) {
        console.error('高级搜索失败:', error)
    }
}

/**
 * 示例3: 不同搜索模式对比
 */
export async function searchModeComparison() {
    console.log('⚡ === 搜索模式对比 ===')

    const query = 'react'
    const modes: Array<'fast' | 'accurate' | 'memory'> = ['fast', 'accurate', 'memory']

    for (const mode of modes) {
        try {
            const startTime = performance.now()
            const { results, stats } = await bookmarkSearchService.search(query, { mode, limit: 20 })
            const endTime = performance.now()

            console.log(`${mode.toUpperCase()} 模式:`)
            console.log(`  结果数量: ${results.length}`)
            console.log(`  搜索耗时: ${stats.duration}ms`)
            console.log(`  总耗时: ${(endTime - startTime).toFixed(2)}ms`)
            console.log('---')

        } catch (error) {
            console.error(`${mode}模式搜索失败:`, error)
        }
    }
}

/**
 * 示例4: 各页面API使用
 */
export async function pageAPIExample() {
    console.log('📱 === 页面API示例 ===')

    const query = 'typescript'

    try {
        // 搜索页面API - 精确搜索
        console.log('SearchPopup API (精确搜索):')
        const searchResults = await searchPopupAPI.searchBookmarks(query)
        console.log(`  结果数量: ${Array.isArray(searchResults) ? searchResults.length : 'N/A'}`)

        // 弹窗API - 快速搜索
        console.log('Popup API (快速搜索):')
        const popupResults = await popupAPI.searchBookmarks(query)
        console.log(`  结果数量: ${popupResults.length}`)

        // 侧边栏API - 内存搜索
        console.log('SidePanel API (内存搜索):')
        const sideResults = await sidePanelAPI.searchBookmarks(query)
        console.log(`  结果数量: ${sideResults.length}`)

    } catch (error) {
        console.error('页面API测试失败:', error)
    }
}

/**
 * 示例5: 搜索结果处理
 */
export async function resultProcessingExample() {
    console.log('🛠️ === 搜索结果处理示例 ===')

    try {
        const { results } = await bookmarkSearchService.search('github', {
            enableHighlight: true,
            fields: ['title', 'url', 'domain']
        })

        // 按域名分组
        const groupedResults = results.reduce((groups, result) => {
            const domain = result.domain || 'unknown'
            if (!groups[domain]) groups[domain] = []
            groups[domain].push(result)
            return groups
        }, {} as Record<string, typeof results>)

        console.log('按域名分组的结果:')
        Object.entries(groupedResults).forEach(([domain, bookmarks]) => {
            console.log(`${domain}: ${bookmarks.length}个书签`)
        })

        // 高分结果过滤
        const highScoreResults = results.filter(r => r.score > 50)
        console.log(`高分结果 (>50): ${highScoreResults.length}个`)

        // 最近添加的结果
        const recentResults = results
            .filter(r => r.dateAdded)
            .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
            .slice(0, 5)

        console.log('最近添加的5个结果:')
        recentResults.forEach(r => {
            const date = new Date(r.dateAdded || 0).toLocaleDateString()
            console.log(`  ${r.title} (${date})`)
        })

    } catch (error) {
        console.error('结果处理示例失败:', error)
    }
}

/**
 * 示例6: 缓存管理
 */
export async function cacheManagementExample() {
    console.log('💾 === 缓存管理示例 ===')

    try {
        // 执行一些搜索来填充缓存
        await bookmarkSearchService.search('vue')
        await bookmarkSearchService.search('react')
        await bookmarkSearchService.search('angular')

        // 检查缓存状态
        const cacheStats = bookmarkSearchService.getCacheStats()
        console.log('缓存统计:')
        console.log(`  缓存项数量: ${cacheStats.size}/${cacheStats.maxSize}`)
        console.log(`  命中率: ${cacheStats.hitRate}%`)

        // 测试缓存命中
        console.log('测试缓存命中...')
        const startTime = performance.now()
        await bookmarkSearchService.search('vue') // 应该命中缓存
        const endTime = performance.now()

        console.log(`缓存命中搜索耗时: ${(endTime - startTime).toFixed(2)}ms`)

        // 清理缓存
        bookmarkSearchService.clearCache()
        console.log('缓存已清理')

        const newCacheStats = bookmarkSearchService.getCacheStats()
        console.log(`清理后缓存大小: ${newCacheStats.size}`)

    } catch (error) {
        console.error('缓存管理示例失败:', error)
    }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
    console.log('🚀 开始运行所有搜索服务示例...\n')

    const examples = [
        { name: '基础搜索', fn: basicSearchExample },
        { name: '高级搜索', fn: advancedSearchExample },
        { name: '搜索模式对比', fn: searchModeComparison },
        { name: '页面API使用', fn: pageAPIExample },
        { name: '结果处理', fn: resultProcessingExample },
        { name: '缓存管理', fn: cacheManagementExample }
    ]

    for (const example of examples) {
        try {
            console.log(`\n--- ${example.name} ---`)
            await example.fn()
            console.log(`✅ ${example.name} 完成`)
        } catch (error) {
            console.error(`❌ ${example.name} 失败:`, error)
        }
    }

    console.log('\n🎉 所有示例运行完成!')
}

// 导出便捷函数
export const searchExamples = {
    basic: basicSearchExample,
    advanced: advancedSearchExample,
    modeComparison: searchModeComparison,
    pageAPI: pageAPIExample,
    resultProcessing: resultProcessingExample,
    cacheManagement: cacheManagementExample,
    runAll: runAllExamples
}

// 在开发环境中可以通过控制台调用
if (typeof window !== 'undefined') {
    (window as any).searchExamples = searchExamples
    console.log('💡 搜索示例已加载，可通过 window.searchExamples 访问')
}
