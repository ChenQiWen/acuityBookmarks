import { z } from 'zod'

export const BookmarkRecordSchema = z.object({
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
  lastCalculated: z.number()
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
