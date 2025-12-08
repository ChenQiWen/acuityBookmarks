# Implementation Plan

## Phase 1: Core Layer (核心层)

- [ ] 1. 清理 core/ 目录注释
  - [ ] 1.1 清理 core/common/ 目录
    - 审查 logger.ts、result.ts、store-error.ts 的注释
    - 验证 JSDoc 参数和返回值描述
    - 删除过时的 TODO/FIXME
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_
  - [ ] 1.2 清理 core/bookmark/ 目录
    - 审查 domain/、repositories/、services/ 子目录
    - 确保领域模型注释准确描述业务规则
    - 验证类型引用有效性
    - _Requirements: 1.1, 1.4, 1.5, 7.1, 7.2_
  - [ ] 1.3 清理 core/filter/ 目录
    - 审查 bookmark-filter.ts 注释
    - 确保使用「筛选」而非「搜索」术语
    - _Requirements: 2.5_
  - [ ] 1.4 清理 core/query-engine/ 目录
    - 审查 engine.ts、unified-query-service.ts 等文件
    - 验证查询引擎注释与实现一致
    - 确保术语一致性
    - _Requirements: 1.1, 1.2, 2.5_
  - [ ] 1.5 清理 core/ai/ 目录
    - 审查 prompts.ts 注释
    - _Requirements: 1.1_

- [ ] 2. Checkpoint - 确保 core 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Application Layer (应用层)

- [ ] 3. 清理 application/ 目录注释
  - [ ] 3.1 清理 application/bookmark/ 目录
    - 审查 bookmark-app-service.ts、tree-app-service.ts 等
    - 验证应用服务注释描述的业务流程
    - 确保数据流描述符合单向数据流架构
    - _Requirements: 1.1, 1.2, 2.1, 2.4_
  - [ ] 3.2 清理 application/query/ 目录
    - 审查 query-app-service.ts、bookmark-query-service.ts
    - 确保使用「筛选」术语
    - _Requirements: 1.1, 2.5_
  - [ ] 3.3 清理 application/cleanup/ 目录
    - 审查 cleanup-app-service.ts
    - _Requirements: 1.1, 1.2_
  - [ ] 3.4 清理 application/ai/ 目录
    - 审查 ai-app-service.ts、llm-response-validator.ts
    - 删除过时的 CHANGELOG.md、IMPLEMENTATION_STATUS.md 等文档中的过时内容
    - _Requirements: 1.1, 3.1, 4.1_
  - [ ] 3.5 清理 application/ 其他子目录
    - 审查 health/、settings/、subscription/、notification/、font/、scheduler/ 目录
    - _Requirements: 1.1, 1.2_

- [ ] 4. Checkpoint - 确保 application 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Infrastructure Layer (基础设施层)

- [ ] 5. 清理 infrastructure/ 目录注释
  - [ ] 5.1 清理 infrastructure/indexeddb/ 目录
    - 审查 manager.ts、schema.ts、connection-pool.ts 等
    - 确保 IndexedDB 操作注释准确
    - 验证类型定义注释与实际类型一致
    - _Requirements: 1.1, 1.2, 2.3, 7.1_
  - [ ] 5.2 清理 infrastructure/events/ 目录
    - 审查 event-bus.ts、chrome-message-bridge.ts
    - 确保事件系统注释准确描述 mitt 用法
    - _Requirements: 1.1, 1.2_
  - [ ] 5.3 清理 infrastructure/storage/ 目录
    - 审查 modern-storage.ts
    - 确保存储 API 注释正确区分 session/local
    - _Requirements: 1.1, 5.3_
  - [ ] 5.4 清理 infrastructure/state/ 目录
    - 审查 immer-helpers.ts
    - 确保 Immer 用法注释准确
    - _Requirements: 1.1, 1.2_
  - [ ] 5.5 清理 infrastructure/ 其他子目录
    - 审查 chrome-api/、http/、llm/、logging/、query/、i18n/、supabase/、gumroad/ 目录
    - _Requirements: 1.1, 1.2_

- [ ] 6. Checkpoint - 确保 infrastructure 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Background Scripts (后台脚本)

- [ ] 7. 清理 background/ 目录注释
  - [ ] 7.1 清理 background/bookmarks.ts
    - 验证书签监听器注释符合单向数据流
    - 确保不引用 window/document/localStorage
    - _Requirements: 2.1, 2.2, 5.1, 5.2, 5.3_
  - [ ] 7.2 清理 background/messaging.ts
    - 验证消息通信注释准确
    - _Requirements: 1.1, 5.1_
  - [ ] 7.3 清理 background/main.ts 和 bootstrap.ts
    - 验证初始化流程注释
    - _Requirements: 1.1, 5.1_
  - [ ] 7.4 清理 background/ 其他文件
    - 审查 state.ts、crawler-manager.ts、data-health-check.ts、menus.ts、navigation.ts、notification.ts、offscreen-manager.ts、omnibox.ts
    - 确保所有文件不引用 Service Worker 不可用的 API
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Checkpoint - 确保 background 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: State Management (状态管理)

- [ ] 9. 清理 stores/ 目录注释
  - [ ] 9.1 清理 stores/bookmarkStore.ts
    - 验证书签状态管理注释
    - 确保数据流描述正确（从 IndexedDB 加载）
    - _Requirements: 1.1, 2.1, 2.3_
  - [ ] 9.2 清理 stores/bookmark/ 目录
    - 审查 bookmark-management-store.ts
    - _Requirements: 1.1, 1.2_
  - [ ] 9.3 清理 stores/cleanup/ 目录
    - 审查 cleanup-store.ts
    - _Requirements: 1.1_
  - [ ] 9.4 清理 stores/ 其他文件
    - 审查 ui-store.ts、popup-store-indexeddb.ts、query-store/、ui/ 目录
    - _Requirements: 1.1, 1.2_

- [ ] 10. 清理 services/ 目录注释
  - [ ] 10.1 清理 services/bookmark-sync-service.ts
    - 验证同步服务注释符合单向数据流
    - 确保增量/全量同步描述准确
    - _Requirements: 1.1, 2.1_
  - [ ] 10.2 清理 services/modern-bookmark-service.ts
    - 验证书签服务注释
    - _Requirements: 1.1, 1.2_
  - [ ] 10.3 清理 services/ 其他文件
    - 审查 favicon-service.ts、navigation-service.ts、data-health-client.ts、bookmark-health-service.ts、bookmark-index-service.ts、crawl-task-scheduler.ts、local-bookmark-crawler.ts 等
    - _Requirements: 1.1, 1.2, 3.1_

- [ ] 11. Checkpoint - 确保 stores 和 services 目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Presentation Layer (表现层)

- [ ] 12. 清理 composables/ 目录注释
  - [ ] 12.1 清理核心 composables
    - 审查 useBookmarkQueries.ts、useBookmarkSearch.ts、useCrossPageSync.ts
    - 确保使用「筛选」术语
    - _Requirements: 1.1, 2.5_
  - [ ] 12.2 清理键盘相关 composables
    - 审查 useKeyboard.ts、useManagementKeyboard.ts、usePopupKeyboard.ts 等
    - _Requirements: 1.1_
  - [ ] 12.3 清理其他 composables
    - 审查 useCrawler.ts、useNotification.ts、useSubscription.ts、useSupabaseAuth.ts 等
    - _Requirements: 1.1, 1.2_

- [ ] 13. 清理 presentation/ 目录注释
  - [ ] 13.1 清理 presentation/pages/ 目录
    - 审查页面组件注释
    - 确保不直接调用 Chrome API 或 IndexedDB
    - _Requirements: 1.1, 2.2, 2.3, 2.4_
  - [ ] 13.2 清理 presentation/components/ 目录
    - 审查可复用组件注释
    - _Requirements: 1.1_

- [ ] 14. 清理 components/ 目录注释
  - [ ] 14.1 清理 components/base/ 目录
    - 审查基础组件注释
    - _Requirements: 1.1, 6.1_
  - [ ] 14.2 清理 components/composite/ 目录
    - 审查复合组件注释
    - 确保 SimpleBookmarkTree 等组件注释准确
    - _Requirements: 1.1, 1.2, 6.1_

- [ ] 15. Checkpoint - 确保表现层目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Utilities and Types (工具和类型)

- [ ] 16. 清理 utils/ 目录注释
  - 审查 debug-oauth.ts 等工具函数
  - _Requirements: 1.1_

- [ ] 17. 清理 types/ 目录注释
  - [ ] 17.1 审查类型定义文件
    - 确保类型注释与定义一致
    - 删除冗余的类型注释
    - _Requirements: 7.1, 7.3, 7.4_

- [ ] 18. 清理 config/ 和 constants/ 目录注释
  - 审查配置和常量文件注释
  - _Requirements: 1.1_

- [ ] 19. 清理其他目录注释
  - [ ] 19.1 清理 pages/ 目录（如果与 presentation/pages 不同）
  - [ ] 19.2 清理 content/、devtools/、offscreen/、workers/ 目录
  - _Requirements: 1.1, 5.1_

- [ ] 20. Final Checkpoint - 确保所有目录清理后类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 8: Property Tests (属性测试)

- [ ] 21. 编写属性测试
  - [ ] 21.1 编写类型引用有效性属性测试
    - **Property 1: 类型/接口引用有效性**
    - **Validates: Requirements 1.5, 7.2**
  - [ ] 21.2 编写 Background API 引用合规性属性测试
    - **Property 2: Background 目录 API 引用合规性**
    - **Validates: Requirements 2.2, 5.1, 5.2, 5.3**
  - [ ] 21.3 编写术语一致性属性测试
    - **Property 3: 术语一致性**
    - **Validates: Requirements 2.5**
  - [ ] 21.4 编写层级描述一致性属性测试
    - **Property 4: 层级描述一致性**
    - **Validates: Requirements 6.2**
  - [ ] 21.5 编写文件路径引用有效性属性测试
    - **Property 5: 文件路径引用有效性**
    - **Validates: Requirements 6.3**
