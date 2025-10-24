export type FontSource = 'google' | 'local' | 'system'

export interface FontDescriptor {
  family: string
  source: FontSource
  weights: number[]
  subsets?: string[]
  fallback?: string
}

export interface FontLoadTask {
  id: string
  descriptor: FontDescriptor
  status: 'pending' | 'loading' | 'loaded' | 'failed'
  startedAt: number
  finishedAt?: number
  error?: string
}

export interface FontServiceConfig {
  enableAutoDetection: boolean
  enableDynamicApplication: boolean
  debugMode: boolean
  systemUISelectors: string[]
  userContentSelectors: string[]
}

export type DetectedLanguage =
  | 'zh'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'en'
  | 'mixed'
  | 'unknown'

export interface FontStrategy {
  detected: DetectedLanguage
  systemUI: string
  userContent: string
}
