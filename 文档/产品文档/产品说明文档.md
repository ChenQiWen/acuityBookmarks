# AcuityBookmarks - Chrome 书签管理扩展

## 📋 产品概述

### 项目简介
AcuityBookmarks 是一个高性能的 Chrome 浏览器扩展，专为优化书签管理体验而设计。提供直观的可视化界面和强大的书签组织功能，让用户能够高效地管理和重组浏览器书签。

### 核心价值
- **可视化管理**：双面板对比视图，直观展示书签结构变化
- **拖拽重组**：支持拖拽操作重新组织书签层次结构
- **性能优化**：原生 HTML/JS 实现，轻量快速
- **用户友好**：简洁现代的界面设计，操作直观

---

## 🏗️ 技术架构

### 技术栈选择
- **前端框架**：原生 HTML5 + CSS3 + JavaScript ES6+
- **后端服务**：Bun.js (开发环境热更新)
- **构建工具**：Vite + 自定义构建脚本
- **API 集成**：Chrome Extension API v3
- **开发工具**：TypeScript, ESLint, Vitest

### 架构设计原则
1. **轻量化优先**：避免重型框架，确保扩展快速加载
2. **性能导向**：原生实现关键功能，最小化运行时开销
3. **模块化设计**：清晰的代码结构，便于维护和扩展
4. **用户体验**：响应式设计，支持多种屏幕尺寸

---

## 🚀 功能特性

### 核心功能

#### 1. 书签可视化管理
- **双面板布局**：左侧显示原始书签结构，右侧显示编辑后结构
- **树形展示**：分层显示文件夹和书签，支持展开/折叠
- **实时对比**：直观显示修改前后的差异

#### 2. 拖拽重组功能
- **文件夹拖拽**：支持文件夹间的拖拽移动
- **书签重排**：支持书签在文件夹内重新排序
- **跨层级移动**：支持书签在不同文件夹间移动

#### 3. 快捷键支持
- **Alt+B**：打开书签管理页面
- **智能书签**：AI 辅助的书签重组功能
- **搜索弹窗**：快速搜索和访问书签

#### 4. 数据同步
- **实时同步**：与 Chrome 书签数据实时同步
- **批量操作**：支持批量移动和重组
- **撤销重做**：支持操作的撤销和重做

### 高级功能

#### 1. 性能优化
- **懒加载**：按需加载书签内容
- **虚拟滚动**：处理大量书签时的性能优化
- **缓存机制**：智能缓存减少 API 调用

#### 2. 用户体验
- **响应式设计**：适配不同屏幕尺寸
- **主题支持**：支持明暗主题切换
- **国际化**：支持多语言界面

---

## 📁 项目结构

```
acuityBookmarks/
├── 📄 README.md                    # 项目说明文档
├── 📄 PRODUCT_DOCUMENTATION.md     # 产品文档 (本文件)
├── 📄 TESTING.md                   # 测试说明文档
├── 📄 manifest.json               # Chrome 扩展清单 (已删除)
├── 📄 background.js               # 服务工作者脚本
├── 📄 logo.svg                    # 项目 Logo
├── 
├── 📁 backend/                    # 后端开发服务
│   ├── 📄 package.json           # 后端依赖配置
│   ├── 📄 server.js              # 开发服务器
│   ├── 📄 bun.config.js          # Bun 配置文件
│   ├── 📁 scripts/               # 开发脚本
│   ├── 📁 utils/                 # 工具函数
│   └── 📁 test/                  # 后端测试
│
├── 📁 frontend/                   # 前端源码
│   ├── 📄 package.json           # 前端依赖配置
│   ├── 📄 vite.config.ts         # Vite 构建配置
│   ├── 📄 tsconfig.json          # TypeScript 配置
│   ├── 📄 vitest.config.ts       # 测试配置
│   ├── 
│   ├── 📁 src/                   # 源代码目录
│   │   ├── 📁 management/        # 管理页面组件 (已删除)
│   │   ├── 📁 popup/             # 弹窗组件
│   │   ├── 📁 search-popup/      # 搜索弹窗组件
│   │   ├── 📁 plugins/           # Vue 插件
│   │   └── 📁 utils/             # 工具函数
│   │   
│   ├── 📁 scripts/               # 构建脚本
│   │   ├── 📄 clean-dist.cjs     # 清理和复制脚本
│   │   └── 📄 watch-build.js     # 热更新脚本
│   │
│   ├── 📁 public/                # 静态资源
│   └── 📁 __tests__/             # 前端测试
│
├── 📁 dist/                      # 构建输出目录
│   ├── 📄 manifest.json          # 生成的扩展清单
│   ├── 📄 background.js          # 复制的服务脚本
│   ├── 📄 management.html        # 主管理页面
│   ├── 📄 popup.html             # 弹窗页面
│   ├── 📄 search-popup.html      # 搜索弹窗
│   ├── 📁 assets/                # 编译后的资源
│   └── 📁 images/                # 图标文件
│
└── 📁 images/                    # 原始图标文件
    ├── 📄 icon16.png
    ├── 📄 icon48.png
    └── 📄 icon128.png
```

---

## 🔧 开发环境

### 环境要求
- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0 (推荐)
- **Chrome**: >= 88.0 (支持 Manifest V3)
- **操作系统**: Windows 10+, macOS 10.15+, Linux

### 开发工具链
- **包管理器**: Bun (统一前后端)
- **构建工具**: Vite 5.x
- **代码规范**: ESLint + Prettier
- **类型检查**: TypeScript 5.x
- **测试框架**: Vitest + Vue Test Utils

### 安装和启动

#### 1. 克隆项目
```bash
git clone https://github.com/your-username/acuityBookmarks.git
cd acuityBookmarks
```

#### 2. 安装依赖
```bash
# 前端依赖
cd frontend
bun install

# 后端依赖
cd ../backend
bun install
```

#### 3. 开发模式启动
```bash
# 启动后端开发服务器 (终端1)
cd backend
bun run dev:enhanced

# 启动前端热更新构建 (终端2)
cd frontend
bun run build:hot
```

#### 4. 生产构建
```bash
cd frontend
bun run build
```

---

## 📦 构建和部署

### 构建流程

#### 1. 前端构建
```bash
cd frontend
bun run build
```

构建过程：
1. TypeScript 类型检查
2. Vite 打包优化
3. 资源文件复制
4. 扩展清单生成
5. 文件清理和优化

#### 2. 构建输出
构建完成后，`dist/` 目录包含所有扩展文件：
- `manifest.json` - 扩展清单
- `background.js` - 服务工作者
- `*.html` - 页面文件
- `assets/` - 编译后的 JS/CSS
- `images/` - 图标资源

### 扩展安装

#### 开发模式安装
1. 打开 Chrome 扩展管理页面 (`chrome://extensions/`)
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist/` 目录

#### 生产环境部署
1. 将 `dist/` 目录打包为 `.zip` 文件
2. 上传到 Chrome Web Store
3. 通过审核后发布

---

## 🧪 测试策略

### 测试类型

#### 1. 单元测试
- **覆盖范围**: 工具函数、数据处理逻辑
- **测试框架**: Vitest + Vue Test Utils
- **运行命令**: `bun run test`

#### 2. 集成测试
- **覆盖范围**: Chrome API 集成、数据同步
- **测试环境**: Chrome 扩展环境模拟
- **运行命令**: `bun run test:integration`

#### 3. 端到端测试
- **覆盖范围**: 完整用户流程
- **测试工具**: Playwright
- **运行命令**: `bun run test:e2e`

### 测试覆盖率
- **目标覆盖率**: >= 80%
- **关键模块覆盖率**: >= 90%
- **覆盖率报告**: `bun run test:coverage`

---

## 🔒 安全和隐私

### 数据安全
- **本地存储**: 所有数据存储在用户本地 Chrome 配置中
- **无服务器**: 不向任何外部服务器发送用户数据
- **权限最小化**: 只申请必要的 Chrome API 权限

### 隐私保护
- **零数据收集**: 不收集任何用户行为数据
- **离线工作**: 完全离线运行，无网络依赖
- **开源透明**: 源代码完全开放，可审计

### 权限说明
```json
{
  "permissions": ["bookmarks", "storage"],
  "host_permissions": ["http://localhost:3000/*"]
}
```

- `bookmarks`: 读取和修改书签数据
- `storage`: 本地存储扩展设置
- `localhost`: 仅用于开发环境调试

---

## 📊 性能指标

### 关键性能指标 (KPI)

#### 1. 加载性能
- **页面加载时间**: < 500ms
- **首次内容绘制 (FCP)**: < 300ms
- **最大内容绘制 (LCP)**: < 800ms

#### 2. 运行时性能
- **内存占用**: < 50MB
- **CPU 使用率**: < 5% (空闲时)
- **响应时间**: < 100ms (用户交互)

#### 3. 扩展包大小
- **总包大小**: < 2MB
- **核心 JS**: < 500KB
- **样式文件**: < 200KB

### 性能优化策略
1. **代码分割**: 按需加载非关键功能
2. **资源压缩**: Gzip/Brotli 压缩
3. **缓存策略**: 智能缓存减少重复计算
4. **虚拟化**: 大数据集的虚拟滚动

---

## 🐛 已知问题和限制

### 当前限制
1. **大量书签性能**: 超过 1000 个书签时可能出现性能问题
2. **拖拽复杂度**: 深层嵌套文件夹的拖拽体验有待优化
3. **浏览器兼容**: 仅支持基于 Chromium 的浏览器

### 已知问题
1. **Vue 框架性能问题** (已解决)
   - 问题: Vue 组件递归渲染导致页面卡顿
   - 解决方案: 迁移到原生 HTML/JS 实现

2. **资源 404 错误** (已解决)
   - 问题: logo.svg 文件缺失导致加载缓慢
   - 解决方案: 更新构建脚本自动复制资源

### 未来改进计划
1. **性能优化**: 实现虚拟滚动和懒加载
2. **功能增强**: 添加搜索、过滤、标签功能
3. **用户体验**: 改进拖拽交互和视觉反馈

---

## 🔄 版本历史

### v2.0.0 (当前版本)
- **重大更新**: 从 Vue 框架迁移到原生 HTML/JS
- **性能提升**: 页面加载速度提升 80%
- **架构优化**: 简化技术栈，提高维护性
- **开发体验**: 统一使用 Bun 作为运行时和包管理器

### v1.x.x (历史版本)
- **Vue 实现**: 使用 Vue 3 + Vuetify 框架
- **功能完整**: 实现了完整的书签管理功能
- **性能问题**: 在大量书签时存在性能瓶颈

---

## 🤝 贡献指南

### 开发流程
1. **Fork** 项目到个人仓库
2. **创建** 功能分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 更改 (`git commit -m 'Add some AmazingFeature'`)
4. **推送** 到分支 (`git push origin feature/AmazingFeature`)
5. **创建** Pull Request

### 代码规范
- **命名约定**: 使用 camelCase (JavaScript) 和 kebab-case (CSS)
- **注释规范**: 使用 JSDoc 格式注释
- **提交信息**: 使用约定式提交格式

### 测试要求
- **新功能**: 必须包含单元测试
- **Bug 修复**: 必须包含回归测试
- **覆盖率**: 不得降低现有测试覆盖率

---

## 📞 支持和联系

### 技术支持
- **GitHub Issues**: [项目问题追踪](https://github.com/your-username/acuityBookmarks/issues)
- **文档中心**: [在线文档](https://your-docs-site.com)
- **社区论坛**: [用户社区](https://your-community.com)

### 联系方式
- **项目维护者**: [您的姓名]
- **邮箱**: your-email@example.com
- **Twitter**: @your-twitter-handle

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🙏 致谢

感谢所有为项目做出贡献的开发者和用户，特别感谢：
- Chrome 扩展开发社区
- Vue.js 和 Vite 开发团队
- Bun.js 运行时项目
- 所有提供反馈和建议的用户

---

*最后更新: 2024年1月*
