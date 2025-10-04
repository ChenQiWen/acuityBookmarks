<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-cog-outline" /> <span>通用</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">主题</div>
        <div class="field">
          <Switch v-model="isDark" size="md" @change="applyTheme" />
          <Switch v-model="useGlass" size="md" label="玻璃" @change="applyGlass" />
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

function applyTheme(){
  try { (window as any).AB_setTheme?.(isDark.value ? 'dark' : 'light') } catch {}
}
function applyGlass(){
  try { (window as any).AB_setGlassEffect?.(!!useGlass.value) } catch {}
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:16px}
.label{width:120px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:20px}
.field{display:flex;align-items:center;gap:16px}
</style>