/*
 * 页面 Toast 提示管理器（ToastBar Manager）
 *
 * 设计目标：
 * - 在页面内挂载一个 Vue ToastBar 组件，统一展示轻量提示；
 * - 提供 showToast 及四级便捷方法（info/success/warning/error）；
 * - 单例管理，按需创建与销毁，避免重复挂载与内存泄漏；
 * - 纯前端工具，不依赖扩展 API，适用于 MV3/开发环境；
 * - 不持久化状态，不改变业务逻辑，仅负责 UI 呈现。
 *
 * 边界与约束：
 * - 仅用于页面可见场景；系统通知请使用 utils/notifications.ts；
 * - 不支持 SSR；需在浏览器环境下运行并具备 DOM。
 */
import { createApp, h, type App } from 'vue'
import ToastBar from '@/components/ui/ToastBar.vue'

type Level = 'info' | 'success' | 'warning' | 'error'

interface ShowOpts {
  title?: string
  level?: Level
  timeoutMs?: number
}

interface ToastInstance {
  showToast?: (message: string, opts?: ShowOpts) => string
}

class ToastBarManager {
  private app: App | null = null
  private container: HTMLElement | null = null
  private exposed: ToastInstance | null = null

  ensureMounted() {
    if (this.exposed) return
    if (!this.container) {
      this.container = document.createElement('div')
      document.body.appendChild(this.container)
    }
    this.app = createApp({
      render: () =>
        h(ToastBar, {
          ref: 'toast',
          position: 'top-right',
          defaultTitle: 'AcuityBookmarks',
          offsetTop: 56,
          maxLifetimeMs: 6000
        })
    })
    const vm = this.app.mount(this.container)
    // 通过 $refs 获取暴露的方法
    this.exposed =
      (vm as { $refs?: { toast?: ToastInstance } })?.$refs?.toast || null
  }

  show(message: string, opts?: ShowOpts) {
    this.ensureMounted()
    if (!this.exposed?.showToast) return ''
    return this.exposed.showToast(message, opts)
  }

  dispose() {
    try {
      if (this.app && this.container) {
        this.app.unmount()
        document.body.removeChild(this.container)
      }
    } catch {}
    this.app = null
    this.container = null
    this.exposed = null
  }
}

const singleton = new ToastBarManager()

export function showToast(message: string, opts?: ShowOpts) {
  return singleton.show(message, opts)
}

export const showToastSuccess = (m: string, title?: string) =>
  showToast(m, { title, level: 'success' })
export const showToastInfo = (m: string, title?: string) =>
  showToast(m, { title, level: 'info' })
export const showToastWarning = (m: string, title?: string) =>
  showToast(m, { title, level: 'warning' })
export const showToastError = (m: string, title?: string) =>
  showToast(m, { title, level: 'error' })

try {
  const g = window as unknown as Record<string, unknown>
  g.AB_showToast = showToast
  g.AB_showToastSuccess = showToastSuccess
  g.AB_showToastInfo = showToastInfo
  g.AB_showToastWarning = showToastWarning
  g.AB_showToastError = showToastError
} catch {}
