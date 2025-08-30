<script setup lang="ts">
import { ref, onMounted } from 'vue';

// --- Reactive State ---
const currentTab = ref<chrome.tabs.Tab | null>(null);
const stats = ref({ bookmarks: 0, folders: 0 });
const lastProcessedInfo = ref('尚未进行过AI整理');
const isAdding = ref(false);

// --- Utility Functions ---
function countBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): { bookmarks: number; folders: number } {
  let bookmarks = 0;
  let folders = 0;
  for (const node of nodes) {
    if (node.url) {
      bookmarks++;
    } else if (node.children) {
      folders++;
      const childStats = countBookmarks(node.children);
      bookmarks += childStats.bookmarks;
      folders += childStats.folders;
    }
  }
  return { bookmarks, folders };
}

// --- Event Handlers ---
function quickAddBookmark() {
  if (!currentTab.value) return;

  isAdding.value = true;
  const bookmark = {
    title: currentTab.value.title,
    url: currentTab.value.url,
    id: `temp-${Date.now()}`
  };

  chrome.runtime.sendMessage({ action: 'quickAddBookmark', bookmark }, (response) => {
    if (response && response.success) {
      // Optionally show a success message before closing
      setTimeout(() => window.close(), 500);
    } else {
      // Optionally show an error message
      isAdding.value = false;
    }
  });
}

function openManagementPage() {
  chrome.runtime.sendMessage({ action: 'showManagementPage' });
  window.close();
}

function refreshProposal() {
  chrome.runtime.sendMessage({ action: 'startRestructure' });
  window.close();
}

function clearCacheAndRestructure() {
  chrome.runtime.sendMessage({ action: 'clearCacheAndRestructure' });
  window.close();
}

// --- Lifecycle Hooks ---
onMounted(() => {
  // 1. Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
      currentTab.value = tabs[0];
    }
  });

  // 2. Get bookmark stats
  chrome.bookmarks.getTree((tree) => {
    const totalStats = countBookmarks(tree);
    // Subtract the root nodes which are also folders
    totalStats.folders = totalStats.folders > 0 ? totalStats.folders - 1 : 0;
    stats.value = totalStats;
  });

  // 3. Get last processed info
  chrome.storage.local.get('processedAt', (data) => {
    if (data.processedAt) {
      const date = new Date(data.processedAt);
      lastProcessedInfo.value = `上次整理于: ${date.toLocaleString()}`;
    }
  });
});
</script>

<template>
  <div class="popup-container">
    <div class="popup-header">
      <div class="popup-icon"><i class="material-icons">auto_awesome</i></div>
      <h4>AcuityBookmarks</h4>
      <p class="popup-subtitle">您的智能书签助手</p>
    </div>

    <div class="popup-content">
      <!-- Quick Add Section -->
      <div v-if="currentTab" id="quickAddSection">
        <p class="section-title">快速收藏当前页面</p>
        <div class="card-panel">
          <p class="truncate">{{ currentTab.title }}</p>
          <p class="truncate grey-text">{{ currentTab.url }}</p>
        </div>
        <button class="btn" @click="quickAddBookmark" :disabled="isAdding">
          <i class="material-icons left">{{ isAdding ? 'hourglass_empty' : 'add_circle' }}</i>
          {{ isAdding ? '添加中...' : '添加到AI建议' }}
        </button>
      </div>

      <!-- Dashboard Section -->
      <div id="dashboardSection">
        <p class="section-title">概览</p>
        <div class="stats-row">
          <div class="stat-item">
            <i class="material-icons">bookmark_border</i>
            <span class="stat-value">{{ stats.bookmarks }}</span>
            <span>书签总数</span>
          </div>
          <div class="stat-item">
            <i class="material-icons">create_new_folder</i>
            <span class="stat-value">{{ stats.folders }}</span>
            <span>文件夹</span>
          </div>
        </div>
        <div class="last-processed-info">{{ lastProcessedInfo }}</div>
        <button class="btn blue" @click="openManagementPage">
          <i class="material-icons left">settings</i>查看和管理
        </button>
        <a href="#!" @click.prevent="refreshProposal" class="btn-flat right">重新生成建议</a>
      </div>
      <div class="footer-actions">
        <a href="#!" @click.prevent="clearCacheAndRestructure" class="clear-cache-btn">清除缓存并重新生成</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Minimalist recreation of the original style for Vue component */
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

.popup-container {
  width: 350px;
  height: auto;
  font-family: 'Roboto', sans-serif;
  color: #1d1b20;
}

.popup-header {
  background: linear-gradient(135deg, #2962ff, #004fc6);
  color: white;
  padding: 24px 20px;
  text-align: center;
}

.popup-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.popup-icon i {
  font-size: 24px;
  color: white;
}

h4 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 500;
}

.popup-subtitle {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
  font-weight: 300;
}

.popup-content {
  padding: 16px 20px;
}

.section-title {
  font-size: 12px;
  color: #79747e;
  text-transform: uppercase;
  margin-bottom: 8px;
  font-weight: 500;
}

.card-panel {
  background: #f1ecf4;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grey-text {
  color: #49454f;
  font-size: 12px;
}

.btn {
  width: 100%;
  border-radius: 24px;
  background: linear-gradient(135deg, #2962ff, #004fc6);
  box-shadow: 0 3px 6px rgba(0,0,0,0.16);
  color: white;
  font-weight: 500;
  text-transform: none;
  margin-bottom: 16px;
  height: 48px;
  font-size: 14px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}
.btn:hover {
  box-shadow: 0 10px 20px rgba(0,0,0,0.19);
  transform: translateY(-1px);
}
.btn:disabled {
  background: #ebe6ee;
  color: #79747e;
  cursor: not-allowed;
}
.btn.blue {
  background: linear-gradient(135deg, #1e88e5, #0d47a1);
}

.btn i {
  margin-right: 8px;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  text-align: center;
  margin: 16px 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #49454f;
}
.stat-item i {
  font-size: 28px;
  color: #2962ff;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #1d1b20;
}
.stat-item span {
  font-size: 12px;
}

.last-processed-info {
  font-size: 12px;
  text-align: center;
  color: #79747e;
  margin-top: -8px;
  margin-bottom: 16px;
}

.btn-flat {
  background: none;
  border: none;
  color: #2962ff;
  cursor: pointer;
  padding: 8px;
  font-size: 14px;
  text-transform: uppercase;
  font-weight: 500;
}
.right {
  float: right;
}

.footer-actions {
  text-align: center;
  margin-top: 8px;
}
.clear-cache-btn {
  color: #79747e;
  font-size: 12px;
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
}
</style>
