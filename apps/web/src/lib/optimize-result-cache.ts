import { createHash } from "node:crypto";
import { createClient } from "redis";
import type { OptimizeInput } from "@teamcomposer/optimizer";
import { stableStringify } from "./stable-json";

const KEY_PREFIX = "tc:optimize:v1:";

function cacheDisabled(): boolean {
  return process.env.VITEST === "true" || process.env.OPTIMIZE_RESULT_CACHE === "0";
}

function ttlSeconds(): number {
  const n = Number(process.env.OPTIMIZE_CACHE_TTL_SEC ?? "300");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3600) : 300;
}

function normalizeInputForCache(input: OptimizeInput): unknown {
  return {
    roster: [...input.roster].sort(),
    banned: input.banned?.length ? [...input.banned].sort() : [],
    locked: input.locked?.length ? [...input.locked].sort() : [],
    enemyTeam: input.enemyTeam?.length ? [...input.enemyTeam].sort() : [],
    preferredHeroes: input.preferredHeroes?.length
      ? [...input.preferredHeroes].sort()
      : [],
    preferredRoles: input.preferredRoles?.length
      ? [...input.preferredRoles].sort()
      : [],
    map: input.map ?? null,
    heroOverrides: input.heroOverrides
      ? stableStringify(input.heroOverrides)
      : null,
  };
}

export function optimizeCacheKey(
  dataEpoch: string,
  topN: number,
  input: OptimizeInput,
): string {
  const payload = stableStringify({
    dataEpoch,
    topN,
    body: normalizeInputForCache(input),
  });
  return `${KEY_PREFIX}${createHash("sha256").update(payload).digest("hex")}`;
}

type RedisConn = ReturnType<typeof createClient>;
type GlobalRedis = { __teamcomposerRedis?: RedisConn };

async function redisClient(): Promise<RedisConn | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const g = globalThis as GlobalRedis;
  if (!g.__teamcomposerRedis) {
    const c = createClient({ url });
    c.on("error", () => {});
    await c.connect();
    g.__teamcomposerRedis = c;
  }
  return g.__teamcomposerRedis;
}

const memory = new Map<string, { body: string; expires: number }>();

function pruneMemory(): void {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expires <= now) memory.delete(k);
  }
  if (memory.size <= 256) return;
  const drop = memory.size - 256;
  let i = 0;
  for (const k of memory.keys()) {
    memory.delete(k);
    if (++i >= drop) break;
  }
}

export async function getCachedOptimizeResponse(
  key: string,
): Promise<string | null> {
  if (cacheDisabled()) return null;
  const now = Date.now();
  const local = memory.get(key);
  if (local && local.expires > now) return local.body;
  try {
    const r = await redisClient();
    if (!r) return null;
    const remote = await r.get(key);
    return remote;
  } catch {
    return null;
  }
}

export async function setCachedOptimizeResponse(
  key: string,
  body: string,
): Promise<void> {
  if (cacheDisabled()) return;
  const ttl = ttlSeconds();
  const expires = Date.now() + ttl * 1000;
  memory.set(key, { body, expires });
  pruneMemory();
  try {
    const r = await redisClient();
    if (r) await r.set(key, body, { EX: ttl });
  } catch {
    /* optional */
  }
}
