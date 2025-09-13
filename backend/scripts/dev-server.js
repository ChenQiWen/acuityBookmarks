#!/usr/bin/env bun

/**
 * 增强的开发服务器启动脚本
 * 提供更好的热更新体验和开发工具
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// 配置
const config = {
  serverFile: 'server.js',
  watchExtensions: ['.js', '.ts', '.json'],
  ignorePatterns: [
    'node_modules',
    'test',
    '.git',
    'logs',
    'tmp',
    '*.test.js',
    '*.test.ts'
  ],
  debounceMs: 200,
  port: process.env.PORT || 3000
};

let serverProcess = null;
let isRestarting = false;
let restartQueue = false;

console.log('🚀 启动AcuityBookmarks后端开发服务器...');
console.log(`📍 端口: ${config.port}`);
console.log(`📁 监听目录: ${rootDir}`);
console.log(`🔍 监听文件: ${config.watchExtensions.join(', ')}`);
console.log('');

// 启动服务器
function startServer() {
  if (serverProcess) {
    return;
  }

  console.log('🔄 启动服务器...');

  serverProcess = spawn('bun', ['--hot', config.serverFile], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOT_RELOAD: 'true'
    }
  });

  serverProcess.on('exit', (code, signal) => {
    serverProcess = null;

    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      if (code === 0) {
        console.log('✅ 服务器正常退出');
      } else {
        console.error(`❌ 服务器异常退出，退出码: ${code}`);

        // 如果不是手动停止，尝试重启
        if (!isRestarting) {
          console.log('🔄 尝试重启服务器...');
          setTimeout(startServer, 2000);
        }
      }
    }
  });

  serverProcess.on('error', (error) => {
    console.error('❌ 服务器启动失败:', error.message);
    serverProcess = null;
  });
}

// 停止服务器
function stopServer() {
  if (!serverProcess) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    console.log('🛑 停止服务器...');

    const timeout = setTimeout(() => {
      if (serverProcess) {
        console.log('⚠️ 强制终止服务器');
        serverProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    serverProcess.on('exit', () => {
      clearTimeout(timeout);
      serverProcess = null;
      resolve();
    });

    serverProcess.kill('SIGTERM');
  });
}

// 重启服务器
async function restartServer() {
  if (isRestarting) {
    restartQueue = true;
    return;
  }

  isRestarting = true;
  console.log('🔥 检测到文件变化，重启服务器...');

  try {
    await stopServer();

    // 短暂延迟确保端口释放
    await new Promise(resolve => setTimeout(resolve, 500));

    startServer();

    console.log('✅ 服务器重启完成');
    console.log('');

  } catch (error) {
    console.error('❌ 重启失败:', error.message);
  } finally {
    isRestarting = false;

    // 如果重启期间有新的变化，再次重启
    if (restartQueue) {
      restartQueue = false;
      setTimeout(restartServer, config.debounceMs);
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

const debouncedRestart = debounce(restartServer, config.debounceMs);

// 监听文件变化
function setupFileWatcher() {
  try {
    watch(rootDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // 检查文件扩展名
      const ext = path.extname(filename);
      if (!config.watchExtensions.includes(ext)) return;

      // 检查是否应该忽略
      const shouldIgnore = config.ignorePatterns.some(pattern =>
        filename.includes(pattern)
      );
      if (shouldIgnore) return;

      console.log(`📝 文件变化: ${filename}`);
      debouncedRestart();
    });

    console.log('👀 文件监听已启动');
  } catch (error) {
    console.error('❌ 文件监听启动失败:', error.message);
    console.log('⚠️ 回退到基础热更新模式');
  }
}

// 处理进程信号
process.on('SIGINT', async () => {
  console.log('\n🛑 收到停止信号，正在关闭服务器...');
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 收到终止信号，正在关闭服务器...');
  await stopServer();
  process.exit(0);
});

// 启动开发环境
console.log('🔧 设置文件监听...');
setupFileWatcher();

console.log('🚀 启动初始服务器...');
startServer();

console.log('');
console.log('💡 开发服务器已启动！');
console.log(`   - 本地地址: http://localhost:${config.port}`);
console.log('   - 按 Ctrl+C 停止服务器');
console.log('   - 修改文件将自动重启服务器');
console.log('');
