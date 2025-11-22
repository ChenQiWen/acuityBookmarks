import { z } from 'zod'

/**
 * 数据迁移：清理旧的健康标签
 *
 * @description
 * 旧版本可能包含 'empty' 和 '404' 标签，需要清理或转换：
 * - 'empty' → 删除（已废弃）
 * - '404' → 转换为 'invalid'（已合并）
 */
function migrateHealthTags(tags: string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return tags

  return tags
    .filter(tag => tag !== 'empty') // 移除 'empty' 标签
    .map(tag => (tag === '404' ? 'invalid' : tag)) // '404' 转换为 'invalid'
}

/**
 * 数据迁移：清理旧的健康元数据
 */
function migrateHealthMetadata(
  metadata:
    | Array<{
        tag: string
        detectedAt: number
        source: string
        notes?: string
      }>
    | undefined
):
  | Array<{
      tag: 'duplicate' | 'invalid'
      detectedAt: number
      source: 'worker' | 'user' | 'imported'
      notes?: string
    }>
  | undefined {
  if (!metadata || metadata.length === 0) return undefined

  return metadata
    .filter(m => m.tag !== 'empty') // 移除 'empty' 元数据
    .map(m => ({
      ...m,
      tag:
        m.tag === '404'
          ? ('invalid' as const)
          : (m.tag as 'duplicate' | 'invalid'),
      source: m.source as 'worker' | 'user' | 'imported'
    }))
}

export const BookmarkRecordSchema = z
  .object({
    id: z.string(),
    parentId: z.string().optional(),
    title: z.string(),
    url: z.string().optional(),
    dateAdded: z.number().optional(),
    dateGroupModified: z.number().optional(),
    index: z.number(),
    path: z.array(z.string()),
    pathString: z.string(),
    pathIds: z.array(z.string()),
    pathIdsString: z.string(),
    ancestorIds: z.array(z.string()),
    siblingIds: z.array(z.string()),
    depth: z.number(),
    titleLower: z.string(),
    urlLower: z.string().optional(),
    domain: z.string().optional(),
    keywords: z.array(z.string()),
    isFolder: z.boolean(),
    childrenCount: z.number(),
    bookmarksCount: z.number(),
    folderCount: z.number(),
    tags: z.array(z.string()),
    healthTags: z.array(z.string()).optional(),
    healthMetadata: z
      .array(
        z.object({
          tag: z.string(), // 先接受任意字符串
          detectedAt: z.number(),
          source: z.string(), // 先接受任意字符串
          notes: z.string().optional()
        })
      )
      .optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
    lastVisited: z.number().optional(),
    visitCount: z.number().optional(),
    createdYear: z.number(),
    createdMonth: z.number(),
    domainCategory: z.string().optional(),
    hasMetadata: z.boolean().optional(),
    metadataUpdatedAt: z.number().optional(),
    metadataSource: z.enum(['chrome', 'crawler', 'merged']).optional(),
    metaTitleLower: z.string().optional(),
    metaDescriptionLower: z.string().optional(),
    metaKeywordsTokens: z.array(z.string()).optional(),
    metaBoost: z.number().optional(),
    flatIndex: z.number().optional(),
    isVisible: z.boolean().optional(),
    sortKey: z.string().optional(),
    dataVersion: z.number(),
    lastCalculated: z.number(),
    // 新增字段（向后兼容）
    isInvalid: z.boolean().optional(),
    invalidReason: z.enum(['url_format', 'http_error', 'unknown']).optional(),
    httpStatus: z.number().optional(),
    isDuplicate: z.boolean().optional(),
    duplicateOf: z.string().optional()
  })
  .transform((data): typeof data => {
    // ✅ 数据迁移：清理旧的健康标签
    return {
      ...data,
      healthTags: migrateHealthTags(data.healthTags),
      healthMetadata: migrateHealthMetadata(
        data.healthMetadata as
          | Array<{
              tag: string
              detectedAt: number
              source: string
              notes?: string
            }>
          | undefined
      )
    }
  })

export const BookmarkRecordArraySchema = z.array(BookmarkRecordSchema)

export const BookmarkSearchOptionsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().nonnegative().optional(),
  includeDomain: z.boolean().optional(),
  includeUrl: z.boolean().optional(),
  includeKeywords: z.boolean().optional(),
  includeTags: z.boolean().optional(),
  includeContent: z.boolean().optional(),
  minScore: z.number().nonnegative().optional(),
  sortBy: z.enum(['relevance', 'title', 'dateAdded', 'visitCount']).optional(),
  exactMatch: z.boolean().optional(),
  fuzzyMatch: z.boolean().optional()
})

export const BookmarkSearchResultSchema = z.object({
  id: z.string(),
  score: z.number(),
  bookmark: BookmarkRecordSchema,
  highlights: z
    .array(
      z.object({
        field: z.string(),
        matchedText: z.string()
      })
    )
    .optional()
})

export const BookmarkSearchResultArraySchema = z.array(
  BookmarkSearchResultSchema
)
