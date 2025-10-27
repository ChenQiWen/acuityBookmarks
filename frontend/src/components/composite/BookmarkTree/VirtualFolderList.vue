<template>
  <div ref="containerRef" class="virtual-folder-list">
    <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="row in virtualRows"
        :key="row.id"
        class="virtual-item"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${row.size}px`,
          transform: `translateY(${row.start}px)`
        }"
      >
        <component
          :is="row.node ? TreeNode : TreeNodeSkeleton"
          v-bind="
            row.node
              ? {
                  node: row.node,
                  level: level + 1,
                  expandedFolders,
                  selectedNodes,
                  loadingChildren,
                  selectedDescCounts,
                  searchQuery,
                  highlightMatches,
                  config,
                  isVirtualMode: true,
                  strictOrder,
                  activeId,
                  hoveredId,
                  loadingMoreFolders
                }
              : { size }
          "
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { BookmarkNode } from '@/types'
import TreeNodeSkeleton from './TreeNodeSkeleton.vue'

const TreeNode = defineAsyncComponent(() => import('./TreeNode.vue'))

interface Props {
  chunk: {
    parentId: string
    items: BookmarkNode[]
  }
  level: number
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  loadingChildren: Set<string>
  selectedDescCounts: Map<string, number>
  searchQuery: string
  highlightMatches: boolean
  config: Record<string, unknown>
  strictOrder: boolean
  activeId?: string
  hoveredId?: string
  loadingMoreFolders: Set<string>
  size: 'compact' | 'comfortable' | 'spacious'
}

const props = defineProps<Props>()

const containerRef = ref<HTMLElement | null>(null)

const itemHeightMap: Record<'compact' | 'comfortable' | 'spacious', number> = {
  compact: 30,
  comfortable: 36,
  spacious: 44
}

const items = computed(() => props.chunk.items)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: items.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => itemHeightMap[props.size],
    overscan: 20
  }))
)

const totalHeight = computed(() => virtualizer.value.getTotalSize())

const virtualRows = computed(() => {
  const rows: Array<{
    id: string
    node?: BookmarkNode
    start: number
    size: number
  }> = []
  const virtualItems = virtualizer.value.getVirtualItems()
  for (const item of virtualItems) {
    const node = items.value[item.index]
    if (!node) continue
    rows.push({
      id: `${props.chunk.parentId}-${node.id}-chunk-${item.index}`,
      node,
      start: item.start,
      size: item.size
    })
  }
  return rows
})
</script>

<style scoped>
.virtual-folder-list {
  position: relative;
  max-height: calc(var(--item-height, 36px) * 400);
  overflow-y: auto;
}

.virtual-spacer {
  position: relative;
  width: 100%;
}
</style>
