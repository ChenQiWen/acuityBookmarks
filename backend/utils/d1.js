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
  return true;
}

export function getUserByProvider(env, provider, providerId) {
  return queryOne(env, 'SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, providerId]);
}

export async function upsertUser(env, user) {
  if (!hasD1(env)) return { id: user.id };
  const now = Date.now();
  await exec(env, `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
  [user.id, user.email || null, user.provider || null, user.providerId || null, now, now]);
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
