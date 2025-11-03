<template>
  <Dialog
    :show="show"
    title="添加书签"
    width="440px"
    @update:show="handleClose"
  >
    <div class="quick-add-content">
      <!-- 网站图标和信息预览 -->
      <div class="bookmark-preview">
        <div class="favicon">
          <img
            v-if="favIconUrl"
            :src="favIconUrl"
            alt="网站图标"
            @error="handleFaviconError"
          />
          <Icon v-else name="icon-bookmark" />
        </div>
        <div class="info">
          <Input
            v-model="bookmarkTitle"
            label="名称"
            placeholder="书签名称"
            size="md"
            :autofocus="true"
            @keydown.enter="handleConfirm"
          />
        </div>
      </div>

      <!-- 文件夹选择 -->
      <div class="folder-selection">
        <label class="label">文件夹</label>
        <select v-model="selectedFolderId" class="folder-select">
          <option value="">选择文件夹</option>
          <option
            v-for="folder in folderOptions"
            :key="folder.value"
            :value="folder.value"
          >
            {{ folder.label }}
          </option>
        </select>
      </div>

      <!-- AI 建议（如果启用） -->
      <div
        v-if="aiSuggestion && aiSuggestion !== selectedFolderId"
        class="ai-suggestion"
      >
        <Icon name="icon-sparkles" />
        <span>AI 建议：</span>
        <Button variant="text" size="sm" @click="selectAISuggestion">
          {{ getFolderName(aiSuggestion) }}
        </Button>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button variant="text" @click="handleClose"> 取消 </Button>
        <Button
          variant="primary"
          :disabled="!bookmarkTitle || !selectedFolderId"
          @click="handleConfirm"
        >
          完成
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, Input, Button, Icon } from '@/components'
import { logger } from '@/infrastructure/logging/logger'
import { notificationService } from '@/application/notification/notification-service'

defineOptions({
  name: 'QuickAddBookmarkDialog'
})

interface Props {
  show: boolean
  title?: string
  url?: string
  favIconUrl?: string
  enableAI?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  title: '',
  url: '',
  favIconUrl: '',
  enableAI: true
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [data: { title: string; url: string; folderId: string }]
}>()

// 书签信息
const bookmarkTitle = ref('')
const selectedFolderId = ref('')
const aiSuggestion = ref('')
const showFaviconError = ref(false)

// 文件夹列表
const folderOptions = ref<Array<{ label: string; value: string }>>([])

// 监听 props 变化
watch(
  () => props.show,
  async newShow => {
    if (newShow) {
      // 重置状态
      const initialTitle = props.title || props.url || '未命名书签'
      bookmarkTitle.value = initialTitle
      aiSuggestion.value = ''

      // ✅ 添加调试日志
      logger.info('QuickAddBookmark', '对话框打开', {
        propsTitle: props.title,
        propsUrl: props.url,
        initialTitle,
        favIconUrl: props.favIconUrl
      })

      // 加载文件夹列表
      await loadFolders()

      // 如果启用 AI，获取建议
      if (props.enableAI && props.title && props.url) {
        await getAISuggestion()
      }
    }
  }
)

/**
 * 加载所有文件夹
 */
async function loadFolders() {
  try {
    const tree = await chrome.bookmarks.getTree()
    const folders: Array<{ label: string; value: string }> = []

    // 递归遍历书签树，收集所有文件夹
    function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[], prefix = '') {
      for (const node of nodes) {
        if (!node.url) {
          // 是文件夹
          const label = prefix ? `${prefix} > ${node.title}` : node.title
          folders.push({ label, value: node.id })

          if (node.children) {
            traverse(node.children, label)
          }
        }
      }
    }

    traverse(tree)

    folderOptions.value = folders

    // 默认选择书签栏
    const bookmarksBar = folders.find(
      f => f.label === '书签栏' || f.label === 'Bookmarks Bar'
    )
    if (bookmarksBar) {
      selectedFolderId.value = bookmarksBar.value
    } else if (folders.length > 0) {
      selectedFolderId.value = folders[0].value
    }
  } catch (error) {
    logger.error('QuickAddBookmark', '加载文件夹列表失败', error)
  }
}

/**
 * 获取 AI 分类建议
 */
async function getAISuggestion() {
  try {
    const { aiAppService } = await import('@/application/ai/ai-app-service')

    const result = await aiAppService.categorizeBookmark({
      title: props.title,
      url: props.url
    })

    logger.info('QuickAddBookmark', 'AI 建议分类', {
      category: result.category
    })

    // 查找对应的文件夹
    const folder = folderOptions.value.find(
      f => f.label === result.category || f.label.includes(result.category)
    )

    if (folder) {
      aiSuggestion.value = folder.value
      selectedFolderId.value = folder.value // 自动选中 AI 建议的文件夹
    } else {
      // 如果文件夹不存在，提示用户（后续可以自动创建）
      logger.warn('QuickAddBookmark', 'AI 建议的文件夹不存在', {
        category: result.category
      })
    }
  } catch (error) {
    logger.error('QuickAddBookmark', 'AI 分类失败', error)
  }
}

/**
 * 选择 AI 建议的文件夹
 */
function selectAISuggestion() {
  if (aiSuggestion.value) {
    selectedFolderId.value = aiSuggestion.value
  }
}

/**
 * 获取文件夹名称
 */
function getFolderName(folderId: string): string {
  const folder = folderOptions.value.find(f => f.value === folderId)
  return folder?.label || '未知文件夹'
}

/**
 * 处理图标加载失败
 */
function handleFaviconError() {
  showFaviconError.value = true
}

/**
 * 确认添加
 */
function handleConfirm() {
  // ✅ 验证数据
  if (!bookmarkTitle.value || bookmarkTitle.value.trim() === '') {
    notificationService.notify('请填写书签名称', { level: 'warning' })
    return
  }

  if (!selectedFolderId.value) {
    notificationService.notify('请选择文件夹', { level: 'warning' })
    return
  }

  if (!props.url || props.url.trim() === '') {
    notificationService.notify('书签 URL 不能为空', { level: 'error' })
    return
  }

  logger.info('QuickAddBookmark', '用户确认添加书签', {
    title: bookmarkTitle.value,
    url: props.url,
    folderId: selectedFolderId.value
  })

  emit('confirm', {
    title: bookmarkTitle.value.trim(),
    url: props.url.trim(), // ✅ 确保 URL 不为空
    folderId: selectedFolderId.value
  })

  handleClose()
}

/**
 * 关闭对话框
 */
function handleClose() {
  emit('update:show', false)
}
</script>

<style scoped>
.quick-add-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.bookmark-preview {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-start;
}

.favicon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.favicon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.favicon .icon {
  font-size: 24px;
  color: var(--color-text-tertiary);
}

.info {
  flex: 1;
}

.folder-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.label {
  font-size: var(--font-size-body-small);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.folder-select {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-body);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.folder-select:hover {
  border-color: var(--color-border-hover);
}

.folder-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.ai-suggestion {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-primary-bg);
  border: 1px solid var(--color-primary-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-caption);
  color: var(--color-primary-text);
}

.ai-suggestion .icon {
  color: var(--color-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-2);
  padding: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}
</style>
