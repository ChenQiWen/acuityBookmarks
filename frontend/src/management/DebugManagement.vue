<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>🐛 Debug Management</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn @click="loadData" :loading="isLoading" color="white" variant="outlined">
        重新加载数据
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <!-- 状态指示器 -->
        <v-row>
          <v-col cols="12">
            <v-alert 
              :type="alertType" 
              :title="alertTitle"
              :text="alertText"
              variant="tonal"
              closable
              v-model="showAlert"
            ></v-alert>
          </v-col>
        </v-row>

        <!-- 数据状态卡片 -->
        <v-row>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-title>
                <v-icon start>mdi-database</v-icon>
                Chrome Storage
              </v-card-title>
              <v-card-text>
                <div class="text-body-2 mb-2">
                  <strong>originalTree:</strong> {{ storageData.originalTree ? '✅ 存在' : '❌ 不存在' }}
                </div>
                <div class="text-body-2 mb-2">
                  <strong>newProposal:</strong> {{ storageData.newProposal ? '✅ 存在' : '❌ 不存在' }}
                </div>
                <div class="text-body-2">
                  <strong>isGenerating:</strong> {{ storageData.isGenerating ? '✅ 是' : '❌ 否' }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card>
              <v-card-title>
                <v-icon start>mdi-bookmark-multiple</v-icon>
                Chrome Bookmarks
              </v-card-title>
              <v-card-text>
                <div class="text-body-2 mb-2">
                  <strong>API状态:</strong> {{ chromeApiStatus }}
                </div>
                <div class="text-body-2 mb-2">
                  <strong>书签树:</strong> {{ bookmarkTree.length > 0 ? `${bookmarkTree.length} 个根节点` : '无数据' }}
                </div>
                <div class="text-body-2">
                  <strong>总书签数:</strong> {{ totalBookmarks }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card>
              <v-card-title>
                <v-icon start>mdi-message</v-icon>
                Background Script
              </v-card-title>
              <v-card-text>
                <div class="text-body-2 mb-2">
                  <strong>连接状态:</strong> {{ backgroundStatus.connected ? '✅ 已连接' : '❌ 未连接' }}
                </div>
                <div class="text-body-2 mb-2">
                  <strong>版本:</strong> {{ backgroundStatus.version || '未知' }}
                </div>
                <div class="text-body-2">
                  <strong>Service Worker:</strong> {{ backgroundStatus.serviceWorkerActive ? '✅ 活跃' : '❌ 不活跃' }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- 数据对比面板 -->
        <v-row class="mt-4">
          <v-col cols="12" md="6">
            <v-card height="500">
              <v-card-title>
                <v-icon start color="info">mdi-folder-open</v-icon>
                左侧面板数据 (originalTree)
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text class="pa-0">
                <div v-if="processedOriginalTree.length === 0" class="text-center pa-8">
                  <v-icon size="64" color="grey">mdi-folder-off</v-icon>
                  <div class="text-h6 mt-4">无数据</div>
                  <div class="text-body-2 text-medium-emphasis">左侧面板没有显示任何数据</div>
                </div>
                <v-list v-else dense class="bookmark-list">
                  <template v-for="node in processedOriginalTree" :key="node.id">
                    <v-list-group v-if="node.children">
                      <template v-slot:activator="{ props }">
                        <v-list-item v-bind="props">
                          <template v-slot:prepend>
                            <v-icon>mdi-folder</v-icon>
                          </template>
                          <v-list-item-title>{{ node.title }} ({{ node.children.length }})</v-list-item-title>
                        </v-list-item>
                      </template>
                      <v-list-item 
                        v-for="child in node.children.slice(0, 10)" 
                        :key="child.id"
                        class="ml-4"
                      >
                        <template v-slot:prepend>
                          <v-icon size="small">{{ child.children ? 'mdi-folder-outline' : 'mdi-bookmark' }}</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">{{ child.title }}</v-list-item-title>
                      </v-list-item>
                      <v-list-item v-if="node.children.length > 10" class="ml-4">
                        <v-list-item-title class="text-caption text-medium-emphasis">
                          ... 还有 {{ node.children.length - 10 }} 个项目
                        </v-list-item-title>
                      </v-list-item>
                    </v-list-group>
                    <v-list-item v-else>
                      <template v-slot:prepend>
                        <v-icon>mdi-bookmark</v-icon>
                      </template>
                      <v-list-item-title>{{ node.title }}</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card height="500">
              <v-card-title>
                <v-icon start color="success">mdi-magic-staff</v-icon>
                右侧面板数据 (newProposalTree)
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text class="pa-0">
                <div v-if="!processedProposalTree || processedProposalTree.length === 0" class="text-center pa-8">
                  <v-icon size="64" color="grey">mdi-plus-circle-outline</v-icon>
                  <div class="text-h6 mt-4">无数据</div>
                  <div class="text-body-2 text-medium-emphasis">右侧面板没有显示任何数据</div>
                </div>
                <v-list v-else dense class="bookmark-list">
                  <template v-for="node in processedProposalTree" :key="(node as any).id || node.title">
                    <v-list-group v-if="node.children">
                      <template v-slot:activator="{ props }">
                        <v-list-item v-bind="props">
                          <template v-slot:prepend>
                            <v-icon>mdi-folder</v-icon>
                          </template>
                          <v-list-item-title>{{ node.title }} ({{ node.children.length }})</v-list-item-title>
                        </v-list-item>
                      </template>
                      <v-list-item 
                        v-for="child in node.children.slice(0, 10)" 
                        :key="child.id || child.title"
                        class="ml-4"
                      >
                        <template v-slot:prepend>
                          <v-icon size="small">{{ child.children ? 'mdi-folder-outline' : 'mdi-bookmark' }}</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">{{ child.title }}</v-list-item-title>
                      </v-list-item>
                      <v-list-item v-if="node.children.length > 10" class="ml-4">
                        <v-list-item-title class="text-caption text-medium-emphasis">
                          ... 还有 {{ node.children.length - 10 }} 个项目
                        </v-list-item-title>
                      </v-list-item>
                    </v-list-group>
                    <v-list-item v-else>
                      <template v-slot:prepend>
                        <v-icon>mdi-bookmark</v-icon>
                      </template>
                      <v-list-item-title>{{ node.title }}</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- 调试日志 -->
        <v-row class="mt-4">
          <v-col cols="12">
            <v-card>
              <v-card-title>
                <v-icon start>mdi-text-box</v-icon>
                调试日志
                <v-spacer></v-spacer>
                <v-btn @click="clearLogs" size="small" variant="outlined">清除日志</v-btn>
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text>
                <pre class="debug-log">{{ debugLogs.join('\n') }}</pre>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

// 响应式数据
const isLoading = ref(false);
const showAlert = ref(false);
const alertType = ref<'success' | 'info' | 'warning' | 'error'>('info');
const alertTitle = ref('');
const alertText = ref('');
const debugLogs = ref<string[]>([]);

// 存储数据状态
const storageData = ref({
  originalTree: null as any,
  newProposal: null as any,
  isGenerating: false
});

// Chrome API 状态
const chromeApiStatus = ref('未检查');
const bookmarkTree = ref<any[]>([]);
const totalBookmarks = ref(0);

// Background Script 状态
const backgroundStatus = ref({
  connected: false,
  version: '',
  serviceWorkerActive: false
});

// 处理后的数据
const processedOriginalTree = computed(() => {
  if (!storageData.value.originalTree) return [];
  
  // 处理书签树数据
  if (Array.isArray(storageData.value.originalTree)) {
    return storageData.value.originalTree;
  }
  
  // 如果是 [root] 格式
  if (storageData.value.originalTree[0]?.children) {
    return storageData.value.originalTree[0].children;
  }
  
  return [];
});

const processedProposalTree = computed(() => {
  if (!storageData.value.newProposal) return [];
  
  // 转换 legacy proposal 格式为树状结构
  const proposal = storageData.value.newProposal;
  const result: any[] = [];
  
  if (proposal['书签栏']) {
    const bookmarksBar: any = {
      title: '书签栏',
      children: []
    };
    
    for (const [categoryPath, bookmarks] of Object.entries(proposal['书签栏'])) {
      if (Array.isArray(bookmarks)) {
        bookmarksBar.children.push({
          title: categoryPath,
          children: bookmarks
        });
      }
    }
    
    if (bookmarksBar.children.length > 0) {
      result.push(bookmarksBar);
    }
  }
  
  if (proposal['其他书签'] && Array.isArray(proposal['其他书签'])) {
    result.push({
      title: '其他书签',
      children: proposal['其他书签']
    });
  }
  
  return result;
});

// 日志函数
function log(message: string, _type: 'info' | 'error' | 'success' | 'warning' = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  debugLogs.value.push(logMessage);
  
  // 只保留最近50条日志
  if (debugLogs.value.length > 50) {
    debugLogs.value.shift();
  }
  
  console.log(logMessage);
}

function showNotification(title: string, text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') {
  alertTitle.value = title;
  alertText.value = text;
  alertType.value = type;
  showAlert.value = true;
}

function clearLogs() {
  debugLogs.value = [];
  log('日志已清除');
}

// 检查 Chrome API
async function checkChromeAPI() {
  log('检查 Chrome API...');
  
  try {
    if (typeof chrome === 'undefined') {
      chromeApiStatus.value = '❌ Chrome API 不可用';
      log('Chrome API 不可用', 'error');
      return;
    }
    
    if (!chrome.bookmarks) {
      chromeApiStatus.value = '❌ Bookmarks API 不可用';
      log('Chrome Bookmarks API 不可用', 'error');
      return;
    }
    
    chromeApiStatus.value = '✅ 可用';
    log('Chrome API 检查通过');
    
    // 获取书签树
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        log(`获取书签树失败: ${chrome.runtime.lastError.message}`, 'error');
        chromeApiStatus.value = '❌ 获取失败';
      } else {
        bookmarkTree.value = tree;
        totalBookmarks.value = countBookmarks(tree);
        log(`成功获取书签树，共 ${totalBookmarks.value} 个书签`);
      }
    });
    
  } catch (error: any) {
    chromeApiStatus.value = '❌ 检查失败';
    log(`Chrome API 检查失败: ${error.message}`, 'error');
  }
}

// 计算书签数量
function countBookmarks(nodes: any[]): number {
  let count = 0;
  
  function traverse(node: any) {
    if (node.url) {
      count++;
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  nodes.forEach(traverse);
  return count;
}

// 检查 Background Script
async function checkBackgroundScript() {
  log('检查 Background Script...');
  
  try {
    if (!chrome.runtime) {
      log('Chrome Runtime API 不可用', 'error');
      return;
    }
    
    chrome.runtime.sendMessage({ action: 'healthCheck' }, (response) => {
      if (chrome.runtime.lastError) {
        log(`Background Script 连接失败: ${chrome.runtime.lastError.message}`, 'error');
        backgroundStatus.value.connected = false;
      } else if (response) {
        log('Background Script 连接成功');
        backgroundStatus.value.connected = true;
        backgroundStatus.value.version = response.version;
        backgroundStatus.value.serviceWorkerActive = response.serviceWorkerActive;
      } else {
        log('Background Script 无响应', 'warning');
        backgroundStatus.value.connected = false;
      }
    });
    
  } catch (error: any) {
    log(`Background Script 检查失败: ${error.message}`, 'error');
    backgroundStatus.value.connected = false;
  }
}

// 加载存储数据
async function loadStorageData() {
  log('加载存储数据...');
  
  try {
    chrome.storage.local.get(['originalTree', 'newProposal', 'isGenerating'], (data) => {
      if (chrome.runtime.lastError) {
        log(`加载存储数据失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      storageData.value = {
        originalTree: data.originalTree || null,
        newProposal: data.newProposal || null,
        isGenerating: data.isGenerating || false
      };
      
      log(`存储数据加载完成:`);
      log(`  - originalTree: ${data.originalTree ? '存在' : '不存在'}`);
      log(`  - newProposal: ${data.newProposal ? '存在' : '不存在'}`);
      log(`  - isGenerating: ${data.isGenerating ? '是' : '否'}`);
      
      if (!data.originalTree && !data.newProposal) {
        showNotification('数据为空', '左右面板都没有数据，这可能是问题所在', 'warning');
      } else if (!data.originalTree) {
        showNotification('左侧无数据', 'originalTree 为空，左侧面板将不显示数据', 'warning');
      } else if (!data.newProposal) {
        showNotification('右侧无数据', 'newProposal 为空，右侧面板将不显示数据', 'warning');
      } else {
        showNotification('数据加载成功', '左右面板数据都已找到', 'success');
      }
    });
    
  } catch (error: any) {
    log(`加载存储数据异常: ${error.message}`, 'error');
  }
}

// 主加载函数
async function loadData() {
  isLoading.value = true;
  log('开始加载数据...');
  
  try {
    await Promise.all([
      checkChromeAPI(),
      checkBackgroundScript(),
      loadStorageData()
    ]);
    
    log('所有数据加载完成');
    
  } catch (error: any) {
    log(`数据加载失败: ${error.message}`, 'error');
    showNotification('加载失败', `数据加载过程中出现错误: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

// 监听来自 background script 的消息
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    log(`收到消息: ${request.action}`);
    
    if (request.action === 'dataReady') {
      log('数据准备完成，重新加载存储数据');
      setTimeout(loadStorageData, 500);
    } else if (request.action === 'dataRefreshed') {
      log('数据已刷新，重新加载存储数据');
      setTimeout(loadStorageData, 500);
    }
  });
}

// 组件挂载时加载数据
onMounted(() => {
  log('Debug Management 组件已挂载');
  setTimeout(loadData, 1000);
});
</script>

<style scoped>
.bookmark-list {
  max-height: 400px;
  overflow-y: auto;
}

.debug-log {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 300px;
  overflow-y: auto;
  background-color: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  white-space: pre-wrap;
}
</style>