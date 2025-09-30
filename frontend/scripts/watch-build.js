#!/usr/bin/env bun

/**
 * Chrome扩展热更新构建脚本
 * 监听源文件变化，自动重新构建并更新dist目录
 */

import { spawn, exec } from 'child_process';
import { watch } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 配置选项
const SKIP_ESLINT = process.env.SKIP_ESLINT === 'true';
// 通过环境变量控制是否使用 Cloudflare（不再解析 CLI 参数）
const useCloudflare = process.env.CLOUDFLARE_MODE === 'true';

const srcDir = path.join(process.cwd(), 'src');
const publicDir = path.join(process.cwd(), 'public');
const rootDir = path.join(process.cwd(), '../');
const distDir = path.join(rootDir, 'dist');

let buildProcess = null;
let isBuilding = false;
let buildQueue = false;

console.log(`🚀 启动Chrome扩展热更新模式 ${SKIP_ESLINT ? '' : '(集成ESLint自动修复与严格检查)'}...`);
console.log('✨ 构建流程:');
if (!SKIP_ESLINT) {
  console.log('  1. 🔍 ESLint 自动修复代码');
  console.log('  2. ✅ ESLint 严格检查 (不通过则阻止构建)');
  console.log('  3. 🔨 Vite 构建项目');
  console.log('  4. 🧹 清理构建产物');
} else {
  console.log('  1. 🔨 Vite 构建项目 (跳过ESLint)');
  console.log('  2. 🧹 清理构建产物');
}
console.log('📁 监听目录:');
console.log('  - src/');
console.log('  - public/');
console.log('  - *.html');
console.log('  - background.js (根目录)');
console.log('');

console.log('⚙️ 构建目标服务选择:');
console.log('  - 默认: 本地服务 (http://localhost:3000)');
console.log('  - 切换到 Cloudflare: 设置环境变量 CLOUDFLARE_MODE=true');
console.log('');

function getBuildEnv() {
  const env = { ...process.env };
  if (useCloudflare) {
    // 优先使用显式 Cloudflare Worker 变量，其次使用已配置的 API_BASE，再次使用自定义域默认值
    const cfUrl =
      process.env.VITE_CLOUDFLARE_WORKER_URL ||
      process.env.VITE_API_BASE_URL ||
      'https://api.acuitybookmarks.com';
    env.VITE_API_BASE_URL = cfUrl;
    env.NODE_ENV = env.NODE_ENV || 'production';
    console.log(`🌐 构建目标服务: Cloudflare (${env.VITE_API_BASE_URL})`);
  } else {
    const localUrl = 'http://localhost:3000';
    env.VITE_API_BASE_URL = localUrl;
    console.log(`🌐 构建目标服务: 本地 (${localUrl})`);
  }
  return env;
}

// 获取构建产物大小
async function getBuildSize() {
  try {
    const { stdout } = await execAsync(`du -sh "${distDir}"`);
    return stdout.trim().split('\t')[0];
  } catch (error) {
    console.warn('⚠️ 无法获取构建产物大小:', error.message);
    return '未知';
  }
}

// ESLint 修复函数
async function runESLintFix() {
  console.log('🔍 执行 ESLint 修复...');
  const eslintStartTime = Date.now();
  
  try {
    // 使用与 CI 完全一致的脚本与规则执行 ESLint 修复
    const eslintProcess = spawn('bun', ['run', 'lint:fix'], {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, CI: process.env.CI || 'true' }
    });

    let eslintOutput = '';
    eslintProcess.stdout.on('data', (data) => {
      eslintOutput += data.toString();
    });

    eslintProcess.stderr.on('data', (data) => {
      eslintOutput += data.toString();
    });

    await new Promise((resolve, reject) => {
      eslintProcess.on('close', (code) => {
        const eslintDuration = Date.now() - eslintStartTime;
        
        if (code === 0) {
          console.log(`✅ ESLint 修复完成! 耗时: ${eslintDuration}ms`);
          resolve();
        } else {
          console.log(`⚠️ ESLint 修复阶段检测到问题: ${eslintDuration}ms`);
          if (eslintOutput.trim()) {
            console.log('📋 ESLint 输出:');
            console.log(eslintOutput.trim());
          }
          resolve(); // 进入严格检查环节，由严格检查决定是否继续
        }
      });
      
      eslintProcess.on('error', (error) => {
        console.warn('⚠️ ESLint 执行失败:', error.message);
        resolve(); // 即使ESLint失败也继续构建
      });
    });

  } catch (error) {
    console.warn('⚠️ ESLint 修复过程中出错:', error.message);
    // 不中断构建流程，进入严格检查环节
  }
}

// ESLint 严格检查函数（失败则阻止后续构建）
async function runESLintCheck() {
  console.log('✅ 执行 ESLint 严格检查...');
  const start = Date.now();
  try {
    const checkProcess = spawn('bun', ['run', 'lint:check'], {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, CI: process.env.CI || 'true' }
    });

    let output = '';
    checkProcess.stdout.on('data', (d) => (output += d.toString()));
    checkProcess.stderr.on('data', (d) => (output += d.toString()));

    const result = await new Promise((resolve) => {
      checkProcess.on('close', (code) => resolve({ code }));
      checkProcess.on('error', () => resolve({ code: 1 }));
    });

    const cost = Date.now() - start;
    if (result.code === 0) {
      console.log(`✅ ESLint 严格检查通过! 耗时: ${cost}ms`);
      return true;
    }

    console.error(`❌ ESLint 严格检查失败! 耗时: ${cost}ms`);
    if (output.trim()) {
      console.log('📋 ESLint 输出:');
      console.log(output.trim());
    }
    return false;
  } catch (error) {
    console.error('❌ 执行 ESLint 严格检查时发生错误:', error.message);
    return false;
  }
}

// 构建函数
async function build() {
  if (isBuilding) {
    buildQueue = true;
    return;
  }

  isBuilding = true;
  console.log('🔨 检测到文件变化，开始构建流程...');
  
  const totalStartTime = Date.now();
  
  try {
    // 步骤1: 执行 ESLint 修复 (可选)
    if (!SKIP_ESLINT) {
      await runESLintFix();
      const ok = await runESLintCheck();
      if (!ok) {
        console.error('🛑 阻止后续构建：请先修复以上 ESLint 问题后重试。');
        console.log('💡 若需暂时跳过，可使用脚本: `bun run build:hot:no-lint`');
        throw new Error('ESLint 检查未通过');
      }
    } else {
      console.log('⏭️  跳过 ESLint 修复...');
    }
    
    // 步骤2: 执行构建
    console.log('🔨 开始 Vite 构建...');
    const buildStartTime = Date.now();
    
    // 使用bun运行构建命令（根据参数设置 API 基础地址）
    buildProcess = spawn('bun', ['run', 'build'], {
      stdio: 'pipe',
      shell: true,
      env: getBuildEnv()
    });

    let output = '';
    buildProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    buildProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve, reject) => {
      buildProcess.on('close', async (code) => {
        if (code === 0) {
          const buildDuration = Date.now() - buildStartTime;
          const totalDuration = Date.now() - totalStartTime;
          const buildSize = await getBuildSize();
          console.log(`✅ Vite 构建完成! 耗时: ${buildDuration}ms`);
          console.log(`🎯 总构建流程耗时: ${totalDuration}ms ${SKIP_ESLINT ? '(仅构建)' : '(ESLint + 构建)'}`);
          console.log(`📦 构建产物大小: ${buildSize}`);
          console.log('🔄 Chrome扩展已更新，请刷新扩展页面');
          console.log('');
          resolve();
        } else {
          console.error('❌ Vite 构建失败:');
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
const htmlFiles = ['popup.html', 'management.html', 'search-popup.html', 'debug-management.html', 'management.html', 'debug-panel.html'];
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
console.log(`🔨 执行初始构建流程 ${SKIP_ESLINT ? '(仅 Vite)' : '(ESLint + Vite)'}...`);
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
