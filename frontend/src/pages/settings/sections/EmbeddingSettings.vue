<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-brain" />
      <span>嵌入（Embeddings）</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          自动生成
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>自动生成的作用：</strong>
                <ul>
                  <li>自动为新书签生成语义向量（Embeddings）</li>
                  <li>支持基于内容的智能搜索和推荐</li>
                  <li>无需手动触发，后台自动处理</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <Switch v-model="autoEnabled" size="md" @change="onToggleAuto" />
        </div>
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          每日配额
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>每日配额的作用：</strong>
                <ul>
                  <li>限制每天生成向量的书签数量</li>
                  <li>避免过度消耗 API 配额</li>
                  <li>默认 300 条/天，可根据需求调整</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <Input
          v-model.number="dailyQuota"
          type="number"
          density="compact"
          style="width: 140px"
          placeholder="默认300"
          @blur="commitDailyQuota"
          @keydown.enter.prevent="commitDailyQuota"
        />
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          单次最大
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>单次最大的作用：</strong>
                <ul>
                  <li>每次运行最多处理的书签数量</li>
                  <li>避免长时间占用资源</li>
                  <li>默认 150 条，分批处理更稳定</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <Input
          v-model.number="perRunMax"
          type="number"
          density="compact"
          style="width: 140px"
          placeholder="默认150"
          @blur="commitPerRunMax"
          @keydown.enter.prevent="commitPerRunMax"
        />
      </div>
      <div class="row">
        <div class="label label--with-tooltip">
          仅夜间/空闲
          <Tooltip offset="md">
            <Icon name="icon-info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>仅夜间/空闲的作用：</strong>
                <ul>
                  <li>只在系统空闲或夜间时段生成向量</li>
                  <li>避免影响日常使用体验</li>
                  <li>推荐开启，让生成过程更加智能</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <Switch
          v-model="nightOrIdleOnly"
          size="md"
          @change="onToggleNightIdle"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { defineOptions, onMounted, ref } from 'vue'

defineOptions({
  name: 'EmbeddingSettings'
})
import { Icon, Input, Switch, Tooltip } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { showToastError, showToastSuccess } from '@/application'

const autoEnabled = ref<boolean>(true)
const dailyQuota = ref<number | undefined>(undefined)
const perRunMax = ref<number | undefined>(undefined)
const nightOrIdleOnly = ref<boolean>(false)

onMounted(async () => {
  try {
    const enabled = await settingsAppService.getSetting<boolean>(
      'embedding.autoGenerateEnabled'
    )
    autoEnabled.value =
      enabled === null
        ? true
        : Boolean((enabled as unknown as { value?: boolean }).value ?? enabled)

    const dqRaw = await settingsAppService.getSetting<number>(
      'embedding.auto.dailyQuota'
    )
    const dq = (dqRaw as unknown as { value?: number })?.value ?? dqRaw
    if (typeof dq === 'number') dailyQuota.value = dq

    const pmRaw = await settingsAppService.getSetting<number>(
      'embedding.auto.perRunMax'
    )
    const pm = (pmRaw as unknown as { value?: number })?.value ?? pmRaw
    if (typeof pm === 'number') perRunMax.value = pm

    const nioRaw = await settingsAppService.getSetting<boolean>(
      'embedding.auto.nightOrIdleOnly'
    )
    const nio = (nioRaw as unknown as { value?: boolean })?.value ?? nioRaw
    if (typeof nio === 'boolean') nightOrIdleOnly.value = nio
  } catch (e) {
    console.error('[EmbeddingSettings] 加载设置失败，使用默认值', e)
    showToastError('加载嵌入设置失败，已使用默认值', 'Settings')
    // 保持默认值，不抛出，组件仍可用
  }
})

// 即时保存：开关变化时立即落盘
async function onToggleAuto(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'embedding.autoGenerateEnabled',
      Boolean(v),
      'boolean',
      '是否自动生成嵌入'
    )
    showToastSuccess(v ? '已开启自动生成' : '已关闭自动生成', '嵌入设置')
  } catch {
    /* 忽略错误，保留显式保存入口 */
  }
}
async function onToggleNightIdle(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'embedding.auto.nightOrIdleOnly',
      Boolean(v),
      'boolean'
    )
    showToastSuccess(v ? '仅夜间/空闲：开启' : '仅夜间/空闲：关闭', '嵌入设置')
  } catch {
    /* 忽略错误，保留显式保存入口 */
  }
}

// 即时保存：数值输入在 blur/Enter 时提交；为空时删除配置以回退默认
async function commitDailyQuota() {
  try {
    const v = dailyQuota.value
    if (v == null) {
      await settingsAppService.deleteSetting('embedding.auto.dailyQuota')
      showToastSuccess('已恢复每日配额默认值', '嵌入设置')
      return
    }
    await settingsAppService.saveSetting(
      'embedding.auto.dailyQuota',
      Number(v),
      'number'
    )
    showToastSuccess(`每日配额：${Number(v)}`, '嵌入设置')
  } catch {}
}
async function commitPerRunMax() {
  try {
    const v = perRunMax.value
    if (v == null) {
      await settingsAppService.deleteSetting('embedding.auto.perRunMax')
      showToastSuccess('已恢复单次最大默认值', '嵌入设置')
      return
    }
    await settingsAppService.saveSetting(
      'embedding.auto.perRunMax',
      Number(v),
      'number'
    )
    showToastSuccess(`单次最大：${Number(v)}`, '嵌入设置')
  } catch {}
}
</script>
<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.label {
  width: 120px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label--with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: default;
}

.label-info-icon {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.label-info-icon:hover {
  color: var(--color-primary);
}

.tooltip-content {
  font-size: 0.85rem;
  line-height: 1.4;
}

.tooltip-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.tooltip-content li {
  margin-bottom: 4px;
}
</style>
