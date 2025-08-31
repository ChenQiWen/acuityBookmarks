import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'jobs.json');

async function readJobs() {
  try {
    await fs.access(dbPath);
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist or is invalid JSON, start with an empty object
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return {};
    }
    throw error;
  }
}

async function writeJobs(jobs) {
  await fs.writeFile(dbPath, JSON.stringify(jobs, null, 2), 'utf-8');
}

export async function getJob(jobId) {
  const jobs = await readJobs();
  return jobs[jobId];
}

export async function setJob(jobId, jobData) {
  const jobs = await readJobs();
  jobs[jobId] = jobData;
  await writeJobs(jobs);
}

export async function updateJob(jobId, updates) {
  const jobs = await readJobs();
  if (jobs[jobId]) {
    jobs[jobId] = { ...jobs[jobId], ...updates };
    await writeJobs(jobs);
  }
}
