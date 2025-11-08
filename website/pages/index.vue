<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <h1 class="hero-title">AcuityBookmarks</h1>
        <p class="hero-subtitle">
          AI 驱动的智能书签管理工具，让您的书签井然有序
        </p>
        <div class="hero-actions">
          <NuxtLink to="/download" class="btn btn-primary"> 立即下载 </NuxtLink>
          <NuxtLink to="/features" class="btn btn-secondary">
            了解更多
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="container">
        <h2 class="section-title">核心功能</h2>
        <div class="features-grid">
          <div class="feature-card">
            <h3>🤖 AI 智能分类</h3>
            <p>自动理解书签内容，智能分类整理</p>
          </div>
          <div class="feature-card">
            <h3>⚡ 高性能</h3>
            <p>支持 2 万+ 书签的流畅管理</p>
          </div>
          <div class="feature-card">
            <h3>🔒 隐私安全</h3>
            <p>本地优先，数据完全掌控在您手中</p>
          </div>
          <div class="feature-card">
            <h3>🎨 现代化界面</h3>
            <p>简洁美观的用户界面，操作直观</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="container">
        <h2>准备好开始了吗？</h2>
        <p>立即下载 AcuityBookmarks，体验智能书签管理</p>
        <NuxtLink to="/download" class="btn btn-primary btn-large">
          免费下载
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// SEO 元数据
useSeoMeta({
  title: 'AcuityBookmarks - AI 驱动的智能书签管理',
  description:
    'AcuityBookmarks 是一款基于 AI 技术的 Chrome 浏览器扩展，专为解决书签混乱、查找困难等问题而设计。',
  ogTitle: 'AcuityBookmarks - AI 驱动的智能书签管理',
  ogDescription:
    '让 AI 帮您整理书签，让知识管理更简单。支持 2 万+ 书签的流畅管理。',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image'
})
</script>

<style scoped>
.home-page {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Hero Section */
.hero {
  padding: 120px 20px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Features Section */
.features {
  padding: 80px 20px;
  background: #f8f9fa;
}

.section-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 3rem;
  color: #333;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
}

/* CTA Section */
.cta {
  padding: 80px 20px;
  text-align: center;
  background: #333;
  color: white;
}

.cta h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.cta p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: #667eea;
}

.btn-large {
  padding: 16px 32px;
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1.2rem;
  }

  .section-title {
    font-size: 2rem;
  }
}
</style>
