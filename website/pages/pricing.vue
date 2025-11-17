<template>
  <div class="page pricing">
    <section class="hero">
      <div>
        <p class="eyebrow">Pricing</p>
        <h1>免费入门 · 按需升级 · 支持团队私有化</h1>
        <p class="lede">
          个人用户可免费使用全部核心功能。Pro 解锁
          AI、自动同步与优先支持；Team/Enterprise 提供自托管、审计与 SLA。
        </p>
      </div>
      <div class="hero__meta">
        <div v-for="meta in metas" :key="meta.label">
          <span class="value">{{ meta.value }}</span>
          <span class="label">{{ meta.label }}</span>
        </div>
      </div>
    </section>

    <section class="panel plans">
      <div class="plans-grid">
        <article
          v-for="plan in plans"
          :key="plan.name"
          class="plan-card"
          :class="{ highlight: plan.highlight }"
        >
          <div class="head">
            <div>
              <p class="tag">{{ plan.tag }}</p>
              <h2>{{ plan.name }}</h2>
            </div>
            <p class="price">{{ plan.price }}</p>
            <p v-if="plan.caption" class="muted">{{ plan.caption }}</p>
          </div>
          <p class="desc">{{ plan.description }}</p>
          <ul>
            <li v-for="feature in plan.features" :key="feature">
              {{ feature }}
            </li>
          </ul>
          <component
            :is="plan.external ? 'a' : NuxtLink"
            :href="plan.external ? plan.link : undefined"
            :to="plan.external ? undefined : plan.link"
            class="btn"
          >
            {{ plan.cta }}
          </component>
        </article>
      </div>
    </section>

    <section class="panel compare">
      <header>
        <p class="eyebrow">细节对比</p>
        <h2>所有版本均支持离线、隐私优先；高级版拓展 AI 与团队能力</h2>
      </header>
      <div class="table">
        <div class="table__head">
          <span>Capability</span>
          <span>Free</span>
          <span>Pro</span>
          <span>Team/Enterprise</span>
        </div>
        <div v-for="row in matrix" :key="row.cap" class="table__row">
          <span>{{ row.cap }}</span>
          <span>{{ row.free }}</span>
          <span>{{ row.pro }}</span>
          <span>{{ row.team }}</span>
        </div>
      </div>
    </section>

    <section class="panel faq">
      <header>
        <p class="eyebrow">常见问题</p>
        <h2>价格、结算与部署相关疑问</h2>
      </header>
      <details v-for="item in faqs" :key="item.q">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
const metas = [
  { value: '免费', label: '个人核心功能' },
  { value: '<48h', label: 'Pro 响应时间' },
  { value: 'SLA 99.9%', label: '企业稳定性' }
]

const plans = [
  {
    name: 'Free',
    tag: '个人',
    price: '¥0 / 月',
    description: '无限使用本地核心功能，完全离线可用。',
    features: [
      '多索引检索、标签、备注',
      '本地爬虫与自动化',
      'Popup / Side Panel 全功能'
    ],
    cta: '立即下载',
    link: '/download'
  },
  {
    name: 'Pro',
    tag: '热门',
    price: '¥49 / 月',
    caption: '或 ¥499 / 年',
    description: '面向专业用户的 AI + 同步 + 支持组合拳。',
    features: [
      'AI 向量推荐 / 摘要',
      'Supabase 云同步',
      '批量自动化与监控',
      '优先支持渠道'
    ],
    cta: '升级 Pro',
    link: '/pricing',
    highlight: true
  },
  {
    name: 'Team / Enterprise',
    tag: '团队',
    price: '定制报价',
    description: '自托管 Worker、SSO、权限与审计全部打包。',
    features: [
      '私有 Cloudflare Worker',
      'Supabase RLS / SSO',
      '安全审计与培训',
      '专属成功经理'
    ],
    cta: '联系销售',
    link: '/contact'
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
    a: '可以随时取消，周期结束前仍可使用。年度订阅支持按比例退款。'
  },
  {
    q: '团队版如何部署？',
    a: '我们提供脚本检测环境，并协助将 Cloudflare Worker / Supabase 配置到你的账户。'
  },
  {
    q: '是否支持企业采购流程？',
    a: '支持。可开具发票并签署数据处理协议，请联系 sales@acuitybookmarks.com。'
  }
]

useSeoMeta({
  title: '定价 - AcuityBookmarks',
  description:
    '了解 Free、Pro、Team/Enterprise 三种方案，覆盖个人到团队的智能书签需求。'
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding: 3rem 1.5rem 5rem;
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.eyebrow {
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: rgba(56, 189, 248, 0.7);
}

.lede {
  color: var(--text-muted);
  margin-top: 1rem;
}

.hero__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.hero__meta div {
  padding: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.6);
}

.value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
}

.label {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.panel {
  background: rgba(3, 6, 17, 0.55);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(148, 163, 184, 0.12);
  padding: 3rem;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.plan-card {
  padding: 2rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.plan-card.highlight {
  border-color: rgba(56, 189, 248, 0.6);
  box-shadow: 0 25px 60px rgba(56, 189, 248, 0.2);
}

.plan-card ul {
  list-style: none;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plan-card ul li::before {
  content: '•';
  margin-right: 0.35rem;
  color: var(--accent);
}

.btn {
  border-radius: 999px;
  padding: 0.8rem 1.5rem;
  text-align: center;
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.compare .table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table__head,
.table__row {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(15, 23, 42, 0.6);
}

.table__head {
  background: rgba(56, 189, 248, 0.08);
  font-weight: 600;
}

.faq details {
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.6);
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.faq summary {
  cursor: pointer;
  font-weight: 600;
}

.faq p {
  margin-top: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .panel {
    padding: 2rem 1.25rem;
  }

  .table__head,
  .table__row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
