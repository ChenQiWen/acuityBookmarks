<template>
  <div class="page feature-request">
    <section class="hero">
      <div>
        <p class="eyebrow">Roadmap & Feedback</p>
        <h1>为下一批功能投票，或提交你的想法</h1>
        <p class="lede">
          所有需求都会进入公开路线图。欢迎提供使用场景、业务背景或附上截图，帮助我们快速理解痛点。
        </p>
      </div>
      <div class="panel status">
        <h2>当前迭代</h2>
        <ul>
          <li v-for="item in statusList" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </li>
        </ul>
      </div>
    </section>

    <section class="panel request-panel">
      <div>
        <h2>提交需求</h2>
        <p class="muted">留下邮箱以便我们在需求上线后通知你。</p>
      </div>
      <form @submit.prevent="handleSubmit" class="request-form">
        <div class="form-group">
          <label for="email">邮箱 *</label>
          <input id="email" v-model="form.email" type="email" required />
        </div>
        <div class="form-group">
          <label for="feature">功能名称 *</label>
          <input id="feature" v-model="form.feature" type="text" required />
        </div>
        <div class="form-group">
          <label for="description">使用场景</label>
          <textarea
            id="description"
            v-model="form.description"
            rows="5"
            placeholder="描述为什么需要这个功能，最好附上你当前的 workaround。"
          ></textarea>
        </div>
        <input
          v-model="form.url"
          type="text"
          name="url"
          autocomplete="off"
          tabindex="-1"
          class="honeypot"
          aria-hidden="true"
        />
        <button class="btn primary" :disabled="loading">
          {{ loading ? '提交中…' : '提交需求' }}
        </button>
        <p v-if="success" class="message success">感谢你的建议！</p>
        <p v-if="error" class="message error">{{ error }}</p>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
const { loading, error, success, submitFeatureRequest } = useFeatureRequest()

const form = reactive({
  email: '',
  feature: '',
  description: '',
  url: ''
})

const handleSubmit = async () => {
  try {
    await submitFeatureRequest(form)
    form.email = ''
    form.feature = ''
    form.description = ''
  } catch (err) {
    // handled already
  }
}

const statusList = [
  { label: '本周票数最高', value: 'AI 自动标签' },
  { label: '下一版本', value: '团队权限 / SSO' },
  { label: '正在研发', value: '侧边栏上下文推荐' }
]

useSeoMeta({
  title: '新功能预约 - AcuityBookmarks',
  description: '提交或投票你想要的功能，我们会同步在路线图中显示进度。'
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

.panel {
  background: rgba(3, 6, 17, 0.55);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(148, 163, 184, 0.12);
  padding: 3rem;
}

.status ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status li {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  padding-bottom: 0.5rem;
}

.request-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.request-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group label {
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  color: var(--text-primary);
}

.form-group textarea {
  resize: vertical;
}

.btn {
  border-radius: 999px;
  padding: 0.85rem 1.75rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  align-self: flex-start;
}

.btn.primary {
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
}

.message {
  font-size: 0.95rem;
}

.message.success {
  color: #22d3ee;
}

.message.error {
  color: #f87171;
}

.honeypot {
  position: absolute;
  left: -9999px;
}

@media (max-width: 640px) {
  .panel {
    padding: 2rem 1.25rem;
  }
}
</style>
