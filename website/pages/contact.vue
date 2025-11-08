<template>
  <div class="contact-page">
    <div class="container">
      <h1 class="page-title">联系我们</h1>
      <p class="page-subtitle">有任何问题或建议？我们很乐意听到您的声音！</p>

      <div class="contact-form-wrapper">
        <ContactForm />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '联系我们 - AcuityBookmarks',
  description: '有任何问题或建议？联系我们，我们很乐意听到您的声音！'
})
</script>

<style scoped>
.contact-page {
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

.contact-form-wrapper {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
