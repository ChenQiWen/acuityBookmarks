<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Icon from '@/components/base/Icon/Icon.vue'

interface Step {
  id: string
  title: string
  subtitle?: string
  description: string
  visual: 'hero' | 'sync' | 'search' | 'omnibox' | 'complete'
  showAction?: boolean
}

const steps: Step[] = [
  {
    id: 'welcome',
    title: '欢迎使用 AcuityBookmarks',
    subtitle: 'AI-POWERED BOOKMARK MANAGER',
    description: '让 AI 赋能你的书签管理，告别混乱的收藏夹。接下来，我们将带你了解 AcuityBookmarks 的核心特色。',
    visual: 'hero',
    showAction: true
  },
  {
    id: 'performance',
    title: 'Lightning Fast, Even with Thousands',
    subtitle: 'OPTIMIZED FOR SCALE',
    description: '精心优化的架构和算法，无论你有 1000 还是 10000+ 书签，都能瞬间响应。流畅交互，简洁设计，专为大数据量打造。',
    visual: 'hero',
    showAction: true
  },
  {
    id: 'ai-powered',
    title: 'AI 赋能你的书签管理',
    subtitle: 'INTELLIGENT ORGANIZATION',
    description: '语义化搜索：用自然语言找到真正想要的内容。AI 一键整理：智能归类混乱的书签目录。自动分类：新增书签自动归入合适文件夹。',
    visual: 'search',
    showAction: true
  },
  {
    id: 'omnibox',
    title: '地址栏直达，无缝体验',
    subtitle: 'SEAMLESS INTEGRATION',
    description: '输入 "ab" + 空格，直接在地址栏搜索书签。无需打开插件面板，搜索、访问一气呵成。让书签管理融入你的日常工作流。',
    visual: 'omnibox',
    showAction: true
  },
  {
    id: 'privacy',
    title: '隐私至上，数据本地化',
    subtitle: 'PRIVACY FIRST',
    description: '核心功能完全在本地执行，你的书签数据永不上传服务器。索引构建、AI 分析、搜索查询，全部在你的设备上完成。',
    visual: 'sync',
    showAction: true
  },
  {
    id: 'ready',
    title: '一切就绪！',
    subtitle: 'ALL SET',
    description: '感谢你花时间了解 AcuityBookmarks 的特色功能。点击"开始使用"后，本页面将自动关闭，你可以立即开始享受智能书签管理体验。',
    visual: 'complete',
    showAction: true
  }
]

const currentStepIndex = ref(0)
const progress = ref(0)
const progressMessage = ref('Initializing...')
const isSyncing = ref(true)
const isCompleted = ref(false)

const currentStep = computed(() => steps[currentStepIndex.value])
const isLast = computed(() => currentStepIndex.value === steps.length - 1)

function nextStep() {
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++
  } else {
    window.close()
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messageListener = (message: any) => {
  if (message.type === 'acuity-bookmarks-sync-progress') {
    progress.value = message.data.percentage
    progressMessage.value = message.data.message
    
    if (message.data.phase === 'completed') {
      completeSync()
    }
  } else if (message.type === 'acuity-bookmarks-db-ready') {
    completeSync()
  }
}

function completeSync() {
  if (!isCompleted.value) {
    isSyncing.value = false
    isCompleted.value = true
    progress.value = 100
    progressMessage.value = 'Ready'
  }
}

onMounted(() => {
  // 检查 Chrome API 是否可用
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(messageListener)
    
    if (chrome.storage?.local) {
      chrome.storage.local.get(['AB_INITIALIZED'], (result) => {
        if (result.AB_INITIALIZED) {
          completeSync()
        }
      })
    }
  } else {
    // 非扩展环境：模拟开发/演示模式
    console.warn('Chrome Extension APIs not available. Running in demo mode.')
    // 模拟进度
    let currentProgress = 0
    const interval = setInterval(() => {
      currentProgress += 10
      progress.value = currentProgress
      progressMessage.value = `Processing... ${currentProgress}%`
      
      if (currentProgress >= 100) {
        clearInterval(interval)
        completeSync()
      }
    }, 300)
  }
})

onUnmounted(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.removeListener(messageListener)
  }
})
</script>

<template>
  <div class="onboarding-container">
    <!-- Header -->
    <header class="onboarding-header">
      <div class="logo-container">
        <img
          src="/logo.png"
          alt="AcuityBookmarks Logo"
          class="logo-icon"
        />
        <span class="logo-text">AcuityBookmarks</span>
      </div>
      
    </header>

    <!-- Main Content -->
    <main class="onboarding-main">
      <Transition name="fade" mode="out-in">
        <div :key="currentStep.id" class="step-content">
          
          <!-- Visual Area -->
          <div class="visual-area">
            <!-- Hero Visual -->
            <div v-if="currentStep.visual === 'hero'" class="visual-hero">
              <div class="hero-glow"></div>
              <div class="hero-icon">
                <img src="/logo.png" alt="AcuityBookmarks" class="hero-logo" />
              </div>
            </div>

            <!-- Sync Progress -->
            <div v-else-if="currentStep.visual === 'sync'" class="visual-sync">
              <div class="progress-circle">
                <svg class="progress-ring" viewBox="0 0 120 120">
                  <circle class="progress-ring__background" cx="60" cy="60" r="54" />
                  <circle 
                    class="progress-ring__progress" 
                    cx="60" 
                    cy="60" 
                    r="54"
                    :style="{ strokeDashoffset: 339.29 * (1 - progress / 100) }"
                  />
                </svg>
                <div class="progress-text">
                  <div class="progress-percentage">{{ Math.round(progress) }}%</div>
                  <div class="progress-label">Synced</div>
                </div>
              </div>
              <div class="sync-status">
                <span :class="['status-dot', { 'status-dot--active': isSyncing }]"></span>
                <span class="status-message">{{ progressMessage }}</span>
              </div>
            </div>

            <!-- Search Mockup -->
            <div v-else-if="currentStep.visual === 'search'" class="visual-search">
              <div class="search-box">
                <Icon name="icon-search" size="sm" />
                <span class="search-placeholder">"design resources"</span>
              </div>
              <div class="search-results">
                <div class="result-item">
                  <div class="result-icon" style="background: var(--color-primary-100)">
                    <span style="color: var(--color-primary)">F</span>
                  </div>
                  <div class="result-content">
                    <div class="result-title"></div>
                    <div class="result-url"></div>
                  </div>
                </div>
                <div class="result-item">
                  <div class="result-icon" style="background: var(--color-warning-container)">
                    <span style="color: var(--color-warning)">D</span>
                  </div>
                  <div class="result-content">
                    <div class="result-title" style="width: 60%"></div>
                    <div class="result-url" style="width: 45%"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Omnibox Visual -->
            <div v-else-if="currentStep.visual === 'omnibox'" class="visual-omnibox">
              <div class="omnibox-bar">
                <div class="omnibox-icon">
                  <Icon name="icon-search" size="sm" />
                </div>
                <div class="omnibox-input">
                  <span class="omnibox-keyword">ab</span>
                  <span class="omnibox-query">设计资源</span>
                </div>
              </div>
              <div class="omnibox-results">
                <div class="omnibox-result omnibox-result--active">
                  <Icon name="icon-bookmark" size="sm" />
                  <div class="omnibox-result-text">
                    <div class="omnibox-result-title">Figma Design Resources</div>
                    <div class="omnibox-result-url">figma.com/resources</div>
                  </div>
                </div>
                <div class="omnibox-result">
                  <Icon name="icon-bookmark" size="sm" />
                  <div class="omnibox-result-text">
                    <div class="omnibox-result-title">Design Systems Database</div>
                    <div class="omnibox-result-url">designsystems.com</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Complete Visual -->
            <div v-else-if="currentStep.visual === 'complete'" class="visual-complete">
              <div class="complete-icon">
                <Icon name="icon-check" size="xl" />
              </div>
            </div>
          </div>

          <!-- Text Content -->
          <div class="text-content">
            <div v-if="currentStep.subtitle" class="step-label">
              {{ currentStep.subtitle }}
            </div>
            <h1 class="step-title">{{ currentStep.title }}</h1>
            <p class="step-description">{{ currentStep.description }}</p>

            <div v-if="currentStep.showAction" class="action-area">
              <button 
                class="action-button"
                @click="nextStep"
              >
                {{ isLast ? '开始使用' : '下一步' }}
                <Icon name="icon-arrow-right" size="sm" />
              </button>
            </div>
          </div>

        </div>
      </Transition>
    </main>

    <!-- Footer Navigation -->
    <footer class="onboarding-footer">
      <div class="progress-dots">
        <button
          v-for="(_, idx) in steps"
          :key="idx"
          :class="['dot', { 'dot--active': currentStepIndex === idx }]"
          @click="currentStepIndex = idx"
        ></button>
      </div>
    </footer>
  </div>
</template>

<style scoped>


@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }

  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

@keyframes float {
  0%,
  100% {
    transform: rotate(3deg) translateY(0);
  }

  50% {
    transform: rotate(3deg) translateY(-10px);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0);
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Responsive */
@media (width <= 768px) {
  .onboarding-header,
  .onboarding-footer {
    padding: var(--space-4) var(--space-6);
  }

  .onboarding-main {
    padding: var(--space-6);
  }

  .step-title {
    font-size: var(--font-size-3xl);
  }

  .step-description {
    font-size: var(--font-size-base);
  }
}

.onboarding-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  background: var(--color-background);
  overflow: hidden;
}

/* Header */
.onboarding-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-lg);
  object-fit: contain;
}

.logo-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
}


/* Main Content */
.onboarding-main {
  position: relative;
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: var(--space-8);
}

.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-10);
  width: 100%;
  max-width: 800px;
  text-align: center;
}

/* Visual Area */
.visual-area {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 400px;
  min-height: 300px;
}

/* Hero Visual */
.visual-hero {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-primary-alpha-20) 0%, transparent 70%);
  animation: pulse 3s ease-in-out infinite;
  filter: blur(40px);
}

.hero-icon {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-xl);
  color: var(--color-primary-foreground);
  background: var(--color-primary);
  transform: rotate(3deg);
  animation: float 3s ease-in-out infinite;
  box-shadow: 0 20px 60px var(--color-primary-alpha-20);
}

.hero-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

/* Sync Visual */
.visual-sync {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.progress-circle {
  position: relative;
  width: 160px;
  height: 160px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring__background {
  fill: none;
  stroke: var(--color-surface-container-high);
  stroke-width: 8;
}

.progress-ring__progress {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 339.29;
  transition: stroke-dashoffset 0.5s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  text-align: center;
  transform: translate(-50%, -50%);
}

.progress-percentage {
  margin-bottom: var(--space-1);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.progress-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  background: var(--color-surface-container);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}

.status-dot--active {
  background: var(--color-primary);
  animation: pulse-dot 2s ease-in-out infinite;
}

.status-message {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* Search Visual */
.visual-search {
  width: 100%;
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-container);
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 5%);
}

.search-placeholder {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-base);
  background: var(--color-surface);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.result-item:hover {
  background: var(--color-surface-hover);
}

.result-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-base);
  font-weight: var(--font-weight-bold);
}

.result-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-2);
}

.result-title {
  width: 40%;
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-text-primary);
}

.result-url {
  width: 60%;
  height: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-text-tertiary);
}

/* Omnibox Visual */
.visual-omnibox {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 520px;
}

.omnibox-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: 0 8px 24px var(--color-primary-alpha-20);
}

.omnibox-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
}

.omnibox-input {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
}

.omnibox-keyword {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  background: var(--color-primary-container);
}

.omnibox-query {
  color: var(--color-text-primary);
}

.omnibox-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 8px 16px var(--color-shadow-md);
}

.omnibox-result {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.omnibox-result:hover {
  background: var(--color-surface-hover);
}

.omnibox-result--active {
  background: var(--color-primary-container);
}

.omnibox-result-text {
  flex: 1;
  min-width: 0;
}

.omnibox-result-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.omnibox-result-url {
  font-size: var(--font-size-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Complete Visual */
.visual-complete {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  color: var(--color-on-success);
  background: var(--color-success);
  animation: bounce-in 0.6s ease-out;
  box-shadow: 0 20px 60px var(--color-success-alpha-10);
}

/* Text Content */
.text-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.step-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
}

.step-title {
  max-width: 600px;
  margin: 0;
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.step-description {
  max-width: 500px;
  margin: 0;
  font-size: var(--font-size-lg);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.action-area {
  margin-top: var(--space-4);
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-8);
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary-foreground);
  background: var(--color-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 12px var(--color-primary-alpha-20);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
  box-shadow: 0 6px 20px var(--color-primary-alpha-20);
  /* stylelint-disable-next-line acuity/no-motion-on-interaction */
  transform: translateY(-2px);
}

.action-button:active:not(:disabled) {
  /* stylelint-disable-next-line acuity/no-motion-on-interaction */
  transform: translateY(0);
}

/* Footer */
.onboarding-footer {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-6) var(--space-8);
}

.progress-dots {
  display: flex;
  gap: var(--space-3);
}

.dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-surface-container-high);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dot--active {
  width: 32px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Container */
</style>
