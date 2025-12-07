<template>
  <div
    ref="itemRef"
    class="favorite-item"
    :title="`${favorite.title}\n${favorite.url}`"
    @click="$emit('click')"
  >
    <!-- 图标 -->
    <div class="favorite-icon">
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
    <span class="favorite-title">{{ favorite.title }}</span>

    <!-- 序号（可选） -->
    <span v-if="showNumber" class="favorite-number">{{ index + 1 }}</span>

    <!-- 取消收藏按钮 - 已收藏状态显示实心心形 -->
    <button
      class="remove-btn"
      title="取消收藏"
      @click.stop="$emit('remove')"
    >
      <Icon name="icon-favorite-outline" :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, computed } from 'vue'
import { Icon } from '@/components'
import type { FavoriteBookmark } from '@/application/bookmark/favorite-app-service'
import { useLazyFavicon } from '@/composables/useLazyFavicon'

defineOptions({
  name: 'FavoriteItem'
})

interface Props {
  favorite: FavoriteBookmark
  index: number
  showNumber?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showNumber: false
})

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
  url: toRef(() => props.favorite.url),
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

.remove-btn {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-error-light);
  background: transparent;
  opacity: 0;
  cursor: pointer;
  transition:
    opacity var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    color: var(--color-error);
  }
}

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

    .remove-btn {
      opacity: 1;
    }
  }

  &:active {
    background-color: var(--color-surface-active);
  }
}

.favorite-icon {
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

.favorite-title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  line-height: 1.4;
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-number {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-tertiary);
  background-color: var(--color-surface-variant);
}
</style>
