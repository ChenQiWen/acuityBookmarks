#!/bin/bash

# AcuityBookmarks i18n 测试脚本
# 用于快速切换 Chrome 语言以测试扩展的国际化功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 支持的语言映射
declare -A LANGUAGES=(
  ["zh-CN"]="简体中文"
  ["zh-TW"]="繁體中文"
  ["en"]="English"
  ["ja"]="日本語"
  ["ko"]="한국어"
  ["de"]="Deutsch"
  ["es"]="Español"
)

# 显示帮助信息
show_help() {
  echo -e "${BLUE}AcuityBookmarks i18n 测试工具${NC}"
  echo ""
  echo "用法: $0 [语言代码]"
  echo ""
  echo "支持的语言:"
  for code in "${!LANGUAGES[@]}"; do
    echo -e "  ${GREEN}$code${NC}  ${LANGUAGES[$code]}"
  done | sort
  echo ""
  echo "示例:"
  echo "  $0 en      # 切换到英语"
  echo "  $0 zh-CN   # 切换到简体中文"
  echo "  $0 ja      # 切换到日语"
  echo ""
  echo "快捷别名:"
  echo "  cn, 中文   → zh-CN"
  echo "  tw, 繁体   → zh-TW"
  echo "  英文       → en"
  echo "  日文       → ja"
  echo "  韩文       → ko"
  echo "  德文       → de"
  echo "  西班牙文   → es"
}

# 解析语言代码（支持别名）
parse_language() {
  case "$1" in
    cn|中文|简体)
      echo "zh-CN"
      ;;
    tw|繁体|繁體)
      echo "zh-TW"
      ;;
    en|英文|english)
      echo "en"
      ;;
    ja|日文|japanese)
      echo "ja"
      ;;
    ko|韩文|korean)
      echo "ko"
      ;;
    de|德文|german)
      echo "de"
      ;;
    es|西班牙文|spanish)
      echo "es"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

# 检查语言是否支持
is_supported() {
  local lang="$1"
  [[ -n "${LANGUAGES[$lang]}" ]]
}

# 主逻辑
main() {
  # 检查参数
  if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
  fi

  # 解析语言代码
  LANG_CODE=$(parse_language "$1")

  # 验证语言是否支持
  if ! is_supported "$LANG_CODE"; then
    echo -e "${RED}❌ 不支持的语言: $1${NC}"
    echo ""
    show_help
    exit 1
  fi

  LANG_NAME="${LANGUAGES[$LANG_CODE]}"

  echo -e "${BLUE}🌍 切换 Chrome 语言到: ${GREEN}$LANG_NAME${BLUE} ($LANG_CODE)${NC}"
  echo ""

  # 关闭 Chrome
  echo -e "${YELLOW}⏳ 正在关闭 Chrome...${NC}"
  osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
  sleep 1

  # 设置语言
  echo -e "${YELLOW}⚙️  设置语言为 $LANG_CODE...${NC}"
  defaults write com.google.Chrome AppleLanguages "($LANG_CODE)"

  # 启动 Chrome
  echo -e "${YELLOW}🚀 启动 Chrome...${NC}"
  open -a "Google Chrome"

  echo ""
  echo -e "${GREEN}✅ 完成！Chrome 已设置为 $LANG_NAME${NC}"
  echo ""
  echo -e "${BLUE}📝 验证方法：${NC}"
  echo "  1. 打开扩展的控制台"
  echo "  2. 运行: chrome.i18n.getUILanguage()"
  echo "  3. 应该返回: \"$LANG_CODE\""
  echo ""
  echo -e "${BLUE}🔄 切换其他语言：${NC}"
  echo "  $0 [语言代码]"
}

main "$@"
