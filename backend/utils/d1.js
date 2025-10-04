/**
 * Lightweight D1 helpers (optional). Worker will run without DB binding; all methods no-op when env.DB is absent.
 */

export function hasD1(env) {
  return !!env && !!env.DB && typeof env.DB.prepare === 'function';
}

export async function exec(env, sql, params = []) {
  if (!hasD1(env)) return { changes: 0 };
  const stmt = env.DB.prepare(sql);
  const bound = params && params.length ? stmt.bind(...params) : stmt;
  const info = await bound.run();
  return info;
}

export async function queryOne(env, sql, params = []) {
  if (!hasD1(env)) return null;
  const stmt = env.DB.prepare(sql);
  const bound = params && params.length ? stmt.bind(...params) : stmt;
  const row = await bound.first();
  return row || null;
}

export async function ensureSchema(env) {
  if (!hasD1(env)) return false;
  // Ensure FK enforcement
  await exec(env, 'PRAGMA foreign_keys = ON;');
  await exec(env, `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    provider TEXT,
    provider_id TEXT,
    created_at INTEGER,
    updated_at INTEGER
  );`);
  await exec(env, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);');
  await exec(env, `CREATE TABLE IF NOT EXISTS entitlements (
    user_id TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    features TEXT,
    expires_at INTEGER,
    updated_at INTEGER
  );`);
  // 最佳努力添加外键（如表无 FK，则重建为带 FK 的版本）
  try {
    const row = await queryOne(env, 'SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'entitlements\'');
    const hasFK = row && typeof row.sql === 'string' && row.sql.toUpperCase().includes('FOREIGN KEY');
    if (!hasFK) {
      // 迁移：创建新表并复制数据
      await exec(env, `CREATE TABLE IF NOT EXISTS entitlements__new (
        user_id TEXT PRIMARY KEY,
        tier TEXT NOT NULL,
        features TEXT,
        expires_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );`);
      // 复制数据
      await exec(env, 'INSERT OR IGNORE INTO entitlements__new(user_id, tier, features, expires_at, updated_at) SELECT user_id, tier, features, expires_at, updated_at FROM entitlements;');
      // 替换旧表
      await exec(env, 'DROP TABLE entitlements;');
      await exec(env, 'ALTER TABLE entitlements__new RENAME TO entitlements;');
    }
  } catch (_e) { /* ignore */ }
  return true;
}

export function getUserByProvider(env, provider, providerId) {
  return queryOne(env, 'SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, providerId]);
}

export async function upsertUser(env, user) {
  if (!hasD1(env)) return { id: user.id };
  const now = Date.now();
  // 如果提供了 provider 组合键，则优先使用其去重；否则退回 id 冲突
  if (user.provider && user.providerId) {
    await exec(env, `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
    [user.id, user.email || null, user.provider || null, user.providerId || null, now, now]);
  } else {
    await exec(env, `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
    [user.id, user.email || null, user.provider || null, user.providerId || null, now, now]);
  }
  return { id: user.id };
}

export async function upsertEntitlements(env, userId, tier = 'free', features = {}, expiresAt = 0) {
  if (!hasD1(env)) return { userId, tier };
  const now = Date.now();
  await exec(env, `INSERT INTO entitlements(user_id, tier, features, expires_at, updated_at)
    VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier, features=excluded.features, expires_at=excluded.expires_at, updated_at=excluded.updated_at`,
  [userId, tier, JSON.stringify(features || {}), expiresAt, now]);
  return { userId, tier };
}
