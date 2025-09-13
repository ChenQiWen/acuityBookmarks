#!/usr/bin/env node

/**
 * 清理dist文件夹中的不必要文件，减少Chrome扩展包大小
 * 移除PWA相关文件，只保留Chrome扩展所需的文件
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../../dist');
const rootDir = path.join(__dirname, '../../');

// 需要删除的PWA文件列表
const filesToRemove = [
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon.ico',
  'logo.svg',
  'site.webmanifest'
];

// Material Design Icons字体文件（如果存在的话）
const fontFilesToRemove = [
  'materialdesignicons-webfont-B7mPwVP_.ttf',
  'materialdesignicons-webfont-CSr8KVlo.eot',
  'materialdesignicons-webfont-Dp5v-WZN.woff2',
  'materialdesignicons-webfont-PXm3-2wK.woff'
];

console.log('🧹 开始清理dist文件夹...');

// 检查dist目录是否存在
if (!fs.existsSync(distDir)) {
  console.log('❌ dist目录不存在，跳过清理');
  process.exit(0);
}

// 删除PWA相关文件
filesToRemove.forEach(file => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ 删除PWA文件: ${file}`);
    } catch (err) {
      console.warn(`⚠️ 无法删除文件: ${file}`, err.message);
    }
  }
});

// 删除assets目录中的字体文件（暂时注释掉，因为会影响图标显示）
// const assetsDir = path.join(distDir, 'assets');
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
console.log('📋 复制扩展文件到dist目录...');

// 创建manifest.json
const manifestContent = {
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
    "alarms",
    "offscreen",
    "sidePanel"
  ],
  "host_permissions": [
    "http://localhost:3000/*"
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
      "description": "打开书签管理页面（手动整理模式）"
    },
    "smart-bookmark": {
      "suggested_key": {
        "default": "Alt+S",
        "mac": "Alt+S"
      },
      "description": "AI智能整理书签"
    },
    "search-bookmarks": {
      "suggested_key": {
        "default": "Alt+F",
        "mac": "Alt+F"
      },
      "description": "搜索书签"
    }
  },
  "icons": {
    "16": "images/icon16.png",
    "48": "images/icon48.png",
    "128": "images/icon128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },
  "side_panel": {
    "default_path": "side-panel.html"
  },
  "web_accessible_resources": [
    {
      "resources": [
        "search-popup.html",
        "management.html",
        "side-panel.html",
        "offscreen.html"
      ],
      "matches": ["<all_urls>"],
      "use_dynamic_url": true
    }
  ]
};

const manifestPath = path.join(distDir, 'manifest.json');
try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
  console.log('✅ 创建 manifest.json');
} catch (err) {
  console.warn('⚠️ 创建 manifest.json 失败:', err.message);
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
    console.log('✅ 复制 images 文件夹');
  } catch (err) {
    console.warn('⚠️ 复制 images 文件夹失败:', err.message);
  }
}

// 复制background.js
const backgroundSrc = path.join(rootDir, 'background.js');
const backgroundDest = path.join(distDir, 'background.js');
if (fs.existsSync(backgroundSrc)) {
  try {
    fs.copyFileSync(backgroundSrc, backgroundDest);
    console.log('✅ 复制 background.js');
  } catch (err) {
    console.warn('⚠️ 复制 background.js 失败:', err.message);
  }
}

// 复制Noto字体文件到fonts目录
const notoFontsSrc = path.join(__dirname, '../src/assets/fonts');
const fontsDestDir = path.join(distDir, 'fonts');
if (fs.existsSync(notoFontsSrc)) {
  try {
    // 确保fonts目录存在
    if (!fs.existsSync(fontsDestDir)) {
      fs.mkdirSync(fontsDestDir, { recursive: true });
    }

    // 复制所有Noto字体文件
    const fontFiles = fs.readdirSync(notoFontsSrc).filter(file => file.endsWith('.woff2'));
    fontFiles.forEach(fontFile => {
      const srcPath = path.join(notoFontsSrc, fontFile);
      const destPath = path.join(fontsDestDir, fontFile);
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ 复制字体文件: ${fontFile}`);
    });
  } catch (err) {
    console.warn('⚠️ 复制字体文件失败:', err.message);
  }
}

console.log('🎉 dist文件夹清理和文件复制完成！');

// 显示清理后的文件夹大小
try {
  const { execSync } = require('child_process');
  const size = execSync(`du -sh "${distDir}"`, { encoding: 'utf8' }).trim().split('\t')[0];
  console.log(`📦 最终dist文件夹大小: ${size}`);
} catch (err) {
  console.log('ℹ️ 无法获取文件夹大小信息');
}
