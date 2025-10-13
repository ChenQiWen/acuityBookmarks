/**
 * 🖼️ 懒加载Favicon Composable
 *
 * 功能：
 * 1. 使用Intersection Observer实现可视区域加载
 * 2. 集成FaviconService实现缓存和域名复用
 * 3. 响应式状态管理
 * 4. 自动清理和取消订阅
 */

import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { faviconService, type FaviconStatus } from '@/services/favicon-service'
import { logger } from '@/infrastructure/logging/logger'

export interface UseLazyFaviconOptions {
  /** 书签URL */
  url: Ref<string | undefined>
  /** 节点的根元素ref */
  rootEl: Ref<HTMLElement | null>
  /** Intersection Observer的root margin（默认：提前200px开始加载） */
  rootMargin?: string
  /** 是否启用懒加载（默认：true） */
  enabled?: boolean
}

export interface UseLazyFaviconReturn {
  /** favicon URL */
  faviconUrl: Ref<string>
  /** 加载状态 */
  status: Ref<FaviconStatus>
  /** 是否加载失败 */
  isError: Ref<boolean>
  /** 是否正在加载 */
  isLoading: Ref<boolean>
  /** 是否已加载 */
  isLoaded: Ref<boolean>
  /** 手动触发加载 */
  load: () => void
  /** 处理图片加载成功 */
  handleLoad: () => void
  /** 处理图片加载失败 */
  handleError: () => void
}

/**
 * 懒加载Favicon Hook
 */
export function useLazyFavicon(
  options: UseLazyFaviconOptions
): UseLazyFaviconReturn {
  const { url, rootEl, rootMargin = '200px', enabled = true } = options

  // 响应式状态
  const faviconUrl = ref('')
  const status = ref<FaviconStatus>('loading')
  const isIntersecting = ref(false)
  const hasLoaded = ref(false)

  // Intersection Observer实例
  let observer: IntersectionObserver | null = null
  let unsubscribe: (() => void) | null = null

  // 计算属性
  const isError = ref(false)
  const isLoading = ref(false)
  const isLoaded = ref(false)

  /**
   * 更新计算状态
   */
  const updateComputedState = () => {
    isError.value = status.value === 'error'
    isLoading.value = status.value === 'loading'
    isLoaded.value = status.value === 'loaded'
  }

  /**
   * 加载favicon
   */
  const load = async () => {
    const bookmarkUrl = url.value
    if (!bookmarkUrl || hasLoaded.value) return

    // ✅ 检查是否是特殊协议URL或本地URL
    try {
      const parsed = new URL(bookmarkUrl)

      // 跳过特殊协议
      const specialProtocols = [
        'chrome-extension:',
        'chrome:',
        'file:',
        'about:',
        'data:',
        'javascript:'
      ]
      if (specialProtocols.includes(parsed.protocol)) {
        status.value = 'error'
        updateComputedState()
        return
      }

      // 跳过localhost和本地IP
      const hostname = parsed.hostname
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.')
      ) {
        status.value = 'error'
        updateComputedState()
        return
      }
    } catch {
      // URL解析失败，跳过
      status.value = 'error'
      updateComputedState()
      return
    }

    hasLoaded.value = true

    try {
      // 使用FaviconService获取favicon
      const initialUrl = await faviconService.getFavicon(
        bookmarkUrl,
        (newStatus, newUrl) => {
          status.value = newStatus
          if (newUrl) {
            faviconUrl.value = newUrl
          }
          updateComputedState()
        }
      )

      if (!initialUrl) {
        // 服务返回空（可能是特殊协议），标记为error
        status.value = 'error'
        updateComputedState()
        return
      }

      faviconUrl.value = initialUrl
      status.value = 'loading'
      updateComputedState()
    } catch (error) {
      logger.error('useLazyFavicon', '加载favicon失败:', error)
      status.value = 'error'
      updateComputedState()
    }
  }

  /**
   * 处理图片加载成功
   */
  const handleLoad = () => {
    const bookmarkUrl = url.value
    if (!bookmarkUrl) return

    logger.debug(
      'useLazyFavicon',
      `✅ Favicon加载成功: ${bookmarkUrl} -> ${faviconUrl.value}`
    )
    faviconService.markLoaded(bookmarkUrl, faviconUrl.value)
    status.value = 'loaded'
    updateComputedState()
  }

  /**
   * 处理图片加载失败
   */
  const handleError = () => {
    const bookmarkUrl = url.value
    if (!bookmarkUrl) return

    logger.warn(
      'useLazyFavicon',
      `❌ Favicon加载失败: ${bookmarkUrl} (当前URL: ${faviconUrl.value})`
    )

    // 尝试下一个回退方案
    const nextUrl = faviconService.markError(bookmarkUrl)
    if (nextUrl) {
      logger.debug('useLazyFavicon', `🔄 尝试回退URL: ${nextUrl}`)
      faviconUrl.value = nextUrl
      status.value = 'loading'
    } else {
      logger.error('useLazyFavicon', `💀 所有回退方案失败: ${bookmarkUrl}`)
      status.value = 'error'
    }
    updateComputedState()
  }

  /**
   * 初始化Intersection Observer
   */
  const initObserver = () => {
    if (!enabled || !rootEl.value) return

    observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !isIntersecting.value) {
            isIntersecting.value = true
            // 进入可视区域，开始加载
            load()
          }
        })
      },
      {
        rootMargin,
        threshold: 0.01 // 只要有1%可见就触发
      }
    )

    observer.observe(rootEl.value)
  }

  /**
   * 清理Observer
   */
  const cleanupObserver = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  // 监听rootEl变化
  watch(rootEl, (newEl, oldEl) => {
    if (oldEl && observer) {
      observer.unobserve(oldEl)
    }
    if (newEl && enabled) {
      initObserver()
    }
  })

  // 监听URL变化
  watch(url, () => {
    // URL变化时重置状态
    hasLoaded.value = false
    faviconUrl.value = ''
    status.value = 'loading'
    updateComputedState()

    // 如果已在可视区域，立即加载
    if (isIntersecting.value) {
      load()
    }
  })

  // 组件挂载
  onMounted(() => {
    if (!enabled) {
      // 禁用懒加载，直接加载
      load()
    } else {
      // 启用懒加载，等待进入可视区域
      initObserver()
    }
  })

  // 组件卸载
  onUnmounted(() => {
    cleanupObserver()
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  })

  return {
    faviconUrl,
    status,
    isError,
    isLoading,
    isLoaded,
    load,
    handleLoad,
    handleError
  }
}
