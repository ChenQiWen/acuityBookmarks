<template>
  <App app theme="light" class="app-container">
    <AppBar app flat class="app-bar-style">
      <template #prepend>
        <ThemeSwitcher />
      </template>
      <template #title>
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">设置</div>
      </template>
    </AppBar>

    <Main with-app-bar padding class="main-content">
      <div class="settings-container">
        <Settings />
      </div>
    </Main>
  </App>
</template>

<script setup lang="ts">
import ThemeSwitcher from '../components/ThemeSwitcher.vue'
import Settings from './Settings.vue'
import { App, Main, AppBar } from '../components/ui'
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
  height: calc(100vh - 64px);
  overflow: auto;
}
.app-bar-style { border-bottom: 1px solid var(--color-border); }
.app-bar-logo { height: 28px; margin-right: 12px; }
.app-bar-title-text { font-weight: 600; font-size: 1.1rem; }
.settings-container { padding: 12px; }
</style>
