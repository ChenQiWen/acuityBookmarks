<script setup lang="ts">
import { computed, defineOptions } from 'vue'

defineOptions({
  name: 'CleanupTagPicker'
})
import { useCleanupStore } from '@/stores'
import { Chip, Icon } from '@/components'

const cleanupStore = useCleanupStore()

const TAGS = [
  {
    key: '404',
    label: '失效书签',
    icon: 'icon-link-off',
    color: 'error',
    title: '无法访问的链接'
  },
  {
    key: 'duplicate',
    label: '重复',
    icon: 'icon-duplicate',
    color: 'warning',
    title: '重复书签'
  },
  {
    key: 'empty',
    label: '空文件夹',
    icon: 'icon-folder-off',
    color: 'primary',
    title: '没有内容的文件夹'
  },
  {
    key: 'invalid',
    label: '无效URL',
    icon: 'icon-open-link-off',
    color: 'secondary',
    title: 'URL格式问题'
  }
] as const

type TagKey = (typeof TAGS)[number]['key']

const activeKeys = computed<TagKey[]>(() => {
  const filters = cleanupStore.activeFilters
  // 确保返回的是数组，防止 includes 调用失败
  if (Array.isArray(filters)) {
    return filters as TagKey[]
  }
  return []
})

const isActive = (key: TagKey) => activeKeys.value.includes(key)

const onToggle = (key: TagKey) => {
  cleanupStore.toggleHealthTag(key)
}

const onClear = () => {
  cleanupStore.clearFilters()
}
</script>

<template>
  <div class="cleanup-tag-picker" role="group" aria-label="快捷筛选">
    <div class="tags">
      <Chip
        v-for="t in TAGS"
        :key="t.key"
        :color="isActive(t.key as TagKey) ? t.color : 'default'"
        :variant="isActive(t.key as TagKey) ? 'filled' : 'outlined'"
        clickable
        class="tag-chip"
        :aria-pressed="isActive(t.key as TagKey).toString()"
        :aria-label="t.title"
        tabindex="0"
        @click="onToggle(t.key as TagKey)"
        @keydown.enter.prevent="onToggle(t.key as TagKey)"
        @keydown.space.prevent="onToggle(t.key as TagKey)"
      >
        <Icon :name="t.icon" :size="14" />
        <span class="label">{{ t.label }}</span>
      </Chip>

      <Chip
        v-if="activeKeys.length > 0"
        key="clear"
        color="default"
        variant="outlined"
        clickable
        class="tag-chip tag-clear"
        aria-label="清除所有筛选"
        tabindex="0"
        @click="onClear"
        @keydown.enter.prevent="onClear"
        @keydown.space.prevent="onClear"
      >
        <Icon name="icon-close" :size="14" />
        <span class="label">清除筛选</span>
      </Chip>
    </div>
  </div>
</template>

<style scoped>
.cleanup-tag-picker {
  display: inline-flex;
  align-items: center;
  margin-left: var(--spacing-sm);
}
.tags {
  display: flex;
  gap: var(--spacing-sm);
}
.tag-chip {
  cursor: pointer;
  user-select: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background-color 120ms ease;
}
.tag-chip:hover {
  background-color: var(--color-surface-variant);
}
.tag-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.tag-clear {
  color: var(--color-text-secondary);
}
.label {
  margin-left: 6px;
  font-weight: 600;
  font-size: 12px;
}
</style>
