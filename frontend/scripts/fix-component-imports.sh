#!/bin/bash

# 修复组件迁移后的导入路径
# 使用方法: ./scripts/fix-component-imports.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 开始修复组件导入路径...${NC}"

# 修复基础组件中的相对路径导入
echo -e "${YELLOW}📦 修复基础组件导入路径...${NC}"

# 修复 Icon 导入
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./Icon\.vue'\''|from '\''@/components/ui/Icon.vue'\''|g' {} \;
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./Icon'\''|from '\''@/components/ui/Icon'\''|g' {} \;

# 修复 Button 导入
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./Button\.vue'\''|from '\''@/components/ui/Button.vue'\''|g' {} \;
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./Button'\''|from '\''@/components/ui/Button'\''|g' {} \;

# 修复 Card 导入
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./Card\.vue'\''|from '\''@/components/ui/Card.vue'\''|g' {} \;
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./Card'\''|from '\''@/components/ui/Card'\''|g' {} \;

# 修复其他组件导入
find src/components/base -name "*.vue" -exec sed -i '' 's|from '\''\./index'\''|from '\''@/components/ui'\''|g' {} \;

echo -e "  ${GREEN}✅ 基础组件导入路径修复完成${NC}"

# 修复复合组件中的相对路径导入
echo -e "${YELLOW}📦 修复复合组件导入路径...${NC}"

# 修复 ui 导入
find src/components/composite -name "*.vue" -exec sed -i '' 's|from '\''\./ui'\''|from '\''@/components/ui'\''|g' {} \;
find src/components/composite -name "*.vue" -exec sed -i '' 's|from '\''\.\./ui'\''|from '\''@/components/ui'\''|g' {} \;

# 修复 SimpleTreeNode 导入
find src/components/composite -name "*.vue" -exec sed -i '' 's|from '\''\./SimpleTreeNode\.vue'\''|from '\''@/components/composite/SimpleTreeNode/SimpleTreeNode.vue'\''|g' {} \;

# 修复 types 导入
find src/components/composite -name "*.vue" -exec sed -i '' 's|from '\''\.\./types'\''|from '\''@/types'\''|g' {} \;

echo -e "  ${GREEN}✅ 复合组件导入路径修复完成${NC}"

echo -e "${GREEN}🎉 组件导入路径修复完成！${NC}"
echo -e "${BLUE}📝 下一步：${NC}"
echo -e "  1. 测试构建是否成功"
echo -e "  2. 验证组件功能正常"
echo -e "  3. 更新组件文档"
