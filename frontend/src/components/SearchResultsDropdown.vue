<template>
  <div v-if="visible && items.length > 0" class="search-dropdown">
    <div class="search-dropdown-content">
      <div class="search-results-list">
        <div
          v-for="({ item: result, index, key }) in displayItemsWithKey"
          :key="key"
          class="search-result-item"
          @click="$emit('select', result, index)"
        >
          <slot name="item" :result="result" :index="index">
            <div class="search-result-content">
              <div class="search-result-icon">
                <img v-if="result.url" :src="favicon(result.url)" alt="" @error="onIconError" />
              </div>
              <div class="search-result-info">
                <div class="search-result-title">{{ result.title || '未命名' }}</div>
                <div v-if="showPath && result.path?.length" class="search-result-path">
                  {{ result.path.join(' > ') }}
                </div>
                <div v-if="showUrl && result.url" class="search-result-url">{{ result.url }}</div>
              </div>
            </div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SearchItem { id?: string; title?: string; url?: string; path?: string[] }

const props = withDefaults(defineProps<{ 
  items: SearchItem[]
  visible: boolean
  maxItems?: number
  showPath?: boolean
  showUrl?: boolean
}>(), {
  items: () => [],
  visible: false,
  maxItems: 10,
  showPath: true,
  showUrl: false
})

defineEmits<{ 'select': [SearchItem, number] }>()

const displayItems = computed(() => props.items.slice(0, props.maxItems))

// 生成稳定 key：优先使用 id，其次 url；都没有则基于内容生成短哈希
function stableKeyOf(item: SearchItem): string {
  if (item.id && item.id.trim().length > 0) return item.id
  if (item.url && item.url.trim().length > 0) return `url:${item.url}`
  // 退化：基于标题/路径生成短哈希，避免使用数组 index
  const payload = `${item.title || ''}|${(item.path || []).join('/')}`
  // djb2 简化哈希
  let h = 5381
  for (let i = 0; i < payload.length; i++) h = ((h << 5) + h) + payload.charCodeAt(i)
  return `h:${(h >>> 0).toString(36)}`
}

const displayItemsWithKey = computed(() => {
  const list = displayItems.value.map((item, index) => ({ item, index, key: stableKeyOf(item) }))
  // 运行时校验：提示缺少 id 的项，建议上游提供稳定 id
  const isProd = (import.meta as any).env?.PROD === true || (import.meta as any).env?.MODE === 'production'
  if (!isProd) {
    for (const { item } of list) {
      if (!item.id && !item.url) {
        console.warn('[SearchResultsDropdown] item missing stable id/url; a hash key is used as fallback', item)
        break
      }
    }
  }
  return list
})

function favicon(url: string) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=20` } catch { return '' }
}
function onIconError(e: Event) { const img = e.target as HTMLImageElement; if (img) img.style.display = 'none' }
</script>

<style scoped>
.search-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; margin-top: var(--spacing-xs); background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); max-height: 400px; overflow: hidden; }
.search-dropdown-content { overflow-y: auto; max-height: 400px; }
.search-results-list { padding: var(--spacing-xs) 0; }
.search-result-item { padding: var(--spacing-sm) var(--spacing-md); cursor: pointer; transition: background-color var(--transition-fast); border-bottom: 1px solid var(--color-divider-alpha-50); }
.search-result-item:last-child { border-bottom: none; }
.search-result-item:hover { background: var(--color-surface-variant); }
.search-result-content { display: flex; align-items: center; gap: var(--spacing-sm); }
.search-result-icon { flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.search-result-icon img { width: 16px; height: 16px; border-radius: var(--radius-xs); }
.search-result-info { flex: 1; min-width: 0; }
.search-result-title { font-weight: var(--font-medium); color: var(--color-text-primary); margin-bottom: var(--spacing-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-result-path { font-size: var(--text-xs); color: var(--color-text-tertiary); margin-bottom: var(--spacing-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-result-url { font-size: var(--text-xs); color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
