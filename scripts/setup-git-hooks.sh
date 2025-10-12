#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
GIT_DIR="$(git rev-parse --git-dir)"
HOOKS_DIR="$GIT_DIR/hooks"

mkdir -p "$HOOKS_DIR"

# 写入统一的 pre-commit hook
cat > "$HOOKS_DIR/pre-commit" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🔍 pre-commit: 运行前端 ESLint 与 Stylelint 严格检查..."

REPO_ROOT="$(git rev-parse --show-toplevel)"
FRONTEND_DIR="$REPO_ROOT/frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ 未找到 frontend 目录"
  exit 1
fi

cd "$FRONTEND_DIR"

if command -v bun >/dev/null 2>&1; then
  bun run lint:check
  bun run stylelint
else
  echo "❌ Bun 未安装，请先安装 Bun"
  exit 1
fi

echo "✅ Lint 检查通过，继续提交。"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"

# 写入统一的 pre-push hook
cat > "$HOOKS_DIR/pre-push" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🚀 pre-push: 前端类型检查、样式检查与生产构建..."

REPO_ROOT="$(git rev-parse --show-toplevel)"
FRONTEND_DIR="$REPO_ROOT/frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ 未找到 frontend 目录"
  exit 1
fi

cd "$FRONTEND_DIR"

if command -v bun >/dev/null 2>&1; then
  bun run type-check
  bun run stylelint
  bun run build:prod
else
  echo "❌ Bun 未安装，请先安装 Bun"
  exit 1
fi

echo "✅ Pre-push 检查通过"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-push"

echo "✅ Git hooks 已安装：pre-commit 与 pre-push"
echo "📌 提交与推送前将自动执行前端检查（与 CI 一致）。"
echo "⚙️ 如需临时跳过，可使用 \"--no-verify\" 参数：git commit -m 'msg' --no-verify"