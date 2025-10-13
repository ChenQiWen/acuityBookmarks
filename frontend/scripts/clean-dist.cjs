#!/usr/bin/env bun

/**
 * 清理dist文件夹中的不必要文件，减少Chrome扩展包大小
 * 移除PWA相关文件，只保留Chrome扩展所需的文件
 */

void (async () => {
  const fs = await import('fs')
  const path = await import('path')
  const loggerMod = await import('./logger.cjs')
  const { createLogger } = loggerMod.default ?? loggerMod

  const distDir = path.join(__dirname, '../../dist')
  const rootDir = path.join(__dirname, '../../')

  // 统一脚本日志：使用脚本级 logger（移除 console 代理，避免 no-console 告警）
  const __scriptLogger__ = createLogger('CleanDist')

  // 需要删除的PWA文件列表
  const filesToRemove = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    // 'logo.svg' // 保留SVG Logo用于扩展页面
    'site.webmanifest'
  ]

  __scriptLogger__.info('🧹 开始清理dist文件夹...')

  // 检查dist目录是否存在
  if (!fs.existsSync(distDir)) {
    __scriptLogger__.info('❌ dist目录不存在，跳过清理')
    process.exit(0)
  }

  // 删除PWA相关文件
  filesToRemove.forEach(file => {
    const filePath = path.join(distDir, file)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        __scriptLogger__.info(`✅ 删除PWA文件: ${file}`)
      } catch (err) {
        __scriptLogger__.warn(`⚠️ 无法删除文件: ${file}`, err.message)
      }
    }
  })
// if (fs.existsSync(assetsDir)) {
//   fontFilesToRemove.forEach(fontFile => {
//     const fontPath = path.join(assetsDir, fontFile);
//     if (fs.existsSync(fontPath)) {
//       try {
//         fs.unlinkSync(fontPath);
//         console.log(`✅ 删除字体文件: ${fontFile}`);
//       } catch (err) {
//         console.warn(`⚠️ 无法删除字体文件: ${fontFile}`, err.message);
//       }
//     }
//   });
// }

// 复制必要的扩展文件到dist目录
__scriptLogger__.info('📋 复制扩展文件到dist目录...');

// 从 frontend/public/manifest.json 读取manifest内容
const publicManifestPath = path.join(__dirname, '../public/manifest.json');
let manifestContent;

  try {
    const manifestData = fs.readFileSync(publicManifestPath, 'utf8');
    manifestContent = JSON.parse(manifestData);
    __scriptLogger__.info('✅ 从 public/manifest.json 读取配置');
    // 规范化并收紧 CSP（按环境注入 dev 连接域）
    try {
      const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
      const devConnect = ['http://127.0.0.1:8787', 'http://localhost:8787'];
      const apiConnect = [
        'https://acuitybookmarks.cqw547847.workers.dev',
        'https://api.acuitybookmarks.com'
      ];

      const styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
      const fontSrc = ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'];
      // ✅ 允许所有https/http图片（用于favicon加载）
      const imgSrc = ["'self'", 'data:', 'https:', 'http:'];
      const connectSrc = [
        "'self'",
        ...apiConnect,
        ...(isProd ? [] : devConnect),
        'https://*',  // 允许爬取任意 HTTPS 网站
        'http://*',   // 允许爬取任意 HTTP 网站
        'data:',      // 允许 data: 协议
        'blob:',      // 允许 blob: 协议
        'wss:'        // 允许 WebSocket 连接
      ];

      const csp = [
        "default-src 'self'",
        "upgrade-insecure-requests",
        "script-src 'self'",
        "object-src 'none'",
        `style-src ${styleSrc.join(' ')}`,
        `font-src ${fontSrc.join(' ')}`,
        `img-src ${imgSrc.join(' ')}`,
        `connect-src ${connectSrc.join(' ')}`
      ].join('; ');

      manifestContent.content_security_policy = manifestContent.content_security_policy || {};
      manifestContent.content_security_policy.extension_pages = csp;
      __scriptLogger__.info('✅ 已按环境规范化并收紧 CSP');
    } catch (e) {
      __scriptLogger__.warn('⚠️ 规范化 CSP 时出错', e && e.message);
    }
  } catch (err) {
    __scriptLogger__.warn('⚠️ 无法读取 public/manifest.json，使用默认配置:', err.message);
  // 备用的默认配置（不包含side_panel）
  manifestContent = {
    "manifest_version": 3,
    "name": "AcuityBookmarks",
    "version": "1.0",
    "description": "Unlock the knowledge in your bookmarks. AI-powered organization, content-aware search.",
    "permissions": [
      "bookmarks",
      "storage",
      "activeTab",
      "scripting",
      "notifications",
      "tabs",
      "windows",
      "alarms"
    ],
    "host_permissions": [
      "http://127.0.0.1:8787/*",
      "http://localhost:8787/*"
    ],
    "action": {
      "default_popup": "popup.html",
      "default_icon": {
        "16": "images/icon16.png",
        "48": "images/icon48.png",
        "128": "images/icon128.png"
      }
    },
    "background": {
      "service_worker": "background.js"
    },
    "commands": {
      "open-management": {
        "suggested_key": {
          "default": "Alt+B",
          "mac": "Alt+B"
        },
        "description": "打开书签管理页面"
      },
      "smart-bookmark": {
        "suggested_key": {
          "default": "Alt+S",
          "mac": "Alt+S"
        },
        "description": "AI智能整理书签"
      },
    },
    "icons": {
      "16": "images/icon16.png",
      "48": "images/icon48.png",
      "128": "images/icon128.png"
    },
    "content_security_policy": {
      "extension_pages": "default-src 'self'; upgrade-insecure-requests; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; img-src 'self' data: https://www.google.com; connect-src 'self' http://127.0.0.1:8787 http://localhost:8787;"
    },
    "web_accessible_resources": [
      {
        "resources": [
          "management.html",
          "side-panel.html"
        ],
        "matches": ["<all_urls>"],
        "use_dynamic_url": true
      }
    ]
  };
}

const manifestPath = path.join(distDir, 'manifest.json');
try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
  __scriptLogger__.info('✅ 创建 manifest.json');
} catch (err) {
  __scriptLogger__.warn('⚠️ 创建 manifest.json 失败:', err.message);
}

// 复制images文件夹
const imagesSrc = path.join(rootDir, 'images');
const imagesDest = path.join(distDir, 'images');
if (fs.existsSync(imagesSrc)) {
  try {
    // 强制删除已存在的images文件夹，确保干净的复制
    if (fs.existsSync(imagesDest)) {
      fs.rmSync(imagesDest, { recursive: true, force: true });
    }
    fs.cpSync(imagesSrc, imagesDest, { recursive: true });
    __scriptLogger__.info('✅ 复制 images 文件夹');

    // 删除未使用的图标尺寸，保留 16/48/128
    const unusedIcons = ['icon24.png', 'icon32.png', 'icon256.png'];
    unusedIcons.forEach(fname => {
      const fpath = path.join(imagesDest, fname);
      if (fs.existsSync(fpath)) {
        try {
          fs.unlinkSync(fpath);
          __scriptLogger__.info(`✅ 移除未使用的图标: ${fname}`);
        } catch (err) {
          __scriptLogger__.warn(`⚠️ 无法移除未使用的图标: ${fname}`, err.message);
        }
      }
    });
  } catch (err) {
    __scriptLogger__.warn('⚠️ 复制 images 文件夹失败:', err.message);
  }
}

// // 复制background.js
// const backgroundSrc = path.join(rootDir, 'background.js')
// const backgroundDest = path.join(distDir, 'background.js')
// if (fs.existsSync(backgroundSrc)) {
//   try {
//     fs.copyFileSync(backgroundSrc, backgroundDest)
//     __scriptLogger__.info('✅ 复制 background.js')
//   } catch (err) {
//     __scriptLogger__.warn('⚠️ 复制 background.js 失败:', err.message)
//   }
// }

// NOTE: Noto 字体改为使用 CDN 外部加载（完全外部化），
// clean-dist 不再把大体积 Noto 字体复制到 dist 中以减小扩展包体积。
// 运行时会按需从 CDN 加载所需语言字体并在 IndexedDB 中缓存（详见 frontend/src/utils/fontLoader.ts）。

__scriptLogger__.info('🎉 dist文件夹清理和文件复制完成！');

// 显示清理后的文件夹大小
try {
  const cp = await import('child_process')
  const size = cp.execSync(`du -sh "${distDir}"`, { encoding: 'utf8' })
    .trim()
    .split('\t')[0]
  __scriptLogger__.info(`📦 最终dist文件夹大小: ${size}`)
} catch {
  __scriptLogger__.info('ℹ️ 无法获取文件夹大小信息')
}

})()
