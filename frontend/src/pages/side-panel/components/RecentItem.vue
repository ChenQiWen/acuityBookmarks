<template>
  <div
    ref="itemRef"
    class="recent-item no-select"
    :title="`${bookmark.title}\n${bookmark.url}`"
    @click="$emit('click')"
  >
    <!-- Favicon -->
    <div class="recent-favicon">
      <img
        v-if="safeFaviconUrl"
        :src="safeFaviconUrl"
        alt="favicon"
        loading="lazy"
        @error="handleFaviconError"
      />
      <Icon v-else name="icon-bookmark" :size="16" />
    </div>

    <!-- 信息 -->
    <div class="recent-info">
      <div class="recent-title">{{ bookmark.title }}</div>
      <div class="recent-time">{{ formatTime(bookmark.lastVisited) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, computed } from 'vue'
import { Icon } from '@/components'
import { useLazyFavicon } from '@/composables/useLazyFavicon'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

defineOptions({
  name: 'RecentItem'
})

interface Props {
  bookmark: BookmarkRecord
}

const props = defineProps<Props>()

defineEmits<{
  click: []
}>()

const itemRef = ref<HTMLElement | null>(null)

// 允许的 favicon 协议
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:'])

// 安全过滤 favicon URL
function sanitizeFaviconUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined
  try {
    const parsed = new URL(rawUrl, window.location.origin)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return undefined
    return rawUrl
  } catch {
    return undefined
  }
}

// ✅ 使用 faviconService 的缓存（IndexedDB + 内存缓存）
const { faviconUrl, handleError: handleFaviconErrorNew } = useLazyFavicon({
  url: toRef(() => props.bookmark.url),
  rootEl: itemRef,
  enabled: false // 立即加载
})

const safeFaviconUrl = computed(() => sanitizeFaviconUrl(faviconUrl.value))

const handleFaviconError = () => {
  handleFaviconErrorNew()
}

/**
 * 格式化时间
 */
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
</script>

<style scoped>
.recent-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.recent-item:hover {
  background: var(--color-surface-hover);
}

.recent-item:active {
  background: var(--color-surface-active);
}

.recent-favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
}

.recent-favicon img {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
}

.recent-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-0-5);
  min-width: 0;
}

.recent-title {
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}
</style>
