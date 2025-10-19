/**
 * 页面导航工具
 *
 * 职责：
 * - 封装扩展内页面的打开逻辑
 * - 提供统一的导航接口
 * - 避免在多个模块中重复字符串拼接
 * - 统一错误处理
 *
 * 功能：
 * - 打开书签管理页面
 * - 打开设置页面
 * - 切换侧边栏
 */

import { logger } from '@/infrastructure/logging/logger'
import { navigationService } from '@/services/navigation-service'

/**
 * 导航工作流接口
 *
 * 定义所有导航操作的标准契约
 */
export interface NavigationWorkflow {
  /** 打开书签管理页面 */
  openManagement(): Promise<void>
  /** 打开设置页面 */
  openSettings(): Promise<void>
  /** 切换侧边栏 */
  toggleSidePanel(): Promise<void>
}

/**
 * 导航工作流实现
 *
 * 封装具体的导航逻辑
 */
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

/**
 * 打开书签管理页面
 *
 * 在新标签页中打开管理页面，错误会被记录但不会抛出
 */
export async function openManagementPage(): Promise<void> {
  try {
    await workflow.openManagement()
  } catch (error) {
    logger.warn('Navigation', '打开书签管理页面失败', error)
  }
}

/**
 * 打开设置页面
 *
 * 在新标签页中打开设置页面，错误会被记录但不会抛出
 */
export async function openSettingsPage(): Promise<void> {
  try {
    await workflow.openSettings()
  } catch (error) {
    logger.warn('Navigation', '打开设置页面失败', error)
  }
}

/**
 * 切换侧边栏
 *
 * 打开或关闭侧边栏，错误会被记录但不会抛出
 */
export async function toggleSidePanel(): Promise<void> {
  try {
    await workflow.toggleSidePanel()
  } catch (error) {
    logger.warn('Navigation', '切换侧边栏失败', error)
  }
}
