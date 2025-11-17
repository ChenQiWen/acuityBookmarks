<template>
  <div class="landing">
    <section id="hero" class="hero">
      <div class="hero__content">
        <div class="badge-row">
          <span v-for="item in heroHighlights" :key="item" class="badge">
            {{ item }}
          </span>
        </div>
        <h1>AcuityBookmarks · AI 驱动的智能书签工作台</h1>
        <p class="lede">
          通过 Fuse.js 模糊检索、语义向量推荐与 Cloudflare Worker API
          网关，AcuityBookmarks 让 20K+
          书签依旧快如即时搜索。从离线本地缓存、自动化爬虫调度到多语言
          UI，一切都为高密度信息工作者定制。
        </p>
        <div class="hero__actions">
          <a
            :href="extensionLink"
            target="_blank"
            rel="noopener"
            class="btn primary"
          >
            添加到 Chrome
          </a>
          <NuxtLink to="/features" class="btn secondary">观看产品演示</NuxtLink>
        </div>
        <div class="hero__meta">
          <div v-for="stat in stats" :key="stat.label" class="meta-card">
            <span class="value">{{ stat.value }}</span>
            <span class="label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
      <div class="hero__visual">
        <ClientOnly>
          <HeroShowcase />
        </ClientOnly>
      </div>
    </section>

    <section id="problems" class="panel panel--grid">
      <header>
        <p class="eyebrow">真实痛点 · 研发对症</p>
        <h2>我们从一线用户中提炼出 3 个最难啃的问题</h2>
        <p class="muted">
          设计 AcuityBookmarks
          的初衷，就是解决「书签堆成山却找不到」、「跨设备无法同步」、「零上下文」等长期痛点。
        </p>
      </header>
      <div class="grid gap-24 three">
        <article v-for="pain in painPoints" :key="pain.title" class="card pain">
          <span class="tag">{{ pain.badge }}</span>
          <h3>{{ pain.title }}</h3>
          <p>{{ pain.description }}</p>
          <div class="divider" />
          <p class="solution">{{ pain.solution }}</p>
        </article>
      </div>
    </section>

    <section id="capabilities" class="panel">
      <header>
        <p class="eyebrow">功能矩阵</p>
        <h2>从个体效率到团队协作，一套工具全部搞定</h2>
        <p class="muted">
          分层架构保证每个能力模块既可独立启用、也能组合成流畅的知识工作流。
        </p>
      </header>
      <FeatureGallery class="feature-gallery-block" />
      <div class="grid gap-24 two">
        <article
          v-for="feature in featureMatrix"
          :key="feature.title"
          class="card feature"
        >
          <span class="emoji">{{ feature.icon }}</span>
          <div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </div>
          <ul>
            <li v-for="point in feature.bullets" :key="point">{{ point }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section id="ai" class="ai-section">
      <div class="ai-section__content">
        <div class="sticky">
          <p class="eyebrow">AI · Workflow</p>
          <h2>语义理解 + 离线可控，真正可信的智能推荐</h2>
          <p class="muted">
            全流程都在本地或自托管 Worker
            内执行，从嵌入生成、向量入库到推理回传，任何一步都可以被观察和调优。
          </p>
          <NuxtLink to="/features" class="btn tertiary"
            >查看 AI 交互详情</NuxtLink
          >
        </div>
        <div class="ai-list">
          <article v-for="step in aiWorkflow" :key="step.title">
            <span class="index">{{ step.step }}</span>
            <div>
              <h3>{{ step.title }}</h3>
              <p>{{ step.description }}</p>
              <p class="muted">{{ step.detail }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="architecture" class="panel">
      <header>
        <p class="eyebrow">性能 · 架构</p>
        <h2>从界面体验到云边算力，全栈可观测</h2>
      </header>
      <div class="architecture-grid">
        <article
          v-for="layer in architectureLayers"
          :key="layer.title"
          class="card architecture"
        >
          <p class="stack">{{ layer.stack }}</p>
          <h3>{{ layer.title }}</h3>
          <p>{{ layer.description }}</p>
          <ul>
            <li v-for="point in layer.points" :key="point">{{ point }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section id="trust" class="panel panel--grid">
      <header>
        <p class="eyebrow">Trust & Security</p>
        <h2>隐私优先的设计哲学</h2>
        <p class="muted">
          数据永远掌握在你的设备里。除非你主动开启可选的 Cloudflare Worker 或
          Supabase 同步，否则不会有一行内容离开本地。
        </p>
      </header>
      <div class="grid gap-24 three">
        <article
          v-for="signal in trustSignals"
          :key="signal.title"
          class="card trust"
        >
          <h3>{{ signal.title }}</h3>
          <p>{{ signal.description }}</p>
          <p class="muted">{{ signal.detail }}</p>
        </article>
      </div>
    </section>

    <section id="pricing" class="panel pricing">
      <header>
        <p class="eyebrow">Pricing</p>
        <h2>免费即可使用核心功能，按需升级高级能力</h2>
      </header>
      <div class="pricing-grid">
        <article
          v-for="plan in pricingPlans"
          :key="plan.name"
          class="card pricing-card"
          :class="{ highlight: plan.highlight }"
        >
          <div class="plan-head">
            <div>
              <p class="plan-label">{{ plan.tag }}</p>
              <h3>{{ plan.name }}</h3>
            </div>
            <p class="price">{{ plan.price }}</p>
            <p v-if="plan.subline" class="muted">{{ plan.subline }}</p>
          </div>
          <p class="plan-desc">{{ plan.description }}</p>
          <ul>
            <li v-for="feature in plan.features" :key="feature">
              {{ feature }}
            </li>
          </ul>
          <component
            :is="plan.external ? 'a' : NuxtLink"
            :href="plan.external ? plan.ctaLink : undefined"
            :to="plan.external ? undefined : plan.ctaLink"
            class="btn block"
          >
            {{ plan.cta }}
          </component>
        </article>
      </div>
    </section>

    <section id="faq" class="panel faq">
      <header>
        <p class="eyebrow">FAQ</p>
        <h2>常见问题</h2>
      </header>
      <div class="accordion">
        <details v-for="item in faqs" :key="item.question">
          <summary>{{ item.question }}</summary>
          <p>{{ item.answer }}</p>
        </details>
      </div>
    </section>

    <section id="resources" class="panel resources">
      <header>
        <p class="eyebrow">Resources</p>
        <h2>延伸阅读 & 社区</h2>
        <p class="muted">持续追踪路线图、发布日志与产品洞察。</p>
      </header>
      <div class="resource-grid">
        <article
          v-for="resource in resourceLinks"
          :key="resource.title"
          class="card resource"
        >
          <p class="tag">{{ resource.tag }}</p>
          <h3>{{ resource.title }}</h3>
          <p>{{ resource.description }}</p>
          <component
            :is="resource.external ? 'a' : NuxtLink"
            :href="resource.external ? resource.to : undefined"
            :to="resource.external ? undefined : resource.to"
            class="link"
          >
            {{ resource.label }}
          </component>
        </article>
      </div>
    </section>

    <section class="closing">
      <div class="closing__content">
        <p class="eyebrow">Ready to reorganize knowledge?</p>
        <h2>让每一个书签都可被即时理解与推荐</h2>
        <p>立即安装扩展，或约我们演示如何把 AcuityBookmarks 部署到你的团队。</p>
        <div class="hero__actions">
          <a
            :href="extensionLink"
            target="_blank"
            rel="noopener"
            class="btn primary"
            >免费安装</a
          >
          <NuxtLink to="/contact" class="btn secondary">预约演示</NuxtLink>
        </div>
        <ClientOnly>
          <SubscriptionForm />
        </ClientOnly>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import HeroShowcase from '@/components/HeroShowcase.vue'
import FeatureGallery from '@/components/FeatureGallery.vue'
import SubscriptionForm from '@/components/SubscriptionForm.vue'

const { extensionLink } = useProductLinks()

const heroHighlights = [
  'AI 向量推荐',
  '离线优先架构',
  'Cloudflare Worker API',
  'Supabase 审计与同步'
]

const stats = [
  { value: '< 650ms', label: '平均检索延迟' },
  { value: '20K+', label: '持久化书签不降速' },
  { value: '92%', label: 'AI 推荐准确率' },
  { value: '100%', label: '本地掌控的数据' }
]

const painPoints = [
  {
    badge: '检索效率',
    title: '搜索慢且无序',
    description: '默认书签管理缺乏模糊匹配与分层视图，大量收藏后几乎无法回忆。',
    solution:
      '多索引引擎：Fuse.js + 语义向量 + 标签过滤，一次输入获取上下文结果。'
  },
  {
    badge: '跨设备',
    title: '同步易丢失',
    description: '浏览器同步经常冲突，团队无法共享最新的工作台与知识结构。',
    solution: 'Chrome storage + Supabase 双写，变更日志可回放，跨设备实时一致。'
  },
  {
    badge: '知识利用率',
    title: '没有推荐与提醒',
    description: '收藏只是起点，真正的难题在于何时、在何种场景提醒你使用。',
    solution: '本地 AI Agent 理解书签语义，结合上下文推荐最合适的链接。'
  }
]

const featureMatrix = [
  {
    icon: '⚡',
    title: '极速检索',
    description: '多引擎并行：关键词、模糊匹配、向量语义同步返回。',
    bullets: [
      'Fuse.js + 自适应 ranking',
      '多语言分词 + 拼写容错',
      '书签、标签、备注统一检索'
    ]
  },
  {
    icon: '🤖',
    title: '智能推荐',
    description: '基于 embedding 的上下文推送，结合 tRPC 服务实时返回。',
    bullets: [
      '本地向量缓存 + Worker 推理',
      '自动生成书签摘要/主题',
      '推荐结果支持一键采纳'
    ]
  },
  {
    icon: '🗂️',
    title: '分层工作台',
    description: 'Popup、Management、Side Panel 三端协同，支持个性化视图。',
    bullets: [
      '虚拟滚动，2 万条依旧流畅',
      '多种排序/过滤视图',
      'Pinia Store + 持久化布局'
    ]
  },
  {
    icon: '🛰️',
    title: '自动化爬虫',
    description:
      '本地 CrawlTaskScheduler + PersistentQueue，保证离线也能批量更新元数据。',
    bullets: [
      '域名级限流 & IdleScheduling',
      '意外关闭自动恢复',
      '无感知地迭代画面截图/摘要'
    ]
  }
]

const aiWorkflow = [
  {
    step: '01',
    title: '本地语义索引',
    description: '在浏览器内生成书签摘要、embedding，并持久化到 IndexedDB。',
    detail: '无网络亦可执行，完全掌握原始数据。'
  },
  {
    step: '02',
    title: 'Cloudflare Worker 编排',
    description: '通过 tRPC + Supabase 验证请求，执行推荐、同步与审计逻辑。',
    detail: '边缘执行，延迟更低，也可一键自托管。'
  },
  {
    step: '03',
    title: '智能回传',
    description: '结合使用场景（管理页、Popup、侧边栏）返回可执行建议。',
    detail: '推荐来源透明可追溯，可随时关闭或重新训练。'
  }
]

const automationUseCases = [
  {
    title: '离线爬虫调度',
    description: 'IdleScheduler 感知用户状态，在你离开键盘时自动更新元数据。',
    chips: ['PersistentQueue', 'Chrome storage']
  },
  {
    title: '实时同步',
    description: 'Chrome API 监听 + Supabase webhook，秒级分发更新。',
    chips: ['多通道广播', '版本回滚']
  },
  {
    title: '安全可观测',
    description: 'Logger + 可视化指标，随时了解 Worker 健康状态。',
    chips: ['健康检查', 'Tail Logs']
  }
]

const architectureLayers = [
  {
    title: '体验层',
    stack: 'Vue 3 · Pinia · Vite',
    description:
      '针对 Chrome Extension 多视图优化，Popup/SidePanel/Management 一致体验。',
    points: [
      '虚拟滚动渲染 20K+ 列表',
      'VueUse Hooks 快速响应系统主题',
      'PNPM 风格工作区 + Bun 热构建'
    ]
  },
  {
    title: '领域 & 应用层',
    stack: 'DDD · App Services',
    description:
      '分离 Core Logic、Application Service、Infrastructure，易扩展、易维护。',
    points: [
      '领域事件驱动同步',
      '服务粒度清晰，便于测试',
      'AI 服务、Vectorize 服务独立解耦'
    ]
  },
  {
    title: '基础设施层',
    stack: 'Cloudflare Worker · Supabase',
    description:
      '全球边缘 API，结合向量检索、Webhook、审计日志，保证云端协作稳定可控。',
    points: [
      'tRPC fetch handler',
      'Supabase Row Level Security',
      'Wrangler 一键部署 + 观测'
    ]
  }
]

const trustSignals = [
  {
    title: '隐私优先',
    description: '核心索引存储在 Chrome storage + IndexedDB，永不离开本机。',
    detail: '仅当你主动启用云同步时，才会调用 Worker。'
  },
  {
    title: '可自托管',
    description:
      'Cloudflare Worker 代码全开源，可部署到任意账户，也可切换到自建 API。',
    detail: '提供环境变量检测与健康检查脚本。'
  },
  {
    title: '透明可观测',
    description: '日志、爬虫状态、AI 推荐来源全部可视化，方便团队审计。',
    detail: '全链路均可落盘回放。'
  }
]

const pricingPlans = [
  {
    name: '个人 · Free',
    tag: '入门',
    price: '免费',
    description: '核心检索、离线缓存、基础自动化全部开放。',
    features: [
      '无限书签与标签',
      '本地爬虫与缓存',
      'Popup / Side Panel 全量能力'
    ],
    cta: '立即下载',
    ctaLink: '/download'
  },
  {
    name: 'Pro',
    tag: '最受欢迎',
    price: '¥49 / 月',
    subline: '或 ¥499 / 年（含 2 个月赠送）',
    description: '解锁 AI 推荐、批量同步、优先支持与深色主题套件。',
    features: [
      'AI 向量推荐 + 摘要',
      '多设备 Supabase 同步',
      '自定义自动化与监控',
      '优先支持渠道'
    ],
    cta: '升级到 Pro',
    ctaLink: '/pricing',
    highlight: true
  },
  {
    name: 'Team / Enterprise',
    tag: '团队',
    price: '定制报价',
    description: '面向团队的集中管理、审计、私有化部署方案。',
    features: [
      '单点登录 & 权限控制',
      '私有 Worker / VPC 部署指导',
      '专属成功经理',
      '安全审计与培训'
    ],
    cta: '联系销售',
    ctaLink: '/contact'
  }
]

const faqs = [
  {
    question: 'AcuityBookmarks 会把我的数据上传到云端吗？',
    answer:
      '不会。所有索引与推荐都在本地执行。只有启用了可选的 Cloudflare Worker / Supabase 同步，必要字段才会被加密传输。'
  },
  {
    question: 'AI 推荐是如何训练的？',
    answer:
      '使用开源 embedding + 自定义提示词，仅基于你的本地数据生成。可以随时查看来源并删除缓存。'
  },
  {
    question: '是否支持离线工作？',
    answer: '支持。离线时仍可搜索、整理、批量归档，等到在线后再统一写回云端。'
  },
  {
    question: '团队部署复杂吗？',
    answer:
      '仅需配置 Cloudflare API Key 与 Supabase 项目，即可一键部署 Worker。我们提供脚本帮助检测依赖。'
  }
]

const resourceLinks = [
  {
    title: '构建日志与产品洞察',
    description: '深入了解设计决策、架构演进和性能优化细节。',
    label: '查看关于页面',
    to: '/about',
    tag: 'Log'
  },
  {
    title: '功能路线图',
    description: '了解我们下一步将推出的特性，并为你关心的功能投票。',
    label: '前往路线图',
    to: '/feature-request',
    tag: 'Roadmap'
  },
  {
    title: 'GitHub 开源仓库',
    description: 'Fork、提 Issue 或直接贡献代码，共建新一代书签工作台。',
    label: '访问 GitHub',
    to: 'https://github.com/ChenQiWen/acuityBookmarks',
    external: true,
    tag: 'Open Source'
  }
]

useSeoMeta({
  title: 'AcuityBookmarks · AI 驱动的智能书签工作台',
  description:
    'Fuse.js 模糊检索 × AI 语义推荐 × Cloudflare Worker API。AcuityBookmarks 为高密度知识工作者打造极速、离线、安全的书签体验。',
  ogTitle: 'AcuityBookmarks · AI 驱动的智能书签工作台',
  ogDescription:
    '结合离线索引、AI 推荐、自动化爬虫和 Cloudflare Worker，重新定义书签管理。',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image'
})
</script>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  gap: 5rem;
  padding-top: 3rem;
}

section {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding: 0 1.5rem;
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  padding-bottom: 2rem;
}

.hero__content h1 {
  font-size: clamp(2.5rem, 4vw, 3.75rem);
  line-height: 1.1;
  margin: 1rem 0;
}

.lede {
  font-size: 1.1rem;
  color: var(--text-muted);
  margin-bottom: 1.75rem;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.badge {
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.btn {
  border-radius: 999px;
  padding: 0.85rem 1.75rem;
  font-weight: 600;
  font-size: 0.95rem;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.btn.primary {
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
  box-shadow: 0 18px 45px rgba(56, 189, 248, 0.35);
}

.btn.secondary,
.btn.tertiary {
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #fff;
  background: transparent;
}

.btn.block {
  width: 100%;
  justify-content: center;
  text-align: center;
}

.btn:hover {
  transform: translateY(-2px);
}

.hero__meta {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.meta-card {
  background: rgba(15, 23, 42, 0.65);
  border-radius: var(--radius-sm);
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.meta-card .value {
  font-size: 1.5rem;
  font-weight: 700;
}

.meta-card .label {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.hero__visual {
  position: relative;
}

.feature-gallery-block {
  margin-bottom: 2rem;
}

.panel {
  background: rgba(3, 6, 17, 0.4);
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: var(--shadow-soft);
}

.panel header {
  max-width: 720px;
  margin-bottom: 2rem;
}

.eyebrow {
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: rgba(56, 189, 248, 0.7);
}

.muted {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.grid {
  display: grid;
}

.grid.three {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.grid.two {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.gap-24 {
  gap: 1.5rem;
}

.card {
  padding: 1.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.6);
}

.card h3 {
  margin: 0.75rem 0 0.5rem;
}

.card ul {
  margin-top: 1rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--text-muted);
}

.card ul li::before {
  content: '•';
  margin-right: 0.4rem;
  color: var(--accent);
}

.tag {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: rgba(56, 189, 248, 0.7);
}

.card.pain .tag {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.12);
}

.divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.2);
  margin: 1rem 0;
}

.solution {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.card.feature .emoji {
  font-size: 1.6rem;
}

.ai-section {
  width: 100%;
}

.ai-section__content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  align-items: start;
}

.ai-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.ai-list article {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.ai-list .index {
  font-size: 1.3rem;
  font-weight: 700;
  color: rgba(56, 189, 248, 0.8);
}

.architecture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.card.architecture .stack {
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(56, 189, 248, 0.7);
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.pricing-card .plan-head {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.plan-label {
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

.price {
  font-size: 2rem;
  font-weight: 700;
}

.pricing-card ul {
  margin: 1.5rem 0;
}

.pricing-card.highlight {
  border-color: rgba(56, 189, 248, 0.6);
  box-shadow: 0 25px 60px rgba(56, 189, 248, 0.2);
}

.accordion details {
  background: rgba(15, 23, 42, 0.5);
  border-radius: var(--radius-sm);
  padding: 1rem 1.25rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.accordion summary {
  cursor: pointer;
  font-weight: 600;
}

.accordion p {
  margin-top: 0.75rem;
  color: var(--text-muted);
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

.card.resource .link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 1rem;
  color: var(--accent);
}

.closing {
  width: 100%;
  padding: 4rem 1.5rem 6rem;
}

.closing__content {
  width: min(900px, 100%);
  margin: 0 auto;
  text-align: center;
  background: linear-gradient(
    120deg,
    rgba(56, 189, 248, 0.1),
    rgba(124, 58, 237, 0.08)
  );
  border-radius: var(--radius-lg);
  padding: 3rem;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.closing__content h2 {
  font-size: clamp(2rem, 3vw, 2.75rem);
  margin: 1rem 0;
}

@media (max-width: 640px) {
  .hero__actions,
  .hero__meta {
    flex-direction: column;
  }

  .panel {
    padding: 2rem 1.25rem;
  }
}
</style>
