/**
 * Caché en memoria con TTL para API routes del dashboard.
 * Persiste en el proceso Node.js entre requests (mismo worker).
 */

interface CacheEntry {
  data: unknown;
  expires: number;
}

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 300_000; // 5 minutos

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

/** Genera una clave de caché a partir de un prefijo y los search params */
export function cacheKey(prefix: string, params: URLSearchParams): string {
  const sorted = new URLSearchParams(Array.from(params.entries()).sort());
  return `${prefix}:${sorted.toString()}`;
}
