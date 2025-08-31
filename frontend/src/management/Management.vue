<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import BookmarkTree from './BookmarkTree.vue';

const isSearchFocused = ref(false);
const isEditDialogOpen = ref(false);
const editingBookmark = ref<ProposalNode | null>(null);

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

// --- Data Conversion ---
function convertLegacyProposalToTree(proposal: any): ProposalNode {
  const root: ProposalNode = { title: 'root', children: [], isRoot: true, id: 'root-0' };
  const findOrCreateNode = (path: string[]): ProposalNode => {
    let current: ProposalNode = root;
    path.forEach(part => {
      let node = current.children?.find(child => child.title === part && child.children);
      if (!node) {
        node = { title: part, children: [], id: `folder-${Date.now()}-${Math.random()}` };
        if (!current.children) current.children = [];
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
    let folders = 0; let bookmarks = 0;
    nodes.forEach(node => {
      if (node.url) bookmarks++;
      else if (node.children) {
        folders++;
        const childStats = countRecursively(node.children);
        folders += childStats.folders;
        bookmarks += childStats.bookmarks;
      }
    });
    return { folders, bookmarks };
  }
  if (originalTree.value.length > 0) {
    const { folders, bookmarks } = countRecursively(originalTree.value);
    stats.totalFolders = folders;
    stats.totalBookmarks = bookmarks;
  }
  if (newProposalTree.value.children) {
    const { bookmarks } = countRecursively(newProposalTree.value.children);
    stats.aiProcessed = bookmarks;
  }
}

// --- Lifecycle ---
onMounted(() => {
  chrome.storage.local.get(['originalTree', 'newProposal'], (data) => {
    if (data.originalTree) {
      originalTree.value = data.originalTree[0]?.children || [];
    }
    originalLoading.value = false;
    if (data.newProposal) {
      newProposalTree.value = convertLegacyProposalToTree(data.newProposal);
    }
    proposalLoading.value = false;
    updateStats();
  });
});

// --- Methods ---
const refresh = () => {
  alert('正在请求后台重新生成建议...');
  chrome.runtime.sendMessage({ action: 'startRestructure' });
};

const handleEditBookmark = (node: ProposalNode) => {
  editingBookmark.value = node;
  isEditDialogOpen.value = true;
};

const saveBookmark = () => {
  // The title is already updated via v-model on the editingBookmark object.
  // We just need to close the dialog.
  isEditDialogOpen.value = false;
  editingBookmark.value = null;
};

const handleDeleteBookmark = (id: string) => {
  const findAndRemove = (nodes: ProposalNode[], bookmarkId: string): boolean => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.id === bookmarkId) {
        nodes.splice(i, 1);
        return true;
      }
      if (node.children && findAndRemove(node.children, bookmarkId)) {
        return true;
      }
    }
    return false;
  };

  if (newProposalTree.value.children) {
    const success = findAndRemove(newProposalTree.value.children, id);
    if (success) {
      updateStats(); // Recalculate stats after deletion
    }
  }
};
</script>

<template>
  <v-app>
    <v-app-bar flat class="app-bar-style">
      <v-app-bar-title>AcuityBookmarks (v2)</v-app-bar-title>

      <v-spacer></v-spacer>

      <v-responsive 
        :class="['search-wrapper', { 'focused': isSearchFocused }]"
        max-width="500"
      >
        <v-text-field
          density="compact"
          variant="solo"
          class="search-input"
          bg-color="transparent"
          flat
          hide-details
          label="搜索书签..."
          prepend-inner-icon="mdi-magnify"
          @focus="isSearchFocused = true"
          @blur="isSearchFocused = false"
        ></v-text-field>
      </v-responsive>

      <v-spacer></v-spacer>

      <v-btn @click="refresh" prepend-icon="mdi-refresh" variant="tonal" class="mr-2">重新生成</v-btn>
      <v-btn color="white" class="mx-2" prepend-icon="mdi-check">应用新结构</v-btn>
    </v-app-bar>

    <v-main style="background-color: #f1f3f4;">
      <v-container fluid>
        <v-row>
          <v-col cols="12" md="4">
            <v-card class="d-flex align-center pa-2" flat>
              <v-avatar color="primary" icon="mdi-folder-outline" class="mr-2"></v-avatar>
              <div>
                <div class="text-h6">{{ stats.totalFolders }}</div>
                <div class="text-caption">文件夹</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card class="d-flex align-center pa-2" flat>
              <v-avatar color="primary" icon="mdi-bookmark-multiple-outline" class="mr-2"></v-avatar>
              <div>
                <div class="text-h6">{{ stats.totalBookmarks }}</div>
                <div class="text-caption">书签</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card class="d-flex align-center pa-2" flat>
              <v-avatar color="primary" icon="mdi-auto-fix-high" class="mr-2"></v-avatar>
              <div>
                <div class="text-h6">{{ stats.aiProcessed }}</div>
                <div class="text-caption">AI分类</div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-2 comparison-row">
          <v-col md="6" class="d-flex flex-column">
            <v-card class="flex-grow-1 d-flex flex-column">
              <v-card-title class="d-flex align-center">
                <v-icon start>mdi-folder-open-outline</v-icon>
                当前结构
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text class="flex-grow-1" style="overflow-y: auto;">
                <v-skeleton-loader v-if="originalLoading" type="list-item-two-line, list-item-two-line, list-item-two-line"></v-skeleton-loader>
                <v-fade-transition hide-on-leave>
                  <div v-if="!originalLoading" class="fill-height">
                    <div v-if="originalTree.length === 0" class="empty-state">
                      <v-icon size="x-large" color="grey-lighten-1">mdi-folder-search-outline</v-icon>
                      <p class="mt-2 text-grey">没有找到书签数据</p>
                    </div>
                    <BookmarkTree v-else :nodes="originalTree" />
                  </div>
                </v-fade-transition>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col md="6" class="d-flex flex-column">
            <v-card class="flex-grow-1 d-flex flex-column">
              <v-card-title class="d-flex align-center">
                <v-icon start>mdi-auto-awesome</v-icon>
                AI优化建议
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text class="flex-grow-1" style="overflow-y: auto;">
                <v-skeleton-loader v-if="proposalLoading" type="list-item-two-line, list-item-two-line, list-item-two-line"></v-skeleton-loader>
                 <v-fade-transition hide-on-leave>
                  <div v-if="!proposalLoading" class="fill-height">
                    <div v-if="!newProposalTree.children || newProposalTree.children.length === 0" class="empty-state">
                      <v-icon size="x-large" color="grey-lighten-1">mdi-auto-fix</v-icon>
                      <p class="mt-2 text-grey">暂无AI建议</p>
                      <v-btn @click="refresh" color="primary" class="mt-4">立即生成</v-btn>
                    </div>
                    <BookmarkTree v-else :nodes="newProposalTree.children || []" is-proposal @delete-bookmark="handleDeleteBookmark" @edit-bookmark="handleEditBookmark" />
                  </div>
                </v-fade-transition>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Edit Bookmark Dialog -->
    <v-dialog v-model="isEditDialogOpen" max-width="500px">
      <v-card v-if="editingBookmark">
        <v-card-title>
          <span class="text-h5">编辑书签</span>
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editingBookmark.title"
            label="书签名称"
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-text-field
            :model-value="editingBookmark.url"
            label="网址 (URL)"
            variant="outlined"
            density="compact"
            readonly
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="isEditDialogOpen = false">取消</v-btn>
          <v-btn color="blue-darken-1" variant="text" @click="saveBookmark">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style scoped>
.app-bar-style {
  background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%);
}

.search-wrapper {
  transition: max-width 0.3s ease-in-out;
  max-width: 300px !important;
}

.search-wrapper.focused {
  max-width: 500px !important;
}

.search-input .v-field {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: white !important;
}

.search-input .v-field__input, .search-input .v-field__prepend-inner .v-icon {
    color: white;
}

.search-input label {
    color: rgba(255, 255, 255, 0.7) !important;
}

.comparison-row {
  /* Make the row take up the remaining height */
  height: calc(100vh - 64px - 48px - 90px); /* vh - appbar - container padding - stats row */
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}
</style>
