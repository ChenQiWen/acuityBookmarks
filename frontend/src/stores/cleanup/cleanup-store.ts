/**
 * 清理功能 Store
 *
 * 职责：
 * - 管理书签健康标签的筛选状态
 * - 维护健康扫描结果和统计
 * - 提供筛选、重置等操作给管理页面使用
 *
 * 不再包含“一键清理”执行流程。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import type {
  CleanupState,
  CleanupSettings,
  CleanupProblem
} from '@/types/domain/cleanup'
import type { BookmarkNode } from '@/types/domain/bookmark'

const HEALTH_TAGS = ['404', 'duplicate', 'empty', 'invalid'] as const
export type HealthTag = (typeof HEALTH_TAGS)[number]

function createLegendVisibility(): Record<'all' | HealthTag, boolean> {
  return HEALTH_TAGS.reduce(
    (acc, tag) => {
      acc[tag] = true
      return acc
    },
    { all: true } as Record<'all' | HealthTag, boolean>
  )
}

export const useCleanupStore = defineStore('cleanup', () => {
  const cleanupState = ref<CleanupState>({
    isFiltering: false,
    activeFilters: [],
    isScanning: false,
    tasks: [],
    filterResults: new Map(),
    legendVisibility: createLegendVisibility(),
    showSettings: false,
    settingsTab: 'general',
    settings: {
      '404': {
        timeout: 5000,
        skipHttps: false,
        followRedirects: true,
        userAgent: 'Mozilla/5.0 (compatible; AcuityBookmarks/1.0)',
        ignoreCors: false
      },
      duplicate: {
        compareUrl: true,
        compareTitle: true,
        titleSimilarity: 0.8,
        ignoreDomain: false,
        keepNewest: 'newest'
      },
      empty: {
        recursive: true,
        preserveStructure: false,
        minDepth: 1
      },
      invalid: {
        checkProtocol: true,
        checkDomain: true,
        allowLocalhost: true,
        customPatterns: ''
      }
    }
  })

  const isScanning = computed(() => cleanupState.value.isScanning)
  const activeFilters = computed(() => cleanupState.value.activeFilters)

  const totalIssuesFound = computed(() => {
    let total = 0
    cleanupState.value.filterResults.forEach(problems => {
      total += problems.length
    })
    return total
  })

  const hasActiveFilter = computed(
    () => cleanupState.value.activeFilters.length > 0
  )

  const problemNodeIds = computed(() =>
    Array.from(cleanupState.value.filterResults.keys())
  )

  function initializeCleanupState(): void {
    cleanupState.value.filterResults.clear()
    cleanupState.value.tasks = []
    cleanupState.value.isScanning = false
    cleanupState.value.activeFilters = []
    logger.info('CleanupStore', '已重置清理状态')
  }

  function replaceFilterResults(results: Map<string, CleanupProblem[]>): void {
    cleanupState.value.filterResults = results
  }

  function setActiveFilters(tags: HealthTag[]): void {
    cleanupState.value.activeFilters = [...tags]
    cleanupState.value.isFiltering = tags.length > 0
  }

  function toggleHealthTag(tag: HealthTag): void {
    const filters = new Set(cleanupState.value.activeFilters)
    if (filters.has(tag)) {
      filters.delete(tag)
    } else {
      filters.add(tag)
    }
    cleanupState.value.activeFilters = Array.from(filters)
    cleanupState.value.isFiltering = filters.size > 0
  }

  function clearFilters(): void {
    cleanupState.value.activeFilters = []
    cleanupState.value.isFiltering = false
  }

  function markScanning(state: boolean): void {
    cleanupState.value.isScanning = state
  }

  function ensureLegendDefaults(): void {
    cleanupState.value.legendVisibility = createLegendVisibility()
  }

  function findProblemNodesByTags(tags: HealthTag[]): string[] {
    const tagSet = new Set(tags)
    const ids: string[] = []
    cleanupState.value.filterResults.forEach((problems, nodeId) => {
      if (problems.some(problem => tagSet.has(problem.type as HealthTag))) {
        ids.push(String(nodeId))
      }
    })
    return ids
  }

  function attachNodeProblems(
    node: BookmarkNode,
    problems: CleanupProblem[]
  ): BookmarkNode {
    return {
      ...node,
      _cleanupProblems: problems
    }
  }

  function updateCleanupSettings(settings: Partial<CleanupSettings>): void {
    cleanupState.value.settings = {
      ...cleanupState.value.settings,
      ...settings
    }
  }

  function getCleanupStatistics() {
    return {
      totalIssues: totalIssuesFound.value,
      isScanning: cleanupState.value.isScanning,
      activeFilters: cleanupState.value.activeFilters
    }
  }

  return {
    cleanupState,
    isScanning,
    activeFilters,
    totalIssuesFound,
    hasActiveFilter,
    problemNodeIds,
    initializeCleanupState,
    replaceFilterResults,
    setActiveFilters,
    toggleHealthTag,
    clearFilters,
    markScanning,
    ensureLegendDefaults,
    findProblemNodesByTags,
    attachNodeProblems,
    updateCleanupSettings,
    getCleanupStatistics
  }
})
