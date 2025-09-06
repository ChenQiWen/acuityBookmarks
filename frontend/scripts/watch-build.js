#!/usr/bin/env bun

/**
 * Chrome扩展热更新构建脚本
 * 监听源文件变化，自动重新构建并更新dist目录
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');
const publicDir = path.join(process.cwd(), 'public');
const rootDir = path.join(process.cwd(), '../');

let buildProcess = null;
let isBuilding = false;
let buildQueue = false;

console.log('🚀 启动Chrome扩展热更新模式...');
console.log('📁 监听目录:');
console.log('  - src/');
console.log('  - public/');
console.log('  - *.html');
console.log('  - background.js (根目录)');
console.log('');

// 构建函数
async function build() {
  if (isBuilding) {
    buildQueue = true;
    return;
  }

  isBuilding = true;
  console.log('🔨 检测到文件变化，开始构建...');
  
  const startTime = Date.now();
  
  try {
    // 使用bun运行构建命令
    buildProcess = spawn('bun', ['run', 'build'], {
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    buildProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    buildProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) {
          const duration = Date.now() - startTime;
          console.log(`✅ 构建完成! 耗时: ${duration}ms`);
          console.log('🔄 Chrome扩展已更新，请刷新扩展页面');
          console.log('');
          resolve();
        } else {
          console.error('❌ 构建失败:');
          console.error(output);
          reject(new Error(`构建失败，退出码: ${code}`));
        }
      });
    });

  } catch (error) {
    console.error('❌ 构建错误:', error.message);
  } finally {
    isBuilding = false;
    buildProcess = null;
    
    // 如果构建期间有新的变化，重新构建
    if (buildQueue) {
      buildQueue = false;
      setTimeout(build, 100);
    }
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedBuild = debounce(build, 300);

// 监听src目录
watch(srcDir, { recursive: true }, (eventType, filename) => {
  if (filename && (filename.endsWith('.vue') || filename.endsWith('.ts') || filename.endsWith('.js') || filename.endsWith('.css'))) {
    console.log(`📝 文件变化: src/${filename}`);
    debouncedBuild();
  }
});

// 监听public目录
watch(publicDir, { recursive: true }, (eventType, filename) => {
  if (filename) {
    console.log(`📝 文件变化: public/${filename}`);
    debouncedBuild();
  }
});

// 监听HTML文件
const htmlFiles = ['popup.html', 'management.html', 'search-popup.html', 'debug-management.html', 'management-fixed.html', 'debug-panel.html'];
htmlFiles.forEach(htmlFile => {
  const htmlPath = path.join(process.cwd(), htmlFile);
  try {
    watch(htmlPath, (eventType) => {
      console.log(`📝 文件变化: ${htmlFile}`);
      debouncedBuild();
    });
  } catch (error) {
    // 文件可能不存在，忽略
  }
});

// 监听根目录的background.js
const backgroundPath = path.join(rootDir, 'background.js');
try {
  watch(backgroundPath, (eventType) => {
    console.log('📝 文件变化: background.js');
    debouncedBuild();
  });
} catch (error) {
  console.warn('⚠️ 无法监听 background.js，请确保文件存在');
}

// 初始构建
console.log('🔨 执行初始构建...');
build();

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 停止热更新...');
  if (buildProcess) {
    buildProcess.kill();
  }
  process.exit(0);
});

console.log('👀 正在监听文件变化... (Ctrl+C 退出)');
