/**
 * 现代化书签服务 - 基于Chrome Bookmarks API最新特性
 * 
 * 新特性：
 * - Chrome 114+ dateLastUsed 使用频率跟踪
 * - Chrome 134+ folderType 文件夹类型识别
 * - 实时事件同步
 * - 混合搜索策略
 * - 智能推荐系统
 */
import { logger } from '../utils/logger'
import { AB_EVENTS } from '@/constants/events'
import { searchAppService } from '@/application/search/search-app-service'

export interface ModernBookmarkNode extends chrome.bookmarks.BookmarkTreeNode {
    dateLastUsed?: number; // Chrome 114+
    folderType?: 'bookmarks-bar' | 'other' | 'mobile' | 'managed'; // Chrome 134+
    usageScore?: number; // 自定义：使用频率评分
    recommendationScore?: number; // 自定义：推荐评分
    domain?: string; // 预计算域名，减少运行时解析
}

export interface BookmarkSearchOptions {
    query: string;
    maxResults?: number;
    includeUsageData?: boolean;
    sortBy?: 'relevance' | 'recent' | 'usage' | 'created';
    folderTypes?: string[];
}

export interface BookmarkRecommendationContext {
    currentUrl?: string;
    currentDomain?: string;
    timeOfDay?: number;
    dayOfWeek?: number;
}

/**
 * 现代化书签服务类
 */
export class ModernBookmarkService {
    private static instance: ModernBookmarkService | null = null;
    private eventListenersSetup = false;
    private bookmarkCache = new Map<string, ModernBookmarkNode>();

    private constructor() {
        this.setupEventListeners();
        this.setupBackgroundMessageListener();
    }

    static getInstance(): ModernBookmarkService {
        if (!ModernBookmarkService.instance) {
            ModernBookmarkService.instance = new ModernBookmarkService();
        }
        return ModernBookmarkService.instance;
    }

    /**
     * 设置实时事件监听器
     */
    private setupEventListeners() {
        // 在非扩展环境（如本地预览）时，chrome 可能存在但不包含 bookmarks API
        if (this.eventListenersSetup || typeof chrome === 'undefined' || !chrome.bookmarks) return;

        logger.info('🔄 设置书签实时同步监听器...');

        // 监听书签创建
        chrome.bookmarks.onCreated.addListener((id, bookmark) => {
            logger.info('📝 书签已创建:', bookmark.title);
            this.invalidateCache();
            this.notifyBookmarkChange('created', id, bookmark);
        });

        // 监听书签删除  
        chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
            logger.info('🗑️ 书签已删除:', id);
            this.bookmarkCache.delete(id);
            this.notifyBookmarkChange('removed', id, removeInfo);
        });

        // 监听书签修改
        chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
            logger.info('✏️ 书签已修改:', changeInfo.title);
            this.invalidateCache();
            this.notifyBookmarkChange('changed', id, changeInfo);
        });

        // 监听书签移动
        chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
            logger.info('📁 书签已移动:', id);
            this.invalidateCache();
            this.notifyBookmarkChange('moved', id, moveInfo);
        });

        // 监听导入事件
        chrome.bookmarks.onImportBegan.addListener(() => {
            logger.info('📥 书签导入开始...');
        });

        chrome.bookmarks.onImportEnded.addListener(() => {
            logger.info('✅ 书签导入完成');
            this.invalidateCache();
        });

        this.eventListenersSetup = true;
    }

    /**
     * 设置Background消息监听器 - Phase 1前端同步
     */
    private setupBackgroundMessageListener() {
        if (typeof chrome === 'undefined' || !chrome.runtime) return;

        logger.info('🔗 [前端] 设置Background消息监听器...');

        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'BOOKMARK_UPDATED') {
                this.handleBackgroundBookmarkUpdate(message);
            }
            // 不需要响应，所以不调用sendResponse
        });

        logger.info('✅ [前端] Background消息监听器设置完成');
    }

    /**
     * 处理来自Background的书签更新通知
     */
    private handleBackgroundBookmarkUpdate(message: any) {
        try {
            logger.info(`🔄 [前端] 收到书签 ${message.eventType} 通知:`, {
                id: message.id,
                timestamp: message.timestamp
            });

            // Phase 1: 简单的缓存失效
            this.invalidateCache();

            // 可以在这里发送自定义事件，通知UI更新
            this.notifyUIBookmarkUpdate(message.eventType, message.id, message.data);

        } catch (error) {
            logger.error('❌ [前端] 处理Background书签更新失败:', error);
        }
    }

    /**
     * 通知UI书签更新（可扩展为自定义事件系统）
     */
    private notifyUIBookmarkUpdate(eventType: string, id: string, data: any) {
        try {
            // 创建自定义事件，让UI组件可以监听
            const event = new CustomEvent(AB_EVENTS.BOOKMARK_UPDATED, {
                detail: {
                    eventType,
                    id,
                    data,
                    timestamp: Date.now()
                }
            });

            window.dispatchEvent(event);
            logger.info(`📡 [前端] 已派发 ${eventType} UI更新事件`);
        } catch (error) {
            logger.warn('⚠️ [前端] 派发UI事件失败:', error);
        }
    }

    /**
     * 获取增强的书签树 - 使用现代API
     */
    async getEnhancedBookmarkTree(): Promise<ModernBookmarkNode[]> {
        try {
            // 使用现代Promise API替代回调
            const tree = await chrome.bookmarks.getTree();
            return this.enhanceBookmarkNodes(tree);
        } catch (error) {
            logger.error('❌ 获取书签树失败:', error);
            throw new Error(`获取书签树失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 增强书签节点 - 添加现代特性
     */
    private enhanceBookmarkNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]): ModernBookmarkNode[] {
        return nodes.map(node => {
            const enhanced: ModernBookmarkNode = {
                ...node,
                usageScore: this.calculateUsageScore(node),
                recommendationScore: 0 // 稍后计算
            };

            // 预计算域名（仅书签节点）
            if (node.url) {
                try { enhanced.domain = new URL(node.url).hostname.toLowerCase() } catch {}
            }

            // 增强文件夹类型识别（Chrome 134+兼容）
            if (!node.url && !enhanced.folderType) {
                enhanced.folderType = this.determineFolderType(node);
            }

            // 递归处理子节点
            if (node.children) {
                enhanced.children = this.enhanceBookmarkNodes(node.children);
            }

            return enhanced;
        });
    }

    /**
     * 确定文件夹类型（向后兼容）
     */
    private determineFolderType(node: chrome.bookmarks.BookmarkTreeNode): 'bookmarks-bar' | 'other' | 'mobile' | 'managed' {
        // Chrome 134+ 原生支持
        if ('folderType' in node && node.folderType) {
            return node.folderType as 'bookmarks-bar' | 'other' | 'mobile' | 'managed';
        }

        // 向后兼容的fallback
        switch (node.id) {
            case '1': return 'bookmarks-bar';
            case '2': return 'other';
            case '3': return 'mobile';
            default:
                if (node.title?.includes('管理') || node.title?.includes('Managed')) {
                    return 'managed';
                }
                return 'other';
        }
    }

    /**
     * 计算使用频率评分
     */
    private calculateUsageScore(node: chrome.bookmarks.BookmarkTreeNode): number {
        if (!node.url) return 0; // 文件夹没有使用频率

        let score = 0;

        // 基于最后使用时间（Chrome 114+）
        const dateLastUsed = (node as any).dateLastUsed;
        if (dateLastUsed) {
            const daysSinceLastUsed = (Date.now() - dateLastUsed) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 100 - daysSinceLastUsed * 2);
        }

        // 基于创建时间
        if (node.dateAdded) {
            const daysSinceCreated = (Date.now() - node.dateAdded) / (1000 * 60 * 60 * 24);
            if (daysSinceCreated < 7) score += 30; // 最近创建的书签
        }

        return score;
    }

    /**
     * 获取最近书签 - 使用原生API
     */
    async getRecentBookmarks(count: number = 10): Promise<ModernBookmarkNode[]> {
        try {
            const recent = await chrome.bookmarks.getRecent(count);
            return this.enhanceBookmarkNodes(recent);
        } catch (error) {
            logger.error('❌ 获取最近书签失败:', error);
            throw new Error(`获取最近书签失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 混合搜索策略 - 结合原生API和自定义逻辑
     */
    /**
     * @deprecated 请使用应用层 searchAppService.search(query, { strategy: 'hybrid' })
     * 该方法将逐步移除，现保留仅作为过渡。
     */
    async hybridSearch(options: BookmarkSearchOptions): Promise<ModernBookmarkNode[]> {
        const startTime = performance.now();

        try {
            // 1. 使用Chrome原生搜索（快速、准确）
            const nativeResults = await chrome.bookmarks.search(options.query);

            // 2. 增强搜索结果
            let enhancedResults = this.enhanceBookmarkNodes(nativeResults);

            // 3. 过滤文件夹类型
            if (options.folderTypes && options.folderTypes.length > 0) {
                enhancedResults = enhancedResults.filter(node => {
                    if (node.url) return true; // 书签不受文件夹类型限制
                    return options.folderTypes!.includes(node.folderType || 'other');
                });
            }

            // 4. 排序
            this.sortSearchResults(enhancedResults, options.sortBy || 'relevance');

            // 5. 限制结果数量
            const results = enhancedResults.slice(0, options.maxResults || 50);

            const duration = performance.now() - startTime;
            logger.info(`🔍 混合搜索完成: ${results.length}个结果，耗时${duration.toFixed(2)}ms`);

            return results;
        } catch (error) {
            logger.error('❌ 混合搜索失败:', error);
            throw new Error(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 智能推荐系统
     */
    async getSmartRecommendations(
        context: BookmarkRecommendationContext = {},
        maxResults: number = 5
    ): Promise<ModernBookmarkNode[]> {
        try {
            const tree = await this.getEnhancedBookmarkTree();
            const flatBookmarks = this.flattenBookmarkTree(tree).filter(node => node.url);

            // 计算推荐评分
            const recommendations = flatBookmarks.map(bookmark => ({
                ...bookmark,
                recommendationScore: this.calculateRecommendationScore(bookmark, context)
            }));

            // 按评分排序并返回top结果
            return recommendations
                .sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
                .slice(0, maxResults);
        } catch (error) {
            logger.error('❌ 获取智能推荐失败:', error);
            return [];
        }
    }

    /**
     * 计算推荐评分
     */
    private calculateRecommendationScore(
        bookmark: ModernBookmarkNode,
        context: BookmarkRecommendationContext
    ): number {
        let score = bookmark.usageScore || 0;

        // 域名匹配加分
        if (context.currentDomain) {
            const bDomain = (bookmark as any).domain || ((): string | null => { try { return new URL(bookmark.url || '').hostname.toLowerCase() } catch { return null } })()
            if (bDomain) {
                if (bDomain === context.currentDomain) {
                    score += 50;
                } else if (bDomain.includes(context.currentDomain) || context.currentDomain.includes(bDomain)) {
                    score += 25;
                }
            }
        }

        // TODO: 时间相关性加权
        // 可以基于历史使用模式进行时间加权
        // 例如：如果用户通常在工作时间访问某些书签，给这些书签在工作时间更高的分数

        return score;
    }

    /**
     * 排序搜索结果
     */
    private sortSearchResults(results: ModernBookmarkNode[], sortBy: string) {
        switch (sortBy) {
            case 'recent':
                results.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                break;
            case 'usage':
                results.sort((a, b) => (b.usageScore || 0) - (a.usageScore || 0));
                break;
            case 'created':
                results.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                break;
            case 'relevance':
            default:
                // 综合评分：标题匹配度 + 使用频率
                // Chrome原生搜索已经按相关性排序，我们在此基础上微调
                break;
        }
    }

    /**
     * 扁平化书签树
     */
    private flattenBookmarkTree(nodes: ModernBookmarkNode[]): ModernBookmarkNode[] {
        const flattened: ModernBookmarkNode[] = [];

        function traverse(nodeArray: ModernBookmarkNode[]) {
            for (const node of nodeArray) {
                flattened.push(node);
                if (node.children) {
                    traverse(node.children);
                }
            }
        }

        traverse(nodes);
        return flattened;
    }

    /**
     * 缓存失效
     */
    private invalidateCache() {
        this.bookmarkCache.clear();
        // 可以在这里添加缓存失效的时间记录
    }

    /**
     * 通知书签变更（可扩展为事件系统）
     */
    private notifyBookmarkChange(type: string, id: string, data: any) {
        // 可以在这里发送自定义事件，通知UI更新
        logger.info(`📢 书签变更通知: ${type}`, { id, data });

        // 示例：发送到IndexedDB进行同步
        // this.syncToIndexedDB(type, id, data);
    }
}

// 导出单例实例
export const modernBookmarkService = ModernBookmarkService.getInstance();

// 导出便捷函数
export async function getRecentBookmarks(count?: number) {
    return modernBookmarkService.getRecentBookmarks(count);
}

export async function searchBookmarks(options: BookmarkSearchOptions) {
    // 统一代理到应用层搜索服务，采用 hybrid 策略，保证与全局一致
    const limit = options.maxResults ?? 50
    const results = await searchAppService.search(options.query, { strategy: 'hybrid', limit })
    // 将 SearchResult[] 映射为 ModernBookmarkNode[]（最小字段集）
    return results.map(r => ({
        id: r.bookmark.id,
        title: r.bookmark.title,
        url: r.bookmark.url,
        parentId: r.bookmark.parentId,
        dateAdded: r.bookmark.dateAdded,
        // 兼容字段
        dateLastUsed: (r.bookmark as any).dateLastUsed,
        // 预计算域名（若存在）
        domain: r.bookmark.domain,
    } as ModernBookmarkNode))
}

export async function getBookmarkRecommendations(context?: BookmarkRecommendationContext) {
    return modernBookmarkService.getSmartRecommendations(context);
}
