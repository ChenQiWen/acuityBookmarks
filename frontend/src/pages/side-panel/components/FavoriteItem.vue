<template>
  <div
    ref="itemRef"
    class="favorite-item"
    :title="`${bookmark.title}\n${bookmark.url}`"
    @click="$emit('click')"
  >
    <!-- 图标 -->
    <div class="favorite-item__icon">
      <img
        v-if="safeFaviconUrl"
        :src="safeFaviconUrl"
        alt="favicon"
        loading="lazy"
        @error="handleFaviconError"
      />
      <Icon v-else name="icon-bookmark" :size="16" color="secondary" />
    </div>

    <!-- 标题 -->
    <span class="favorite-item__title">{{ bookmark.title }}</span>

    <!-- 取消收藏按钮 -->
    <button
      class="favorite-item__remove"
      title="取消收藏"
      @click.stop="$emit('remove')"
    >
      <Icon name="icon-favorite-outline" :size="16" color="warning" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, computed } from 'vue'
import { Icon } from '@/components'
import { useLazyFavicon } from '@/composables/useLazyFavicon'
import type { BookmarkNode } from '@/types'

defineOptions({
  name: 'FavoriteItem'
})

interface Props {
  bookmark: BookmarkNode
  index: number
}

const props = defineProps<Props>()

defineEmits<{
  click: []
  remove: []
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

// 使用懒加载 Favicon 服务
const { faviconUrl, handleError: handleFaviconErrorNew } = useLazyFavicon({
  url: toRef(() => props.bookmark.url),
  rootEl: itemRef,
  enabled: false // 立即加载
})

const safeFaviconUrl = computed(() => sanitizeFaviconUrl(faviconUrl.value))

function handleFaviconError(event: Event) {
  handleFaviconErrorNew()
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<style scoped lang="scss">
/* stylelint-disable declaration-property-value-disallowed-list -- 图标使用固定尺寸 */

.favorite-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1-5) var(--spacing-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--color-surface-hover);
  }

  &:active {
    background-color: var(--color-surface-active);
  }
}

.favorite-item__icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;

  img {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-xs);
    object-fit: contain;
  }
}

.favorite-item__title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  line-height: 1.4;
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-item__remove {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  opacity: 1;
  cursor: pointer;
  transition: opacity var(--transition-fast);

  .favorite-item:hover & {
    opacity: 1;
  }
}
</style>
