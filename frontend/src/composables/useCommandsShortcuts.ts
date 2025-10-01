import { ref, onMounted, onUnmounted } from 'vue'

// 读取并跟踪 Chrome 扩展快捷键配置
export function useCommandsShortcuts() {
  const shortcuts = ref<Record<string, string>>({})
  let intervalId: number | null = null

  async function loadShortcuts() {
    try {
      const list = await chrome.commands.getAll()
      const map: Record<string, string> = {}
      for (const cmd of list as any[]) {
        // cmd.shortcut 为 '' 表示未配置
        if (cmd && cmd.name) {
          map[cmd.name] = (cmd.shortcut || '') as string
        }
      }
      shortcuts.value = map
    } catch (e) {
      // 在开发环境或部分浏览器下可能不可用，保持空
      shortcuts.value = {}
    }
  }

  function startAutoRefresh() {
    // 当页面重新获得焦点或可见时刷新，确保用户在设置页修改后能实时同步
    const refresh = () => { loadShortcuts() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh()
    })
    // 兜底：定时轮询，避免遗漏事件（较低频率）
    intervalId = window.setInterval(refresh, 5000)
  }

  function stopAutoRefresh() {
    window.removeEventListener('focus', loadShortcuts)
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  onMounted(loadShortcuts)
  onUnmounted(stopAutoRefresh)

  return { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh }
}