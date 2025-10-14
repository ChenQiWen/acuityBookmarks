#!/bin/bash

# 🎨 创建基础 UI 组件脚手架
# 用法: ./scripts/create-base-component.sh <ComponentName>

set -e

COMPONENT_NAME=$1

if [ -z "$COMPONENT_NAME" ]; then
  echo "❌ 错误: 请提供组件名称"
  echo "用法: ./scripts/create-base-component.sh <ComponentName>"
  echo "示例: ./scripts/create-base-component.sh MyButton"
  exit 1
fi

# 转换为小写用于 CSS 类名
COMPONENT_CLASS=$(echo "$COMPONENT_NAME" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')

DIR="frontend/src/components/base/$COMPONENT_NAME"

# 检查目录是否已存在
if [ -d "$DIR" ]; then
  echo "❌ 组件 $COMPONENT_NAME 已存在！"
  exit 1
fi

mkdir -p "$DIR"

echo "🎨 创建基础组件: $COMPONENT_NAME"

# ===== 创建 .vue 文件 =====
cat > "$DIR/$COMPONENT_NAME.vue" << EOF
<!--
  📦 $COMPONENT_NAME
  
  功能：[描述组件功能]
  分类：基础 UI 组件
  依赖：无
-->

<script setup lang="ts">
import type { ${COMPONENT_NAME}Props, ${COMPONENT_NAME}Emits } from './${COMPONENT_NAME}.types'

const props = withDefaults(defineProps<${COMPONENT_NAME}Props>(), {
  // 设置默认值
})

const emit = defineEmits<${COMPONENT_NAME}Emits>()

// 组件逻辑
</script>

<template>
  <div class="$COMPONENT_CLASS">
    <!-- 组件内容 -->
    <slot />
  </div>
</template>

<style scoped>
.$COMPONENT_CLASS {
  /* 组件样式 */
}
</style>
EOF

# ===== 创建 .types.ts 文件 =====
cat > "$DIR/$COMPONENT_NAME.types.ts" << EOF
/**
 * 📦 $COMPONENT_NAME - 类型定义
 */

/**
 * 组件 Props
 */
export interface ${COMPONENT_NAME}Props {
  /**
   * [属性描述]
   * @default ''
   */
  // propName?: string
}

/**
 * 组件 Emits
 */
export interface ${COMPONENT_NAME}Emits {
  /**
   * [事件描述]
   * @param value - [参数描述]
   */
  // (event: 'eventName', value: string): void
}

/**
 * 组件暴露的方法（通过 defineExpose）
 */
export interface ${COMPONENT_NAME}Expose {
  /**
   * [方法描述]
   */
  // methodName: () => void
}
EOF

# ===== 创建 README.md =====
cat > "$DIR/README.md" << EOF
# $COMPONENT_NAME

## 📋 概述

[组件的功能描述]

## 📦 分类

- [x] 基础 UI 组件
- [ ] 复合组件

## 🎯 使用场景

- 场景 1：[描述]
- 场景 2：[描述]

## 📖 API

### Props

| 属性名 | 类型 | 默认值 | 必填 | 描述 |
|--------|------|--------|------|------|
| - | - | - | - | - |

### Emits

| 事件名 | 参数 | 描述 |
|--------|------|------|
| - | - | - |

### Slots

| 插槽名 | Props | 描述 |
|--------|-------|------|
| \`default\` | - | 默认插槽 |

### Expose

| 方法名 | 参数 | 返回值 | 描述 |
|--------|------|--------|------|
| - | - | - | - |

## 💡 使用示例

### 基础使用

\`\`\`vue
<template>
  <$COMPONENT_NAME>
    内容
  </$COMPONENT_NAME>
</template>

<script setup lang="ts">
import { $COMPONENT_NAME } from '@/components'
</script>
\`\`\`

### 高级用法

\`\`\`vue
<template>
  <$COMPONENT_NAME>
    <template #default>
      自定义内容
    </template>
  </$COMPONENT_NAME>
</template>
\`\`\`

## 🎨 样式定制

### CSS 变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| \`--${COMPONENT_CLASS}-bg\` | \`#fff\` | 背景色 |
| \`--${COMPONENT_CLASS}-color\` | \`#000\` | 文字颜色 |

### 示例

\`\`\`css
.$COMPONENT_CLASS {
  --${COMPONENT_CLASS}-bg: #f0f0f0;
  --${COMPONENT_CLASS}-color: #333;
}
\`\`\`

## 📦 依赖组件

无

## ⚠️ 注意事项

- [注意事项 1]
- [注意事项 2]

## 🔄 更新日志

### v1.0.0 ($(date +%Y-%m-%d))
- 初始版本
EOF

echo "✅ 基础组件 $COMPONENT_NAME 创建成功！"
echo "📁 位置: $DIR"
echo ""
echo "📝 下一步："
echo "  1. 编辑 $DIR/$COMPONENT_NAME.vue 实现组件逻辑"
echo "  2. 完善 $DIR/$COMPONENT_NAME.types.ts 类型定义"
echo "  3. 完善 $DIR/README.md 组件文档"
echo "  4. 在 components/index.ts 中导出组件"
echo ""
echo "📚 参考文档: 文档/项目管理/组件与页面规范化方案.md"

