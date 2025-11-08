<template>
  <div class="features-page">
    <div class="container">
      <h1 class="page-title">功能特性</h1>
      <p class="page-subtitle">
        探索 AcuityBookmarks 的强大功能，让书签管理变得简单高效
      </p>

      <div class="features-list">
        <div class="feature-item">
          <div class="feature-icon">🤖</div>
          <h2>AI 智能分类</h2>
          <p>
            基于先进的 AI 技术，自动理解书签内容并智能分类。无需手动整理，让 AI
            帮您管理书签。
          </p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">⚡</div>
          <h2>高性能管理</h2>
          <p>
            采用虚拟滚动和优化的数据结构，支持 2
            万+书签的流畅管理。无论您有多少书签，都能快速响应。
          </p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🔒</div>
          <h2>隐私安全</h2>
          <p>
            本地优先架构，所有数据存储在您的设备上。AI
            处理也在本地完成，确保您的隐私安全。
          </p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🎨</div>
          <h2>现代化界面</h2>
          <p>
            简洁美观的用户界面，直观的操作体验。支持深色模式，适应您的使用习惯。
          </p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🔍</div>
          <h2>智能搜索</h2>
          <p>
            强大的搜索功能，支持关键词、标签、分类等多种搜索方式。快速找到您需要的书签。
          </p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">📊</div>
          <h2>数据统计</h2>
          <p>
            详细的书签统计信息，了解您的书签使用情况。帮助您更好地管理知识。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '功能特性 - AcuityBookmarks',
  description:
    '探索 AcuityBookmarks 的强大功能：AI 智能分类、高性能管理、隐私安全、现代化界面等。'
})
</script>

<style scoped>
.features-page {
  padding: 80px 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 1rem;
  color: #333;
}

.page-subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 3rem;
  font-size: 1.1rem;
}

.features-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-item {
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.feature-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-item h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-item p {
  color: #666;
  line-height: 1.6;
}
</style>
