<template>
  <div class="landing-page">
    <Hero :extension-link="extensionLink">
      <template #showcase>
        <!-- Placeholder for dashboard screenshot -->
        <div class="w-full h-full bg-bg-depth relative overflow-hidden">
          <!-- Mockup UI -->
          <div
            class="absolute inset-0 bg-[url('/dashboard-preview.png')] bg-cover bg-center opacity-50"
          ></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="text-center p-6 bg-bg-surface/80 backdrop-blur-sm rounded-xl border border-white/10 max-w-md"
            >
              <h3 class="text-xl font-bold mb-2">Your Knowledge OS</h3>
              <p class="text-sm text-content-muted">
                Imagine your bookmarks organized automatically by AI.
              </p>
            </div>
          </div>
        </div>
      </template>
    </Hero>

    <PainPoints />

    <Features />

    <Pricing />

    <section class="py-24 relative overflow-hidden">
      <div
        class="absolute inset-0 bg-gradient-to-b from-bg-depth to-primary-900/20 z-0"
      ></div>
      <div class="container mx-auto px-4 relative z-10 text-center">
        <h2 class="text-3xl md:text-5xl font-bold mb-8 max-w-3xl mx-auto">
          准备好重塑您的<span class="text-accent-400">知识工作流</span>了吗？
        </h2>
        <p class="text-xl text-content-muted mb-12 max-w-2xl mx-auto">
          立即安装扩展，或约我们演示如何把 AcuityBookmarks 部署到你的团队。
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" @click="openExtension">免费安装扩展</Button>
          <Button variant="secondary" size="lg" to="/contact" :as="NuxtLink"
            >预约演示</Button
          >
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import Hero from '@/components/landing/Hero.vue'
import PainPoints from '@/components/landing/PainPoints.vue'
import Features from '@/components/landing/Features.vue'
import Pricing from '@/components/landing/Pricing.vue'
import Button from '@/components/ui/Button.vue'

const NuxtLink = resolveComponent('NuxtLink')
const { extensionLink } = useProductLinks()

const openExtension = () => {
  if (extensionLink) {
    window.open(extensionLink, '_blank')
  }
}

useSeoMeta({
  title: 'AcuityBookmarks · AI 驱动的智能书签工作台',
  description:
    'Fuse.js 模糊检索 × AI 语义推荐 × Cloudflare Worker API。AcuityBookmarks 为高密度知识工作者打造极速、离线、安全的书签体验。',
  ogTitle: 'AcuityBookmarks · AI 驱动的智能书签工作台',
  ogDescription:
    '结合离线索引、AI 推荐、自动化爬虫和 Cloudflare Worker，重新定义书签管理。',
  twitterCard: 'summary_large_image'
})
</script>
