/**
 * 任务存储 - Bun原生实现
 * 使用Bun原生文件API，性能更优
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'jobs.json');

console.log('[job-store] dbPath =', dbPath);

async function readJobs() {
  try {
    const file = Bun.file(dbPath);
    const exists = await file.exists();
    if (!exists) {
      console.log('[job-store] jobs file not exists at', dbPath);
      return {};
    }

    const data = await file.json();
    const keys = data && typeof data === 'object' ? Object.keys(data) : [];
    console.log('[job-store] read keys:', keys);
    return data || {};
  } catch (error) {
    console.warn('读取jobs文件失败，使用空对象:', error.message);
    return {};
  }
}

async function writeJobs(jobs) {
  try {
    await Bun.write(dbPath, JSON.stringify(jobs, null, 2));
    console.log('[job-store] wrote jobs, keys:', Object.keys(jobs));
  } catch (error) {
    console.error('写入jobs文件失败:', error);
    throw error;
  }
}

export async function getJob(jobId) {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  const jobs = await readJobs();
  const found = jobs[jobId] || null;
  console.log('[job-store] getJob', jobId, 'found?', !!found);
  return found;
}

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

export async function getAllJobs() {
  return await readJobs();
}

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
