#!/usr/bin/env bun

/**
 * 增强的开发服务器启动脚本
 * 提供更好的热更新体验和开发工具
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// 配置
const config = {
  serverFile: process.env.SERVER_FILE || 'server-bun-native.js',
  // 仅监听代码文件，避免因 jobs.json 写入导致频繁重启
  watchExtensions: ['.js', '.ts'],
  ignorePatterns: [
    'node_modules',
    'test',
    '.git',
    'logs',
    'tmp',
    '*.test.js',
    '*.test.ts',
    'scripts/dev-server.js',
    'jobs.json'
  ],
  debounceMs: 200,
  port: process.env.PORT || 3000,
  host: process.env.HOST || '127.0.0.1',
  readyTimeoutMs: 8000
};

let serverProcess = null;
let isRestarting = false;
let restartQueue = false;

logger.info('DevServer', '🚀 启动AcuityBookmarks后端开发服务器...');
logger.info('DevServer', `📍 端口: ${config.port}`);
logger.info('DevServer', `📍 主机: ${config.host}`);
logger.info('DevServer', `📁 监听目录: ${rootDir}`);
logger.info('DevServer', `🔍 监听文件: ${config.watchExtensions.join(', ')}`);
logger.info('DevServer', '');

function waitForServerReady(host, port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(1500);

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('timeout', () => {
        socket.destroy();
        scheduleNext();
      });

      socket.once('error', () => {
        socket.destroy();
        scheduleNext();
      });
    };

    const scheduleNext = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('服务器未在预期时间内就绪'));
        return;
      }
      setTimeout(tryConnect, 250);
    };

    tryConnect();
  });
}

// 启动服务器
async function startServer() {
  if (serverProcess) {
    return;
  }

  logger.info('DevServer', '🔄 启动服务器...');

  // 使用单一文件监听驱动的稳定重启，不使用 Bun 的 --hot 以避免重复重启
  serverProcess = spawn('bun', [config.serverFile], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOT_RELOAD: 'false',
      PORT: String(config.port),
      HOST: String(config.host)
    }
  });

  serverProcess.on('exit', (code, signal) => {
    serverProcess = null;

    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      if (code === 0) {
        logger.info('DevServer', '✅ 服务器正常退出');
      } else {
        logger.error('DevServer', `❌ 服务器异常退出，退出码: ${code}`);

        // 如果不是手动停止，尝试重启
        if (!isRestarting) {
          logger.info('DevServer', '🔄 尝试重启服务器...');
          setTimeout(startServer, 2000);
        }
      }
    }
  });

  serverProcess.on('error', (error) => {
    logger.error('DevServer', '❌ 服务器启动失败:', error.message);
    serverProcess = null;
  });

  // 等待端口就绪
  try {
    await waitForServerReady(config.host, Number(config.port), config.readyTimeoutMs);
    logger.info('DevServer', '✅ 服务器端口就绪');
    logger.info('DevServer', '');

    logger.info('DevServer', '💡 开发服务器已启动！');
    logger.info('DevServer', `   - 本地地址: http://${config.host}:${config.port}`);
    logger.info('DevServer', '   - 按 Ctrl+C 停止服务器');
    logger.info('DevServer', '   - 修改文件将自动重启服务器');
    logger.info('DevServer', '');
  } catch (error) {
    logger.warn('DevServer', '⚠️ 就绪探测超时，可能仍在启动或已退出', error?.message || String(error));
  }
}

// 停止服务器
function stopServer() {
  if (!serverProcess) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    logger.info('DevServer', '🛑 停止服务器...');

    const timeout = setTimeout(() => {
      if (serverProcess) {
        logger.warn('DevServer', '⚠️ 强制终止服务器');
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
  logger.info('DevServer', '🔥 检测到文件变化，重启服务器...');

  try {
    await stopServer();

    // 短暂延迟确保端口释放
    await new Promise((resolve) => setTimeout(resolve, 500));

    await startServer();

    logger.info('DevServer', '✅ 服务器重启完成');
    logger.info('DevServer', '');
  } catch (error) {
    logger.error('DevServer', '❌ 重启失败:', error.message);
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

      // 检查是否应该忽略
      const shouldIgnore = config.ignorePatterns.some((pattern) => filename.includes(pattern));
      if (shouldIgnore) return;

      // 检查文件扩展名
      const ext = path.extname(filename);
      if (!config.watchExtensions.includes(ext)) return;

      logger.info('DevServer', `📝 文件变化: ${filename}`);
      debouncedRestart();
    });
    logger.info('DevServer', '👀 文件监听已启动');
  } catch (error) {
    logger.error('DevServer', '❌ 文件监听启动失败:', error.message);
    logger.warn('DevServer', '⚠️ 回退到基础模式（无热重载）');
  }
}

// 处理进程信号
process.on('SIGINT', async () => {
  logger.info('DevServer', '\n🛑 收到停止信号，正在关闭服务器...');
  await stopServer();
  // 不直接退出进程，设置退出码并让事件循环自然结束
  process.exitCode = 0;
});

process.on('SIGTERM', async () => {
  logger.info('DevServer', '\n🛑 收到终止信号，正在关闭服务器...');
  await stopServer();
  // 不直接退出进程，设置退出码并让事件循环自然结束
  process.exitCode = 0;
});

// 启动开发环境
logger.info('DevServer', '🔧 设置文件监听...');
setupFileWatcher();

logger.info('DevServer', '🚀 启动初始服务器...');
startServer();
