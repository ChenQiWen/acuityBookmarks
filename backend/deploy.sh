#!/bin/bash

echo "🚀 部署 AcuityBookmarks 后端到 Vercel"

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 请先安装 Vercel CLI: npm i -g vercel"
    exit 1
fi

# 检查是否已登录
if ! vercel whoami &> /dev/null; then
    echo "📝 请先登录 Vercel:"
    vercel login
fi

# 检查环境变量
echo "🔍 检查环境变量配置..."
required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "GEMINI_API_KEY")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  环境变量 $var 未设置"
        echo "请在 Vercel 项目设置中配置以下环境变量:"
        echo "  - SUPABASE_URL"
        echo "  - SUPABASE_ANON_KEY"
        echo "  - GEMINI_API_KEY"
        echo "  - VERCEL_URL"
        read -p "是否继续部署? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        break
    fi
done

echo "📦 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo "请在 Vercel 控制台中配置环境变量，如果还没有配置的话。"
echo ""
echo "API 端点:"
echo "  - POST /api/bookmarks/upload     - 上传书签数据"
echo "  - POST /api/search/embeddings   - AI 向量搜索"
echo "  - POST /api/bookmarks/sync      - 数据同步"
echo ""
echo "🎉 享受 AI 书签搜索功能吧！"
