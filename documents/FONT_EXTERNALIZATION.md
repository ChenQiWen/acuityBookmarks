AcuityBookmarks — 字体外部化实现说明

目标
- 将大体积的 Noto 字体文件移出产物，改为运行时从 CDN（Google Fonts）按需加载。
- 按浏览器/用户语言仅加载所需字体，降低安装包体积并提升加载性能。
- 使用 IndexedDB 缓存已下载的 woff2 字体，以减少重复网络请求并支持离线优先策略。
- 在网络或 CSP 限制导致字体无法加载时，回退到系统字体栈以保证可用性。

实现要点
1. 运行时加载器
- 文件：`frontend/src/utils/fontLoader.ts`
- 功能：
  - 根据语言映射（`FONT_MAP`）选择对应的 Google Fonts CSS 或直接文件路径。
  - 对于 `cssUrl`（fonts.googleapis.com），先获取 CSS 内容并解析出实际的 woff2 URL（通常指向 fonts.gstatic.com），然后下载字体二进制数据。
  - 使用 FontFace API 将字体注册到 `document.fonts`，确保在当前页面即时可用。
  - 使用 `Blob` + `URL.createObjectURL` 方式注入字体，避免受 CSP 限制的内联样式问题（仍需在 manifest 中允许 fonts.gstatic.com）。

2. 本地缓存
- 存储位置：IndexedDB（数据库名 `acuity-font-cache-v1`，对象存储 `fonts`）。
- 缓存内容：{ buf: ArrayBuffer, version: string, ts: number }
- 版本与过期策略：
  - `FONT_CACHE_VERSION` 用于强制更新缓存结构/内容时失效旧缓存。
  - `CACHE_TTL_MS` 默认为 30 天；过期后会重新从 CDN 拉取。

3. 构建/产物变更
- 已移除将 Noto 字体复制到 dist 的逻辑（`frontend/scripts/clean-dist.cjs`）。
- 保持 `frontend/src/assets/fonts.css` 中的字体 family 变量与系统回退栈，但移除了 @font-face 本地声明。
- `clean-dist.cjs` 会在生成的 `dist/manifest.json` 中追加 Google Fonts 的 CSP（style-src 和 font-src）以允许外部字体加载。

4. Manifest/权限
- 在 `public/manifest.json` 的 `content_security_policy.extension_pages` 中追加：
  - style-src: https://fonts.googleapis.com
  - font-src: https://fonts.gstatic.com
- 这一步由 `clean-dist.cjs` 在构建后自动完成，确保运行时允许加载 Google Fonts 资源。

5. Entry points 集成
- 在 `frontend/src/popup/main.ts`, `frontend/src/management/main.ts`, `frontend/src/side-panel/main.ts` 中，运行时会尝试调用：
  - `await loadFontForLanguage(navigator.language || 'default')`（异步且非阻塞，若失败不会阻止应用挂载）
- 还提供 `preloadFontsForLanguage(lang)` 用于预加载场景（例如后台任务或用户设置开启时）。

如何清理缓存
- 目前没有 UI 控件，开发者或测试人员可通过浏览器 DevTools 手动删除 IndexedDB 中的 `acuity-font-cache-v1` 数据库。
- 可在未来添加一个 background -> content message 接口来响应 "clear-font-cache" 并在后台清理。

验证步骤
1. 本地类型检查：
   cd frontend && bun run type-check
2. 构建并查看 dist：
   cd frontend && bun run build
   - 检查 dist 目录中不应包含大量 Noto 字体文件（例如 NotoSansSC-Regular.woff2）
   - 检查 clean-dist 输出日志：应包含 `已在 manifest 的 CSP 中追加 Google Fonts 域`
3. 在浏览器中安装扩展并加载页面（popup/management/side-panel）：
   - 网络可用时，观察 network 面板是否请求 fonts.googleapis.com -> fonts.gstatic.com 并缓存到 IndexedDB。
   - 断网或阻止 fonts.gstatic.com 时，页面应回退到系统字体栈，界面应保持可用性。

备注与后续工作
- 可选：增加一个 settings UI，允许用户开启/关闭自定义字体或清空字体缓存。
- 可选：将 Google Fonts 请求替换为自有 CDN 或缓存代理以控制流量和隐私策略。

