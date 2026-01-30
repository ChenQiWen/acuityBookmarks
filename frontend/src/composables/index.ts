/**
 * 📦 Composables 导出文件
 */

export { useLazyFavicon } from './useLazyFavicon'
export type {
  UseLazyFaviconOptions,
  UseLazyFaviconReturn
} from './useLazyFavicon'

export { useSupabaseAuth } from './useSupabaseAuth'
export { useSupabaseMFA } from './useSupabaseMFA'
export { useSubscription } from './useSubscription'

// 特征数据 Composables
export {
  useTraitStatistics,
  useTraitCount,
  useTotalNegativeTraits,
  useHasNegativeTraits,
  useTraitLoading,
  useTraitLastUpdated,
  useRefreshTraits
} from './useTraitData'

