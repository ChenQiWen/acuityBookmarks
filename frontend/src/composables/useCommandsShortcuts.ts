import { ref, onMounted, onUnmounted } from 'vue'

// 读取并跟踪 Chrome 扩展快捷键配置
export function useCommandsShortcuts() {
  const shortcuts = ref<Record<string, string>>({})

  async function loadShortcuts() {
    try {
      const list = await chrome.commands.getAll()
      const map: Record<string, string> = {}
      for (const cmd of list as chrome.commands.Command[]) {
        // cmd.shortcut 为 '' 表示未配置
        if (cmd?.name) {
          map[cmd.name] = (cmd.shortcut || '') as string
        }
      }
      shortcuts.value = map
    } catch (_e) {
      // 在开发环境或部分浏览器下可能不可用，保持空
      shortcuts.value = {}
    }
  }

  function startAutoRefresh() {
    // Service Worker 环境检查
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    // 当页面重新获得焦点或可见时刷新，确保用户在设置页修改后能实时同步
    const refresh = () => {
      loadShortcuts()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh()
    })
  }

  function stopAutoRefresh() {
    window.removeEventListener('focus', loadShortcuts)
  }

  onMounted(loadShortcuts)
  onUnmounted(stopAutoRefresh)

  return { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh }
}
