<template>
  <div class="share-landing-page">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-text">正在加载分享内容...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container" role="alert" aria-live="assertive">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h2 class="error-title">无法加载分享内容</h2>
      <p class="error-message">{{ error }}</p>
      <button class="retry-button" aria-label="重新加载分享内容" @click="loadShareData">重试</button>
    </div>

    <!-- 分享内容 -->
    <div v-else-if="shareData" class="share-content">
      <!-- 头部 -->
      <header class="share-header">
        <div class="container">
          <h1 class="share-title">{{ shareData.title }}</h1>
          <p class="share-meta">
            分享了 {{ shareData.bookmarks.length }} 个书签
            <span class="share-time">
              · {{ formatDate(shareData.timestamp) }}
            </span>
          </p>
        </div>
      </header>

      <!-- 扩展检测提示 -->
      <div v-if="!isExtensionInstalled && !isMobile" class="extension-prompt" role="region" aria-label="扩展安装提示">
        <div class="container">
          <div class="prompt-content">
            <div class="prompt-icon" aria-hidden="true">🚀</div>
            <div class="prompt-text">
              <h3>安装 AcuityBookmarks 扩展</h3>
              <p>安装扩展后，您可以选择性导入这些书签到您的浏览器</p>
            </div>
            <a
              :href="extensionLink"
              target="_blank"
              rel="noopener noreferrer"
              class="install-button"
              aria-label="在新标签页中打开 Chrome 网上应用店安装 AcuityBookmarks 扩展"
            >
              立即安装
            </a>
          </div>
        </div>
      </div>

      <!-- 移动端提示 -->
      <div v-if="isMobile" class="mobile-prompt" role="region" aria-label="移动端使用提示">
        <div class="container">
          <div class="prompt-content">
            <div class="prompt-icon" aria-hidden="true">💻</div>
            <div class="prompt-text">
              <h3>请在电脑上打开</h3>
              <p>要导入这些书签，请在电脑浏览器中打开此链接并安装 AcuityBookmarks 扩展</p>
            </div>
            <div class="mobile-actions">
              <button class="action-button secondary" aria-label="复制分享链接到剪贴板" @click="copyShareLink">
                📋 复制链接
              </button>
              <button class="action-button primary" aria-label="使用系统分享功能分享给朋友" @click="shareToFriends">
                🔗 分享给朋友
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 书签列表 -->
      <div class="bookmarks-section">
        <div class="container">
          <div class="bookmarks-header">
            <h2 class="bookmarks-title">书签列表</h2>
            <div v-if="isExtensionInstalled && !isMobile" class="bookmarks-actions">
              <!-- 文件夹选择 -->
              <select
                v-model="selectedFolderId"
                class="folder-select"
                :disabled="isImporting"
                aria-label="选择目标文件夹"
              >
                <option value="" disabled>选择目标文件夹</option>
                <option
                  v-for="folder in flatFolders"
                  :key="folder.id"
                  :value="folder.id"
                >
                  {{ '　'.repeat(folder.level) }}{{ folder.title }}
                </option>
              </select>

              <button
                class="action-button secondary"
                :disabled="selectedBookmarks.size === 0 || isImporting"
                :aria-label="`清除选择，当前已选中 ${selectedBookmarks.size} 个书签`"
                @click="clearSelection"
              >
                清除选择 ({{ selectedBookmarks.size }})
              </button>
              <button
                class="action-button primary"
                :disabled="
                  selectedBookmarks.size === 0 ||
                  !selectedFolderId ||
                  isImporting
                "
                :aria-label="
                  isImporting
                    ? `正在导入，进度 ${importProgress.current} / ${importProgress.total}`
                    : `导入选中的 ${selectedBookmarks.size} 个书签`
                "
                :aria-busy="isImporting"
                @click="importSelected"
              >
                <span v-if="isImporting">
                  导入中... ({{ importProgress.current }}/{{
                    importProgress.total
                  }})
                </span>
                <span v-else> 导入选中 ({{ selectedBookmarks.size }}) </span>
              </button>
            </div>
          </div>

          <!-- 导入进度播报（屏幕阅读器） -->
          <div
            v-if="isImporting"
            class="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            正在导入书签，进度 {{ importProgress.current }} / {{ importProgress.total }}
          </div>

          <div class="bookmarks-list" role="list" :aria-label="`共 ${shareData.bookmarks.length} 个书签`">
            <div
              v-for="(bookmark, index) in shareData.bookmarks"
              :key="index"
              class="bookmark-item"
              :class="{ selected: selectedBookmarks.has(index), 'mobile-item': isMobile }"
              role="listitem"
              :aria-label="`书签：${bookmark.title}`"
              @click="isMobile ? undefined : toggleBookmark(index)"
            >
              <div v-if="isExtensionInstalled && !isMobile" class="bookmark-checkbox">
                <input
                  type="checkbox"
                  :checked="selectedBookmarks.has(index)"
                  :aria-label="`选择书签：${bookmark.title}`"
                  @click.stop="toggleBookmark(index)"
                />
              </div>
              <div class="bookmark-icon" aria-hidden="true">
                <img
                  v-if="bookmark.url"
                  :src="getFaviconUrl(bookmark.url)"
                  :alt="bookmark.title"
                  @error="handleIconError"
                />
                <span v-else class="default-icon">🔖</span>
              </div>
              <div class="bookmark-content">
                <h3 class="bookmark-title">{{ bookmark.title }}</h3>
                <a
                  v-if="bookmark.url"
                  :href="bookmark.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bookmark-url"
                  :aria-label="`打开链接：${bookmark.url}`"
                  @click.stop
                >
                  {{ bookmark.url }}
                </a>
                <p v-if="bookmark.description" class="bookmark-description">
                  {{ bookmark.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-container">
      <div class="empty-icon">📭</div>
      <h2 class="empty-title">没有找到分享内容</h2>
      <p class="empty-message">请检查分享链接是否完整</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getShareDataFromUrl, type ShareData } from '@/utils/share-service'
import { detectExtension } from '@/utils/extension-detector'
import {
  importService,
  type FolderNode,
  type ImportResult
} from '@/utils/import-service'

// 状态
const isLoading = ref(true)
const error = ref<string | null>(null)
const shareData = ref<ShareData | null>(null)
const selectedBookmarks = ref<Set<number>>(new Set())
const isExtensionInstalled = ref(false)

// 导入相关状态
const folderTree = ref<FolderNode[]>([])
const selectedFolderId = ref<string>('')
const isImporting = ref(false)
const importProgress = ref({ current: 0, total: 0 })
const importResult = ref<ImportResult | null>(null)

// 移动端检测
const isMobile = ref(false)

// 扩展链接
const { extensionLink } = useProductLinks()

// 检测是否为移动设备
const checkMobile = () => {
  if (typeof window === 'undefined') return false
  
  // 检查 User Agent
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile', 'webos']
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword))
  
  // 检查屏幕宽度
  const isMobileWidth = window.innerWidth < 768
  
  // 检查触摸支持
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  return isMobileUA || (isMobileWidth && hasTouchScreen)
}

// 计算属性：扁平化的文件夹列表（用于下拉框）
const flatFolders = computed(() => {
  const flatten = (
    nodes: FolderNode[],
    level = 0
  ): Array<{ id: string; title: string; level: number }> => {
    const result: Array<{ id: string; title: string; level: number }> = []
    for (const node of nodes) {
      result.push({
        id: node.id,
        title: node.title,
        level
      })
      if (node.children) {
        result.push(...flatten(node.children, level + 1))
      }
    }
    return result
  }
  return flatten(folderTree.value)
})

// 加载分享数据
const loadShareData = () => {
  isLoading.value = true
  error.value = null

  try {
    const data = getShareDataFromUrl()

    if (!data) {
      error.value = '分享链接中没有数据，请检查链接是否完整'
      return
    }

    shareData.value = data

    // 默认全选所有书签
    if (isExtensionInstalled.value) {
      data.bookmarks.forEach((_, index) => {
        selectedBookmarks.value.add(index)
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败，请重试'
  } finally {
    isLoading.value = false
  }
}

// 检测扩展是否安装
const checkExtension = async () => {
  try {
    const installed = await detectExtension()
    isExtensionInstalled.value = installed

    if (installed) {
      console.log('✅ 检测到 AcuityBookmarks 扩展已安装')

      // 加载文件夹树
      await loadFolderTree()
    } else {
      console.log('❌ 未检测到 AcuityBookmarks 扩展')
    }
  } catch (error) {
    console.error('检测扩展失败:', error)
    isExtensionInstalled.value = false
  }
}

// 加载文件夹树
const loadFolderTree = async () => {
  try {
    const tree = await importService.getFolderTree()
    folderTree.value = tree

    // 设置默认文件夹
    const defaultFolderId = await importService.getDefaultFolderId()
    selectedFolderId.value = defaultFolderId

    console.log('✅ 文件夹树加载成功', {
      folderCount: flatFolders.value.length,
      defaultFolderId
    })
  } catch (error) {
    console.error('加载文件夹树失败:', error)
  }
}

// 切换书签选择
const toggleBookmark = (index: number) => {
  if (!isExtensionInstalled.value) return

  if (selectedBookmarks.value.has(index)) {
    selectedBookmarks.value.delete(index)
  } else {
    selectedBookmarks.value.add(index)
  }
}

// 清除选择
const clearSelection = () => {
  selectedBookmarks.value.clear()
}

// 导入选中的书签
const importSelected = async () => {
  if (!shareData.value || selectedBookmarks.value.size === 0) return
  if (!selectedFolderId.value) {
    alert('请选择目标文件夹')
    return
  }

  const bookmarksToImport = Array.from(selectedBookmarks.value)
    .map((index) => shareData.value!.bookmarks[index])
    .filter((bookmark): bookmark is { title: string; url: string; description?: string } => 
      bookmark !== undefined
    )

  isImporting.value = true
  importProgress.value = { current: 0, total: bookmarksToImport.length }
  importResult.value = null

  try {
    const result = await importService.importBookmarks({
      bookmarks: bookmarksToImport,
      targetFolderId: selectedFolderId.value,
      onProgress: (current, total) => {
        importProgress.value = { current, total }
      }
    })

    importResult.value = result

    if (result.failed === 0) {
      alert(`✅ 成功导入 ${result.success} 个书签！`)
    } else {
      alert(
        `⚠️ 导入完成：成功 ${result.success} 个，失败 ${result.failed} 个\n\n失败原因：\n${result.errors.map((e) => `- ${e.bookmark}: ${e.error}`).join('\n')}`
      )
    }

    // 清除选择
    selectedBookmarks.value.clear()
  } catch (error) {
    console.error('导入失败:', error)
    alert(`❌ 导入失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isImporting.value = false
  }
}

// 获取 favicon URL
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

// 处理图标加载错误
const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes} 分钟前`
  }

  // 小于 24 小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours} 小时前`
  }

  // 小于 7 天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days} 天前`
  }

  // 显示完整日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 复制分享链接（移动端）
const copyShareLink = async () => {
  try {
    const currentUrl = window.location.href
    await navigator.clipboard.writeText(currentUrl)
    alert('✅ 链接已复制到剪贴板')
  } catch (error) {
    console.error('复制链接失败:', error)
    alert('❌ 复制失败，请手动复制链接')
  }
}

// 使用系统分享 API（移动端）
const shareToFriends = async () => {
  if (!shareData.value) return
  
  try {
    // 检查是否支持 Web Share API
    if (navigator.share) {
      await navigator.share({
        title: shareData.value.title,
        text: `${shareData.value.title} - 分享了 ${shareData.value.bookmarks.length} 个书签`,
        url: window.location.href
      })
      console.log('✅ 分享成功')
    } else {
      // 降级到复制链接
      await copyShareLink()
    }
  } catch (error) {
    // 用户取消分享不算错误
    if ((error as Error).name !== 'AbortError') {
      console.error('分享失败:', error)
      alert('❌ 分享失败，请重试')
    }
  }
}

// 页面加载时执行
onMounted(async () => {
  // 检测移动设备
  isMobile.value = checkMobile()
  console.log('📱 移动端检测结果:', isMobile.value)
  
  // 只在桌面端检测扩展
  if (!isMobile.value) {
    await checkExtension()
  }
  
  loadShareData()
})

// SEO
useSeoMeta({
  title: '分享的书签 - AcuityBookmarks',
  description: '查看朋友分享的书签收藏',
  robots: 'noindex, nofollow' // 分享页面不需要被搜索引擎索引
})
</script>

<style scoped>
/* 屏幕阅读器专用（视觉上隐藏） */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}

.share-landing-page {
  min-height: 100vh;
  background: var(--color-bg-depth, #0a0a0a);
  color: var(--color-content-primary, #ffffff);
}

/* 容器 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* 加载状态 */
.loading-container,
.error-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-primary, #83d5c5);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 1rem;
  font-size: 1.125rem;
  color: var(--color-content-muted, #a0a0a0);
}

/* 错误状态 */
.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-message {
  font-size: 1rem;
  color: var(--color-content-muted, #a0a0a0);
  margin-bottom: 1.5rem;
}

.retry-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--color-primary, #83d5c5);
  color: var(--color-bg-depth, #0a0a0a);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.retry-button:hover {
  opacity: 0.9;
}

/* 空状态 */
.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-message {
  font-size: 1rem;
  color: var(--color-content-muted, #a0a0a0);
}

/* 头部 */
.share-header {
  padding: 3rem 0 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.share-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.share-meta {
  font-size: 1rem;
  color: var(--color-content-muted, #a0a0a0);
}

.share-time {
  opacity: 0.7;
}

/* 扩展提示 */
.extension-prompt {
  padding: 2rem 0;
  background: linear-gradient(
    135deg,
    rgba(131, 213, 197, 0.1),
    rgba(131, 213, 197, 0.05)
  );
  border-bottom: 1px solid rgba(131, 213, 197, 0.2);
}

/* 移动端提示 */
.mobile-prompt {
  padding: 2rem 0;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.1),
    rgba(59, 130, 246, 0.05)
  );
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.mobile-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mobile-actions .action-button {
  flex: 1;
  min-width: 140px;
}

.prompt-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
}

.prompt-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.prompt-text {
  flex: 1;
}

.prompt-text h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.prompt-text p {
  font-size: 0.875rem;
  color: var(--color-content-muted, #a0a0a0);
}

.install-button {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: var(--color-primary, #83d5c5);
  color: var(--color-bg-depth, #0a0a0a);
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.install-button:hover {
  opacity: 0.9;
}

/* 书签区域 */
.bookmarks-section {
  padding: 3rem 0;
}

.bookmarks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.bookmarks-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.bookmarks-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.folder-select {
  padding: 0.625rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-content-primary, #ffffff);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 200px;
}

.folder-select:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(131, 213, 197, 0.3);
}

.folder-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.folder-select option {
  background: var(--color-bg-depth, #0a0a0a);
  color: var(--color-content-primary, #ffffff);
}

.action-button {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.primary {
  background: var(--color-primary, #83d5c5);
  color: var(--color-bg-depth, #0a0a0a);
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-content-primary, #ffffff);
}

.action-button:not(:disabled):hover {
  opacity: 0.9;
}

/* 书签列表 */
.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bookmark-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.bookmark-item.mobile-item {
  cursor: default;
}

.bookmark-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(131, 213, 197, 0.3);
}

.bookmark-item.mobile-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: transparent;
}

.bookmark-item.selected {
  background: rgba(131, 213, 197, 0.1);
  border-color: var(--color-primary, #83d5c5);
}

.bookmark-checkbox {
  flex-shrink: 0;
  padding-top: 0.25rem;
}

.bookmark-checkbox input[type='checkbox'] {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.bookmark-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.1);
}

.bookmark-icon img {
  width: 24px;
  height: 24px;
  border-radius: 0.25rem;
}

.default-icon {
  font-size: 1.25rem;
}

.bookmark-content {
  flex: 1;
  min-width: 0;
}

.bookmark-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-url {
  display: block;
  font-size: 0.875rem;
  color: var(--color-primary, #83d5c5);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
}

.bookmark-url:hover {
  text-decoration: underline;
}

.bookmark-description {
  font-size: 0.875rem;
  color: var(--color-content-muted, #a0a0a0);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 响应式 */
@media (max-width: 768px) {
  .share-title {
    font-size: 1.5rem;
  }

  .prompt-content {
    flex-direction: column;
    text-align: center;
  }

  .bookmarks-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .bookmarks-actions {
    width: 100%;
    flex-direction: column;
  }

  .action-button {
    flex: 1;
    width: 100%;
  }

  .folder-select {
    width: 100%;
  }

  .mobile-actions {
    width: 100%;
  }

  .mobile-actions .action-button {
    min-width: auto;
  }
}
</style>
