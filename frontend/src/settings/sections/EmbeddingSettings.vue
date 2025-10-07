<template>
  <Card>
    <template #header>
      <div class="title-row">
        <Icon name="mdi-brain" /> <span>嵌入（Embeddings）</span>
      </div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">自动生成</div>
        <div class="field">
          <Switch v-model="autoEnabled" size="md" @change="onToggleAuto" />
        </div>
      </div>
      <div class="row">
        <div class="label">每日配额</div>
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
        <div class="label">单次最大</div>
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
        <div class="label">仅夜间/空闲</div>
        <Switch
          v-model="nightOrIdleOnly"
          size="md"
          @change="onToggleNightIdle"
        />
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, Icon, Input, Switch } from '../../components/ui'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { showToastError, showToastSuccess } from '../../utils/toastbar'

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
      enabled === null ? true : Boolean((enabled as any).value ?? enabled)

    const dqRaw = await settingsAppService.getSetting<number>(
      'embedding.auto.dailyQuota'
    )
    const dq = (dqRaw as any)?.value ?? dqRaw
    if (typeof dq === 'number') dailyQuota.value = dq

    const pmRaw = await settingsAppService.getSetting<number>(
      'embedding.auto.perRunMax'
    )
    const pm = (pmRaw as any)?.value ?? pmRaw
    if (typeof pm === 'number') perRunMax.value = pm

    const nioRaw = await settingsAppService.getSetting<boolean>(
      'embedding.auto.nightOrIdleOnly'
    )
    const nio = (nioRaw as any)?.value ?? nioRaw
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
  } catch (e) {
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
  } catch (e) {
    /* 忽略错误，保留显式保存入口 */
  }
}

// 即时保存：数值输入在 blur/Enter 时提交；为空时删除配置以回退默认
async function commitDailyQuota() {
  try {
    const v = dailyQuota.value
    if (v == null || v === ('' as any)) {
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
    if (v == null || v === ('' as any)) {
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
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
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
</style>
