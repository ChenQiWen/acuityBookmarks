#!/bin/bash

# AcuityBookmarks 开发环境自动化设置脚本
# 用于快速搭建和优化开发环境

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="AcuityBookmarks"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🔧 正在设置 ${PROJECT_NAME} 开发环境...${NC}"

# 检查操作系统
detect_os() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macOS"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Linux"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "Windows"
  else
    echo "Unknown"
  fi
}

OS=$(detect_os)
echo -e "${BLUE}📱 检测到操作系统: ${OS}${NC}"

# 检查并安装依赖
check_and_install_dependencies() {
  echo -e "${YELLOW}📋 检查开发依赖...${NC}"
  
  # 检查Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    echo -e "${YELLOW}💡 请访问 https://nodejs.org 安装 Node.js${NC}"
    exit 1
  else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js ${NODE_VERSION}${NC}"
  fi
  
  # 检查并安装Bun
  if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}📦 正在安装 Bun...${NC}"
    if [[ "$OS" == "Windows" ]]; then
      powershell -c "irm bun.sh/install.ps1 | iex"
    else
      curl -fsSL https://bun.sh/install | bash
      export PATH="$HOME/.bun/bin:$PATH"
    fi
    
    # 验证安装
    if command -v bun &> /dev/null; then
      BUN_VERSION=$(bun --version)
      echo -e "${GREEN}✅ Bun ${BUN_VERSION} 安装成功${NC}"
    else
      echo -e "${RED}❌ Bun 安装失败${NC}"
      exit 1
    fi
  else
    BUN_VERSION=$(bun --version)
    echo -e "${GREEN}✅ Bun ${BUN_VERSION}${NC}"
  fi
  
  # 检查Chrome（用于扩展测试）
  if command -v google-chrome &> /dev/null || command -v "Google Chrome" &> /dev/null; then
    echo -e "${GREEN}✅ Google Chrome${NC}"
  else
    echo -e "${YELLOW}⚠️  建议安装 Google Chrome 进行扩展测试${NC}"
  fi
  
  # 检查Git
  if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git 未安装${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ Git${NC}"
  fi
}

# 安装项目依赖
install_project_dependencies() {
  echo -e "${YELLOW}📦 安装项目依赖...${NC}"
  
  # 前端依赖
  echo -e "${BLUE}🎨 安装前端依赖...${NC}"
  cd "${PROJECT_ROOT}/frontend"
  bun install
  
  # 后端依赖
  echo -e "${BLUE}🚀 安装后端依赖...${NC}"
  cd "${PROJECT_ROOT}/backend"
  bun install
  
  cd "${PROJECT_ROOT}"
  echo -e "${GREEN}✅ 项目依赖安装完成${NC}"
}

# 设置Git Hooks
setup_git_hooks() {
  echo -e "${YELLOW}🔗 设置 Git Hooks...${NC}"
  
  HOOKS_DIR="${PROJECT_ROOT}/.git/hooks"
  
  # pre-commit hook
  cat > "${HOOKS_DIR}/pre-commit" << 'EOF'
#!/bin/bash

echo "🔍 运行 pre-commit 检查..."

# 检查是否在项目根目录
if [ ! -f "package.json" ] && [ ! -d "frontend" ]; then
  echo "❌ 请在项目根目录运行"
  exit 1
fi

# 运行前端代码检查
echo "📝 检查前端代码格式..."
cd frontend

# TypeScript类型检查
if ! bun run type-check 2>/dev/null; then
  echo "❌ TypeScript 类型检查失败"
  exit 1
fi

# 运行测试
echo "🧪 运行测试..."
if ! bun run test:run 2>/dev/null; then
  echo "❌ 测试失败"
  exit 1
fi

echo "✅ Pre-commit 检查通过"
EOF

  chmod +x "${HOOKS_DIR}/pre-commit"
  
  # pre-push hook
  cat > "${HOOKS_DIR}/pre-push" << 'EOF'
#!/bin/bash

echo "🚀 运行 pre-push 检查..."

# 构建检查
echo "🔨 检查构建..."
cd frontend && bun run build

if [ $? -ne 0 ]; then
  echo "❌ 构建失败"
  exit 1
fi

echo "✅ Pre-push 检查通过"
EOF

  chmod +x "${HOOKS_DIR}/pre-push"
  
  echo -e "${GREEN}✅ Git Hooks 设置完成${NC}"
}

# 创建开发配置文件
create_dev_config() {
  echo -e "${YELLOW}⚙️ 创建开发配置文件...${NC}"
  
  # 创建VS Code配置
  mkdir -p "${PROJECT_ROOT}/.vscode"
  
  # VS Code设置
  cat > "${PROJECT_ROOT}/.vscode/settings.json" << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.vue": "vue"
  },
  "emmet.includeLanguages": {
    "vue": "html"
  },
  "vue.server.hybridMode": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true
}
EOF

  # VS Code扩展推荐
  cat > "${PROJECT_ROOT}/.vscode/extensions.json" << 'EOF'
{
  "recommendations": [
    "Vue.volar",
    "Vue.vscode-typescript-vue-plugin",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint"
  ]
}
EOF

  # 开发环境变量
  if [ ! -f "${PROJECT_ROOT}/frontend/.env.development" ]; then
    cat > "${PROJECT_ROOT}/frontend/.env.development" << 'EOF'
# 开发环境配置
VITE_ENV=development
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_PERFORMANCE_MONITOR=true
VITE_LOG_LEVEL=debug
EOF
  fi
  
  echo -e "${GREEN}✅ 开发配置文件创建完成${NC}"
}

# 设置开发别名和脚本
setup_dev_aliases() {
  echo -e "${YELLOW}🔧 设置开发别名...${NC}"
  
  # 创建开发脚本目录
  mkdir -p "${PROJECT_ROOT}/scripts"
  
  # 快速启动脚本
  cat > "${PROJECT_ROOT}/scripts/dev-start.sh" << 'EOF'
#!/bin/bash

# AcuityBookmarks 快速启动脚本

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 启动 AcuityBookmarks 开发环境..."

# 检查tmux
if command -v tmux &> /dev/null; then
  echo "📱 使用 tmux 启动多窗口开发环境..."
  
  # 创建tmux会话
  tmux new-session -d -s acuity-dev -c "${PROJECT_ROOT}"
  
  # 前端热更新窗口
  tmux send-keys -t acuity-dev 'cd frontend && echo "🎨 启动前端热更新..." && bun run build:hot' Enter
  
  # 后端开发服务器窗口
  tmux split-window -t acuity-dev -c "${PROJECT_ROOT}/backend"
  tmux send-keys -t acuity-dev 'echo "🚀 启动后端开发服务器..." && bun run dev:enhanced' Enter
  
  # 测试监控窗口
  tmux split-window -t acuity-dev -c "${PROJECT_ROOT}/frontend"
  tmux send-keys -t acuity-dev 'echo "🧪 启动测试监控..." && bun run test:watch' Enter
  
  # 调整布局
  tmux select-layout -t acuity-dev tiled
  
  echo "✅ 开发环境已启动"
  echo "💡 使用以下命令查看:"
  echo "   tmux attach -t acuity-dev  # 连接到开发会话"
  echo "   tmux kill-session -t acuity-dev  # 停止开发会话"
  
else
  echo "📝 tmux 未安装，使用手动启动方式:"
  echo ""
  echo "🎨 前端热更新:"
  echo "   cd frontend && bun run build:hot"
  echo ""
  echo "🚀 后端开发服务器:"
  echo "   cd backend && bun run dev:enhanced"
  echo ""
  echo "🧪 测试监控:"
  echo "   cd frontend && bun run test:watch"
fi
EOF

  chmod +x "${PROJECT_ROOT}/scripts/dev-start.sh"
  
  echo -e "${GREEN}✅ 开发脚本创建完成${NC}"
}

# 运行初始测试
run_initial_tests() {
  echo -e "${YELLOW}🧪 运行初始测试...${NC}"
  
  # 前端测试
  cd "${PROJECT_ROOT}/frontend"
  if bun run test:run; then
    echo -e "${GREEN}✅ 前端测试通过${NC}"
  else
    echo -e "${YELLOW}⚠️  前端测试存在问题，请检查${NC}"
  fi
  
  # 后端测试
  cd "${PROJECT_ROOT}/backend"
  if bun run test:run; then
    echo -e "${GREEN}✅ 后端测试通过${NC}"
  else
    echo -e "${YELLOW}⚠️  后端测试存在问题，请检查${NC}"
  fi
  
  cd "${PROJECT_ROOT}"
}

# 显示完成信息
show_completion_info() {
  echo ""
  echo -e "${GREEN}🎉 ${PROJECT_NAME} 开发环境设置完成！${NC}"
  echo ""
  echo -e "${BLUE}📋 接下来你可以:${NC}"
  echo ""
  echo -e "${YELLOW}🚀 启动开发环境:${NC}"
  echo "   ./scripts/dev-start.sh"
  echo ""
  echo -e "${YELLOW}🎨 单独启动前端:${NC}"
  echo "   cd frontend && bun run build:hot"
  echo ""
  echo -e "${YELLOW}🚀 单独启动后端:${NC}"
  echo "   cd backend && bun run dev:enhanced"
  echo ""
  echo -e "${YELLOW}🧪 运行测试:${NC}"
  echo "   cd frontend && bun run test"
  echo "   cd backend && bun run test"
  echo ""
  echo -e "${YELLOW}🔨 构建生产版本:${NC}"
  echo "   cd frontend && bun run build"
  echo ""
  echo -e "${BLUE}💡 提示:${NC}"
  echo "   - 使用 VS Code 打开项目获得最佳开发体验"
  echo "   - Git hooks 已设置，提交前会自动运行检查"
  echo "   - 性能监控已集成，开发时可查看性能指标"
  echo ""
}

# 主函数
main() {
  cd "${PROJECT_ROOT}"
  
  check_and_install_dependencies
  install_project_dependencies
  setup_git_hooks
  create_dev_config
  setup_dev_aliases
  run_initial_tests
  show_completion_info
}

# 错误处理
trap 'echo -e "${RED}❌ 安装过程中出现错误${NC}"; exit 1' ERR

# 执行主函数
main "$@"
