<template>
  <div class="download-page">
    <div class="container">
      <h1 class="page-title">下载 AcuityBookmarks</h1>
      <p class="page-subtitle">
        立即安装 Chrome 扩展，开始您的智能书签管理之旅
      </p>

      <div class="download-section">
        <div class="download-card">
          <div class="download-icon">⬇️</div>
          <h2>Chrome Web Store</h2>
          <p>从 Chrome Web Store 安装，安全可靠</p>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
          >
            前往 Chrome Web Store
          </a>
        </div>

        <div class="download-card">
          <div class="download-icon">📦</div>
          <h2>手动安装</h2>
          <p>下载 ZIP 文件，手动安装扩展</p>
          <a
            href="#"
            class="btn btn-secondary"
            @click.prevent="showManualInstall"
          >
            下载 ZIP 文件
          </a>
        </div>
      </div>

      <div class="install-steps">
        <h2>安装步骤</h2>
        <ol>
          <li>下载扩展文件</li>
          <li>打开 Chrome 浏览器，访问 chrome://extensions/</li>
          <li>开启"开发者模式"</li>
          <li>点击"加载已解压的扩展程序"</li>
          <li>选择解压后的扩展文件夹</li>
          <li>完成！开始使用 AcuityBookmarks</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '下载 - AcuityBookmarks',
  description:
    '下载并安装 AcuityBookmarks Chrome 扩展，开始您的智能书签管理之旅。'
})

const showManualInstall = () => {
  alert('手动安装功能即将上线，敬请期待！')
}
</script>

<style scoped>
.download-page {
  padding: 80px 20px;
}

.container {
  max-width: 1000px;
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

.download-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.download-card {
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.download-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.download-card h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.download-card p {
  color: #666;
  margin-bottom: 1.5rem;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
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

.install-steps {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
}

.install-steps h2 {
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  color: #333;
}

.install-steps ol {
  padding-left: 1.5rem;
  color: #666;
  line-height: 2;
}

.install-steps li {
  margin-bottom: 0.5rem;
}
</style>
