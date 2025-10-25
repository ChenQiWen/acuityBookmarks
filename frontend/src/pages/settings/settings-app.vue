<template>
  <App app theme="light" class="app-container">
    <Main padding class="main-content">
      <div class="settings-container">
        <Settings />
      </div>
    </Main>
  </App>
</template>

<script setup lang="ts">
import Settings from './Settings.vue'
import { App, Main } from '@/components'
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: none;
  height: calc(100vh - var(--spacing-16));
  overflow: auto;
  background: var(--color-background);
}
.settings-container {
  padding: 16px 20px;
}
</style>
