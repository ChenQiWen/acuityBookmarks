/// <reference types="chrome" />
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >
  export default component
}

// 最小声明以允许检测与调用 Chrome/内置AI
declare global {
  // 最小类型以支持 Prompt API 调用
  interface ChromeAI {
    availability?: () => Promise<string>
    monitor?: (callback: (state: string) => void) => { cancel: () => void }
    create?: (params: Record<string, unknown>) => Promise<unknown>
    generateText?: (args: Record<string, unknown>) => Promise<unknown>
    invoke?: (args: Record<string, unknown>) => Promise<unknown>
    complete?: (args: Record<string, unknown>) => Promise<unknown>
    run?: (args: Record<string, unknown>) => Promise<unknown>
    assistant?: {
      create?: (params: Record<string, unknown>) => Promise<unknown>
    }
  }

  interface Window {
    ai?: ChromeAI
  }
  // 某些环境可能暴露 chrome.ai
  interface Chrome {
    ai?: ChromeAI
  }
}

export {}
