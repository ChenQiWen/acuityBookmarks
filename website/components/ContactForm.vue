<template>
  <form @submit.prevent="submitForm" class="contact-form">
    <div class="form-group">
      <label for="name">姓名 *</label>
      <input
        id="name"
        v-model="form.name"
        type="text"
        required
        placeholder="请输入您的姓名"
      />
    </div>

    <div class="form-group">
      <label for="email">邮箱 *</label>
      <input
        id="email"
        v-model="form.email"
        type="email"
        required
        placeholder="your@email.com"
      />
    </div>

    <div class="form-group">
      <label for="message">消息 *</label>
      <textarea
        id="message"
        v-model="form.message"
        required
        rows="6"
        placeholder="请输入您的消息..."
      ></textarea>
    </div>

    <!-- 🍯 Honeypot 字段（隐藏，机器人会填写） -->
    <input
      v-model="form.website"
      type="text"
      name="website"
      autocomplete="off"
      tabindex="-1"
      style="position: absolute; left: -9999px"
      aria-hidden="true"
    />

    <button type="submit" class="btn btn-primary" :disabled="loading">
      {{ loading ? '提交中...' : '提交' }}
    </button>

    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </form>
</template>

<script setup lang="ts">
const form = reactive({
  name: '',
  email: '',
  message: '',
  website: '' // 🍯 Honeypot 字段（隐藏）
})

const loading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const submitForm = async () => {
  loading.value = true
  message.value = ''

  try {
    const response = await $fetch('/api/contact', {
      method: 'POST',
      body: form
    })

    if (response.success) {
      message.value = response.message
      messageType.value = 'success'
      // 清空表单
      form.name = ''
      form.email = ''
      form.message = ''
      form.website = ''
    }
  } catch (error: any) {
    message.value = error.data?.message || '提交失败，请稍后重试'
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.contact-form {
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
