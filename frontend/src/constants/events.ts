// 统一事件常量，避免各处硬编码字符串
export const AB_EVENTS = {
  // UI 层书签更新事件（由现代书签服务派发，UI 监听）
  BOOKMARK_UPDATED: 'acuity-bookmark-updated',
  // 运行时消息：侧边栏开合状态变更（通过 chrome.runtime.sendMessage 广播）
  SIDE_PANEL_STATE_CHANGED: 'SIDE_PANEL_STATE_CHANGED'
} as const

export type AbEventKey = keyof typeof AB_EVENTS
export type AbEventName = (typeof AB_EVENTS)[AbEventKey]
