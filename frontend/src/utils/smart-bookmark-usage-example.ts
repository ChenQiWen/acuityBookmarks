/**
 * 🚀 智能书签差异引擎 - 使用示例
 * 
 * 演示如何使用智能书签变更系统来处理复杂的书签操作
 */

import { smartBookmarkManager } from './smart-bookmark-manager'
import type { BookmarkNode } from './smart-bookmark-diff-engine'
import { smartBookmarkDiffEngine } from './smart-bookmark-diff-engine'
// 在开发环境下使用logger，生产环境下注释掉未使用的导入
// import { logger } from './logger'

// 模拟书签数据
const createMockBookmarkTree = (): BookmarkNode[] => [
  {
    id: '1',
    title: '书签栏',
    children: [
      {
        id: '10',
        title: '开发工具',
        children: [
          { id: '101', title: 'GitHub', url: 'https://github.com' },
          { id: '102', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
          { id: '103', title: 'MDN', url: 'https://developer.mozilla.org' }
        ]
      },
      {
        id: '20',
        title: '社交媒体',
        children: [
          { id: '201', title: 'Twitter', url: 'https://twitter.com' },
          { id: '202', title: 'LinkedIn', url: 'https://linkedin.com' }
        ]
      },
      { id: '30', title: '搜索引擎', url: 'https://google.com' }
    ]
  }
]

/**
 * 示例1：分析书签差异
 */
export async function exampleAnalyzeDifferences() {
  console.log('\n🔍 === 示例1：分析书签差异 ===')
  
  const originalTree = createMockBookmarkTree()
  
  // 创建一个修改后的版本
  const targetTree = createMockBookmarkTree()
  // 重命名一个文件夹
  targetTree[0].children![0].title = '前端开发工具'
  // 添加一个新书签
  targetTree[0].children![0].children!.push({
    id: '104',
    title: 'Vue.js',
    url: 'https://vuejs.org'
  })
  // 重新排序
  const socialMedia = targetTree[0].children![1]
  const devTools = targetTree[0].children![0]
  targetTree[0].children![0] = socialMedia
  targetTree[0].children![1] = devTools
  
  try {
    const diffResult = await smartBookmarkDiffEngine.computeDiff(originalTree, targetTree)
    
    console.log('📊 差异分析结果:')
    console.log(`- 总操作数: ${diffResult.operations.length}`)
    console.log(`- 复杂度: ${diffResult.stats.complexity}`)
    console.log(`- 预估时间: ${diffResult.stats.estimatedTime}ms`)
    console.log(`- API调用次数: ${diffResult.stats.apiCalls}`)
    console.log(`- 策略建议: ${diffResult.strategy.type} - ${diffResult.strategy.reason}`)
    
    console.log('\n📝 操作详情:')
    diffResult.operations.forEach(op => {
      console.log(`  ${op.type}: ${op.target?.title || op.nodeId} (cost: ${op.estimatedCost}ms)`)
    })
    
  } catch (error) {
    console.error('❌ 差异分析失败:', error)
  }
}

/**
 * 示例2：完整的书签变更应用
 */
export async function exampleApplyChanges() {
  console.log('\n🚀 === 示例2：完整的书签变更应用 ===')
  
  const originalTree = createMockBookmarkTree()
  const targetTree = createMockBookmarkTree()
  
  // 模拟复杂变更：AI重新组织书签
  targetTree[0].children = [
    {
      id: '40',
      title: 'AI工具',
      children: [
        { id: '401', title: 'ChatGPT', url: 'https://chat.openai.com' },
        { id: '402', title: 'Claude', url: 'https://claude.ai' }
      ]
    },
    {
      id: '10', // 保留现有ID
      title: '开发资源', // 重命名
      children: [
        { id: '101', title: 'GitHub', url: 'https://github.com' },
        { id: '103', title: 'MDN', url: 'https://developer.mozilla.org' },
        // 删除了Stack Overflow (102)
        { id: '105', title: 'Vue DevTools', url: 'https://devtools.vuejs.org' } // 新增
      ]
    }
  ]
  
  try {
    const result = await smartBookmarkManager.applyChanges(
      originalTree,
      targetTree,
      {
        enableProgressFeedback: true,
        enablePerformanceLogging: true,
        onProgress: (progress) => {
          console.log(`📊 进度: ${progress.completed}/${progress.total} - ${progress.currentOperation}`)
          console.log(`   剩余时间: ${progress.estimatedTimeRemaining.toFixed(0)}ms`)
        },
        onAnalysisComplete: (diffResult) => {
          console.log(`🧠 分析完成: 发现 ${diffResult.operations.length} 个操作`)
          console.log(`   复杂度: ${diffResult.stats.complexity}`)
          console.log(`   策略: ${diffResult.strategy.type}`)
        },
        onExecutionComplete: (execResult) => {
          console.log(`⚡ 执行完成: ${execResult.executedOperations} 成功, ${execResult.failedOperations} 失败`)
          console.log(`   性能提升: ${execResult.performance.effectiveSpeedup.toFixed(1)}x`)
        }
      }
    )
    
    console.log('\n✅ 变更应用结果:')
    console.log(`- 成功: ${result.success}`)
    console.log(`- 总耗时: ${result.totalTime.toFixed(2)}ms`)
    console.log(`- 性能提升: ${result.execution.performance.effectiveSpeedup.toFixed(1)}x`)
    console.log('- 建议:', result.recommendations.join(', '))
    
  } catch (error) {
    console.error('❌ 变更应用失败:', error)
  }
}

/**
 * 示例3：获取变更预览
 */
export async function exampleGetChangePreview() {
  console.log('\n👁️ === 示例3：获取变更预览 ===')
  
  const originalTree = createMockBookmarkTree()
  const targetTree = createMockBookmarkTree()
  
  // 进行一些修改
  targetTree[0].children![0].title = '开发工具箱' // 重命名
  targetTree[0].children!.push({ // 新增文件夹
    id: '50',
    title: '学习资源',
    children: [
      { id: '501', title: '慕课网', url: 'https://imooc.com' }
    ]
  })
  
  try {
    const preview = await smartBookmarkManager.getChangePreview(originalTree, targetTree)
    
    console.log('👀 变更预览:')
    console.log(`- 摘要: ${preview.summary}`)
    console.log(`- 复杂度: ${preview.complexity}`)
    console.log(`- 预估时间: ${preview.totalEstimatedTime}ms`)
    console.log(`- 建议: ${preview.recommendation}`)
    
    console.log('\n📋 详细操作:')
    preview.details.forEach((detail, index) => {
      console.log(`  ${index + 1}. ${detail.type}: ${detail.description} (${detail.estimatedTime}ms)`)
    })
    
  } catch (error) {
    console.error('❌ 预览获取失败:', error)
  }
}

/**
 * 示例4：验证变更安全性
 */
export async function exampleValidateChanges() {
  console.log('\n🛡️ === 示例4：验证变更安全性 ===')
  
  const originalTree = createMockBookmarkTree()
  const targetTree = createMockBookmarkTree()
  
  // 创建一个风险性变更：删除大量书签
  targetTree[0].children = [
    { id: '10', title: '开发工具', children: [] } // 清空子项
  ]
  
  try {
    const validation = smartBookmarkManager.validateChanges(originalTree, targetTree)
    
    console.log('🔍 变更安全性验证:')
    console.log(`- 是否安全: ${validation.isValid ? '✅ 安全' : '❌ 存在风险'}`)
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  警告:')
      validation.warnings.forEach(warning => console.log(`  - ${warning}`))
    }
    
    if (validation.risks.length > 0) {
      console.log('🚨 风险:')
      validation.risks.forEach(risk => console.log(`  - ${risk}`))
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error)
  }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('🎬 开始运行智能书签引擎示例')
  
  await exampleAnalyzeDifferences()
  await exampleGetChangePreview()
  await exampleValidateChanges()
  
  // 注意：exampleApplyChanges 会实际调用Chrome API，需要在真实环境中运行
  console.log('\n💡 提示: exampleApplyChanges() 需要在真实的浏览器扩展环境中运行')
  
  console.log('🎉 所有示例运行完成')
}

// 开发环境下自动运行示例
if (import.meta.env.DEV) {
  console.log('\n🧪 === 智能书签差异引擎 - 使用示例 ===')
  console.log('在浏览器控制台中运行以下命令来查看示例:')
  console.log('- window.__SMART_BOOKMARK_EXAMPLES__.runAllExamples()')
  console.log('- window.__SMART_BOOKMARK_EXAMPLES__.exampleAnalyzeDifferences()')
  console.log('- window.__SMART_BOOKMARK_EXAMPLES__.exampleApplyChanges()')
  
  // 导出到全局对象以便在控制台调用
  ;(window as any).__SMART_BOOKMARK_EXAMPLES__ = {
    runAllExamples,
    exampleAnalyzeDifferences,
    exampleApplyChanges,
    exampleGetChangePreview,
    exampleValidateChanges
  }
}

// 函数已通过 export async function 语法导出，无需重复导出
