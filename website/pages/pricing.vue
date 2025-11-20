<template>
  <div class="min-h-screen pb-20">
    <!-- Hero Section -->
    <section class="relative pt-32 pb-20 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary-500/10 blur-[120px] -z-10"
      ></div>

      <div class="container mx-auto px-4 text-center">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6"
        >
          <span
            class="text-sm font-medium text-primary-400 tracking-wider uppercase"
            >Pricing</span
          >
        </div>

        <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          免费入门 · 按需升级<br />
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400"
            >支持团队私有化部署</span
          >
        </h1>

        <p
          class="text-lg md:text-xl text-content-muted max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          个人用户可免费使用全部核心功能。Pro 解锁
          AI、自动同步与优先支持；Team/Enterprise 提供自托管、审计与 SLA。
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <div
            v-for="meta in metas"
            :key="meta.label"
            class="p-4 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm"
          >
            <div class="text-2xl font-bold text-content mb-1">
              {{ meta.value }}
            </div>
            <div class="text-xs text-content-muted uppercase tracking-wider">
              {{ meta.label }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Plans Section -->
    <section class="py-10">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <!-- Free Plan -->
          <Card class="p-8 flex flex-col h-full border-white/10">
            <div class="mb-8">
              <h3 class="text-lg font-medium text-content-muted mb-2">Free</h3>
              <div class="text-4xl font-bold mb-4">免费</div>
              <p class="text-sm text-content-subtle">
                无限使用本地核心功能，完全离线可用。
              </p>
            </div>
            <Button
              variant="outline"
              block
              to="/download"
              :as="NuxtLink"
              class="mb-8"
              >立即下载</Button
            >
            <ul class="space-y-4 flex-1">
              <li
                v-for="feature in plans[0].features"
                :key="feature"
                class="flex items-start text-sm text-content-muted"
              >
                <Check class="w-5 h-5 text-content-subtle mr-3 shrink-0" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </Card>

          <!-- Pro Plan -->
          <Card
            class="p-8 flex flex-col h-full relative border-primary-500/50 bg-bg-surface/60 shadow-2xl shadow-primary-500/10"
            hover
          >
            <div class="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge
                variant="default"
                class="bg-primary-500 text-white border-none shadow-lg shadow-primary-500/40 px-4"
                >最受欢迎</Badge
              >
            </div>
            <div class="mb-8">
              <h3 class="text-lg font-bold text-primary-400 mb-2">Pro</h3>
              <div class="flex items-baseline gap-1 mb-1">
                <span class="text-4xl font-bold">¥49</span>
                <span class="text-content-muted">/ 月</span>
              </div>
              <p class="text-xs text-content-subtle mb-4">
                或 ¥499 / 年（省 15%）
              </p>
              <p class="text-sm text-content-muted">
                面向专业用户的 AI + 同步 + 支持组合拳。
              </p>
            </div>
            <Button
              variant="primary"
              block
              to="/pricing"
              :as="NuxtLink"
              class="mb-8"
              >升级到 Pro</Button
            >
            <ul class="space-y-4 flex-1">
              <li
                v-for="feature in plans[1].features"
                :key="feature"
                class="flex items-start text-sm text-content"
              >
                <Check class="w-5 h-5 text-primary-400 mr-3 shrink-0" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </Card>

          <!-- Team Plan -->
          <Card class="p-8 flex flex-col h-full border-white/10">
            <div class="mb-8">
              <h3 class="text-lg font-medium text-content-muted mb-2">Team</h3>
              <div class="text-4xl font-bold mb-4">定制报价</div>
              <p class="text-sm text-content-subtle">
                自托管 Worker、SSO、权限与审计全部打包。
              </p>
            </div>
            <Button
              variant="ghost"
              block
              to="/contact"
              :as="NuxtLink"
              class="mb-8"
              >联系销售</Button
            >
            <ul class="space-y-4 flex-1">
              <li
                v-for="feature in plans[2].features"
                :key="feature"
                class="flex items-start text-sm text-content-muted"
              >
                <Check class="w-5 h-5 text-content-subtle mr-3 shrink-0" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </section>

    <!-- Comparison Table -->
    <section class="py-24">
      <div class="container mx-auto px-4 max-w-5xl">
        <div class="text-center mb-16">
          <h2 class="text-2xl font-bold mb-4">功能详细对比</h2>
          <p class="text-content-muted">
            所有版本均支持离线、隐私优先；高级版拓展 AI 与团队能力
          </p>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-[600px]">
            <!-- Header -->
            <div
              class="grid grid-cols-4 gap-4 p-4 border-b border-white/10 font-bold text-content-muted text-sm"
            >
              <div class="text-left">功能模块</div>
              <div class="text-center">Free</div>
              <div class="text-center text-primary-400">Pro</div>
              <div class="text-center">Team</div>
            </div>

            <!-- Rows -->
            <div
              v-for="(row, index) in matrix"
              :key="row.cap"
              class="grid grid-cols-4 gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors text-sm items-center"
            >
              <div class="font-medium">{{ row.cap }}</div>
              <div
                class="text-center text-content-subtle"
                :class="{ 'text-green-400': row.free === '✓' }"
              >
                {{ row.free }}
              </div>
              <div
                class="text-center font-medium"
                :class="{ 'text-primary-400': row.pro === '✓' }"
              >
                {{ row.pro }}
              </div>
              <div class="text-center text-content-subtle">{{ row.team }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="py-20 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4 max-w-3xl">
        <div class="text-center mb-12">
          <h2 class="text-2xl font-bold mb-4">常见问题</h2>
          <p class="text-content-muted">关于价格、结算与部署的疑问</p>
        </div>

        <div class="space-y-4">
          <div
            v-for="item in faqs"
            :key="item.q"
            class="border border-white/10 rounded-xl bg-bg-surface overflow-hidden"
          >
            <details class="group">
              <summary
                class="flex justify-between items-center p-6 cursor-pointer list-none"
              >
                <span class="font-bold text-lg">{{ item.q }}</span>
                <ChevronDown
                  class="w-5 h-5 text-content-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <div
                class="px-6 pb-6 text-content-muted leading-relaxed border-t border-white/5 pt-4"
              >
                {{ item.a }}
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const NuxtLink = resolveComponent('NuxtLink')

const metas = [
  { value: '免费', label: '个人核心功能' },
  { value: '<48h', label: 'Pro 响应时间' },
  { value: 'SLA 99.9%', label: '企业稳定性' }
]

const plans = [
  {
    features: [
      '多索引检索、标签、备注',
      '本地爬虫与自动化',
      'Popup / Side Panel 全功能'
    ]
  },
  {
    features: [
      '包含 Free 所有功能',
      'AI 向量推荐 / 摘要',
      'Supabase 云同步',
      '批量自动化与监控',
      '优先支持渠道'
    ]
  },
  {
    features: [
      '私有 Cloudflare Worker',
      'Supabase RLS / SSO',
      '安全审计与培训',
      '专属成功经理'
    ]
  }
]

const matrix = [
  {
    cap: '离线本地功能',
    free: '✓',
    pro: '✓',
    team: '✓'
  },
  {
    cap: 'AI 推荐 / 摘要',
    free: '—',
    pro: '✓',
    team: '✓（可自托管）'
  },
  {
    cap: 'Supabase 同步',
    free: '—',
    pro: '✓',
    team: '✓ + RLS + SSO'
  },
  {
    cap: '自动化监控',
    free: '基础',
    pro: '高级调度',
    team: '自定义 Pipeline'
  },
  {
    cap: '支持与 SLA',
    free: '社区支持',
    pro: '<48h 邮件',
    team: 'SLA + 成功经理'
  }
]

const faqs = [
  {
    q: '购买 Pro 后可以取消吗？',
    a: '可以随时取消，周期结束前仍可使用。年度订阅支持按比例退款。您可以在账户设置中一键管理您的订阅状态。'
  },
  {
    q: '团队版如何部署？',
    a: '我们提供详细的部署脚本来检测环境，并协助将 Cloudflare Worker / Supabase 配置到您的账户。我们的技术团队会提供全程指导。'
  },
  {
    q: '是否支持企业采购流程？',
    a: '支持。我们可开具正规发票并签署数据处理协议（DPA）。请通过联系销售页面与我们取得联系，会有专人负责对接。'
  }
]

useSeoMeta({
  title: '定价 - AcuityBookmarks',
  description:
    '了解 Free、Pro、Team/Enterprise 三种方案，覆盖个人到团队的智能书签需求。'
})
</script>
