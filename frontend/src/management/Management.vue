<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
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
const snackbar = ref(false);
const snackbarText = ref('');

// --- Bookmark Hover Mapping ---
const hoveredBookmarkId = ref<string | null>(null);
const bookmarkMapping = ref<Map<string, any>>(new Map());
const expandedFolders = ref<Set<string>>(new Set());

// Generate unique ID for each bookmark instance
const generateBookmarkId = (node: any): string => {
  if (!node || !node.url) return '';

  // Create truly unique ID by including node ID and other properties
  const identifier = `${node.id || 'no-id'}|${node.url}|${node.title || ''}|${node.dateAdded || ''}`;
  try {
    // Encode the string to handle Unicode characters
    const encoded = encodeURIComponent(identifier);
    return btoa(encoded).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  } catch (error) {
    // Fallback: use a simple hash if encoding fails
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }
};

// Build mapping between original and proposed bookmarks
const buildBookmarkMapping = (originalTree: any[], proposedTree: any[]) => {
  bookmarkMapping.value.clear();

  // Helper function to assign unique IDs and build mapping
  const processBookmarks = (nodes: any[], isOriginal: boolean = true) => {
    for (const node of nodes) {
      if (node.url) {
        // This is a bookmark - assign unique ID
        const bookmarkId = generateBookmarkId(node);
        node.uniqueId = bookmarkId; // Add unique ID to node

        console.log(`Processing bookmark: ${node.title}, ID: ${bookmarkId}, isOriginal: ${isOriginal}`);

        // Build mapping - use bookmarkId as key for mapping
        if (!bookmarkMapping.value.has(bookmarkId)) {
          bookmarkMapping.value.set(bookmarkId, {
            original: isOriginal ? node : null,
            proposed: !isOriginal ? node : null
          });
        } else {
          const existing = bookmarkMapping.value.get(bookmarkId);
          if (isOriginal) {
            existing.original = node;
          } else {
            existing.proposed = node;
          }
        }
      } else if (node.children) {
        // This is a folder, traverse children
        processBookmarks(node.children, isOriginal);
      }
    }
  };

  if (originalTree) processBookmarks(originalTree, true);
  if (proposedTree) processBookmarks(proposedTree, false);

  console.log('Final bookmarkMapping:', bookmarkMapping.value);
};

// Handle folder toggle (user manual operation)
const handleFolderToggle = (data: { nodeId: string; expanded: boolean }) => {
  console.log('User manually toggled folder:', data.nodeId, 'expanded:', data.expanded);
  // For user manual operations, we don't interfere with other folders
  // Just let the folder maintain its own state
};

// Handle bookmark hover
const handleBookmarkHover = (bookmarkId: string | null) => {
  console.log('handleBookmarkHover called with:', bookmarkId);
  console.log('Current bookmarkMapping size:', bookmarkMapping.value.size);

  hoveredBookmarkId.value = bookmarkId;

  if (bookmarkId && bookmarkMapping.value.has(bookmarkId)) {
    const mapping = bookmarkMapping.value.get(bookmarkId);
    console.log('Found mapping for bookmarkId:', bookmarkId, 'mapping:', mapping);

    // Clear all expanded folders first (exclusive behavior)
    expandedFolders.value.clear();
    // Force reactivity update after clearing
    expandedFolders.value = new Set(expandedFolders.value);

    // If hovering on proposed bookmark, highlight corresponding original bookmark
    if (mapping.proposed && mapping.original) {
      console.log('Expanding folder path for original bookmark:', mapping.original);

      // Find the folder path for the original bookmark and expand it
      expandFolderPath(originalTree.value, mapping.original);

      // Wait for Vue to render the expanded folders, then scroll
      nextTick(() => {
        // Additional delay to ensure folder contents are fully rendered
        setTimeout(() => {
          const element = document.querySelector(`[data-bookmark-id="${mapping.original.uniqueId}"]`);
          if (element) {
            console.log('Scrolling to original bookmark element');
            scrollToBookmark(element);
          } else {
            console.log('Original bookmark element not found, trying again...');
            // Try again after another delay
            setTimeout(() => {
              const retryElement = document.querySelector(`[data-bookmark-id="${mapping.original.uniqueId}"]`);
              if (retryElement) {
                console.log('Retry: Found and scrolling to original bookmark element');
                scrollToBookmark(retryElement);
              } else {
                console.log('Retry failed: Original bookmark element still not found');
              }
            }, 100);
          }
        }, 50); // Small delay to ensure rendering
      });
    }
  } else {
    console.log('No mapping found for bookmarkId:', bookmarkId);
    // Clear auto-expanded folders when not hovering, but keep user-manually expanded folders
    expandedFolders.value.clear();
    // Force reactivity update after clearing
    expandedFolders.value = new Set(expandedFolders.value);
    console.log('🧹 Cleared expanded folders on mouseleave');
  }
};

// Find and expand the folder path containing the target bookmark
const expandFolderPath = (nodes: any[], targetNode: any) => {
  console.log('🔍 Expanding folder path for target node:', targetNode);
  console.log('📁 Current expanded folders before:', Array.from(expandedFolders.value));

  // Clear all expanded folders first (exclusive behavior for auto-expansion)
  expandedFolders.value.clear();
  // Force reactivity update after clearing
  expandedFolders.value = new Set(expandedFolders.value);
  console.log('🧹 Cleared expanded folders, now:', Array.from(expandedFolders.value));

  let found = false;
  for (const node of nodes) {
    if (node.children && !found) {
      console.log('🔎 Checking folder:', node.title, 'ID:', node.id);
      // Check if target node is in this folder's children
      if (findNodeInChildren(node.children, targetNode)) {
        console.log('✅ Found target in folder:', node.title, 'ID:', node.id);
        // Expand this folder
        expandedFolders.value.add(node.id);
        console.log('📂 Added folder to expanded set:', node.id);

        // Force reactivity update
        expandedFolders.value = new Set(expandedFolders.value);
        console.log('🔄 Forced reactivity update for expandedFolders');

        // Continue searching deeper
        expandFolderPathRecursive(node.children, targetNode);
        found = true;
        break;
      }
    }
  }

  console.log('🎯 Final expanded folders after search:', Array.from(expandedFolders.value));
  console.log('📊 Expanded folders size:', expandedFolders.value.size);
};

// Recursive helper to expand the complete path
const expandFolderPathRecursive = (nodes: any[], targetNode: any) => {
  console.log('🔄 Recursively searching deeper levels...');
  for (const node of nodes) {
    if (node.children) {
      console.log('🔎 Checking deeper folder:', node.title, 'ID:', node.id);
      if (findNodeInChildren(node.children, targetNode)) {
        console.log('✅ Found target in deeper folder:', node.title, 'ID:', node.id);
        expandedFolders.value.add(node.id);
        console.log('📂 Added deeper folder to expanded set:', node.id);

        // Force reactivity update for recursive additions too
        expandedFolders.value = new Set(expandedFolders.value);
        console.log('🔄 Forced reactivity update for recursive expandedFolders');

        expandFolderPathRecursive(node.children, targetNode);
        break;
      }
    }
  }
};

// Helper function to find if target node exists in children
const findNodeInChildren = (children: any[], targetNode: any): boolean => {
  console.log('🔍 Searching in', children.length, 'children for target:', targetNode.title);

  for (const child of children) {
    console.log('👀 Checking child:', child.title, 'hasChildren:', !!child.children);

    if (child.url === targetNode.url && child.title === targetNode.title) {
      console.log('🎉 Found exact matching bookmark:', child.title);
      return true;
    }

    if (child.children && findNodeInChildren(child.children, targetNode)) {
      console.log('📂 Found target in subfolder of:', child.title);
      return true;
    }
  }

  console.log('❌ Target not found in these children');
  return false;
};

// Scroll element into view with centering
const scrollToBookmark = (element: Element) => {
  if (!element) return;

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center', // Center the element in viewport
    inline: 'nearest'
  });
};

// --- Type Definitions ---
interface ProposalNode {
  id: string;
  title: string;
  url?: string;
  children?: ProposalNode[];
  dateAdded?: number;
  index?: number;
}



// --- Comparison Logic ---
function getComparable(nodes: ProposalNode[]): any[] {
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

function updateComparisonState(): void {
  const originalComparable = getComparable(originalTree.value);
  const proposalComparable = getComparable(newProposalTree.value.children ?? []);
  structuresAreDifferent.value = JSON.stringify(originalComparable) !== JSON.stringify(proposalComparable);
}

// --- Lifecycle & Event Listeners ---
onMounted(() => {
  chrome.storage.local.get(['originalTree', 'newProposal', 'isGenerating', 'progressCurrent', 'progressTotal'], (data) => {
    if (data.originalTree) {
      originalTree.value = JSON.parse(JSON.stringify(data.originalTree[0]?.children || []));
    }
    if (data.newProposal) {
      const proposal = convertLegacyProposalToTree(data.newProposal);
      newProposalTree.value = JSON.parse(JSON.stringify(proposal));
    }
    updateComparisonState();

    // Build bookmark mapping after data is loaded
    if (originalTree.value && newProposalTree.value.children) {
      buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
    }

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
const confirmApplyChanges = (): void => {
  chrome.runtime.sendMessage({ action: 'applyChanges', proposal: newProposalTree.value });
  isApplyConfirmDialogOpen.value = false;
};
const handleReorder = (): void => {
  updateComparisonState();
};

function convertLegacyProposalToTree(proposal: Record<string, any>): ProposalNode {
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
      <v-app-bar-title class="d-flex align-center">
        <div class="logo-container mr-3">
          <div class="custom-logo-bg"></div>
        </div>
        <div class="app-bar-title">AcuityBookmarks</div>
      </v-app-bar-title>
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

      <v-btn @click="applyChanges" :disabled="!structuresAreDifferent" color="white" prepend-icon="mdi-check">应用新结构</v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <!-- Statistics Cards -->
      <v-container fluid class="stats-section page-container">
        <v-row dense class="stats-row">
          <v-col cols="12" sm="4">
            <v-card variant="outlined" class="stat-card-compact" elevation="1">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar color="primary" size="36" class="me-3">
                    <v-icon color="white" size="18">mdi-lightbulb-on-outline</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-caption text-medium-emphasis mb-1">可优化书签</div>
                    <div class="text-h6 font-weight-bold text-primary d-flex align-center">
                      {{ originalTree.length }}
                      <span class="text-body-2 ms-1">个</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="4">
            <v-card variant="outlined" class="stat-card-compact" elevation="1">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar color="success" size="36" class="me-3">
                    <v-icon color="white" size="18">mdi-timer-sand</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-caption text-medium-emphasis mb-1">节省时间</div>
                    <div class="text-h6 font-weight-bold text-success d-flex align-center">
                      ~{{ Math.round(originalTree.length * 0.5) }}
                      <span class="text-body-2 ms-1">分钟</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="4">
            <v-card variant="outlined" class="stat-card-compact" elevation="1">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar color="warning" size="36" class="me-3">
                    <v-icon color="white" size="18">mdi-folder-multiple-plus-outline</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-caption text-medium-emphasis mb-1">建议文件夹</div>
                    <div class="text-h6 font-weight-bold text-warning d-flex align-center">
                      {{ newProposalTree.children?.length || 0 }}
                      <span class="text-body-2 ms-1">个</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- Main Comparison Section -->
      <v-container fluid class="comparison-section page-container">
        <v-row class="comparison-row">
          <!-- Current Structure Panel -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar color="info" size="24" class="me-2">
                    <v-icon color="white" size="16">mdi-folder-open-outline</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">当前结构</div>
                    <div class="text-caption text-medium-emphasis">原始书签组织方式</div>
                  </div>
                </div>
              </v-card-title>

              <v-divider></v-divider>

              <div class="comparison-content">
                <BookmarkTree
                  :nodes="originalTree"
                  :search-query="searchQuery"
                  :is-sortable="false"
                  :hovered-bookmark-id="hoveredBookmarkId"
                  :is-original="true"
                  :expanded-folders="expandedFolders"
                  @bookmark-hover="handleBookmarkHover"
                  @scroll-to-bookmark="scrollToBookmark"
                  @folder-toggle="handleFolderToggle"
                />
              </div>
            </v-card>
          </v-col>

          <!-- Control Panel -->
          <v-col cols="12" md="2" class="control-col">
            <v-card class="control-card" variant="outlined" elevation="1">
              <v-card-text class="text-center pa-4">
                <div class="control-section mb-4">
                  <v-btn
                    :disabled="true"
                    icon="mdi-arrow-right-bold"
                    variant="tonal"
                    color="primary"
                    size="large"
                    class="control-btn"
                  ></v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">对比</div>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="control-section">
                  <v-btn
                    :disabled="!structuresAreDifferent"
                    icon="mdi-check-circle"
                    variant="flat"
                    color="success"
                    size="large"
                    class="control-btn apply-btn"
                    @click="applyChanges"
                  >
                    <v-tooltip location="top" activator="parent">
                      <span>应用新结构</span>
                    </v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">应用</div>
                </div>

                <div v-if="structuresAreDifferent" class="diff-indicator mt-4">
                  <v-chip color="warning" size="small" variant="outlined">
                    <v-icon start size="16">mdi-alert-circle</v-icon>
                    有更改
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Proposed Structure Panel -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar color="secondary" size="24" class="me-2">
                    <v-icon color="white" size="16">mdi-magic-staff</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">AI 建议结构</div>
                    <div class="text-caption text-medium-emphasis">智能重新组织</div>
                  </div>
                </div>
              </v-card-title>

              <v-divider></v-divider>

              <div class="comparison-content">
                <div v-if="isGenerating" class="generation-state">
                  <div class="text-center py-8">
                    <v-progress-circular
                      :model-value="progressValue"
                      color="primary"
                      size="64"
                      width="6"
                      class="mb-4"
                    >
                      <v-icon size="24">mdi-brain</v-icon>
                    </v-progress-circular>
                    <div class="text-h6 mb-2">AI 正在分析中...</div>
                    <div class="text-body-2 text-medium-emphasis mb-4">
                      正在努力分析您的书签结构
                    </div>
                    <v-progress-linear
                      :model-value="progressValue"
                      color="primary"
                      height="8"
                      rounded
                      class="progress-bar"
                    ></v-progress-linear>
                    <div class="text-caption text-medium-emphasis mt-2">
                      {{ Math.round(progressValue) }}% 完成
                    </div>
                  </div>
                </div>

                <div v-else>
                  <BookmarkTree
                    :nodes="newProposalTree.children || []"
                    :search-query="searchQuery"
                    is-proposal
                    :is-sortable="!searchQuery"
                    :is-top-level="true"
                    :hovered-bookmark-id="hoveredBookmarkId"
                    :is-original="false"
                    @reorder="handleReorder"
                    @bookmark-hover="handleBookmarkHover"
                    @scroll-to-bookmark="scrollToBookmark"
                  />
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
    
    <!-- Modern Confirmation Dialog -->
    <v-dialog v-model="isApplyConfirmDialogOpen" max-width="600px" persistent>
      <v-card class="confirmation-dialog" elevation="24">
        <v-card-title class="confirmation-header">
          <div class="d-flex align-center">
            <v-avatar color="warning" size="48" class="me-4">
              <v-icon color="white" size="24">mdi-alert-circle</v-icon>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold mb-1">确认应用新结构</div>
              <div class="text-body-2 text-medium-emphasis">此操作将永久更改您的书签组织方式</div>
            </div>
          </div>
        </v-card-title>

        <v-card-text class="confirmation-content">
          <v-alert
            type="warning"
            variant="tonal"
            class="mb-4"
            prepend-icon="mdi-information"
          >
            <div class="text-body-2">
              <strong>重要提醒：</strong>此操作将完全覆盖您现有的书签栏和"其他书签"目录
            </div>
          </v-alert>

          <div class="warning-list">
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3">mdi-close-circle</v-icon>
              <span class="text-body-2">原有的文件夹结构将被删除</span>
            </div>
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3">mdi-close-circle</v-icon>
              <span class="text-body-2">书签将被重新组织到新结构中</span>
            </div>
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3">mdi-close-circle</v-icon>
              <span class="text-body-2">此操作不可撤销</span>
            </div>
          </div>

          <v-divider class="my-4"></v-divider>

          <div class="confirmation-stats">
            <div class="text-body-2 text-medium-emphasis mb-2">将要应用的新结构包含：</div>
            <v-chip-group>
              <v-chip color="primary" variant="outlined" size="small">
                <v-icon start size="16">mdi-folder-multiple</v-icon>
                {{ newProposalTree.children?.length || 0 }} 个文件夹
              </v-chip>
              <v-chip color="secondary" variant="outlined" size="small">
                <v-icon start size="16">mdi-bookmark-multiple</v-icon>
                {{ originalTree.length }} 个书签
              </v-chip>
            </v-chip-group>
          </div>
        </v-card-text>

        <v-card-actions class="confirmation-actions">
          <v-spacer></v-spacer>
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            @click="isApplyConfirmDialogOpen = false"
            class="cancel-btn"
          >
            <v-icon start size="18">mdi-close</v-icon>
            取消
          </v-btn>
          <v-btn
            variant="flat"
            color="success"
            @click="confirmApplyChanges"
            class="confirm-btn"
          >
            <v-icon start size="18">mdi-check-circle</v-icon>
            确认应用
          </v-btn>
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
.app-container {
  user-select: none;
  background-color: #fafafa;
}

.app-bar-style {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 3px 16px rgba(102, 126, 234, 0.2) !important;
}

.app-bar-title {
  flex-grow: 0 !important;
  min-width: 180px;
}

.search-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

.search-input :deep(.v-field__input),
.search-input :deep(.v-field__prepend-inner .v-icon) {
  color: white !important;
}

/* Logo styles */
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border-radius: 6px;
  padding: 2px;
}

.custom-logo-bg {
  width: 36px;
  height: 36px;
  background: transparent !important;
  border: none !important;
  border-radius: 4px;
  /* 使用background-image来显示SVG，完全控制显示方式 */
  background-image: url('/logo.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: brightness(1.1);
}

.search-input :deep(label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.search-input :deep(.v-field) {
  background-color: rgba(255, 255, 255, 0.15) !important;
}

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

.refresh-btn.v-btn--disabled {
  color: rgba(255, 255, 255, 0.5) !important;
  background-color: rgba(255, 255, 255, 0.05) !important;
}



.main-content {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
  background-color: #fafafa;
}

/* Page Container - Add margins to all sections */
.page-container {
  padding-left: 24px !important;
  padding-right: 24px !important;
}

/* Statistics Section */
.stats-section {
  padding: 16px 0;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 8px; /* Add spacing between sections */
}

.stat-card-compact {
  height: 100%;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
}

.stat-card-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08) !important;
}

/* Stats row spacing */
.stats-row {
  margin-bottom: 0;
}

/* Comparison Section */
.comparison-section {
  flex: 1;
  padding: 24px 0 32px 0; /* Add bottom margin */
  background-color: #fafafa;
}

.comparison-row {
  height: calc(100vh - 180px); /* 优化PC浏览器高度 */
  min-height: 700px; /* PC浏览器更大的最小高度 */
  max-height: calc(100vh - 120px); /* PC浏览器更大的最大高度 */
}

.comparison-col {
  display: flex;
  flex-direction: column;
  height: 100%; /* 确保列也有固定高度 */
}

.comparison-card {
  height: 100%; /* 固定高度 */
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.comparison-card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  transform: translateY(-1px); /* PC浏览器轻微上移效果 */
}

.comparison-header-compact {
  background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 16px !important; /* Reduce padding for compact design */
  min-height: 56px; /* Reduce minimum height */
}

.comparison-content {
  height: 100%; /* 继承父容器高度 */
  overflow-y: auto; /* 只在这里设置滚动 */
  overflow-x: hidden;
  padding: 16px;
  padding-bottom: 32px; /* 添加底部间距 */
}

/* 确保v-list-group的内容可以自然展开，不设置滚动 */
.comparison-content :deep(.v-list-group__items) {
  overflow: visible !important;
  max-height: none !important;
}

.comparison-content :deep(.v-list-item) {
  min-height: 40px;
}

/* Control Panel */
.control-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

.control-card {
  width: 100%;
  max-width: 200px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
}

.control-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.control-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.control-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.control-btn:hover::before {
  width: 100%;
  height: 100%;
}

.control-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.apply-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.apply-btn:hover {
  background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%) !important;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
}

.diff-indicator {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Generation State */
.generation-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.progress-bar {
  width: 200px;
  max-width: 80%;
}

/* PC浏览器优化 - 专注于最佳桌面体验 */

/* PC浏览器优化的滚动条样式 - 只在comparison-content上显示 */
.comparison-content::-webkit-scrollbar {
  width: 8px; /* 稍微宽一点，更容易操作 */
}

.comparison-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.comparison-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.comparison-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.4);
}

.comparison-content::-webkit-scrollbar-thumb:active {
  background: rgba(0, 0, 0, 0.6);
}

/* 隐藏滚动条按钮，保持简洁 */
.comparison-content::-webkit-scrollbar-button {
  display: none;
}

/* Confirmation Dialog Styles */
.confirmation-dialog {
  border-radius: 16px;
  overflow: hidden;
}

.confirmation-header {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border-bottom: 1px solid #ffc107;
  padding: 24px !important;
}

.confirmation-content {
  padding: 24px !important;
}

.warning-list {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 16px;
}

.confirmation-stats {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.confirmation-actions {
  padding: 16px 24px !important;
  border-top: 1px solid #e9ecef;
  background-color: #f8f9fa;
}

.cancel-btn {
  margin-right: 12px;
}

.confirm-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
  color: white !important;
  font-weight: 600;
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
}
</style>
