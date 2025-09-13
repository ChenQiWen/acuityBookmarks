/**
 * 🎯 智能书签变更管理器
 * 
 * 统一接口，集成差异分析和执行引擎
 * 提供简单的API供Management Store使用
 */

import { smartBookmarkDiffEngine, type BookmarkNode, type DiffResult } from './smart-bookmark-diff-engine';
import { smartBookmarkExecutor, type ExecutionResult, type ProgressCallback } from './smart-bookmark-executor';
import { logger } from './logger';

// 变更应用选项
export interface ApplyChangesOptions {
  enableProgressFeedback?: boolean
  maxConcurrency?: number
  enablePerformanceLogging?: boolean
  onProgress?: ProgressCallback
  onAnalysisComplete?: (diffResult: DiffResult) => void
  onExecutionComplete?: (result: ExecutionResult) => void
}

// 完整的应用结果
export interface ApplyChangesResult {
  success: boolean
  diff: DiffResult
  execution: ExecutionResult
  totalTime: number
  recommendations: string[]
}

/**
 * 智能书签变更管理器
 */
export class SmartBookmarkManager {
  
  /**
   * 主要API：应用书签变更
   */
  async applyChanges(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[],
    options: ApplyChangesOptions = {}
  ): Promise<ApplyChangesResult> {
    
    const startTime = performance.now();
    
    logger.info('SmartBookmarkManager', '🎯 开始智能书签变更处理');
    
    try {
      // 1. 差异分析阶段
      logger.info('SmartBookmarkManager', '🧠 开始差异分析...');
      const diffResult = await smartBookmarkDiffEngine.computeDiff(originalTree, targetTree);
      
      // 通知差异分析完成
      if (options.onAnalysisComplete) {
        options.onAnalysisComplete(diffResult);
      }
      
      // 2. 执行策略决策
      const shouldProceed = this.shouldProceedWithExecution(diffResult);
      
      if (!shouldProceed) {
        logger.warn('SmartBookmarkManager', '⚠️  变更过于复杂，建议手动处理');
        return {
          success: false,
          diff: diffResult,
          execution: {
            success: false,
            executedOperations: 0,
            failedOperations: diffResult.operations.length,
            totalTime: 0,
            errors: [{ operation: diffResult.operations[0], error: '操作过于复杂' }],
            performance: { apiCallsActual: 0, timePerOperation: 0, effectiveSpeedup: 0 }
          },
          totalTime: performance.now() - startTime,
          recommendations: [
            '建议分批次进行变更',
            '或者使用备份恢复功能'
          ]
        };
      }
      
      // 3. 执行阶段
      logger.info('SmartBookmarkManager', '🚀 开始执行变更...');
      const executionResult = await smartBookmarkExecutor.executeDiff(
        diffResult,
        options.onProgress
      );
      
      // 通知执行完成
      if (options.onExecutionComplete) {
        options.onExecutionComplete(executionResult);
      }
      
      const totalTime = performance.now() - startTime;
      
      // 4. 生成最终结果和建议
      const result: ApplyChangesResult = {
        success: executionResult.success,
        diff: diffResult,
        execution: executionResult,
        totalTime,
        recommendations: this.generateRecommendations(diffResult, executionResult)
      };
      
      // 5. 性能日志
      if (options.enablePerformanceLogging) {
        this.logPerformanceMetrics(result);
      }
      
      logger.info('SmartBookmarkManager', '✅ 智能变更处理完成', {
        success: result.success,
        totalTime: `${totalTime.toFixed(2)}ms`,
        speedup: `${executionResult.performance.effectiveSpeedup.toFixed(1)}x`
      });
      
      return result;
      
    } catch (error) {
      logger.error('SmartBookmarkManager', '❌ 变更处理失败', error);
      throw error;
    }
  }
  
  /**
   * 仅分析差异，不执行
   */
  async analyzeDifferences(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): Promise<DiffResult> {
    
    logger.info('SmartBookmarkManager', '🔍 仅执行差异分析');
    return await smartBookmarkDiffEngine.computeDiff(originalTree, targetTree);
  }
  
  /**
   * 获取变更预览信息
   */
  async getChangePreview(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): Promise<{
    summary: string
    details: Array<{
      type: string
      description: string
      estimatedTime: number
    }>
    totalEstimatedTime: number
    complexity: string
    recommendation: string
  }> {
    
    const diffResult = await this.analyzeDifferences(originalTree, targetTree);
    
    const details = diffResult.operations.map(op => ({
      type: op.type,
      description: this.getOperationDescription(op),
      estimatedTime: op.estimatedCost
    }));
    
    return {
      summary: `发现 ${diffResult.operations.length} 个变更操作`,
      details,
      totalEstimatedTime: diffResult.stats.estimatedTime,
      complexity: diffResult.stats.complexity,
      recommendation: diffResult.strategy.reason
    };
  }
  
  /**
   * 检查变更的安全性
   */
  validateChanges(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): {
    isValid: boolean
    warnings: string[]
    risks: string[]
  } {
    
    const warnings: string[] = [];
    const risks: string[] = [];
    
    // 简单验证逻辑
    const originalCount = this.countNodes(originalTree);
    const targetCount = this.countNodes(targetTree);
    
    if (targetCount < originalCount * 0.5) {
      risks.push(`目标结构的书签数量 (${targetCount}) 比原始结构 (${originalCount}) 少了超过50%`);
    }
    
    if (targetCount > originalCount * 2) {
      warnings.push(`目标结构的书签数量 (${targetCount}) 比原始结构 (${originalCount}) 多了超过100%`);
    }
    
    // 检查是否有重复的标题
    const targetTitles = this.extractTitles(targetTree);
    const duplicates = targetTitles.filter((title, index) => targetTitles.indexOf(title) !== index);
    
    if (duplicates.length > 0) {
      warnings.push(`发现重复的书签标题: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
    }
    
    return {
      isValid: risks.length === 0,
      warnings,
      risks
    };
  }
  
  // === 私有方法 ===
  
  /**
   * 判断是否应该继续执行
   */
  private shouldProceedWithExecution(diffResult: DiffResult): boolean {
    // 基于复杂度和风险评估
    if (diffResult.stats.complexity === 'extreme') {
      return false;
    }
    
    if (diffResult.stats.totalOperations > 500) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 生成操作建议
   */
  private generateRecommendations(
    diffResult: DiffResult,
    executionResult: ExecutionResult
  ): string[] {
    
    const recommendations: string[] = [];
    
    if (executionResult.success) {
      recommendations.push(`✅ 变更执行成功，速度提升 ${executionResult.performance.effectiveSpeedup.toFixed(1)} 倍`);
      
      if (executionResult.performance.effectiveSpeedup > 5) {
        recommendations.push('🚀 性能优化效果显著，建议启用智能变更模式');
      }
    } else {
      recommendations.push('❌ 部分变更执行失败，建议检查错误日志');
      
      if (executionResult.failedOperations > 0) {
        recommendations.push(`🔧 有 ${executionResult.failedOperations} 个操作失败，可能需要手动处理`);
      }
    }
    
    // 基于复杂度的建议
    switch (diffResult.stats.complexity) {
      case 'low':
        recommendations.push('👍 变更复杂度较低，可以放心执行');
        break;
      case 'medium':
        recommendations.push('⚠️  变更复杂度中等，建议在空闲时执行');
        break;  
      case 'high':
        recommendations.push('🚨 变更复杂度较高，建议先备份书签');
        break;
      case 'extreme':
        recommendations.push('💥 变更复杂度极高，强烈建议分批执行');
        break;
    }
    
    return recommendations;
  }
  
  /**
   * 性能日志输出
   */
  private logPerformanceMetrics(result: ApplyChangesResult): void {
    
    const metrics = {
      'Total Time': `${result.totalTime.toFixed(2)}ms`,
      'Operations': `${result.execution.executedOperations}/${result.diff.operations.length}`,
      'API Calls': `${result.execution.performance.apiCallsActual}/${result.diff.stats.apiCalls}`,
      'Speed Up': `${result.execution.performance.effectiveSpeedup.toFixed(1)}x`,
      'Complexity': result.diff.stats.complexity,
      'Strategy': result.diff.strategy.type
    };
    
    console.table(metrics);
    
    logger.info('SmartBookmarkManager', '📊 性能指标', metrics);
  }
  
  /**
   * 获取操作描述
   */
  private getOperationDescription(operation: any): string {
    switch (operation.type) {
      case 'create':
        return `创建 "${operation.target?.title}"`;
      case 'delete':
        return '删除书签或文件夹';
      case 'update':
        return `重命名为 "${operation.target?.title}"`;
      case 'move':
        return '移动到新位置';
      case 'reorder':
        return '重新排序子项';
      default:
        return '未知操作';
    }
  }
  
  /**
   * 统计节点数量
   */
  private countNodes(tree: BookmarkNode[]): number {
    let count = 0;
    
    const traverse = (nodes: BookmarkNode[]) => {
      nodes.forEach(node => {
        count++;
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    
    traverse(tree);
    return count;
  }
  
  /**
   * 提取所有标题
   */
  private extractTitles(tree: BookmarkNode[]): string[] {
    const titles: string[] = [];
    
    const traverse = (nodes: BookmarkNode[]) => {
      nodes.forEach(node => {
        titles.push(node.title);
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    
    traverse(tree);
    return titles;
  }
}

// 单例导出
export const smartBookmarkManager = new SmartBookmarkManager();
