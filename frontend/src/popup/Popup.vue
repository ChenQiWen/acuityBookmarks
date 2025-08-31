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
      setTimeout(() => window.close(), 500);
    } else {
      isAdding.value = false;
    }
  });
}

function openAiOrganizePage() {
  chrome.runtime.sendMessage({ action: 'showManagementPageAndOrganize' });
  window.close();
}

function openManualOrganizePage() {
  chrome.runtime.sendMessage({ action: 'showManagementPage' });
  window.close();
}

function clearCacheAndRestructure() {
  chrome.runtime.sendMessage({ action: 'clearCacheAndRestructure' });
  window.close();
}

// --- Lifecycle Hooks ---
onMounted(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
      currentTab.value = tabs[0];
    }
  });

  chrome.bookmarks.getTree((tree) => {
    const totalStats = countBookmarks(tree);
    totalStats.folders = totalStats.folders > 0 ? totalStats.folders - 1 : 0;
    stats.value = totalStats;
  });

  chrome.storage.local.get('processedAt', (data) => {
    if (data.processedAt) {
      const date = new Date(data.processedAt);
      lastProcessedInfo.value = `上次整理于: ${date.toLocaleString()}`;
    }
  });
});
</script>

<template>
  <v-app style="width: 350px; height: auto;">
    <div class="popup-header">
      <v-icon size="x-large" color="white">mdi-auto-awesome</v-icon>
      <h4 class="mt-2">AcuityBookmarks</h4>
      <p class="popup-subtitle">您的智能书签助手</p>
    </div>

    <v-main class="pa-4">
      <!-- Quick Add Section -->
      <div v-if="currentTab">
        <div class="text-overline">快速收藏当前页面</div>
        <v-card variant="tonal" class="mb-3">
          <v-card-text>
            <p class="truncate font-weight-bold">{{ currentTab.title }}</p>
            <p class="truncate text-caption text-grey">{{ currentTab.url }}</p>
          </v-card-text>
        </v-card>
        <v-btn 
          :loading="isAdding" 
          @click="quickAddBookmark" 
          block 
          color="primary" 
          prepend-icon="mdi-plus-circle"
          class="mb-4"
        >
          添加到AI建议
        </v-btn>
      </div>

      <!-- Dashboard Section -->
      <div>
        <div class="text-overline">概览</div>
        <v-row dense class="text-center my-2">
          <v-col>
            <v-icon color="primary">mdi-bookmark-multiple-outline</v-icon>
            <div class="text-h6">{{ stats.bookmarks }}</div>
            <div class="text-caption">书签总数</div>
          </v-col>
          <v-col>
            <v-icon color="primary">mdi-folder-outline</v-icon>
            <div class="text-h6">{{ stats.folders }}</div>
            <div class="text-caption">文件夹</div>
          </v-col>
        </v-row>
        <div class="text-caption text-center text-grey mb-3">{{ lastProcessedInfo }}</div>
        
        <v-btn @click="openAiOrganizePage" block color="primary" prepend-icon="mdi-auto-fix-high" class="mb-2">
          一键 AI 整理
        </v-btn>
        <v-btn @click="openManualOrganizePage" block color="blue" prepend-icon="mdi-cog" variant="outlined">
          手动整理
        </v-btn>
        
        <div class="d-flex justify-center align-center mt-3">
            <v-btn @click="clearCacheAndRestructure" variant="text" size="small" class="clear-btn">清除缓存</v-btn>
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="x-small" class="ml-1">mdi-help-circle-outline</v-icon>
              </template>
              <span>为了加快分析速度，AI会缓存已成功访问的网页内容。若您觉得分类结果不准，可清除缓存后重试。</span>
            </v-tooltip>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<style scoped>
.popup-header {
  background: linear-gradient(135deg, #2962ff, #004fc6);
  color: white;
  padding: 24px 20px;
  text-align: center;
}
.popup-subtitle {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
  font-weight: 300;
}
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clear-btn {
    font-size: 12px !important;
    text-decoration: underline;
    color: #757575;
}
</style>
