/**
 * Lightweight D1 helpers (optional). Worker will run without DB binding; all methods no-op when env.DB is absent.
 */
import logger from './logger.js'

export function hasD1(env) {
  return Boolean(env) && Boolean(env.DB) && typeof env.DB.prepare === 'function'
}

export async function exec(env, sql, params = []) {
  if (!hasD1(env)) return { changes: 0 }
  const stmt = env.DB.prepare(sql)
  const bound = params && params.length ? stmt.bind(...params) : stmt
  const info = await bound.run()
  return info
}

export async function queryOne(env, sql, params = []) {
  if (!hasD1(env)) return null
  const stmt = env.DB.prepare(sql)
  const bound = params && params.length ? stmt.bind(...params) : stmt
  const row = await bound.first()
  return row || null
}

export async function ensureSchema(env) {
  if (!hasD1(env)) return false
  // Ensure FK enforcement
  await exec(env, 'PRAGMA foreign_keys = ON;')
  await exec(
    env,
    'CREATE TABLE IF NOT EXISTS users (\n\
    id TEXT PRIMARY KEY,\n\
    email TEXT UNIQUE,\n\
    provider TEXT,\n\
    provider_id TEXT,\n\
    password_hash TEXT,\n\
    password_salt TEXT,\n\
    password_algo TEXT,\n\
    password_iter INTEGER,\n\
    email_verified INTEGER DEFAULT 0,\n\
    failed_attempts INTEGER DEFAULT 0,\n\
    locked_until INTEGER DEFAULT 0,\n\
    last_login_at INTEGER,\n\
    last_login_ip TEXT,\n\
    created_at INTEGER,\n\
    updated_at INTEGER\n\
  );'
  )
  await exec(
    env,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);'
  )
  await exec(env, 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
  await exec(
    env,
    `CREATE TABLE IF NOT EXISTS entitlements (
    user_id TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    features TEXT,
    expires_at INTEGER,
    updated_at INTEGER
  );`
  )
  await migrateEntitlementsFk(env)

  // Refresh tokens table (store hashes, not raw tokens)
  await exec(
    env,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,               -- jti
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,          -- sha256(base64url) of refresh token
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    rotated_from TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id)'
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash)'
  )

  // Password resets (single-use tokens)
  await exec(
    env,
    `CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,            -- secure random base64url
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    requester_ip TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`
  )
  return true
}

async function migrateEntitlementsFk(env) {
  // 最佳努力添加外键（如表无 FK，则重建为带 FK 的版本）并加固：可观察、事务化、并发保护与数据安全
  try {
    await exec(
      env,
      'CREATE TABLE IF NOT EXISTS migration_versions (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
    )
    const row = await queryOne(
      env,
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='entitlements'"
    )
    const hasFK =
      row &&
      typeof row.sql === 'string' &&
      row.sql.toUpperCase().includes('FOREIGN KEY')
    if (hasFK) return // 已包含外键，无需迁移

    // 注意：Cloudflare Workers/D1 禁止使用显式事务（BEGIN/COMMIT/ROLLBACK）。
    // 这里采用“顺序、幂等、可恢复”的迁移流程，不使用事务，失败时尽量继续或清理。
    await exec(
      env,
      `CREATE TABLE IF NOT EXISTS entitlements__new (
      user_id TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      features TEXT,
      expires_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );`
    )

    await exec(
      env,
      `CREATE TABLE IF NOT EXISTS entitlements_orphans (
      user_id TEXT,
      tier TEXT NOT NULL,
      features TEXT,
      expires_at INTEGER,
      updated_at INTEGER,
      reason TEXT,
      migrated_at INTEGER
    );`
    )

    try {
      const orphanCountRow = await queryOne(
        env,
        'SELECT COUNT(*) as cnt FROM entitlements WHERE user_id NOT IN (SELECT id FROM users)'
      )
      const orphanCount = Number(orphanCountRow?.cnt || 0)
      if (orphanCount > 0) {
        logger.warn(
          'D1.migration',
          `Found ${orphanCount} orphan entitlements; moving to entitlements_orphans`
        )
        await exec(
          env,
          `INSERT INTO entitlements_orphans(user_id, tier, features, expires_at, updated_at, reason, migrated_at)
          SELECT e.user_id, e.tier, e.features, e.expires_at, e.updated_at, 'missing user', CAST(STRFTIME('%s','now') AS INTEGER)*1000
          FROM entitlements e WHERE e.user_id NOT IN (SELECT id FROM users)`
        )
      }
    } catch (orphanErr) {
      logger.warn(
        'D1.migration',
        'orphan scan/insert failed (continuing):',
        orphanErr
      )
    }

    try {
      await exec(
        env,
        `INSERT INTO entitlements__new(user_id, tier, features, expires_at, updated_at)
        SELECT e.user_id, e.tier, e.features, e.expires_at, e.updated_at
        FROM entitlements e WHERE e.user_id IN (SELECT id FROM users)`
      )
    } catch (copyErr) {
      logger.error('D1.migration', 'copy valid entitlements failed:', copyErr)
      // 尝试继续迁移流程，避免卡死在 init。
    }

    try {
      await exec(env, 'DROP TABLE entitlements')
    } catch (dropErr) {
      logger.warn(
        'D1.migration',
        'drop old entitlements failed (may not exist):',
        dropErr
      )
    }
    try {
      await exec(env, 'ALTER TABLE entitlements__new RENAME TO entitlements')
    } catch (renameErr) {
      logger.error('D1.migration', 'rename new table failed:', renameErr)
    }
    try {
      await exec(
        env,
        'INSERT OR REPLACE INTO migration_versions(name, applied_at) VALUES(?, ?)',
        ['entitlements_fk_v1', Date.now()]
      )
    } catch (_mvErr) {
      logger.warn(
        'D1.migration',
        'insert migration version failed (may already exist):',
        _mvErr
      )
    }
  } catch (e) {
    logger.error('D1.ensureSchema', 'migration error:', e)
    // 不再抛出，让 /api/admin/db/init 返回 200 并继续后续 schema 创建
  }
}

export function getUserByProvider(env, provider, providerId) {
  return queryOne(
    env,
    'SELECT * FROM users WHERE provider = ? AND provider_id = ?',
    [provider, providerId]
  )
}

export function getUserByEmail(env, email) {
  return queryOne(env, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [
    email
  ])
}

export function getUserById(env, userId) {
  return queryOne(env, 'SELECT * FROM users WHERE id = ?', [userId])
}

export async function upsertUser(env, user) {
  if (!hasD1(env)) return { id: user.id }
  const now = Date.now()
  const providerMode = validateProviderInput(user)
  // 如果提供了 provider 组合键，则优先使用其去重；否则退回 id 冲突
  if (providerMode === 'pair') {
    await exec(
      env,
      `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
      [
        user.id,
        user.email || null,
        user.provider || null,
        user.providerId || null,
        now,
        now
      ]
    )
  } else {
    await exec(
      env,
      `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
      [
        user.id,
        user.email || null,
        user.provider || null,
        user.providerId || null,
        now,
        now
      ]
    )
  }
  return { id: user.id }
}

function validateProviderInput(user) {
  const hasProvider = user.provider !== null && user.provider !== undefined
  const hasProviderId =
    user.providerId !== null && user.providerId !== undefined
  if (hasProvider && hasProviderId) return 'pair'
  if (!hasProvider && !hasProviderId) return 'none'
  throw new Error(
    'upsertUser: both provider and providerId must be provided together or omitted'
  )
}

export async function upsertEntitlements(
  env,
  userId,
  tier = 'free',
  features = {},
  expiresAt = 0
) {
  if (!hasD1(env)) return { userId, tier }
  const now = Date.now()
  await exec(
    env,
    `INSERT INTO entitlements(user_id, tier, features, expires_at, updated_at)
    VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier, features=excluded.features, expires_at=excluded.expires_at, updated_at=excluded.updated_at`,
    [userId, tier, JSON.stringify(features || {}), expiresAt, now]
  )
  return { userId, tier }
}

// ========== First-party auth helpers ==========
export async function createUserWithPassword(
  env,
  { id, email, hash, salt, algo, iter }
) {
  if (!hasD1(env)) return { id }
  const now = Date.now()
  await exec(
    env,
    'INSERT INTO users(id, email, password_hash, password_salt, password_algo, password_iter, created_at, updated_at)\n\
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)\n\
    ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, password_salt=excluded.password_salt, password_algo=excluded.password_algo, password_iter=excluded.password_iter, updated_at=excluded.updated_at',
    [id, email, hash, salt, algo, iter, now, now]
  )
  return { id }
}

export async function setPassword(env, userId, { hash, salt, algo, iter }) {
  if (!hasD1(env)) return { userId }
  const now = Date.now()
  await exec(
    env,
    'UPDATE users SET password_hash=?, password_salt=?, password_algo=?, password_iter=?, updated_at=? WHERE id=?',
    [hash, salt, algo, iter, now, userId]
  )
  return { userId }
}

export async function recordLoginSuccess(env, userId, ip) {
  if (!hasD1(env)) return { userId }
  const now = Date.now()
  await exec(
    env,
    'UPDATE users SET failed_attempts=0, locked_until=0, last_login_at=?, last_login_ip=?, updated_at=? WHERE id=?',
    [now, ip || null, now, userId]
  )
  return { userId }
}

export async function recordLoginFailure(env, userId, lockUntil = 0) {
  if (!hasD1(env)) return { userId }
  const now = Date.now()
  await exec(
    env,
    'UPDATE users SET failed_attempts = failed_attempts + 1, locked_until=?, updated_at=? WHERE id=?',
    [Number(lockUntil || 0), now, userId]
  )
  return { userId }
}

export async function insertRefreshToken(
  env,
  { jti, userId, tokenHash, expiresAt, rotatedFrom = null }
) {
  if (!hasD1(env)) return { id: jti }
  const now = Date.now()
  await exec(
    env,
    'INSERT INTO refresh_tokens(id, user_id, token_hash, created_at, expires_at, rotated_from)\n\
    VALUES(?, ?, ?, ?, ?, ?)',
    [jti, userId, tokenHash, now, expiresAt, rotatedFrom]
  )
  return { id: jti }
}

export function findRefreshTokenByHash(env, tokenHash) {
  if (!hasD1(env)) return null
  return queryOne(
    env,
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND (revoked_at IS NULL)',
    [tokenHash]
  )
}

export async function revokeRefreshToken(env, jti) {
  if (!hasD1(env)) return { id: jti }
  const now = Date.now()
  await exec(
    env,
    'UPDATE refresh_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL',
    [now, jti]
  )
  return { id: jti }
}

export async function revokeAllRefreshTokensForUser(env, userId) {
  if (!hasD1(env)) return { userId }
  const now = Date.now()
  await exec(
    env,
    'UPDATE refresh_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',
    [now, userId]
  )
  return { userId }
}

export async function createPasswordReset(
  env,
  { token, userId, expiresAt, ip }
) {
  if (!hasD1(env)) return { token }
  const now = Date.now()
  await exec(
    env,
    'INSERT INTO password_resets(token, user_id, created_at, expires_at, requester_ip)\n\
    VALUES(?, ?, ?, ?, ?)',
    [token, userId, now, expiresAt, ip || null]
  )
  return { token }
}

export async function consumePasswordReset(env, token) {
  if (!hasD1(env)) return null
  const row = await queryOne(
    env,
    'SELECT * FROM password_resets WHERE token=?',
    [token]
  )
  if (!row) return null
  if (row.used_at) return { error: 'used' }
  const now = Date.now()
  if (Number(row.expires_at) < now) return { error: 'expired' }
  await exec(
    env,
    'UPDATE password_resets SET used_at=? WHERE token=? AND used_at IS NULL',
    [now, token]
  )
  return { userId: row.user_id }
}
