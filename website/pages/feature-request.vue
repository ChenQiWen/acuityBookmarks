<template>
  <div class="feature-request-page">
    <div class="container">
      <h1 class="page-title">新功能预约</h1>
      <p class="page-subtitle">
        告诉我们您希望看到的新功能，我们会认真考虑您的建议！
      </p>

      <div class="form-wrapper">
        <form @submit.prevent="handleSubmit" class="feature-request-form">
          <div class="form-group">
            <label for="email">邮箱 *</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              placeholder="your@email.com"
            />
            <small>我们会通过邮件通知您功能上线情况</small>
          </div>

          <div class="form-group">
            <label for="feature">功能名称 *</label>
            <input
              id="feature"
              v-model="form.feature"
              type="text"
              required
              placeholder="例如：批量导入书签"
            />
          </div>

          <div class="form-group">
            <label for="description">功能描述（可选）</label>
            <textarea
              id="description"
              v-model="form.description"
              rows="6"
              placeholder="请详细描述这个功能的使用场景和预期效果..."
            ></textarea>
          </div>

          <!-- 🍯 Honeypot 字段（隐藏，机器人会填写） -->
          <input
            v-model="form.url"
            type="text"
            name="url"
            autocomplete="off"
            tabindex="-1"
            style="position: absolute; left: -9999px"
            aria-hidden="true"
          />

          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? '提交中...' : '提交预约' }}
          </button>

          <div v-if="success" class="message success">
            感谢您的建议！我们会认真考虑您的需求，功能上线后会通过邮件通知您。
          </div>

          <div v-if="error" class="message error">
            {{ error }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '新功能预约 - AcuityBookmarks',
  description: '告诉我们您希望看到的新功能，我们会认真考虑您的建议！'
})

const { loading, error, success, submitFeatureRequest } = useFeatureRequest()

const form = reactive({
  email: '',
  feature: '',
  description: '',
  url: '' // 🍯 Honeypot 字段（隐藏）
})

const handleSubmit = async () => {
  try {
    await submitFeatureRequest(form)
    // 清空表单
    form.email = ''
    form.feature = ''
    form.description = ''
  } catch (err) {
    // 错误已在 composable 中处理
  }
}
</script>

<style scoped>
.feature-request-page {
  padding: 80px 20px;
  min-height: 60vh;
}

.container {
  max-width: 800px;
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

.form-wrapper {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.feature-request-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-group small {
  color: #666;
  font-size: 0.875rem;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
}
</style>
