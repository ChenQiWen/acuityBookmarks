/**
 * 书签管理状态存储
 * 使用Pinia进行现代化状态管理，支持AI分析和性能监控
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { performanceMonitor } from '../utils/performance-monitor';

// 类型定义
export interface Bookmark {
  id: string
  title: string
  url: string
  parentId?: string
  dateAdded?: number
  dateGroupModified?: number
  index?: number
  children?: Bookmark[]
}

export interface BookmarkCategory {
  id: string
  name: string
  description?: string
  color?: string
  aiGenerated: boolean
  confidence: number
  bookmarks: Bookmark[]
}

export interface AIAnalysisResult {
  bookmarkId: string
  category: string
  confidence: number
  tags: string[]
  summary?: string
  analysisDate: number
}

export interface BookmarkStats {
  totalBookmarks: number
  categorizedBookmarks: number
  uncategorizedBookmarks: number
  averageConfidence: number
  lastAnalysisDate?: number
}

/**
 * 书签状态管理存储
 */
export const useBookmarkStore = defineStore('bookmark', () => {
  // === 状态 ===
  const bookmarks = ref<Bookmark[]>([]);
  const categories = ref<BookmarkCategory[]>([]);
  const aiAnalysisCache = ref<Map<string, AIAnalysisResult>>(new Map());
  const selectedBookmarks = ref<Set<string>>(new Set());

  // 加载状态
  const isLoading = ref(false);
  const isAnalyzing = ref(false);
  const isSaving = ref(false);

  // 错误状态
  const lastError = ref<string | null>(null);

  // 搜索状态
  const searchQuery = ref('');
  const searchResults = ref<Bookmark[]>([]);

  // === 计算属性 ===

  /**
   * 按分类组织的书签
   */
  const categorizedBookmarks = computed(() => {
    const result: Record<string, Bookmark[]> = {};

    // 初始化分类
    categories.value.forEach(category => {
      result[category.id] = [];
    });

    // 分配书签到分类
    bookmarks.value.forEach(bookmark => {
      const analysis = aiAnalysisCache.value.get(bookmark.id);
      if (analysis) {
        const categoryId = analysis.category;
        if (result[categoryId]) {
          result[categoryId].push(bookmark);
        } else {
          // 未知分类，创建临时分类
          if (!result['uncategorized']) {
            result['uncategorized'] = [];
          }
          result['uncategorized'].push(bookmark);
        }
      } else {
        // 未分析的书签
        if (!result['unanalyzed']) {
          result['unanalyzed'] = [];
        }
        result['unanalyzed'].push(bookmark);
      }
    });

    return result;
  });

  /**
   * 书签统计信息
   */
  const bookmarkStats = computed((): BookmarkStats => {
    const total = bookmarks.value.length;
    const categorized = Array.from(aiAnalysisCache.value.values()).length;
    const uncategorized = total - categorized;

    const confidenceSum = Array.from(aiAnalysisCache.value.values())
      .reduce((sum, analysis) => sum + analysis.confidence, 0);
    const averageConfidence = categorized > 0 ? confidenceSum / categorized : 0;

    const lastAnalysis = Math.max(...Array.from(aiAnalysisCache.value.values())
      .map(analysis => analysis.analysisDate));

    return {
      totalBookmarks: total,
      categorizedBookmarks: categorized,
      uncategorizedBookmarks: uncategorized,
      averageConfidence,
      lastAnalysisDate: lastAnalysis > 0 ? lastAnalysis : undefined
    };
  });

  /**
   * 过滤后的搜索结果
   */
  const filteredBookmarks = computed(() => {
    if (!searchQuery.value.trim()) {
      return bookmarks.value;
    }

    const query = searchQuery.value.toLowerCase();
    return bookmarks.value.filter(bookmark =>
      bookmark.title.toLowerCase().includes(query) ||
      bookmark.url.toLowerCase().includes(query) ||
      aiAnalysisCache.value.get(bookmark.id)?.tags?.some(tag =>
        tag.toLowerCase().includes(query)
      )
    );
  });

  // === 动作 ===

  /**
   * 从Chrome加载书签
   */
  async function loadBookmarks(): Promise<void> {
    const loadTimer = performanceMonitor.measureStartupTime();
    isLoading.value = true;
    lastError.value = null;

    try {
      // 模拟Chrome书签API调用
      const chromeBookmarks = await new Promise<Bookmark[]>((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          chrome.bookmarks.getTree((tree) => {
            const flatBookmarks = flattenBookmarkTree(tree);
            resolve(flatBookmarks);
          });
        } else {
          // 开发环境模拟数据
          resolve(generateMockBookmarks());
        }
      });

      bookmarks.value = chromeBookmarks;

      // 加载已缓存的AI分析结果
      await loadCachedAnalysis();

      performanceMonitor.trackUserAction('bookmarks_loaded', {
        count: chromeBookmarks.length,
        cached_analysis: aiAnalysisCache.value.size
      });

    } catch (error) {
      lastError.value = `加载书签失败: ${(error as Error).message}`;
      console.error('加载书签失败:', error);
    } finally {
      isLoading.value = false;
      loadTimer.end();
    }
  }

  /**
   * AI分析书签并自动分类
   */
  async function analyzeBookmarksWithAI(bookmarksToAnalyze?: Bookmark[]): Promise<void> {
    const targetBookmarks = bookmarksToAnalyze || bookmarks.value;
    if (targetBookmarks.length === 0) return;

    isAnalyzing.value = true;
    lastError.value = null;

    try {
      await performanceMonitor.measureAIAnalysis(async () => {
        // 批量分析，避免API频繁调用
        const batchSize = 10;
        const results: AIAnalysisResult[] = [];

        for (let i = 0; i < targetBookmarks.length; i += batchSize) {
          const batch = targetBookmarks.slice(i, i + batchSize);
          const batchResults = await analyzeBatch(batch);
          results.push(...batchResults);

          // 更新进度
          const progress = Math.min(100, ((i + batchSize) / targetBookmarks.length) * 100);
          console.log(`AI分析进度: ${progress.toFixed(1)}%`);
        }

        // 更新缓存
        results.forEach(result => {
          aiAnalysisCache.value.set(result.bookmarkId, result);
        });

        // 更新分类
        await updateCategoriesFromAnalysis(results);

        // 保存到本地存储
        await saveCachedAnalysis();

        return results;
      }, targetBookmarks.length, 'batch_classification');

      performanceMonitor.trackUserAction('ai_analysis_completed', {
        analyzed_count: targetBookmarks.length,
        total_cached: aiAnalysisCache.value.size
      });

    } catch (error) {
      lastError.value = `AI分析失败: ${(error as Error).message}`;
      console.error('AI分析失败:', error);
    } finally {
      isAnalyzing.value = false;
    }
  }

  /**
   * 智能搜索书签
   */
  async function searchBookmarks(query: string): Promise<Bookmark[]> {
    searchQuery.value = query;

    if (!query.trim()) {
      searchResults.value = [];
      return [];
    }

    return await performanceMonitor.measureAIAnalysis(async () => {
      // 组合搜索：关键词 + 语义搜索
      const keywordResults = performKeywordSearch(query);
      const semanticResults = await performSemanticSearch(query);

      // 合并并去重结果
      const allResults = [...keywordResults, ...semanticResults];
      const uniqueResults = Array.from(
        new Map(allResults.map(bookmark => [bookmark.id, bookmark])).values()
      );

      searchResults.value = uniqueResults;
      return uniqueResults;
    }, bookmarks.value.length, 'smart_search');
  }

  /**
   * 添加新书签
   */
  async function addBookmark(bookmark: Omit<Bookmark, 'id'>): Promise<string> {
    const newBookmark: Bookmark = {
      ...bookmark,
      id: generateBookmarkId(),
      dateAdded: Date.now()
    };

    bookmarks.value.push(newBookmark);

    // 自动分析新书签
    await analyzeBookmarksWithAI([newBookmark]);

    performanceMonitor.trackUserAction('bookmark_added', {
      url: bookmark.url,
      title: bookmark.title
    });

    return newBookmark.id;
  }

  /**
   * 删除书签
   */
  function removeBookmark(bookmarkId: string): void {
    const index = bookmarks.value.findIndex(b => b.id === bookmarkId);
    if (index !== -1) {
      bookmarks.value.splice(index, 1);
      aiAnalysisCache.value.delete(bookmarkId);
      selectedBookmarks.value.delete(bookmarkId);

      performanceMonitor.trackUserAction('bookmark_removed', {
        bookmark_id: bookmarkId
      });
    }
  }

  /**
   * 批量删除书签
   */
  function removeSelectedBookmarks(): void {
    const idsToRemove = Array.from(selectedBookmarks.value);
    idsToRemove.forEach(id => removeBookmark(id));
    selectedBookmarks.value.clear();

    performanceMonitor.trackUserAction('bookmarks_batch_removed', {
      count: idsToRemove.length
    });
  }

  /**
   * 切换书签选择状态
   */
  function toggleBookmarkSelection(bookmarkId: string): void {
    if (selectedBookmarks.value.has(bookmarkId)) {
      selectedBookmarks.value.delete(bookmarkId);
    } else {
      selectedBookmarks.value.add(bookmarkId);
    }
  }

  /**
   * 清空选择
   */
  function clearSelection(): void {
    selectedBookmarks.value.clear();
  }

  // === 内部辅助函数 ===

  /**
   * 展平书签树结构
   */
  function flattenBookmarkTree(nodes: any[]): Bookmark[] {
    const result: Bookmark[] = [];

    function traverse(node: any) {
      if (node.url) {
        result.push({
          id: node.id,
          title: node.title,
          url: node.url,
          parentId: node.parentId,
          dateAdded: node.dateAdded,
          index: node.index
        });
      }

      if (node.children) {
        node.children.forEach(traverse);
      }
    }

    nodes.forEach(traverse);
    return result;
  }

  /**
   * 生成模拟书签数据（开发环境）
   */
  function generateMockBookmarks(): Bookmark[] {
    return [
      {
        id: '1',
        title: 'Vue.js Official Documentation',
        url: 'https://vuejs.org/',
        dateAdded: Date.now() - 86400000
      },
      {
        id: '2',
        title: 'TypeScript Handbook',
        url: 'https://www.typescriptlang.org/docs/',
        dateAdded: Date.now() - 172800000
      },
      {
        id: '3',
        title: 'GitHub',
        url: 'https://github.com',
        dateAdded: Date.now() - 259200000
      }
    ];
  }

  /**
   * 批量分析书签
   */
  async function analyzeBatch(batch: Bookmark[]): Promise<AIAnalysisResult[]> {
    // 模拟AI分析API调用
    return batch.map(bookmark => ({
      bookmarkId: bookmark.id,
      category: predictCategory(bookmark),
      confidence: Math.random() * 0.3 + 0.7, // 70-100%
      tags: generateTags(bookmark),
      summary: `AI分析：${bookmark.title}`,
      analysisDate: Date.now()
    }));
  }

  /**
   * 预测书签分类（简化版）
   */
  function predictCategory(bookmark: Bookmark): string {
    const url = bookmark.url.toLowerCase();
    const title = bookmark.title.toLowerCase();

    if (url.includes('github') || title.includes('code')) return 'development';
    if (url.includes('docs') || title.includes('documentation')) return 'documentation';
    if (url.includes('news') || url.includes('blog')) return 'news';
    if (url.includes('social') || url.includes('twitter')) return 'social';

    return 'general';
  }

  /**
   * 生成标签
   */
  function generateTags(bookmark: Bookmark): string[] {
    const tags: string[] = [];
    const url = bookmark.url.toLowerCase();
    const title = bookmark.title.toLowerCase();

    if (url.includes('javascript') || title.includes('js')) tags.push('javascript');
    if (url.includes('vue') || title.includes('vue')) tags.push('vue');
    if (url.includes('react') || title.includes('react')) tags.push('react');
    if (url.includes('typescript') || title.includes('typescript')) tags.push('typescript');

    return tags;
  }

  /**
   * 关键词搜索
   */
  function performKeywordSearch(query: string): Bookmark[] {
    const lowercaseQuery = query.toLowerCase();
    return bookmarks.value.filter(bookmark =>
      bookmark.title.toLowerCase().includes(lowercaseQuery) ||
      bookmark.url.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * 语义搜索（简化版）
   */
  async function performSemanticSearch(query: string): Promise<Bookmark[]> {
    // 简化的语义搜索，实际应用中会调用AI服务
    const results: Bookmark[] = [];

    for (const [bookmarkId, analysis] of aiAnalysisCache.value) {
      if (analysis.tags.some(tag => tag.includes(query.toLowerCase()))) {
        const bookmark = bookmarks.value.find(b => b.id === bookmarkId);
        if (bookmark) results.push(bookmark);
      }
    }

    return results;
  }

  /**
   * 根据分析结果更新分类
   */
  async function updateCategoriesFromAnalysis(results: AIAnalysisResult[]): Promise<void> {
    const categoryMap = new Map<string, { count: number; confidence: number }>();

    results.forEach(result => {
      const existing = categoryMap.get(result.category);
      if (existing) {
        existing.count++;
        existing.confidence += result.confidence;
      } else {
        categoryMap.set(result.category, {
          count: 1,
          confidence: result.confidence
        });
      }
    });

    // 更新分类列表
    const newCategories: BookmarkCategory[] = [];
    categoryMap.forEach((stats, categoryId) => {
      const existing = categories.value.find(c => c.id === categoryId);
      if (existing) {
        newCategories.push(existing);
      } else {
        newCategories.push({
          id: categoryId,
          name: formatCategoryName(categoryId),
          aiGenerated: true,
          confidence: stats.confidence / stats.count,
          bookmarks: []
        });
      }
    });

    categories.value = newCategories;
  }

  /**
   * 格式化分类名称
   */
  function formatCategoryName(categoryId: string): string {
    const nameMap: Record<string, string> = {
      development: '开发工具',
      documentation: '技术文档',
      news: '新闻资讯',
      social: '社交媒体',
      general: '综合'
    };

    return nameMap[categoryId] || categoryId;
  }

  /**
   * 加载缓存的分析结果
   */
  async function loadCachedAnalysis(): Promise<void> {
    try {
      // 注意：已迁移到IndexedDB，AI分析缓存通过IndexedDB管理
    } catch (error) {
      console.warn('加载AI分析缓存失败:', error);
    }
  }

  /**
   * 保存分析结果到缓存
   */
  async function saveCachedAnalysis(): Promise<void> {
    try {
      // 注意：已迁移到IndexedDB，AI分析缓存通过IndexedDB管理
    } catch (error) {
      console.warn('保存AI分析缓存失败:', error);
    }
  }

  /**
   * 生成书签ID
   */
  function generateBookmarkId(): string {
    return `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // === 监听器 ===

  // 监听搜索查询变化
  watch(searchQuery, async (newQuery) => {
    if (newQuery.trim()) {
      await searchBookmarks(newQuery);
    } else {
      searchResults.value = [];
    }
  });

  // 返回公共API
  return {
    // 状态
    bookmarks,
    categories,
    selectedBookmarks,
    isLoading,
    isAnalyzing,
    isSaving,
    lastError,
    searchQuery,
    searchResults,

    // 计算属性
    categorizedBookmarks,
    bookmarkStats,
    filteredBookmarks,

    // 动作
    loadBookmarks,
    analyzeBookmarksWithAI,
    searchBookmarks,
    addBookmark,
    removeBookmark,
    removeSelectedBookmarks,
    toggleBookmarkSelection,
    clearSelection
  };
});
