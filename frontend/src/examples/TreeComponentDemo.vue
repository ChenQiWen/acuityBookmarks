<!--
  🌳 统一书签树组件使用示例
  
  展示如何使用 SimpleBookmarkTree 组件
-->

<template>
  <div class="tree-demo">
    <div class="demo-header">
      <h2>🌳 统一书签目录树组件演示</h2>
      <p>完全配置化的书签树组件，支持多种使用场景</p>
    </div>

    <div class="demo-grid">
      <!-- 1. 侧边栏模式 -->
      <div class="demo-card">
        <h3>侧边栏模式 (Sidebar)</h3>
        <div class="tree-wrapper">
          <SimpleBookmarkTree
            :nodes="sampleBookmarks"
            size="compact"
            height="300px"
            searchable
            selectable="single"
            :show-toolbar="false"
            @node-click="handleNodeClick"
            @selection-change="handleSidebarSelection"
          />
        </div>
        <div class="demo-info">
          <small>紧凑布局，单选模式，适用于侧边栏导航</small>
          <div v-if="sidebarSelected">
            选中: {{ sidebarSelected.title }}
          </div>
        </div>
      </div>

      <!-- 2. 管理页面模式 -->
      <div class="demo-card">
        <h3>管理页面模式 (Management)</h3>
        <div class="tree-wrapper">
          <SimpleBookmarkTree
            :nodes="sampleBookmarks"
            size="comfortable"
            height="300px"
            searchable
            selectable="multiple"
            draggable
            editable
            @node-click="handleNodeClick"
            @selection-change="handleManagementSelection"
            @folder-toggle="handleFolderToggle"
          />
        </div>
        <div class="demo-info">
          <small>舒适布局，多选模式，支持编辑和拖拽</small>
          <div v-if="managementSelected.length">
            已选择 {{ managementSelected.length }} 个项目
          </div>
        </div>
      </div>

      <!-- 3. 选择器模式 -->
      <div class="demo-card">
        <h3>选择器模式 (Picker)</h3>
        <div class="tree-wrapper">
          <SimpleBookmarkTree
            :nodes="sampleBookmarks"
            size="compact"
            height="300px"
            searchable
            selectable="multiple"
            @selection-change="handlePickerSelection"
          />
        </div>
        <div class="demo-info">
          <small>用于选择特定书签，带复选框</small>
          <div v-if="pickerSelected.length">
            已选择: {{ pickerSelected.map(n => n.title).join(', ') }}
          </div>
        </div>
      </div>

      <!-- 4. 虚拟滚动模式 -->
      <div class="demo-card">
        <h3>虚拟滚动模式 (Virtual)</h3>
        <div class="tree-wrapper">
          <SimpleBookmarkTree
            :nodes="largeBookmarkTree"
            size="comfortable"
            height="300px"
            searchable
            :virtual="{ enabled: true, itemHeight: 32 }"
            @node-click="handleNodeClick"
          />
        </div>
        <div class="demo-info">
          <small>大数据集高性能渲染 ({{ largeTreeSize }} 个节点)</small>
        </div>
      </div>

      <!-- 5. 只读模式 -->
      <div class="demo-card">
        <h3>只读模式 (Readonly)</h3>
        <div class="tree-wrapper">
          <SimpleBookmarkTree
            :nodes="sampleBookmarks"
            size="comfortable"
            height="300px"
            searchable
            :selectable="false"
            :draggable="false"
            :editable="false"
            @node-click="handleReadonlyClick"
          />
        </div>
        <div class="demo-info">
          <small>纯展示模式，不支持交互操作</small>
          <div v-if="readonlyClicked">
            点击了: {{ readonlyClicked.title }}
          </div>
        </div>
      </div>

      <!-- 6. 宽松模式 -->
      <div class="demo-card">
        <h3>宽松模式 (Spacious)</h3>
        <div class="tree-wrapper">
          <SimpleBookmarkTree
            :nodes="sampleBookmarks"
            size="spacious"
            height="300px"
            searchable
            selectable="single"
            @node-click="handleNodeClick"
          />
        </div>
        <div class="demo-info">
          <small>宽松布局，显示更多信息如URL</small>
        </div>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <h3>🎛️ 控制面板</h3>
      <div class="controls">
        <Button @click="generateLargeTree" variant="outline">
          生成大数据集 (1000个节点)
        </Button>
        <Button @click="clearAllSelections" variant="outline">
          清除所有选择
        </Button>
        <Button @click="expandAllTrees" variant="outline">
          展开所有树
        </Button>
        <Button @click="collapseAllTrees" variant="outline">
          收起所有树
        </Button>
      </div>
    </div>

    <!-- 事件日志 -->
    <div class="event-log">
      <h3>📝 事件日志</h3>
      <div class="log-content">
        <div v-for="(log, index) in eventLogs" :key="index" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-type" :class="`log-${log.type}`">{{ log.type }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
      <Button @click="clearLogs" variant="text" size="sm">清除日志</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SimpleBookmarkTree from '../components/SimpleBookmarkTree.vue'
import { Button } from '../components/ui'
import type { BookmarkNode } from '../types'

// === 响应式状态 ===
const sidebarSelected = ref<BookmarkNode | null>(null)
const managementSelected = ref<BookmarkNode[]>([])
const pickerSelected = ref<BookmarkNode[]>([])
const readonlyClicked = ref<BookmarkNode | null>(null)

const eventLogs = ref<Array<{
  time: string
  type: 'click' | 'select' | 'toggle' | 'info'
  message: string
}>>([])

const largeBookmarkTree = ref<BookmarkNode[]>([])

// === 示例数据 ===
const sampleBookmarks: BookmarkNode[] = [
  {
    id: '1',
    title: '工作相关',
    dateAdded: Date.now(),
    children: [
      {
        id: '11',
        title: '开发工具',
        dateAdded: Date.now(),
        children: [
          {
            id: '111',
            title: 'GitHub',
            url: 'https://github.com',
            dateAdded: Date.now()
          },
          {
            id: '112',
            title: 'Stack Overflow',
            url: 'https://stackoverflow.com',
            dateAdded: Date.now()
          }
        ]
      },
      {
        id: '12',
        title: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
        dateAdded: Date.now()
      }
    ]
  },
  {
    id: '2',
    title: '学习资源',
    dateAdded: Date.now(),
    children: [
      {
        id: '21',
        title: 'Vue.js 官网',
        url: 'https://vuejs.org',
        dateAdded: Date.now()
      },
      {
        id: '22',
        title: 'TypeScript 文档',
        url: 'https://www.typescriptlang.org',
        dateAdded: Date.now()
      }
    ]
  },
  {
    id: '3',
    title: '娱乐休闲',
    dateAdded: Date.now(),
    children: [
      {
        id: '31',
        title: 'YouTube',
        url: 'https://youtube.com',
        dateAdded: Date.now()
      },
      {
        id: '32',
        title: 'Reddit',
        url: 'https://reddit.com',
        dateAdded: Date.now()
      }
    ]
  }
]

// === 计算属性 ===
const largeTreeSize = computed(() => {
  return countNodes(largeBookmarkTree.value)
})

// === 事件处理 ===
const handleNodeClick = (node: BookmarkNode, _event: MouseEvent) => {
  addLog('click', `点击节点: ${node.title}`)
}

const handleSidebarSelection = (_selectedIds: string[], nodes: BookmarkNode[]) => {
  sidebarSelected.value = nodes[0] || null
  addLog('select', `侧边栏选择: ${nodes.map(n => n.title).join(', ')}`)
}

const handleManagementSelection = (_selectedIds: string[], nodes: BookmarkNode[]) => {
  managementSelected.value = nodes
  addLog('select', `管理页面选择: ${nodes.length} 个项目`)
}

const handlePickerSelection = (_selectedIds: string[], nodes: BookmarkNode[]) => {
  pickerSelected.value = nodes
  addLog('select', `选择器选择: ${nodes.length} 个项目`)
}

const handleFolderToggle = (_folderId: string, node: BookmarkNode, expanded: boolean) => {
  addLog('toggle', `${expanded ? '展开' : '收起'} 文件夹: ${node.title}`)
}

const handleReadonlyClick = (node: BookmarkNode) => {
  readonlyClicked.value = node
  addLog('click', `只读模式点击: ${node.title}`)
}

// === 控制面板方法 ===
const generateLargeTree = () => {
  largeBookmarkTree.value = createLargeBookmarkTree(1000)
  addLog('info', `生成了 ${largeTreeSize.value} 个节点的大数据集`)
}

const clearAllSelections = () => {
  sidebarSelected.value = null
  managementSelected.value = []
  pickerSelected.value = []
  readonlyClicked.value = null
  addLog('info', '清除所有选择')
}

const expandAllTrees = () => {
  // 这里可以通过 ref 调用树组件的 expandAll 方法
  addLog('info', '展开所有树')
}

const collapseAllTrees = () => {
  // 这里可以通过 ref 调用树组件的 collapseAll 方法
  addLog('info', '收起所有树')
}

const clearLogs = () => {
  eventLogs.value = []
}

// === 工具函数 ===
function addLog(type: 'click' | 'select' | 'toggle' | 'info', message: string) {
  eventLogs.value.unshift({
    time: new Date().toLocaleTimeString(),
    type,
    message
  })
  
  // 只保留最近50条日志
  if (eventLogs.value.length > 50) {
    eventLogs.value = eventLogs.value.slice(0, 50)
  }
}

function countNodes(nodes: BookmarkNode[]): number {
  return nodes.reduce((count, node) => {
    return count + 1 + (node.children ? countNodes(node.children) : 0)
  }, 0)
}

function createLargeBookmarkTree(totalNodes: number): BookmarkNode[] {
  const tree: BookmarkNode[] = []
  let nodeId = 1
  
  // 创建根文件夹
  for (let i = 1; i <= Math.min(10, totalNodes); i++) {
    const folder: BookmarkNode = {
      id: String(nodeId++),
      title: `文件夹 ${i}`,
      dateAdded: Date.now(),
      children: []
    }
    
    // 为每个文件夹添加子项
    const remainingNodes = Math.floor((totalNodes - 10) / 10)
    for (let j = 1; j <= remainingNodes && nodeId <= totalNodes; j++) {
      if (j % 5 === 0) {
        // 每5个添加一个子文件夹
        const subFolder: BookmarkNode = {
          id: String(nodeId++),
          title: `子文件夹 ${i}-${j}`,
          dateAdded: Date.now(),
          children: []
        }
        
        // 为子文件夹添加书签
        for (let k = 1; k <= 3 && nodeId <= totalNodes; k++) {
          subFolder.children!.push({
            id: String(nodeId++),
            title: `书签 ${i}-${j}-${k}`,
            url: `https://example${nodeId}.com`,
            dateAdded: Date.now()
          })
        }
        
        folder.children!.push(subFolder)
      } else {
        // 添加普通书签
        folder.children!.push({
          id: String(nodeId++),
          title: `书签 ${i}-${j}`,
          url: `https://example${nodeId}.com`,
          dateAdded: Date.now()
        })
      }
    }
    
    tree.push(folder)
  }
  
  return tree
}

// === 生命周期 ===
onMounted(() => {
  addLog('info', '演示组件已加载')
})
</script>

<style scoped>
.tree-demo {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.demo-header {
  text-align: center;
  margin-bottom: 32px;
}

.demo-header h2 {
  margin: 0 0 8px 0;
  color: var(--color-text-primary);
}

.demo-header p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 16px;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.demo-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.demo-card h3 {
  margin: 0 0 12px 0;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.tree-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  margin-bottom: 12px;
}

.demo-info {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.demo-info div {
  margin-top: 8px;
  padding: 8px;
  background: var(--color-surface-variant);
  border-radius: var(--border-radius-sm);
  font-weight: 500;
}

.control-panel {
  background: var(--color-surface-variant);
  border-radius: var(--border-radius-lg);
  padding: 20px;
  margin-bottom: 24px;
}

.control-panel h3 {
  margin: 0 0 16px 0;
  color: var(--color-text-primary);
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.event-log {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: 20px;
}

.event-log h3 {
  margin: 0 0 16px 0;
  color: var(--color-text-primary);
}

.log-content {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border);
}

.log-time {
  color: var(--color-text-tertiary);
  min-width: 80px;
}

.log-type {
  min-width: 60px;
  font-weight: 600;
}

.log-click { color: var(--color-primary); }
.log-select { color: var(--color-success); }
.log-toggle { color: var(--color-warning); }
.log-info { color: var(--color-text-secondary); }

.log-message {
  flex: 1;
  color: var(--color-text-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .tree-demo {
    padding: 16px;
  }
  
  .demo-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .controls {
    flex-direction: column;
  }
}
</style>
