#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
GIT_DIR="$(git rev-parse --git-dir)"
HOOKS_DIR="$GIT_DIR/hooks"
HOOK_FILE="$HOOKS_DIR/pre-commit"

mkdir -p "$HOOKS_DIR"

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# AcuityBookmarks: pre-commit hook
# 运行前端 ESLint 严格检查，未通过则终止提交

REPO_ROOT="$(git rev-parse --show-toplevel)"
FRONTEND_DIR="$REPO_ROOT/frontend"

echo "🔍 ESLint: 正在检查前端代码规范..."
cd "$FRONTEND_DIR"

# 使用 npm 以避免对 bun 的依赖假设
npm run lint:check
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "❌ ESLint 检查未通过，已阻止提交。"
  echo "💡 请修复上方问题后重试提交。"
  exit $STATUS
fi

echo "✅ ESLint 通过，继续提交。"
exit 0
EOF

chmod +x "$HOOK_FILE"

echo "✅ Git pre-commit 钩子已安装：$HOOK_FILE"
echo "📌 每次 git commit 将自动执行前端 ESLint 严格检查。"
echo "⚙️ 如需临时跳过，可使用 \"--no-verify\" 参数：git commit -m 'msg' --no-verify"