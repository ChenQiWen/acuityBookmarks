<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-brain" /> <span>嵌入（Embeddings）</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">自动生成</div>
        <div class="field">
          <Switch v-model="autoEnabled" size="md" />
        </div>
      </div>
      <div class="row">
        <div class="label">每日配额</div>
        <Input v-model.number="dailyQuota" type="number" density="compact" style="width:140px" placeholder="默认300" />
      </div>
      <div class="row">
        <div class="label">单次最大</div>
        <Input v-model.number="perRunMax" type="number" density="compact" style="width:140px" placeholder="默认150" />
      </div>
      <div class="row">
        <div class="label">仅夜间/空闲</div>
        <Switch v-model="nightOrIdleOnly" size="md" />
      </div>
      <div class="row">
        <Button size="sm" color="primary" variant="outline" @click="save">保存</Button>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button, Card, Icon, Input, Switch } from '../../components/ui'
import { unifiedBookmarkAPI } from '../../utils/unified-bookmark-api'
import { showToastError } from '../../utils/toastbar'

const autoEnabled = ref<boolean>(true)
const dailyQuota = ref<number | undefined>(undefined)
const perRunMax = ref<number | undefined>(undefined)
const nightOrIdleOnly = ref<boolean>(false)

onMounted(async () => {
  try {
    const enabled = await unifiedBookmarkAPI.getSetting<boolean>('embedding.autoGenerateEnabled')
    autoEnabled.value = enabled === null ? true : Boolean((enabled as any).value ?? enabled)

    const dqRaw = await unifiedBookmarkAPI.getSetting<number>('embedding.auto.dailyQuota')
    const dq = (dqRaw as any)?.value ?? dqRaw
    if (typeof dq === 'number') dailyQuota.value = dq

    const pmRaw = await unifiedBookmarkAPI.getSetting<number>('embedding.auto.perRunMax')
    const pm = (pmRaw as any)?.value ?? pmRaw
    if (typeof pm === 'number') perRunMax.value = pm

    const nioRaw = await unifiedBookmarkAPI.getSetting<boolean>('embedding.auto.nightOrIdleOnly')
    const nio = (nioRaw as any)?.value ?? nioRaw
    if (typeof nio === 'boolean') nightOrIdleOnly.value = nio
  } catch (e) {
    console.error('[EmbeddingSettings] 加载设置失败，使用默认值', e)
    showToastError('加载嵌入设置失败，已使用默认值', 'Settings')
    // 保持默认值，不抛出，组件仍可用
  }
})

async function save(){
  await unifiedBookmarkAPI.saveSetting('embedding.autoGenerateEnabled', Boolean(autoEnabled.value), 'boolean', '是否自动生成嵌入')
  if (dailyQuota.value != null) await unifiedBookmarkAPI.saveSetting('embedding.auto.dailyQuota', Number(dailyQuota.value), 'number')
  if (perRunMax.value != null) await unifiedBookmarkAPI.saveSetting('embedding.auto.perRunMax', Number(perRunMax.value), 'number')
  await unifiedBookmarkAPI.saveSetting('embedding.auto.nightOrIdleOnly', Boolean(nightOrIdleOnly.value), 'boolean')
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:10px}
.label{width:120px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:12px}
</style>