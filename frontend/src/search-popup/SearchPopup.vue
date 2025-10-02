<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { logger } from '../utils/logger'

// 使用通用搜索组件
import BookmarkSearchBox from '../components/BookmarkSearchBox.vue';
import type { EnhancedBookmarkResult } from '../composables/useBookmarkSearch';

// 📱 本地UI状态
const isWindowFocused = ref(true);
const isLoading = ref(true);

// 📝 事件处理函数

// 打开书签并关闭搜索窗口
function handleResultClick(result: EnhancedBookmarkResult): void {
  try {
    if (result.url) {
      chrome.tabs.create({ url: result.url }, () => {
        window.close(); // 打开书签后关闭搜索窗口
      });
    }
  } catch (error) {
    logger.error('SearchPopup', '打开书签失败', error);
  }
}

// 处理搜索事件
function handleSearch(query: string, results: EnhancedBookmarkResult[]): void {
  logger.info('SearchPopup', `搜索 "${query}" 找到 ${results.length} 个结果`);
}

// 处理窗口焦点
function handleFocus(): void {
  // 当搜索框获得焦点时，可以添加一些逻辑
}

// 处理窗口失焦
function handleBlur(): void {
  // 延迟关闭，给用户时间点击结果
  setTimeout(() => {
    if (!isWindowFocused.value) {
      window.close();
    }
  }, 200);
}

// 处理Enter键
function handleEnter(query: string): void {
  logger.info('SearchPopup', '用户按下Enter键，查询', query);
}

// 🖥️ 窗口事件处理函数
function handleWindowFocus(): void {
  isWindowFocused.value = true;
}

function handleWindowBlur(): void {
  isWindowFocused.value = false;
  // 延迟关闭，避免点击时意外关闭
  setTimeout(() => {
    if (!isWindowFocused.value) {
      window.close();
    }
  }, 300);
}

function handleWindowClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const searchContainer = document.querySelector('.search-popup-container');
  
  // 如果点击在搜索容器外，关闭窗口
  if (searchContainer && !searchContainer.contains(target)) {
    window.close();
  }
}

// 按键处理
function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    window.close();
  }
}

// 工具函数
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// 🔧 组件生命周期
onMounted(async () => {
  logger.info('SearchPopup', '🚀 SearchPopup mounted');
  
  try {
    const __initStart = performance.now();
    
    // 添加事件监听器
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('click', handleWindowClick);
    document.addEventListener('keydown', handleKeyDown);
    
    // 初始化完成
    isLoading.value = false;
    
    // 自动聚焦到搜索框
    setTimeout(() => {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
    
    logger.debug('SearchPopup', `search-popup-init 耗时: ${(performance.now() - __initStart).toFixed(2)}ms`);
    logger.info('SearchPopup', '✅ SearchPopup 初始化完成');
    
  } catch (error) {
    logger.error('SearchPopup', '❌ SearchPopup 初始化失败', error);
    isLoading.value = false;
  }
});

// 🧹 清理资源
onUnmounted(() => {
  logger.info('SearchPopup', '🧹 SearchPopup unmounted - 清理资源');
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
  document.removeEventListener('click', handleWindowClick);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="search-popup-container" @click="handleWindowClick">
    <div class="search-popup-content" @click.stop>
      <!-- AI 状态徽章 -->
      <div class="ai-status-row">
 
      </div>
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">正在初始化...</p>
      </div>
      
      <!-- 主要内容 - 使用通用搜索组件 -->
      <div v-else class="search-section">
        <BookmarkSearchBox
          :show-dropdown="true"
          :show-stats="false"
          :show-path="true"
          :show-url="true"
          :max-display-results="10"
          placeholder="搜索书签..."
          variant="outlined"
          density="comfortable"
          class="search-popup-search-box"
          @result-click="handleResultClick"
          @search="handleSearch"
          @focus="handleFocus"
          @blur="handleBlur"
          @enter="handleEnter"
        >
          <!-- 可以通过插槽自定义搜索结果项的显示 -->
          <template #result-item="{ result }">
            <div class="search-popup-result-item">
              <div class="result-icon">
                <img 
                  v-if="result.url" 
                  :src="`https://www.google.com/s2/favicons?domain=${extractDomain(result.url)}&sz=16`"
                  width="16"
                  height="16"
                  alt=""
                  @error="($event.target as HTMLElement).style.display = 'none'"
                />
                <div v-else class="folder-icon">📁</div>
              </div>
              <div class="result-content">
                <div class="result-title">{{ result.title || '未命名' }}</div>
                <div v-if="result.url" class="result-url">{{ result.url }}</div>
                <div v-if="result.path?.length" class="result-path">
                  {{ result.path.join(' > ') }}
                </div>
              </div>
            </div>
          </template>
        </BookmarkSearchBox>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mac风格的搜索弹窗样式 */
.search-popup-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  padding: 80px 20px 20px;
}

.search-popup-content {
  width: 100%;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: fadeInUp 0.3s ease-out;
}

.ai-status-row {
  display: flex;
  justify-content: flex-end;
  padding: 10px 12px 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top: 3px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin: 0;
  font-size: 14px;
  color: #86868b;
}

.search-section {
  padding: 20px;
}

.search-popup-search-box {
  width: 100%;
}

/* 自定义搜索结果项样式 */
.search-popup-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.result-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-icon img {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.folder-icon {
  font-size: 16px;
  line-height: 1;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-url {
  font-size: 12px;
  color: #86868b;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-path {
  font-size: 11px;
  color: #a1a1a6;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-popup-container {
    padding: 40px 16px 16px;
  }
  
  .search-popup-content {
    max-width: 100%;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .search-popup-content {
    background: rgba(28, 28, 30, 0.95);
  }
  
  .loading-text {
    color: #a1a1a6;
  }
  
  .result-title {
    color: #f2f2f7;
  }
  
  .result-url {
    color: #8e8e93;
  }
  
  .result-path {
    color: #636366;
  }
}
</style>





