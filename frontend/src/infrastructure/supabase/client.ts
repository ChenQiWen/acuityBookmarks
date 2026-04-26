/**
 * Supabase 客户端初始化
 *
 * 职责：
 * - 创建和管理 Supabase 客户端实例
 * - 配置认证选项
 * - 处理 Chrome Extension 环境的特殊配置
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Supabase 配置
 *
 * 环境变量：
 * - VITE_SUPABASE_URL: Supabase 项目 URL
 * - VITE_SUPABASE_ANON_KEY: Supabase 匿名密钥（公开的，可在前端使用）
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查配置是否完整
const isConfigured = !!(supabaseUrl && supabaseAnonKey)

// 仅在开发环境且明确未配置时警告（避免生产环境误报）
if (import.meta.env.DEV && !isConfigured) {
  logger.warn(
    'Supabase',
    'Config',
    '环境变量未设置，请在 .env.local 或 .env.development 文件中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  )
  logger.warn('Supabase', 'Config', '认证功能将不可用，但应用仍可正常使用其他功能')
}

/**
 * 创建 Supabase 客户端
 *
 * Chrome Extension 环境配置：
 * - storage: 使用 chrome.storage.local 持久化 session
 * - autoRefreshToken: 自动刷新 token
 * - persistSession: 持久化 session（Chrome Extension 需要）
 *
 * 注意：如果环境变量未配置，使用占位符 URL 避免崩溃
 * 实际使用时应该通过 isSupabaseConfigured() 检查配置状态
 */

// 用于去重日志的缓存（避免重复打印相同的日志）
const loggedKeys = new Set<string>()

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // Chrome Extension 需要使用自定义存储
      storage:
        typeof chrome !== 'undefined' && chrome.storage?.local
          ? {
              getItem: (key: string) => {
                return new Promise<string | null>(resolve => {
                  chrome.storage.local.get([key], result => {
                    const value = result?.[key]
                    // 只在开发模式、首次找到 token 时打印日志（避免重复噪音）
                    if (
                      import.meta.env.DEV &&
                      typeof value === 'string' &&
                      !loggedKeys.has(`found:${key}`)
                    ) {
                      logger.debug('Supabase', 'Storage', 'Token found', { key })
                      loggedKeys.add(`found:${key}`)
                    }
                    resolve(typeof value === 'string' ? value : null)
                  })
                })
              },
              setItem: (key: string, value: string) => {
                return new Promise<void>(resolve => {
                  chrome.storage.local.set({ [key]: value }, () => {
                    if (import.meta.env.DEV && !loggedKeys.has(`saved:${key}`)) {
                      logger.debug('Supabase', 'Storage', 'Token saved', { key })
                      loggedKeys.add(`saved:${key}`)
                    }
                    resolve()
                  })
                })
              },
              removeItem: (key: string) => {
                return new Promise<void>(resolve => {
                  chrome.storage.local.remove([key], () => {
                    if (import.meta.env.DEV) {
                      logger.debug('Supabase', 'Storage', 'Token removed', { key })
                      // 清除缓存，以便下次保存时可以再次打印
                      loggedKeys.delete(`found:${key}`)
                      loggedKeys.delete(`saved:${key}`)
                    }
                    resolve()
                  })
                })
              }
            }
          : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false // Chrome Extension 不需要检测 URL 中的 session
    }
  }
)

/**
 * 验证 Supabase 配置是否完整
 */
export function isSupabaseConfigured(): boolean {
  return isConfigured
}
