/**
 * 书签健康度扫描 Worker
 *
 * 职责：
 * - 在后台线程中执行健康度评估
 * - 避免阻塞主线程（UI 响应）
 * - 支持进度报告
 * - 支持取消操作
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Worker
 */

import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import type { CrawlMetadataRecord } from '@/infrastructure/indexeddb/types'

/** 健康标签类型 */
type HealthTag = 'duplicate' | 'invalid' | 'internal'

/** 标签优先级顺序 */
const HEALTH_TAG_ORDER: HealthTag[] = ['duplicate', 'invalid', 'internal']

/** 单条书签的健康度评估结果 */
interface BookmarkHealthEvaluation {
  id: string
  tags: HealthTag[]
  metadata: BookmarkRecord['healthMetadata']
}

/** Worker 接收的消息类型 */
interface WorkerInputMessage {
  type: 'scan' | 'cancel'
  data?: {
    bookmarks: BookmarkRecord[]
    crawlMetadata: CrawlMetadataRecord[]
  }
}

/** Worker 发送的消息类型 */
interface WorkerOutputMessage {
  /** 消息类型 */
  type: 'progress' | 'completed' | 'error' | 'cancelled'
  data?: {
    /** 当前进度 */
    current?: number
    /** 总进度 */
    total?: number
    /** 进度百分比 */
    percentage?: number
    /** 消息 */
    message?: string
    /** 结果 */
    results?: BookmarkHealthEvaluation[]
    /** 错误信息 */
    error?: string
  }
}

/** 是否已取消扫描 */
let isCancelled = false

/**
 * Worker 消息处理
 */
self.onmessage = async (e: MessageEvent<WorkerInputMessage>) => {
  const { type, data } = e.data

  if (type === 'cancel') {
    isCancelled = true
    postMessage({ type: 'cancelled' } satisfies WorkerOutputMessage)
    return
  }

  if (type === 'scan' && data) {
    isCancelled = false

    try {
      await performHealthScan(data.bookmarks, data.crawlMetadata)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      postMessage({
        type: 'error',
        data: { error: errorMessage }
      } satisfies WorkerOutputMessage)
    }
  }
}

/**
 * 执行健康度扫描
 */
async function performHealthScan(
  bookmarks: BookmarkRecord[],
  crawlMetadataList: CrawlMetadataRecord[]
): Promise<void> {
  const total = bookmarks.length

  if (total === 0) {
    postMessage({
      type: 'completed',
      data: { results: [] }
    } satisfies WorkerOutputMessage)
    return
  }

  // 构建元数据 Map
  const metadataMap = new Map<string, CrawlMetadataRecord>(
    crawlMetadataList.map(item => [item.bookmarkId, item])
  )

  // 构建重复信息
  const duplicateInfo = buildDuplicateInfo(bookmarks)

  // 评估每个书签
  const evaluations: BookmarkHealthEvaluation[] = []
  const PROGRESS_INTERVAL = 100 // 每 100 个节点报告一次进度

  for (let i = 0; i < total; i++) {
    // 检查是否已取消
    if (isCancelled) {
      postMessage({ type: 'cancelled' } satisfies WorkerOutputMessage)
      return
    }

    const bookmark = bookmarks[i]!
    const metadata = metadataMap.get(bookmark.id)
    const evaluation = evaluateBookmarkHealth(bookmark, metadata, duplicateInfo)
    evaluations.push(evaluation)

    // 报告进度
    if ((i + 1) % PROGRESS_INTERVAL === 0 || i === total - 1) {
      const current = i + 1
      const percentage = (current / total) * 100

      postMessage({
        type: 'progress',
        data: {
          current,
          total,
          percentage,
          message: `正在扫描... ${current}/${total}`
        }
      } satisfies WorkerOutputMessage)
    }
  }

  // 完成
  postMessage({
    type: 'completed',
    data: { results: evaluations }
  } satisfies WorkerOutputMessage)
}

/**
 * 构建重复书签信息
 */
function buildDuplicateInfo(bookmarks: BookmarkRecord[]): {
  duplicateIds: Set<string>
  canonicalMap: Map<string, string>
} {
  const urlGroups = new Map<string, BookmarkRecord[]>()

  for (const record of bookmarks) {
    if (record.isFolder || !record.url) continue

    const normalizedUrl = normalizeUrl(record.url)
    if (!normalizedUrl) continue

    if (!urlGroups.has(normalizedUrl)) {
      urlGroups.set(normalizedUrl, [])
    }
    urlGroups.get(normalizedUrl)!.push(record)
  }

  const duplicateIds = new Set<string>()
  const canonicalMap = new Map<string, string>()

  for (const group of urlGroups.values()) {
    if (group.length <= 1) continue

    // 按 dateAdded 排序，最早的作为原始书签
    group.sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0))

    const canonicalId = group[0]!.id
    for (let i = 1; i < group.length; i++) {
      const duplicateId = group[i]!.id
      duplicateIds.add(duplicateId)
      canonicalMap.set(duplicateId, canonicalId)
    }
  }

  return { duplicateIds, canonicalMap }
}

/**
 * 评估单个书签的健康度
 */
function evaluateBookmarkHealth(
  record: BookmarkRecord,
  metadata: CrawlMetadataRecord | undefined,
  duplicateInfo: {
    duplicateIds: Set<string>
    canonicalMap: Map<string, string>
  }
): BookmarkHealthEvaluation {
  const tagSet = new Set<HealthTag>()

  const existingMetadata = Array.isArray(record.healthMetadata)
    ? record.healthMetadata.filter(entry => entry && entry.source !== 'worker')
    : []

  const metadataEntries: BookmarkRecord['healthMetadata'] = [
    ...existingMetadata
  ]

  const addTag = (tag: HealthTag, notes?: string) => {
    tagSet.add(tag)
    metadataEntries.push(createHealthMetadataEntry(tag, notes))
  }

  // 只对书签进行健康度检查（文件夹不需要）
  if (record.url) {
    // 1. 检查是否为浏览器内部协议
    if (isInternalProtocol(record.url)) {
      addTag('internal', '浏览器内部链接，仅限本浏览器访问')
    }
    // 2. 检查 URL 格式是否有效（排除内部协议）
    else if (!isValidBookmarkUrl(record.url)) {
      addTag('invalid', 'URL 不符合 http/https 规范')
    }

    // 3. 检查是否为重复书签
    if (duplicateInfo.duplicateIds.has(record.id)) {
      const canonicalId = duplicateInfo.canonicalMap.get(record.id)
      addTag(
        'duplicate',
        canonicalId ? `参考原始书签 ${canonicalId}` : undefined
      )
    }

    // 4. HTTP 失败（404 等）标记为 invalid（仅对 http/https 协议）
    if (metadata && isHttpFailure(metadata)) {
      const status = metadata.httpStatus ?? '未知'
      addTag('invalid', `HTTP 状态码 ${status}`)
    }
  }

  const tags = Array.from(tagSet).sort(
    (a, b) => HEALTH_TAG_ORDER.indexOf(a) - HEALTH_TAG_ORDER.indexOf(b)
  )

  return {
    id: record.id,
    tags,
    metadata: metadataEntries
  }
}

/**
 * 创建健康度元数据条目
 */
function createHealthMetadataEntry(
  tag: HealthTag,
  notes?: string
): NonNullable<BookmarkRecord['healthMetadata']>[number] {
  return {
    tag,
    detectedAt: Date.now(),
    source: 'worker' as const,
    notes: notes ?? undefined
  }
}

/**
 * 规范化 URL
 * 
 * 移除尾部斜杠、查询参数、片段标识符
 */
function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const normalized =
      `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
    return normalized.toLowerCase()
  } catch {
    return null
  }
}

/**
 * 判断是否为浏览器内部协议
 * 
 * 包括：
 * - chrome:// - Chrome 内部页面
 * - chrome-extension:// - 扩展程序页面
 * - about: - 浏览器关于页面
 * - file:// - 本地文件系统
 * - edge:// - Edge 浏览器内部页面
 * - brave:// - Brave 浏览器内部页面
 */
function isInternalProtocol(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  
  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.startsWith('chrome://') ||
    lowerUrl.startsWith('chrome-extension://') ||
    lowerUrl.startsWith('about:') ||
    lowerUrl.startsWith('file://') ||
    lowerUrl.startsWith('edge://') ||
    lowerUrl.startsWith('brave://')
  )
}

/**
 * 判断 URL 是否有效
 */
function isValidBookmarkUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * 判断是否为 HTTP 失败
 */
function isHttpFailure(metadata: CrawlMetadataRecord): boolean {
  const status = metadata.httpStatus
  if (!status) return false
  return status >= 400 && status < 600
}
