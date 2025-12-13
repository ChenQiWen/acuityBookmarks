<template>
  <div class="recent-visits">
    <div v-if="recentVisits.length === 0" class="empty-state">
      <Icon name="icon-clock" :size="20" />
      <span>暂无访问记录</span>
    </div>
    <div v-else class="recent-list">
      <RecentItem
        v-for="bookmark in recentVisits"
        :key="bookmark.id"
        :bookmark="bookmark"
        @click="handleClick(bookmark)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@/components'
import RecentItem from './RecentItem.vue'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'

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

// 监听书签访问事件，自动刷新列表
const unsubscribe = onEvent('bookmark:visited', () => {
  logger.debug('RecentVisits', '🔄 收到书签访问事件，刷新列表')
  loadRecentVisits()
})

onUnmounted(() => {
  unsubscribe()
})

// 监听数据变化，自动更新数量
watch(() => recentVisits.value.length, (newCount) => {
  emit('count-update', newCount)
})

const handleClick = (bookmark: BookmarkRecord) => {
  logger.info('RecentVisits', '🔗 点击最近访问', bookmark.title)
  emit('bookmark-click', bookmark)
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
</style>
