/**
 * 任务存储 - Bun原生实现
 * 使用Bun原生文件API，性能更优
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'jobs.json');

// Bun原生文件对象
const jobsFile = Bun.file(dbPath);

async function readJobs() {
  try {
    // 使用Bun原生API检查文件是否存在
    const exists = await jobsFile.exists();
    if (!exists) {
      return {};
    }

    // 使用Bun原生JSON解析
    const data = await jobsFile.json();
    return data;
  } catch (error) {
    // 如果文件不存在或JSON格式错误，返回空对象
    console.warn('读取jobs文件失败，使用空对象:', error.message);
    return {};
  }
}

async function writeJobs(jobs) {
  try {
    // 使用Bun原生写入API
    await Bun.write(dbPath, JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error('写入jobs文件失败:', error);
    throw error;
  }
}

/**
 * 获取指定任务
 */
export async function getJob(jobId) {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  const jobs = await readJobs();
  return jobs[jobId] || null;
}

/**
 * 设置任务数据
 */
export async function setJob(jobId, jobData) {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  const jobs = await readJobs();
  jobs[jobId] = {
    ...jobData,
    id: jobId,
    updatedAt: new Date().toISOString()
  };

  await writeJobs(jobs);
}

/**
 * 更新任务数据
 */
export async function updateJob(jobId, updates) {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  const jobs = await readJobs();

  if (jobs[jobId]) {
    jobs[jobId] = {
      ...jobs[jobId],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await writeJobs(jobs);
    return jobs[jobId];
  }

  return null;
}

/**
 * 删除任务
 */
export async function deleteJob(jobId) {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  const jobs = await readJobs();

  if (jobs[jobId]) {
    delete jobs[jobId];
    await writeJobs(jobs);
    return true;
  }

  return false;
}

/**
 * 获取所有任务
 */
export async function getAllJobs() {
  return await readJobs();
}

/**
 * 清理过期任务 (超过24小时)
 */
export async function cleanupExpiredJobs() {
  const jobs = await readJobs();
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  let cleanedCount = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    const createdAt = job.startTime ? new Date(job.startTime).getTime() : 0;

    if (now - createdAt > oneDayMs) {
      delete jobs[jobId];
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    await writeJobs(jobs);
    console.log(`🧹 清理了 ${cleanedCount} 个过期任务`);
  }

  return cleanedCount;
}

// 启动时自动清理过期任务
cleanupExpiredJobs().catch(console.error);
