<template>
  <div class="page about">
    <section class="hero">
      <div>
        <p class="eyebrow">AcuityBookmarks Team</p>
        <h1>我们是一支相信「知识应即时可达」的工程团队</h1>
        <p class="lede">
          项目始于开源社区，现已遍布北京 / 上海 / 新加坡 /
          温哥华。我们热衷于打造真正帮助知识工作者的工具，也欢迎你一起共建。
        </p>
      </div>
      <div class="stats">
        <article v-for="stat in stats" :key="stat.label">
          <span class="value">{{ stat.value }}</span>
          <span class="label">{{ stat.label }}</span>
        </article>
      </div>
    </section>

    <section class="panel mission">
      <header>
        <p class="eyebrow">使命 & 价值观</p>
        <h2>让书签成为知识网络的入口</h2>
      </header>
      <div class="grid">
        <article v-for="value in values" :key="value.title">
          <h3>{{ value.title }}</h3>
          <p>{{ value.description }}</p>
        </article>
      </div>
    </section>

    <section class="panel roadmap">
      <header>
        <p class="eyebrow">路线图速览</p>
        <h2>公开透明的版本计划</h2>
      </header>
      <div class="timeline">
        <article v-for="item in roadmap" :key="item.title">
          <span class="quarter">{{ item.quarter }}</span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
        </article>
      </div>
      <NuxtLink to="/feature-request" class="btn secondary"
        >前往路线图</NuxtLink
      >
    </section>

    <section class="panel join">
      <div>
        <p class="eyebrow">Join us</p>
        <h2>与我们一起定义下一代知识工具</h2>
        <p class="muted">
          正在寻找对浏览器扩展、AI、云边计算充满热情的合作者。欢迎在 GitHub 发起
          Issue 或发送邮件介绍你的想法。
        </p>
      </div>
      <div class="actions">
        <a
          href="https://github.com/ChenQiWen/acuityBookmarks"
          class="btn primary"
          target="_blank"
          rel="noopener"
          >GitHub</a
        >
        <NuxtLink to="/contact" class="btn secondary">联系团队</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const stats = [
  { value: '12+', label: '核心贡献者' },
  { value: '40+', label: '社区 Pull Requests' },
  { value: '2019', label: '最早原型年份' }
]

const values = [
  {
    title: '用户至上',
    description: '定期与核心用户共创，路线图公开透明，投票即可影响排期。'
  },
  {
    title: '隐私优先',
    description: '所有设计都以本地掌控为前提，云端只是可选协作能力。'
  },
  {
    title: '持续打磨',
    description: '每周小版本，保持稳定迭代和性能改善。'
  },
  {
    title: '开放共建',
    description: '欢迎 fork、提 issue、写文档，我们乐于帮助你贡献第一行代码。'
  }
]

const roadmap = [
  {
    quarter: '2025 Q1',
    title: 'AI 多模态推荐',
    description: '引入图像/音频上下文理解，提升侧边栏推荐准确度。'
  },
  {
    quarter: '2025 Q2',
    title: '团队权限 & 审计',
    description: '支持 SSO、空间权限、操作日志，方便企业部署。'
  },
  {
    quarter: '2025 Q3',
    title: '生态开放',
    description: '开放命令面板与事件 API，允许第三方扩展任务流。'
  }
]

useSeoMeta({
  title: '关于我们 - AcuityBookmarks',
  description: '认识 AcuityBookmarks 团队：使命、价值观、路线图与加入方式。'
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
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.stats article {
  padding: 1.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.6);
}

.value {
  font-size: 1.8rem;
  font-weight: 700;
}

.label {
  display: block;
  color: var(--text-muted);
}

.panel {
  background: rgba(3, 6, 17, 0.55);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(148, 163, 184, 0.12);
  padding: 3rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
}

.grid article {
  padding: 1.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.6);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0 2rem;
}

.timeline article {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.6);
}

.quarter {
  font-weight: 600;
  color: rgba(56, 189, 248, 0.8);
}

.btn {
  border-radius: 999px;
  padding: 0.8rem 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  text-align: center;
}

.btn.primary {
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
}

.btn.secondary {
  color: #fff;
}

.join {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .panel {
    padding: 2rem 1.25rem;
  }
}
</style>
