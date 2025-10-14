<!--
智能书签推荐组件
基于Chrome Bookmarks API最新特性的智能推荐系统
-->
<template>
  <div v-if="recommendations.length > 0" class="smart-recommendations">
    <!-- 标题栏 -->
    <div class="recommendations-header">
      <div class="header-content">
        <Icon name="mdi-lightbulb-on" class="recommendation-icon" />
        <h3 class="recommendations-title">为您推荐</h3>
        <Badge variant="soft" size="sm">
          {{ recommendations.length }}
        </Badge>
      </div>
      <div class="header-actions">
        <Button
          variant="ghost"
          size="sm"
          :loading="isTesting"
          class="test-button"
          title="测试轻量级爬虫"
          @click="testCrawler"
        >
          <Icon name="mdi-spider" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          :loading="isRefreshing"
          class="refresh-button"
          @click="refreshRecommendations"
        >
          <Icon name="mdi-refresh" />
        </Button>
      </div>
    </div>

    <!-- 推荐列表 -->
    <div class="recommendations-list">
      <div
        v-for="bookmark in recommendations"
        :key="bookmark.id"
        class="recommendation-item"
        @click="openBookmark(bookmark, $event)"
        @contextmenu.prevent="showContextMenu(bookmark)"
      >
        <!-- 书签图标 -->
        <div class="bookmark-favicon">
          <img
            :src="getFaviconUrl(bookmark.url!)"
            :alt="bookmark.title"
            class="favicon-image"
            :class="{ 'favicon-loading': !faviconLoaded[bookmark.id] }"
            @error="handleFaviconError($event, bookmark.url!)"
            @load="handleFaviconLoad"
          />
          <div v-if="faviconError[bookmark.id]" class="favicon-fallback">
            <Icon name="mdi-web" size="xs" />
          </div>
        </div>

        <!-- 书签信息 -->
        <div class="bookmark-info">
          <div class="bookmark-title" :title="bookmark.title">
            {{ bookmark.title }}
          </div>
          <div class="bookmark-meta">
            <span class="bookmark-domain">
              {{ extractDomain(bookmark.url!) }}
            </span>
            <span v-if="showDebugInfo" class="recommendation-score">
              评分: {{ bookmark.recommendationScore?.toFixed(1) }}
            </span>
          </div>
        </div>

        <!-- 推荐原因 -->
        <div class="recommendation-reason">
          <Badge :variant="getReasonBadgeVariant(bookmark)" size="sm">
            {{ getRecommendationReason(bookmark) }}
          </Badge>
        </div>

        <!-- 使用频率指示器 - ✅ Phase 2 Step 2 更新 -->
        <div
          v-if="bookmark.visitCount && bookmark.visitCount > 0"
          class="usage-indicator"
        >
          <div
            class="usage-bar"
            :style="{
              width: `${Math.min((bookmark.visitCount || 0) * 5, 100)}%`
            }"
            :title="`访问${bookmark.visitCount}次，置信度${(bookmark.confidence * 100).toFixed(1)}%`"
          ></div>
        </div>
      </div>
    </div>

    <!-- 更多推荐按钮 -->
    <div v-if="hasMoreRecommendations" class="recommendations-footer">
      <Button
        variant="outline"
        size="sm"
        :loading="isLoadingMore"
        class="load-more-button"
        @click="loadMoreRecommendations"
      >
        查看更多推荐
      </Button>
    </div>
  </div>

  <!-- 空状态 -->
  <div v-else-if="!isLoading" class="recommendations-empty">
    <Icon name="mdi-lightbulb-outline" class="empty-icon" />
    <p class="empty-text">暂无推荐书签</p>
    <p class="empty-hint">多使用书签，我们将为您提供个性化推荐</p>
  </div>

  <!-- 加载状态 -->
  <div v-else class="recommendations-loading">
    <ProgressBar indeterminate size="small" />
    <p class="loading-text">正在分析您的书签使用模式...</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Badge, Button, Icon, ProgressBar } from '@/components'
// ✅ Phase 2 Step 2: 使用新的智能推荐引擎
import {
  type RecommendationOptions,
  type SmartRecommendation,
  getSmartRecommendationEngine
} from '@/services/smart-recommendation-engine'
// 🚀 轻量级书签增强器
import { lightweightBookmarkEnhancer } from '@/services/lightweight-bookmark-enhancer'
import { logger } from '@/infrastructure/logging/logger'

// Props
interface Props {
  maxRecommendations?: number
  showDebugInfo?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxRecommendations: 5,
  showDebugInfo: false
})

// Emits
const emit = defineEmits<{
  bookmarkClick: [bookmark: SmartRecommendation, event: MouseEvent]
  recommendationUpdate: [recommendations: SmartRecommendation[]]
  recommendationFeedback: [
    recommendationId: string,
    feedback: 'accepted' | 'rejected' | 'clicked'
  ]
}>()

// 响应式状态
const recommendations = ref<SmartRecommendation[]>([])
const isLoading = ref(true)
const isRefreshing = ref(false)
const isLoadingMore = ref(false)
const hasMoreRecommendations = ref(false)
const isTesting = ref(false) // 测试爬虫状态
const recommendationEngine = getSmartRecommendationEngine()

// ✅ Favicon状态管理
const faviconLoaded = ref<Record<string, boolean>>({})
const faviconError = ref<Record<string, boolean>>({})

// 计算属性已移除，按需使用 props.showDebugInfo

// 生命周期
onMounted(async () => {
  await loadRecommendations()
})

/**
 * 加载推荐书签 - ✅ Phase 2 Step 2 升级版
 */
async function loadRecommendations() {
  try {
    isLoading.value = true
    logger.info('SmartRecommendation', '🧠 开始加载智能推荐...')

    // 构建推荐选项
    const options: RecommendationOptions = {
      maxResults: props.maxRecommendations,
      minConfidence: 0.2, // 降低门槛以获得更多推荐
      includeRecentOnly: false,
      contextWeight: 0.3,
      diversityFactor: 0.25,
      userContext: await getCurrentUserContext()
    }

    // 使用智能推荐引擎获取推荐
    const newRecommendations =
      await recommendationEngine.generateRecommendations(options)

    recommendations.value = newRecommendations
    hasMoreRecommendations.value =
      newRecommendations.length >= props.maxRecommendations

    // ✅ 初始化favicon状态
    initializeFaviconState(newRecommendations)

    emit('recommendationUpdate', newRecommendations)

    logger.info(
      'Component',
      '✅ [SmartRecommendation] 加载完成: ${newRecommendations.length}个智能推荐'
    )
    if (props.showDebugInfo) {
      logger.info('📊 推荐详情:', newRecommendations)
    }
  } catch (error) {
    logger.error('Component', '❌ [SmartRecommendation] 加载推荐失败:', error)
    recommendations.value = []
  } finally {
    isLoading.value = false
  }
}

/**
 * 刷新推荐
 */
async function refreshRecommendations() {
  if (isRefreshing.value) return

  try {
    isRefreshing.value = true
    await loadRecommendations()
  } finally {
    isRefreshing.value = false
  }
}

/**
 * 🌟 智能全量爬虫功能
 */
async function testCrawler() {
  if (isTesting.value) return

  try {
    isTesting.value = true
    logger.info('Component', '🌟 [智能爬虫] 开始智能全量书签增强...')

    // 获取所有推荐书签进行增强
    const allBookmarks = recommendations.value

    if (allBookmarks.length === 0) {
      logger.warn(
        'Component',
        '⚠️ [智能爬虫] 没有推荐书签可供测试，请先加载推荐'
      )
      return
    }

    logger.info(
      'Component',
      '🎯 [智能爬虫] 将智能增强${allBookmarks.length}个书签'
    )
    logger.info(
      'Component',
      '🧠 [智能爬虫] 策略: 优先级排序 → 分批处理 → 智能间隔'
    )

    // 转换为Chrome书签格式并过滤有效书签
    const validBookmarks = allBookmarks
      .filter(bookmark => bookmark.url && !bookmark.url.startsWith('chrome://'))
      .map(
        bookmark =>
          ({
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            dateAdded: bookmark.dateAdded,
            dateLastUsed: bookmark.dateLastUsed,
            parentId: bookmark.parentId || '0',
            syncing: false
          }) as chrome.bookmarks.BookmarkTreeNode
      )

    if (validBookmarks.length === 0) {
      logger.warn('Component', '⚠️ [智能爬虫] 没有有效的书签URL可供爬取')
      return
    }

    // 启动智能增强策略
    await smartEnhanceBookmarks(validBookmarks)

    logger.info('Component', '🎉 [智能爬虫] 智能增强任务已启动！')
    logger.info(
      'Component',
      '📱 [智能爬虫] 请打开控制台查看详细进度，或检查IndexedDB数据'
    )

    // 显示当前缓存统计
    const stats = await lightweightBookmarkEnhancer.getCacheStats()
    logger.info('📊 [智能爬虫] 当前缓存统计:', stats)
  } catch (error) {
    logger.error('Component', '❌ [智能爬虫] 测试失败:', error)
  } finally {
    isTesting.value = false
  }
}

/**
 * 🎯 智能增强书签策略 (前端版本) - URL去重优化
 */
async function smartEnhanceBookmarks(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
) {
  logger.info(
    'Component',
    '🌟 [SmartEnhancer] 启动前端智能全量爬取: ${bookmarks.length}个书签'
  )
  logger.info(
    'Component',
    '🧠 [SmartEnhancer] 策略: URL去重 → 优先级排序 → 分批处理'
  )

  // 🔗 Step 1: URL去重和分组
  const urlGroups: Record<string, chrome.bookmarks.BookmarkTreeNode[]> = {}
  for (const bookmark of bookmarks) {
    if (bookmark.url) {
      if (!urlGroups[bookmark.url]) {
        urlGroups[bookmark.url] = []
      }
      urlGroups[bookmark.url].push(bookmark)
    }
  }

  const uniqueUrls = Object.keys(urlGroups)
  const duplicateCount = bookmarks.length - uniqueUrls.length

  logger.info(
    'Component',
    '🔗 [SmartEnhancer] URL去重完成: ${bookmarks.length}个书签 → ${uniqueUrls.length}个唯一URL'
  )
  if (duplicateCount > 0) {
    logger.info(
      'Component',
      '♻️ [SmartEnhancer] 发现${duplicateCount}个重复URL，将复用爬取结果'
    )
  }

  // 🎯 Step 2: 选择代表书签并优先级排序
  const representatives = Object.entries(urlGroups).map(
    ([url, bookmarksGroup]) => {
      if (bookmarksGroup.length === 1) {
        return bookmarksGroup[0]
      } else {
        // 选择最优质的书签
        const bestBookmark = bookmarksGroup.slice().sort((a, b) => {
          if (a.title && !b.title) return -1
          if (!a.title && b.title) return 1
          const lastUsedA = a.dateLastUsed || 0
          const lastUsedB = b.dateLastUsed || 0
          if (lastUsedB !== lastUsedA) return lastUsedB - lastUsedA
          return (b.dateAdded || 0) - (a.dateAdded || 0)
        })[0]
        logger.info(
          'SmartRecommendation',
          `🔄 [URLDedup] ${url}: ${bookmarksGroup.length}个重复书签 → 选择"${bestBookmark.title}"`
        )
        return bestBookmark
      }
    }
  )

  // 按优先级排序代表书签
  const prioritizedBookmarks = representatives.sort((a, b) => {
    const timeA = a.dateAdded || 0
    const timeB = b.dateAdded || 0
    const lastUsedA = a.dateLastUsed || 0
    const lastUsedB = b.dateLastUsed || 0

    // 最近使用权重70%，最近添加权重30%
    return (lastUsedB - lastUsedA) * 0.7 + (timeB - timeA) * 0.3
  })

  // 🔄 Step 3: 分批处理策略
  const BATCH_SIZE = 15 // 每批15个，减少并发压力
  const BATCH_INTERVAL = 1500 // 1.5秒间隔

  for (let i = 0; i < prioritizedBookmarks.length; i += BATCH_SIZE) {
    const batch = prioritizedBookmarks.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(prioritizedBookmarks.length / BATCH_SIZE)

    // 延迟执行每个批次
    setTimeout(async () => {
      logger.info(
        'Component',
        '📦 [SmartEnhancer] 处理第${batchNumber}/${totalBatches}批 (${batch.length}个唯一URL)'
      )

      // 并行处理当前批次
      const promises = batch.map(async (bookmark, index) => {
        try {
          // 每个书签之间小间隔，避免瞬时压力
          await new Promise(resolve => setTimeout(resolve, index * 150))

          const enhanced =
            await lightweightBookmarkEnhancer.enhanceBookmark(bookmark)
          logger.info(
            'Component',
            '✅ [SmartEnhancer] [${i + index + 1}/${prioritizedBookmarks.length}] ${enhanced.extractedTitle || enhanced.title}'
          )

          // 🔄 将爬取结果应用到相同URL的所有书签
          const sameUrlBookmarks = urlGroups[bookmark.url!]
          if (sameUrlBookmarks.length > 1) {
            for (const sameUrlBookmark of sameUrlBookmarks) {
              const bookmarkSpecificData = {
                ...enhanced,
                id: sameUrlBookmark.id,
                title: sameUrlBookmark.title || enhanced.title,
                dateAdded: sameUrlBookmark.dateAdded,
                dateLastUsed: sameUrlBookmark.dateLastUsed,
                parentId: sameUrlBookmark.parentId
              }
              await lightweightBookmarkEnhancer.saveToCache(
                bookmarkSpecificData
              )
            }
            logger.info(
              'Component',
              '♻️ [URLDedup] 复用爬取结果到${sameUrlBookmarks.length}个重复书签'
            )
          }

          return enhanced
        } catch (error) {
          logger.warn(
            `⚠️ [SmartEnhancer] [${i + index + 1}/${prioritizedBookmarks.length}] 增强失败: ${bookmark.title}`,
            error
          )
          return null
        }
      })

      await Promise.allSettled(promises)

      logger.info('Component', '🎉 [SmartEnhancer] 第${batchNumber}批处理完成')

      // 最后一批显示完成统计
      if (batchNumber === totalBatches) {
        const stats = await lightweightBookmarkEnhancer.getCacheStats()
        logger.info('Component', '🏆 [SmartEnhancer] 前端全量爬取任务完成!')
        logger.info(`📊 [SmartEnhancer] 最终统计:`, stats)
        logger.info(
          'Component',
          '♻️ [SmartEnhancer] URL复用节省了${duplicateCount}次网络请求'
        )
      }
    }, batchNumber * BATCH_INTERVAL)
  }
}

/**
 * 加载更多推荐 - ✅ Phase 2 Step 2 升级版
 */
async function loadMoreRecommendations() {
  if (isLoadingMore.value) return

  try {
    isLoadingMore.value = true
    logger.info('Component', '🔄 [SmartRecommendation] 加载更多推荐...')

    // 构建选项（更大的范围）
    const options: RecommendationOptions = {
      maxResults: props.maxRecommendations * 2, // 获取更多结果
      minConfidence: 0.1, // 进一步降低门槛
      includeRecentOnly: false,
      contextWeight: 0.2,
      diversityFactor: 0.3, // 增加多样性
      userContext: await getCurrentUserContext()
    }

    const moreRecommendations =
      await recommendationEngine.generateRecommendations(options)

    // 添加新的推荐（去重）
    const existingIds = new Set(recommendations.value.map(r => r.id))
    const newOnes = moreRecommendations.filter(r => !existingIds.has(r.id))

    recommendations.value = [...recommendations.value, ...newOnes].slice(
      0,
      props.maxRecommendations * 3
    )
    hasMoreRecommendations.value = newOnes.length > 0

    logger.info(
      'Component',
      '✅ [SmartRecommendation] 新增${newOnes.length}个推荐'
    )
  } catch (error) {
    logger.error(
      'Component',
      '❌ [SmartRecommendation] 加载更多推荐失败:',
      error
    )
  } finally {
    isLoadingMore.value = false
  }
}

/**
 * 获取当前用户上下文 - ✅ Phase 2 Step 2 增强版
 */
async function getCurrentUserContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const now = new Date()

    return {
      currentTime: Date.now(),
      currentHour: now.getHours(),
      currentDayOfWeek: now.getDay(),
      currentUrl: tab?.url,
      currentDomain: tab?.url ? new URL(tab.url).hostname : undefined,
      recentSearches: [], // TODO: 从搜索历史获取
      recentBookmarks: [] // TODO: 从最近书签获取
    }
  } catch (error) {
    logger.warn('⚠️ [SmartRecommendation] 获取用户上下文失败:', error)
    return {
      currentTime: Date.now(),
      currentHour: new Date().getHours(),
      currentDayOfWeek: new Date().getDay(),
      recentSearches: [],
      recentBookmarks: []
    }
  }
}

/**
 * 打开书签 - ✅ Phase 2 Step 2 增强版
 */
async function openBookmark(bookmark: SmartRecommendation, event: MouseEvent) {
  if (!bookmark.url) return

  try {
    const inNewTab = event.ctrlKey || event.metaKey || event.button === 1

    if (inNewTab) {
      await chrome.tabs.create({ url: bookmark.url })
    } else {
      await chrome.tabs.update({ url: bookmark.url })
    }

    // 跟踪推荐点击并记录反馈
    trackRecommendationClick(bookmark)
    recordRecommendationFeedback(bookmark.id, 'clicked')

    emit('bookmarkClick', bookmark, event)
    logger.info(
      'SmartRecommendation',
      `🔗 打开书签: ${bookmark.title} (${bookmark.recommendationType})`
    )
  } catch (error) {
    logger.error('Component', 'SmartRecommendation', '❌ 打开书签失败', error)
  }
}

/**
 * 跟踪推荐点击（用于改进算法） - ✅ Phase 2 Step 2 增强版
 */
function trackRecommendationClick(bookmark: SmartRecommendation) {
  const trackingData = {
    bookmarkId: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    domain: bookmark.domain,
    recommendationType: bookmark.recommendationType,
    recommendationScore: bookmark.recommendationScore,
    confidence: bookmark.confidence,
    visitCount: bookmark.visitCount,
    recentVisitCount: bookmark.recentVisitCount,
    contextScore: bookmark.contextScore,
    timePatternScore: bookmark.timePatternScore,
    frequencyScore: bookmark.frequencyScore,
    similarityScore: bookmark.similarityScore,
    reasons: bookmark.recommendationReason.map(r => ({
      type: r.type,
      description: r.description,
      weight: r.weight
    })),
    timestamp: Date.now()
  }

  logger.info('SmartRecommendation', '📊 点击跟踪', trackingData)

  // TODO: 保存到IndexedDB用于算法优化
}

/**
 * 记录推荐反馈 - ✅ Phase 2 Step 2 新功能
 */
function recordRecommendationFeedback(
  recommendationId: string,
  feedback: 'accepted' | 'rejected' | 'clicked'
) {
  // 记录到推荐引擎
  recommendationEngine.recordRecommendationFeedback(recommendationId, feedback)

  // 发出事件供父组件监听
  emit('recommendationFeedback', recommendationId, feedback)

  logger.info(
    'SmartRecommendation',
    `📝 记录反馈: ${recommendationId} -> ${feedback}`
  )
}

/**
 * 获取推荐原因 - ✅ Phase 2 Step 2 增强版
 */
function getRecommendationReason(bookmark: SmartRecommendation): string {
  // 优先使用智能推荐引擎提供的推荐类型
  switch (bookmark.recommendationType) {
    case 'frequent':
      return '高频使用'
    case 'recent':
      return '最近访问'
    case 'similar':
      return '相似内容'
    case 'contextual':
      return '相关推荐'
    case 'temporal':
      return '时间匹配'
    case 'trending':
      return '热门趋势'
    case 'seasonal':
      return '季节推荐'
    default:
      break
  }

  // 备用逻辑：基于具体推荐原因
  if (bookmark.recommendationReason.length > 0) {
    const topReason = bookmark.recommendationReason[0]
    return topReason.description
  }

  // 最后的备用逻辑
  const score = bookmark.recommendationScore || 0
  const visitCount = bookmark.visitCount || 0

  if (visitCount > 10) return '常用书签'
  if (bookmark.recentVisitCount && bookmark.recentVisitCount > 0)
    return '最近使用'
  if (score > 50) return '高分推荐'
  if (bookmark.contextScore > 40) return '上下文相关'

  return '智能推荐'
}

/**
 * 获取推荐原因徽章变体 - ✅ Phase 2 Step 2 增强版
 */
function getReasonBadgeVariant(
  bookmark: SmartRecommendation
): 'outlined' | 'soft' {
  const type = bookmark.recommendationType

  switch (type) {
    case 'frequent':
    case 'contextual':
      return 'soft'
    case 'recent':
    case 'temporal':
      return 'outlined'
    case 'similar':
    case 'trending':
    case 'seasonal':
      return 'soft'
    default:
      // 基于置信度决定
      return bookmark.confidence > 0.7 ? 'soft' : 'outlined'
  }
}

/**
 * 获取网站图标URL - ✅ 优化版 (减少控制台错误)
 * 使用更可靠的备选方案确保图标能够加载
 */
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname

    // 跳过chrome://favicon/，直接使用更可靠的方式
    // 原因：某些网站的favicon无法通过chrome://favicon/加载，会产生控制台错误

    // 方案1: 使用Google的favicon服务 (更稳定)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  } catch {
    return chrome.runtime?.getURL
      ? chrome.runtime.getURL('images/icon16.png')
      : '/favicon-16x16.png'
  }
}

/**
 * 处理图标加载错误 - ✅ 优化版 (简化错误处理)
 */
function handleFaviconError(event: Event, url: string) {
  const img = event.target as HTMLImageElement
  const bookmarkId = findBookmarkIdByUrl(url)

  if (bookmarkId) {
    faviconError.value[bookmarkId] = true
    faviconLoaded.value[bookmarkId] = false
  }

  // 如果Google favicon服务也失败了，尝试直接从域名获取
  if (!img.src.includes('/favicon.ico')) {
    try {
      const domain = new URL(url).hostname
      img.src = `https://${domain}/favicon.ico`
      return
    } catch {
      // 忽略错误，继续使用默认图标
    }
  }

  // 最后使用默认图标
  img.src = chrome.runtime?.getURL
    ? chrome.runtime.getURL('images/icon16.png')
    : '/favicon-16x16.png'
}

/**
 * 处理图标加载成功 - ✅ 新增
 */
function handleFaviconLoad(event: Event) {
  const img = event.target as HTMLImageElement
  // 从data属性或通过parent找到对应的书签
  const bookmarkElement = img.closest('.recommendation-item')
  if (bookmarkElement) {
    const bookmarkTitle =
      bookmarkElement.querySelector('.bookmark-title')?.textContent
    const bookmark = recommendations.value.find(b => b.title === bookmarkTitle)
    if (bookmark) {
      faviconLoaded.value[bookmark.id] = true
      faviconError.value[bookmark.id] = false
    }
  }
}

/**
 * 根据URL查找书签ID
 */
function findBookmarkIdByUrl(url: string): string | null {
  const bookmark = recommendations.value.find(b => b.url === url)
  return bookmark ? bookmark.id : null
}

/**
 * 初始化favicon状态 - ✅ 新增
 */
function initializeFaviconState(bookmarks: SmartRecommendation[]) {
  // 清理旧状态
  faviconLoaded.value = {}
  faviconError.value = {}

  // 为每个书签初始化状态
  bookmarks.forEach(bookmark => {
    faviconLoaded.value[bookmark.id] = false
    faviconError.value[bookmark.id] = false
  })
}

/**
 * 提取域名
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'Unknown'
  }
}

/**
 * 显示上下文菜单 - ✅ Phase 2 Step 2 增强版
 */
function showContextMenu(bookmark: SmartRecommendation) {
  logger.info('SmartRecommendation', '🖱️ 右键菜单', {
    id: bookmark.id,
    title: bookmark.title,
    type: bookmark.recommendationType,
    score: bookmark.recommendationScore,
    confidence: bookmark.confidence,
    reasons: bookmark.recommendationReason
  })

  // TODO: 实现智能推荐专属的右键菜单
  // 可以包括：
  // - 移除推荐
  // - 标记为不感兴趣
  // - 查看推荐详情
  // - 反馈推荐准确性
}

// 暴露方法给父组件
defineExpose({
  refreshRecommendations,
  loadMoreRecommendations
})
</script>

<style scoped>
.smart-recommendations {
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--spacing-sm);
  border: 1px solid var(--color-border);
}

.recommendations-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.recommendation-icon {
  color: var(--color-warning);
}

.recommendations-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.test-button,
.refresh-button {
  min-width: auto;
  padding: var(--spacing-1);
}

.test-button {
  color: var(--color-primary);
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-sm) var(--spacing-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.recommendation-item:hover {
  background: var(--color-background-hover);
  /* 无几何位移，使用颜色/亮度反馈 */
  opacity: 0.98;
}

.bookmark-favicon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.favicon-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-xs);
  transition: opacity var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-standard);
}

.favicon-image.favicon-loading {
  opacity: 0.6;
  animation: favicon-pulse 1.5s ease-in-out infinite;
}

.favicon-fallback {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 2px;
  color: var(--color-text-secondary);
}

@keyframes favicon-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
}

.bookmark-info {
  flex: 1;
  min-width: 0;
}

.bookmark-title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--spacing-0-5);
}

.bookmark-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.bookmark-domain {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recommendation-score {
  font-family: monospace;
  background: var(--color-background-muted);
  padding: 1px var(--spacing-1);
  border-radius: var(--radius-sm);
}

.recommendation-reason {
  flex-shrink: 0;
}

.usage-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-background-muted);
}

.usage-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-success),
    var(--color-warning)
  );
  transition: width var(--md-sys-motion-duration-medium2)
    var(--md-sys-motion-easing-standard);
}

.recommendations-footer {
  margin-top: var(--spacing-3);
  text-align: center;
}

.load-more-button {
  width: 100%;
}

.recommendations-empty {
  text-align: center;
  padding: var(--spacing-8) var(--spacing-4);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: var(--icon-size-xl);
  margin-bottom: var(--spacing-sm);
  opacity: 0.5;
}

.empty-text {
  margin: 0 0 4px 0;
  font-weight: 500;
}

.empty-hint {
  margin: 0;
  font-size: var(--text-xs);
  opacity: 0.7;
}

.recommendations-loading {
  text-align: center;
  padding: var(--spacing-6) var(--spacing-4);
}

.loading-text {
  margin: var(--spacing-sm) 0 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
</style>
