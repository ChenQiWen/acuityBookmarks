/**
 * 清理扫描器 - 实现各种书签问题检测
 */

import type { BookmarkNode } from '../types';
import type { CleanupProblem, CleanupSettings } from '../types/cleanup';
import { logger } from './logger';

export interface ScanProgress {
  type: string
  processed: number
  total: number
  foundIssues: number
  status: 'pending' | 'running' | 'completed' | 'error'
  estimatedTime?: string
}

export interface ScanResult {
  nodeId: string
  problems: CleanupProblem[]
  originalNode: BookmarkNode
}

export class CleanupScanner {
  private abortController: AbortController | null = null;

  /**
   * 开始扫描
   */
  async startScan(
    bookmarkTree: BookmarkNode[],
    activeFilters: string[],
    settings: CleanupSettings,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      // 收集所有书签节点
      const allBookmarks = this.collectBookmarks(bookmarkTree);
      const allFolders = this.collectFolders(bookmarkTree);

      logger.info('CleanupScanner', '开始扫描', {
        bookmarks: allBookmarks.length,
        folders: allFolders.length,
        filters: activeFilters
      });

      // 初始化进度跟踪
      const progressMap = new Map<string, ScanProgress>();

      if (activeFilters.includes('404')) {
        progressMap.set('404', {
          type: '404',
          processed: 0,
          total: allBookmarks.length,
          foundIssues: 0,
          status: 'pending'
        });
      }

      if (activeFilters.includes('duplicate')) {
        progressMap.set('duplicate', {
          type: 'duplicate',
          processed: 0,
          total: allBookmarks.length,
          foundIssues: 0,
          status: 'pending'
        });
      }

      if (activeFilters.includes('empty')) {
        progressMap.set('empty', {
          type: 'empty',
          processed: 0,
          total: allFolders.length,
          foundIssues: 0,
          status: 'pending'
        });
      }

      if (activeFilters.includes('invalid')) {
        progressMap.set('invalid', {
          type: 'invalid',
          processed: 0,
          total: allBookmarks.length,
          foundIssues: 0,
          status: 'pending'
        });
      }

      // 并行执行各种扫描
      const promises: Promise<void>[] = [];

      if (activeFilters.includes('404')) {
        promises.push(this.scan404Links(allBookmarks, settings['404'], progressMap, onProgress, onResult));
      }

      if (activeFilters.includes('duplicate')) {
        promises.push(this.scanDuplicates(allBookmarks, settings.duplicate, progressMap, onProgress, onResult));
      }

      if (activeFilters.includes('empty')) {
        promises.push(this.scanEmptyFolders(allFolders, settings.empty, progressMap, onProgress, onResult));
      }

      if (activeFilters.includes('invalid')) {
        promises.push(this.scanInvalidUrls(allBookmarks, settings.invalid, progressMap, onProgress, onResult));
      }

      // 等待所有扫描完成
      await Promise.all(promises);

      logger.info('CleanupScanner', '扫描完成');

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('CleanupScanner', '扫描被取消');
      } else {
        logger.error('CleanupScanner', '扫描失败', error);
        throw error;
      }
    }
  }

  /**
   * 取消扫描
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 404链接检测
   */
  private async scan404Links(
    bookmarks: BookmarkNode[],
    settings: CleanupSettings['404'],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('404')!;
    progress.status = 'running';
    onProgress(Array.from(progressMap.values()));

    // 🎯 智能预筛选：只检测可疑URL，减少90%请求量
    const suspiciousBookmarks = this.preFilterSuspiciousUrls(bookmarks);
    const optimizationStats = {
      total: bookmarks.length,
      suspicious: suspiciousBookmarks.length,
      skipped: bookmarks.length - suspiciousBookmarks.length,
      reduction: Math.round((1 - suspiciousBookmarks.length / bookmarks.length) * 100)
    };

    logger.info('CleanupScanner', '🎯 智能预筛选完成', optimizationStats);

    // 更新进度统计
    progress.total = suspiciousBookmarks.length;
    progress.estimatedTime = `预计 ${Math.ceil(suspiciousBookmarks.length / 50)} 秒`;
    onProgress(Array.from(progressMap.values()));

    logger.info('CleanupScanner', '开始404检测（优先后端）', {
      totalBookmarks: bookmarks.length,
      suspiciousBookmarks: suspiciousBookmarks.length,
      optimizationReduction: `${optimizationStats.reduction}%`
    });

    try {
      // 尝试使用后端API检测（只检测可疑书签）
      await this.scanUsingBackendAPI(suspiciousBookmarks, settings, progressMap, onProgress, onResult);
    } catch (error) {
      logger.warn('CleanupScanner', '后端检测失败，回退到前端检测', error);

      // 回退到前端检测（只检测可疑书签）
      await this.scanUsingFrontendFetch(suspiciousBookmarks, settings, progressMap, onProgress, onResult);
    }

    progress.status = 'completed';
    onProgress(Array.from(progressMap.values()));
  }

  /**
   * 使用后端API进行URL检测
   */
  private async scanUsingBackendAPI(
    bookmarks: BookmarkNode[],
    settings: CleanupSettings['404'],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    // 准备发送给后端的数据
    const urlsToCheck = bookmarks.map(bookmark => ({
      id: bookmark.id,
      url: bookmark.url!
    }));

    const backendSettings = {
      timeout: settings.timeout,
      followRedirects: settings.followRedirects,
      userAgent: this.getUserAgentString(settings.userAgent)
    };

    // 调用后端API（分批处理以避免超时）
    await this.processBatchedBackendRequests(urlsToCheck, backendSettings, bookmarks, progressMap, onProgress, onResult);
  }

  /**
   * 分批处理后端请求以避免超时
   */
  private async processBatchedBackendRequests(
    urlsToCheck: Array<{ id: string, url: string }>,
    backendSettings: any,
    bookmarks: BookmarkNode[],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('404')!;
    const batchSize = 50; // 每批最多50个URL
    const maxRetries = 2;

    logger.info('CleanupScanner', `分批处理${urlsToCheck.length}个URL，每批${batchSize}个`);

    for (let i = 0; i < urlsToCheck.length; i += batchSize) {
      if (this.abortController?.signal.aborted) break;

      const batch = urlsToCheck.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(urlsToCheck.length / batchSize);

      logger.info('CleanupScanner', `处理第${batchNumber}/${totalBatches}批，${batch.length}个URL`);

      let retryCount = 0;
      let success = false;

      while (retryCount <= maxRetries && !success) {
        try {
          // 创建AbortController，设置30秒超时
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch('http://localhost:3000/api/check-urls', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              urls: batch,
              settings: backendSettings
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`后端API响应错误: ${response.status}`);
          }

          const data = await response.json();

          if (!data.results || !Array.isArray(data.results)) {
            throw new Error('后端API返回数据格式错误');
          }

          // 处理这批结果
          logger.info('CleanupScanner', '收到后端检测结果', {
            resultCount: data.results.length,
            errorCount: data.results.filter((r: any) => r.isError).length
          });

          for (const result of data.results) {
            if (this.abortController?.signal.aborted) break;

            progress.processed++;

            if (result.isError) {
              logger.info('CleanupScanner', '发现问题URL', {
                url: result.url,
                status: result.status,
                statusText: result.statusText,
                error: result.error
              });

              const bookmark = bookmarks.find(b => b.id === result.id);
              if (bookmark) {
                const problem = this.createProblemFromBackendResult(result);
                if (problem) {
                  progress.foundIssues++;
                  logger.info('CleanupScanner', '创建问题对象', {
                    nodeId: bookmark.id,
                    problem
                  });
                  onResult({
                    nodeId: bookmark.id,
                    problems: [problem],
                    originalNode: bookmark
                  });
                }
              }
            }
          }

          // 更新进度
          onProgress(Array.from(progressMap.values()));
          success = true;

          // 批次间稍微延迟，避免过度并发
          if (i + batchSize < urlsToCheck.length) {
            await this.delay(200);
          }

        } catch (error: any) {
          retryCount++;

          if (error?.name === 'AbortError') {
            logger.warn('CleanupScanner', `第${batchNumber}批请求超时，第${retryCount}次重试`);
          } else {
            logger.warn('CleanupScanner', `第${batchNumber}批请求失败，第${retryCount}次重试`, error);
          }

          if (retryCount > maxRetries) {
            logger.error('CleanupScanner', `第${batchNumber}批重试次数用尽，跳过这批`);
            // 标记这批为已处理，但不记录结果
            progress.processed += batch.length;
            onProgress(Array.from(progressMap.values()));
            break;
          }

          // 重试前等待一下
          await this.delay(1000 * retryCount);
        }
      }
    }
  }

  /**
   * 回退到前端fetch检测
   */
  private async scanUsingFrontendFetch(
    bookmarks: BookmarkNode[],
    settings: CleanupSettings['404'],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('404')!;
    const batchSize = 10; // 并发检测数量

    for (let i = 0; i < bookmarks.length; i += batchSize) {
      if (this.abortController?.signal.aborted) break;

      const batch = bookmarks.slice(i, i + batchSize);
      const promises = batch.map(bookmark => this.checkLink(bookmark, settings));

      try {
        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
          const bookmark = batch[index];
          progress.processed++;

          if (result.status === 'fulfilled' && result.value) {
            // 发现404问题
            progress.foundIssues++;
            onResult({
              nodeId: bookmark.id,
              problems: [result.value],
              originalNode: bookmark
            });
          }
        });

        // 更新进度
        onProgress(Array.from(progressMap.values()));

        // 避免请求过于频繁
        await this.delay(100);

      } catch (error) {
        logger.error('CleanupScanner', '404检测批次失败', error);
      }
    }
  }

  /**
   * 检测单个链接是否404
   */
  private async checkLink(bookmark: BookmarkNode, settings: CleanupSettings['404']): Promise<CleanupProblem | null> {
    if (!bookmark.url) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), settings.timeout * 1000);

      const response = await fetch(bookmark.url, {
        method: 'HEAD', // 只获取头部，更高效
        signal: controller.signal,
        redirect: settings.followRedirects ? 'follow' : 'manual'
      });

      clearTimeout(timeoutId);

      // 检查响应状态
      if (response.status >= 400) {
        return {
          type: '404',
          severity: response.status >= 500 ? 'high' : 'medium',
          description: `HTTP ${response.status}: ${response.statusText}`,
          details: `链接返回错误状态码 ${response.status}`,
          canAutoFix: true,
          bookmarkId: bookmark.id
        };
      }

      return null;

    } catch (error) {
      // 网络错误、超时等
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            type: '404',
            severity: 'medium',
            description: '请求超时',
            details: `链接响应超过 ${settings.timeout} 秒`,
            canAutoFix: true,
            bookmarkId: bookmark.id
          };
        }

        // 检测CORS错误 - 根据设置决定是否忽略
        if (this.isCorsError(error)) {
          if (settings.ignoreCors) {
            logger.info('CleanupScanner', 'CORS错误，跳过检测', {
              url: bookmark.url,
              error: error.message
            });
            return null; // 用户选择忽略CORS错误，不标记为404
          } else {
            return {
              type: '404',
              severity: 'low',
              description: 'CORS跨域限制',
              details: `由于跨域限制无法访问: ${error.message}`,
              canAutoFix: false, // CORS问题无法自动修复
              bookmarkId: bookmark.id
            };
          }
        }

        // 检测网络连接错误
        if (this.isNetworkError(error)) {
          return {
            type: '404',
            severity: 'high',
            description: '网络连接失败',
            details: `无法连接到服务器: ${error.message}`,
            canAutoFix: true,
            bookmarkId: bookmark.id
          };
        }

        // 其他未知错误
        logger.warn('CleanupScanner', '未知错误类型', {
          url: bookmark.url,
          error: error.message,
          errorName: error.name
        });
        return null; // 对于未知错误，保守处理，不标记为404
      }

      return null;
    }
  }

  /**
   * 重复书签检测
   */
  private async scanDuplicates(
    bookmarks: BookmarkNode[],
    settings: CleanupSettings['duplicate'],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('duplicate')!;
    progress.status = 'running';
    onProgress(Array.from(progressMap.values()));

    const processedBookmarks: BookmarkNode[] = [];

    // 检查每个书签是否与其他书签重复
    for (let i = 0; i < bookmarks.length; i++) {
      if (this.abortController?.signal.aborted) break;

      const currentBookmark = bookmarks[i];
      if (!currentBookmark.url) {
        progress.processed++;
        continue;
      }

      const duplicates: BookmarkNode[] = [];

      // 与已处理的书签比较
      for (const other of processedBookmarks) {
        if (this.isDuplicate(currentBookmark, other, settings)) {
          duplicates.push(other);
        }
      }

      // 与后续书签比较
      for (let j = i + 1; j < bookmarks.length; j++) {
        const other = bookmarks[j];
        if (other.url && this.isDuplicate(currentBookmark, other, settings)) {
          duplicates.push(other);
        }
      }

      if (duplicates.length > 0) {
        // 发现重复书签
        progress.foundIssues++;
        onResult({
          nodeId: currentBookmark.id,
          problems: [{
            type: 'duplicate',
            severity: 'low',
            description: '重复的书签',
            details: `发现 ${duplicates.length + 1} 个相似的书签`,
            canAutoFix: true,
            bookmarkId: currentBookmark.id,
            relatedNodeIds: duplicates.map(b => b.id)
          }],
          originalNode: currentBookmark
        });
      }

      processedBookmarks.push(currentBookmark);
      progress.processed++;

      if (progress.processed % 50 === 0) {
        onProgress(Array.from(progressMap.values()));
        // 避免阻塞UI
        await this.delay(10);
      }
    }

    progress.status = 'completed';
    onProgress(Array.from(progressMap.values()));
  }

  /**
   * 判断两个书签是否重复
   */
  private isDuplicate(bookmark1: BookmarkNode, bookmark2: BookmarkNode, settings: CleanupSettings['duplicate']): boolean {
    if (!bookmark1.url || !bookmark2.url) return false;

    let urlMatch = false;
    let titleMatch = false;

    // URL比较
    if (settings.compareUrl) {
      const url1 = settings.ignoreDomain ? this.extractPath(bookmark1.url) : bookmark1.url;
      const url2 = settings.ignoreDomain ? this.extractPath(bookmark2.url) : bookmark2.url;
      urlMatch = url1 === url2;
    }

    // 标题比较
    if (settings.compareTitle && bookmark1.title && bookmark2.title) {
      const similarity = this.calculateTextSimilarity(bookmark1.title, bookmark2.title);
      titleMatch = similarity >= settings.titleSimilarity;
    }

    // 根据设置决定匹配条件
    if (settings.compareUrl && settings.compareTitle) {
      return urlMatch || titleMatch;  // 任一匹配即视为重复
    } else if (settings.compareUrl) {
      return urlMatch;
    } else if (settings.compareTitle) {
      return titleMatch;
    }

    return false;
  }

  /**
   * 计算文本相似度 (0-1)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;

    const str1 = text1.toLowerCase().trim();
    const str2 = text2.toLowerCase().trim();

    if (str1 === str2) return 1;

    // 使用简单的Levenshtein距离算法
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,  // substitution
            matrix[i][j - 1] + 1,      // insertion
            matrix[i - 1][j] + 1       // deletion
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);

    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  /**
   * 空文件夹检测
   */
  private async scanEmptyFolders(
    folders: BookmarkNode[],
    settings: CleanupSettings['empty'],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('empty')!;
    progress.status = 'running';
    onProgress(Array.from(progressMap.values()));

    for (const folder of folders) {
      if (this.abortController?.signal.aborted) break;

      const isEmpty = settings.recursive
        ? this.isRecursivelyEmpty(folder)
        : this.isEmpty(folder);

      if (isEmpty && this.shouldCleanFolder(folder, settings)) {
        progress.foundIssues++;

        const description = settings.recursive && folder.children && folder.children.length > 0
          ? '实际空文件夹'
          : '空文件夹';

        const details = settings.recursive && folder.children && folder.children.length > 0
          ? '该文件夹只包含空的子文件夹，无实际内容'
          : '该文件夹不包含任何书签或子文件夹';

        onResult({
          nodeId: folder.id,
          problems: [{
            type: 'empty',
            severity: 'low',
            description,
            details,
            canAutoFix: true,
            bookmarkId: folder.id
          }],
          originalNode: folder
        });
      }

      progress.processed++;
      if (progress.processed % 20 === 0) {
        onProgress(Array.from(progressMap.values()));
        await this.delay(5);
      }
    }

    progress.status = 'completed';
    onProgress(Array.from(progressMap.values()));
  }

  /**
   * 递归检查文件夹是否为空（包括只含空子文件夹的情况）
   */
  private isRecursivelyEmpty(folder: BookmarkNode): boolean {
    if (!folder.children || folder.children.length === 0) {
      return true;
    }

    // 检查是否包含书签
    for (const child of folder.children) {
      if (child.url) {
        return false;  // 包含书签，不为空
      }
    }

    // 检查所有子文件夹是否都为空
    for (const child of folder.children) {
      if (!child.url) {  // 这是一个文件夹
        if (!this.isRecursivelyEmpty(child)) {
          return false;  // 子文件夹不为空
        }
      }
    }

    return true;  // 所有子文件夹都为空
  }

  /**
   * 无效URL格式检测
   */
  private async scanInvalidUrls(
    bookmarks: BookmarkNode[],
    settings: CleanupSettings['invalid'],
    progressMap: Map<string, ScanProgress>,
    onProgress: (progress: ScanProgress[]) => void,
    onResult: (result: ScanResult) => void
  ): Promise<void> {
    const progress = progressMap.get('invalid')!;
    progress.status = 'running';
    onProgress(Array.from(progressMap.values()));

    for (const bookmark of bookmarks) {
      if (this.abortController?.signal.aborted) break;

      if (bookmark.url) {
        const problem = this.validateUrl(bookmark.url, settings, bookmark.id);
        if (problem) {
          progress.foundIssues++;
          onResult({
            nodeId: bookmark.id,
            problems: [problem],
            originalNode: bookmark
          });
        }
      }

      progress.processed++;
      if (progress.processed % 50 === 0) {
        onProgress(Array.from(progressMap.values()));
      }
    }

    progress.status = 'completed';
    onProgress(Array.from(progressMap.values()));
  }

  // 工具方法
  private collectBookmarks(nodes: BookmarkNode[]): BookmarkNode[] {
    const bookmarks: BookmarkNode[] = [];

    const traverse = (nodeList: BookmarkNode[]) => {
      for (const node of nodeList) {
        if (node.url) {
          bookmarks.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(nodes);
    return bookmarks;
  }

  private collectFolders(nodes: BookmarkNode[]): BookmarkNode[] {
    const folders: BookmarkNode[] = [];

    const traverse = (nodeList: BookmarkNode[]) => {
      for (const node of nodeList) {
        if (!node.url && node.children) {
          folders.push(node);
          traverse(node.children);
        }
      }
    };

    traverse(nodes);
    return folders;
  }

  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      return url;
    }
  }

  private isEmpty(folder: BookmarkNode): boolean {
    return !folder.children || folder.children.length === 0;
  }

  private shouldCleanFolder(folder: BookmarkNode, settings: CleanupSettings['empty']): boolean {
    // 检查是否为保护的顶级文件夹
    if (settings.preserveStructure && ['1', '2', 'root-cloned'].includes(folder.id)) {
      return false;
    }

    // 检查最小深度限制（避免删除过于重要的文件夹）
    const depth = this.calculateFolderDepth(folder.id);
    if (depth < settings.minDepth) {
      return false;
    }

    return true;
  }

  private validateUrl(url: string, settings: CleanupSettings['invalid'], bookmarkId: string): CleanupProblem | null {
    try {
      const urlObj = new URL(url);

      // 检查协议
      if (settings.checkProtocol && !['http:', 'https:'].includes(urlObj.protocol)) {
        if (!settings.allowLocalhost || !['file:', 'chrome-extension:'].includes(urlObj.protocol)) {
          return {
            type: 'invalid',
            severity: 'medium',
            description: '无效的URL协议',
            details: `协议 "${urlObj.protocol}" 可能无法正常访问`,
            canAutoFix: false,
            bookmarkId: bookmarkId
          };
        }
      }

      // 检查域名格式
      if (settings.checkDomain && urlObj.hostname && !this.isValidDomain(urlObj.hostname)) {
        return {
          type: 'invalid',
          severity: 'medium',
          description: '无效的域名格式',
          details: `域名 "${urlObj.hostname}" 格式不正确`,
          canAutoFix: false,
          bookmarkId: bookmarkId
        };
      }

      // 检查自定义模式
      if (settings.customPatterns && settings.customPatterns.trim()) {
        const patterns = settings.customPatterns.split('\n')
          .map(p => p.trim())
          .filter(p => p.length > 0);

        for (const pattern of patterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(url)) {
              return {
                type: 'invalid',
                severity: 'medium',
                description: '匹配自定义无效模式',
                details: `URL匹配模式: ${pattern}`,
                canAutoFix: false,
                bookmarkId: bookmarkId
              };
            }
          } catch {
            // 忽略无效的正则表达式模式
            logger.warn('CleanupScanner', '无效的正则表达式模式:', pattern);
          }
        }
      }

      // 检查常见的无效URL特征
      const commonInvalidPatterns = [
        /^javascript:/i,      // JavaScript伪协议
        /^data:text\/html/i,  // HTML数据URL
        /^about:blank/i,      // 空白页
        /localhost:[\d]+\/$/i // 本地开发服务器默认页面
      ];

      for (const pattern of commonInvalidPatterns) {
        if (pattern.test(url)) {
          return {
            type: 'invalid',
            severity: 'low',
            description: '可疑的URL格式',
            details: '检测到可能无效的URL模式',
            canAutoFix: false,
            bookmarkId: bookmarkId
          };
        }
      }

      return null;

    } catch (error) {
      return {
        type: 'invalid',
        severity: 'high',
        description: 'URL格式错误',
        details: error instanceof Error ? error.message : '无法解析URL',
        canAutoFix: false,
        bookmarkId: bookmarkId
      };
    }
  }

  private isValidDomain(domain: string): boolean {
    // 域名格式验证 - 修复单字符子域名的支持
    // 每个组件可以是：单字符 或 开头+中间+结尾的组合
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) || domain === 'localhost';
  }

  private calculateFolderDepth(folderId: string): number {
    // 计算文件夹的层级深度
    // 顶级文件夹（1, 2, root-cloned）深度为0
    if (['1', '2', 'root-cloned'].includes(folderId)) {
      return 0;
    }

    // 简单的深度估算：通过ID格式判断
    // 实际项目中可能需要遍历父级链来准确计算
    const numericId = parseInt(folderId);
    if (numericId > 0 && numericId < 10) return 1;  // 一级子文件夹
    if (numericId < 100) return 2;  // 二级子文件夹  
    return 3;  // 更深层级
  }

  /**
   * 检测是否为CORS错误
   */
  private isCorsError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // 常见的CORS相关错误标识
    const corsKeywords = [
      'cors',
      'access-control-allow-origin',
      'cross-origin',
      'failed to fetch',
      'network error when attempting to fetch resource',
      'the request client is not a secure context',
      'access to fetch',
      'has been blocked by cors policy',
      'preflight',
      'origin'
    ];

    // TypeError + "Failed to fetch" 通常是CORS错误
    if (name === 'typeerror' && message.includes('failed to fetch')) {
      return true;
    }

    return corsKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 检测是否为真正的网络连接错误
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const networkKeywords = [
      'net::err_internet_disconnected',
      'net::err_network_changed',
      'net::err_connection_refused',
      'net::err_connection_reset',
      'net::err_connection_aborted',
      'net::err_timed_out',
      'net::err_name_not_resolved',
      'net::err_address_unreachable'
    ];

    return networkKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 获取用户代理字符串
   */
  private getUserAgentString(userAgent: string): string {
    const userAgents = {
      chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
    };

    return userAgents[userAgent as keyof typeof userAgents] || userAgents.chrome;
  }

  /**
   * 🎯 智能预筛选：只检测可疑URL，减少90%网络请求
   */
  private preFilterSuspiciousUrls(bookmarks: BookmarkNode[]): BookmarkNode[] {
    const suspiciousBookmarks: BookmarkNode[] = [];

    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue;

      // 检查是否为可疑URL
      if (this.isSuspiciousUrl(bookmark.url)) {
        suspiciousBookmarks.push(bookmark);
      }
    }

    return suspiciousBookmarks;
  }

  /**
   * 判断URL是否可疑（可能存在404问题）
   */
  private isSuspiciousUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // 1. 🔴 本地开发地址（极可能失效）
      const localPatterns = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '192.168.',
        '10.0.',
        '172.16.',
        '172.17.',
        '172.18.',
        '172.19.',
        '172.20.',
        '172.21.',
        '172.22.',
        '172.23.',
        '172.24.',
        '172.25.',
        '172.26.',
        '172.27.',
        '172.28.',
        '172.29.',
        '172.30.',
        '172.31.'
      ];

      if (localPatterns.some(pattern => hostname.includes(pattern))) {
        return true;
      }

      // 2. 🔴 包含端口号（开发环境常见）
      if (urlObj.port && ['3000', '3001', '8000', '8080', '8888', '9000', '5000', '4200'].includes(urlObj.port)) {
        return true;
      }

      // 3. 🟡 短链接服务（可能失效）
      const shortLinkDomains = [
        'bit.ly',
        'tinyurl.com',
        't.co',
        'goo.gl',
        'ow.ly',
        'is.gd',
        'buff.ly',
        'tiny.cc',
        'shorturl.at',
        'rb.gy',
        'cutt.ly',
        'short.link'
      ];

      if (shortLinkDomains.some(domain => hostname.includes(domain))) {
        return true;
      }

      // 4. 🟡 临时/测试域名模式
      const tempPatterns = [
        'test',
        'staging',
        'dev',
        'demo',
        'temp',
        'tmp',
        'beta',
        'alpha',
        'preview',
        'sandbox'
      ];

      if (tempPatterns.some(pattern => hostname.includes(pattern) || pathname.includes(pattern))) {
        return true;
      }

      // 5. 🟡 可疑路径模式
      const suspiciousPathPatterns = [
        '/test/',
        '/demo/',
        '/temp/',
        '/tmp/',
        '/debug/',
        '/admin/',
        '/login',
        '/404',
        '/error',
        '/broken',
        '/old/',
        '/archive/',
        '/backup/',
        'index.php',
        'index.html',
        'default.htm'
      ];

      if (suspiciousPathPatterns.some(pattern => pathname.includes(pattern))) {
        return true;
      }

      // 6. 🟡 非标准协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return true;
      }

      // 7. 🟡 已知可能失效的域名后缀
      const suspiciousTlds = [
        '.tk',   // 免费域名
        '.ml',   // 免费域名
        '.ga',   // 免费域名
        '.cf',   // 免费域名
        '.000webhostapp.com',
        '.github.io/test',
        '.surge.sh',
        '.netlify.app/test',
        '.vercel.app/test'
      ];

      if (suspiciousTlds.some(tld => hostname.includes(tld))) {
        return true;
      }

      // 8. 🟡 包含日期或版本号的URL（可能过期）
      const dateVersionPatterns = [
        /\/20\d{2}\//,     // 年份路径
        /\/v\d+\./,        // 版本号
        /\/old\//,         // 旧版本
        /\/archive\//,     // 存档
        /\/backup\//       // 备份
      ];

      if (dateVersionPatterns.some(pattern => pattern.test(pathname))) {
        return true;
      }

      // 9. 🟡 URL包含特殊字符或格式异常
      if (url.includes('%%') || url.includes('??') || url.length > 2000) {
        return true;
      }

      // 如果都不匹配，认为是正常URL，跳过检测
      return false;

    } catch {
      // URL格式错误，需要检测
      return true;
    }
  }

  /**
   * 从后端结果创建问题对象
   */
  private createProblemFromBackendResult(result: any): CleanupProblem | null {
    if (!result.isError) return null;

    let severity: 'low' | 'medium' | 'high' = 'medium';
    let description = '链接无法访问';
    let details = '';

    if (result.status === 0) {
      if (result.error?.includes('timeout')) {
        severity = 'medium';
        description = '请求超时';
        details = `链接响应超过设定时间: ${result.error}`;
      } else if (result.errorCode) {
        severity = 'high';
        description = '网络连接失败';
        details = `连接错误 (${result.errorCode}): ${result.error}`;
      } else {
        severity = 'high';
        description = '网络错误';
        details = result.error || '未知网络错误';
      }
    } else if (result.status >= 400) {
      severity = result.status >= 500 ? 'high' : 'medium';
      description = `HTTP ${result.status}: ${result.statusText}`;
      details = `服务器返回错误状态码 ${result.status}`;

      if (result.status === 404) {
        description = '页面不存在';
        details = '链接指向的页面已不存在';
      } else if (result.status === 403) {
        description = '访问被拒绝';
        details = '服务器拒绝访问此页面';
      } else if (result.status === 500) {
        description = '服务器内部错误';
        details = '目标服务器出现内部错误';
      }
    }

    return {
      type: '404',
      severity,
      description,
      details: `${details}${result.responseTime ? ` (响应时间: ${result.responseTime}ms)` : ''}`,
      canAutoFix: true,
      bookmarkId: (result as any).bookmarkId || 'unknown'
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
