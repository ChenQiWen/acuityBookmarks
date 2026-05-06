/**
 * Vite 插件配置
 */

import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import { execSync } from 'child_process'
import { HTTPS_ENV_VARS, ROOT_DIR } from './constants'

/**
 * 强制将 HTTP URL 转换为 HTTPS
 */
export function forceHttpsEnvVars(env: Record<string, string>) {
  HTTPS_ENV_VARS.forEach(key => {
    const value = env[key] || process.env[key]
    if (value?.startsWith('http://')) {
      const httpsValue = value.replace('http://', 'https://')
      // 更新 process.env（Vite 会从这里读取）
      process.env[key] = httpsValue
      // 更新 env 对象
      env[key] = httpsValue
      console.warn(
        `⚠️  构建时转换: ${key} 从 HTTP 转换为 HTTPS: ${value} → ${httpsValue}`
      )
    }
  })
}

/**
 * Vue 插件配置
 */
export function createVuePlugin() {
  return vue({
    template: {
      compilerOptions: {
        // 忽略自定义元素警告
        isCustomElement: _tag => false
      }
    }
  })
}

/**
 * 清理 dist 目录插件
 */
export function createCleanDistPlugin(): Plugin {
  return {
    name: 'clean-dist-plugin',
    closeBundle() {
      console.log('🧹 构建完成，运行清理脚本...')
      try {
        execSync('bun scripts/clean-dist.cjs', {
          stdio: 'inherit',
          cwd: ROOT_DIR
        })
        // ✅ 构建后验证 background.js 不包含 DOM API
        execSync('node scripts/validate-background.cjs', {
          stdio: 'inherit',
          cwd: ROOT_DIR
        })
      } catch (error) {
        console.error('❌ 清理脚本执行失败:', error)
      }
    }
  }
}

/**
 * 强制 HTTPS 环境变量插件
 */
export function createForceHttpsPlugin(): Plugin {
  return {
    name: 'force-https-env-vars',
    configResolved(config: { env: Record<string, string> }) {
      // 在配置解析后，再次检查并转换环境变量
      HTTPS_ENV_VARS.forEach(key => {
        const value = process.env[key]
        if (value?.startsWith('http://')) {
          const httpsValue = value.replace('http://', 'https://')
          process.env[key] = httpsValue
          // 同时更新 config.env 中的值
          if (config.env[key]) {
            config.env[key] = httpsValue
          }
          console.warn(
            `⚠️  插件转换: ${key} 从 HTTP 转换为 HTTPS: ${value} → ${httpsValue}`
          )
        }
      })
    }
  }
}

/**
 * 创建所有插件
 */
export function createPlugins() {
  return [
    createVuePlugin(),
    // 🔒 启用 HTTPS 开发服务器
    basicSsl(),
    // 🧹 构建完成后自动清理和整理 dist 目录
    createCleanDistPlugin(),
    // 🔒 强制 HTTPS 环境变量
    createForceHttpsPlugin()
  ]
}
