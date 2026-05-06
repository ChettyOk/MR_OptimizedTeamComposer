import { HERO_CATALOG, type Hero, type HeroRole } from "@/data/heroes";

export const HERO_CATALOG_EXTRA_KEY = "hero_catalog_extra_v1";

export function isHeroRole(value: unknown): value is HeroRole {
  return value === "Vanguard" || value === "Duelist" || value === "Strategist";
}

export function mergeHeroCatalog(extras: readonly Hero[]): Hero[] {
  const staticIds = new Set(HERO_CATALOG.map((h) => h.id));
  const out: Hero[] = [...HERO_CATALOG];
  for (const h of extras) {
    if (!staticIds.has(h.id)) out.push(h);
  }
  return out;
}

/** Ensures catalog extras get a default `role` in scoring when no DB override exists. */
export function mergeExtrasIntoHeroOverrides(
  extras: readonly Hero[],
  heroOverrides: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!extras.length && !heroOverrides) return undefined;
  const out: Record<string, unknown> = { ...(heroOverrides ?? {}) };
  for (const h of extras) {
    if (h.id in out) continue;
    out[h.id] = { role: h.role };
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseCatalogExtrasJson(raw: string | null): Hero[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const heroes: Hero[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.name !== "string" || !isHeroRole(r.role)) {
        continue;
      }
      const imageUrl =
        typeof r.imageUrl === "string" && r.imageUrl.trim().length > 0
          ? r.imageUrl.trim()
          : undefined;
      heroes.push({ id: r.id, name: r.name, role: r.role, imageUrl });
    }
    return heroes;
  } catch {
    return [];
  }
}
