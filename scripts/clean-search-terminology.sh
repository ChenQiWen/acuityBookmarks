#!/bin/bash

# 批量清理项目中的"搜索"术语，统一改为"筛选"
# 
# 用法: bash scripts/clean-search-terminology.sh

set -e

echo "🚀 开始清理项目中的'搜索'术语..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
TOTAL_REPLACED=0

# 替换规则
declare -A REPLACEMENTS=(
  ["搜索书签"]="筛选书签"
  ["书签搜索"]="书签筛选"
  ["搜索功能"]="筛选功能"
  ["搜索结果"]="筛选结果"
  ["搜索服务"]="筛选服务"
  ["搜索框"]="筛选框"
  ["搜索条件"]="筛选条件"
  ["搜索关键字"]="筛选条件"
  ["搜索选项"]="筛选选项"
  ["进行搜索"]="执行筛选"
  ["搜索查询"]="筛选条件"
  ["搜索中"]="筛选中"
  ["搜索"]="筛选"
)

# 目标目录
TARGET_DIRS=(
  "frontend/src/pages"
  "frontend/src/components"
  "frontend/src/composables"
  "frontend/src/stores"
  "frontend/src/application"
  "frontend/src/core"
  "frontend/src/types"
  "frontend/src/services"
  "frontend/src/infrastructure"
)

# 执行替换
for dir in "${TARGET_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    continue
  fi
  
  echo -e "${YELLOW}处理目录: $dir${NC}"
  
  # 查找所有 .ts, .vue, .md 文件
  FILES=$(find "$dir" -type f \( -name "*.ts" -o -name "*.vue" -o -name "*.md" \) 2>/dev/null || true)
  
  for file in $FILES; do
    CHANGED=false
    
    for search_term in "${!REPLACEMENTS[@]}"; do
      replace_term="${REPLACEMENTS[$search_term]}"
      
      # 检查文件是否包含该术语
      if grep -q "$search_term" "$file" 2>/dev/null; then
        # Mac 和 Linux 兼容的 sed
        if [[ "$OSTYPE" == "darwin"* ]]; then
          # macOS
          sed -i '' "s/$search_term/$replace_term/g" "$file"
        else
          # Linux
          sed -i "s/$search_term/$replace_term/g" "$file"
        fi
        
        CHANGED=true
        TOTAL_REPLACED=$((TOTAL_REPLACED + 1))
      fi
    done
    
    if [ "$CHANGED" = true ]; then
      echo -e "  ${GREEN}✓${NC} $file"
    fi
  done
done

echo ""
echo -e "${GREEN}✅ 清理完成！${NC}"
echo "总共处理了 $TOTAL_REPLACED 个文件"
echo ""
echo "⚠️  注意："
echo "1. 技术术语（如 searchAppService）保持不变"
echo "2. 文件名（如 search-app-service.ts）保持不变"
echo "3. 请运行 'bun run typecheck' 验证修改"
echo ""

