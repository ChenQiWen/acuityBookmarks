<template>
  <div class="page download">
    <section class="hero">
      <div>
        <p class="eyebrow">Download</p>
        <h1>立即安装 AcuityBookmarks，开启智能书签体验</h1>
        <p class="lede">
          Chrome、Edge 直接安装。开发者也可本地加载 dist/ 目录，或自定义打包。
        </p>
        <div class="hero__actions">
          <a
            :href="extensionLink"
            class="btn primary"
            target="_blank"
            rel="noopener"
            >Chrome Web Store</a
          >
          <NuxtLink to="/features" class="btn secondary">查看功能</NuxtLink>
        </div>
      </div>
      <div class="panel steps">
        <h2>手动安装（开发者/内测）</h2>
        <ol>
          <li>在仓库根目录运行 <code>bun run build:frontend</code></li>
          <li>打开 <code>chrome://extensions</code>，开启开发者模式</li>
          <li>点击“加载已解压的扩展程序”，选择 <code>dist/</code></li>
        </ol>
      </div>
    </section>

    <section class="panel builds">
      <header>
        <p class="eyebrow">Release channels</p>
        <h2>多通道让你按需选择稳定或前沿版本</h2>
      </header>
      <div class="grid">
        <article v-for="build in builds" :key="build.title">
          <p class="tag">{{ build.tag }}</p>
          <h3>{{ build.title }}</h3>
          <p>{{ build.description }}</p>
          <ul>
            <li v-for="item in build.notes" :key="item">{{ item }}</li>
          </ul>
          <component
            :is="build.external ? 'a' : NuxtLink"
            :href="build.external ? build.link : undefined"
            :to="build.external ? undefined : build.link"
            class="link"
            >{{ build.linkLabel }}</component
          >
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { extensionLink } = useProductLinks()

const builds = [
  {
    tag: 'Stable',
    title: '正式版',
    description: '经过完整 QA 与 Store 审核，适合生产环境。',
    notes: ['自动更新', '包含最新 AI 功能', '支持 Chrome / Edge'],
    linkLabel: '前往商店',
    link: extensionLink,
    external: true
  },
  {
    tag: 'Beta',
    title: '内测版',
    description: '提前体验即将发布的能力，适合愿意反馈问题的用户。',
    notes: ['每周一次', '内置调试日志', '可能含实验特性'],
    linkLabel: '查看路线图',
    link: '/feature-request'
  },
  {
    tag: 'Source',
    title: '自行构建',
    description: 'Fork 项目或从 Release 下载 zip，完全掌控环境。',
    notes: ['遵循 MIT 许可', '支持 Cloudflare Worker 自托管', '欢迎提交 PR'],
    linkLabel: 'GitHub Releases',
    link: 'https://github.com/ChenQiWen/acuityBookmarks',
    external: true
  }
]

useSeoMeta({
  title: '下载 - AcuityBookmarks',
  description: '通过 Chrome Web Store 或本地构建方式安装 AcuityBookmarks。'
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
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

.hero__actions {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn {
  border-radius: 999px;
  padding: 0.85rem 1.75rem;
  font-weight: 600;
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.btn.primary {
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
}

.panel {
  background: rgba(3, 6, 17, 0.55);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(148, 163, 184, 0.12);
  padding: 3rem;
}

.steps ol {
  margin-top: 1rem;
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.steps code {
  background: rgba(15, 23, 42, 0.7);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
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

.grid ul {
  list-style: none;
  color: var(--text-muted);
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.grid ul li::before {
  content: '•';
  margin-right: 0.35rem;
  color: var(--accent);
}

.link {
  color: var(--accent);
}

@media (max-width: 640px) {
  .panel {
    padding: 2rem 1.25rem;
  }
}
</style>
