<template>
  <Dialog
    :show="show"
    title="分享书签"
    icon="icon-share"
    max-width="720px"
    @update:show="$emit('update:show', $event)"
  >
    <!-- 屏幕阅读器消息区域（视觉上隐藏） -->
    <div
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ state.srMessage }}
    </div>

    <div class="share-dialog-content">
      <!-- 标题输入 -->
      <div class="title-input-section">
        <label for="share-title" class="title-label">分享标题：</label>
        <Input
          id="share-title"
          v-model="state.customTitle"
          placeholder="输入自定义标题"
          variant="outlined"
          density="compact"
          @input="handleTitleChange"
        />
      </div>

      <!-- 主题选择 -->
      <div class="theme-selector" role="group" aria-labelledby="theme-label">
        <label id="theme-label" class="theme-label">主题：</label>
        <div class="theme-buttons">
          <Button
            :variant="state.selectedTheme === 'dark' ? 'primary' : 'outline'"
            size="sm"
            aria-label="选择深色主题"
            :aria-pressed="state.selectedTheme === 'dark'"
            @click="handleThemeChange('dark')"
          >
            🌙 深色
          </Button>
          <Button
            :variant="state.selectedTheme === 'light' ? 'primary' : 'outline'"
            size="sm"
            aria-label="选择浅色主题"
            :aria-pressed="state.selectedTheme === 'light'"
            @click="handleThemeChange('light')"
          >
            ☀️ 浅色
          </Button>
        </div>
      </div>

      <!-- 书签数量提示 -->
      <div
        v-if="bookmarks.length > 0"
        class="bookmarks-info"
        role="status"
        aria-live="polite"
      >
        <Icon name="icon-bookmark" :size="16" color="primary" aria-hidden="true" />
        <span class="info-text">将分享 {{ bookmarks.length }} 个书签</span>
      </div>

      <!-- 海报预览 -->
      <div class="poster-preview" role="region" aria-label="海报预览区域">
        <div
          v-if="state.isGenerating"
          class="preview-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner size="lg" aria-hidden="true" />
          <span>正在生成海报...</span>
        </div>
        <div
          v-else-if="state.error"
          class="preview-error"
          role="alert"
          aria-live="assertive"
        >
          <Icon name="icon-alert" :size="48" color="error" aria-hidden="true" />
          <span>{{ state.error }}</span>
          <Button variant="outline" size="sm" aria-label="重新生成海报" @click="handleRetry">
            重试
          </Button>
        </div>
        <img
          v-else-if="state.posterPreview"
          :src="state.posterPreview"
          alt="分享海报预览，包含书签列表和二维码"
          class="preview-image"
          role="img"
        />
      </div>
    </div>

    <template #actions>
      <Button
        variant="text"
        icon-only
        title="取消"
        aria-label="关闭分享对话框"
        @click="$emit('update:show', false)"
      >
        <Icon name="icon-cancel" :size="20" />
      </Button>
      <Button
        variant="outline"
        icon-only
        title="复制图片"
        :disabled="!state.posterPreview || state.isGenerating"
        aria-label="复制海报图片到剪贴板"
        @click="handleCopyImage"
      >
        <Icon name="icon-copy" :size="20" />
      </Button>
      <Button
        variant="outline"
        icon-only
        title="下载图片"
        :disabled="!state.posterPreview || state.isGenerating"
        aria-label="下载海报图片"
        @click="handleDownloadImage"
      >
        <Icon name="icon-download" :size="20" />
      </Button>
      <Button
        color="primary"
        icon-only
        title="生成链接"
        :disabled="!state.posterPreview || state.isGenerating"
        aria-label="生成分享链接并复制到剪贴板"
        @click="handleGenerateLink"
      >
        <Icon name="icon-link" :size="20" />
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { reactive, watch, onUnmounted, ref, nextTick, computed } from 'vue'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import type { ShareDialogProps, ShareDialogEmits } from './ShareDialog.d'
import { Button, Dialog, Icon, Spinner, Input } from '@/components'
import { shareService } from '@/application/share/share-service'
import { posterService } from '@/application/share/poster-service'
import { notifySuccess, notifyError } from '@/application/notification/notification-service'
import { logger } from '@/infrastructure/logging/logger'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'

defineOptions({ name: 'ShareDialog' })

const props = defineProps<ShareDialogProps>()
const emit = defineEmits<ShareDialogEmits>()

// 获取用户信息
const { user } = useSupabaseAuth()

// 焦点管理
const previousActiveElement = ref<HTMLElement | null>(null)

// 获取用户名（优先使用用户设置的昵称，其次使用 user_metadata.name，最后使用 email 的前缀）
const userName = computed(() => {
  if (!user.value) return '我'
  
  // 1. 优先使用用户自己设置的昵称（从 user_metadata.nickname 读取）
  if (user.value.user_metadata?.nickname) {
    return user.value.user_metadata.nickname
  }
  
  // 2. 其次使用 OAuth 返回的 full_name
  if (user.value.user_metadata?.full_name) {
    return user.value.user_metadata.full_name
  }
  
  // 3. 再次使用 user_metadata 中的 name
  if (user.value.user_metadata?.name) {
    return user.value.user_metadata.name
  }
  
  // 4. 最后使用 email 的前缀（@ 之前的部分）
  if (user.value.email) {
    return user.value.email.split('@')[0]
  }
  
  return '我'
})

// 计算默认标题
const defaultTitle = computed(() => {
  if (props.shareType === 'folder' && props.folderName) {
    return `${props.folderName}的分享书签`
  }
  return `${userName.value}的分享书签`
})

// 组件状态
const state = reactive({
  selectedTheme: 'dark' as 'dark' | 'light',
  customTitle: '', // 用户自定义标题
  posterPreview: null as string | null,
  isGenerating: false,
  error: null as string | null,
  currentGenerationId: 0, // 用于取消未完成的生成任务
  srMessage: '' // 屏幕阅读器消息
})

// 获取当前使用的标题（用户输入 or 默认）
const currentTitle = computed(() => {
  return state.customTitle.trim() || defaultTitle.value
})

// 生成海报（防抖 + 取消未完成任务）
const generatePoster = useDebounceFn(async () => {
  if (props.bookmarks.length === 0) {
    state.posterPreview = null
    state.error = '没有可分享的书签'
    state.isGenerating = false
    return
  }

  // 生成新的任务 ID
  const generationId = ++state.currentGenerationId
  state.isGenerating = true
  state.error = null

  try {
    // 1. 编码书签数据
    const encoded = shareService.encodeShareData(
      props.bookmarks,
      props.shareType === 'folder' ? props.folderName : '我的收藏书签'
    )

    // 检查任务是否已被取消
    if (generationId !== state.currentGenerationId) {
      logger.debug('ShareDialog', '海报生成任务已取消', { generationId })
      return
    }

    // 2. 生成分享 URL
    const shareUrl = shareService.generateShareUrl(encoded)

    // 检查 URL 长度
    if (shareUrl.length > 2000) {
      throw new Error(
        `分享链接过长（${shareUrl.length} 字符），无法生成二维码\n` +
        `请减少书签数量后重试`
      )
    }

    // 再次检查任务是否已被取消
    if (generationId !== state.currentGenerationId) {
      logger.debug('ShareDialog', '海报生成任务已取消', { generationId })
      return
    }

    // 3. 生成海报
    const posterDataUrl = await posterService.generatePoster({
      bookmarks: props.bookmarks.map(b => ({
        title: b.title,
        url: b.url || '',
        description: typeof b.description === 'string' ? b.description : undefined
      })),
      theme: state.selectedTheme,
      title: currentTitle.value, // 使用当前标题（用户输入 or 默认）
      shareUrl
    })

    // 最后检查任务是否已被取消
    if (generationId !== state.currentGenerationId) {
      logger.debug('ShareDialog', '海报生成任务已取消', { generationId })
      return
    }

    state.posterPreview = posterDataUrl
    state.error = null // 清除错误
    logger.info('ShareDialog', '海报生成成功', {
      bookmarkCount: props.bookmarks.length,
      theme: state.selectedTheme,
      generationId
    })
  } catch (error) {
    // 只有当前任务才显示错误
    if (generationId === state.currentGenerationId) {
      logger.error('ShareDialog', '海报生成失败', error)
      state.error = error instanceof Error ? error.message : '海报生成失败，请重试'
      state.posterPreview = null // 清除预览
    }
  } finally {
    // 只有当前任务才更新状态
    if (generationId === state.currentGenerationId) {
      state.isGenerating = false
    }
  }
}, 300)

// 主题切换（防抖）
const handleThemeChange = useDebounceFn((theme: 'dark' | 'light') => {
  state.selectedTheme = theme
  generatePoster()
}, 150)

// 标题变化（防抖）
const handleTitleChange = useDebounceFn(() => {
  generatePoster()
}, 500)

// 重试
const handleRetry = () => {
  generatePoster()
}

// 复制图片
const handleCopyImage = async () => {
  if (!state.posterPreview) return

  try {
    // 将 Data URL 转换为 Blob
    const response = await fetch(state.posterPreview)
    const blob = await response.blob()

    // 复制到剪贴板
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ])

    const message = '图片已复制到剪贴板'
    notifySuccess(message)
    state.srMessage = message // 屏幕阅读器播报
    logger.info('ShareDialog', '图片复制成功')
  } catch (error) {
    const message = '图片复制失败，请尝试下载'
    logger.error('ShareDialog', '图片复制失败', error)
    notifyError(message)
    state.srMessage = message // 屏幕阅读器播报
  }
}

// 下载图片
const handleDownloadImage = () => {
  if (!state.posterPreview) return

  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .slice(0, 15)
    const filename = `bookmarks-share-${timestamp}.png`

    shareService.downloadImage(state.posterPreview, filename)
    const message = '图片下载已开始'
    notifySuccess(message)
    state.srMessage = message // 屏幕阅读器播报
    logger.info('ShareDialog', '图片下载成功', { filename })
  } catch (error) {
    const message = '图片下载失败，请重试'
    logger.error('ShareDialog', '图片下载失败', error)
    notifyError(message)
    state.srMessage = message // 屏幕阅读器播报
  }
}

// 生成链接
const handleGenerateLink = async () => {
  try {
    // 编码书签数据
    const encoded = shareService.encodeShareData(
      props.bookmarks,
      props.shareType === 'folder' ? props.folderName : '我的收藏书签'
    )

    // 生成分享 URL
    const shareUrl = shareService.generateShareUrl(encoded)

    // 复制到剪贴板
    await shareService.copyToClipboard(shareUrl)

    const message = '分享链接已复制到剪贴板'
    notifySuccess(message)
    state.srMessage = message // 屏幕阅读器播报
    logger.info('ShareDialog', '分享链接生成成功', { url: shareUrl })

    // 触发分享完成事件
    emit('share-complete')
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成链接失败，请重试'
    logger.error('ShareDialog', '生成链接失败', error)
    notifyError(message)
    state.srMessage = message // 屏幕阅读器播报
  }
}

// 键盘导航：ESC 键关闭弹窗
useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    emit('update:show', false)
  }
})

// 焦点管理：弹窗打开时保存当前焦点，关闭时恢复
const manageFocus = async (show: boolean) => {
  if (show) {
    // 保存当前焦点元素
    previousActiveElement.value = document.activeElement as HTMLElement

    // 等待 DOM 更新后，聚焦到弹窗内的第一个可聚焦元素
    await nextTick()
    const firstFocusable = document.querySelector(
      '.share-dialog-content button, .share-dialog-content [tabindex="0"]'
    ) as HTMLElement
    if (firstFocusable) {
      firstFocusable.focus()
    }
  } else {
    // 恢复之前的焦点
    if (previousActiveElement.value) {
      previousActiveElement.value.focus()
      previousActiveElement.value = null
    }
  }
}

// 监听弹窗显示状态
watch(
  () => props.show,
  show => {
    if (show) {
      // 弹窗打开时将默认标题填充到输入框
      state.customTitle = defaultTitle.value
      generatePoster()
      // 管理焦点
      manageFocus(true)
    } else {
      // 弹窗关闭时取消未完成的任务并清理状态
      state.currentGenerationId++ // 取消当前任务
      state.posterPreview = null
      state.error = null
      state.isGenerating = false
      state.customTitle = '' // 清空自定义标题
      // 恢复焦点
      manageFocus(false)
    }
  }
)

// 组件卸载时取消未完成的任务
onUnmounted(() => {
  state.currentGenerationId++
})
</script>

<style scoped>
/* 屏幕阅读器专用（视觉上隐藏） */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border-width: 0;
  white-space: nowrap;
  overflow: hidden;
  clip-path: inset(50%);
}

.share-dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  min-height: 400px;
}

/* 标题输入 */
.title-input-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.title-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  white-space: nowrap;
  color: var(--color-text-secondary);
}

/* 主题选择器 */
.theme-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.theme-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.theme-buttons {
  display: flex;
  gap: var(--spacing-2);
}

/* 书签数量提示 */
.bookmarks-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.info-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 海报预览 */
.poster-preview {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.preview-loading,
.preview-error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  color: var(--color-text-secondary);
}

.preview-image {
  max-width: 100%;
  max-height: 500px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}
</style>
