<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import BookmarkTree from './BookmarkTree.vue';

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
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="compact" flat>
      <v-app-bar-title>AcuityBookmarks</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-responsive max-width="300" class="mr-4">
        <v-text-field
          density="compact"
          variant="solo-filled"
          flat
          hide-details
          label="搜索书签..."
          prepend-inner-icon="mdi-magnify"
        ></v-text-field>
      </v-responsive>
      <v-btn @click="refresh" icon="mdi-refresh" title="重新生成"></v-btn>
      <v-btn color="white" class="mx-2">应用新结构</v-btn>
    </v-app-bar>

    <v-main style="background-color: #f7f2fa;">
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
                    <BookmarkTree v-else :nodes="newProposalTree.children || []" is-proposal />
                  </div>
                </v-fade-transition>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
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
