<template>
  <div class="page features">
    <section class="hero">
      <div class="stack">
        <p class="eyebrow">Product Features</p>
        <h1>一站式书签操作系统 · 以真实工作场景拆分 6 大能力</h1>
        <p class="lede">
          从本地检索、自动推荐到脱机爬虫调度，AcuityBookmarks 以 DDD
          架构拆分每个能力模块，可独立启用，也能组合成完整知识工作流。
        </p>
        <div class="hero__actions">
          <NuxtLink to="/download" class="btn primary">免费安装</NuxtLink>
          <NuxtLink to="/pricing" class="btn secondary">查看方案</NuxtLink>
        </div>
      </div>
      <div class="snapshot-grid">
        <article v-for="highlight in highlights" :key="highlight.title">
          <p class="tag">{{ highlight.tag }}</p>
          <h3>{{ highlight.title }}</h3>
          <p>{{ highlight.description }}</p>
        </article>
      </div>
    </section>

    <section class="panel">
      <header>
        <p class="eyebrow">核心模块</p>
        <h2>六大模块覆盖日常高频动作</h2>
        <p class="muted">
          所有模块基于统一 API / Store，可按需组合或单独启用。
        </p>
      </header>
      <div class="module-grid">
        <article v-for="module in modules" :key="module.title">
          <div class="icon">{{ module.icon }}</div>
          <h3>{{ module.title }}</h3>
          <p>{{ module.description }}</p>
          <ul>
            <li v-for="point in module.points" :key="point">{{ point }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="panel flow">
      <header>
        <p class="eyebrow">AI × 自动化</p>
        <h2>AI 语义理解 + 本地爬虫调度，构成真正可控的智能体验</h2>
      </header>
      <div class="flow-grid">
        <article v-for="flow in flows" :key="flow.title">
          <span class="index">{{ flow.step }}</span>
          <div>
            <h3>{{ flow.title }}</h3>
            <p>{{ flow.description }}</p>
            <p class="muted">{{ flow.detail }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="panel showcase">
      <header>
        <p class="eyebrow">体验视图</p>
        <h2>三套界面协同：Popup · Management · Side Panel</h2>
        <p class="muted">同一套数据模型，针对不同场景提供最快捷的操作。</p>
      </header>
      <div class="showcase-grid">
        <article v-for="view in views" :key="view.title">
          <div class="head">
            <div>
              <p class="tag">{{ view.tag }}</p>
              <h3>{{ view.title }}</h3>
            </div>
            <span class="pill">{{ view.mode }}</span>
          </div>
          <p>{{ view.description }}</p>
          <ul>
            <li v-for="item in view.points" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="panel closing">
      <div class="stack">
        <p class="eyebrow">Next</p>
        <h2>每周功能增量，路线图公开透明</h2>
        <p class="muted">
          访问路线图为新功能投票，或加入 GitHub/Discord
          直接贡献。你的反馈是我们演进的主要驱动力。
        </p>
        <div class="hero__actions">
          <NuxtLink to="/feature-request" class="btn primary"
            >查看路线图</NuxtLink
          >
          <a
            href="https://github.com/ChenQiWen/acuityBookmarks"
            target="_blank"
            rel="noopener"
            class="btn tertiary"
            >GitHub</a
          >
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const highlights = [
  {
    tag: 'AI 语义',
    title: '向量推荐可解释',
    description: '所有推荐来源可追溯，可一键查看 Summary 与 Embedding。'
  },
  {
    tag: '离线优先',
    title: '无网也能管理',
    description: '索引、摘要、操作全部在本地执行，恢复网络后再统一同步。'
  },
  {
    tag: '自动化',
    title: 'Idle Scheduler',
    description: '当你离开键盘时，自动爬取封面/摘要并更新统计。'
  }
]

const modules = [
  {
    icon: '🧠',
    title: 'AI 语义引擎',
    description: '本地生成摘要与 embedding，结合 Worker 推理返回推荐。',
    points: ['支持自定义 Prompt', '可选自托管模型', '推荐记录可回放']
  },
  {
    icon: '⚡',
    title: '多索引检索',
    description: 'Fuse.js + 标签过滤 + 备注全文检索，匹配权重可调。',
    points: ['拼写容错 / 多语言', '按权重分段显示', '快捷键一键过滤']
  },
  {
    icon: '📦',
    title: '分层工作台',
    description: 'Popup、管理台、侧边栏共享状态，响应式布局无缝切换。',
    points: ['虚拟滚动 20K+ 列表', '批量拖拽 + 多选', 'Pinia Store 持久化']
  },
  {
    icon: '🛰️',
    title: '本地爬虫',
    description: 'CrawlTaskScheduler + PersistentQueue，断网/重启后自动恢复。',
    points: ['域名级限流', 'Idle 触发', '异常自动回滚']
  },
  {
    icon: '🔐',
    title: '隐私与同步',
    description: 'Chrome storage + Supabase 双写，配合 RLS 控制访问。',
    points: ['数据加密传输', '可选自托管 Worker', '变更日志可审计']
  },
  {
    icon: '🧩',
    title: '开放接口',
    description: 'tRPC API + Router，可接入自定义工作流或知识库。',
    points: ['Webhook/事件总线', '命令面板扩展', 'Chrome Message Bridge']
  }
]

const flows = [
  {
    step: '01',
    title: '采集与理解',
    description: '书签保存 -> 本地生成摘要/embedding -> 入库 IndexedDB。',
    detail: '可配置语言、摘要长度、忽略域名等参数。'
  },
  {
    step: '02',
    title: 'Worker 推理',
    description: '向 Cloudflare Worker 请求推荐，并在 Supabase 记录审计。',
    detail: '全程加密，支持切换到私有接口。'
  },
  {
    step: '03',
    title: '自动执行',
    description: 'IdleScheduler 监控状态，批量刷新 favicon、截图、标签。',
    detail: 'PersistentQueue 避免重复执行，失败任务自动重试。'
  }
]

const views = [
  {
    tag: 'Popup',
    title: '即时搜索器',
    mode: '快速入口',
    description: '⌘B/Alt+B 唤起，输入即得推荐，适合写作/研究即时引用。',
    points: ['键盘优先交互', 'AI 推荐卡片', '快捷操作书签']
  },
  {
    tag: 'Management',
    title: '分层工作区',
    mode: '批量整理',
    description: '支持看板/表格/列表多视图，自定义分组策略满足团队协作。',
    points: ['虚拟滚动', '批量拖拽', '自定义字段']
  },
  {
    tag: 'Side Panel',
    title: '上下文助手',
    mode: '辅助研究',
    description: '在阅读页面时，侧边栏自动推荐关联书签，提供智能摘要。',
    points: ['与页面内容联动', '快速收藏/标注', '支持插件生态']
  }
]

useSeoMeta({
  title: '功能特性 - AcuityBookmarks',
  description:
    '了解 AcuityBookmarks 六大模块：AI 语义引擎、多索引检索、分层工作台、本地爬虫、同步安全与开放接口。'
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
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.eyebrow {
  letter-spacing: 0.3em;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: rgba(56, 189, 248, 0.7);
}

.lede {
  color: var(--text-muted);
  font-size: 1.05rem;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn {
  border-radius: 999px;
  padding: 0.85rem 1.75rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.btn.primary {
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
}

.btn.secondary,
.btn.tertiary {
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #fff;
}

.snapshot-grid {
  display: grid;
  gap: 1rem;
}

.snapshot-grid article {
  padding: 1.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(15, 23, 42, 0.65);
}

.tag {
  font-size: 0.8rem;
  color: rgba(56, 189, 248, 0.7);
  letter-spacing: 0.1em;
}

.panel {
  background: rgba(3, 6, 17, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: var(--radius-lg);
  padding: 3rem;
}

.panel header {
  max-width: 720px;
  margin-bottom: 2rem;
}

.muted {
  color: var(--text-muted);
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
}

.module-grid article {
  padding: 1.5rem;
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.module-grid .icon {
  font-size: 1.8rem;
}

.module-grid ul {
  list-style: none;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--text-muted);
}

.module-grid ul li::before {
  content: '•';
  margin-right: 0.35rem;
  color: var(--accent);
}

.flow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.flow-grid article {
  display: flex;
  gap: 1rem;
  border-radius: var(--radius-sm);
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.flow-grid .index {
  font-size: 1.2rem;
  font-weight: 700;
  color: rgba(56, 189, 248, 0.8);
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.showcase-grid article {
  padding: 1.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.65);
}

.showcase-grid .head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.pill {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  font-size: 0.8rem;
}

.showcase-grid ul {
  margin-top: 1rem;
  list-style: none;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.closing {
  text-align: center;
}

.closing .stack {
  align-items: center;
}

@media (max-width: 640px) {
  .panel {
    padding: 2rem 1.25rem;
  }
}
</style>
