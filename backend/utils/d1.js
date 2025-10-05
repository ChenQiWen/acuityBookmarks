/**
 * Lightweight D1 helpers (optional). Worker will run without DB binding; all methods no-op when env.DB is absent.
 */
import logger from './logger.js';

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
  await migrateEntitlementsFk(env);
  return true;
}

async function migrateEntitlementsFk(env) {
  // 最佳努力添加外键（如表无 FK，则重建为带 FK 的版本）并加固：可观察、事务化、并发保护与数据安全
  try {
    await exec(env, 'CREATE TABLE IF NOT EXISTS migration_versions (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
    const row = await queryOne(env, 'SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'entitlements\'');
    const hasFK = row && typeof row.sql === 'string' && row.sql.toUpperCase().includes('FOREIGN KEY');
    if (hasFK) return; // 已包含外键，无需迁移
    await exec(env, 'BEGIN IMMEDIATE'); // 简易并发保护
    try {
      const rowTx = await queryOne(env, 'SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'entitlements\'');
      const hasFKTx = rowTx && typeof rowTx.sql === 'string' && rowTx.sql.toUpperCase().includes('FOREIGN KEY');
      if (hasFKTx) { await exec(env, 'COMMIT'); return; }
      await exec(env, `CREATE TABLE IF NOT EXISTS entitlements__new (
        user_id TEXT PRIMARY KEY,
        tier TEXT NOT NULL,
        features TEXT,
        expires_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );`);

      await exec(env, `CREATE TABLE IF NOT EXISTS entitlements_orphans (
        user_id TEXT,
        tier TEXT NOT NULL,
        features TEXT,
        expires_at INTEGER,
        updated_at INTEGER,
        reason TEXT,
        migrated_at INTEGER
      );`);

  const orphanCountRow = await queryOne(env, 'SELECT COUNT(*) as cnt FROM entitlements WHERE user_id NOT IN (SELECT id FROM users)');
      const orphanCount = Number(orphanCountRow?.cnt || 0);
      if (orphanCount > 0) {
        logger.warn('D1.migration', `Found ${orphanCount} orphan entitlements; moving to entitlements_orphans`);
        await exec(env, `INSERT INTO entitlements_orphans(user_id, tier, features, expires_at, updated_at, reason, migrated_at)
          SELECT e.user_id, e.tier, e.features, e.expires_at, e.updated_at, 'missing user', CAST(STRFTIME('%s','now') AS INTEGER)*1000
          FROM entitlements e WHERE e.user_id NOT IN (SELECT id FROM users)`);
      }

      await exec(env, `INSERT INTO entitlements__new(user_id, tier, features, expires_at, updated_at)
        SELECT e.user_id, e.tier, e.features, e.expires_at, e.updated_at
        FROM entitlements e WHERE e.user_id IN (SELECT id FROM users)`);

      await exec(env, 'DROP TABLE entitlements');
      await exec(env, 'ALTER TABLE entitlements__new RENAME TO entitlements');
      await exec(env, 'INSERT OR REPLACE INTO migration_versions(name, applied_at) VALUES(?, ?)', ['entitlements_fk_v1', Date.now()]);
      await exec(env, 'COMMIT');
    } catch (mErr) {
      logger.error('D1.migration', 'entitlements FK migration failed:', mErr);
      try { await exec(env, 'ROLLBACK'); } catch (_rbErr) { /* ignore rollback error */ }
      throw mErr;
    }
  } catch (e) {
    logger.error('D1.ensureSchema', 'migration error:', e);
    throw e;
  }
}

export function getUserByProvider(env, provider, providerId) {
  return queryOne(env, 'SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, providerId]);
}

export async function upsertUser(env, user) {
  if (!hasD1(env)) return { id: user.id };
  const now = Date.now();
  const providerMode = validateProviderInput(user);
  // 如果提供了 provider 组合键，则优先使用其去重；否则退回 id 冲突
  if (providerMode === 'pair') {
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

function validateProviderInput(user) {
  const hasProvider = user.provider !== null && user.provider !== undefined;
  const hasProviderId = user.providerId !== null && user.providerId !== undefined;
  if (hasProvider && hasProviderId) return 'pair';
  if (!hasProvider && !hasProviderId) return 'none';
  throw new Error('upsertUser: both provider and providerId must be provided together or omitted');
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
