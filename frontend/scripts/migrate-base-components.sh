#!/bin/bash

# 批量迁移基础UI组件到 base/ 目录
# 使用方法: ./scripts/migrate-base-components.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 基础UI组件列表 (纯展示/交互，无业务逻辑)
BASE_COMPONENTS=(
  "Card"
  "Input" 
  "Grid"
  "List"
  "Spinner"
  "Toast"
  "Avatar"
  "Badge"
  "ProgressBar"
  "Divider"
  "Dropdown"
  "Overlay"
  "Tooltip"
  "Chip"
  "App"
  "Main"
  "Dialog"
  "Spacer"
  "Tabs"
  "Checkbox"
  "Switch"
  "UrlInput"
)

echo -e "${BLUE}🚀 开始批量迁移基础UI组件...${NC}"

# 创建基础组件目录
mkdir -p src/components/base

for component in "${BASE_COMPONENTS[@]}"; do
  echo -e "${YELLOW}📦 迁移组件: ${component}${NC}"
  
  # 创建组件目录
  mkdir -p "src/components/base/${component}"
  
  # 复制组件文件
  if [ -f "src/components/ui/${component}.vue" ]; then
    cp "src/components/ui/${component}.vue" "src/components/base/${component}/${component}.vue"
    echo -e "  ✅ 复制 ${component}.vue"
  else
    echo -e "  ${RED}❌ 找不到 ${component}.vue${NC}"
    continue
  fi
  
  # 创建类型文件
  cat > "src/components/base/${component}/${component}.types.ts" << EOF
/**
 * ${component} 组件类型定义
 * ${component} 组件 - 基础UI组件
 */

export interface ${component}Props {
  // TODO: 定义组件属性
}

export interface ${component}Emits {
  // TODO: 定义组件事件
}
EOF
  echo -e "  ✅ 创建 ${component}.types.ts"
  
  # 创建README文件
  cat > "src/components/base/${component}/README.md" << EOF
# ${component} 组件

${component} 基础UI组件。

## 特性

- 🎨 基础UI组件
- 📏 响应式设计
- 🎯 无障碍支持

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| TODO | TODO | TODO | TODO |

## 使用示例

\`\`\`vue
<template>
  <${component} />
</template>
\`\`\`

## 注意事项

- 这是基础UI组件，无业务逻辑
- 支持所有标准的HTML属性传递
EOF
  echo -e "  ✅ 创建 ${component}/README.md"
  
  echo -e "  ${GREEN}✅ ${component} 迁移完成${NC}"
done

echo -e "${GREEN}🎉 基础UI组件批量迁移完成！${NC}"
echo -e "${BLUE}📝 下一步：${NC}"
echo -e "  1. 完善各组件的类型定义"
echo -e "  2. 更新组件导入路径"
echo -e "  3. 测试组件功能"
echo -e "  4. 更新 components/index.ts 导出"
