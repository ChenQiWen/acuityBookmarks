#!/usr/bin/env node

/**
 * 清理dist文件夹中的不必要文件，减少Chrome扩展包大小
 * 移除PWA相关文件，只保留Chrome扩展所需的文件
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

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

// 删除assets目录中的字体文件
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  fontFilesToRemove.forEach(fontFile => {
    const fontPath = path.join(assetsDir, fontFile);
    if (fs.existsSync(fontPath)) {
      try {
        fs.unlinkSync(fontPath);
        console.log(`✅ 删除字体文件: ${fontFile}`);
      } catch (err) {
        console.warn(`⚠️ 无法删除字体文件: ${fontFile}`, err.message);
      }
    }
  });
}

console.log('🎉 dist文件夹清理完成！');

// 显示清理后的文件夹大小
try {
  const { execSync } = require('child_process');
  const size = execSync(`du -sh "${distDir}"`, { encoding: 'utf8' }).trim().split('\t')[0];
  console.log(`📦 清理后的dist文件夹大小: ${size}`);
} catch (err) {
  console.log('ℹ️ 无法获取文件夹大小信息');
}

