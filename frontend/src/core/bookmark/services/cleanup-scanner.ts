/**
 * 书签清理扫描器 - 核心业务逻辑
 *
 * 职责：
 * - 检测书签中的各种问题（404、重复、空文件夹等）
 * - 提供扫描进度回调
 * - 支持扫描中断
 */

import type { BookmarkNode } from '../domain/bookmark'
import type {
  CleanupProblem,
  CleanupSettings,
  ScanProgress,
  ScanResult
} from '../domain/cleanup-problem'
import type { Result } from '../../common/result'

/**
 * 后端检测结果的接口定义
 */
interface BackendCheckResult {
  isError: boolean
  status?: number
  error?: string
  errorCode?: string
  bookmarkId?: string
  url?: string
  statusText?: string
  responseTime?: number
}

/**
 * 扫描配置
 */
interface ScanConfig {
  maxConcurrentRequests: number
  requestTimeout: number
  retryAttempts: number
}

/**
 * 书签清理扫描器
 */
export class CleanupScanner {
  private abortController: AbortController | null = null
  private config: ScanConfig

  constructor(config?: Partial<ScanConfig>) {
    this.config = {
      maxConcurrentRequests: 10,
      requestTimeout: 8000,
      retryAttempts: 2,
      ...config
    }
  }

  /**
   * 开始扫描
   */
  async startScan(
    bookmarkTree: BookmarkNode[],
    activeFilters: string[],
    settings: CleanupSettings,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<Result<void, Error>> {
    try {
      this.abortController = new AbortController()

      // 收集所有书签节点
      const allBookmarks = this.collectBookmarks(bookmarkTree)
      const allFolders = this.collectFolders(bookmarkTree)

      // 初始化进度跟踪
      const progressMap = new Map<string, ScanProgress>()

      if (activeFilters.includes('404')) {
        progressMap.set('404', {
          type: '404',
          processed: 0,
          total: allBookmarks.length,
          foundIssues: 0,
          status: 'pending'
        })
      }

      if (activeFilters.includes('duplicate')) {
        progressMap.set('duplicate', {
          type: 'duplicate',
          processed: 0,
          total: allBookmarks.length,
          foundIssues: 0,
          status: 'pending'
        })
      }

      if (activeFilters.includes('empty')) {
        progressMap.set('empty', {
          type: 'empty',
          processed: 0,
          total: allFolders.length,
          foundIssues: 0,
          status: 'pending'
        })
      }

      if (activeFilters.includes('invalid')) {
        progressMap.set('invalid', {
          type: 'invalid',
          processed: 0,
          total: allBookmarks.length,
          foundIssues: 0,
          status: 'pending'
        })
      }

      // 执行各种扫描
      const scanPromises: Array<Promise<void>> = []

      if (activeFilters.includes('404') && settings.enable404Check) {
        scanPromises.push(
          this.scan404Errors(allBookmarks, progressMap, onProgress, onResult)
        )
      }

      if (
        activeFilters.includes('duplicate') &&
        settings.enableDuplicateCheck
      ) {
        scanPromises.push(
          this.scanDuplicates(allBookmarks, progressMap, onProgress, onResult)
        )
      }

      if (activeFilters.includes('empty') && settings.enableEmptyFolderCheck) {
        scanPromises.push(
          this.scanEmptyFolders(allFolders, progressMap, onProgress, onResult)
        )
      }

      if (activeFilters.includes('invalid') && settings.enableInvalidUrlCheck) {
        scanPromises.push(
          this.scanInvalidUrls(allBookmarks, progressMap, onProgress, onResult)
        )
      }

      // 等待所有扫描完成
      await Promise.all(scanPromises)

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 中断扫描
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * 收集所有书签节点
   */
  private collectBookmarks(tree: BookmarkNode[]): BookmarkNode[] {
    const bookmarks: BookmarkNode[] = []

    const traverse = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push(node)
        }
        if (node.children) {
          traverse(node.children)
        }
      }
    }

    traverse(tree)
    return bookmarks
  }

  /**
   * 收集所有文件夹节点
   */
  private collectFolders(tree: BookmarkNode[]): BookmarkNode[] {
    const folders: BookmarkNode[] = []

    const traverse = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (!node.url) {
          folders.push(node)
        }
        if (node.children) {
          traverse(node.children)
        }
      }
    }

    traverse(tree)
    return folders
  }

  /**
   * 扫描404错误
   */
  private async scan404Errors(
    bookmarks: BookmarkNode[],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('404')!
    progress.status = 'running'
    onProgress([...progressMap.values()])

    const semaphore = new Semaphore(this.config.maxConcurrentRequests)

    for (const bookmark of bookmarks) {
      if (this.abortController?.signal.aborted) break

      await semaphore.acquire()

      try {
        const result = await this.checkUrlStatus(bookmark.url!)
        if (result.isError) {
          const problem: CleanupProblem = {
            type: '404',
            severity: 'high',
            description: `URL无法访问 (${result.status})`,
            details: result.error,
            canAutoFix: false,
            bookmarkId: bookmark.id
          }

          onResult({
            nodeId: bookmark.id,
            problems: [problem],
            originalNode: bookmark
          })

          progress.foundIssues++
        }
      } catch (_error) {
        // 忽略单个URL检查错误，继续处理其他URL
      } finally {
        semaphore.release()
        progress.processed++
        onProgress([...progressMap.values()])
      }
    }

    progress.status = 'completed'
    onProgress([...progressMap.values()])
  }

  /**
   * 扫描重复书签
   */
  private async scanDuplicates(
    bookmarks: BookmarkNode[],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('duplicate')!
    progress.status = 'running'
    onProgress([...progressMap.values()])

    const urlMap = new Map<string, BookmarkNode[]>()

    // 按URL分组
    for (const bookmark of bookmarks) {
      if (this.abortController?.signal.aborted) break

      const url = bookmark.url!
      if (!urlMap.has(url)) {
        urlMap.set(url, [])
      }
      urlMap.get(url)!.push(bookmark)
    }

    // 检查重复
    for (const [url, duplicates] of urlMap) {
      if (this.abortController?.signal.aborted) break

      if (duplicates.length > 1) {
        const problem: CleanupProblem = {
          type: 'duplicate',
          severity: 'medium',
          description: `发现 ${duplicates.length} 个重复书签`,
          details: `URL: ${url}`,
          canAutoFix: true,
          bookmarkId: duplicates[0].id,
          relatedNodeIds: duplicates.slice(1).map(d => d.id)
        }

        onResult({
          nodeId: duplicates[0].id,
          problems: [problem],
          originalNode: duplicates[0]
        })

        progress.foundIssues++
      }

      progress.processed += duplicates.length
      onProgress([...progressMap.values()])
    }

    progress.status = 'completed'
    onProgress([...progressMap.values()])
  }

  /**
   * 扫描空文件夹
   */
  private async scanEmptyFolders(
    folders: BookmarkNode[],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('empty')!
    progress.status = 'running'
    onProgress([...progressMap.values()])

    for (const folder of folders) {
      if (this.abortController?.signal.aborted) break

      if (!folder.children || folder.children.length === 0) {
        const problem: CleanupProblem = {
          type: 'empty',
          severity: 'low',
          description: '空文件夹',
          details: '此文件夹不包含任何书签或子文件夹',
          canAutoFix: true,
          bookmarkId: folder.id
        }

        onResult({
          nodeId: folder.id,
          problems: [problem],
          originalNode: folder
        })

        progress.foundIssues++
      }

      progress.processed++
      onProgress([...progressMap.values()])
    }

    progress.status = 'completed'
    onProgress([...progressMap.values()])
  }

  /**
   * 扫描无效URL
   */
  private async scanInvalidUrls(
    bookmarks: BookmarkNode[],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('invalid')!
    progress.status = 'running'
    onProgress([...progressMap.values()])

    for (const bookmark of bookmarks) {
      if (this.abortController?.signal.aborted) break

      if (!this.isValidUrl(bookmark.url!)) {
        const problem: CleanupProblem = {
          type: 'invalid',
          severity: 'high',
          description: '无效的URL格式',
          details: `URL: ${bookmark.url}`,
          canAutoFix: false,
          bookmarkId: bookmark.id
        }

        onResult({
          nodeId: bookmark.id,
          problems: [problem],
          originalNode: bookmark
        })

        progress.foundIssues++
      }

      progress.processed++
      onProgress([...progressMap.values()])
    }

    progress.status = 'completed'
    onProgress([...progressMap.values()])
  }

  /**
   * 检查URL状态
   */
  private async checkUrlStatus(url: string): Promise<BackendCheckResult> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.requestTimeout
      )

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AcuityBookmarks/1.0)'
        }
      })

      clearTimeout(timeoutId)

      return {
        isError: !response.ok,
        status: response.status,
        statusText: response.statusText
      }
    } catch (error) {
      return {
        isError: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}

/**
 * 信号量实现，用于控制并发请求数量
 */
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>(resolve => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    this.permits++
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      this.permits--
      resolve()
    }
  }
}
