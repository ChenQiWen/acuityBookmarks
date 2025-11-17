<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts"></script>

<style>
:root {
  color-scheme: dark;
  --bg-depth: #030617;
  --surface: rgba(15, 23, 42, 0.8);
  --surface-strong: rgba(15, 23, 42, 0.95);
  --card: #111a2c;
  --card-soft: rgba(15, 23, 42, 0.6);
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --accent: #38bdf8;
  --accent-strong: #7c3aed;
  --border-subtle: rgba(148, 163, 184, 0.2);
  --radius-lg: 28px;
  --radius-md: 18px;
  --radius-sm: 12px;
  --shadow-soft: 0 20px 60px rgba(15, 23, 42, 0.4);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family:
    'Inter',
    'MiSans',
    'PingFang SC',
    'SF Pro Display',
    'Segoe UI',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
}

body {
  min-height: 100vh;
  background-color: var(--bg-depth);
  background-image:
    radial-gradient(
      circle at 20% 20%,
      rgba(56, 189, 248, 0.12),
      transparent 35%
    ),
    radial-gradient(circle at 80% 0%, rgba(124, 58, 237, 0.15), transparent 30%);
  color: var(--text-primary);
  line-height: 1.7;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

::selection {
  background: rgba(56, 189, 248, 0.35);
  color: #fff;
}
</style>
