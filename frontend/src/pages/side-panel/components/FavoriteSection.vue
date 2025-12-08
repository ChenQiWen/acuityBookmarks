<template>
  <!-- 仅在有收藏数据时显示整个模块 -->
  <section v-if="favorites.length > 0" class="favorite-section">
    <!-- 标题栏 -->
    <header class="favorite-section__header">
      <div class="favorite-section__title">
        <Icon name="icon-star" :size="14" color="primary" />
        <span class="favorite-section__title-text">收藏书签</span>
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
    </header>

    <!-- 收藏列表 -->
    <div class="favorite-section__list">
      <FavoriteItem
        v-for="(favorite, index) in favorites"
        :key="favorite.id"
        :bookmark="favorite"
        :index="index"
        @click="handleClick(favorite)"
        @remove="handleRemove(favorite)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, CountIndicator, Icon } from '@/components'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { favoriteAppService } from '@/application/bookmark/favorite-app-service'
import { logger } from '@/infrastructure/logging/logger'
import FavoriteItem from './FavoriteItem.vue'
import type { BookmarkNode } from '@/types'

defineOptions({
  name: 'FavoriteSection'
})

const emit = defineEmits<{
  /** 点击书签 */
  'bookmark-click': [bookmark: BookmarkNode]
  /** 移除收藏 */
  'bookmark-remove': [bookmark: BookmarkNode]
  /** 分享收藏书签 */
  'share': [bookmarks: BookmarkNode[]]
}>()

// ✅ 从 Pinia Store 派生数据，响应式更新
const bookmarkStore = useBookmarkStore()
const favorites = computed(() => bookmarkStore.favoriteBookmarks)

// === 事件处理 ===

function handleClick(bookmark: BookmarkNode) {
  logger.info('FavoriteSection', '🔗 点击收藏书签:', bookmark.title)
  emit('bookmark-click', bookmark)
}

function handleShare() {
  logger.info('FavoriteSection', `📤 分享 ${favorites.value.length} 个收藏书签`)
  emit('share', favorites.value)
}

async function handleRemove(bookmark: BookmarkNode) {
  logger.info('FavoriteSection', '🗑️ 移除收藏:', bookmark.title)

  const success = await favoriteAppService.removeFromFavorites(bookmark.id)
  if (success) {
    // ✅ 直接更新 store，UI 自动响应式更新
    bookmarkStore.updateNode(bookmark.id, { isFavorite: false })
    emit('bookmark-remove', bookmark)
  }
}
</script>

<style scoped lang="scss">
.favorite-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface-subtle);
}

.favorite-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--spacing-1);
}

.favorite-section__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
}

.favorite-section__title-text {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-tertiary);
}

.favorite-section__list {
  display: flex;
  flex-direction: column;
}
</style>
