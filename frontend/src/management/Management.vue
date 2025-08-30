<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import BookmarkTree from './BookmarkTree.vue'; // We'll create this component next

// --- Type Definitions ---
interface ProposalNode {
  id: string;
  title: string;
  url?: string;
  children?: ProposalNode[];
  isRoot?: boolean;
}

// --- State ---
const stats = reactive({
  totalFolders: 0,
  totalBookmarks: 0,
  aiProcessed: 0,
});

const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([]);
const newProposalTree = ref<ProposalNode>({ id: 'root-0', title: 'root', children: [], isRoot: true });

const originalLoading = ref(true);
const proposalLoading = ref(true);

// --- Data Conversion (from original management.js) ---
function convertLegacyProposalToTree(proposal: any): ProposalNode {
  const root: ProposalNode = { title: 'root', children: [], isRoot: true, id: 'root-0' };
  
  const findOrCreateNode = (path: string[]): ProposalNode => {
    let current: ProposalNode = root;
    path.forEach(part => {
      let node = current.children?.find(child => child.title === part && child.children);
      if (!node) {
        node = { title: part, children: [], id: `folder-${Date.now()}-${Math.random()}` };
        if (!current.children) {
          current.children = [];
        }
        current.children.push(node);
      }
      current = node;
    });
    return current;
  };

  if (proposal['书签栏'] && typeof proposal['书签栏'] === 'object') {
    for (const categoryPath in proposal['书签栏']) {
      const pathParts = categoryPath.split(' / ');
      const leafNode = findOrCreateNode(['书签栏', ...pathParts]);
      const bookmarks = proposal['书签栏'][categoryPath];
      if (Array.isArray(bookmarks) && leafNode.children) {
        leafNode.children.push(...bookmarks);
      }
    }
  }

  if (proposal['其他书签'] && Array.isArray(proposal['其他书签'])) {
    const otherBookmarksNode = findOrCreateNode(['其他书签']);
    if (otherBookmarksNode.children) {
      otherBookmarksNode.children.push(...proposal['其他书签']);
    }
  }
  
  return root;
}

// --- Stats Calculation ---
function updateStats() {
  function countRecursively(nodes: any[]) {
    let folders = 0;
    let bookmarks = 0;
    nodes.forEach(node => {
      if (node.url) {
        bookmarks++;
      } else if (node.children) {
        folders++;
        const childStats = countRecursively(node.children);
        folders += childStats.folders;
        bookmarks += childStats.bookmarks;
      }
    });
    return { folders, bookmarks };
  }

  if (originalTree.value.length > 0) {
    const originalStats = countRecursively(originalTree.value);
    stats.totalFolders = originalStats.folders;
    stats.totalBookmarks = originalStats.bookmarks;
  }
  if (newProposalTree.value.children) {
    const newStats = countRecursively(newProposalTree.value.children);
    stats.aiProcessed = newStats.bookmarks;
  }
}

// --- Lifecycle ---
onMounted(() => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['originalTree', 'newProposal'], (data) => {
      if (data.originalTree) {
        originalTree.value = data.originalTree[0]?.children || [];
        originalLoading.value = false;
      } else {
        originalLoading.value = false; // Handle case where there's no data
      }

      if (data.newProposal) {
        newProposalTree.value = convertLegacyProposalToTree(data.newProposal);
        proposalLoading.value = false;
      } else {
        proposalLoading.value = false; // Handle case where there's no data
      }
      
      updateStats();
    });
  } else {
    // Mock data for development outside of extension
    console.warn("Not in extension context. Loading mock data.");
    originalLoading.value = false;
    proposalLoading.value = false;
  }
});

// --- Placeholder Methods for buttons ---
const applyChanges = () => alert('功能待实现: 应用新结构');
const previewChanges = () => alert('功能待实现: 预览更改');
const exportStructure = () => alert('功能待实现: 导出配置');
const refresh = () => {
  alert('正在请求后台重新生成建议...');
  chrome.runtime.sendMessage({ action: 'startRestructure' });
};

</script>

<template>
  <div class="management-body">
    <!-- Top App Bar -->
    <header class="app-bar">
      <div class="app-bar-content">
        <div class="app-bar-left">
          <img src="../../../logo.svg" alt="AcuityBookmarks Logo" class="app-logo">
          <h1 class="app-title">AcuityBookmarks</h1>
          <span class="app-subtitle">智能书签重构建议</span>
        </div>
        <div class="app-bar-right">
          <input id="search" type="search" placeholder="搜索书签..." class="search-input">
          <button class="btn-icon" @click="refresh" title="重新生成">
            <i class="material-icons">refresh</i>
          </button>
          <div class="header-actions">
            <button class="btn primary" @click="applyChanges">
              <i class="material-icons left">check</i>
              应用新结构
            </button>
            <button class="btn" @click="previewChanges">
              <i class="material-icons left">preview</i>
              预览更改
            </button>
            <button class="btn" @click="exportStructure">
              <i class="material-icons left">download</i>
              导出配置
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Stats Cards -->
      <section class="stats-section">
        <div class="stats-card">
          <div class="stats-icon"><i class="material-icons">folder</i></div>
          <div class="stats-content">
            <div class="stats-number">{{ stats.totalFolders }}</div>
            <div class="stats-label">文件夹</div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-icon"><i class="material-icons">bookmark</i></div>
          <div class="stats-content">
            <div class="stats-number">{{ stats.totalBookmarks }}</div>
            <div class="stats-label">书签</div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-icon"><i class="material-icons">auto_fix_high</i></div>
          <div class="stats-content">
            <div class="stats-number">{{ stats.aiProcessed }}</div>
            <div class="stats-label">AI分类</div>
          </div>
        </div>
      </section>

      <!-- Comparison Section -->
      <section class="comparison-section">
        <div class="comparison-panel">
          <div class="panel-header">
            <h2 class="panel-title"><i class="material-icons">folder_open</i> 当前结构</h2>
            <span class="panel-subtitle">您现有的书签组织</span>
          </div>
          <div class="panel-content">
            <div v-if="originalLoading" class="loading-state">加载中...</div>
            <div v-else-if="originalTree.length === 0" class="loading-state">无数据显示</div>
            <BookmarkTree v-else :nodes="originalTree" />
          </div>
        </div>

        <div class="comparison-divider">
          <div class="divider-icon"><i class="material-icons">arrow_forward</i></div>
        </div>

        <div class="comparison-panel">
          <div class="panel-header">
            <h2 class="panel-title"><i class="material-icons">auto_awesome</i> AI优化建议</h2>
            <span class="panel-subtitle">基于内容的智能分类</span>
          </div>
          <div class="panel-content">
            <div v-if="proposalLoading" class="loading-state">AI分析中...</div>
            <div v-else-if="!newProposalTree.children || newProposalTree.children.length === 0" class="loading-state">无建议</div>
            <BookmarkTree v-else :nodes="newProposalTree.children" :is-proposal="true" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* Using a subset of styles from style.css, adapted for scoped styles */
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

:root {
  --md-primary-60: #2962ff;
  --md-surface-container: #f1ecf4;
  --md-on-surface: #1d1b20;
  --md-on-surface-variant: #49454f;
  --md-outline-variant: #cab6cf;
}

.management-body {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Roboto', sans-serif;
  background-color: #f7f2fa;
}

.app-bar {
  background: linear-gradient(135deg, #2962ff, #004fc6);
  color: white;
  box-shadow: 0 3px 6px rgba(0,0,0,0.16);
  z-index: 1000;
  flex-shrink: 0;
  height: 64px;
}
.app-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 100%;
  max-width: 1600px;
  margin: 0 auto;
}
.app-bar-left { display: flex; align-items: center; gap: 16px; }
.app-logo { height: 32px; }
.app-title { font-size: 22px; font-weight: 500; margin: 0; }
.app-subtitle { font-size: 14px; opacity: 0.9; font-weight: 300; }
.app-bar-right { display: flex; align-items: center; gap: 16px; }
.search-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 24px;
  color: white;
  padding: 8px 16px;
  font-size: 14px;
  width: 300px;
}
.header-actions { display: flex; align-items: center; gap: 8px; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 24px;
  font-weight: 500;
  text-transform: none;
  border: 1px solid transparent;
  padding: 0 20px;
  height: 40px;
  font-size: 14px;
  cursor: pointer;
  color: white;
  background-color: transparent;
  border-color: rgba(255, 255, 255, 0.5);
}
.btn.primary {
  background: rgba(255, 255, 255, 0.9);
  color: var(--md-primary-60);
}
.btn-icon {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-icon:hover { background: rgba(255,255,255,0.1); }

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 24px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  overflow: hidden;
}

.stats-section { display: flex; gap: 16px; flex-shrink: 0; }
.stats-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  flex: 1;
}
.stats-icon {
  background: linear-gradient(135deg, #2962ff, #004fc6);
  color: white;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stats-content { flex: 1; }
.stats-number { font-size: 24px; font-weight: 600; color: var(--md-on-surface); }
.stats-label { font-size: 14px; color: var(--md-on-surface-variant); margin-top: 4px; }

.comparison-section { display: flex; gap: 24px; flex: 1; min-height: 0; }
.comparison-panel {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.panel-header {
  padding: 16px 24px;
  border-bottom: 1px solid #ebe6ee;
  flex-shrink: 0;
}
.panel-title {
  font-size: 20px;
  font-weight: 500;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.panel-title i { color: var(--md-primary-60); }
.panel-subtitle { font-size: 14px; color: var(--md-on-surface-variant); margin-top: 4px; }
.panel-content { flex: 1; overflow: auto; padding: 16px 24px 24px; }

.comparison-divider { display: flex; align-items: center; }
.divider-icon {
  background: var(--md-primary-60);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 6px rgba(0,0,0,0.16);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--md-on-surface-variant);
}
</style>
