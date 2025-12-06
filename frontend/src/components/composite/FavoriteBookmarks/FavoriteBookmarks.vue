<template>
  <!-- 仅在有收藏数据时显示整个模块 -->
  <div v-if="favorites.length > 0" class="favorite-bookmarks">
    <!-- 标题栏 -->
    <div class="favorites-header">
      <div class="header-title">
        <Icon name="icon-star" :size="16" color="primary" />
        <span class="title-text">收藏书签</span>
        <span class="count-badge">{{ favorites.length }}</span>
      </div>
    </div>

    <!-- 收藏列表 -->
    <div class="favorites-list">
      <div
        v-for="(favorite, index) in favorites"
        :key="favorite.id"
        class="favorite-item"
        :title="`${favorite.title}\n${favorite.url}`"
        @click="handleClick(favorite)"
      >
        <!-- 图标 -->
        <img
          v-if="getFaviconUrl(favorite.url)"
          :src="getFaviconUrl(favorite.url)"
          class="favorite-icon"
          alt="favicon"
          @error="handleImageError"
        />
        <Icon v-else name="icon-bookmark" :size="16" />

        <!-- 标题 -->
        <span class="favorite-title">{{ favorite.title }}</span>

        <!-- 序号（可选） -->
        <span v-if="props.showNumbers" class="favorite-number">{{
          index + 1
        }}</span>

        <!-- 移除按钮 -->
        <button
          class="remove-btn"
          :title="'取消收藏'"
          @click.stop="handleRemove(favorite)"
        >
          <Icon name="icon-cancel" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@/components'
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
 * 获取网站图标URL
 */
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).origin
    return `${domain}/favicon.ico`
  } catch {
    return ''
  }
}

/**
 * 图标加载失败处理
 */
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

/**
 * 点击收藏书签
 */
function handleClick(favorite: FavoriteBookmark) {
  logger.info('FavoriteBookmarks', '🔗 点击收藏书签:', favorite.title)
  emit('bookmark-click', favorite)
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

onMounted(async () => {
  logger.info('FavoriteBookmarks', '🚀 组件挂载，开始监听收藏事件')

  // 首次加载
  await loadFavorites()

  // 监听收藏相关事件
  const unsubscribeAdded = onEvent('favorite:added', async () => {
    logger.debug('FavoriteBookmarks', '📨 收到 favorite:added 事件，刷新列表')
    await loadFavorites()
  })

  const unsubscribeRemoved = onEvent('favorite:removed', async () => {
    logger.debug('FavoriteBookmarks', '📨 收到 favorite:removed 事件，刷新列表')
    await loadFavorites()
  })

  const unsubscribeReordered = onEvent('favorite:reordered', async () => {
    logger.debug(
      'FavoriteBookmarks',
      '📨 收到 favorite:reordered 事件，刷新列表'
    )
    await loadFavorites()
  })

  // 组件卸载时取消监听
  onUnmounted(() => {
    logger.info('FavoriteBookmarks', '🔌 组件卸载，取消事件监听')
    unsubscribeAdded()
    unsubscribeRemoved()
    unsubscribeReordered()
  })
})
</script>

<style scoped lang="scss">
/* stylelint-disable declaration-property-value-disallowed-list -- 收藏组件使用特定尺寸 */

.favorite-bookmarks {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background-color: var(--surface);
}

.favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);

  .title-text {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
  }

  .count-badge {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-width: var(--spacing-4);
    height: var(--spacing-4);
    padding: 0 var(--spacing-1);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--primary);
    background-color: var(--primary-alpha-10);
  }
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.favorite-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-2);
  border-radius: var(--radius-sm);
  background-color: var(--background);
  cursor: pointer;
  transition: all 0.15s ease;
}

.favorite-icon {
  flex-shrink: 0;
  width: var(--spacing-4);
  height: var(--spacing-4);
  border-radius: var(--radius-xs);
}

.favorite-title {
  flex: 1;
  font-size: var(--text-sm);
  white-space: nowrap;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-number {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: var(--spacing-4);
  height: var(--spacing-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  background-color: var(--surface);
}

.remove-btn {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: var(--spacing-5);
  height: var(--spacing-5);
  padding: 0;
  border: none;
  color: var(--text-secondary);
  background: none;
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.remove-btn:hover {
  color: var(--error);
}

.favorite-item:hover {
  background-color: var(--hover);
}

.favorite-item:hover .remove-btn {
  opacity: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;

  .empty-text {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .empty-hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-tertiary);
  }
}
</style>
