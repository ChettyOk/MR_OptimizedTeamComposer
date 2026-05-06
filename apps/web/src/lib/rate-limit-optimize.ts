const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, number[]>();

function rateLimitDisabled(): boolean {
  return process.env.VITEST === "true" || process.env.OPTIMIZE_RATE_LIMIT === "0";
}

export function getOptimizeClientId(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "direct";
}

export function checkOptimizeRateLimit(
  clientId: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  if (rateLimitDisabled()) return { ok: true };
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  let hits = buckets.get(clientId) ?? [];
  hits = hits.filter((t) => t > windowStart);
  if (hits.length >= MAX_REQUESTS) {
    const oldest = hits[0]!;
    const retryAfterSec = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  hits.push(now);
  buckets.set(clientId, hits);
  if (buckets.size > 50_000) {
    buckets.clear();
  }
  return { ok: true };
}
