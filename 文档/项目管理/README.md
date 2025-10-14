# 📚 项目管理文档索引

> AcuityBookmarks 项目架构与规范文档

---

## 🎯 快速导航

### 🚀 新人必读

1. **[架构规范 - 快速开始](./架构规范-快速开始.md)** ⭐️ **首选**
   - 5分钟快速了解架构规范
   - 组件开发快速上手
   - 常见错误与正确做法

2. **[src目录架构说明](./src目录架构说明.md)**
   - 完整的目录结构说明
   - 四层架构详解
   - 各目录定位和职责

3. **[单向数据流架构说明](../../单向数据流架构说明.md)**
   - 数据流核心原则
   - 典型场景演示
   - 调试指南

---

## 📖 核心文档

### 架构设计

| 文档                                              | 内容                     | 适用人群          |
| ------------------------------------------------- | ------------------------ | ----------------- |
| [src目录架构说明](./src目录架构说明.md)           | 完整的架构说明和目录定位 | 所有开发者        |
| [单向数据流架构说明](../../单向数据流架构说明.md) | 数据流原则和实现细节     | 所有开发者        |
| [架构可视化对比](./架构可视化对比.md)             | 优化前后的架构对比       | 架构师、Tech Lead |

### 规范与标准

| 文档                                               | 内容                     | 适用人群         |
| -------------------------------------------------- | ------------------------ | ---------------- |
| [组件与页面规范化方案](./组件与页面规范化方案.md)  | 组件分类、规范、迁移计划 | 前端开发者       |
| [架构规范 - 快速开始](./架构规范-快速开始.md)      | 快速上手指南             | 新人、所有开发者 |
| [脚手架脚本说明](../../frontend/scripts/README.md) | 组件和页面创建脚本       | 前端开发者       |

### 实施指南

| 文档                                      | 内容                 | 适用人群              |
| ----------------------------------------- | -------------------- | --------------------- |
| [架构优化实施指南](./架构优化实施指南.md) | 逐步重构的详细步骤   | Tech Lead、核心开发者 |
| [架构优化行动计划](./架构优化行动计划.md) | 重构的时间线和优先级 | 项目经理、Tech Lead   |
| [架构优化速查表](./架构优化速查表.md)     | 快速参考手册         | 所有开发者            |

---

## 🏗️ 架构概览

### 核心架构

```
┌─────────────────────────────────────┐
│  Presentation (表现层)               │
│  • pages/ - 页面                     │
│  • components/ - 组件                │
│  • stores/ - 状态管理                │
└──────────────┬──────────────────────┘
               ↓ 依赖
┌─────────────────────────────────────┐
│  Application (应用层)                │
│  • 用例编排                          │
│  • 协调多个服务                       │
└──────────────┬──────────────────────┘
               ↓ 依赖
┌─────────────────────────────────────┐
│  Core (核心业务层)                   │
│  • 框架无关的业务逻辑                 │
│  • 领域模型和服务                     │
└──────────────┬──────────────────────┘
               ↓ 依赖
┌─────────────────────────────────────┐
│  Infrastructure (基础设施层)         │
│  • IndexedDB、Chrome API、Logger     │
└─────────────────────────────────────┘
```

### 单向数据流

```
Chrome API → Background → IndexedDB → UI
```

**核心规则**:

- ✅ UI 只从 IndexedDB 读取
- ✅ UI 只写入 Chrome API
- ❌ 永远不要逆向数据流

---

## 🧩 组件体系

### 组件分类

```
components/
├── base/              # 基础 UI 组件
│   ├── Button/        # 纯展示，无业务逻辑
│   ├── Input/         # 可在任何项目复用
│   └── ...
│
└── composite/         # 复合组件
    ├── BookmarkTree/  # 包含业务逻辑
    ├── SearchPanel/   # 组合多个基础组件
    └── ...
```

### 组件规范

每个组件必须包含：

```
Component/
├── Component.vue       # ✅ 组件实现
├── Component.types.ts  # ✅ TypeScript 类型
└── README.md           # ✅ 使用文档
```

---

## 🛠️ 开发工具

### 脚手架脚本

```bash
# 创建基础组件
./frontend/scripts/create-base-component.sh MyButton

# 创建复合组件
./frontend/scripts/create-composite-component.sh SearchPanel

# 创建页面
./frontend/scripts/create-page.sh my-feature
```

详见：[脚手架脚本说明](../../frontend/scripts/README.md)

---

## 📅 重构进度

### ✅ 已完成

- [x] 四层架构设计
- [x] 单向数据流机制
- [x] 组件分类体系
- [x] 脚手架脚本
- [x] 完整的文档体系

### 🚧 进行中

- [ ] 页面迁移到 `pages/` 目录
- [ ] 基础组件规范化（添加类型文件和文档）
- [ ] 复合组件重构

### 📋 计划中

- [ ] Store 精简（移除业务逻辑）
- [ ] 统一搜索系统
- [ ] 完整的单元测试覆盖

---

## 🎓 学习路径

### 第一天

1. 阅读 [架构规范 - 快速开始](./架构规范-快速开始.md)（15分钟）
2. 阅读 [src目录架构说明](./src目录架构说明.md)（30分钟）
3. 尝试创建一个基础组件（30分钟）

### 第一周

1. 深入理解 [单向数据流架构说明](../../单向数据流架构说明.md)
2. 查看现有代码示例
3. 参与一个小功能的开发

### 第一个月

1. 熟悉所有架构层级
2. 独立完成功能开发
3. 参与代码评审

---

## 📋 代码规范清单

### 组件开发

- [ ] 使用脚手架脚本创建组件
- [ ] 完善 `.types.ts` 类型定义
- [ ] 编写 `README.md` 文档
- [ ] 基础组件无业务逻辑
- [ ] 复合组件通过 inject 获取服务
- [ ] 在 `components/index.ts` 中导出

### 数据访问

- [ ] UI 从 IndexedDB 读取数据
- [ ] 使用 `indexedDBManager.getAllBookmarks()`
- [ ] 不直接调用 `chrome.bookmarks.getTree()`
- [ ] 监听 `AB_EVENTS.BOOKMARKS_DB_SYNCED` 事件

### Store 开发

- [ ] Store 只管理 UI 状态
- [ ] 委托业务逻辑给 Application 层
- [ ] 不包含复杂的算法逻辑

---

## 🔍 常见场景

### 场景 1: 我要创建一个新按钮组件

```bash
# 1. 创建基础组件
./frontend/scripts/create-base-component.sh CustomButton

# 2. 实现组件
# 编辑 components/base/CustomButton/CustomButton.vue

# 3. 导出组件
# 在 components/index.ts 中添加导出

# 4. 使用
import { CustomButton } from '@/components'
```

### 场景 2: 我要读取书签数据

```typescript
// ✅ 正确
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
const bookmarks = await indexedDBManager.getAllBookmarks()

// ❌ 错误
const tree = await chrome.bookmarks.getTree()
```

### 场景 3: 我要创建一个新书签

```typescript
// ✅ 正确（Background 会自动同步到 IndexedDB）
await chrome.bookmarks.create({
  parentId: folderId,
  title: 'New Bookmark',
  url: 'https://example.com'
})

// 等待同步完成事件
window.addEventListener(AB_EVENTS.BOOKMARKS_DB_SYNCED, () => {
  // 从 IndexedDB 刷新数据
  await refreshData()
})
```

---

## ❓ 常见问题

**Q: 我的组件应该放在 base 还是 composite？**

- 如果是纯 UI 组件，无业务逻辑 → `base/`
- 如果包含业务逻辑或组合多个组件 → `composite/`

**Q: 我可以在 Store 中写业务逻辑吗？**

- 不可以。Store 只管理 UI 状态
- 业务逻辑应该在 `application/` 或 `core/` 层

**Q: 如何确保遵循单向数据流？**

- 记住：Chrome API → IndexedDB → UI
- UI 只从 IndexedDB 读，只写 Chrome API

**Q: 现有代码需要立即重构吗？**

- 不需要。可以逐步迁移，新旧代码并存

---

## 📞 联系方式

- **问题反馈**: 提交 Issue
- **架构讨论**: [待定]
- **文档贡献**: 提交 Pull Request

---

## 🔄 文档更新

| 日期       | 内容           | 作者 |
| ---------- | -------------- | ---- |
| 2025-10-14 | 创建文档索引   | Team |
| 2025-10-14 | 完善组件规范   | Team |
| 2025-10-14 | 添加脚手架脚本 | Team |

---

**开始你的开发之旅！** 🚀
