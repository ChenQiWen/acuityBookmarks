#!/bin/bash

# 🚀 组件性能分析脚本
# 分析组件复杂度、性能瓶颈和优化机会

echo "🔍 开始组件性能分析..."

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 分析目录
COMPONENTS_DIR="src/components"
BASE_DIR="$COMPONENTS_DIR/base"
COMPOSITE_DIR="$COMPONENTS_DIR/composite"

echo -e "${BLUE}📊 组件统计信息${NC}"
echo "========================"

# 统计组件数量
BASE_COUNT=$(find $BASE_DIR -name "*.vue" | wc -l)
COMPOSITE_COUNT=$(find $COMPOSITE_DIR -name "*.vue" | wc -l)
TOTAL_COUNT=$((BASE_COUNT + COMPOSITE_COUNT))

echo -e "基础组件: ${GREEN}$BASE_COUNT${NC}"
echo -e "复合组件: ${GREEN}$COMPOSITE_COUNT${NC}"
echo -e "总计: ${GREEN}$TOTAL_COUNT${NC}"

echo ""
echo -e "${BLUE}📏 组件复杂度分析${NC}"
echo "========================"

# 分析文件大小和行数
echo "文件大小分析:"
echo "基础组件:"
find $BASE_DIR -name "*.vue" -exec wc -l {} + | sort -nr | head -5

echo ""
echo "复合组件:"
find $COMPOSITE_DIR -name "*.vue" -exec wc -l {} + | sort -nr | head -5

echo ""
echo -e "${BLUE}🔍 性能关键组件识别${NC}"
echo "========================"

# 识别大型组件
echo "大型组件 (>500行):"
find $COMPONENTS_DIR -name "*.vue" -exec wc -l {} + | awk '$1 > 500 {print $2 " (" $1 " 行)"}' | sort -nr

echo ""
echo "中型组件 (200-500行):"
find $COMPONENTS_DIR -name "*.vue" -exec wc -l {} + | awk '$1 >= 200 && $1 <= 500 {print $2 " (" $1 " 行)"}' | sort -nr

echo ""
echo -e "${BLUE}🎯 性能优化建议${NC}"
echo "========================"

# 检查是否有性能优化机会
echo "检查性能优化机会..."

# 检查是否有 v-for 但没有 key
echo "1. 检查 v-for 使用情况:"
grep -r "v-for" $COMPONENTS_DIR --include="*.vue" | grep -v ":key" | head -3 || echo "✅ 所有 v-for 都有 key"

# 检查是否有大量计算属性
echo ""
echo "2. 检查计算属性使用:"
grep -r "computed(" $COMPONENTS_DIR --include="*.vue" | wc -l | xargs echo "计算属性总数:"

# 检查是否有 watch 使用
echo ""
echo "3. 检查 watch 使用:"
grep -r "watch(" $COMPONENTS_DIR --include="*.vue" | wc -l | xargs echo "watch 总数:"

# 检查是否有深度监听
echo ""
echo "4. 检查深度监听:"
grep -r "deep.*true" $COMPONENTS_DIR --include="*.vue" | wc -l | xargs echo "深度监听数量:"

echo ""
echo -e "${BLUE}📋 优化优先级建议${NC}"
echo "========================"

# 基于文件大小和复杂度给出优化建议
echo "高优先级优化目标:"
find $COMPONENTS_DIR -name "*.vue" -exec wc -l {} + | awk '$1 > 300 {print "🔴 " $2 " (" $1 " 行) - 建议拆分或优化"}' | head -3

echo ""
echo "中优先级优化目标:"
find $COMPONENTS_DIR -name "*.vue" -exec wc -l {} + | awk '$1 >= 150 && $1 <= 300 {print "🟡 " $2 " (" $1 " 行) - 可考虑优化"}' | head -3

echo ""
echo -e "${GREEN}✅ 性能分析完成${NC}"
