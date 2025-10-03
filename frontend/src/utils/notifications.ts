/*
 * Acuity Notifications Queue
 * 基于 chrome.notifications 的全局通知队列：
 * - 队列顺序显示；可并发上限控制
 * - 去重（同 key 合并）；相同内容短时间内抑制
 * - 自动超时关闭；可自定义 icon/title
 * - 提供 success/info/warning/error 快捷方法
 */

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationOptions {
  title?: string
  iconUrl?: string
  level?: NotificationLevel
  key?: string // 用于去重
  timeoutMs?: number // 显示时长，默认 2500ms
}

export interface QueuedNotification {
  id: string
  message: string
  options: Required<NotificationOptions>
}

const DEFAULT_ICON: Record<NotificationLevel, string> = {
  info: 'images/icon128.png',
  success: 'images/icon128.png',
  warning: 'images/icon128.png',
  error: 'images/icon128.png',
}

const DEFAULT_TITLE = 'AcuityBookmarks'
const DEFAULT_TIMEOUT = 2500
const CONCURRENCY = 1 // 同时最多显示几个通知（chrome 通常一次只显示一个 basic）
const SUPPRESS_WINDOW_MS = 1200 // 同内容抑制窗口

const queue: QueuedNotification[] = []
let active = 0
const recentMap = new Map<string, number>() // key -> ts，用于抑制相同消息

function now() { return Date.now() }

function makeId() {
  return Math.random().toString(36).slice(2)
}

function buildOptions(opts?: NotificationOptions): Required<NotificationOptions> {
  const level: NotificationLevel = opts?.level || 'info'
  return {
    title: opts?.title || DEFAULT_TITLE,
    iconUrl: opts?.iconUrl || DEFAULT_ICON[level],
    level,
    key: opts?.key || '',
    timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT,
  }
}

function createChromeNotification(n: QueuedNotification): Promise<string> {
  return new Promise((resolve) => {
    if (!chrome?.notifications) return resolve('')
    chrome.notifications.create({
      type: 'basic',
      title: n.options.title,
      message: n.message,
      iconUrl: n.options.iconUrl,
    }, (notificationId) => {
      resolve(notificationId || '')
    })
  })
}

function clearChromeNotification(notificationId: string) {
  if (!notificationId || !chrome?.notifications) return
  chrome.notifications.clear(notificationId)
}

async function runNext() {
  if (active >= CONCURRENCY) return
  const n = queue.shift()
  if (!n) return
  active++

  try {
    const id = await createChromeNotification(n)
    if (n.options.timeoutMs > 0) {
      setTimeout(() => {
        clearChromeNotification(id)
      }, n.options.timeoutMs)
    }
  } finally {
    active--
    if (queue.length > 0) {
      // 小延迟避免过快闪烁
      setTimeout(runNext, 100)
    }
  }
}

export function notify(message: string, opts?: NotificationOptions) {
  const options = buildOptions(opts)

  // 抑制同内容在短时间内重复
  const suppressKey = options.key || `${options.level}:${message}`
  const last = recentMap.get(suppressKey) || 0
  const ts = now()
  if (ts - last < SUPPRESS_WINDOW_MS) return
  recentMap.set(suppressKey, ts)

  const item: QueuedNotification = {
    id: makeId(),
    message,
    options,
  }
  queue.push(item)
  runNext()
}

export const notifySuccess = (msg: string, title?: string) => notify(msg, { level: 'success', title })
export const notifyInfo = (msg: string, title?: string) => notify(msg, { level: 'info', title })
export const notifyWarning = (msg: string, title?: string) => notify(msg, { level: 'warning', title })
export const notifyError = (msg: string, title?: string) => notify(msg, { level: 'error', title })
