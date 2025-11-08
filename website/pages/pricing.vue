<template>
  <div class="pricing-page">
    <div class="container">
      <h1 class="page-title">定价</h1>
      <p class="page-subtitle">选择适合您的方案</p>

      <div class="pricing-cards">
        <div class="pricing-card">
          <h3>免费版</h3>
          <div class="price">
            <span class="price-amount">¥0</span>
            <span class="price-period">/月</span>
          </div>
          <ul class="features-list">
            <li>✓ 基础书签管理</li>
            <li>✓ 智能搜索</li>
            <li>✓ 本地存储</li>
            <li>✓ 基础统计</li>
          </ul>
          <NuxtLink to="/download" class="btn btn-secondary">
            立即下载
          </NuxtLink>
        </div>

        <div class="pricing-card featured">
          <div class="badge">推荐</div>
          <h3>专业版</h3>
          <div class="price">
            <span class="price-amount">¥29</span>
            <span class="price-period">/月</span>
          </div>
          <ul class="features-list">
            <li>✓ 所有免费版功能</li>
            <li>✓ AI 智能分类</li>
            <li>✓ 高级搜索</li>
            <li>✓ 云端同步</li>
            <li>✓ 优先支持</li>
          </ul>
          <NuxtLink to="/download" class="btn btn-primary"> 开始使用 </NuxtLink>
        </div>

        <div class="pricing-card">
          <h3>企业版</h3>
          <div class="price">
            <span class="price-amount">定制</span>
          </div>
          <ul class="features-list">
            <li>✓ 所有专业版功能</li>
            <li>✓ 团队协作</li>
            <li>✓ 自定义集成</li>
            <li>✓ 专属支持</li>
            <li>✓ SLA 保障</li>
          </ul>
          <NuxtLink to="/contact" class="btn btn-secondary">
            联系销售
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '定价 - AcuityBookmarks',
  description: '选择适合您的 AcuityBookmarks 方案：免费版、专业版、企业版。'
})
</script>

<style scoped>
.pricing-page {
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

.pricing-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.pricing-card {
  position: relative;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.pricing-card.featured {
  border: 2px solid #667eea;
  transform: scale(1.05);
}

.badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.pricing-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.price {
  margin-bottom: 2rem;
}

.price-amount {
  font-size: 2.5rem;
  font-weight: 700;
  color: #667eea;
}

.price-period {
  font-size: 1rem;
  color: #666;
  margin-left: 0.5rem;
}

.features-list {
  list-style: none;
  padding: 0;
  margin-bottom: 2rem;
  text-align: left;
}

.features-list li {
  padding: 0.75rem 0;
  color: #666;
  border-bottom: 1px solid #f0f0f0;
}

.features-list li:last-child {
  border-bottom: none;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  width: 100%;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f3f4f6;
  color: #333;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 768px) {
  .pricing-card.featured {
    transform: scale(1);
  }
}
</style>
