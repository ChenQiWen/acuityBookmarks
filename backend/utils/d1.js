/**
 * Cloudflare D1 数据库辅助工具（可选）
 *
 * 职责：
 * - 提供 D1 数据库的访问封装
 * - 处理用户、权限、认证令牌等核心数据操作
 * - 管理数据库 schema 初始化和迁移
 *
 * 设计：
 * - 所有方法在 DB 绑定缺失时优雅降级（no-op）
 * - Worker 可在无数据库绑定的情况下正常运行
 * - 提供事务安全和数据完整性保障
 */
import logger from './logger.js'

/**
 * 检查环境是否包含有效的 D1 数据库绑定
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {boolean} 如果存在有效的 DB 绑定返回 true
 */
export function hasD1(env) {
  return Boolean(env) && Boolean(env.DB) && typeof env.DB.prepare === 'function'
}

/**
 * 执行 SQL 语句（INSERT/UPDATE/DELETE）
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} sql - SQL 语句
 * @param {Array} params - SQL 参数（用于参数化查询，防止 SQL 注入）
 * @returns {Promise<object>} 执行结果，包含 changes（影响行数）等信息
 */
export async function exec(env, sql, params = []) {
  if (!hasD1(env)) return { changes: 0 }
  const stmt = env.DB.prepare(sql)
  const bound = params && params.length ? stmt.bind(...params) : stmt
  const info = await bound.run()
  return info
}

/**
 * 查询单行数据
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - SQL 参数
 * @returns {Promise<object|null>} 查询结果的第一行，未找到时返回 null
 */
export async function queryOne(env, sql, params = []) {
  if (!hasD1(env)) return null
  const stmt = env.DB.prepare(sql)
  const bound = params && params.length ? stmt.bind(...params) : stmt
  const row = await bound.first()
  return row || null
}

/**
 * 确保数据库 schema 已创建
 *
 * 创建或更新所有必需的表和索引：
 * - users: 用户账户信息
 * - entitlements: 用户权限和订阅
 * - refresh_tokens: 刷新令牌
 * - password_resets: 密码重置令牌
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<boolean>} 成功返回 true，无 DB 绑定返回 false
 */
export async function ensureSchema(env) {
  if (!hasD1(env)) return false
  // 确保启用外键约束
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
    nickname TEXT,\n\
    email_verified INTEGER DEFAULT 0,\n\
    failed_attempts INTEGER DEFAULT 0,\n\
    locked_until INTEGER DEFAULT 0,\n\
    last_login_at INTEGER,\n\
    last_login_ip TEXT,\n\
    created_at INTEGER,\n\
    updated_at INTEGER\n\
  );'
  )
  // 迁移：为已存在的 users 表添加 nickname 字段（如果不存在）
  try {
    await exec(env, 'ALTER TABLE users ADD COLUMN nickname TEXT')
  } catch (e) {
    // 字段已存在，忽略错误
    if (!e.message?.includes('duplicate column')) {
      logger.warn('D1.ensureSchema', '添加 nickname 字段失败（可能已存在）:', e)
    }
  }
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

  // Subscriptions table (Lemon Squeezy subscriptions)
  await exec(
    env,
    `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lemon_squeezy_subscription_id TEXT UNIQUE NOT NULL,
    lemon_squeezy_order_id TEXT,
    lemon_squeezy_variant_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'paused')),
    tier TEXT NOT NULL CHECK (tier IN ('free', 'pro')),
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER DEFAULT 0,
    cancelled_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);'
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);'
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_lemon_squeezy_subscription_id ON subscriptions(lemon_squeezy_subscription_id);'
  )

  // Payment records table (Lemon Squeezy payment events)
  await exec(
    env,
    `CREATE TABLE IF NOT EXISTS payment_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subscription_id TEXT,
    lemon_squeezy_order_id TEXT NOT NULL,
    lemon_squeezy_payment_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method TEXT,
    event_type TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
  );`
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);'
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_payment_records_subscription_id ON payment_records(subscription_id);'
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_payment_records_lemon_squeezy_order_id ON payment_records(lemon_squeezy_order_id);'
  )
  await exec(
    env,
    'CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);'
  )

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

/**
 * 根据第三方提供商和提供商ID查询用户
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} provider - 提供商名称（如 'google', 'github'）
 * @param {string} providerId - 提供商的用户ID
 * @returns {Promise<object|null>} 用户记录或 null
 */
export function getUserByProvider(env, provider, providerId) {
  return queryOne(
    env,
    'SELECT * FROM users WHERE provider = ? AND provider_id = ?',
    [provider, providerId]
  )
}

/**
 * 根据邮箱查询用户（不区分大小写）
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} email - 用户邮箱
 * @returns {Promise<object|null>} 用户记录或 null
 */
export function getUserByEmail(env, email) {
  return queryOne(env, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [
    email
  ])
}

/**
 * 根据用户ID查询用户
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @returns {Promise<object|null>} 用户记录或 null
 */
export function getUserById(env, userId) {
  return queryOne(env, 'SELECT * FROM users WHERE id = ?', [userId])
}

/**
 * 插入或更新用户记录（Upsert）
 *
 * 如果提供了 provider 组合键，使用 (provider, providerId) 作为唯一标识；
 * 否则使用 id 作为唯一标识。冲突时更新现有记录。
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} user - 用户对象
 * @param {string} user.id - 用户ID
 * @param {string} [user.email] - 用户邮箱
 * @param {string} [user.provider] - 第三方提供商
 * @param {string} [user.providerId] - 提供商的用户ID
 * @returns {Promise<object>} 包含用户ID的对象
 */
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

/**
 * 验证 provider 输入的完整性
 *
 * provider 和 providerId 必须同时提供或同时省略
 *
 * @param {object} user - 用户对象
 * @returns {string} 'pair' 或 'none'
 * @throws {Error} 如果只提供了其中一个
 */
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

/**
 * 插入或更新用户权限记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @param {string} tier - 订阅层级（如 'free', 'pro', 'enterprise'）
 * @param {object} features - 功能特性对象
 * @param {number} expiresAt - 过期时间戳，0 表示永不过期
 * @returns {Promise<object>} 包含 userId 和 tier 的对象
 */
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

// ========== 第一方认证辅助函数 ==========

/**
 * 创建使用密码认证的用户
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} params - 用户参数
 * @param {string} params.id - 用户ID
 * @param {string} params.email - 用户邮箱
 * @param {string} params.hash - 密码哈希值
 * @param {string} params.salt - 密码盐值
 * @param {string} params.algo - 哈希算法
 * @param {number} params.iter - PBKDF2 迭代次数
 * @returns {Promise<object>} 包含用户ID的对象
 */
export async function createUserWithPassword(
  env,
  { id, email, hash, salt, algo, iter, nickname }
) {
  if (!hasD1(env)) return { id }
  const now = Date.now()
  await exec(
    env,
    'INSERT INTO users(id, email, password_hash, password_salt, password_algo, password_iter, nickname, created_at, updated_at)\n\
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)\n\
    ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, password_salt=excluded.password_salt, password_algo=excluded.password_algo, password_iter=excluded.password_iter, nickname=excluded.nickname, updated_at=excluded.updated_at',
    [id, email, hash, salt, algo, iter, nickname || null, now, now]
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

/**
 * 记录登录成功事件
 *
 * 重置失败尝试次数，解除账户锁定，更新最后登录信息
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @param {string} ip - 登录IP地址
 * @returns {Promise<object>} 包含用户ID的对象
 */
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

/**
 * 记录登录失败事件
 *
 * 增加失败尝试次数，必要时锁定账户
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @param {number} lockUntil - 锁定截止时间戳，0 表示不锁定
 * @returns {Promise<object>} 包含用户ID的对象
 */
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

/**
 * 插入刷新令牌记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} params - 令牌参数
 * @param {string} params.jti - JWT ID（唯一标识符）
 * @param {string} params.userId - 用户ID
 * @param {string} params.tokenHash - 令牌哈希值（用于安全存储）
 * @param {number} params.expiresAt - 过期时间戳
 * @param {string} [params.rotatedFrom] - 轮换来源令牌ID
 * @returns {Promise<object>} 包含令牌ID的对象
 */
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

/**
 * 根据令牌哈希查找未撤销的刷新令牌
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} tokenHash - 令牌哈希值
 * @returns {Promise<object|null>} 令牌记录或 null
 */
export function findRefreshTokenByHash(env, tokenHash) {
  if (!hasD1(env)) return null
  return queryOne(
    env,
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND (revoked_at IS NULL)',
    [tokenHash]
  )
}

/**
 * 撤销刷新令牌
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} jti - JWT ID
 * @returns {Promise<object>} 包含令牌ID的对象
 */
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

/**
 * 更新用户昵称
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @param {string} nickname - 新昵称
 * @returns {Promise<object>} 更新结果
 */
export async function updateUserNickname(env, userId, nickname) {
  if (!hasD1(env)) return { userId }
  const now = Date.now()
  await exec(
    env,
    'UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?',
    [nickname || null, now, userId]
  )
  return { userId, nickname }
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

// ========== 订阅相关函数 ==========

/**
 * 获取用户当前订阅状态
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @returns {Promise<object|null>} 订阅状态或 null
 */
export async function getUserSubscription(env, userId) {
  if (!hasD1(env)) return null
  return queryOne(
    env,
    `SELECT tier, status, current_period_end, cancel_at_period_end
     FROM subscriptions
     WHERE user_id = ? AND status = 'active' AND current_period_end > ?
     ORDER BY current_period_end DESC
     LIMIT 1`,
    [userId, Date.now()]
  )
}

/**
 * 获取用户订阅详情
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户ID
 * @returns {Promise<object|null>} 订阅详情或 null
 */
export async function getSubscriptionDetails(env, userId) {
  if (!hasD1(env)) return null
  return queryOne(
    env,
    `SELECT * FROM subscriptions
     WHERE user_id = ? AND status = 'active'
     ORDER BY current_period_end DESC
     LIMIT 1`,
    [userId]
  )
}

/**
 * 插入或更新订阅记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} subscription - 订阅对象
 * @returns {Promise<object>} 包含订阅ID的对象
 */
export async function upsertSubscription(env, subscription) {
  if (!hasD1(env)) return { id: subscription.id }
  const now = Date.now()
  await exec(
    env,
    `INSERT INTO subscriptions(
      id, user_id, lemon_squeezy_subscription_id, lemon_squeezy_order_id,
      lemon_squeezy_variant_id, status, tier, current_period_start,
      current_period_end, cancel_at_period_end, cancelled_at, created_at, updated_at
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lemon_squeezy_subscription_id) DO UPDATE SET
      user_id=excluded.user_id,
      lemon_squeezy_order_id=excluded.lemon_squeezy_order_id,
      lemon_squeezy_variant_id=excluded.lemon_squeezy_variant_id,
      status=excluded.status,
      tier=excluded.tier,
      current_period_start=excluded.current_period_start,
      current_period_end=excluded.current_period_end,
      cancel_at_period_end=excluded.cancel_at_period_end,
      cancelled_at=excluded.cancelled_at,
      updated_at=excluded.updated_at`,
    [
      subscription.id,
      subscription.user_id,
      subscription.lemon_squeezy_subscription_id,
      subscription.lemon_squeezy_order_id || null,
      subscription.lemon_squeezy_variant_id || null,
      subscription.status,
      subscription.tier,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.cancel_at_period_end ? 1 : 0,
      subscription.cancelled_at || null,
      subscription.created_at || now,
      now
    ]
  )
  return { id: subscription.id }
}

/**
 * 更新订阅的取消状态
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} subscriptionId - 订阅ID
 * @param {boolean} cancelAtPeriodEnd - 是否在周期结束时取消
 * @returns {Promise<object>} 更新结果
 */
export async function updateSubscriptionCancelStatus(
  env,
  subscriptionId,
  cancelAtPeriodEnd
) {
  if (!hasD1(env)) return { id: subscriptionId }
  const now = Date.now()
  await exec(
    env,
    'UPDATE subscriptions SET cancel_at_period_end = ?, updated_at = ? WHERE id = ?',
    [cancelAtPeriodEnd ? 1 : 0, now, subscriptionId]
  )
  return { id: subscriptionId }
}

/**
 * 插入支付记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} payment - 支付对象
 * @returns {Promise<object>} 包含支付ID的对象
 */
export async function insertPaymentRecord(env, payment) {
  if (!hasD1(env)) return { id: payment.id }
  const now = Date.now()
  await exec(
    env,
    `INSERT INTO payment_records(
      id, user_id, subscription_id, lemon_squeezy_order_id,
      lemon_squeezy_payment_id, amount, currency, status,
      payment_method, event_type, metadata, created_at
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.id,
      payment.user_id,
      payment.subscription_id || null,
      payment.lemon_squeezy_order_id,
      payment.lemon_squeezy_payment_id || null,
      payment.amount,
      payment.currency || 'USD',
      payment.status,
      payment.payment_method || null,
      payment.event_type,
      payment.metadata ? JSON.stringify(payment.metadata) : null,
      payment.created_at || now
    ]
  )
  return { id: payment.id }
}
