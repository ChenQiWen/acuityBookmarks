/**
 * 书签健康度计算服务
 *
 * 职责：
 * - 读取 IndexedDB 中的所有书签与爬虫元数据
 * - 预计算两类健康标签（重复、失效）
 *   - 失效书签（invalid）：包含 URL 格式错误 + HTTP 404/500 等失效链接
 *   - 重复书签（duplicate）：URL 完全相同的书签
 * - 将计算结果写回 IndexedDB，供前端页面直接消费
 * - 对外提供调度方法，避免重复触发导致的性能抖动
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { CrawlMetadataRecord } from '@/infrastructure/indexeddb/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 健康标签类型定义，保持与 cleanupStore 中的标签集合一致。
 * 注：失效书签（URL格式错误或404）统一为 'invalid'，不再单独标记 '404'
 */
export type HealthTag = 'duplicate' | 'invalid'

/**
 * 标签优先级顺序，确保写入时恒定排序，便于后续比较与调试。
 */
const HEALTH_TAG_ORDER: HealthTag[] = ['duplicate', 'invalid']

/** 单条书签的健康度评估结果。 */
interface BookmarkHealthEvaluation {
  id: string
  tags: HealthTag[]
  metadata: BookmarkRecord['healthMetadata']
}

/** 内部调度状态，负责合并短时间内的多次请求。 */
const queueState: {
  fullRequested: boolean
  pendingIds: Set<string>
  timer: number | null
  running: boolean
  reasons: Set<string>
} = {
  fullRequested: false,
  pendingIds: new Set<string>(),
  timer: null,
  running: false,
  reasons: new Set<string>()
}

/** 调度延迟（毫秒），避免频繁重复计算。 */
const SCHEDULE_DELAY_MS = 800

/** 每批写入的最大条数，避免 IndexedDB 单次事务过大。 */
const HEALTH_WRITE_BATCH = 200

declare global {
  // 扩展 globalThis，让调试时可以查看健康队列状态
  interface BookmarkHealthQueueState {
    running: boolean
    fullRequested: boolean
    pendingCount: number
    reasons: string[]
  }
}

function updateGlobalQueueState(): void {
  const snapshot = {
    running: queueState.running,
    fullRequested: queueState.fullRequested,
    pendingCount: queueState.pendingIds.size,
    reasons: Array.from(queueState.reasons)
  }

  try {
    ;(
      globalThis as unknown as {
        bookmarkHealthQueue?: BookmarkHealthQueueState
      }
    ).bookmarkHealthQueue = snapshot
  } catch {}
}

/**
 * 请求一次全量健康度重建。
 *
 * @param reason - 触发原因（仅用于日志记录）
 */
export function scheduleFullHealthRebuild(reason = 'unknown'): void {
  queueState.fullRequested = true
  queueState.reasons.add(reason)
  scheduleFlush()
}

/**
 * 请求对指定书签重新评估健康度，当前实现会退化为全量重建。
 *
 * @param ids - 受影响的书签 ID
 * @param reason - 触发原因
 */
export function scheduleHealthRebuildForIds(
  ids: string[],
  reason = 'unknown'
): void {
  ids.forEach(id => queueState.pendingIds.add(id))
  queueState.reasons.add(reason)
  scheduleFlush()
}

/** 启动或续约调度定时器。 */
function scheduleFlush(): void {
  if (queueState.timer !== null) {
    return
  }

  queueState.timer = globalThis.setTimeout(() => {
    queueState.timer = null
    void flushHealthQueue()
  }, SCHEDULE_DELAY_MS) as unknown as number

  updateGlobalQueueState()
}

/**
 * 真正执行健康度重计算的入口。
 * - 若已有任务在运行，则跳过，由正在运行的任务结束后读取最新状态
 */
async function flushHealthQueue(): Promise<void> {
  if (queueState.running) {
    return
  }

  queueState.running = true

  const reasons = Array.from(queueState.reasons)
  const needFull = queueState.fullRequested || queueState.pendingIds.size > 0
  queueState.fullRequested = false
  queueState.pendingIds.clear()
  queueState.reasons.clear()

  updateGlobalQueueState()

  if (!needFull) {
    queueState.running = false
    return
  }

  try {
    logger.info('BookmarkHealth', '开始重新计算健康标签', { reasons })
    await evaluateAllBookmarkHealth()
    logger.info('BookmarkHealth', '健康标签计算完成')
  } catch (error) {
    logger.error('BookmarkHealth', '健康标签计算失败', error)
  } finally {
    queueState.running = false
  }
}

/**
 * 全量评估所有书签的健康度并写回 IndexedDB。
 */
export async function evaluateAllBookmarkHealth(): Promise<void> {
  await indexedDBManager.initialize()

  const startTime = performance.now ? performance.now() : Date.now()
  const bookmarks = await indexedDBManager.getAllBookmarks()
  if (bookmarks.length === 0) {
    return
  }

  const crawlMetadataList = await indexedDBManager.getAllCrawlMetadata()
  const metadataMap = new Map<string, CrawlMetadataRecord>(
    crawlMetadataList.map(item => [item.bookmarkId, item])
  )

  const duplicateInfo = buildDuplicateInfo(bookmarks)

  const evaluations: BookmarkHealthEvaluation[] = bookmarks.map(record =>
    evaluateBookmarkHealth(record, metadataMap.get(record.id), duplicateInfo)
  )

  await persistHealthEvaluations(evaluations)

  const duration =
    (performance.now ? performance.now() : Date.now()) - startTime
  logger.debug('BookmarkHealth', '健康标签写入完成', {
    total: evaluations.length,
    duration: Math.round(duration)
  })
}

/**
 * 将评估结果批量写入 IndexedDB。
 */
async function persistHealthEvaluations(
  evaluations: BookmarkHealthEvaluation[]
): Promise<void> {
  const batches: BookmarkHealthEvaluation[][] = []
  for (let i = 0; i < evaluations.length; i += HEALTH_WRITE_BATCH) {
    batches.push(evaluations.slice(i, i + HEALTH_WRITE_BATCH))
  }

  for (const batch of batches) {
    await indexedDBManager.updateBookmarksHealth(
      batch.map(item => ({
        id: item.id,
        healthTags: item.tags,
        healthMetadata: item.metadata
      }))
    )
  }
}

/**
 * 构建重复书签信息，记录哪些书签属于重复集合。
 */
function buildDuplicateInfo(bookmarks: BookmarkRecord[]): {
  duplicateIds: Set<string>
  canonicalMap: Map<string, string>
} {
  const urlGroups = new Map<string, BookmarkRecord[]>()

  for (const record of bookmarks) {
    if (!record.url) continue
    const key = (record.urlLower ?? record.url).trim().toLowerCase()
    if (!key) continue
    if (!urlGroups.has(key)) {
      urlGroups.set(key, [])
    }
    urlGroups.get(key)!.push(record)
  }

  const duplicateIds = new Set<string>()
  const canonicalMap = new Map<string, string>()

  for (const [, group] of urlGroups) {
    if (group.length <= 1) continue

    group.sort((a, b) =>
      getBookmarkOrderKey(a).localeCompare(getBookmarkOrderKey(b))
    )

    const canonical = group[0]
    for (let i = 1; i < group.length; i += 1) {
      duplicateIds.add(group[i]!.id)
      canonicalMap.set(group[i]!.id, canonical.id)
    }
  }

  return { duplicateIds, canonicalMap }
}

/**
 * 生成书签的排序键，尽量还原 Chrome 树的遍历顺序。
 */
function getBookmarkOrderKey(record: BookmarkRecord): string {
  const pathKey = record.pathIdsString ?? ''
  const indexKey = String(record.index ?? 0).padStart(6, '0')
  return `${pathKey}#${indexKey}`
}

/**
 * 评估单个书签的健康标签。
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

  // ✅ 只对书签进行健康度检查（文件夹不再需要检查）
  if (record.url) {
    // URL格式检测（注：在书签同步时已检测，这里仅作为兜底）
    if (!isValidBookmarkUrl(record.url)) {
      addTag('invalid', 'URL 不符合 http/https 规范')
    }

    // 重复书签检测
    if (duplicateInfo.duplicateIds.has(record.id)) {
      const canonicalId = duplicateInfo.canonicalMap.get(record.id)
      addTag(
        'duplicate',
        canonicalId ? `参考原始书签 ${canonicalId}` : undefined
      )
    }

    // HTTP错误检测（404/500等，统一标记为 invalid）
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
    metadata: tags.length > 0 ? metadataEntries : []
  }
}

/**
 * 判断 URL 是否为有效的 http/https 地址。
 */
function isValidBookmarkUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 判断爬虫元数据是否表示访问失败。
 */
function isHttpFailure(metadata: CrawlMetadataRecord): boolean {
  if (metadata.crawlSuccess === false) return true
  const status = metadata.httpStatus ?? 0
  if (status >= 400) return true
  if (!metadata.statusGroup) return false
  return (
    metadata.statusGroup === '4xx' ||
    metadata.statusGroup === '5xx' ||
    metadata.statusGroup === 'error'
  )
}

/**
 * 生成统一的健康度元数据条目。
 */
function createHealthMetadataEntry(tag: HealthTag, notes?: string) {
  return {
    tag,
    detectedAt: Date.now(),
    source: 'worker' as const,
    notes
  }
}
