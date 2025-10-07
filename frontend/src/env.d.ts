/// <reference types="chrome" />
/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 最小声明以允许检测与调用 Chrome/内置AI
declare global {
  // 最小类型以支持 Prompt API 调用
  interface ChromeAI {
    availability?: () => Promise<string>
    monitor?: (callback: (state: string) => void) => { cancel: () => void }
    create?: (params: any) => Promise<any>
    generateText?: (args: any) => Promise<any>
    invoke?: (args: any) => Promise<any>
    complete?: (args: any) => Promise<any>
    run?: (args: any) => Promise<any>
    assistant?: {
      create?: (params: any) => Promise<any>
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
