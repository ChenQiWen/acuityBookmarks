import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

export class SettingsAppService {
  private async ensureInit() {
    await indexedDBManager.initialize()
  }

  async getSetting<T>(key: string): Promise<T | null> {
    await this.ensureInit()
    return indexedDBManager.getSetting<T>(key)
  }

  async saveSetting(key: string, value: any, type?: string, description?: string): Promise<void> {
    await this.ensureInit()
    return indexedDBManager.saveSetting(key, value, type, description)
  }

  async deleteSetting(key: string): Promise<void> {
    await this.ensureInit()
    return indexedDBManager.deleteSetting(key)
  }
}

export const settingsAppService = new SettingsAppService()
