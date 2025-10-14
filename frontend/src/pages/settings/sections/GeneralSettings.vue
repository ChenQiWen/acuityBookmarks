<template>
  <Card>
    <template #header>
      <div class="title-row">
        <Icon name="mdi-cog-outline" /> <span>通用</span>
      </div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">深色模式</div>
        <div class="field">
          <Switch v-model="isDark" size="md" @change="applyTheme" />
        </div>
      </div>
      <div class="row">
        <div class="label">玻璃效果</div>
        <div class="field">
          <Switch v-model="useGlass" size="md" @change="applyGlass" />
        </div>
      </div>
    </div>
  </Card>

  <!-- 数据缓存管理 -->
  <Card>
    <template #header>
      <div class="title-row">
        <Icon name="mdi-database-refresh-outline" />
        <span>数据缓存</span>
      </div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">清除缓存</div>
        <div class="field">
          <Button
            color="warning"
            variant="outline"
            size="md"
            :loading="isClearingCache"
            @click="clearCacheAndRefresh"
          >
            <template #prepend>
              <Icon name="mdi-cached" />
            </template>
            <span v-if="!isClearingCache">清除缓存</span>
            <span v-else>清除中...</span>
          </Button>
        </div>
      </div>
      <div class="row">
        <div class="label"></div>
        <div class="field">
          <Card variant="outlined" class="info-card">
            <div class="info-header">
              <Icon name="mdi-information-outline" />
              <strong>清除缓存的作用：</strong>
            </div>
            <div class="info-content">
              <ul>
                <li>刷新书签统计数据，确保显示最新数量</li>
                <li>重新计算健康度概览（如404链接、重复URL等）</li>
                <li>解决统计数字与实际情况不符的问题</li>
              </ul>
              <div class="info-note">
                注意：此操作不会删除您的书签数据，只会刷新派生统计信息。
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { Card, Icon, Switch, Button } from '@/components'
import { ref } from 'vue'
import { useUIStore } from '@/stores/ui-store'
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'

const isDark = ref(false)
const useGlass = ref(false)

// 清除缓存相关状态
const uiStore = useUIStore()
const popupStore = usePopupStoreIndexedDB()
const isClearingCache = ref(false)

function applyTheme() {
  try {
    ;(
      window as unknown as { AB_setTheme?: (theme: string) => void }
    ).AB_setTheme?.(isDark.value ? 'dark' : 'light')
  } catch {}
}
function applyGlass() {
  try {
    ;(
      window as unknown as { AB_setGlassEffect?: (enabled: boolean) => void }
    ).AB_setGlassEffect?.(!!useGlass.value)
  } catch {}
}

// 清除缓存功能
async function clearCacheAndRefresh() {
  if (isClearingCache.value) return

  isClearingCache.value = true
  try {
    await popupStore.clearCache()
    uiStore.showSuccess('缓存已成功清除！数据统计已刷新。')
  } catch (error) {
    uiStore.showError(`清除缓存失败: ${(error as Error).message}`)
  } finally {
    isClearingCache.value = false
  }
}
</script>
<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.label {
  width: 120px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.field {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-card {
  border-color: var(--color-primary-alpha-20);
  background-color: var(--color-primary-alpha-5);
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 0.875rem;
}

.info-content {
  font-size: 0.875rem;
}

.info-content ul {
  margin: 0 0 12px 0;
  padding-left: 20px;
}

.info-content li {
  margin-bottom: 4px;
}

.info-note {
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
  font-style: italic;
}
</style>
