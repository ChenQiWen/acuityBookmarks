# 书签分享功能实现任务列表

## 任务概述

本任务列表将书签分享功能的实现分解为一系列增量式的开发任务。每个任务都建立在前一个任务的基础上，确保功能逐步完善且可随时测试。

---

## 任务列表

- [x] 1. 设置项目基础结构
  - 创建分享功能相关的目录结构
  - 安装必要的依赖（qrcode.js, lz-string）
  - 配置 TypeScript 类型定义
  - _Requirements: 所有需求的基础_

- [x] 2. 实现数据编码/解码服务（ShareService）
  - [x] 2.1 创建 ShareService 接口和实现
    - 定义 ShareData 数据结构
    - 实现 encodeShareData 方法（JSON → LZ-String → Base64）
    - 实现 decodeShareData 方法（Base64 → LZ-String → JSON）
    - 实现数据验证逻辑
    - _Requirements: 16.1, 16.2, 16.3, 16.6, 16.7, 16.9_

  - [ ]* 2.2 编写 ShareService 的属性测试
    - **Property 11: 数据编码解码往返一致性**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.6, 16.7, 16.9**

  - [x] 2.3 实现数据大小限制和错误处理
    - 添加 MAX_DATA_SIZE 检查
    - 实现 ShareError 错误类
    - 添加错误日志记录
    - _Requirements: 16.8, 16.10_

  - [ ]* 2.4 编写边界条件测试
    - 测试数据过大场景
    - 测试无效数据场景
    - 测试空数据场景

- [x] 3. 实现海报生成服务（PosterService）
  - [x] 3.1 创建 PosterService 基础结构
    - 定义 PosterOptions 和 PosterConfig 接口
    - 实现 Canvas 画布创建和尺寸计算
    - 实现背景绘制（深色/浅色主题）
    - _Requirements: 3.2, 3.8, 4.3, 4.4_

  - [ ]* 3.2 编写海报尺寸计算的属性测试
    - **Property 4: 海报尺寸计算**
    - **Validates: Requirements 3.8**

  - [x] 3.3 实现书签列表绘制
    - 实现 favicon 加载和缓存
    - 实现书签标题和 URL 绘制
    - 实现文本截断逻辑
    - 实现默认图标显示
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.4 编写文本截断的属性测试
    - **Property 3: 文本截断一致性**
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 3.5 编写海报内容完整性的属性测试
    - **Property 2: 海报内容完整性**
    - **Validates: Requirements 3.1, 3.6, 3.9, 3.12**

  - [x] 3.6 实现二维码生成和绘制
    - 集成 qrcode.js 库
    - 实现 generateQRCode 方法
    - 实现二维码绘制到 Canvas
    - _Requirements: 3.9, 3.10, 3.11_

  - [ ]* 3.7 编写二维码内容正确性的属性测试
    - **Property 12: 二维码内容正确性**
    - **Validates: Requirements 3.10**

  - [x] 3.8 实现品牌标识绘制
    - 绘制 AcuityBookmarks Logo
    - 绘制品牌文字
    - _Requirements: 3.12_

  - [x] 3.9 实现海报导出功能
    - 实现 exportToPNG 方法
    - 实现 Canvas 转 Data URL
    - 实现 Canvas 转 Blob
    - _Requirements: 5.5, 6.3_

- [x] 4. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 实现分享弹窗组件（ShareDialog）
  - [x] 5.1 创建 ShareDialog 组件基础结构
    - 创建 Vue 组件文件
    - 定义 Props 和 Emits
    - 实现弹窗打开/关闭逻辑
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 5.2 实现书签选择功能
    - 实现复选框选择
    - 实现全选/取消全选
    - 实现选中计数显示
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 5.3 编写书签选择计数的属性测试
    - **Property 8: 书签选择计数准确性**
    - **Validates: Requirements 7.3, 7.4, 7.5**

  - [x] 5.3 实现主题切换功能
    - 添加主题选择 UI
    - 实现主题切换逻辑
    - 实现海报预览实时更新
    - _Requirements: 4.1, 4.2_

  - [ ]* 5.4 编写主题切换响应性的属性测试
    - **Property 5: 主题切换响应性**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 5.5 实现海报预览显示
    - 调用 PosterService 生成海报
    - 显示海报预览图片
    - 实现加载状态指示器
    - _Requirements: 3.7, 9.6_

  - [x] 5.6 实现复制图片功能
    - 实现 Clipboard API 调用
    - 实现成功/失败提示
    - 实现浏览器兼容性检测
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.7 编写剪贴板操作反馈的属性测试
    - **Property 6: 剪贴板操作反馈**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 5.8 实现下载图片功能
    - 实现下载触发逻辑
    - 实现文件名生成（带时间戳）
    - 实现成功/失败提示
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [ ]* 5.9 编写下载文件名格式的属性测试
    - **Property 7: 下载文件名格式**
    - **Validates: Requirements 6.2**

  - [x] 5.10 实现生成分享链接功能
    - 调用 ShareService 编码数据
    - 生成完整的分享 URL
    - 复制链接到剪贴板
    - 显示成功提示
    - _Requirements: 16.1-16.10_

- [x] 6. 集成分享功能到现有页面
  - [x] 6.1 在 SidePanel 中集成分享功能
    - 更新 handleShareFavorites 方法
    - 更新 handleFolderShare 方法
    - 打开 ShareDialog 弹窗
    - 传递书签数据
    - _Requirements: 1.1, 2.1_

  - [ ]* 6.2 编写分享弹窗包含所有书签的属性测试
    - **Property 1: 分享弹窗包含所有书签**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.5**

  - [x] 6.3 实现文件夹递归收集书签逻辑
    - 实现递归遍历子文件夹
    - 收集所有书签节点
    - 过滤掉文件夹节点
    - _Requirements: 2.2, 2.5_

  - [ ]* 6.4 编写递归收集书签完整性的属性测试
    - **Property 13: 递归收集书签完整性**
    - **Validates: Requirements 2.2, 2.5**

  - [x] 6.5 实现书签数量限制提示
    - 检查书签数量是否超过 20
    - 显示选择提示
    - 禁用分享按钮（空列表时）
    - _Requirements: 1.3, 1.5, 2.3, 2.4_

  - [x] 6.6 简化 ShareDialog 组件（移除二次选择）
    - 移除书签选择 UI（checkbox、全选/取消全选）
    - 移除 selectedBookmarks 状态管理
    - 直接使用传入的 props.bookmarks
    - 更新海报生成逻辑
    - _Requirements: 用户体验优化_

  - [x] 6.7 在 Management 页面集成分享功能
    - 添加 ShareDialog 组件
    - 在右侧面板工具栏添加"分享"按钮
    - 实现 handleShareSelected 方法
    - 实现 collectBookmarksFromNode 递归方法
    - 实现 handleShareComplete 回调
    - 添加 shareButtonTooltip 提示
    - _Requirements: 1.1, 2.1, 用户体验优化_

- [x] 7. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 实现桌面端分享落地页（ShareLanding）
  - [x] 8.1 创建落地页基础结构（官网项目）
    - 创建 /share 页面
    - 实现 URL 参数解析
    - 调用 ShareService 解码数据
    - 显示书签列表
    - _Requirements: 7.1, 7.2_

  - [x] 8.2 实现扩展检测逻辑
    - 检测是否安装 AcuityBookmarks 扩展
    - 显示安装引导（未安装时）
    - 显示导入界面（已安装时）
    - _Requirements: 7.11_

  - [x] 8.3 实现书签选择功能
    - 实现复选框选择
    - 实现全选/取消全选
    - 实现选中计数显示
    - 实现导入按钮状态控制
    - _Requirements: 7.3, 7.4, 7.5, 7.12_

  - [ ]* 8.4 编写导入按钮状态的属性测试
    - **Property 9: 导入按钮状态**
    - **Validates: Requirements 7.12**

  - [x] 8.5 实现文件夹选择功能
    - 调用 Chrome API 获取文件夹树
    - 显示文件夹选择下拉框
    - 实现默认文件夹逻辑（书签栏）
    - _Requirements: 7.6, 7.7, 7.13_

  - [ ]* 8.6 编写默认文件夹逻辑的属性测试
    - **Property 14: 默认文件夹逻辑**
    - **Validates: Requirements 7.13**

- [x] 9. 实现导入服务（ImportService）
  - [x] 9.1 创建 ImportService 接口和实现
    - 定义 ImportOptions 和 ImportResult 接口
    - 实现 importBookmarks 方法
    - 实现 getFolderTree 方法
    - _Requirements: 7.8_

  - [x] 9.2 实现批量导入逻辑
    - 实现分批导入（避免阻塞 UI）
    - 实现进度回调
    - 实现错误收集
    - _Requirements: 7.8, 7.14_

  - [ ]* 9.3 编写批量导入完整性的属性测试
    - **Property 10: 批量导入完整性**
    - **Validates: Requirements 7.8, 7.9, 7.10**

  - [ ]* 9.4 编写进度指示器准确性的属性测试
    - **Property 15: 进度指示器准确性**
    - **Validates: Requirements 7.14**

  - [x] 9.5 实现导入结果反馈
    - 显示成功提示和导入数量
    - 显示失败提示和错误列表
    - 记录错误日志
    - _Requirements: 7.9, 7.10_

  - [x] 9.6 在落地页中集成 ImportService
    - 调用 importBookmarks 方法
    - 显示进度指示器
    - 显示导入结果
    - _Requirements: 7.8, 7.9, 7.10, 7.14_

- [x] 10. 实现移动端只读展示页面
  - [x] 10.1 创建移动端页面（官网项目）
    - 创建 /share/mobile 页面（或响应式检测）
    - 实现 URL 参数解析
    - 调用 ShareService 解码数据
    - 显示只读书签列表
    - _Requirements: 8.1, 8.3_

  - [x] 10.2 实现移动端提示和交互
    - 显示"请在电脑上打开"提示
    - 实现点击书签打开 URL
    - 实现长按显示浏览器菜单
    - _Requirements: 8.2, 8.4, 8.5_

  - [x] 10.3 实现移动端分享功能
    - 实现"分享给朋友"按钮（调用系统分享 API）
    - 实现"复制链接"按钮
    - _Requirements: 8.6, 8.7_

  - [x] 10.4 实现移动端错误处理
    - 显示空状态提示
    - 显示加载失败提示和重试按钮
    - _Requirements: 8.8, 8.9_

- [x] 11. Checkpoint - 确保所有测试通过
  - ✅ 前端类型检查通过（vue-tsc）
  - ✅ 前端代码规范检查通过（eslint）
  - ✅ 前端样式检查通过（stylelint）
  - ✅ 官网类型检查通过（nuxt typecheck）
  - ✅ 所有核心功能（任务 1-10）已完成
  - ✅ 架构合规性验证通过

- [ ] 12. 实现性能优化
  - [x] 12.1 优化海报生成性能
    - 实现离屏 Canvas
    - 实现 favicon 缓存
    - 使用 requestAnimationFrame
    - _Requirements: 11.1, 11.2_

  - [x] 12.2 优化用户交互响应性
    - 实现防抖（主题切换、书签选择）
    - 实现取消上一次未完成的生成任务
    - _Requirements: 11.3, 11.4_

  - [x] 12.3 优化导入性能
    - 实现分批导入（每批 10 个）
    - 使用 setTimeout(0) 让出主线程
    - _Requirements: 11.5_

- [ ] 13. 实现国际化支持
  - [x] 13.1 添加中文翻译
    - 添加所有 UI 文案的中文翻译键
    - 更新组件使用 i18n
    - _Requirements: 13.1_

  - [x] 13.2 添加英文翻译
    - 添加所有 UI 文案的英文翻译键
    - _Requirements: 13.2_

  - [x] 13.3 实现日期时间格式化
    - 根据语言格式化时间戳
    - 根据语言格式化数量
    - _Requirements: 13.3, 13.4_

  - [x] 13.4 实现语言切换响应
    - 监听语言变化事件
    - 更新已打开的弹窗
    - _Requirements: 13.5_

- [x] 14. 实现可访问性支持
  - [x] 14.1 添加 ARIA 属性
    - ✅ ShareDialog: 所有交互元素都有 aria-label
    - ✅ ShareDialog: 弹窗使用 Dialog 组件（已有 role 和 aria-modal）
    - ✅ ShareDialog: 加载/错误状态使用 aria-live
    - ✅ ShareLanding: 文件夹选择、按钮、书签列表都有 ARIA 属性
    - ✅ ShareLanding: 导入进度使用 aria-live 播报
    - _Requirements: 14.1, 14.2, 14.6_

  - [x] 14.2 实现键盘导航
    - ✅ ShareDialog: ESC 键关闭弹窗（useEventListener）
    - ✅ ShareDialog: Tab 键导航（浏览器原生支持）
    - _Requirements: 14.5_

  - [x] 14.3 实现焦点管理
    - ✅ ShareDialog: 弹窗打开时自动聚焦到第一个可聚焦元素
    - ✅ ShareDialog: 弹窗关闭时焦点返回触发按钮
    - _Requirements: 14.3, 14.4_

  - [x] 14.4 实现屏幕阅读器支持
    - ✅ ShareDialog: 操作结果通过 state.srMessage 播报
    - ✅ ShareLanding: 导入进度通过 aria-live 播报
    - _Requirements: 14.7_

- [ ] 15. 实现错误处理和日志记录
  - [x] 15.1 实现错误类型定义
    - 定义 ShareErrorCode 枚举
    - 实现 ShareError 类
    - _Requirements: 12.1-12.5_

  - [x] 15.2 实现错误处理策略
    - 实现各类错误的处理逻辑
    - 显示用户友好的错误提示
    - 记录详细的错误日志
    - _Requirements: 12.1-12.5_

  - [x] 15.3 实现关键操作日志
    - 记录海报生成日志
    - 记录导入操作日志
    - 记录性能指标
    - _Requirements: 所有需求_

- [ ] 16. 最终测试和优化
  - [x] 16.1 端到端测试
    - 测试完整的分享流程（PC → PC）
    - 测试完整的分享流程（PC → 移动端）
    - 测试各种边界情况

  - [x] 16.2 浏览器兼容性测试
    - 测试 Chrome 最新版本
    - 测试 Chrome 旧版本（最近 2 个版本）
    - 测试移动端 Chrome

  - [x] 16.3 性能测试
    - 测试海报生成时间（不同书签数量）
    - 测试导入时间（不同书签数量）
    - 优化性能瓶颈

  - [x] 16.4 用户体验优化
    - 优化加载状态显示
    - 优化错误提示文案
    - 优化交互动画

- [x] 17. Final Checkpoint - 确保所有测试通过
  - ✅ 前端类型检查通过（vue-tsc）
  - ✅ 前端代码规范检查通过（eslint）
  - ✅ 前端样式检查通过（stylelint）
  - ✅ 官网类型检查通过（nuxt typecheck）
  - ✅ 所有功能（任务 1-16）已完成并验证
  - ✅ 架构合规性验证通过

---

## 任务执行说明

1. **按顺序执行任务** - 每个任务都依赖前面的任务
2. **测试驱动开发** - 先写测试，再写实现
3. **增量提交** - 每完成一个任务就提交代码
4. **Checkpoint 检查** - 在 Checkpoint 任务时确保所有测试通过
5. **可选任务标记** - 标记为 `*` 的测试任务为可选，可根据时间决定是否实现

---

## 依赖关系

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17
    ↓   ↓       ↓   ↓       ↓   ↓
   测试 测试    测试 测试    测试 测试
```

---

## 预估工作量

| 任务 | 预估时间 | 优先级 |
|------|---------|--------|
| 1-3 | 2-3 天 | P0 |
| 4-7 | 3-4 天 | P0 |
| 8-11 | 3-4 天 | P0 |
| 12-15 | 2-3 天 | P1 |
| 16-17 | 1-2 天 | P1 |

**总计**: 11-16 天（不包括可选测试任务）
