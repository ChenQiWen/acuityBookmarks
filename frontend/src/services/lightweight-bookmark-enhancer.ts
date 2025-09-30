/**
 * 轻量级书签内容增强器
 * 只获取 title、description 和基础 meta 信息
 * 与Chrome书签数据完美对应，30天缓存自动更新
 */

import { serverlessCrawlerClient } from './serverless-crawler-client'
import { logger } from '../utils/logger'

// === 精简的数据结构 ===
export interface LightweightBookmarkMetadata {
    // Chrome书签字段对应
    id: string;              // Chrome书签ID
    url: string;             // Chrome书签URL
    title: string;           // Chrome书签标题
    dateAdded?: number;
    dateLastUsed?: number;
    parentId?: string;

    // 爬取增强字段（只保留核心元数据）
    extractedTitle: string;     // 网页实际标题
    description: string;        // meta description
    keywords: string;          // meta keywords - 对LLM分析极有价值 🎯
    ogTitle: string;           // Open Graph标题
    ogDescription: string;     // Open Graph描述  
    ogImage: string;           // Open Graph图片
    ogSiteName: string;        // Open Graph网站名称

    // 缓存管理字段
    lastCrawled: number;       // 最后爬取时间
    crawlSuccess: boolean;     // 爬取是否成功
    expiresAt: number;        // 过期时间（30天后）
    crawlCount: number;       // 爬取次数
    finalUrl: string;         // 最终URL（处理重定向）
    lastModified: string;     // HTTP Last-Modified

    // 爬取状态
    crawlStatus: {
        lastCrawled: number;
        status: 'success' | 'failed';
        crawlDuration?: number;
        version: number;
        source: string;
        finalUrl?: string;
        httpStatus?: number;
        error?: string;
    };
}

// === 缓存配置 ===
const FAILED_RETRY_INTERVAL = 24 * 60 * 60 * 1000; // 失败后24小时重试
const DB_NAME = 'AcuityBookmarks_LightweightCache';
const DB_VERSION = 1;
const STORE_NAME = 'bookmark_metadata';

// === 轻量级书签增强器类 ===
export class LightweightBookmarkEnhancer {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.initPromise = this.initDatabase();
    }

    // === 初始化IndexedDB ===
    private async initDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(new Error('无法打开数据库'));

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('url', 'url', { unique: false });
                    store.createIndex('expiresAt', 'expiresAt', { unique: false });
                }
            };
        });
    }

    // === 确保数据库已初始化 ===
    private async ensureInitialized(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    // === 获取增强的书签数据 ===
    async enhanceBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<LightweightBookmarkMetadata> {
        await this.ensureInitialized();

        // 检查缓存
        if (!bookmark.url) {
            throw new Error(`书签URL为空: ${bookmark.id}`);
        }

        const cached = await this.getCachedMetadata(bookmark.url);
        if (cached && this.isCacheValid(cached)) {
            logger.info('LightweightEnhancer', `📚 使用缓存数据: ${bookmark.url}`);
            return cached;
        }

        // 爬取新数据
        return await this.crawlAndCache(bookmark);
    }

    // === 批量增强书签 ===
    async enhanceBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<LightweightBookmarkMetadata[]> {
        const results: LightweightBookmarkMetadata[] = [];

        // 分批处理，避免过载
        const batchSize = 5;
        for (let i = 0; i < bookmarks.length; i += batchSize) {
            const batch = bookmarks.slice(i, i + batchSize);
            const batchPromises = batch.map(bookmark => this.enhanceBookmark(bookmark));
            const batchResults = await Promise.allSettled(batchPromises);

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    logger.error('LightweightEnhancer', '批量增强失败:', result.reason);
                }
            }

            // 间隔1秒，避免过于频繁
            if (i + batchSize < bookmarks.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    // === 检查缓存是否有效 ===
    private isCacheValid(metadata: LightweightBookmarkMetadata): boolean {
        const now = Date.now();

        // 成功的缓存：检查30天过期
        if (metadata.crawlSuccess) {
            return now < metadata.expiresAt;
        }

        // 失败的缓存：检查24小时重试间隔
        return now < metadata.expiresAt;
    }

    // === 获取缓存的元数据 ===
    private async getCachedMetadata(url: string): Promise<LightweightBookmarkMetadata | null> {
        if (!this.db) return null;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('url');
            const request = index.get(url);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                logger.error('LightweightEnhancer', '获取缓存失败:', request.error);
                resolve(null);
            };
        });
    }

    // === 爬取并缓存数据 ===
    private async crawlAndCache(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<LightweightBookmarkMetadata> {
        const startTime = Date.now();
        logger.info('LightweightEnhancer', `🚀 开始爬取: ${bookmark.url}`);

        try {
            if (!bookmark.url) {
                throw new Error(`书签URL为空: ${bookmark.id}`);
            }

            // 🚀 Step 1: 尝试Serverless爬虫
            let crawlResult: LightweightBookmarkMetadata | null = null;

            try {
                crawlResult = await serverlessCrawlerClient.crawlBookmark(bookmark);
                if (crawlResult) {
                    logger.info('LightweightEnhancer', `✅ Serverless爬取成功: ${bookmark.url} (${Date.now() - startTime}ms)`);
                }
            } catch (serverlessError) {
                logger.warn('LightweightEnhancer', `⚠️ Serverless爬虫失败，尝试本地爬虫: ${bookmark.url}`, serverlessError);
            }

            // 🔄 Step 2: 如果Serverless失败，尝试本地爬虫
            if (!crawlResult) {
                try {
                    crawlResult = await this.tryLocalCrawl(bookmark);
                    if (crawlResult) {
                        logger.info('LightweightEnhancer', `✅ 本地爬取成功: ${bookmark.url} (${Date.now() - startTime}ms)`);
                    }
                } catch (localError) {
                    logger.warn('LightweightEnhancer', `⚠️ 本地爬虫也失败: ${bookmark.url}`, localError);
                }
            }

            // 🎯 Step 3: 如果都失败了，抛出错误
            if (!crawlResult) {
                throw new Error(`所有爬虫方法都失败: ${bookmark.url}`);
            }

            // 保存到缓存
            await this.saveToCacheInternal(crawlResult);
            return crawlResult;

        } catch (error) {
            logger.error('LightweightEnhancer', `❌ 爬取完全失败: ${bookmark.url}`, error);

            // 构建失败的元数据
            const failedMetadata: LightweightBookmarkMetadata = {
                // Chrome字段
                id: bookmark.id,
                url: bookmark.url!,
                title: bookmark.title || '',
                dateAdded: bookmark.dateAdded,
                dateLastUsed: bookmark.dateLastUsed,
                parentId: bookmark.parentId,

                // 空的爬取字段
                extractedTitle: '',
                description: '',
                keywords: '',
                ogTitle: '',
                ogDescription: '',
                ogImage: '',
                ogSiteName: '',

                // 失败的缓存字段
                lastCrawled: Date.now(),
                crawlSuccess: false,
                expiresAt: Date.now() + FAILED_RETRY_INTERVAL, // 24小时后重试
                crawlCount: 1,
                finalUrl: bookmark.url!,
                lastModified: '',

                // 失败状态
                crawlStatus: {
                    lastCrawled: Date.now(),
                    status: 'failed',
                    crawlDuration: Date.now() - startTime,
                    version: 2,
                    source: 'lightweight-enhancer',
                    error: error instanceof Error ? error.message : String(error)
                }
            };

            // 保存失败记录到缓存
            await this.saveToCacheInternal(failedMetadata);

            return failedMetadata;
        }
    }

    /**
     * 🔄 本地爬虫备选方案 (当Serverless爬虫失败时使用)
     */
    private async tryLocalCrawl(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<LightweightBookmarkMetadata | null> {
        if (!bookmark.url) {
            throw new Error('书签URL为空');
        }

        try {
            logger.info('LocalCrawler', `🔍 开始本地爬取: ${bookmark.url}`);

            // 1. 获取网页内容
            const { html } = await this.fetchPageContent(bookmark.url);

            // 2. 解析轻量级元数据
            const metadata = await this.extractLightweightMetadata(html, bookmark.url);

            // 3. 构建完整的元数据对象
            const result: LightweightBookmarkMetadata = {
                // Chrome字段
                id: bookmark.id,
                url: bookmark.url,
                title: bookmark.title || '',
                dateAdded: bookmark.dateAdded,
                dateLastUsed: bookmark.dateLastUsed,
                parentId: bookmark.parentId,

                // 爬取字段
                extractedTitle: metadata.extractedTitle,
                description: metadata.description,
                keywords: metadata.keywords,
                ogTitle: metadata.ogTitle,
                ogDescription: metadata.ogDescription,
                ogImage: metadata.ogImage,
                ogSiteName: metadata.ogSiteName,

                // 缓存字段
                lastCrawled: Date.now(),
                crawlSuccess: true,
                expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30天
                crawlCount: 1,
                finalUrl: metadata.finalUrl,
                lastModified: metadata.lastModified,

                // 状态字段
                crawlStatus: {
                    lastCrawled: Date.now(),
                    status: 'success',
                    crawlDuration: 0,
                    version: 2,
                    source: 'local-crawler',
                    finalUrl: metadata.finalUrl,
                    httpStatus: 200
                }
            };

            logger.info('LocalCrawler', `✅ 本地爬取成功: ${bookmark.url}`);
            return result;

        } catch (error) {
            logger.error('LocalCrawler', `❌ 本地爬取失败: ${bookmark.url}`, error);
            return null;
        }
    }

    /**
     * 🌐 获取网页内容 (Chrome扩展环境) - ⚠️ 受CORS限制
     */
    private async fetchPageContent(url: string): Promise<{ html: string, headers: Headers }> {
        // ⚠️ 注意：Chrome扩展中的fetch受CORS限制
        // 很多网站会阻止跨域请求，这就是为什么需要后端爬虫的原因

        // 🎭 使用更真实的浏览器User-Agent
        const realUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': realUserAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                },
                mode: 'no-cors', // 使用no-cors模式避免CORS错误，但内容可能受限
                cache: 'no-cache'
            });

            // no-cors模式下response.ok始终为true，需要特殊处理
            const html = await response.text();

            // 检查是否获得了有效内容
            if (!html || html.length < 50) {
                throw new Error(`获取的内容太少或为空 (${html.length} 字符)`);
            }

            return { html, headers: response.headers };

        } catch (error) {
            // 如果no-cors也失败，尝试cors模式
            logger.warn('LocalCrawler', `⚠️ no-cors模式失败，尝试cors模式: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': realUserAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache'
                },
                mode: 'cors',
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            return { html, headers: response.headers };
        }
    }

    /**
     * 📊 解析轻量级元数据 (HTML解析)
     */
    private async extractLightweightMetadata(html: string, url: string): Promise<{
        extractedTitle: string;
        description: string;
        keywords: string;
        ogTitle: string;
        ogDescription: string;
        ogImage: string;
        ogSiteName: string;
        finalUrl: string;
        lastModified: string;
    }> {
        // 创建临时DOM来解析HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 提取title
        const titleElement = doc.querySelector('title');
        const extractedTitle = titleElement?.textContent?.trim() || '';

        // 提取meta description
        const descriptionMeta = doc.querySelector('meta[name="description"]') as HTMLMetaElement;
        const description = descriptionMeta?.content?.trim() || '';

        // 🎯 提取meta keywords - 对LLM分析极有价值
        const keywordsMeta = doc.querySelector('meta[name="keywords"]') as HTMLMetaElement;
        const keywords = keywordsMeta?.content?.trim() || '';

        // 提取OpenGraph数据
        const ogTitleMeta = doc.querySelector('meta[property="og:title"]') as HTMLMetaElement;
        const ogTitle = ogTitleMeta?.content?.trim() || '';

        const ogDescriptionMeta = doc.querySelector('meta[property="og:description"]') as HTMLMetaElement;
        const ogDescription = ogDescriptionMeta?.content?.trim() || '';

        const ogImageMeta = doc.querySelector('meta[property="og:image"]') as HTMLMetaElement;
        const ogImage = ogImageMeta?.content?.trim() || '';

        // 🆕 提取OpenGraph网站名称
        const ogSiteNameMeta = doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement;
        const ogSiteName = ogSiteNameMeta?.content?.trim() || '';

        return {
            extractedTitle,
            description,
            keywords,
            ogTitle,
            ogDescription,
            ogImage,
            ogSiteName,
            finalUrl: url, // 简化版本，不处理重定向
            lastModified: new Date().toISOString()
        };
    }

    // === 保存到缓存（公共方法，支持URL去重） ===
    async saveToCache(metadata: LightweightBookmarkMetadata): Promise<void> {
        return this.saveToCacheInternal(metadata);
    }

    // === 保存到缓存 ===
    private async saveToCacheInternal(metadata: LightweightBookmarkMetadata): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(metadata);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // === 清理过期缓存 ===
    async cleanExpiredCache(): Promise<void> {
        await this.ensureInitialized();
        if (!this.db) return;

        const now = Date.now();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('expiresAt');

            // 获取所有过期的记录
            const range = IDBKeyRange.upperBound(now);
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete(); // 删除过期记录
                    cursor.continue();
                } else {
                    logger.info('LightweightEnhancer', '🧹 过期缓存清理完成');
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // === 获取缓存统计 ===
    async getCacheStats(): Promise<{ total: number, expired: number, successful: number, failed: number }> {
        await this.ensureInitialized();
        if (!this.db) return { total: 0, expired: 0, successful: 0, failed: 0 };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result as LightweightBookmarkMetadata[];
                const now = Date.now();

                const stats = {
                    total: results.length,
                    expired: results.filter(r => r.expiresAt < now).length,
                    successful: results.filter(r => r.crawlSuccess).length,
                    failed: results.filter(r => !r.crawlSuccess).length
                };

                resolve(stats);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // === 强制重新爬取书签 ===
    async forceRefreshBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<LightweightBookmarkMetadata> {
        await this.ensureInitialized();

        if (!bookmark.url) {
            throw new Error(`书签URL为空: ${bookmark.id}`);
        }

        // 删除现有缓存
        if (this.db) {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('url');

            return new Promise((resolve, reject) => {
                const deleteRequest = index.getKey(bookmark.url!);
                deleteRequest.onsuccess = () => {
                    if (deleteRequest.result) {
                        store.delete(deleteRequest.result);
                    }

                    // 重新爬取
                    this.crawlAndCache(bookmark)
                        .then(result => resolve(result))
                        .catch(error => reject(error));
                };

                deleteRequest.onerror = () => reject(deleteRequest.error);
            });
        }

        // 如果数据库不可用，直接爬取
        return await this.crawlAndCache(bookmark);
    }
}

// === 导出单例实例 ===
export const lightweightBookmarkEnhancer = new LightweightBookmarkEnhancer();
