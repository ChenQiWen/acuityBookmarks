#!/bin/bash

# 批量优化组件类型定义
# 使用方法: ./scripts/optimize-component-types.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 开始优化组件类型定义...${NC}"

# 需要优化的基础组件列表
BASE_COMPONENTS=(
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

echo -e "${YELLOW}📦 优化基础组件类型定义...${NC}"

for component in "${BASE_COMPONENTS[@]}"; do
  echo -e "${YELLOW}  🔍 分析组件: ${component}${NC}"
  
  component_file="src/components/base/${component}/${component}.vue"
  types_file="src/components/base/${component}/${component}.types.ts"
  
  if [ -f "$component_file" ]; then
    # 检查组件是否有 defineProps
    if grep -q "defineProps" "$component_file"; then
      echo -e "    ✅ 找到 defineProps，需要优化类型定义"
      
      # 检查类型文件是否存在且为模板状态
      if [ -f "$types_file" ] && grep -q "TODO" "$types_file"; then
        echo -e "    📝 类型文件需要完善"
        # 这里可以添加自动提取 props 的逻辑
      else
        echo -e "    ✅ 类型文件已完善"
      fi
    else
      echo -e "    ℹ️  组件无 props，跳过"
    fi
  else
    echo -e "    ${RED}❌ 组件文件不存在${NC}"
  fi
done

# 需要优化的复合组件列表
COMPOSITE_COMPONENTS=(
  "SimpleTreeNode"
  "SmartBookmarkRecommendations"
  "PanelInlineSearch"
)

echo -e "${YELLOW}📦 优化复合组件类型定义...${NC}"

for component in "${COMPOSITE_COMPONENTS[@]}"; do
  echo -e "${YELLOW}  🔍 分析组件: ${component}${NC}"
  
  component_file="src/components/composite/${component}/${component}.vue"
  types_file="src/components/composite/${component}/${component}.types.ts"
  
  if [ -f "$component_file" ]; then
    # 检查组件是否有 defineProps
    if grep -q "defineProps" "$component_file"; then
      echo -e "    ✅ 找到 defineProps，需要优化类型定义"
      
      # 检查类型文件是否存在且为模板状态
      if [ -f "$types_file" ] && grep -q "TODO" "$types_file"; then
        echo -e "    📝 类型文件需要完善"
        # 这里可以添加自动提取 props 的逻辑
      else
        echo -e "    ✅ 类型文件已完善"
      fi
    else
      echo -e "    ℹ️  组件无 props，跳过"
    fi
  else
    echo -e "    ${RED}❌ 组件文件不存在${NC}"
  fi
done

echo -e "${GREEN}🎉 组件类型定义分析完成！${NC}"
echo -e "${BLUE}📝 下一步：${NC}"
echo -e "  1. 手动完善需要优化的组件类型定义"
echo -e "  2. 更新组件使用新的类型定义"
echo -e "  3. 测试类型定义的正确性"
echo -e "  4. 更新组件文档"
