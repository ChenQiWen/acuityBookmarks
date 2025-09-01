














DËDAZAA                     <script setup lang="ts">
VZXCVBNM,.XCASDFGHJQWERTY4ERDDD4ERTV6YBUJIKKOOIK,P0PL.[PageRevealEvent;] 
import { ref, onMounted, watch } from 'vue';
import BookmarkTree from './BookmarkTree.vue';

// --- State ---
const searchQuery = ref('');
const searchMode = ref('exact'); // 'exact' or 'ai'
const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([]);
const newProposalTree = ref<ProposalNode>({ id: 'root-0', title: 'root', children: [] });
const structuresAreDifferent = ref(false);

const isGenerating = ref(false);
const progressValue = ref(0);
const progressTotal = ref(0);
const isApplyConfirmDialogOpen = ref(false);
const autoOrganizeEnabled = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');

// --- Type Definitions ---
interface ProposalNode {
  id: string;
  title: string;
  url?: string;
  children?: ProposalNode[];
}

// --- Comparison Logic ---
function getComparable(nodes: any[]): any[] {
  if (!nodes || nodes.length === 0) return [];
  return nodes.map(node => {
    const newNode: any = { title: node.title };
    if (node.url) {
      newNode.url = node.url;
    }
    if (node.children && node.children.length > 0) {
      newNode.children = getComparable(node.children);
    }
    return newNode;
  });
}

function updateComparisonState() {
  const originalComparable = getComparable(originalTree.value);
  const proposalComparable = getComparable(newProposalTree.value.children || []);
  structuresAreDifferent.value = JSON.stringify(originalComparable) !== JSON.stringify(proposalComparable);
}

// --- Lifecycle & Event Listeners ---
onMounted(() => {
  chrome.storage.sync.get('autoOrganizeEnabled', (data) => {
    autoOrganizeEnabled.value = !!data.autoOrganizeEnabled;
  });

  chrome.storage.local.get(['originalTree', 'newProposal', 'isGenerating', 'progressCurrent', 'progressTotal'], (data) => {
    if (data.originalTree) {
      originalTree.value = JSON.parse(JSON.stringify(data.originalTree[0]?.children || []));
    }
    if (data.newProposal) {
      const proposal = convertLegacyProposalToTree(data.newProposal);
      newProposalTree.value = JSON.parse(JSON.stringify(proposal));
    }
    updateComparisonState();

    isGenerating.value = data.isGenerating || false;
    progressTotal.value = data.progressTotal || 0;
    progressValue.value = progressTotal.value > 0 ? ((data.progressCurrent || 0) / progressTotal.value) * 100 : 0;
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'applyComplete') {
      snackbarText.value = '新书签结构已成功应用！';
      snackbar.value = true;
      chrome.bookmarks.getTree(tree => {
        originalTree.value = JSON.parse(JSON.stringify(tree[0]?.children || []));
        updateComparisonState();
      });
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.isGenerating) isGenerating.value = changes.isGenerating.newValue;
    if (changes.progressCurrent || changes.progressTotal) {
      chrome.storage.local.get(['progressCurrent', 'progressTotal'], (data) => {
        progressTotal.value = data.progressTotal || 0;
        const current = data.progressCurrent || 0;
        progressValue.value = progressTotal.value > 0 ? (current / progressTotal.value) * 100 : 0;
      });
    }
    if (changes.newProposal) {
      const proposal = convertLegacyProposalToTree(changes.newProposal.newValue);
      newProposalTree.value = JSON.parse(JSON.stringify(proposal));
      updateComparisonState();
    }
  });
});

// --- Methods ---
const refresh = () => chrome.runtime.sendMessage({ action: 'startRestructure' });
const applyChanges = () => isApplyConfirmDialogOpen.value = true;
const confirmApplyChanges = () => {
  chrome.runtime.sendMessage({ action: 'applyChanges', proposal: newProposalTree.value });
  isApplyConfirmDialogOpen.value = false;
};
const handleReorder = () => {
  updateComparisonState();
};

function convertLegacyProposalToTree(proposal: any): ProposalNode {
  const root: ProposalNode = { title: 'root', children: [], id: 'root-0' };
  const findOrCreateNode = (path: string[]): ProposalNode => {
    let current = root;
    path.forEach(part => {
      let node = current.children?.find(child => child.title === part && child.children);
      if (!node) {
        node = { title: part, children: [], id: `folder-${Date.now()}-${Math.random()}` };
        current.children = current.children || [];
        current.children.push(node);
      }
      current = node;
    });
    return current;
  };
  if (proposal['书签栏']) {
    for (const categoryPath in proposal['书签栏']) {
      const pathParts = categoryPath.split(' / ');
      const leafNode = findOrCreateNode(['书签栏', ...pathParts]);
      const bookmarks = proposal['书签栏'][categoryPath];
      if (Array.isArray(bookmarks)) {
        leafNode.children?.push(...bookmarks);
      }
    }
  }
  if (proposal['其他书签']) {
    const otherBookmarksNode = findOrCreateNode(['其他书签']);
    otherBookmarksNode.children = proposal['其他书签'];
  }
  return root;
}
</script>

<template>
  <v-app class="app-container">
    <v-app-bar app flat class="app-bar-style">
      <v-app-bar-title class="app-bar-title">AcuityBookmarks</v-app-bar-title>
      <div class="search-container">
        <v-text-field
          v-model="searchQuery"
          density="compact" variant="solo" class="search-input"
          bg-color="transparent" flat hide-details
          label="搜索..." prepend-inner-icon="mdi-magnify"
        ></v-text-field>
      </div>
      <v-btn-toggle v-model="searchMode" mandatory density="compact" variant="outlined" class="search-mode-toggle">
        <v-btn value="exact" size="small">精准</v-btn>
        <v-btn value="ai" size="small">AI</v-btn>
      </v-btn-toggle>
      <v-spacer></v-spacer>
      <v-btn @click="refresh" :disabled="isGenerating" prepend-icon="mdi-refresh" variant="tonal" class="refresh-btn">重新生成</v-btn>
      <v-switch
        v-model="autoOrganizeEnabled"
        color="white"
        density="compact"
        hide-details
        inset
        label="每日自动整理"
        class="daily-toggle"
      ></v-switch>
      <v-btn @click="applyChanges" :disabled="!structuresAreDifferent" color="white" prepend-icon="mdi-check">应用新结构</v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <div class="stats-container">
        <v-card class="pa-2" flat>
          <div class="d-flex align-center">
            <v-avatar color="blue-lighten-4" class="mr-3"><v-icon color="blue">mdi-lightbulb-on-outline</v-icon></v-avatar>
            <div>
              <div class="text-caption text-grey">AI 可优化空间</div>
              <div class="text-h6 font-weight-bold">{{ originalTree.length }} 个书签</div>
            </div>
          </div>
        </v-card>
        <v-card class="pa-2" flat>
           <div class="d-flex align-center">
            <v-avatar color="green-lighten-4" class="mr-3"><v-icon color="green">mdi-timer-sand</v-icon></v-avatar>
            <div>
              <div class="text-caption text-grey">预计节省整理时间</div>
              <div class="text-h6 font-weight-bold">~{{ Math.round(originalTree.length * 0.5) }} 分钟</div>
            </div>
          </div>
        </v-card>
        <v-card class="pa-2" flat>
           <div class="d-flex align-center">
            <v-avatar color="purple-lighten-4" class="mr-3"><v-icon color="purple">mdi-folder-multiple-plus-outline</v-icon></v-avatar>
            <div>
              <div class="text-caption text-grey">AI 建议文件夹</div>
              <div class="text-h6 font-weight-bold">{{ newProposalTree.children.length }} 个</div>
            </div>
          </div>
        </v-card>
      </div>

      <div class="comparison-container">
        <div class="panel">
          <v-card class="fill-height d-flex flex-column">
            <v-card-title class="d-flex align-center card-title"><v-icon start>mdi-folder-open-outline</v-icon>当前结构</v-card-title>
            <v-divider></v-divider>
            <v-card-text class="panel-content">
              <BookmarkTree :nodes="originalTree" :search-query="searchQuery" :is-sortable="false" />
            </v-card-text>
          </v-card>
        </div>

        <div class="d-flex flex-column align-center justify-center px-2">
          <v-btn :disabled="true" icon="mdi-arrow-right-bold" variant="tonal" class="mb-2"></v-btn>
          <v-btn :disabled="!structuresAreDifferent" icon="mdi-arrow-left-bold" variant="tonal" @click="applyChanges"></v-btn>
        </div>

        <div class="panel">
          <v-card class="fill-height d-flex flex-column">
            <v-card-title class="d-flex align-center card-title"><v-icon start>mdi-magic-staff</v-icon>建议结构</v-card-title>
            <v-divider></v-divider>
            <v-card-text class="panel-content position-relative">
              <div v-if="isGenerating" class="empty-state">
                <v-progress-linear v-model="progressValue" color="primary" height="12" rounded striped class="mb-4 progress-bar"></v-progress-linear>
                <p class="text-grey">正在努力的分析了，马上就好 ({{ Math.round(progressValue) }}%)...</p>
              </div>
              <div v-else class="fill-height">
                <BookmarkTree 
                  :nodes="newProposalTree.children" 
                  :search-query="searchQuery" 
                  is-proposal 
                  :is-sortable="!searchQuery" 
                  :is-top-level="true"
                  @reorder="handleReorder"
                />
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>
    </v-main>
    
    <v-dialog v-model="isApplyConfirmDialogOpen" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">确认应用新结构？</v-card-title>
        <v-card-text>此操作将**完全覆盖**你现有的书签栏和“其他书签”目录。原有的文件夹和书签将被**全部删除**，并替换为右侧面板中的新结构。此操作不可撤销。</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="isApplyConfirmDialogOpen = false">取消</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="confirmApplyChanges">确认覆盖</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" timeout="3000" color="success">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden; /* Prevent scrollbars on the root elements */
}
.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>

<style scoped>
.app-container { user-select: none; }
.app-bar-style { background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%); }
.app-bar-title { flex-grow: 0 !important; min-width: 180px; }
.search-container { width: 100%; display: flex; justify-content: center; }
.search-wrapper { transition: width 0.3s ease-in-out; width: 40%; }
.search-input :deep(.v-field__input), .search-input :deep(.v-field__prepend-inner .v-icon) { color: white !important; }
.search-input :deep(label) { color: rgba(255, 255, 255, 0.7) !important; }
.search-input :deep(.v-field) { background-color: rgba(255, 255, 255, 0.15) !important; }
.search-mode-toggle {
  border: 1px solid rgba(255, 255, 255, 0.3);
  margin-left: 16px;
}
.search-mode-toggle .v-btn {
  color: white !important;
  background-color: transparent !important;
}
.search-mode-toggle .v-btn.v-btn--active {
  background-color: rgba(255, 255, 255, 0.2) !important;
}
.refresh-btn.v-btn--disabled { color: rgba(255, 255, 255, 0.5) !important; background-color: rgba(255, 255, 255, 0.05) !important; }
.daily-toggle {
  flex: 0 0 auto;
  margin-right: 16px;
}
.daily-toggle :deep(label) {
  color: white;
  font-size: 14px;
}
.main-content { display: flex; flex-direction: column; padding: 16px; }
.stats-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.comparison-container { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; flex-grow: 1; min-height: 0; }
.panel { height: 100%; min-width: 0; }
.panel-content {
  overflow-y: auto;
  flex: 1 1 0;
  min-height: 0;
}
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; }
.progress-bar { width: 80%; max-width: 300px; }
.card-title .v-icon { margin-right: 4px !important; }
</style>
</script>

<template>
  <v-app class="app-container">
    <v-app-bar app flat class="app-bar-style">
      <v-app-bar-title class="app-bar-title">AcuityBookmarks</v-app-bar-title>
      <div class="search-container">
        <v-text-field
          v-model="searchQuery"
          density="compact" variant="solo" class="search-input"
          bg-color="transparent" flat hide-details
          label="搜索..." prepend-inner-icon="mdi-magnify"
        ></v-text-field>
      </div>
      <v-btn-toggle v-model="searchMode" mandatory density="compact" variant="outlined" class="search-mode-toggle">
        <v-btn value="exact" size="small">精准</v-btn>
        <v-btn value="ai" size="small">AI</v-btn>
      </v-btn-toggle>
      <v-spacer></v-spacer>
      <v-btn @click="refresh" :disabled="isGenerating" prepend-icon="mdi-refresh" variant="tonal" class="refresh-btn">重新生成</v-btn>
      <v-switch
        v-model="autoOrganizeEnabled"
        color="white"
        density="compact"
        hide-details
        inset
        label="每日自动整理"
        class="daily-toggle"
      ></v-switch>
      <v-btn @click="applyChanges" :disabled="!structuresAreDifferent" color="white" prepend-icon="mdi-check">应用新结构</v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <div class="stats-container">
        <v-card class="pa-2" flat>
          <div class="d-flex align-center">
            <v-avatar color="blue-lighten-4" class="mr-3"><v-icon color="blue">mdi-lightbulb-on-outline</v-icon></v-avatar>
            <div>
              <div class="text-caption text-grey">AI 可优化空间</div>
              <div class="text-h6 font-weight-bold">{{ totalBookmarks }} 个书签</div>
            </div>
          </div>
        </v-card>
        <v-card class="pa-2" flat>
           <div class="d-flex align-center">
            <v-avatar color="green-lighten-4" class="mr-3"><v-icon color="green">mdi-timer-sand</v-icon></v-avatar>
            <div>
              <div class="text-caption text-grey">预计节省整理时间</div>
              <div class="text-h6 font-weight-bold">~{{ Math.round(totalBookmarks * 0.5) }} 分钟</div>
            </div>
          </div>
        </v-card>
        <v-card class="pa-2" flat>
           <div class="d-flex align-center">
            <v-avatar color="purple-lighten-4" class="mr-3"><v-icon color="purple">mdi-folder-multiple-plus-outline</v-icon></v-avatar>
            <div>
              <div class="text-caption text-grey">AI 建议文件夹</div>
              <div class="text-h6 font-weight-bold">{{ aiCategoryCount }} 个</div>
            </div>
          </div>
        </v-card>
      </div>

      <div class="comparison-container">
        <div class="panel">
          <v-card class="fill-height d-flex flex-column">
            <v-card-title class="d-flex align-center card-title"><v-icon start>mdi-folder-open-outline</v-icon>当前结构</v-card-title>
            <v-divider></v-divider>
            <v-card-text class="panel-content"><BookmarkTree :nodes="filteredOriginalTree" :search-query="searchQuery" :is-sortable="false" /></v-card-text>
          </v-card>
        </div>

        <div class="d-flex flex-column align-center justify-center px-2">
          <v-btn :disabled="true" icon="mdi-arrow-right-bold" variant="tonal" class="mb-2"></v-btn>
          <v-btn :disabled="!structuresAreDifferent" icon="mdi-arrow-left-bold" variant="tonal" @click="applyChanges"></v-btn>
        </div>

        <div class="panel">
          <v-card class="fill-height d-flex flex-column">
            <v-card-title class="d-flex align-center card-title"><v-icon start>mdi-magic-staff</v-icon>建议结构</v-card-title>
            <v-divider></v-divider>
            <v-card-text class="panel-content position-relative">
              <div v-if="isGenerating" class="empty-state">
                <v-progress-linear v-model="progressValue" color="primary" height="12" rounded striped class="mb-4 progress-bar"></v-progress-linear>
                <p class="text-grey">正在努力的分析了，马上就好 ({{ Math.round(progressValue) }}%)...</p>
              </div>
              <div v-else class="fill-height">
                <BookmarkTree 
                  :nodes="filteredProposalTree" 
                  :search-query="searchQuery" 
                  is-proposal 
                  :is-sortable="!searchQuery" 
                  :is-top-level="true"
                  @delete-bookmark="handleDeleteBookmark" 
                  @edit-bookmark="handleEditBookmark" 
                  @reorder="handleReorder"
                />
              </div>
            </v-text-text>
          </v-card>
        </div>
      </div>
    </v-main>
    
    <v-dialog v-model="isApplyConfirmDialogOpen" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">确认应用新结构？</v-card-title>
        <v-card-text>此操作将**完全覆盖**你现有的书签栏和“其他书签”目录。原有的文件夹和书签将被**全部删除**，并替换为右侧面板中的新结构。此操作不可撤销。</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="isApplyConfirmDialogOpen = false">取消</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="confirmApplyChanges">确认覆盖</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" timeout="3000" color="success">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<!-- Styles... -->


