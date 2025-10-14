<template>
  <div class="component-showcase">
    <header class="showcase-header">
      <h1>🧩 AcuityBookmarks 组件库</h1>
      <p>组件展示和测试页面</p>
    </header>

    <main class="showcase-content">
      <!-- 基础UI组件 -->
      <section class="component-section">
        <h2>🎨 基础UI组件</h2>

        <!-- Button 组件 -->
        <div class="component-demo">
          <h3>Button 按钮</h3>
          <div class="demo-grid">
            <Button variant="primary">主要按钮</Button>
            <Button variant="secondary">次要按钮</Button>
            <Button variant="outline">轮廓按钮</Button>
            <Button variant="ghost">幽灵按钮</Button>
            <Button variant="text">文本按钮</Button>
            <Button :loading="true">加载中</Button>
            <Button :disabled="true">禁用状态</Button>
          </div>
        </div>

        <!-- Icon 组件 -->
        <div class="component-demo">
          <h3>Icon 图标</h3>
          <div class="demo-grid">
            <Icon name="mdi-home" />
            <Icon name="mdi-star" color="primary" />
            <Icon name="mdi-heart" color="error" />
            <Icon name="mdi-check" color="success" />
            <Icon name="mdi-alert" color="warning" />
            <Icon name="mdi-loading" spin />
            <Icon name="emoji:😊" />
          </div>
        </div>

        <!-- Card 组件 -->
        <div class="component-demo">
          <h3>Card 卡片</h3>
          <div class="demo-grid">
            <Card title="基础卡片" subtitle="这是一个基础卡片">
              <p>卡片内容</p>
            </Card>
            <Card title="带图标" icon="mdi-star" icon-color="primary">
              <p>带图标的卡片</p>
            </Card>
            <Card title="可点击" clickable @click="handleCardClick">
              <p>点击我试试</p>
            </Card>
          </div>
        </div>

        <!-- Input 组件 -->
        <div class="component-demo">
          <h3>Input 输入框</h3>
          <div class="demo-grid">
            <Input v-model="inputValue" placeholder="请输入内容" />
            <Input
              v-model="inputValue2"
              label="带标签"
              placeholder="请输入内容"
            />
            <Input
              v-model="inputValue3"
              type="password"
              placeholder="密码输入"
            />
            <Input
              v-model="inputValue4"
              :error="true"
              error-message="输入有误"
            />
            <Input
              v-model="inputValue5"
              :loading="true"
              placeholder="加载中..."
            />
          </div>
        </div>

        <!-- Spinner 组件 -->
        <div class="component-demo">
          <h3>Spinner 加载器</h3>
          <div class="demo-grid">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner color="primary" />
            <Spinner color="success" />
          </div>
        </div>

        <!-- Badge 组件 -->
        <div class="component-demo">
          <h3>Badge 徽章</h3>
          <div class="demo-grid">
            <Badge>默认</Badge>
            <Badge color="primary">主要</Badge>
            <Badge color="success">成功</Badge>
            <Badge color="warning">警告</Badge>
            <Badge color="error">错误</Badge>
            <Badge :count="5">通知</Badge>
          </div>
        </div>

        <!-- Chip 组件 -->
        <div class="component-demo">
          <h3>Chip 标签</h3>
          <div class="demo-grid">
            <Chip>默认标签</Chip>
            <Chip color="primary">主要标签</Chip>
            <Chip color="success">成功标签</Chip>
            <Chip closable @close="handleChipClose">可关闭</Chip>
          </div>
        </div>

        <!-- Switch 组件 -->
        <div class="component-demo">
          <h3>Switch 开关</h3>
          <div class="demo-grid">
            <Switch v-model="switchValue1" />
            <Switch v-model="switchValue2" :disabled="true" />
            <Switch v-model="switchValue3" color="primary" />
          </div>
        </div>

        <!-- Checkbox 组件 -->
        <div class="component-demo">
          <h3>Checkbox 复选框</h3>
          <div class="demo-grid">
            <Checkbox v-model="checkboxValue1" />
            <Checkbox v-model="checkboxValue2" :disabled="true" />
            <Checkbox v-model="checkboxValue3" color="primary" />
          </div>
        </div>
      </section>

      <!-- 复合组件 -->
      <section class="component-section">
        <h2>🔧 复合组件</h2>

        <!-- PanelInlineSearch 组件 -->
        <div class="component-demo">
          <h3>PanelInlineSearch 内联搜索</h3>
          <div class="demo-container">
            <PanelInlineSearch
              v-model="searchValue"
              :open="searchOpen"
              placeholder="搜索书签..."
              @update:open="searchOpen = $event"
            />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  Button,
  Icon,
  Card,
  Input,
  Spinner,
  Badge,
  Chip,
  Switch,
  Checkbox,
  PanelInlineSearch
} from '@/components'

// 响应式数据
const inputValue = ref('')
const inputValue2 = ref('')
const inputValue3 = ref('')
const inputValue4 = ref('')
const inputValue5 = ref('')

const switchValue1 = ref(false)
const switchValue2 = ref(true)
const switchValue3 = ref(false)

const checkboxValue1 = ref(false)
const checkboxValue2 = ref(true)
const checkboxValue3 = ref(false)

const searchValue = ref('')
const searchOpen = ref(false)

// 事件处理
const handleCardClick = () => {
  console.log('卡片被点击了')
}

const handleChipClose = () => {
  console.log('标签被关闭了')
}
</script>

<style scoped>
.component-showcase {
  min-height: 100vh;
  background: #f5f5f5;
}

.showcase-header {
  background: white;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.showcase-header h1 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 2.5rem;
}

.showcase-header p {
  margin: 0;
  color: #666;
  font-size: 1.1rem;
}

.showcase-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem 2rem;
}

.component-section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.component-section h2 {
  margin: 0 0 2rem 0;
  color: #333;
  font-size: 1.8rem;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.component-demo {
  margin-bottom: 3rem;
}

.component-demo h3 {
  margin: 0 0 1rem 0;
  color: #555;
  font-size: 1.3rem;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

.demo-container {
  max-width: 400px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .showcase-content {
    padding: 0 1rem 1rem;
  }

  .component-section {
    padding: 1rem;
  }

  .demo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
