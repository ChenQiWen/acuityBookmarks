/*
 * Acuity Notifications Queue
 * 基于 chrome.notifications 的全局通知队列：
 * - 队列顺序显示；可并发上限控制
 * - 去重（同 key 合并）；相同内容短时间内抑制
 * - 自动超时关闭；可自定义 icon/title
 * - 提供 success/info/warning/error 快捷方法
 */
import { showToast } from '@/utils/toastbar'

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

// 统一使用打包会存在的图标资源；确保路径通过 chrome.runtime.getURL 解析
function resolveDefaultIcon(): string {
  try {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
      // public/logo.png 会被复制到 dist 根目录
      return chrome.runtime.getURL('logo.png')
    }
  } catch {}
  // 在非扩展环境（开发/单元测试）回退到相对路径
  return '/logo.png'
}

const DEFAULT_ICON: Record<NotificationLevel, string> = {
  info: resolveDefaultIcon(),
  success: resolveDefaultIcon(),
  warning: resolveDefaultIcon(),
  error: resolveDefaultIcon(),
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
    // 始终转换为扩展内的绝对URL，避免相对路径解析差异
    iconUrl: (() => {
      const raw = opts?.iconUrl || DEFAULT_ICON[level]
      try {
        if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
          // 若传入的是相对路径，统一通过 getURL 解析；若已是绝对 URL 则直接返回
          if (/^https?:\/\//.test(raw) || raw.startsWith('chrome-extension://')) return raw
          const cleaned = raw.replace(/^\//, '')
          return chrome.runtime.getURL(cleaned)
        }
      } catch {}
      return raw
    })(),
    level,
    key: opts?.key || '',
    timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT,
  }
}

function createChromeNotification(n: QueuedNotification): Promise<string> {
  console.debug('[notifications] create', n)
  return new Promise((resolve) => {
    try {
      if (chrome?.notifications && typeof chrome.notifications.create === 'function') {
        chrome.notifications.create({
          type: 'basic',
          title: n.options.title,
          message: n.message,
          iconUrl: n.options.iconUrl,
        }, (notificationId) => {
          resolve(notificationId || '')
        })
        return
      }
      // Fallback: 委托 Service Worker 创建（MV3更稳妥）
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'ACUITY_NOTIFY',
          data: {
            title: n.options.title,
            message: n.message,
            iconUrl: n.options.iconUrl,
            timeoutMs: n.options.timeoutMs,
          }
        }, (resp) => {
          const id = (resp && typeof resp.notificationId === 'string') ? resp.notificationId : ''
          resolve(id)
        })
        return
      }
    } catch {}
    resolve('')
  })
}

function clearChromeNotification(notificationId: string) {
  if (!notificationId) return
  try {
    if (chrome?.notifications && typeof chrome.notifications.clear === 'function') {
      chrome.notifications.clear(notificationId)
      return
    }
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'ACUITY_NOTIFY_CLEAR', data: { notificationId } })
      return
    }
  } catch {}
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

// 系统通知采用“自动镜像”策略：仅在页面不可见时发送

export function notify(message: string, opts?: NotificationOptions) {
  const options = buildOptions(opts)
  console.debug('[notifications] enqueue', { message, options })

  // 抑制同内容在短时间内重复
  const suppressKey = options.key || `${options.level}:${message}`
  const last = recentMap.get(suppressKey) || 0
  const ts = now()
  if (ts - last < SUPPRESS_WINDOW_MS) {
    console.debug('[notifications] suppressed', { suppressKey })
    return
  }
  recentMap.set(suppressKey, ts)

  const item: QueuedNotification = {
    id: makeId(),
    message,
    options,
  }
  // 1) 始终显示页面 Toast（主通道）
  fallbackToast(item)

  // 2) 自动镜像系统通知（副通道）：仅当页面不可见时
  const shouldMirror = (typeof document !== 'undefined') ? document.hidden : true

  if (shouldMirror) {
    ;(async () => {
      try {
        const level = await getPermissionLevel()
        if (level === 'denied') {
          if (!(window as any).__AB_notif_hint_shown__) {
            ;(window as any).__AB_notif_hint_shown__ = true
            console.info('[Acuity] 系统通知权限不可用，已仅使用页面 Toast。你可以在系统设置中开启 Chrome 的通知。')
          }
          return
        }
      } catch {}
      queue.push(item)
      runNext()
    })()
  }
}

export const notifySuccess = (msg: string, title?: string) => notify(msg, { level: 'success', title })
export const notifyInfo = (msg: string, title?: string) => notify(msg, { level: 'info', title })
export const notifyWarning = (msg: string, title?: string) => notify(msg, { level: 'warning', title })
export const notifyError = (msg: string, title?: string) => notify(msg, { level: 'error', title })

// 便于控制台直接调试
try {
  const g = window as any
  g.AB_notify = notify
  g.AB_notifySuccess = notifySuccess
  g.AB_notifyInfo = notifyInfo
  g.AB_notifyWarning = notifyWarning
  g.AB_notifyError = notifyError
} catch {}

// 全局诊断：检测可用性与快速出通知
let __permCache: string | null = null
async function getPermissionLevel(): Promise<string> {
  if (__permCache) return __permCache
  try {
    const anyN = (chrome as any)?.notifications
    if (anyN && typeof anyN.getPermissionLevel === 'function') {
      __permCache = await new Promise<string>(resolve => {
        anyN.getPermissionLevel((level: string) => resolve(level || 'unknown'))
      })
      return __permCache
    }
  } catch {}
  return 'unknown'
}

function fallbackToast(n: QueuedNotification) {
  try {
    const level = n.options.level
    const opts = { title: n.options.title, level, timeoutMs: n.options.timeoutMs }
    showToast(n.message, opts)
  } catch {
    console.info(`[Acuity] ${n.options.title || ''} ${n.message}`)
  }
}

// Toast 已为主通道，不再需要强制开关

// 注意：toastbar 已做懒挂载，静态导入不会导致过早渲染

async function checkNotificationsDiagnostics() {
  const out: any = {}
  try {
    out.hasChrome = typeof chrome !== 'undefined'
    out.hasNotifications = !!(chrome as any)?.notifications
    out.manifestHasPermission = false
    try {
      const mf = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() as any : null
      if (mf && Array.isArray(mf.permissions)) out.manifestHasPermission = mf.permissions.includes('notifications')
    } catch {}
    out.permissionsContains = 'unknown'
    try {
      if (chrome?.permissions?.contains) {
        await new Promise<void>(resolve => {
          chrome.permissions.contains({ permissions: ['notifications'] }, (granted) => {
            out.permissionsContains = !!granted
            resolve()
          })
        })
      }
    } catch {}
    out.permissionLevel = 'unknown'
    try {
      const anyN = (chrome as any)?.notifications
      if (anyN && typeof anyN.getPermissionLevel === 'function') {
        await new Promise<void>(resolve => {
          anyN.getPermissionLevel((level: string) => { out.permissionLevel = level; resolve() })
        })
      }
    } catch {}
    out.swReachable = false
    try {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'ACUITY_NOTIFY_PING' }, (resp) => {
          out.swReachable = !!(resp && resp.ok)
          resolve()
        })
      })
    } catch {}

  // 直接在页面尝试创建一个通知（带 requireInteraction，便于观察）
    out.testDirectId = ''
    try {
      if (chrome?.notifications?.create) {
        const icon = (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) ? chrome.runtime.getURL('logo.png') : '/logo.png'
        await new Promise<void>(resolve => {
          chrome.notifications.create({
            type: 'basic',
            title: 'Acuity Diagnostics (Direct)',
            message: '如果你能看到这条，页面直连通知可用',
            iconUrl: icon,
            requireInteraction: true
          } as any, (id) => {
            out.testDirectId = id || ''
            resolve()
          })
        })
      }
    } catch {}

    // 通过 SW 尝试一次
    out.testSwId = ''
    try {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({
          type: 'ACUITY_NOTIFY',
          data: {
            title: 'Acuity Diagnostics (SW)',
            message: '如果你能看到这条，Service Worker 通知可用',
            iconUrl: (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) ? chrome.runtime.getURL('logo.png') : '/logo.png',
            timeoutMs: 4000
          }
        }, (resp) => {
          out.testSwId = (resp && resp.notificationId) || ''
          resolve()
        })
      })
    } catch {}

    console.info('[AB_checkNotifications] diagnostics:', out)
  } catch (e) {
    console.warn('[AB_checkNotifications] failed:', e)
  }
  return out
}

try {
  const g = window as any
  g.AB_checkNotifications = checkNotificationsDiagnostics
} catch {}
