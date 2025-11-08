<template>
  <div class="layout-default">
    <header class="header">
      <div class="container">
        <NuxtLink to="/" class="logo">
          <span>AcuityBookmarks</span>
        </NuxtLink>
        <nav class="nav">
          <NuxtLink to="/features">功能</NuxtLink>
          <NuxtLink to="/pricing">定价</NuxtLink>
          <NuxtLink to="/about">关于</NuxtLink>
          <NuxtLink to="/contact">联系</NuxtLink>
          <NuxtLink to="/feature-request">功能预约</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="main">
      <slot />
    </main>

    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section">
            <h3>AcuityBookmarks</h3>
            <p>AI 驱动的智能书签管理工具</p>
          </div>
          <div class="footer-section">
            <h4>产品</h4>
            <ul>
              <li><NuxtLink to="/features">功能</NuxtLink></li>
              <li><NuxtLink to="/pricing">定价</NuxtLink></li>
              <li><NuxtLink to="/download">下载</NuxtLink></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>支持</h4>
            <ul>
              <li><NuxtLink to="/docs">文档</NuxtLink></li>
              <li><NuxtLink to="/contact">联系我们</NuxtLink></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2025 AcuityBookmarks. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.layout-default {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
  text-decoration: none;
}

.nav {
  display: flex;
  gap: 2rem;
}

.nav a {
  color: #333;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.nav a:hover,
.nav a.router-link-active {
  color: #667eea;
}

/* Main */
.main {
  flex: 1;
}

/* Footer */
.footer {
  background: #1f2937;
  color: white;
  padding: 3rem 0 1rem;
  margin-top: auto;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.footer-section h3,
.footer-section h4 {
  margin-bottom: 1rem;
}

.footer-section ul {
  list-style: none;
  padding: 0;
}

.footer-section ul li {
  margin-bottom: 0.5rem;
}

.footer-section a {
  color: #9ca3af;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-section a:hover {
  color: white;
}

.footer-bottom {
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid #374151;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .nav {
    gap: 1rem;
    font-size: 0.9rem;
  }
}
</style>
