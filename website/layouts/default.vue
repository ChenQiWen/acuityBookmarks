<template>
  <div class="min-h-screen flex flex-col bg-bg-default text-content font-sans">
    <header
      class="sticky top-0 z-50 w-full border-b border-white/5 bg-bg-default/80 backdrop-blur-xl"
    >
      <div
        class="container mx-auto px-4 h-20 flex items-center justify-between"
      >
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-3 group">
          <div
            class="bg-gradient-to-br from-primary-500 to-accent-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform"
          >
            Acuity
          </div>
          <div class="flex flex-col">
            <span class="font-bold text-lg leading-none tracking-tight"
              >Bookmarks</span
            >
            <span
              class="text-[10px] text-content-muted uppercase tracking-widest"
              >Intelligent OS</span
            >
          </div>
        </NuxtLink>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-8">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.label"
            :to="link.to"
            class="text-sm font-medium text-content-muted hover:text-primary-400 transition-colors"
            active-class="text-primary-400"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            to="/login"
            class="hidden sm:inline-flex"
            :as="NuxtLink"
          >
            登录
          </Button>
          <Button
            variant="ghost"
            size="sm"
            to="/register"
            class="hidden md:inline-flex"
            :as="NuxtLink"
          >
            注册
          </Button>
          <Button size="sm" @click="openExtension"> 添加到 Chrome </Button>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-white/5 bg-bg-depth pt-20 pb-10">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <!-- Brand Column -->
          <div class="md:col-span-1">
            <div class="font-bold text-xl mb-4 text-content">
              AcuityBookmarks
            </div>
            <p class="text-content-muted text-sm leading-relaxed mb-6">
              AI
              驱动的智能书签工作台，帮助高密度信息工作者在任何设备、任何网络环境下快速找到灵感与知识。
            </p>
            <div class="flex gap-3">
              <NuxtLink
                to="/about"
                class="text-xs border border-white/10 px-3 py-1 rounded-full hover:bg-white/5 transition-colors"
                >了解团队</NuxtLink
              >
              <NuxtLink
                to="/feature-request"
                class="text-xs border border-white/10 px-3 py-1 rounded-full hover:bg-white/5 transition-colors"
                >提交需求</NuxtLink
              >
            </div>
          </div>

          <!-- Links Columns -->
          <div
            v-for="group in footerGroups"
            :key="group.title"
            class="flex flex-col gap-4"
          >
            <div
              class="text-xs font-bold uppercase tracking-widest text-content-subtle"
            >
              {{ group.title }}
            </div>
            <ul class="space-y-3">
              <li v-for="item in group.links" :key="item.label">
                <component
                  :is="item.external ? 'a' : NuxtLink"
                  :href="item.external ? item.to : undefined"
                  :to="item.external ? undefined : item.to"
                  :target="item.external ? '_blank' : undefined"
                  class="text-sm text-content-muted hover:text-primary-400 transition-colors"
                >
                  {{ item.label }}
                </component>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <p class="text-xs text-content-subtle">
            © {{ copyrightYear }} AcuityBookmarks. All rights reserved.
          </p>
          <div class="flex gap-6 text-xs text-content-muted">
            <NuxtLink to="/privacy" class="hover:text-content"
              >隐私政策</NuxtLink
            >
            <NuxtLink to="/terms" class="hover:text-content">使用条款</NuxtLink>
            <a
              href="https://github.com/ChenQiWen/acuityBookmarks"
              target="_blank"
              class="hover:text-content"
              >GitHub</a
            >
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

const NuxtLink = resolveComponent('NuxtLink')
const { extensionLink } = useProductLinks()
const copyrightYear = new Date().getFullYear()

const openExtension = () => {
  if (extensionLink) {
    window.open(extensionLink, '_blank')
  }
}

const navLinks = [
  { label: '功能', to: '/features' },
  { label: '定价', to: '/pricing' },
  { label: '关于', to: '/about' },
  { label: '下载', to: '/download' }
]

const footerGroups = [
  {
    title: '产品',
    links: [
      { label: '功能总览', to: '/features' },
      { label: '定价方案', to: '/pricing' },
      { label: '下载扩展', to: '/download' }
    ]
  },
  {
    title: '资源',
    links: [
      { label: '产品路线图', to: '/feature-request' },
      { label: '发布日志', to: '/about' },
      {
        label: 'GitHub 仓库',
        to: 'https://github.com/ChenQiWen/acuityBookmarks',
        external: true
      }
    ]
  },
  {
    title: '支持',
    links: [
      { label: '关于我们', to: '/about' },
      { label: '联系团队', to: '/contact' },
      { label: '服务条款', to: '/terms' }
    ]
  }
]
</script>
