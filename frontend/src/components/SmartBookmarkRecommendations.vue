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

        <!-- 使用频率指示器 -->
        <div class="usage-indicator" v-if="bookmark.usageScore && bookmark.usageScore > 0">
          <div
            class="usage-bar"
            :style="{ width: `${Math.min(bookmark.usageScore, 100)}%` }"
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
import { 
  getBookmarkRecommendations,
  type ModernBookmarkNode,
  type BookmarkRecommendationContext
} from '@/services/modern-bookmark-service';

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
  bookmarkClick: [bookmark: ModernBookmarkNode, event: MouseEvent];
  recommendationUpdate: [recommendations: ModernBookmarkNode[]];
}>();

// 响应式状态
const recommendations = ref<ModernBookmarkNode[]>([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const isLoadingMore = ref(false);
const hasMoreRecommendations = ref(false);
const currentContext = ref<BookmarkRecommendationContext>({});

// 计算属性已移除，按需使用 props.showDebugInfo

// 生命周期
onMounted(async () => {
  await loadRecommendations();
  
  if (props.autoRefresh) {
    setInterval(refreshRecommendations, props.refreshInterval);
  }
});

/**
 * 加载推荐书签
 */
async function loadRecommendations() {
  try {
    isLoading.value = true;
    
    // 获取当前页面上下文
    currentContext.value = await getCurrentContext();
    
    // 获取推荐
    const newRecommendations = await getBookmarkRecommendations(currentContext.value);
    
    recommendations.value = newRecommendations;
    hasMoreRecommendations.value = newRecommendations.length >= props.maxRecommendations;
    
    emit('recommendationUpdate', newRecommendations);
    
    console.log(`💡 加载了${newRecommendations.length}个推荐书签`);
  } catch (error) {
    console.error('❌ 加载推荐书签失败:', error);
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
 * 加载更多推荐
 */
async function loadMoreRecommendations() {
  if (isLoadingMore.value) return;
  
  try {
    isLoadingMore.value = true;
    
    const moreRecommendations = await getBookmarkRecommendations(currentContext.value);
    
    // 添加新的推荐（去重）
    const existingIds = new Set(recommendations.value.map(r => r.id));
    const newOnes = moreRecommendations.filter(r => !existingIds.has(r.id));
    
    recommendations.value = [...recommendations.value, ...newOnes];
    hasMoreRecommendations.value = newOnes.length > 0;
    
  } catch (error) {
    console.error('❌ 加载更多推荐失败:', error);
  } finally {
    isLoadingMore.value = false;
  }
}

/**
 * 获取当前页面上下文
 */
async function getCurrentContext(): Promise<BookmarkRecommendationContext> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const now = new Date();
    
    return {
      currentUrl: tab?.url,
      currentDomain: tab?.url ? new URL(tab.url).hostname : undefined,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay()
    };
  } catch (error) {
    console.warn('⚠️ 获取当前上下文失败:', error);
    return {};
  }
}

/**
 * 打开书签
 */
async function openBookmark(bookmark: ModernBookmarkNode, event: MouseEvent) {
  if (!bookmark.url) return;
  
  try {
    const inNewTab = event.ctrlKey || event.metaKey || event.button === 1;
    
    if (inNewTab) {
      await chrome.tabs.create({ url: bookmark.url });
    } else {
      await chrome.tabs.update({ url: bookmark.url });
    }
    
    // 跟踪推荐点击
    trackRecommendationClick(bookmark);
    
    emit('bookmarkClick', bookmark, event);
  } catch (error) {
    console.error('❌ 打开书签失败:', error);
  }
}

/**
 * 跟踪推荐点击（用于改进算法）
 */
function trackRecommendationClick(bookmark: ModernBookmarkNode) {
  console.log('📊 推荐点击跟踪:', {
    bookmarkId: bookmark.id,
    title: bookmark.title,
    recommendationScore: bookmark.recommendationScore,
    usageScore: bookmark.usageScore,
    context: currentContext.value
  });
  
  // TODO: 发送到分析服务或IndexedDB
}

/**
 * 获取推荐原因
 */
function getRecommendationReason(bookmark: ModernBookmarkNode): string {
  const score = bookmark.recommendationScore || 0;
  const usage = bookmark.usageScore || 0;
  
  if (currentContext.value.currentDomain && bookmark.url) {
    try {
      const bookmarkDomain = new URL(bookmark.url).hostname;
      if (bookmarkDomain === currentContext.value.currentDomain) {
        return '相关网站';
      }
    } catch (e) {
      // 忽略URL解析错误
    }
  }
  
  if (usage > 50) return '常用';
  if (bookmark.dateAdded && (Date.now() - bookmark.dateAdded) < 7 * 24 * 60 * 60 * 1000) {
    return '最近添加';
  }
  if (score > 30) return '推荐';
  
  return '相关';
}

/**
 * 获取推荐原因徽章变体
 */
function getReasonBadgeVariant(bookmark: ModernBookmarkNode): 'outlined' | 'filled' | 'soft' {
  const reason = getRecommendationReason(bookmark);
  
  switch (reason) {
    case '相关网站': return 'filled';
    case '常用': return 'soft';
    case '最近添加': return 'outlined';
    default: return 'soft';
  }
}

/**
 * 获取网站图标URL
 */
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=16`;
  } catch (error) {
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
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * 显示上下文菜单
 */
function showContextMenu(bookmark: ModernBookmarkNode) {
  // TODO: 实现书签右键菜单
  console.log('右键菜单:', bookmark);
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
