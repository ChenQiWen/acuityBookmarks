/**
 * 页面导航工具
 *
 * 封装扩展内页面打开逻辑，避免在多个模块中重复字符串拼接。
 */

import { logger } from '@/infrastructure/logging/logger'
import { navigationService } from '@/services/navigation-service'

export interface NavigationWorkflow {
  openManagement(): Promise<void>
  openSettings(): Promise<void>
  toggleSidePanel(): Promise<void>
}

const workflow: NavigationWorkflow = {
  async openManagement() {
    await navigationService.openExtensionUrl('management.html')
  },
  async openSettings() {
    await navigationService.openExtensionUrl('settings.html')
  },
  async toggleSidePanel() {
    await navigationService.openSidePanel()
  }
}

export async function openManagementPage(): Promise<void> {
  try {
    await workflow.openManagement()
  } catch (error) {
    logger.warn('Navigation', '打开书签管理页面失败', error)
  }
}

export async function openSettingsPage(): Promise<void> {
  try {
    await workflow.openSettings()
  } catch (error) {
    logger.warn('Navigation', '打开设置页面失败', error)
  }
}

export async function toggleSidePanel(): Promise<void> {
  try {
    await workflow.toggleSidePanel()
  } catch (error) {
    logger.warn('Navigation', '切换侧边栏失败', error)
  }
}
