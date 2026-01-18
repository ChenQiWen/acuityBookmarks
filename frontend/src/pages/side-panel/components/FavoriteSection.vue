<template>
  <!-- 收藏列表 -->
  <section v-if="favorites.length > 0" class="favorite-section">
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
import { computed, watch, onMounted, onUnmounted } from 'vue'
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
  /** 数量更新 */
  'count-update': [count: number]
}>()

// ✅ 从 Pinia Store 派生数据，响应式更新
const bookmarkStore = useBookmarkStore()
const favorites = computed(() => bookmarkStore.favoriteBookmarks)

// 组件挂载时立即发送数量
onMounted(() => {
  emit('count-update', favorites.value.length)
})

// 监听数量变化，自动更新
const stopWatch = watch(() => favorites.value.length, (newCount) => {
  emit('count-update', newCount)
})

// 组件卸载时清理 watch
onUnmounted(() => {
  if (stopWatch) {
    stopWatch()
  }
})

// === 事件处理 ===

function handleClick(bookmark: BookmarkNode) {
  logger.info('FavoriteSection', '🔗 点击收藏书签:', bookmark.title)
  emit('bookmark-click', bookmark)
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
}

.favorite-section__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  max-height: 300px;
  overflow: hidden auto;
}
</style>
