<!--
智能书签推荐组件
基于Chrome Bookmarks API最新特性的智能推荐系统
-->
<template>
  <div class="smart-recommendations" v-if="recommendations.length > 0">
    <!-- 标题栏 -->
    <div class="recommendations-header">
      <div class="header-content">
        <Icon name="mdi-lightbulb-on" class="recommendation-icon" />
        <h3 class="recommendations-title">为您推荐</h3>
        <Badge 
          :text="recommendations.length.toString()" 
          variant="soft" 
          size="sm"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        @click="refreshRecommendations"
        :loading="isRefreshing"
        class="refresh-button"
      >
        <Icon name="mdi-refresh" />
      </Button>
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
            @error="handleFaviconError"
            class="favicon-image"
          />
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
            <span class="recommendation-score" v-if="showDebugInfo">
              评分: {{ bookmark.recommendationScore?.toFixed(1) }}
            </span>
          </div>
        </div>

        <!-- 推荐原因 -->
        <div class="recommendation-reason">
          <Badge
            :text="getRecommendationReason(bookmark)"
            :variant="getReasonBadgeVariant(bookmark)"
            size="sm"
          />
        </div>

        <!-- 使用频率指示器 - ✅ Phase 2 Step 2 更新 -->
        <div class="usage-indicator" v-if="bookmark.visitCount && bookmark.visitCount > 0">
          <div
            class="usage-bar"
            :style="{ width: `${Math.min((bookmark.visitCount || 0) * 5, 100)}%` }"
            :title="`访问${bookmark.visitCount}次，置信度${(bookmark.confidence * 100).toFixed(1)}%`"
          ></div>
        </div>
      </div>
    </div>

    <!-- 更多推荐按钮 -->
    <div class="recommendations-footer" v-if="hasMoreRecommendations">
      <Button
        variant="outline"
        size="sm"
        @click="loadMoreRecommendations"
        :loading="isLoadingMore"
        class="load-more-button"
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
import { ref, onMounted } from 'vue';
import { Icon, Badge, Button, ProgressBar } from '@/components/ui';
// ✅ Phase 2 Step 2: 使用新的智能推荐引擎
import { getSmartRecommendationEngine, type SmartRecommendation, type RecommendationOptions } from '@/services/smart-recommendation-engine';

// Props
interface Props {
  maxRecommendations?: number;
  showDebugInfo?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // 毫秒
}

const props = withDefaults(defineProps<Props>(), {
  maxRecommendations: 5,
  showDebugInfo: false,
  autoRefresh: true,
  refreshInterval: 5 * 60 * 1000 // 5分钟
});

// Emits
const emit = defineEmits<{
  bookmarkClick: [bookmark: SmartRecommendation, event: MouseEvent];
  recommendationUpdate: [recommendations: SmartRecommendation[]];
  recommendationFeedback: [recommendationId: string, feedback: 'accepted' | 'rejected' | 'clicked'];
}>();

// 响应式状态
const recommendations = ref<SmartRecommendation[]>([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const isLoadingMore = ref(false);
const hasMoreRecommendations = ref(false);
const recommendationEngine = getSmartRecommendationEngine();

// 计算属性已移除，按需使用 props.showDebugInfo

// 生命周期
onMounted(async () => {
  await loadRecommendations();
  
  if (props.autoRefresh) {
    setInterval(refreshRecommendations, props.refreshInterval);
  }
});

/**
 * 加载推荐书签 - ✅ Phase 2 Step 2 升级版
 */
async function loadRecommendations() {
  try {
    isLoading.value = true;
    console.log('🧠 [SmartRecommendation] 开始加载智能推荐...');
    
    // 构建推荐选项
    const options: RecommendationOptions = {
      maxResults: props.maxRecommendations,
      minConfidence: 0.2, // 降低门槛以获得更多推荐
      includeRecentOnly: false,
      contextWeight: 0.3,
      diversityFactor: 0.25,
      userContext: await getCurrentUserContext()
    };
    
    // 使用智能推荐引擎获取推荐
    const newRecommendations = await recommendationEngine.generateRecommendations(options);
    
    recommendations.value = newRecommendations;
    hasMoreRecommendations.value = newRecommendations.length >= props.maxRecommendations;
    
    emit('recommendationUpdate', newRecommendations);
    
    console.log(`✅ [SmartRecommendation] 加载完成: ${newRecommendations.length}个智能推荐`);
    if (props.showDebugInfo) {
      console.log('📊 推荐详情:', newRecommendations);
    }
    
  } catch (error) {
    console.error('❌ [SmartRecommendation] 加载推荐失败:', error);
    recommendations.value = [];
  } finally {
    isLoading.value = false;
  }
}

/**
 * 刷新推荐
 */
async function refreshRecommendations() {
  if (isRefreshing.value) return;
  
  try {
    isRefreshing.value = true;
    await loadRecommendations();
  } finally {
    isRefreshing.value = false;
  }
}

/**
 * 加载更多推荐 - ✅ Phase 2 Step 2 升级版
 */
async function loadMoreRecommendations() {
  if (isLoadingMore.value) return;
  
  try {
    isLoadingMore.value = true;
    console.log('🔄 [SmartRecommendation] 加载更多推荐...');
    
    // 构建选项（更大的范围）
    const options: RecommendationOptions = {
      maxResults: props.maxRecommendations * 2, // 获取更多结果
      minConfidence: 0.1, // 进一步降低门槛
      includeRecentOnly: false,
      contextWeight: 0.2,
      diversityFactor: 0.3, // 增加多样性
      userContext: await getCurrentUserContext()
    };
    
    const moreRecommendations = await recommendationEngine.generateRecommendations(options);
    
    // 添加新的推荐（去重）
    const existingIds = new Set(recommendations.value.map(r => r.id));
    const newOnes = moreRecommendations.filter(r => !existingIds.has(r.id));
    
    recommendations.value = [...recommendations.value, ...newOnes].slice(0, props.maxRecommendations * 3);
    hasMoreRecommendations.value = newOnes.length > 0;
    
    console.log(`✅ [SmartRecommendation] 新增${newOnes.length}个推荐`);
    
  } catch (error) {
    console.error('❌ [SmartRecommendation] 加载更多推荐失败:', error);
  } finally {
    isLoadingMore.value = false;
  }
}

/**
 * 获取当前用户上下文 - ✅ Phase 2 Step 2 增强版
 */
async function getCurrentUserContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const now = new Date();
    
    return {
      currentTime: Date.now(),
      currentHour: now.getHours(),
      currentDayOfWeek: now.getDay(),
      currentUrl: tab?.url,
      currentDomain: tab?.url ? new URL(tab.url).hostname : undefined,
      recentSearches: [], // TODO: 从搜索历史获取
      recentBookmarks: [] // TODO: 从最近书签获取
    };
  } catch (error) {
    console.warn('⚠️ [SmartRecommendation] 获取用户上下文失败:', error);
    return {
      currentTime: Date.now(),
      currentHour: new Date().getHours(),
      currentDayOfWeek: new Date().getDay(),
      recentSearches: [],
      recentBookmarks: []
    };
  }
}

/**
 * 打开书签 - ✅ Phase 2 Step 2 增强版
 */
async function openBookmark(bookmark: SmartRecommendation, event: MouseEvent) {
  if (!bookmark.url) return;
  
  try {
    const inNewTab = event.ctrlKey || event.metaKey || event.button === 1;
    
    if (inNewTab) {
      await chrome.tabs.create({ url: bookmark.url });
    } else {
      await chrome.tabs.update({ url: bookmark.url });
    }
    
    // 跟踪推荐点击并记录反馈
    trackRecommendationClick(bookmark);
    recordRecommendationFeedback(bookmark.id, 'clicked');
    
    emit('bookmarkClick', bookmark, event);
    console.log(`🔗 [SmartRecommendation] 打开书签: ${bookmark.title} (${bookmark.recommendationType})`);
    
  } catch (error) {
    console.error('❌ [SmartRecommendation] 打开书签失败:', error);
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
  };
  
  console.log('📊 [SmartRecommendation] 点击跟踪:', trackingData);
  
  // TODO: 保存到IndexedDB用于算法优化
}

/**
 * 记录推荐反馈 - ✅ Phase 2 Step 2 新功能
 */
function recordRecommendationFeedback(recommendationId: string, feedback: 'accepted' | 'rejected' | 'clicked') {
  // 记录到推荐引擎
  recommendationEngine.recordRecommendationFeedback(recommendationId, feedback);
  
  // 发出事件供父组件监听
  emit('recommendationFeedback', recommendationId, feedback);
  
  console.log(`📝 [SmartRecommendation] 记录反馈: ${recommendationId} -> ${feedback}`);
}

/**
 * 获取推荐原因 - ✅ Phase 2 Step 2 增强版
 */
function getRecommendationReason(bookmark: SmartRecommendation): string {
  // 优先使用智能推荐引擎提供的推荐类型
  switch (bookmark.recommendationType) {
    case 'frequent':
      return '高频使用';
    case 'recent':
      return '最近访问';
    case 'similar':
      return '相似内容';
    case 'contextual':
      return '相关推荐';
    case 'temporal':
      return '时间匹配';
    case 'trending':
      return '热门趋势';
    case 'seasonal':
      return '季节推荐';
    default:
      break;
  }
  
  // 备用逻辑：基于具体推荐原因
  if (bookmark.recommendationReason.length > 0) {
    const topReason = bookmark.recommendationReason[0];
    return topReason.description;
  }
  
  // 最后的备用逻辑
  const score = bookmark.recommendationScore || 0;
  const visitCount = bookmark.visitCount || 0;
  
  if (visitCount > 10) return '常用书签';
  if (bookmark.recentVisitCount && bookmark.recentVisitCount > 0) return '最近使用';
  if (score > 50) return '高分推荐';
  if (bookmark.contextScore > 40) return '上下文相关';
  
  return '智能推荐';
}

/**
 * 获取推荐原因徽章变体 - ✅ Phase 2 Step 2 增强版
 */
function getReasonBadgeVariant(bookmark: SmartRecommendation): 'outlined' | 'soft' {
  const type = bookmark.recommendationType;
  
  switch (type) {
    case 'frequent':
    case 'contextual':
      return 'soft';
    case 'recent':
    case 'temporal':
      return 'outlined';
    case 'similar':
    case 'trending':
    case 'seasonal':
      return 'soft';
    default:
      // 基于置信度决定
      return bookmark.confidence > 0.7 ? 'soft' : 'outlined';
  }
}

/**
 * 获取网站图标URL
 */
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=16`;
  } catch {
    return '/images/icon16.png'; // 默认图标
  }
}

/**
 * 处理图标加载错误
 */
function handleFaviconError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = '/images/icon16.png';
}

/**
 * 提取域名
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Unknown';
  }
}

/**
 * 显示上下文菜单 - ✅ Phase 2 Step 2 增强版
 */
function showContextMenu(bookmark: SmartRecommendation) {
  console.log('🖱️ [SmartRecommendation] 右键菜单:', {
    id: bookmark.id,
    title: bookmark.title,
    type: bookmark.recommendationType,
    score: bookmark.recommendationScore,
    confidence: bookmark.confidence,
    reasons: bookmark.recommendationReason
  });
  
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
});
</script>

<style scoped>
.smart-recommendations {
  padding: 16px;
  background: var(--color-surface);
  border-radius: 8px;
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
  gap: 8px;
}

.recommendation-icon {
  color: var(--color-warning);
}

.recommendations-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.refresh-button {
  min-width: auto;
  padding: 4px;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.recommendation-item:hover {
  background: var(--color-background-hover);
  transform: translateY(-1px);
}

.bookmark-favicon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.favicon-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2px;
}

.bookmark-info {
  flex: 1;
  min-width: 0;
}

.bookmark-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.bookmark-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
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
  padding: 1px 4px;
  border-radius: 3px;
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
  background: linear-gradient(90deg, var(--color-success), var(--color-warning));
  transition: width 0.3s ease;
}

.recommendations-footer {
  margin-top: 12px;
  text-align: center;
}

.load-more-button {
  width: 100%;
}

.recommendations-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-text {
  margin: 0 0 4px 0;
  font-weight: 500;
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}

.recommendations-loading {
  text-align: center;
  padding: 24px 16px;
}

.loading-text {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
