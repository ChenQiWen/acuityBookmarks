<template>
  <div class="page contact">
    <section class="hero">
      <div>
        <p class="eyebrow">Contact us</p>
        <h1>我们在听，欢迎你与产品、技术团队直接对话</h1>
        <p class="lede">
          无论是合作、企业部署、Bug
          反馈还是功能建议，都可以通过下方渠道联系。我们会在 24-48h 内回复。
        </p>
        <div class="contact-meta">
          <article v-for="item in contacts" :key="item.label">
            <p class="tag">{{ item.label }}</p>
            <h3>{{ item.value }}</h3>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </div>
      <div class="panel form-panel">
        <h2>发送消息</h2>
        <p class="muted">
          填写表单后我们会通过邮件回复，若你愿意也可附上 GitHub/Slack 信息。
        </p>
        <ContactForm />
      </div>
    </section>

    <section class="panel faq">
      <header>
        <p class="eyebrow">常见问题</p>
        <h2>联系前你可能想了解</h2>
      </header>
      <details v-for="item in faqs" :key="item.q">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
const contacts = [
  {
    label: '邮箱',
    value: 'hi@acuitybookmarks.com',
    description: '适用于合作、媒体采访、企业采购相关事宜'
  },
  {
    label: '社区',
    value: 'Discord / GitHub',
    description: '在 issue 或讨论区提需求、提交 PR'
  },
  {
    label: '反馈通道',
    value: 'feature-request',
    description: '直接在路线图页面投票或添加需求'
  }
]

const faqs = [
  {
    q: '多久能得到回复？',
    a: '工作日 24h 内、周末 48h 内回复。Pro/Team 用户会优先处理。'
  },
  {
    q: '是否提供在线演示？',
    a: '可以，Team/Enterprise 用户可预约线上 Demo，我们会展示完整部署流程。'
  }
]

useSeoMeta({
  title: '联系我们 - AcuityBookmarks',
  description:
    '通过邮件、社区或表单联系 AcuityBookmarks 团队，反馈问题或探讨合作。'
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
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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
  margin: 1rem 0 2rem;
}

.contact-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.contact-meta article {
  padding: 1.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.6);
}

.tag {
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: rgba(56, 189, 248, 0.7);
}

.panel {
  background: rgba(3, 6, 17, 0.55);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(148, 163, 184, 0.12);
  padding: 2.5rem;
}

.form-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.faq details {
  border-radius: var(--radius-sm);
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.6);
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.faq summary {
  cursor: pointer;
  font-weight: 600;
}

.faq p {
  margin-top: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .panel {
    padding: 2rem 1.25rem;
  }
}
</style>
