<template>
  <div class="recent-visits">
    <div v-if="recentVisits.length === 0" class="empty-state">
      <Icon name="icon-clock" :size="20" />
      <span>暂无访问记录</span>
    </div>
    <div v-else class="recent-list">
      <div
        v-for="bookmark in recentVisits"
        :key="bookmark.id"
        class="recent-item"
        @click="handleClick(bookmark)"
      >
        <img
          v-if="bookmark.url"
          :src="`chrome://favicon/${bookmark.url}`"
          class="recent-favicon"
          alt=""
        />
        <Icon v-else name="icon-bookmark" :size="16" class="recent-icon" />
        <div class="recent-info">
          <div class="recent-title">{{ bookmark.title }}</div>
          <div class="recent-time">{{ formatTime(bookmark.lastVisited) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Icon } from '@/components'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({
  name: 'RecentVisits'
})

const emit = defineEmits<{
  'bookmark-click': [bookmark: BookmarkRecord]
  'count-update': [count: number]
}>()

const recentVisits = ref<BookmarkRecord[]>([])

const loadRecentVisits = async () => {
  try {
    recentVisits.value = await indexedDBManager.getRecentVisits(10)
    emit('count-update', recentVisits.value.length)
    logger.info('RecentVisits', '📊 加载最近访问', recentVisits.value.length)
  } catch (error) {
    logger.error('RecentVisits', '❌ 加载最近访问失败', error)
  }
}

onMounted(loadRecentVisits)

// 监听数据变化，自动更新数量
watch(() => recentVisits.value.length, (newCount) => {
  emit('count-update', newCount)
})

const handleClick = (bookmark: BookmarkRecord) => {
  logger.info('RecentVisits', '🔗 点击最近访问', bookmark.title)
  emit('bookmark-click', bookmark)
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''

  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`

  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 暴露方法供父组件调用
defineExpose({
  loadRecentVisits
})
</script>

<style scoped>
.recent-visits {
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-6) var(--spacing-4);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.recent-item:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.recent-favicon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.recent-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.recent-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-1);
  min-width: 0;
}

.recent-title {
  font-size: var(--text-sm);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-time {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
</style>
