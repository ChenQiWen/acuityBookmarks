# 书签分享功能设计文档

## 概述

书签分享功能允许用户将收藏的书签或文件夹以美观的海报形式分享给他人。用户可以生成包含书签信息和二维码的图片海报，并通过多种方式分享。接收者在桌面端可以精细化选择并导入书签到指定文件夹，在移动端可以只读浏览书签列表。

### 核心目标

1. **简化分享流程** - 一键生成海报，快速分享
2. **精细化导入** - 接收者可选择部分书签并指定导入位置
3. **跨平台体验** - 桌面端完整功能，移动端只读浏览
4. **数据安全** - 所有处理在本地完成，不上传服务器

### 技术栈

- **前端框架**: Vue 3 (Composition API)
- **状态管理**: Pinia
- **Canvas 绘图**: HTML5 Canvas API
- **二维码生成**: qrcode.js
- **数据压缩**: lz-string
- **剪贴板**: Clipboard API
- **Chrome API**: chrome.bookmarks, chrome.runtime

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ ShareDialog  │  │ ShareLanding │  │ MobileView   │  │
│  │  (弹窗组件)   │  │  (落地页)     │  │  (移动端)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ ShareService │  │ PosterService│  │ ImportService│  │
│  │  (分享逻辑)   │  │  (海报生成)   │  │  (导入逻辑)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Canvas API   │  │ QRCode.js    │  │ LZ-String    │  │
│  │ Clipboard API│  │ Chrome API   │  │ Event Bus    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户操作 → ShareDialog → ShareService → PosterService → Canvas API
                                      ↓
                                  生成海报图片
                                      ↓
                            复制/下载/生成链接
                                      ↓
                              接收者打开链接
                                      ↓
                            ShareLanding (桌面端)
                                      ↓
                            ImportService → Chrome API
```

---

## 组件设计

### 1. ShareDialog（分享弹窗组件）

**位置**: `frontend/src/components/business/ShareDialog/ShareDialog.vue`

**职责**:
- 显示分享选项和海报预览
- 处理用户交互（主题切换、书签选择）
- 调用 PosterService 生成海报
- 提供复制/下载/生成链接功能

**Props**:
```typescript
interface ShareDialogProps {
  show: boolean
  bookmarks: BookmarkNode[]
  shareType: 'favorites' | 'folder'
  folderName?: string
}
```

**Emits**:
```typescript
interface ShareDialogEmits {
  'update:show': [value: boolean]
  'share-complete': []
}
```


**State**:
```typescript
const state = reactive({
  selectedTheme: 'dark' as 'dark' | 'light',
  selectedBookmarks: new Set<string>(),
  posterPreview: null as string | null,
  isGenerating: false,
  error: null as string | null
})
```

**主要方法**:
- `generatePoster()` - 生成海报预览
- `copyImage()` - 复制图片到剪贴板
- `downloadImage()` - 下载图片
- `generateShareLink()` - 生成分享链接
- `toggleTheme()` - 切换主题
- `toggleBookmarkSelection()` - 切换书签选择

---

### 2. PosterService（海报生成服务）

**位置**: `frontend/src/application/share/poster-service.ts`

**职责**:
- 使用 Canvas API 绘制海报
- 生成二维码
- 处理 favicon 加载
- 导出为 PNG 图片

**接口**:
```typescript
interface PosterOptions {
  bookmarks: BookmarkNode[]
  theme: 'dark' | 'light'
  title?: string
  shareUrl: string
}

interface PosterService {
  generatePoster(options: PosterOptions): Promise<string>
  exportToPNG(canvas: HTMLCanvasElement): Promise<Blob>
  generateQRCode(url: string): Promise<string>
}
```

**实现细节**:
```typescript
class PosterServiceImpl implements PosterService {
  private readonly POSTER_WIDTH = 800
  private readonly BOOKMARK_HEIGHT = 60
  private readonly PADDING = 40
  private readonly QR_SIZE = 120

  async generatePoster(options: PosterOptions): Promise<string> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // 1. 计算画布高度
    const height = this.calculateHeight(options.bookmarks.length)
    canvas.width = this.POSTER_WIDTH
    canvas.height = height
    
    // 2. 绘制背景
    this.drawBackground(ctx, options.theme)
    
    // 3. 绘制标题
    this.drawTitle(ctx, options.title || '书签分享')
    
    // 4. 绘制书签列表
    await this.drawBookmarks(ctx, options.bookmarks, options.theme)
    
    // 5. 绘制二维码
    const qrDataUrl = await this.generateQRCode(options.shareUrl)
    await this.drawQRCode(ctx, qrDataUrl)
    
    // 6. 绘制品牌标识
    this.drawBranding(ctx)
    
    return canvas.toDataURL('image/png')
  }
  
  private calculateHeight(bookmarkCount: number): number {
    return this.PADDING * 2 + 80 + bookmarkCount * this.BOOKMARK_HEIGHT + 150
  }
  
  private drawBackground(ctx: CanvasRenderingContext2D, theme: 'dark' | 'light') {
    ctx.fillStyle = theme === 'dark' ? '#0e1513' : '#ffffff'
    ctx.fillRect(0, 0, this.POSTER_WIDTH, ctx.canvas.height)
  }
  
  private async drawBookmarks(
    ctx: CanvasRenderingContext2D,
    bookmarks: BookmarkNode[],
    theme: 'dark' | 'light'
  ) {
    let y = this.PADDING + 100
    
    for (const bookmark of bookmarks) {
      // 绘制 favicon
      if (bookmark.url) {
        const favicon = await this.loadFavicon(bookmark.url)
        if (favicon) {
          ctx.drawImage(favicon, this.PADDING, y, 20, 20)
        }
      }
      
      // 绘制标题
      ctx.fillStyle = theme === 'dark' ? '#dfe4e1' : '#1a1a1a'
      ctx.font = '16px Inter, sans-serif'
      const title = this.truncateText(ctx, bookmark.title, 500)
      ctx.fillText(title, this.PADDING + 30, y + 15)
      
      // 绘制 URL
      ctx.fillStyle = theme === 'dark' ? '#83d5c5' : '#004d44'
      ctx.font = '12px Inter, sans-serif'
      const url = this.truncateText(ctx, bookmark.url || '', 500)
      ctx.fillText(url, this.PADDING + 30, y + 35)
      
      y += this.BOOKMARK_HEIGHT
    }
  }
  
  private truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string {
    const metrics = ctx.measureText(text)
    if (metrics.width <= maxWidth) return text
    
    let truncated = text
    while (ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    return truncated + '...'
  }
  
  async generateQRCode(url: string): Promise<string> {
    const QRCode = (await import('qrcode')).default
    return QRCode.toDataURL(url, {
      width: this.QR_SIZE,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
  }
}
```

---

### 3. ShareService（分享服务）

**位置**: `frontend/src/application/share/share-service.ts`

**职责**:
- 编码/解码分享数据
- 生成分享链接
- 复制到剪贴板
- 触发下载

**接口**:
```typescript
interface ShareData {
  v: number // 版本号
  t?: string // 分享标题
  b: Array<{
    t: string // 书签标题
    u: string // URL
    d?: string // 描述
  }>
}

interface ShareService {
  encodeShareData(bookmarks: BookmarkNode[], title?: string): string
  decodeShareData(encoded: string): ShareData
  generateShareUrl(encoded: string): string
  copyToClipboard(text: string): Promise<void>
  downloadImage(dataUrl: string, filename: string): void
}
```

**实现细节**:
```typescript
class ShareServiceImpl implements ShareService {
  private readonly BASE_URL = 'https://acuitybookmarks.com/share'
  private readonly MAX_DATA_LENGTH = 2000
  
  encodeShareData(bookmarks: BookmarkNode[], title?: string): string {
    const data: ShareData = {
      v: 1,
      t: title,
      b: bookmarks.map(b => ({
        t: b.title,
        u: b.url || '',
        d: b.description
      }))
    }
    
    const json = JSON.stringify(data)
    const compressed = LZString.compressToEncodedURIComponent(json)
    
    if (compressed.length > this.MAX_DATA_LENGTH) {
      throw new Error('分享数据过大，请减少书签数量')
    }
    
    return compressed
  }
  
  decodeShareData(encoded: string): ShareData {
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(encoded)
      if (!decompressed) {
        throw new Error('解码失败')
      }
      
      const data = JSON.parse(decompressed) as ShareData
      
      // 验证数据格式
      if (!data.v || !Array.isArray(data.b)) {
        throw new Error('数据格式无效')
      }
      
      return data
    } catch (error) {
      throw new Error('分享链接无效或已损坏')
    }
  }
  
  generateShareUrl(encoded: string): string {
    return `${this.BASE_URL}?data=${encoded}`
  }
  
  async copyToClipboard(text: string): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('浏览器不支持剪贴板 API')
    }
    
    await navigator.clipboard.writeText(text)
  }
  
  downloadImage(dataUrl: string, filename: string): void {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }
}
```

---

### 4. ShareLanding（桌面端落地页）

**位置**: `website/pages/share.vue` (官网项目)

**职责**:
- 解析 URL 参数获取分享数据
- 显示书签列表和选择界面
- 检测是否安装扩展
- 调用 ImportService 导入书签

**State**:
```typescript
const state = reactive({
  shareData: null as ShareData | null,
  selectedBookmarks: new Set<string>(),
  targetFolder: null as chrome.bookmarks.BookmarkTreeNode | null,
  isImporting: false,
  hasExtension: false,
  error: null as string | null
})
```

**主要方法**:
- `loadShareData()` - 从 URL 加载分享数据
- `detectExtension()` - 检测是否安装扩展
- `selectFolder()` - 选择目标文件夹
- `importBookmarks()` - 导入选中的书签
- `toggleAll()` - 全选/取消全选

---

### 5. ImportService（导入服务）

**位置**: `frontend/src/application/share/import-service.ts`

**职责**:
- 调用 Chrome Bookmarks API 创建书签
- 批量导入书签
- 处理导入错误

**接口**:
```typescript
interface ImportOptions {
  bookmarks: Array<{ title: string; url: string }>
  targetFolderId: string
  onProgress?: (current: number, total: number) => void
}

interface ImportResult {
  success: number
  failed: number
  errors: Array<{ bookmark: string; error: string }>
}

interface ImportService {
  importBookmarks(options: ImportOptions): Promise<ImportResult>
  getFolderTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]>
}
```

**实现细节**:
```typescript
class ImportServiceImpl implements ImportService {
  async importBookmarks(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    }
    
    for (let i = 0; i < options.bookmarks.length; i++) {
      const bookmark = options.bookmarks[i]
      
      try {
        await chrome.bookmarks.create({
          parentId: options.targetFolderId,
          title: bookmark.title,
          url: bookmark.url
        })
        
        result.success++
        options.onProgress?.(i + 1, options.bookmarks.length)
      } catch (error) {
        result.failed++
        result.errors.push({
          bookmark: bookmark.title,
          error: String(error)
        })
      }
    }
    
    return result
  }
  
  async getFolderTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const tree = await chrome.bookmarks.getTree()
    return tree
  }
}
```

---

## 数据模型

### ShareData（分享数据）

```typescript
interface ShareData {
  v: number // 版本号，当前为 1
  t?: string // 分享标题（可选）
  b: ShareBookmark[] // 书签列表
}

interface ShareBookmark {
  t: string // 书签标题
  u: string // URL
  d?: string // 描述（可选）
}
```

### PosterConfig（海报配置）

```typescript
interface PosterConfig {
  width: number // 海报宽度，默认 800px
  theme: 'dark' | 'light' // 主题
  padding: number // 内边距
  bookmarkHeight: number // 每个书签的高度
  qrSize: number // 二维码尺寸
  colors: {
    background: string
    text: string
    primary: string
    secondary: string
  }
}
```

---

## 错误处理

### 错误类型

```typescript
enum ShareErrorCode {
  DATA_TOO_LARGE = 'DATA_TOO_LARGE',
  INVALID_DATA = 'INVALID_DATA',
  CLIPBOARD_NOT_SUPPORTED = 'CLIPBOARD_NOT_SUPPORTED',
  CANVAS_NOT_SUPPORTED = 'CANVAS_NOT_SUPPORTED',
  EXTENSION_NOT_INSTALLED = 'EXTENSION_NOT_INSTALLED',
  IMPORT_FAILED = 'IMPORT_FAILED'
}

class ShareError extends Error {
  constructor(
    public code: ShareErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ShareError'
  }
}
```

### 错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| 数据过大 | 提示用户减少书签数量 |
| 数据无效 | 显示"分享链接无效"错误 |
| 剪贴板不支持 | 隐藏复制按钮，只提供下载 |
| Canvas 不支持 | 显示"浏览器不支持"错误 |
| 扩展未安装 | 显示安装引导 |
| 导入失败 | 显示失败书签列表和重试选项 |

---

## 性能优化

### 1. Canvas 绘制优化

```typescript
// 使用离屏 Canvas
const offscreenCanvas = new OffscreenCanvas(800, 600)
const ctx = offscreenCanvas.getContext('2d')!

// 批量绘制，减少重绘
ctx.save()
// ... 绘制操作
ctx.restore()

// 使用 requestAnimationFrame
requestAnimationFrame(() => {
  // 绘制操作
})
```

### 2. Favicon 加载优化

```typescript
// 使用缓存
const faviconCache = new Map<string, HTMLImageElement>()

async function loadFavicon(url: string): Promise<HTMLImageElement | null> {
  if (faviconCache.has(url)) {
    return faviconCache.get(url)!
  }
  
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = getFaviconUrl(url)
    
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      setTimeout(reject, 3000) // 3秒超时
    })
    
    faviconCache.set(url, img)
    return img
  } catch {
    return null
  }
}
```

### 3. 防抖优化

```typescript
import { useDebounceFn } from '@vueuse/core'

const debouncedGeneratePoster = useDebounceFn(
  () => generatePoster(),
  300
)
```

### 4. 批量导入优化

```typescript
// 分批导入，避免阻塞 UI
async function importInBatches(
  bookmarks: ShareBookmark[],
  batchSize: number = 10
) {
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batch = bookmarks.slice(i, i + batchSize)
    await Promise.all(batch.map(b => importBookmark(b)))
    
    // 让出主线程
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}
```

---

## 测试策略

### 单元测试

**测试覆盖：**
- ShareService 编码/解码
- PosterService 绘制逻辑
- ImportService 导入逻辑
- 错误处理

**测试工具：**
- Vitest
- @testing-library/vue

**示例测试：**
```typescript
describe('ShareService', () => {
  it('should encode and decode share data correctly', () => {
    const bookmarks = [
      { title: 'Example', url: 'https://example.com' }
    ]
    
    const encoded = shareService.encodeShareData(bookmarks)
    const decoded = shareService.decodeShareData(encoded)
    
    expect(decoded.b[0].t).toBe('Example')
    expect(decoded.b[0].u).toBe('https://example.com')
  })
  
  it('should throw error when data is too large', () => {
    const bookmarks = Array(1000).fill({
      title: 'Very long title '.repeat(100),
      url: 'https://example.com'
    })
    
    expect(() => shareService.encodeShareData(bookmarks))
      .toThrow('分享数据过大')
  })
})
```

---

## 正确性属性（Correctness Properties）

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 分享弹窗包含所有书签

*For any* 收藏书签列表或文件夹，当用户触发分享功能时，生成的海报预览应包含所有书签（包括递归收集的子文件夹书签）

**Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.5**

### Property 2: 海报内容完整性

*For any* 书签列表，生成的海报应包含每个书签的标题、URL、favicon（或默认图标）和二维码

**Validates: Requirements 3.1, 3.6, 3.9, 3.12**

### Property 3: 文本截断一致性

*For any* 超长文本（标题或 URL），截断后的文本长度应不超过最大宽度，且应以省略号结尾

**Validates: Requirements 3.4, 3.5**

### Property 4: 海报尺寸计算

*For any* 书签数量 N，海报宽度应为 800px，高度应为 `PADDING * 2 + HEADER_HEIGHT + N * BOOKMARK_HEIGHT + FOOTER_HEIGHT`

**Validates: Requirements 3.8**

### Property 5: 主题切换响应性

*For any* 主题选择（深色/浅色），切换主题后海报应重新生成，且背景色和文字色应符合所选主题

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 6: 剪贴板操作反馈

*For any* 剪贴板操作（复制图片或链接），操作成功应显示成功提示，操作失败应显示错误提示并记录日志

**Validates: Requirements 5.2, 5.3**

### Property 7: 下载文件名格式

*For any* 下载操作，生成的文件名应符合格式 `bookmarks-share-YYYYMMDD-HHmmss.png`，且时间戳应为当前时间

**Validates: Requirements 6.2**

### Property 8: 书签选择计数准确性

*For any* 书签选择操作（勾选/取消勾选/全选/取消全选），显示的选中计数应等于实际选中的书签数量

**Validates: Requirements 7.3, 7.4, 7.5**

### Property 9: 导入按钮状态

*For any* 书签选择状态，当且仅当至少选中一个书签时，"导入"按钮应为启用状态

**Validates: Requirements 7.12**

### Property 10: 批量导入完整性

*For any* 选中的书签列表和目标文件夹，导入操作应为每个书签调用 `chrome.bookmarks.create` API，且成功数量 + 失败数量应等于总数量

**Validates: Requirements 7.8, 7.9, 7.10**

### Property 11: 数据编码解码往返一致性（Round Trip）

*For any* 书签列表，编码后再解码应得到相同的书签数据（标题、URL、描述）

**Validates: Requirements 16.1, 16.2, 16.3, 16.6, 16.7, 16.9**

### Property 12: 二维码内容正确性

*For any* 分享链接，生成的二维码解码后应得到完整的分享 URL

**Validates: Requirements 3.10**

### Property 13: 递归收集书签完整性

*For any* 包含子文件夹的文件夹，递归收集的书签数量应等于所有层级中书签节点的总数

**Validates: Requirements 2.2, 2.5**

### Property 14: 默认文件夹逻辑

*For any* 导入操作，如果用户未选择目标文件夹，系统应使用"书签栏"文件夹作为默认目标

**Validates: Requirements 7.13**

### Property 15: 进度指示器准确性

*For any* 导入操作，进度指示器显示的当前进度应等于已处理的书签数量，总进度应等于待导入的书签总数

**Validates: Requirements 7.14**

---

## 国际化（i18n）

### 支持语言

- 中文（zh-CN）
- 英文（en-US）

### 翻译键

```typescript
// 分享弹窗
'share_dialog_title': '分享书签'
'share_dialog_theme_dark': '深色主题'
'share_dialog_theme_light': '浅色主题'
'share_dialog_copy_image': '复制图片'
'share_dialog_download_image': '下载图片'
'share_dialog_generate_link': '生成链接'
'share_dialog_select_all': '全选'
'share_dialog_deselect_all': '取消全选'
'share_dialog_selected_count': '已选 {count}/{total}'

// 落地页
'landing_title': '书签分享'
'landing_select_folder': '选择文件夹'
'landing_import_button': '导入选中的书签 ({count}个)'
'landing_import_success': '成功导入 {count} 个书签'
'landing_import_failed': '导入失败：{error}'
'landing_no_extension': '请先安装 AcuityBookmarks 扩展'
'landing_install_extension': '安装扩展'

// 移动端
'mobile_desktop_hint': '请在电脑上打开此链接以使用完整导入功能'
'mobile_share_button': '分享给朋友'
'mobile_copy_link': '复制链接'

// 错误提示
'error_data_too_large': '分享数据过大，请减少书签数量'
'error_invalid_data': '分享链接无效或已损坏'
'error_clipboard_not_supported': '浏览器不支持剪贴板功能'
'error_canvas_not_supported': '浏览器不支持海报生成'
'error_import_failed': '导入失败，请重试'
```

---

## 安全性考虑

### 1. XSS 防护

```typescript
// 对用户输入的书签标题和 URL 进行转义
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 在 Canvas 中绘制时使用转义后的文本
ctx.fillText(escapeHtml(bookmark.title), x, y)
```

### 2. URL 验证

```typescript
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

// 导入前验证 URL
if (!isValidUrl(bookmark.url)) {
  throw new Error('Invalid URL')
}
```

### 3. 数据大小限制

```typescript
const MAX_BOOKMARKS = 50
const MAX_DATA_SIZE = 2000

if (bookmarks.length > MAX_BOOKMARKS) {
  throw new Error('Too many bookmarks')
}

if (encoded.length > MAX_DATA_SIZE) {
  throw new Error('Data too large')
}
```

### 4. CSP 兼容

```typescript
// 使用 Canvas 而非外部图片服务
// 使用 Data URL 而非 Blob URL
// 避免 eval() 和 Function()
```

---

## 部署架构

### 前端部署

```
Chrome Extension (frontend/)
├── ShareDialog 组件
├── ShareService
├── PosterService
└── ImportService

Website (website/)
├── /share 落地页
└── /share/mobile 移动端页面
```

### 域名配置

```
https://acuitybookmarks.com/share?data=<encoded>
```

### CDN 配置

- 静态资源（Logo、默认图标）托管在 CDN
- 二维码库（qrcode.js）使用 CDN 加速
- LZ-String 库使用 CDN 加速

---

## 监控与日志

### 关键指标

| 指标 | 说明 | 目标 |
|------|------|------|
| 海报生成时间 | 从点击分享到海报显示的时间 | < 2s |
| 导入成功率 | 成功导入的书签数 / 总书签数 | > 95% |
| 错误率 | 发生错误的操作数 / 总操作数 | < 5% |
| 分享链接打开率 | 打开分享链接的次数 / 生成链接的次数 | - |

### 日志记录

```typescript
// 关键操作日志
logger.info('Share', '生成海报', { bookmarkCount, theme })
logger.info('Share', '复制图片成功')
logger.error('Share', '导入失败', { error, bookmark })

// 性能日志
logger.perf('Share', 'generatePoster', duration)
logger.perf('Share', 'importBookmarks', duration)
```

---

## 未来扩展

### Phase 2: 增强功能

1. **自定义海报模板**
   - 多种布局样式
   - 自定义颜色和字体
   - 添加个人签名

2. **分享统计**
   - 查看分享次数
   - 查看导入次数
   - 热门书签排行

3. **协作功能**
   - 多人共同编辑书签单
   - 评论和点赞
   - 订阅他人的书签单

### Phase 3: 移动端 App

1. **原生 App**
   - iOS/Android 原生应用
   - 支持完整的导入功能
   - 深度链接支持

2. **PWA 增强**
   - 离线访问
   - 推送通知
   - 添加到主屏幕

---

## 总结

书签分享功能通过以下设计实现了完整的分享和导入流程：

1. **分享端**：生成美观的海报和二维码，支持多种分享方式
2. **接收端**：桌面端精细化导入，移动端只读浏览
3. **数据安全**：本地处理，压缩编码，不上传服务器
4. **性能优化**：Canvas 离屏渲染，批量导入，防抖优化
5. **错误处理**：完善的降级方案和错误提示

通过 15 个正确性属性确保系统的正确性，通过单元测试和属性测试验证实现的正确性。
