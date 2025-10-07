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
</template>
<script setup lang="ts">
import { Card, Icon, Switch } from '../../components/ui'
import { ref } from 'vue'

const isDark = ref(false)
const useGlass = ref(false)

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
</style>
