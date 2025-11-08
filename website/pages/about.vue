<template>
  <div class="about-page">
    <div class="container">
      <h1 class="page-title">关于我们</h1>

      <div class="about-content">
        <section class="about-section">
          <h2>我们的使命</h2>
          <p>
            AcuityBookmarks
            致力于帮助用户更好地管理和组织书签，让知识管理变得简单高效。我们相信，通过
            AI 技术的应用，可以让每个人都能轻松管理自己的数字知识库。
          </p>
        </section>

        <section class="about-section">
          <h2>我们的愿景</h2>
          <p>
            成为全球领先的智能书签管理工具，帮助数百万用户更好地组织和利用他们的数字知识。
          </p>
        </section>

        <section class="about-section">
          <h2>核心价值</h2>
          <ul class="values-list">
            <li><strong>用户至上</strong>：我们始终将用户体验放在首位</li>
            <li><strong>隐私安全</strong>：本地优先，保护用户数据安全</li>
            <li>
              <strong>持续创新</strong>：不断探索 AI 技术在书签管理中的应用
            </li>
            <li><strong>开放透明</strong>：与用户保持沟通，共同成长</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '关于我们 - AcuityBookmarks',
  description:
    '了解 AcuityBookmarks 的使命、愿景和核心价值。我们致力于帮助用户更好地管理和组织书签。'
})
</script>

<style scoped>
.about-page {
  padding: 80px 20px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 3rem;
  color: #333;
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.about-section h2 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: #333;
}

.about-section p {
  color: #666;
  line-height: 1.8;
  font-size: 1.1rem;
}

.values-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.values-list li {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  color: #666;
  line-height: 1.6;
}

.values-list strong {
  color: #333;
  display: block;
  margin-bottom: 0.5rem;
}
</style>
