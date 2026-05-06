/** Deterministic JSON for cache keys and signatures. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(toStable(value));
}

function toStable(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toStable);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    out[k] = toStable(v);
  }
  return out;
}
