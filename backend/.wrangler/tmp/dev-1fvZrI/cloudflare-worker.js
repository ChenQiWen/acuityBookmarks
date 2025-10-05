var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
  }
});

// ../../../../.bun/install/global/node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "../../../../.bun/install/global/node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// utils/logger.js
function shouldLog(level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[CURRENT_LEVEL];
}
function format(scope, level, args) {
  return [`[${scope}]`, ...args];
}
var LEVEL_ORDER, DEFAULT_LEVEL, CURRENT_LEVEL, logger, logger_default;
var init_logger = __esm({
  "utils/logger.js"() {
    init_modules_watch_stub();
    LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
    DEFAULT_LEVEL = process.env.LOG_LEVEL || (false ? "debug" : "info");
    CURRENT_LEVEL = DEFAULT_LEVEL;
    __name(shouldLog, "shouldLog");
    __name(format, "format");
    logger = {
      setLevel(level) {
        if (level in LEVEL_ORDER) CURRENT_LEVEL = level;
      },
      info(scope, ...args) {
        if (!shouldLog("info")) return;
        console.info(...format(scope, "info", args));
      },
      warn(scope, ...args) {
        if (!shouldLog("warn")) return;
        console.warn(...format(scope, "warn", args));
      },
      error(scope, ...args) {
        if (!shouldLog("error")) return;
        console.error(...format(scope, "error", args));
      },
      debug(scope, ...args) {
        if (!shouldLog("debug")) return;
        (console.debug || console.log)(...format(scope, "debug", args));
      }
    };
    logger_default = logger;
  }
});

// utils/d1.js
var d1_exports = {};
__export(d1_exports, {
  consumePasswordReset: () => consumePasswordReset,
  createPasswordReset: () => createPasswordReset,
  createUserWithPassword: () => createUserWithPassword,
  ensureSchema: () => ensureSchema,
  exec: () => exec,
  findRefreshTokenByHash: () => findRefreshTokenByHash,
  getUserByEmail: () => getUserByEmail,
  getUserById: () => getUserById,
  getUserByProvider: () => getUserByProvider,
  hasD1: () => hasD1,
  insertRefreshToken: () => insertRefreshToken,
  queryOne: () => queryOne,
  recordLoginFailure: () => recordLoginFailure,
  recordLoginSuccess: () => recordLoginSuccess,
  revokeAllRefreshTokensForUser: () => revokeAllRefreshTokensForUser,
  revokeRefreshToken: () => revokeRefreshToken,
  setPassword: () => setPassword,
  upsertEntitlements: () => upsertEntitlements,
  upsertUser: () => upsertUser
});
function hasD1(env) {
  return !!env && !!env.DB && typeof env.DB.prepare === "function";
}
async function exec(env, sql, params = []) {
  if (!hasD1(env)) return { changes: 0 };
  const stmt = env.DB.prepare(sql);
  const bound = params && params.length ? stmt.bind(...params) : stmt;
  const info = await bound.run();
  return info;
}
async function queryOne(env, sql, params = []) {
  if (!hasD1(env)) return null;
  const stmt = env.DB.prepare(sql);
  const bound = params && params.length ? stmt.bind(...params) : stmt;
  const row = await bound.first();
  return row || null;
}
async function ensureSchema(env) {
  if (!hasD1(env)) return false;
  await exec(env, "PRAGMA foreign_keys = ON;");
  await exec(env, "CREATE TABLE IF NOT EXISTS users (\n    id TEXT PRIMARY KEY,\n    email TEXT UNIQUE,\n    provider TEXT,\n    provider_id TEXT,\n    password_hash TEXT,\n    password_salt TEXT,\n    password_algo TEXT,\n    password_iter INTEGER,\n    email_verified INTEGER DEFAULT 0,\n    failed_attempts INTEGER DEFAULT 0,\n    locked_until INTEGER DEFAULT 0,\n    last_login_at INTEGER,\n    last_login_ip TEXT,\n    created_at INTEGER,\n    updated_at INTEGER\n  );");
  await exec(env, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);");
  await exec(env, "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
  await exec(env, `CREATE TABLE IF NOT EXISTS entitlements (
    user_id TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    features TEXT,
    expires_at INTEGER,
    updated_at INTEGER
  );`);
  await migrateEntitlementsFk(env);
  await exec(env, `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,               -- jti
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,          -- sha256(base64url) of refresh token
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    rotated_from TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);
  await exec(env, "CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id)");
  await exec(env, "CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash)");
  await exec(env, `CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,            -- secure random base64url
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    requester_ip TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);
  return true;
}
async function migrateEntitlementsFk(env) {
  try {
    await exec(env, "CREATE TABLE IF NOT EXISTS migration_versions (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
    const row = await queryOne(env, "SELECT sql FROM sqlite_master WHERE type='table' AND name='entitlements'");
    const hasFK = row && typeof row.sql === "string" && row.sql.toUpperCase().includes("FOREIGN KEY");
    if (hasFK) return;
    await exec(env, "BEGIN IMMEDIATE");
    try {
      const rowTx = await queryOne(env, "SELECT sql FROM sqlite_master WHERE type='table' AND name='entitlements'");
      const hasFKTx = rowTx && typeof rowTx.sql === "string" && rowTx.sql.toUpperCase().includes("FOREIGN KEY");
      if (hasFKTx) {
        await exec(env, "COMMIT");
        return;
      }
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
      const orphanCountRow = await queryOne(env, "SELECT COUNT(*) as cnt FROM entitlements WHERE user_id NOT IN (SELECT id FROM users)");
      const orphanCount = Number(orphanCountRow?.cnt || 0);
      if (orphanCount > 0) {
        logger_default.warn("D1.migration", `Found ${orphanCount} orphan entitlements; moving to entitlements_orphans`);
        await exec(env, `INSERT INTO entitlements_orphans(user_id, tier, features, expires_at, updated_at, reason, migrated_at)
          SELECT e.user_id, e.tier, e.features, e.expires_at, e.updated_at, 'missing user', CAST(STRFTIME('%s','now') AS INTEGER)*1000
          FROM entitlements e WHERE e.user_id NOT IN (SELECT id FROM users)`);
      }
      await exec(env, `INSERT INTO entitlements__new(user_id, tier, features, expires_at, updated_at)
        SELECT e.user_id, e.tier, e.features, e.expires_at, e.updated_at
        FROM entitlements e WHERE e.user_id IN (SELECT id FROM users)`);
      await exec(env, "DROP TABLE entitlements");
      await exec(env, "ALTER TABLE entitlements__new RENAME TO entitlements");
      await exec(env, "INSERT OR REPLACE INTO migration_versions(name, applied_at) VALUES(?, ?)", ["entitlements_fk_v1", Date.now()]);
      await exec(env, "COMMIT");
    } catch (mErr) {
      logger_default.error("D1.migration", "entitlements FK migration failed:", mErr);
      try {
        await exec(env, "ROLLBACK");
      } catch (_rbErr) {
      }
      throw mErr;
    }
  } catch (e) {
    logger_default.error("D1.ensureSchema", "migration error:", e);
    throw e;
  }
}
function getUserByProvider(env, provider, providerId) {
  return queryOne(env, "SELECT * FROM users WHERE provider = ? AND provider_id = ?", [provider, providerId]);
}
function getUserByEmail(env, email) {
  return queryOne(env, "SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]);
}
function getUserById(env, userId) {
  return queryOne(env, "SELECT * FROM users WHERE id = ?", [userId]);
}
async function upsertUser(env, user) {
  if (!hasD1(env)) return { id: user.id };
  const now = Date.now();
  const providerMode = validateProviderInput(user);
  if (providerMode === "pair") {
    await exec(
      env,
      `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
      [user.id, user.email || null, user.provider || null, user.providerId || null, now, now]
    );
  } else {
    await exec(
      env,
      `INSERT INTO users(id, email, provider, provider_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, updated_at=excluded.updated_at`,
      [user.id, user.email || null, user.provider || null, user.providerId || null, now, now]
    );
  }
  return { id: user.id };
}
function validateProviderInput(user) {
  const hasProvider = user.provider !== null && user.provider !== void 0;
  const hasProviderId = user.providerId !== null && user.providerId !== void 0;
  if (hasProvider && hasProviderId) return "pair";
  if (!hasProvider && !hasProviderId) return "none";
  throw new Error("upsertUser: both provider and providerId must be provided together or omitted");
}
async function upsertEntitlements(env, userId, tier = "free", features = {}, expiresAt = 0) {
  if (!hasD1(env)) return { userId, tier };
  const now = Date.now();
  await exec(
    env,
    `INSERT INTO entitlements(user_id, tier, features, expires_at, updated_at)
    VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier, features=excluded.features, expires_at=excluded.expires_at, updated_at=excluded.updated_at`,
    [userId, tier, JSON.stringify(features || {}), expiresAt, now]
  );
  return { userId, tier };
}
async function createUserWithPassword(env, { id, email, hash, salt, algo, iter }) {
  if (!hasD1(env)) return { id };
  const now = Date.now();
  await exec(
    env,
    "INSERT INTO users(id, email, password_hash, password_salt, password_algo, password_iter, created_at, updated_at)\n    VALUES(?, ?, ?, ?, ?, ?, ?, ?)\n    ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, password_salt=excluded.password_salt, password_algo=excluded.password_algo, password_iter=excluded.password_iter, updated_at=excluded.updated_at",
    [id, email, hash, salt, algo, iter, now, now]
  );
  return { id };
}
async function setPassword(env, userId, { hash, salt, algo, iter }) {
  if (!hasD1(env)) return { userId };
  const now = Date.now();
  await exec(
    env,
    "UPDATE users SET password_hash=?, password_salt=?, password_algo=?, password_iter=?, updated_at=? WHERE id=?",
    [hash, salt, algo, iter, now, userId]
  );
  return { userId };
}
async function recordLoginSuccess(env, userId, ip) {
  if (!hasD1(env)) return { userId };
  const now = Date.now();
  await exec(
    env,
    "UPDATE users SET failed_attempts=0, locked_until=0, last_login_at=?, last_login_ip=?, updated_at=? WHERE id=?",
    [now, ip || null, now, userId]
  );
  return { userId };
}
async function recordLoginFailure(env, userId, lockUntil = 0) {
  if (!hasD1(env)) return { userId };
  const now = Date.now();
  await exec(
    env,
    "UPDATE users SET failed_attempts = failed_attempts + 1, locked_until=?, updated_at=? WHERE id=?",
    [Number(lockUntil || 0), now, userId]
  );
  return { userId };
}
async function insertRefreshToken(env, { jti, userId, tokenHash, expiresAt, rotatedFrom = null }) {
  if (!hasD1(env)) return { id: jti };
  const now = Date.now();
  await exec(
    env,
    "INSERT INTO refresh_tokens(id, user_id, token_hash, created_at, expires_at, rotated_from)\n    VALUES(?, ?, ?, ?, ?, ?)",
    [jti, userId, tokenHash, now, expiresAt, rotatedFrom]
  );
  return { id: jti };
}
function findRefreshTokenByHash(env, tokenHash) {
  if (!hasD1(env)) return null;
  return queryOne(env, "SELECT * FROM refresh_tokens WHERE token_hash = ? AND (revoked_at IS NULL)", [tokenHash]);
}
async function revokeRefreshToken(env, jti) {
  if (!hasD1(env)) return { id: jti };
  const now = Date.now();
  await exec(env, "UPDATE refresh_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL", [now, jti]);
  return { id: jti };
}
async function revokeAllRefreshTokensForUser(env, userId) {
  if (!hasD1(env)) return { userId };
  const now = Date.now();
  await exec(env, "UPDATE refresh_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", [now, userId]);
  return { userId };
}
async function createPasswordReset(env, { token, userId, expiresAt, ip }) {
  if (!hasD1(env)) return { token };
  const now = Date.now();
  await exec(
    env,
    "INSERT INTO password_resets(token, user_id, created_at, expires_at, requester_ip)\n    VALUES(?, ?, ?, ?, ?)",
    [token, userId, now, expiresAt, ip || null]
  );
  return { token };
}
async function consumePasswordReset(env, token) {
  if (!hasD1(env)) return null;
  const row = await queryOne(env, "SELECT * FROM password_resets WHERE token=?", [token]);
  if (!row) return null;
  if (row.used_at) return { error: "used" };
  const now = Date.now();
  if (Number(row.expires_at) < now) return { error: "expired" };
  await exec(env, "UPDATE password_resets SET used_at=? WHERE token=? AND used_at IS NULL", [now, token]);
  return { userId: row.user_id };
}
var init_d1 = __esm({
  "utils/d1.js"() {
    init_modules_watch_stub();
    init_logger();
    __name(hasD1, "hasD1");
    __name(exec, "exec");
    __name(queryOne, "queryOne");
    __name(ensureSchema, "ensureSchema");
    __name(migrateEntitlementsFk, "migrateEntitlementsFk");
    __name(getUserByProvider, "getUserByProvider");
    __name(getUserByEmail, "getUserByEmail");
    __name(getUserById, "getUserById");
    __name(upsertUser, "upsertUser");
    __name(validateProviderInput, "validateProviderInput");
    __name(upsertEntitlements, "upsertEntitlements");
    __name(createUserWithPassword, "createUserWithPassword");
    __name(setPassword, "setPassword");
    __name(recordLoginSuccess, "recordLoginSuccess");
    __name(recordLoginFailure, "recordLoginFailure");
    __name(insertRefreshToken, "insertRefreshToken");
    __name(findRefreshTokenByHash, "findRefreshTokenByHash");
    __name(revokeRefreshToken, "revokeRefreshToken");
    __name(revokeAllRefreshTokensForUser, "revokeAllRefreshTokensForUser");
    __name(createPasswordReset, "createPasswordReset");
    __name(consumePasswordReset, "consumePasswordReset");
  }
});

// .wrangler/tmp/bundle-zxSxhC/middleware-loader.entry.ts
init_modules_watch_stub();

// .wrangler/tmp/bundle-zxSxhC/middleware-insertion-facade.js
init_modules_watch_stub();

// cloudflare-worker.js
init_modules_watch_stub();
var DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
var DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-m3";
var DEFAULT_TEMPERATURE = 0.6;
var DEFAULT_JWT_EXPIRES_IN = 7 * 24 * 60 * 60;
var DEFAULT_MAX_TOKENS = 256;
var PWD_MIN_LEN = 10;
var PWD_ITER = 12e4;
var PWD_ALGO = "pbkdf2-sha256";
var ACCESS_TTL = 60 * 60;
var REFRESH_TTL = 30 * 24 * 60 * 60;
var RESET_TTL = 20 * 60;
var DERIVED_KEY_LEN = 32;
var SALT_LEN = 16;
var EMAIL_MIN_LEN = 6;
var LOCK_WINDOW_MS = 10 * 60 * 1e3;
var LOCK_FAIL_MAX = 5;
var RAND_BYTES_32 = 32;
var RAND_BYTES_16 = 16;
var HTTP_CONFLICT = 409;
var HTTP_LOCKED = 423;
var CRAWL_TIMEOUT_MS = 8e3;
var HTML_SLICE_LIMIT = 16384;
var STATUS_UNSUPPORTED_MEDIA_TYPE = 415;
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
var ACCEPT_HTML = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
var MIN_EMBED_TEXT_LENGTH = 3;
var DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES = [".chromiumapp.org"];
var corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};
var okJson = /* @__PURE__ */ __name((data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json", ...corsHeaders } }), "okJson");
var errorJson = /* @__PURE__ */ __name((data, status = 500) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...corsHeaders } }), "errorJson");
function handleOptions() {
  return new Response(null, { headers: corsHeaders });
}
__name(handleOptions, "handleOptions");
function handleHealth() {
  return okJson({ status: "ok", runtime: "cloudflare-worker", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
}
__name(handleHealth, "handleHealth");
function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = globalThis.btoa(bin);
  return b64.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(toBase64Url, "toBase64Url");
function fromUtf8(text) {
  return new globalThis.TextEncoder().encode(text);
}
__name(fromUtf8, "fromUtf8");
function randomBase64Url(n = RAND_BYTES_32) {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return toBase64Url(arr);
}
__name(randomBase64Url, "randomBase64Url");
async function pbkdf2Sha256(password, saltBytes, iterations = PWD_ITER, length = 32) {
  const key = await globalThis.crypto.subtle.importKey("raw", fromUtf8(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations }, key, length * 8);
  return new Uint8Array(bits);
}
__name(pbkdf2Sha256, "pbkdf2Sha256");
async function hashPassword(password, saltB64url, iterations = PWD_ITER) {
  const salt = Uint8Array.from(globalThis.atob(saltB64url.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const derived = await pbkdf2Sha256(password, salt, iterations, DERIVED_KEY_LEN);
  return toBase64Url(derived);
}
__name(hashPassword, "hashPassword");
async function deriveNewPassword(password, iterations = PWD_ITER) {
  const salt = new Uint8Array(SALT_LEN);
  globalThis.crypto.getRandomValues(salt);
  const hash = await pbkdf2Sha256(password, salt, iterations, DERIVED_KEY_LEN);
  return { hash: toBase64Url(hash), salt: toBase64Url(salt), algo: PWD_ALGO, iter: iterations };
}
__name(deriveNewPassword, "deriveNewPassword");
async function sha256Base64Url(input) {
  const bytes = typeof input === "string" ? fromUtf8(input) : input;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toBase64Url(new Uint8Array(digest));
}
__name(sha256Base64Url, "sha256Base64Url");
function validateEmail(email) {
  const e = String(email || "").trim();
  return e.length >= EMAIL_MIN_LEN && e.includes("@");
}
__name(validateEmail, "validateEmail");
function validatePasswordStrength(pw) {
  const s = String(pw || "");
  if (s.length < PWD_MIN_LEN) return false;
  const hasLower = /[a-z]/.test(s);
  const hasUpper = /[A-Z]/.test(s);
  const hasDigit = /\d/.test(s);
  const hasSym = /[^A-Za-z0-9]/.test(s);
  let score = 0;
  if (hasLower) score++;
  if (hasUpper) score++;
  if (hasDigit) score++;
  if (hasSym) score++;
  return score >= 3;
}
__name(validatePasswordStrength, "validatePasswordStrength");
function getIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
}
__name(getIp, "getIp");
async function handleAIComplete(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const prompt = url.searchParams.get("prompt") || body.prompt || "";
    const messages = body.messages || void 0;
    const stream = body.stream === true || url.searchParams.get("stream") === "true";
    const model = body.model || url.searchParams.get("model") || DEFAULT_MODEL;
    const temperature = body.temperature ?? DEFAULT_TEMPERATURE;
    const max_tokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;
    if (!prompt && !Array.isArray(messages)) return errorJson({ error: "missing prompt or messages" }, 400);
    const params = Array.isArray(messages) && messages.length > 0 ? { messages, stream, temperature, max_tokens } : { prompt, stream, temperature, max_tokens };
    const answer = await env.AI.run(model, params);
    if (stream) return new Response(answer, { headers: { "content-type": "text/event-stream", ...corsHeaders } });
    return okJson(answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAIComplete, "handleAIComplete");
async function handleAIEmbedding(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const text = url.searchParams.get("text") || body.text || "";
    const model = body.model || url.searchParams.get("model") || DEFAULT_EMBEDDING_MODEL;
    if (!text) return errorJson({ error: "missing text" }, 400);
    const trimmed = text.trim();
    if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
      return errorJson({
        error: "text too short",
        details: { minTextLength: MIN_EMBED_TEXT_LENGTH, actualLength: trimmed.length }
      }, 400);
    }
    const vector = await generateEmbeddingVector(env, model, trimmed);
    if (!Array.isArray(vector) || vector.length === 0) {
      return errorJson({
        error: "embedding generation produced empty vector",
        details: { model, textLength: trimmed.length }
      }, 500);
    }
    return okJson({ vector, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAIEmbedding, "handleAIEmbedding");
async function handleVectorizeUpsert(request, env) {
  try {
    if (request.method !== "POST") return errorJson({ error: "Method not allowed" }, 405);
    const body = await request.json().catch(() => ({}));
    const vectors = Array.isArray(body?.vectors) ? body.vectors : [];
    if (!vectors.length) return errorJson({ error: "missing vectors" }, 400);
    const normalized = vectors.map((v) => ({
      id: String(v.id),
      values: Array.isArray(v.values) ? v.values : Array.isArray(v.vector) ? v.vector : [],
      metadata: v.metadata || {}
    })).filter((v) => Array.isArray(v.values) && v.values.length > 0 && v.id);
    if (!normalized.length) return errorJson({ error: "no valid vectors" }, 400);
    const result = await env.VECTORIZE.upsert(normalized);
    const attempted = normalized.length;
    return okJson({ success: true, attempted, mutation: result?.mutation || result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleVectorizeUpsert, "handleVectorizeUpsert");
async function handleVectorizeQuery(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const text = url.searchParams.get("text") || body.text || "";
    const vector = Array.isArray(body.vector) ? body.vector : void 0;
    const topK = Number(url.searchParams.get("topK") || body.topK || 10);
    const returnMetadata = body.returnMetadata || url.searchParams.get("returnMetadata") || "indexed";
    const returnValues = body.returnValues === true || url.searchParams.get("returnValues") === "true";
    const modelOverride = body.model || url.searchParams.get("model") || void 0;
    let queryVector = vector;
    if (!queryVector) {
      if (!text) return errorJson({ error: "missing text or vector" }, 400);
      const trimmed = text.trim();
      if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
        return errorJson({
          error: "text too short for embedding",
          details: { minTextLength: MIN_EMBED_TEXT_LENGTH, actualLength: trimmed.length }
        }, 400);
      }
      const model = modelOverride || DEFAULT_EMBEDDING_MODEL;
      try {
        queryVector = await generateEmbeddingVector(env, model, trimmed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return errorJson({
          error: `embedding generation failed: ${msg}`,
          details: { model, textLength: trimmed.length }
        }, 500);
      }
    }
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return errorJson({
        error: "embedding generation produced empty vector",
        details: { textLength: (text || "").trim().length }
      }, 500);
    }
    let matches;
    try {
      matches = await env.VECTORIZE.query(queryVector, {
        topK,
        returnMetadata,
        returnValues
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return errorJson({
        error: `vectorize query failed: ${msg}`,
        details: { topK, returnMetadata, returnValues }
      }, 500);
    }
    return okJson({ success: true, matches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleVectorizeQuery, "handleVectorizeQuery");
async function handleCrawl(request) {
  try {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get("url") || "";
    if (!targetUrl && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      targetUrl = body.url || "";
    }
    if (!targetUrl) return errorJson({ error: "missing url" }, 400);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);
    const resp = await fetch(targetUrl, { signal: controller.signal, headers: { "User-Agent": UA, "Accept": ACCEPT_HTML }, redirect: "follow" });
    clearTimeout(timeoutId);
    if (!resp.ok) return errorJson({ error: `HTTP ${resp.status}` }, resp.status);
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return errorJson({ error: `Not HTML: ${contentType}` }, STATUS_UNSUPPORTED_MEDIA_TYPE);
    const html = await resp.text();
    const limited = html.slice(0, HTML_SLICE_LIMIT);
    const titleMatch = limited.match(/<title[^>]*>([^<]*)<\/title>/i);
    const getMeta = /* @__PURE__ */ __name((attr, value) => {
      const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"]*)["'][^>]*>`, "i");
      const m = limited.match(re);
      return m?.[1]?.trim() || "";
    }, "getMeta");
    return okJson({
      status: resp.status,
      finalUrl: resp.url,
      title: titleMatch?.[1]?.trim() || "",
      description: getMeta("name", "description").substring(0, 500),
      keywords: getMeta("name", "keywords").substring(0, 300),
      ogTitle: getMeta("property", "og:title"),
      ogDescription: getMeta("property", "og:description").substring(0, 500),
      ogImage: getMeta("property", "og:image"),
      ogSiteName: getMeta("property", "og:site_name")
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleCrawl, "handleCrawl");
var cloudflare_worker_default = {
  fetch(request, env, _ctx) {
    if (request.method === "OPTIONS") return handleOptions();
    const url = new URL(request.url);
    try {
      Promise.resolve().then(() => (init_d1(), d1_exports)).then((m) => m.ensureSchema?.(env)).catch(() => {
      });
    } catch (_e) {
    }
    if (url.pathname === "/api/health" || url.pathname === "/health") return handleHealth();
    if (url.pathname === "/api/auth/register") return handleRegister(request, env);
    if (url.pathname === "/api/auth/login") return handlePasswordLogin(request, env);
    if (url.pathname === "/api/auth/refresh") return handleRefresh(request, env);
    if (url.pathname === "/api/auth/forgot-password") return handleForgotPassword(request, env);
    if (url.pathname === "/api/auth/reset-password") return handleResetPassword(request, env);
    if (url.pathname === "/api/auth/change-password") return handleChangePassword(request, env);
    if (url.pathname === "/api/auth/start") return handleAuthStart(request, env);
    if (url.pathname === "/api/auth/callback") return handleAuthCallback(request, env);
    if (url.pathname === "/auth/dev/authorize") return handleAuthDevAuthorize(request, env);
    if (url.pathname === "/api/user/me") return handleUserMe(request, env);
    if (url.pathname === "/api/auth/dev-login") return handleDevLogin(request, env);
    if (url.pathname === "/api/ai/complete") return handleAIComplete(request, env);
    if (url.pathname === "/api/ai/embedding") return handleAIEmbedding(request, env);
    if (url.pathname === "/api/vectorize/upsert") return handleVectorizeUpsert(request, env);
    if (url.pathname === "/api/vectorize/query") return handleVectorizeQuery(request, env);
    if (url.pathname === "/api/crawl") return handleCrawl(request);
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
async function mustD1(env) {
  const m = await Promise.resolve().then(() => (init_d1(), d1_exports));
  if (!m.hasD1(env)) return { ok: false, mod: m };
  return { ok: true, mod: m };
}
__name(mustD1, "mustD1");
function signAccess(env, payload, ttlSec = ACCESS_TTL) {
  const secret = env.JWT_SECRET || env.SECRET || "dev-secret";
  return signJWT(secret, payload, ttlSec);
}
__name(signAccess, "signAccess");
async function newRefreshForUser(env, mod, userId) {
  const token = randomBase64Url(RAND_BYTES_32);
  const tokenHash = await sha256Base64Url(token);
  const jti = randomBase64Url(RAND_BYTES_16);
  const expiresAt = Math.floor(Date.now() / 1e3) + REFRESH_TTL;
  await mod.insertRefreshToken(env, { jti, userId, tokenHash, expiresAt });
  return { token, jti, expiresAt };
}
__name(newRefreshForUser, "newRefreshForUser");
async function handleRegister(request, env) {
  try {
    const { ok, mod } = await mustD1(env);
    if (!ok) return errorJson({ error: "database not configured" }, 501);
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!validateEmail(email)) return errorJson({ error: "invalid email" }, 400);
    if (!validatePasswordStrength(password)) return errorJson({ error: "weak password" }, 400);
    const existing = await mod.getUserByEmail(env, email);
    if (existing) return errorJson({ error: "email already registered" }, HTTP_CONFLICT);
    const deriv = await deriveNewPassword(password, PWD_ITER);
    const userId = `local:${email.toLowerCase()}`;
    await mod.createUserWithPassword(env, { id: userId, email, hash: deriv.hash, salt: deriv.salt, algo: deriv.algo, iter: deriv.iter });
    await mod.upsertEntitlements(env, userId, "free", {}, 0);
    const access = signAccess(env, { sub: userId, email, tier: "free", features: {} }, ACCESS_TTL);
    const ref = await newRefreshForUser(env, mod, userId);
    return okJson({ success: true, accessToken: access, refreshToken: ref.token, expiresIn: ACCESS_TTL });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleRegister, "handleRegister");
async function handlePasswordLogin(request, env) {
  try {
    const { ok, mod } = await mustD1(env);
    if (!ok) return errorJson({ error: "database not configured" }, 501);
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!validateEmail(email)) return errorJson({ error: "invalid email or password" }, 400);
    const user = await mod.getUserByEmail(env, email);
    if (!user || !user.password_hash || !user.password_salt) return errorJson({ error: "invalid email or password" }, 400);
    const now = Date.now();
    if (Number(user.locked_until || 0) > now) return errorJson({ error: "account temporarily locked" }, HTTP_LOCKED);
    const computed = await hashPassword(password, String(user.password_salt), Number(user.password_iter || PWD_ITER));
    if (computed !== String(user.password_hash)) {
      const attempts = Number(user.failed_attempts || 0) + 1;
      const willLock = attempts >= LOCK_FAIL_MAX ? now + LOCK_WINDOW_MS : 0;
      await mod.recordLoginFailure(env, user.id, willLock);
      return errorJson({ error: "invalid email or password" }, 400);
    }
    await mod.recordLoginSuccess(env, user.id, getIp(request));
    const access = signAccess(env, { sub: user.id, email: user.email, tier: "free", features: {} }, ACCESS_TTL);
    const ref = await newRefreshForUser(env, mod, user.id);
    return okJson({ success: true, accessToken: access, refreshToken: ref.token, expiresIn: ACCESS_TTL });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handlePasswordLogin, "handlePasswordLogin");
async function handleRefresh(request, env) {
  try {
    const { ok, mod } = await mustD1(env);
    if (!ok) return errorJson({ error: "database not configured" }, 501);
    const body = await request.json().catch(() => ({}));
    const token = String(body.refreshToken || "");
    if (!token) return errorJson({ error: "missing refreshToken" }, 400);
    const tokenHash = await sha256Base64Url(token);
    const row = await mod.findRefreshTokenByHash(env, tokenHash);
    if (!row) return errorJson({ error: "invalid refreshToken" }, 401);
    const nowSec = Math.floor(Date.now() / 1e3);
    if (Number(row.expires_at || 0) < nowSec) {
      await mod.revokeRefreshToken(env, row.id);
      return errorJson({ error: "expired refreshToken" }, 401);
    }
    await mod.revokeRefreshToken(env, row.id);
    const fresh = await newRefreshForUser(env, mod, row.user_id);
    const access = await signAccess(env, { sub: row.user_id }, ACCESS_TTL);
    return okJson({ success: true, accessToken: access, refreshToken: fresh.token, expiresIn: ACCESS_TTL });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleRefresh, "handleRefresh");
async function handleForgotPassword(request, env) {
  try {
    const { ok, mod } = await mustD1(env);
    if (!ok) return errorJson({ error: "database not configured" }, 501);
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    if (!validateEmail(email)) return okJson({ success: true });
    const user = await mod.getUserByEmail(env, email);
    if (!user) return okJson({ success: true });
    const token = await randomBase64Url(24);
    const exp = Date.now() + RESET_TTL * 1e3;
    await mod.createPasswordReset(env, { token, userId: user.id, expiresAt: exp, ip: getIp(request) });
    const allowDev = getEnvFlag(env, "ALLOW_DEV_LOGIN", false);
    return okJson({ success: true, ...allowDev ? { token } : {} });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleForgotPassword, "handleForgotPassword");
async function handleResetPassword(request, env) {
  try {
    const { ok, mod } = await mustD1(env);
    if (!ok) return errorJson({ error: "database not configured" }, 501);
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "");
    const newPassword = String(body.newPassword || "");
    if (!token || !validatePasswordStrength(newPassword)) return errorJson({ error: "invalid token or password" }, 400);
    const res = await mod.consumePasswordReset(env, token);
    if (!res || res.error) return errorJson({ error: "invalid or expired token" }, 400);
    const deriv = await deriveNewPassword(newPassword, PWD_ITER);
    await mod.setPassword(env, res.userId, deriv);
    await mod.revokeAllRefreshTokensForUser(env, res.userId);
    return okJson({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleResetPassword, "handleResetPassword");
async function handleChangePassword(request, env) {
  try {
    const { ok, mod } = await mustD1(env);
    if (!ok) return errorJson({ error: "database not configured" }, 501);
    const token = parseBearer(request);
    if (!token) return errorJson({ error: "unauthorized" }, 401);
    const secret = env.JWT_SECRET || env.SECRET || "dev-secret";
    const v = await verifyJWT(secret, token);
    if (!v.ok) return errorJson({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const oldPassword = String(body.oldPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!validatePasswordStrength(newPassword)) return errorJson({ error: "weak password" }, 400);
    const user = await mod.getUserById(env, v.payload?.sub);
    if (!user || !user.password_hash || !user.password_salt) return errorJson({ error: "unauthorized" }, 401);
    const computed = await hashPassword(oldPassword, String(user.password_salt), Number(user.password_iter || PWD_ITER));
    if (computed !== String(user.password_hash)) return errorJson({ error: "invalid old password" }, 400);
    const deriv = await deriveNewPassword(newPassword, PWD_ITER);
    await mod.setPassword(env, user.id, deriv);
    await mod.revokeAllRefreshTokensForUser(env, user.id);
    return okJson({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleChangePassword, "handleChangePassword");
function getEnvFlag(env, key, defaultBool = false) {
  const v = env && (env[key] ?? env[key?.toUpperCase?.()] ?? env[key?.toLowerCase?.()]);
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.toLowerCase());
  return defaultBool;
}
__name(getEnvFlag, "getEnvFlag");
function parseAllowlist(env) {
  const raw = env && (env.REDIRECT_URI_ALLOWLIST || env.REDIRECT_ALLOWLIST || "");
  if (!raw) return [];
  try {
    if (raw.trim().startsWith("[")) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(String) : [];
    }
  } catch (_e) {
  }
  return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
}
__name(parseAllowlist, "parseAllowlist");
function isHttpsLikeLocal(u) {
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}
__name(isHttpsLikeLocal, "isHttpsLikeLocal");
function isAllowedRedirectUri(redirectUri, env) {
  try {
    const u = new URL(redirectUri);
    const scheme = u.protocol;
    if (scheme !== "https:" && scheme !== "chrome-extension:" && !isHttpsLikeLocal(u)) {
      return { ok: false, error: "unsupported scheme" };
    }
    if (scheme === "https:") {
      const host = u.hostname.toLowerCase();
      if (!DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES.some((suf) => host.endsWith(suf))) {
        const allow = parseAllowlist(env);
        if (allow.length) {
          const href = u.toString();
          const origin = `${u.protocol}//${u.host}`;
          const ok = allow.some((item) => href.startsWith(item) || origin === item || host === item);
          if (!ok) return { ok: false, error: "redirect not in allowlist" };
        }
      }
    }
    if (scheme === "javascript:" || scheme === "data:") return { ok: false, error: "dangerous scheme" };
    return { ok: true };
  } catch (_e) {
    return { ok: false, error: "invalid redirect_uri" };
  }
}
__name(isAllowedRedirectUri, "isAllowedRedirectUri");
function extractEmbeddingVector(answer) {
  if (!answer) return void 0;
  if (Array.isArray(answer)) return answer;
  if (Array.isArray(answer.data)) {
    const first = answer.data[0];
    if (Array.isArray(first)) return first;
    if (first && Array.isArray(first.embedding)) return first.embedding;
    if (typeof answer.data[0] === "number") return answer.data;
  }
  if (Array.isArray(answer.embeddings)) {
    const e0 = answer.embeddings[0];
    return Array.isArray(e0) ? e0 : answer.embeddings;
  }
  if (Array.isArray(answer.embedding)) return answer.embedding;
  return void 0;
}
__name(extractEmbeddingVector, "extractEmbeddingVector");
async function generateEmbeddingVector(env, model, text) {
  const emb = await env.AI.run(model, { text });
  return extractEmbeddingVector(emb);
}
__name(generateEmbeddingVector, "generateEmbeddingVector");
function base64urlEncode(data) {
  const bytes = typeof data === "string" ? new globalThis.TextEncoder().encode(data) : new Uint8Array(data);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = globalThis.btoa(bin);
  return b64.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(base64urlEncode, "base64urlEncode");
function base64urlFromJSON(obj) {
  const json = JSON.stringify(obj);
  return base64urlEncode(new globalThis.TextEncoder().encode(json));
}
__name(base64urlFromJSON, "base64urlFromJSON");
async function hmacSign(keyBytes, data) {
  const key = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, new globalThis.TextEncoder().encode(data));
  return new Uint8Array(sig);
}
__name(hmacSign, "hmacSign");
async function signJWT(secret, payload, expiresInSec = DEFAULT_JWT_EXPIRES_IN) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const body = { iat: now, exp: now + Number(expiresInSec || DEFAULT_JWT_EXPIRES_IN), ...payload };
  const unsigned = `${base64urlFromJSON(header)}.${base64urlFromJSON(body)}`;
  const sigBytes = await hmacSign(new globalThis.TextEncoder().encode(secret), unsigned);
  const signature = base64urlEncode(sigBytes);
  return `${unsigned}.${signature}`;
}
__name(signJWT, "signJWT");
async function verifyJWT(secret, token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return { ok: false, error: "malformed" };
    const [p1, p2, sig] = parts;
    const unsigned = `${p1}.${p2}`;
    const expected = base64urlEncode(await hmacSign(new globalThis.TextEncoder().encode(secret), unsigned));
    if (expected !== sig) return { ok: false, error: "bad-signature" };
    const payloadJson = globalThis.atob(p2.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1e3);
    if (typeof payload.exp === "number" && now > payload.exp) return { ok: false, error: "expired" };
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
__name(verifyJWT, "verifyJWT");
function parseBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}
__name(parseBearer, "parseBearer");
async function handleUserMe(request, env) {
  try {
    const token = parseBearer(request);
    if (!token) return okJson({ success: true, user: null, tier: "free", features: {}, expiresAt: 0 });
    const secret = env.JWT_SECRET || env.SECRET || "dev-secret";
    const v = await verifyJWT(secret, token);
    if (!v.ok) return okJson({ success: true, user: null, tier: "free", features: {}, expiresAt: 0 });
    const p = v.payload || {};
    return okJson({ success: true, user: { id: p.sub || p.userId || "u", email: p.email || void 0 }, tier: p.tier || "free", features: p.features || {}, expiresAt: p.exp || 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleUserMe, "handleUserMe");
async function handleDevLogin(request, env) {
  try {
    const allowDev = getEnvFlag(env, "ALLOW_DEV_LOGIN", false);
    if (!allowDev) return errorJson({ error: "dev-login disabled" }, 403);
    const url = new URL(request.url);
    const tier = (url.searchParams.get("tier") || "pro").toLowerCase();
    const email = url.searchParams.get("user") || "dev@example.com";
    const expiresIn = Number(url.searchParams.get("expiresIn") || 24 * 60 * 60);
    const secret = env.JWT_SECRET || env.SECRET || "dev-secret";
    const token = await signJWT(secret, { sub: `dev:${email}`, email, tier, features: { pro: tier === "pro" } }, expiresIn);
    const now = Math.floor(Date.now() / 1e3);
    return okJson({ success: true, token, tier, user: { email }, expiresAt: now + expiresIn });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleDevLogin, "handleDevLogin");
function handleAuthStart(request, _env) {
  try {
    const url = new URL(request.url);
    const provider = (url.searchParams.get("provider") || "dev").toLowerCase();
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const codeChallenge = url.searchParams.get("code_challenge") || "";
    const scope = url.searchParams.get("scope") || "";
    if (!redirectUri) return errorJson({ error: "missing redirect_uri" }, 400);
    const redirCheck = isAllowedRedirectUri(redirectUri, _env);
    if (!redirCheck.ok) return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400);
    if (provider === "dev") {
      const allowDev = getEnvFlag(_env, "ALLOW_DEV_LOGIN", false);
      if (!allowDev) return errorJson({ error: "dev auth disabled" }, 403);
      const state = url.searchParams.get("state") || Math.random().toString(36).slice(2);
      const authUrl = new URL("/auth/dev/authorize", url);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      return okJson({ success: true, provider, authUrl: authUrl.toString(), state });
    }
    const cfg = getProviderConfig(provider, _env);
    if (!cfg) return errorJson({ error: `provider not configured: ${provider}` }, 400);
    const s = url.searchParams.get("state") || Math.random().toString(36).slice(2);
    const a = new URL(cfg.authUrl);
    a.searchParams.set("response_type", "code");
    a.searchParams.set("client_id", cfg.clientId);
    a.searchParams.set("redirect_uri", redirectUri);
    if (codeChallenge) {
      a.searchParams.set("code_challenge", codeChallenge);
      a.searchParams.set("code_challenge_method", "S256");
    }
    a.searchParams.set("scope", scope || cfg.scope || "");
    a.searchParams.set("state", s);
    if (provider === "google") {
      a.searchParams.set("prompt", "consent");
      a.searchParams.set("access_type", "offline");
    }
    return okJson({ success: true, provider, authUrl: a.toString(), state: s });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAuthStart, "handleAuthStart");
function handleAuthDevAuthorize(request, _env) {
  try {
    const url = new URL(request.url);
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const state = url.searchParams.get("state") || "";
    if (!redirectUri) return errorJson({ error: "missing redirect_uri" }, 400);
    const allowDev = getEnvFlag(_env, "ALLOW_DEV_LOGIN", false);
    if (!allowDev) return errorJson({ error: "dev auth disabled" }, 403);
    const redirCheck = isAllowedRedirectUri(redirectUri, _env);
    if (!redirCheck.ok) return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400);
    const code = Math.random().toString(36).slice(2);
    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (state) redirect.searchParams.set("state", state);
    return new Response(null, { status: 302, headers: { "Location": redirect.toString(), ...corsHeaders } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAuthDevAuthorize, "handleAuthDevAuthorize");
async function handleAuthCallback(request, env) {
  try {
    const url = new URL(request.url);
    const provider = (url.searchParams.get("provider") || "dev").toLowerCase();
    const code = url.searchParams.get("code") || "";
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const codeVerifier = url.searchParams.get("code_verifier") || "";
    if (!code) return errorJson({ error: "missing code" }, 400);
    if (provider === "dev") {
      const allowDev = getEnvFlag(env, "ALLOW_DEV_LOGIN", false);
      if (!allowDev) return errorJson({ error: "dev auth disabled" }, 403);
      const email2 = `user+${code}@example.com`;
      const tier2 = "pro";
      const secret2 = env.JWT_SECRET || env.SECRET || "dev-secret";
      const token2 = await signJWT(secret2, { sub: `dev:${email2}`, email: email2, tier: tier2, features: { pro: true } }, 24 * 60 * 60);
      const now2 = Math.floor(Date.now() / 1e3);
      return okJson({ success: true, token: token2, tier: tier2, user: { email: email2 }, expiresAt: now2 + 24 * 60 * 60 });
    }
    const cfg = getProviderConfig(provider, env);
    if (!cfg) return errorJson({ error: `provider not configured: ${provider}` }, 400);
    if (!redirectUri) return errorJson({ error: "missing redirect_uri" }, 400);
    const redirCheck = isAllowedRedirectUri(redirectUri, env);
    if (!redirCheck.ok) return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400);
    if (!codeVerifier) return errorJson({ error: "missing code_verifier" }, 400);
    const accessToken = await exchangeCodeForToken(cfg, code, redirectUri, codeVerifier);
    const { email, sub } = await fetchUserInfoWithAccessToken(provider, cfg, accessToken);
    const userId = `${provider}:${sub || email || Math.random().toString(36).slice(2)}`;
    const tier = "free";
    await persistUserEntitlements(env, userId, email, provider, sub);
    const secret = env.JWT_SECRET || env.SECRET || "dev-secret";
    const token = await signJWT(secret, { sub: userId, email, tier, features: {} }, 7 * 24 * 60 * 60);
    const now = Math.floor(Date.now() / 1e3);
    return okJson({ success: true, token, tier, user: { id: userId, email }, expiresAt: now + 7 * 24 * 60 * 60 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAuthCallback, "handleAuthCallback");
function getProviderConfig(provider, env) {
  if (provider === "google") {
    const clientId = env.AUTH_GOOGLE_CLIENT_ID;
    const clientSecret = env.AUTH_GOOGLE_CLIENT_SECRET;
    const authUrl = env.AUTH_GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
    const tokenUrl = env.AUTH_GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
    const userInfoUrl = env.AUTH_GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";
    if (!clientId) return null;
    return { provider, clientId, clientSecret, authUrl, tokenUrl, userInfoUrl, scope: "openid email profile" };
  }
  if (provider === "github") {
    const clientId = env.AUTH_GITHUB_CLIENT_ID;
    const clientSecret = env.AUTH_GITHUB_CLIENT_SECRET;
    const authUrl = env.AUTH_GITHUB_AUTH_URL || "https://github.com/login/oauth/authorize";
    const tokenUrl = env.AUTH_GITHUB_TOKEN_URL || "https://github.com/login/oauth/access_token";
    const userInfoUrl = env.AUTH_GITHUB_USERINFO_URL || "https://api.github.com/user";
    if (!clientId) return null;
    return { provider, clientId, clientSecret, authUrl, tokenUrl, userInfoUrl, scope: "read:user user:email" };
  }
  return null;
}
__name(getProviderConfig, "getProviderConfig");
async function exchangeCodeForToken(cfg, code, redirectUri, codeVerifier) {
  const form = new globalThis.URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", redirectUri);
  form.set("client_id", cfg.clientId);
  form.set("code_verifier", codeVerifier);
  if (cfg.clientSecret) form.set("client_secret", cfg.clientSecret);
  const tokenResp = await fetch(cfg.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "accept": "application/json" }, body: form.toString() });
  if (!tokenResp.ok) throw new Error(`token exchange failed ${tokenResp.status}`);
  const tokenJson = await tokenResp.json().catch(() => ({}));
  const accessToken = tokenJson.access_token;
  if (!accessToken) throw new Error("missing access_token");
  return accessToken;
}
__name(exchangeCodeForToken, "exchangeCodeForToken");
async function fetchUserInfoWithAccessToken(provider, cfg, accessToken) {
  if (provider === "google") {
    const uResp = await fetch(cfg.userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const u = await uResp.json().catch(() => ({}));
    return { email: String(u.email || ""), sub: String(u.sub || "") };
  }
  if (provider === "github") {
    const uResp = await fetch(cfg.userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}`, "accept": "application/json", "user-agent": "AcuityBookmarks" } });
    const u = await uResp.json().catch(() => ({}));
    let email = String(u.email || "");
    const sub = String(u.id || "");
    if (!email) {
      try {
        const eResp = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${accessToken}`, "accept": "application/json", "user-agent": "AcuityBookmarks" } });
        const arr = await eResp.json().catch(() => []);
        if (Array.isArray(arr) && arr.length) {
          const primary = arr.find((x) => x && x.primary) || arr[0];
          if (primary && primary.email) email = String(primary.email);
        }
      } catch (_e) {
      }
    }
    return { email, sub };
  }
  return { email: "", sub: "" };
}
__name(fetchUserInfoWithAccessToken, "fetchUserInfoWithAccessToken");
async function persistUserEntitlements(env, userId, email, provider, providerId) {
  try {
    const d1 = await Promise.resolve().then(() => (init_d1(), d1_exports));
    await d1.upsertUser(env, { id: userId, email, provider, providerId });
    await d1.upsertEntitlements(env, userId, "free", {}, 0);
  } catch (_e) {
  }
}
__name(persistUserEntitlements, "persistUserEntitlements");

// ../../../../.bun/install/global/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.bun/install/global/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-zxSxhC/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = cloudflare_worker_default;

// ../../../../.bun/install/global/node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-zxSxhC/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
