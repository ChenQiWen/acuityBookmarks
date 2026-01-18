#!/bin/bash

# 书签分享功能 - 本地 IP 配置脚本
# 用于配置开发环境的分享链接，方便手机扫码测试

set -e

echo "📱 书签分享功能 - 本地 IP 配置"
echo "================================"
echo ""

# 检测操作系统
OS="$(uname -s)"

# 获取本地 IP
echo "🔍 正在检测本地 IP 地址..."
echo ""

if [ "$OS" = "Darwin" ]; then
  # macOS
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif [ "$OS" = "Linux" ]; then
  # Linux
  LOCAL_IP=$(hostname -I | awk '{print $1}')
else
  # Windows (Git Bash)
  LOCAL_IP=$(ipconfig | grep "IPv4" | head -n 1 | awk '{print $NF}')
fi

if [ -z "$LOCAL_IP" ]; then
  echo "❌ 无法自动检测本地 IP 地址"
  echo ""
  echo "请手动获取本地 IP："
  echo "  macOS/Linux: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
  echo "  Windows: ipconfig | findstr IPv4"
  echo ""
  read -p "请输入本地 IP 地址: " LOCAL_IP
fi

echo "✅ 检测到本地 IP: $LOCAL_IP"
echo ""

# 配置文件路径
ENV_FILE="frontend/.env.development.local"
SHARE_URL="http://${LOCAL_IP}:3001/share"

# 创建或更新配置文件
echo "📝 正在配置环境变量..."
echo ""

if [ -f "$ENV_FILE" ]; then
  # 文件存在，更新配置
  if grep -q "VITE_SHARE_BASE_URL" "$ENV_FILE"; then
    # 替换现有配置
    sed -i.bak "s|VITE_SHARE_BASE_URL=.*|VITE_SHARE_BASE_URL=$SHARE_URL|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    echo "✅ 已更新 $ENV_FILE"
  else
    # 追加配置
    echo "" >> "$ENV_FILE"
    echo "# 分享落地页 URL（自动配置）" >> "$ENV_FILE"
    echo "VITE_SHARE_BASE_URL=$SHARE_URL" >> "$ENV_FILE"
    echo "✅ 已追加配置到 $ENV_FILE"
  fi
else
  # 文件不存在，创建新文件
  cat > "$ENV_FILE" << EOF
# 开发环境配置（自动生成）
# 分享落地页 URL（用于二维码）
VITE_SHARE_BASE_URL=$SHARE_URL
EOF
  echo "✅ 已创建 $ENV_FILE"
fi

echo ""
echo "📋 配置内容："
echo "  VITE_SHARE_BASE_URL=$SHARE_URL"
echo ""

# 提示后续步骤
echo "🎯 后续步骤："
echo ""
echo "1. 启动官网开发服务器："
echo "   cd website && bun run dev"
echo ""
echo "2. 重新构建扩展："
echo "   cd frontend && bun run build"
echo ""
echo "3. 生成分享海报并用手机扫码测试"
echo ""
echo "4. 手机浏览器应该能打开："
echo "   $SHARE_URL?data=..."
echo ""
echo "✅ 配置完成！"
