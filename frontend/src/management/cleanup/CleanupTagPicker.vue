<script setup lang="ts">
import { computed } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'
import { Chip, Icon } from '../../components/ui'

// 使用 store
const managementStore = useManagementStore()
const { cleanupState } = storeToRefs(managementStore)

// 可选的筛选标签
const TAGS = [
  {
    key: '404',
    label: '404',
    icon: 'mdi-link-off',
    color: 'error',
    title: '无法访问的链接'
  },
  {
    key: 'duplicate',
    label: '重复',
    icon: 'mdi-content-duplicate',
    color: 'warning',
    title: '重复书签'
  },
  {
    key: 'empty',
    label: '空文件夹',
    icon: 'mdi-folder-outline',
    color: 'primary',
    title: '没有内容的文件夹'
  },
  {
    key: 'invalid',
    label: '无效URL',
    icon: 'mdi-alert-circle',
    color: 'secondary',
    title: 'URL格式问题'
  }
] as const

type TagKey = (typeof TAGS)[number]['key']

// 多选模型：再次点击同一 tag 取消选择；空集合表示关闭筛选
const activeKeys = computed<TagKey[]>({
  get: () => (cleanupState.value?.activeFilters || []) as TagKey[],
  set: arr => {
    // 直接按强类型传递
    void managementStore.setCleanupActiveFilters(arr)
  }
})

const isActive = (key: TagKey) => activeKeys.value.includes(key)

const onToggle = (key: TagKey) => {
  console.log(
    '%c [ key ]-30',
    'font-size:13px; background:pink; color:#bf2c9f;',
    key
  )
  const set = new Set<TagKey>(activeKeys.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  activeKeys.value = Array.from(set)
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
    </div>
  </div>
</template>

<style scoped>
.cleanup-tag-picker {
  display: inline-flex;
  align-items: center;
  margin-left: var(--spacing-sm); /* 与搜索框保持呼吸间距 */
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
  border-radius: 999px; /* 药丸态，更像快捷键 */
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background-color 120ms ease;
}
.tag-chip:hover {
  /* 遵循不产生位移的准则：仅改背景/阴影，不改几何位置 */
  background-color: var(--color-surface-variant);
}
.tag-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.label {
  margin-left: 6px;
  font-weight: 600;
  font-size: 12px;
}
</style>
