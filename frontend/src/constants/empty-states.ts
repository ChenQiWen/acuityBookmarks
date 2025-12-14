/**
 * 📋 空状态设计规范 - 统一配置
 *
 * 用途：为不同场景提供一致的空状态视觉和文案
 *
 * 使用示例：
 * ```vue
 * <EmptyState v-bind="EMPTY_STATES.noResults" />
 * ```
 */

export interface EmptyStateConfig {
  /** 图标名称 */
  icon: string
  /** 主标题 */
  title: string
  /** 描述文字（可选） */
  description?: string
  /** 操作按钮文本（可选） */
  actionText?: string
  /** 图标尺寸（可选，默认 56） */
  iconSize?: number
}

/**
 * 🎨 标准化空状态配置集合
 */
export const EMPTY_STATES = {
  /** 筛选无结果 */
  noResults: {
    icon: 'icon-search-off',
    title: '未找到匹配的书签',
    description: '尝试使用不同的关键词或筛选条件',
    iconSize: 56
  },

  /** 暂无数据（书签为空） */
  noData: {
    icon: 'icon-bookmark-off',
    title: '暂无书签',
    description: '点击"添加"按钮创建第一个书签',
    actionText: '添加书签',
    iconSize: 64
  },

  /** 加载失败 */
  error: {
    icon: 'icon-alert-circle',
    title: '加载失败',
    description: '请检查网络连接或刷新页面重试',
    actionText: '重新加载',
    iconSize: 56
  },

  /** 文件夹为空 */
  emptyFolder: {
    icon: 'icon-folder-open',
    title: '文件夹为空',
    description: '拖拽书签到这里或点击添加按钮',
    iconSize: 48
  },

  /** 筛选结果为空（特征标签） */
  noTraitIssues: {
    icon: 'icon-check-circle',
    title: '一切正常',
    description: '没有找到符合条件的书签',
    iconSize: 56
  },

  /** 收藏夹为空 */
  noFavorites: {
    icon: 'icon-star-off',
    title: '暂无收藏',
    description: '点击书签旁的星标图标即可添加收藏',
    iconSize: 56
  },

  /** 历史记录为空 */
  noHistory: {
    icon: 'icon-history',
    title: '暂无历史记录',
    description: '您的浏览历史将显示在这里',
    iconSize: 56
  },

  /** 同步失败 */
  syncError: {
    icon: 'icon-sync-off',
    title: '同步失败',
    description: '请检查账号状态或稍后重试',
    actionText: '重新同步',
    iconSize: 56
  },

  /** 权限不足 */
  noPermission: {
    icon: 'icon-lock',
    title: '权限不足',
    description: '您没有访问此内容的权限',
    iconSize: 56
  },

  /** 功能开发中 */
  comingSoon: {
    icon: 'icon-clock',
    title: '敬请期待',
    description: '该功能正在开发中',
    iconSize: 56
  },

  /** 网络离线 */
  offline: {
    icon: 'icon-wifi-off',
    title: '网络连接已断开',
    description: '请检查您的网络设置',
    actionText: '重新连接',
    iconSize: 56
  }
} as const satisfies Record<string, EmptyStateConfig>

/**
 * 🎨 空状态主题色配置
 */
export const EMPTY_STATE_COLORS = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  muted: 'var(--color-text-tertiary)'
} as const

/**
 * 📐 空状态尺寸变体
 */
export const EMPTY_STATE_SIZES = {
  sm: { iconSize: 40, padding: 'var(--spacing-4)' },
  md: { iconSize: 56, padding: 'var(--spacing-6)' },
  lg: { iconSize: 72, padding: 'var(--spacing-8)' }
} as const
