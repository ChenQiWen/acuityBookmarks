<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="container">
        <NuxtLink to="/" class="brand">
          <span class="brand-mark">Acuity</span>
          <span class="brand-copy">
            <strong>Bookmarks</strong>
            <small>Intelligent Bookmark OS</small>
          </span>
        </NuxtLink>
        <nav class="primary-nav">
          <NuxtLink v-for="link in navLinks" :key="link.label" :to="link.to">
            {{ link.label }}
          </NuxtLink>
        </nav>
        <div class="header-cta">
          <NuxtLink to="/download" class="btn ghost">立即体验</NuxtLink>
          <a
            :href="extensionLink"
            class="btn solid"
            rel="noopener"
            target="_blank"
          >
            添加到 Chrome
          </a>
        </div>
      </div>
    </header>

    <main class="site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-brand">
            <div class="footer-logo">AcuityBookmarks</div>
            <p>
              AI
              驱动的智能书签工作台，帮助高密度信息工作者在任何设备、任何网络环境下快速找到灵感与知识。
            </p>
            <div class="footer-actions">
              <NuxtLink to="/about" class="pill">了解团队</NuxtLink>
              <NuxtLink to="/feature-request" class="pill">提交需求</NuxtLink>
            </div>
          </div>
          <div class="footer-columns">
            <div
              v-for="group in footerGroups"
              :key="group.title"
              class="footer-column"
            >
              <h4>{{ group.title }}</h4>
              <ul>
                <li v-for="item in group.links" :key="item.label">
                  <a
                    v-if="item.external"
                    :href="item.to"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ item.label }}
                  </a>
                  <NuxtLink v-else :to="item.to">{{ item.label }}</NuxtLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© {{ copyrightYear }} AcuityBookmarks. All rights reserved.</p>
          <div class="footer-links">
            <NuxtLink to="/privacy">隐私政策</NuxtLink>
            <NuxtLink to="/terms">使用条款</NuxtLink>
            <a
              href="https://github.com/ChenQiWen/acuityBookmarks"
              target="_blank"
              rel="noopener"
              >GitHub</a
            >
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { extensionLink } = useProductLinks()
const copyrightYear = new Date().getFullYear()

const navLinks = [
  { label: '产品亮点', to: '/#capabilities' },
  { label: 'AI 能力', to: '/#ai' },
  { label: '性能架构', to: '/#architecture' },
  { label: '信任 & 安全', to: '/#trust' },
  { label: '定价', to: '/pricing' },
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

<style scoped>
.site-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding: 0 1.5rem;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(18px);
  background: rgba(3, 6, 17, 0.75);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.site-header .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 84px;
  gap: 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #fff;
}

.brand-mark {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  font-size: 0.95rem;
  font-weight: 600;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.brand-copy strong {
  font-size: 1rem;
  letter-spacing: 0;
  color: var(--text-primary);
}

.primary-nav {
  display: flex;
  gap: 1.2rem;
  font-size: 0.95rem;
}

.primary-nav a {
  color: var(--text-muted);
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.primary-nav a.router-link-active,
.primary-nav a:hover {
  color: #fff;
  background: rgba(56, 189, 248, 0.12);
}

.header-cta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn {
  border-radius: 999px;
  padding: 0.65rem 1.4rem;
  font-weight: 600;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  font-size: 0.95rem;
}

.btn.ghost {
  background: transparent;
  color: #fff;
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.btn.solid {
  background: linear-gradient(120deg, #38bdf8, #6366f1);
  color: #050f1f;
  box-shadow: 0 10px 30px rgba(56, 189, 248, 0.35);
}

.btn:hover {
  transform: translateY(-2px);
}

.site-main {
  flex: 1;
}

.site-footer {
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(3, 6, 17, 0.9);
  margin-top: 6rem;
  padding: 4rem 0 2rem;
}

.footer-top {
  display: flex;
  gap: 3rem;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 2.5rem;
}

.footer-brand {
  max-width: 320px;
}

.footer-brand p {
  color: var(--text-muted);
  margin-top: 0.75rem;
  font-size: 0.95rem;
}

.footer-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.pill {
  padding: 0.4rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.footer-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1.5rem;
  flex: 1;
}

.footer-column h4 {
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.footer-column ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-column a {
  color: #fff;
  font-size: 0.95rem;
  opacity: 0.8;
}

.footer-column a:hover {
  opacity: 1;
}

.footer-bottom {
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  padding-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.footer-links {
  display: flex;
  gap: 1.25rem;
}

.footer-links a {
  color: var(--text-muted);
}

@media (max-width: 1024px) {
  .site-header .container {
    flex-wrap: wrap;
  }

  .primary-nav {
    flex-wrap: wrap;
    justify-content: center;
  }

  .header-cta {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .site-header .container {
    flex-direction: column;
    align-items: flex-start;
  }

  .primary-nav,
  .header-cta {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
