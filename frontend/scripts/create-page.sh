#!/bin/bash

# 📄 创建页面脚手架
# 用法: ./scripts/create-page.sh <PageName>

set -e

PAGE_NAME=$1

if [ -z "$PAGE_NAME" ]; then
  echo "❌ 错误: 请提供页面名称"
  echo "用法: ./scripts/create-page.sh <PageName>"
  echo "示例: ./scripts/create-page.sh my-feature"
  exit 1
fi

# 转换为 PascalCase
PAGE_COMPONENT=$(echo "$PAGE_NAME" | sed -r 's/(^|-)([a-z])/\U\2/g')

DIR="frontend/src/pages/$PAGE_NAME"

# 检查目录是否已存在
if [ -d "$DIR" ]; then
  echo "❌ 页面 $PAGE_NAME 已存在！"
  exit 1
fi

mkdir -p "$DIR/components"
mkdir -p "$DIR/composables"

echo "📄 创建页面: $PAGE_NAME ($PAGE_COMPONENT)"

# ===== 创建 index.html =====
cat > "$DIR/index.html" << EOF
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${PAGE_COMPONENT}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/pages/${PAGE_NAME}/main.ts"></script>
  </body>
</html>
EOF

# ===== 创建 main.ts =====
cat > "$DIR/main.ts" << EOF
/**
 * 📄 ${PAGE_COMPONENT} 页面入口
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ${PAGE_COMPONENT} from './${PAGE_COMPONENT}.vue'

// 样式
import '@/design-system/base.css'
import '@/design-system/tokens.css'
import '@/design-system/typography.css'
import '@/design-system/material-theme.css'

const app = createApp(${PAGE_COMPONENT})
const pinia = createPinia()

app.use(pinia)

app.mount('#app')

console.log('✅ ${PAGE_COMPONENT} 页面已加载')
EOF

# ===== 创建 .vue 文件 =====
cat > "$DIR/$PAGE_COMPONENT.vue" << EOF
<!--
  📄 ${PAGE_COMPONENT} 页面
  
  功能：[描述页面功能]
  路由：/${PAGE_NAME}
-->

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 状态
const isLoading = ref(true)

// 生命周期
onMounted(async () => {
  console.log('${PAGE_COMPONENT} 页面已挂载')
  
  // 初始化逻辑
  await init()
  
  isLoading.value = false
})

// 初始化
const init = async () => {
  // 从 IndexedDB 加载数据
  // const data = await indexedDBManager.getData()
}
</script>

<template>
  <div class="${PAGE_NAME}-page">
    <div v-if="isLoading" class="loading">
      加载中...
    </div>
    
    <div v-else class="content">
      <h1>${PAGE_COMPONENT}</h1>
      <p>页面内容</p>
    </div>
  </div>
</template>

<style scoped>
.${PAGE_NAME}-page {
  padding: 20px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
EOF

# ===== 创建 types.ts =====
cat > "$DIR/types.ts" << EOF
/**
 * 📄 ${PAGE_COMPONENT} - 页面类型定义
 */

/**
 * 页面状态
 */
export interface ${PAGE_COMPONENT}State {
  isLoading: boolean
  // 其他状态
}

/**
 * 页面配置
 */
export interface ${PAGE_COMPONENT}Config {
  // 配置项
}
EOF

# ===== 创建 README.md =====
cat > "$DIR/README.md" << EOF
# ${PAGE_COMPONENT}

## 📋 功能描述

[简要描述页面的主要功能]

## 🎯 使用场景

- 场景 1：[描述]
- 场景 2：[描述]

## 🔌 路由

- **路径**: \`/${PAGE_NAME}\`
- **入口文件**: \`main.ts\`
- **HTML 模板**: \`index.html\`

## 📦 依赖组件

### 基础组件
- \`components/base/Button\` - 按钮操作
- \`components/base/Input\` - 输入控件

### 复合组件
- \`components/composite/...\` - [组件名称]

## 🏗️ 文件结构

\`\`\`
pages/${PAGE_NAME}/
├── index.html              # HTML 模板
├── main.ts                 # 入口文件
├── ${PAGE_COMPONENT}.vue   # 主组件
├── types.ts                # 类型定义
├── components/             # 页面专用组件
│   └── (待添加)
├── composables/            # 页面专用 Composables
│   └── (待添加)
└── README.md               # 本文档
\`\`\`

## 🔄 数据流

1. 页面初始化 → \`onMounted\`
2. 从 IndexedDB 读取数据 → \`indexedDBManager.getData()\`
3. 通过应用服务处理业务逻辑 → \`bookmarkAppService.method()\`
4. 更新本地状态 → \`state.value = ...\`
5. Vue 响应式更新 → 重新渲染

## 🎨 状态管理

### Store（如果需要）
- **名称**: \`use${PAGE_COMPONENT}Store\`
- **位置**: \`stores/${PAGE_NAME}-store.ts\`
- **关键状态**:
  - \`isLoading\` - 加载状态
  - [其他状态]

### 本地状态
- \`isLoading\` - 加载状态
- [列出其他本地状态]

## 🔧 配置项

无 / [列出配置项]

## 📝 注意事项

- ⚠️ 遵循单向数据流：Chrome API → IndexedDB → UI
- ⚠️ 不要直接调用 Chrome API 读取数据
- ⚠️ 监听 \`AB_EVENTS.BOOKMARKS_DB_SYNCED\` 事件来更新数据

## 🧩 页面专用组件

（在 \`components/\` 目录下创建后在此列出）

## 🔄 更新日志

### v1.0.0 ($(date +%Y-%m-%d))
- 初始版本
EOF

echo "✅ 页面 $PAGE_NAME 创建成功！"
echo "📁 位置: $DIR"
echo ""
echo "📝 下一步："
echo "  1. 编辑 $DIR/$PAGE_COMPONENT.vue 实现页面逻辑"
echo "  2. 完善 $DIR/types.ts 类型定义"
echo "  3. 在 $DIR/components/ 中创建页面专用组件"
echo "  4. 完善 $DIR/README.md 页面文档"
echo "  5. 更新 vite.config.ts 添加页面入口"
echo ""
echo "📝 Vite 配置示例："
echo "  build: {"
echo "    rollupOptions: {"
echo "      input: {"
echo "        ${PAGE_NAME}: resolve(__dirname, 'src/pages/${PAGE_NAME}/index.html')"
echo "      }"
echo "    }"
echo "  }"
echo ""
echo "📚 参考文档: 文档/项目管理/组件与页面规范化方案.md"

