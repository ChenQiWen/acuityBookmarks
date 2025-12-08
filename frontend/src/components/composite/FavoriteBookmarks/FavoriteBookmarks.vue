<template>
  <!-- 仅在有收藏数据时显示整个模块 -->
  <div v-if="favorites.length > 0" class="favorite-bookmarks">
    <!-- 标题栏 -->
    <div class="favorites-header">
      <div class="header-title">
        <Icon name="icon-star" :size="14" color="primary" />
        <span class="title-text">收藏书签</span>
        <CountIndicator :count="favorites.length" size="sm" variant="primary" />
      </div>
      <!-- 分享按钮 -->
      <Button
        variant="ghost"
        size="sm"
        density="compact"
        icon-only
        title="分享收藏书签"
        @click="handleShare"
      >
        <Icon name="icon-share" :size="14" />
      </Button>
    </div>

    <!-- 收藏列表 -->
    <div class="favorites-list">
      <FavoriteItem
        v-for="(favorite, index) in favorites"
        :key="favorite.id"
        :favorite="favorite"
        :index="index"
        :show-number="props.showNumbers"
        @click="handleClick(favorite)"
        @remove="handleRemove(favorite)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button, CountIndicator, Icon } from '@/components'
import FavoriteItem from './FavoriteItem.vue'
import {
  favoriteAppService,
  type FavoriteBookmark
} from '@/application/bookmark/favorite-app-service'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'

defineOptions({
  name: 'FavoriteBookmarks'
})

interface Props {
  /** 是否显示序号 */
  showNumbers?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showNumbers: false
})

const emit = defineEmits<{
  'bookmark-click': [FavoriteBookmark]
  'bookmark-remove': [FavoriteBookmark]
  /** 分享收藏书签 */
  'share': [FavoriteBookmark[]]
}>()

// === 状态 ===
const favorites = ref<FavoriteBookmark[]>([])

// === 方法 ===

/**
 * 加载收藏书签
 */
async function loadFavorites() {
  try {
    logger.debug('FavoriteBookmarks', '🔄 加载收藏书签...')
    favorites.value = await favoriteAppService.getFavorites()
    logger.info(
      'FavoriteBookmarks',
      `✅ 加载了 ${favorites.value.length} 个收藏`
    )
  } catch (error) {
    logger.error('Component', 'FavoriteBookmarks', '❌ 加载收藏失败:', error)
  }
}

/**
 * 点击收藏书签
 */
function handleClick(favorite: FavoriteBookmark) {
  logger.info('FavoriteBookmarks', '🔗 点击收藏书签:', favorite.title)
  emit('bookmark-click', favorite)
}

/**
 * 分享收藏书签
 */
function handleShare() {
  logger.info(
    'FavoriteBookmarks',
    `📤 分享 ${favorites.value.length} 个收藏书签`
  )
  emit('share', favorites.value)
}

/**
 * 移除收藏
 */
async function handleRemove(favorite: FavoriteBookmark) {
  logger.info('FavoriteBookmarks', '🗑️ 移除收藏:', favorite.title)

  const success = await favoriteAppService.removeFromFavorites(favorite.id)
  if (success) {
    emit('bookmark-remove', favorite)
    // 重新加载列表
    await loadFavorites()
  }
}

// === 生命周期 ===

// 存储取消订阅函数
let unsubscribeAdded: (() => void) | null = null
let unsubscribeRemoved: (() => void) | null = null
let unsubscribeReordered: (() => void) | null = null

/**
 * 跨页面收藏变更监听器
 * 使用 chrome.storage.onChanged 接收来自其他页面的收藏变更事件
 */
const handleStorageChange = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => {
  if (areaName === 'session' && changes.__favoriteEvent) {
    const event = changes.__favoriteEvent.newValue as {
      type?: string
      action?: string
    } | null
    if (event?.type === 'FAVORITE_CHANGED') {
      logger.debug(
        'FavoriteBookmarks',
        `📨 收到跨页面收藏事件: ${event.action}`
      )
      loadFavorites()
    }
  }
}

onMounted(async () => {
  logger.info('FavoriteBookmarks', '🚀 组件挂载，开始监听收藏事件')

  // 监听收藏相关事件（在 await 之前注册）
  unsubscribeAdded = onEvent('favorite:added', async () => {
    logger.debug('FavoriteBookmarks', '📨 收到 favorite:added 事件，刷新列表')
    await loadFavorites()
  })

  unsubscribeRemoved = onEvent('favorite:removed', async () => {
    logger.debug('FavoriteBookmarks', '📨 收到 favorite:removed 事件，刷新列表')
    await loadFavorites()
  })

  unsubscribeReordered = onEvent('favorite:reordered', async () => {
    logger.debug(
      'FavoriteBookmarks',
      '📨 收到 favorite:reordered 事件，刷新列表'
    )
    await loadFavorites()
  })

  // 监听跨页面收藏变更（通过 storage 事件通道）
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange)
  }

  // 首次加载（在事件监听注册之后）
  await loadFavorites()
})

// ✅ onUnmounted 必须在 setup() 同步阶段注册，不能在 onMounted 的异步回调中
onUnmounted(() => {
  try {
    logger.info('FavoriteBookmarks', '🔌 组件卸载，取消事件监听')
    unsubscribeAdded?.()
    unsubscribeRemoved?.()
    unsubscribeReordered?.()
    // 移除跨页面监听
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  } catch {
    // 忽略卸载时的错误，避免插件刷新时崩溃
  }
})
</script>

<style scoped lang="scss">
.favorite-bookmarks {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface-subtle);
}

.favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--spacing-1);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);

  .title-text {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--color-text-tertiary);
  }
}

.favorites-list {
  display: flex;
  flex-direction: column;
}
</style>
