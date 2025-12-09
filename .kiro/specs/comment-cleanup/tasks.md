# Implementation Plan

## Phase 1: Core Layer (核心层)

- [x] 1. 清理 core/ 目录注释
  - [x] 1.1 清理 core/common/ 目录
    - 审查 logger.ts、result.ts、store-error.ts 的注释
    - 验证 JSDoc 参数和返回值描述
    - 删除过时的 TODO/FIXME
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_
  - [x] 1.2 清理 core/bookmark/ 目录
    - 审查 domain/、repositories/、services/ 子目录
    - 确保领域模型注释准确描述业务规则
    - 验证类型引用有效性
    - _Requirements: 1.1, 1.4, 1.5, 7.1, 7.2_
  - [x] 1.3 清理 core/filter/ 目录
    - 审查 bookmark-filter.ts 注释
    - 确保使用「筛选」而非「搜索」术语（当前已符合规范）
    - _Requirements: 2.5_
  - [x] 1.4 清理 core/query-engine/ 目录
    - 审查 engine.ts、unified-query-service.ts、query-cache.ts、highlight.ts、unified-query-types.ts
    - 审查 strategies/ 子目录
    - 验证查询引擎注释与实现一致
    - 确保术语一致性
    - _Requirements: 1.1, 1.2, 2.5_
  - [x] 1.5 清理 core/ai/ 目录
    - 审查 prompts.ts 注释
    - _Requirements: 1.1_

- [x] 2. Checkpoint - 确保 core 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Application Layer (应用层)

- [x] 3. 清理 application/ 目录注释
  - [x] 3.1 清理 application/bookmark/ 目录
    - 审查 bookmark-app-service.ts、tree-app-service.ts、bookmark-change-app-service.ts、bookmark-diff-service.ts、favorite-app-service.ts
    - 验证应用服务注释描述的业务流程
    - 确保数据流描述符合单向数据流架构
    - _Requirements: 1.1, 1.2, 2.1, 2.4_
  - [x] 3.2 清理 application/query/ 目录
    - 审查 query-app-service.ts、bookmark-query-service.ts
    - 确保使用「筛选」术语（query-app-service.ts 已有正确注释）
    - _Requirements: 1.1, 2.5_
  - [x] 3.3 清理 application/cleanup/ 目录
    - 审查 cleanup-app-service.ts
    - _Requirements: 1.1, 1.2_
  - [x] 3.4 清理 application/ai/ 目录
    - 审查 ai-app-service.ts、llm-response-validator.ts
    - 更新「语义搜索」相关注释为「语义筛选」或保留技术术语
    - 删除过时的 CHANGELOG.md、IMPLEMENTATION_STATUS.md、FEATURE_DESIGN.md、SCENARIOS_COMPARISON.md、BUGFIX_ADD_BOOKMARK.md 等文档
    - _Requirements: 1.1, 2.5, 3.1, 4.1_
  - [x] 3.5 清理 application/ 其他子目录
    - 审查 health/health-app-service.ts
    - 审查 settings/settings-app-service.ts
    - 审查 subscription/subscription-app-service.ts
    - 审查 notification/notification-service.ts
    - 审查 font/font-service.ts
    - 审查 scheduler/scheduler-service.ts
    - _Requirements: 1.1, 1.2_

- [x] 4. Checkpoint - 确保 application 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Infrastructure Layer (基础设施层)

- [x] 5. 清理 infrastructure/ 目录注释
  - [x] 5.1 清理 infrastructure/indexeddb/ 目录
    - 审查 manager.ts、schema.ts、connection-pool.ts、transaction-manager.ts
    - 审查 types/、validation/ 子目录
    - 确保 IndexedDB 操作注释准确
    - 验证类型定义注释与实际类型一致
    - _Requirements: 1.1, 1.2, 2.3, 7.1_
  - [x] 5.2 清理 infrastructure/events/ 目录
    - 审查 event-bus.ts、chrome-message-bridge.ts、event-stream.ts
    - 确保事件系统注释准确描述 mitt 用法
    - _Requirements: 1.1, 1.2_
  - [x] 5.3 清理 infrastructure/storage/ 目录
    - 审查 modern-storage.ts
    - 确保存储 API 注释正确区分 session/local
    - _Requirements: 1.1, 5.3_
  - [x] 5.4 清理 infrastructure/state/ 目录
    - 审查 immer-helpers.ts
    - 确保 Immer 用法注释准确
    - _Requirements: 1.1, 1.2_
  - [x] 5.5 清理 infrastructure/ 其他子目录
    - 审查 chrome-api/message-client.ts
    - 审查 http/（api-client.ts、error-codes.ts、proxy-api.ts、safe-fetch.ts）
    - 审查 llm/（backend-llm-client.ts、builtin-llm-client.ts、llm-adapter.ts）
    - 审查 logging/（error-handler.ts、logger.ts）
    - 审查 query/（plugin.ts、query-client.ts）
    - 审查 i18n/i18n-service.ts
    - 审查 supabase/（client.ts、types.ts）
    - 审查 gumroad/client.ts
    - 审查 global-state/global-state-manager.ts
    - _Requirements: 1.1, 1.2_

- [x] 6. Checkpoint - 确保 infrastructure 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Background Scripts (后台脚本)

- [x] 7. 清理 background/ 目录注释
  - [x] 7.1 清理 background/bookmarks.ts
    - 验证书签监听器注释符合单向数据流
    - 确保不引用 window/document/localStorage（当前已符合规范）
    - _Requirements: 2.1, 2.2, 5.1, 5.2, 5.3_
  - [x] 7.2 清理 background/messaging.ts
    - 验证消息通信注释准确
    - _Requirements: 1.1, 5.1_
  - [x] 7.3 清理 background/main.ts 和 bootstrap.ts
    - 验证初始化流程注释
    - _Requirements: 1.1, 5.1_
  - [x] 7.4 清理 background/ 其他文件
    - 审查 state.ts、crawler-manager.ts、data-health-check.ts、menus.ts、navigation.ts、notification.ts、offscreen-manager.ts、omnibox.ts
    - 确保所有文件不引用 Service Worker 不可用的 API（当前已符合规范）
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. Checkpoint - 确保 background 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: State Management (状态管理)

- [x] 9. 清理 stores/ 目录注释
  - [x] 9.1 清理 stores/bookmarkStore.ts
    - 验证书签状态管理注释
    - 确保数据流描述正确（从 IndexedDB 加载）
    - _Requirements: 1.1, 2.1, 2.3_
  - [x] 9.2 清理 stores/bookmark/ 目录
    - 审查 bookmark-management-store.ts
    - _Requirements: 1.1, 1.2_
  - [x] 9.3 清理 stores/cleanup/ 目录
    - 审查 cleanup-store.ts
    - _Requirements: 1.1_
  - [x] 9.4 清理 stores/ 其他文件
    - 审查 ui-store.ts、popup-store-indexeddb.ts
    - 审查 query-store/query-store.ts
    - 审查 ui/dialog-store.ts
    - _Requirements: 1.1, 1.2_

- [x] 10. 清理 services/ 目录注释
  - [x] 10.1 清理 services/bookmark-sync-service.ts
    - 验证同步服务注释符合单向数据流
    - 确保增量/全量同步描述准确
    - _Requirements: 1.1, 2.1_
  - [x] 10.2 清理 services/modern-bookmark-service.ts
    - 验证书签服务注释
    - 审查 TODO 注释（第 404 行：时间相关性加权）是否仍有效
    - _Requirements: 1.1, 1.2, 3.4_
  - [x] 10.3 清理 services/ 其他文件
    - 审查 favicon-service.ts（含 TODO 第 403 行：实现批量删除）
    - 审查 navigation-service.ts、data-health-client.ts、bookmark-health-service.ts、bookmark-index-service.ts
    - 审查 crawl-task-scheduler.ts（含 TODO 第 861 行：显示通知让用户选择）
    - 审查 smart-recommendation-engine.ts（含多个 TODO：contextWeight、tags、preferredCategories）
    - 审查 query-worker-adapter.ts（含「搜索」术语需评估）
    - 审查 trpc.ts（含 TODO 第 10 行：Replace with actual production backend URL）
    - 审查 background-crawler-client.ts、health-scan-worker-service.ts、local-bookmark-crawler.ts、local-crawler-worker.ts、query-performance-monitor.ts
    - _Requirements: 1.1, 1.2, 2.5, 3.1, 3.4_

- [x] 11. Checkpoint - 确保 stores 和 services 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Presentation Layer (表现层)

- [x] 12. 清理 composables/ 目录注释
  - [x] 12.1 清理核心 composables
    - 审查 useBookmarkQueries.ts、useBookmarkSearch.ts、useCrossPageSync.ts
    - 确保使用「筛选」术语
    - _Requirements: 1.1, 2.5_
  - [x] 12.2 清理键盘相关 composables
    - 审查 useKeyboard.ts、useManagementKeyboard.ts、usePopupKeyboard.ts、usePopupKeyboard.v2.ts、useSidePanelKeyboard.ts、useSettingsKeyboard.ts、useTreeKeyboard.ts
    - 审查 useKeyboardHelp.ts、useKeyboardModifier.ts、useCommandsShortcuts.ts
    - _Requirements: 1.1_
  - [x] 12.3 清理其他 composables
    - 审查 useCrawler.ts、useNotification.ts、useSubscription.ts
    - 审查 useSupabaseAuth.ts、useSupabaseAuth-oauth-new.ts、useSupabaseMFA.ts
    - 审查 useLazyFavicon.ts、useGlobalSyncProgress.ts、useSimplePerformance.ts
    - _Requirements: 1.1, 1.2_

- [x] 13. 清理 presentation/ 目录注释
  - [x] 13.1 清理 presentation/adapters/ 目录
    - 审查 bookmark-adapter.ts（含「搜索」术语需更新为「筛选」）
    - 审查 notification-adapter.ts
    - 确保不直接调用 Chrome API 或 IndexedDB
    - _Requirements: 1.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 13.2 清理 presentation/composables/ 目录
    - 审查 useBookmarkData.ts、useNotification.ts
    - _Requirements: 1.1_

- [x] 14. 清理 components/ 目录注释
  - [x] 14.1 清理 components/base/ 目录
    - 审查基础组件注释（Alert、Button、Card、Dialog、Input 等）
    - _Requirements: 1.1, 6.1_
  - [x] 14.2 清理 components/composite/ 目录
    - 审查 BookmarkTree/、BookmarkSearchInput/、BookmarkRecommendations/、QuickAddBookmarkDialog/
    - 确保组件注释准确
    - _Requirements: 1.1, 1.2, 6.1_
  - [x] 14.3 清理 components/ 根目录文件
    - 审查 GlobalQuickAddBookmark.vue、GlobalSyncProgress.vue
    - _Requirements: 1.1_

- [x] 15. 清理 pages/ 目录注释
  - [x] 15.1 清理 pages/management/ 目录
    - 审查 Management.vue、cleanup/ 子目录
    - _Requirements: 1.1, 6.1_
  - [x] 15.2 清理 pages/popup/ 目录
    - 审查 Popup.vue、types.ts
    - _Requirements: 1.1, 6.1_
  - [x] 15.3 清理 pages/ 其他目录
    - 审查 auth/Auth.vue
    - 审查 settings/Settings.vue、sections/ 子目录
    - 审查 side-panel/SidePanel.vue、components/ 子目录
    - 审查 onboarding/（App.vue、Onboarding.vue、composables/）
    - 审查 icon-preview/IconPreview.vue
    - _Requirements: 1.1_

- [x] 16. Checkpoint - 确保表现层目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Utilities and Types (工具和类型)

- [x] 17. 清理 utils/ 目录注释
  - 审查 debug-oauth.ts 工具函数
  - _Requirements: 1.1_

- [x] 18. 清理 types/ 目录注释
  - [x] 18.1 审查类型定义文件
    - 确保类型注释与定义一致
    - 删除冗余的类型注释
    - 审查 api.ts、chrome-messages.ts、sync-progress.ts、index.ts
    - _Requirements: 7.1, 7.3, 7.4_
  - [x] 18.2 审查子目录类型定义
    - 审查 application/（bookmark.ts、font.ts、health.ts、notification.ts、scheduler.ts、service.ts）
    - 审查 core/（common.ts、error.ts）
    - 审查 domain/（bookmark.ts、cleanup.ts、query.d.ts）
    - 审查 infrastructure/（events.d.ts、http.d.ts、indexeddb.ts、llm.ts、logging.ts）
    - 审查 services/（crawler.d.ts、favicon.d.ts、performance.d.ts）
    - 审查 subscription/（plan.ts）
    - 审查 ui/（store.ts）
    - _Requirements: 7.1, 7.2_

- [x] 19. 清理 config/ 和 constants/ 目录注释
  - 审查 config/constants.ts
  - 审查 constants/events.ts、constants/empty-states.ts
  - _Requirements: 1.1_

- [x] 20. 清理其他目录注释
  - [x] 20.1 清理 content/ 目录
    - 审查 inject-quick-add-dialog.ts（含 TODO 第 646 行：LLM 生成书签标题）
    - _Requirements: 1.1, 3.4_
  - [x] 20.2 清理 devtools/ 目录
    - 审查 env-snapshot.ts
    - _Requirements: 1.1_
  - [x] 20.3 清理 offscreen/ 目录
    - 审查 main.ts
    - 审查 tasks/parser.ts
    - _Requirements: 1.1, 5.1_
  - [x] 20.4 清理 workers/ 目录
    - 审查 query-worker.ts、health-scan-worker.ts、query-worker-types.ts
    - _Requirements: 1.1_

- [x] 21. Final Checkpoint - 确保所有目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 8: Property Tests (属性测试) - 可选

> 注意：项目当前没有测试框架配置。执行此阶段前需要先安装 vitest 和 fast-check。

- [ ]* 22. 设置测试环境
  - 安装 vitest 和 fast-check 依赖
  - 配置 vitest.config.ts
  - _Requirements: 设计文档 Testing Strategy_

- [ ]* 23. 编写属性测试
  - [ ]* 23.1 编写类型引用有效性属性测试
    - **Property 1: 类型/接口引用有效性**
    - **Validates: Requirements 1.5, 7.2**
  - [ ]* 23.2 编写 Background API 引用合规性属性测试
    - **Property 2: Background 目录 API 引用合规性**
    - **Validates: Requirements 2.2, 5.1, 5.2, 5.3**
  - [ ]* 23.3 编写术语一致性属性测试
    - **Property 3: 术语一致性**
    - **Validates: Requirements 2.5**
  - [ ]* 23.4 编写层级描述一致性属性测试
    - **Property 4: 层级描述一致性**
    - **Validates: Requirements 6.2**
  - [ ]* 23.5 编写文件路径引用有效性属性测试
    - **Property 5: 文件路径引用有效性**
    - **Validates: Requirements 6.3**
