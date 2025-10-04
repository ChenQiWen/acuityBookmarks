<template>
  <div class="settings-root">
    <Tabs v-model="tab" :tabs="tabs" grow />

    <div v-if="tab==='general'" class="pane"><GeneralSettings /></div>
    <div v-else-if="tab==='embeddings'" class="pane"><EmbeddingSettings /></div>
    <div v-else-if="tab==='vectorize'" class="pane"><VectorizeSettings /></div>
    <div v-else-if="tab==='notifications'" class="pane"><NotificationSettings /></div>
    <div v-else-if="tab==='account'" class="pane"><AccountSettings /></div>
    <div v-else-if="tab==='subscription'" class="pane"><SubscriptionSettings /></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Tabs } from '../components/ui'
import GeneralSettings from './sections/GeneralSettings.vue'
import EmbeddingSettings from './sections/EmbeddingSettings.vue'
import VectorizeSettings from './sections/VectorizeSettings.vue'
import NotificationSettings from './sections/NotificationSettings.vue'
import AccountSettings from './sections/AccountSettings.vue'
import SubscriptionSettings from './sections/SubscriptionSettings.vue'

const tab = ref<'general'|'embeddings'|'vectorize'|'notifications'|'account'|'subscription'>('general')
const tabs = [
  { value: 'general', text: '通用' },
  { value: 'embeddings', text: '嵌入' },
  { value: 'vectorize', text: 'Vectorize' },
  { value: 'notifications', text: '通知' },
  { value: 'account', text: '账户' },
  { value: 'subscription', text: '订阅' }
]
</script>

<style scoped>
.settings-root { display: flex; flex-direction: column; gap: 12px; }
.pane { padding: 8px 4px; }
</style>
