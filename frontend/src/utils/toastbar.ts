import { createApp, h } from 'vue'
import ToastBar from '@/components/ui/ToastBar.vue'

type Level = 'info' | 'success' | 'warning' | 'error'

interface ShowOpts { title?: string; level?: Level; timeoutMs?: number }

class ToastBarManager {
  private app: any | null = null
  private container: HTMLElement | null = null
  private exposed: any | null = null

  ensureMounted() {
    if (this.exposed) return
    if (!this.container) {
      this.container = document.createElement('div')
      document.body.appendChild(this.container)
    }
    this.app = createApp({
      render: () => h(ToastBar, { 
        ref: 'toast', 
        position: 'top-right', 
        defaultTitle: 'AcuityBookmarks',
        offsetTop: 56,
        maxLifetimeMs: 6000,
      })
    })
    const vm = this.app.mount(this.container)
    // 通过 $refs 获取暴露的方法
    // @ts-ignore
    this.exposed = vm?.$refs?.toast || null
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

export const showToastSuccess = (m: string, title?: string) => showToast(m, { title, level: 'success' })
export const showToastInfo = (m: string, title?: string) => showToast(m, { title, level: 'info' })
export const showToastWarning = (m: string, title?: string) => showToast(m, { title, level: 'warning' })
export const showToastError = (m: string, title?: string) => showToast(m, { title, level: 'error' })

try {
  const g = window as any
  g.AB_showToast = showToast
  g.AB_showToastSuccess = showToastSuccess
  g.AB_showToastInfo = showToastInfo
  g.AB_showToastWarning = showToastWarning
  g.AB_showToastError = showToastError
} catch {}
