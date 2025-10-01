// Simple in-memory cache with TTL and max entries
const MAX_ENTRIES = parseInt(process.env.AI_CACHE_MAX_ENTRIES || '1000', 10);
const DEFAULT_TTL_MS = parseInt(process.env.AI_CACHE_TTL_SECONDS || '3600', 10) * 1000; // 1h default

class AICache {
  constructor() {
    this.map = new Map(); // key -> { value, expireAt }
  }

  _now() {
    return Date.now();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expireAt && entry.expireAt <= this._now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    const expireAt = ttlMs > 0 ? (this._now() + ttlMs) : 0;
    // Evict if exceeds max entries using simple FIFO on insertion order
    if (this.map.size >= MAX_ENTRIES) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expireAt });
  }

  has(key) {
    return this.get(key) != null;
  }
}

export const aiCache = new AICache();

export function buildCacheKey(parts) {
  try {
    const normalized = JSON.stringify(parts);
    return normalized.length > 512 ? normalized.slice(0, 512) : normalized; // avoid overly long keys
  } catch {
    return String(parts);
  }
}
