import { getAppMetaValue, setAppMetaValue } from "@teamcomposer/db";
import { HERO_CATALOG, type Hero } from "@/data/heroes";
import {
  HERO_CATALOG_EXTRA_KEY,
  isHeroRole,
  parseCatalogExtrasJson,
} from "@/lib/hero-catalog-merge";
import { isAdminRequestAuthorized } from "@/lib/admin-request";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function normalizeExtras(input: unknown): { ok: true; heroes: Hero[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: "extras must be a JSON array" };
  }
  const staticIds = new Set(HERO_CATALOG.map((h) => h.id));
  const heroes: Hero[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string" || !isHeroRole(r.role)) {
      return { ok: false, error: "Each hero needs id (slug), name, and role" };
    }
    const id = r.id.trim().toLowerCase();
    const name = r.name.trim();
    if (!ID_RE.test(id) || !name) {
      return { ok: false, error: "Invalid id or name" };
    }
    if (staticIds.has(id)) {
      return { ok: false, error: `Id "${id}" is already in the built-in roster` };
    }
    heroes.push({ id, name, role: r.role });
  }
  const seen = new Set<string>();
  for (const h of heroes) {
    if (seen.has(h.id)) return { ok: false, error: `Duplicate id: ${h.id}` };
    seen.add(h.id);
  }
  return { ok: true, heroes };
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const raw = await getAppMetaValue(HERO_CATALOG_EXTRA_KEY);
  const extras = parseCatalogExtrasJson(raw);
  return Response.json({ ok: true, extras });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const extras =
    typeof body === "object" &&
    body !== null &&
    "extras" in body &&
    Array.isArray((body as Record<string, unknown>).extras)
      ? (body as Record<string, unknown>).extras
      : null;
  if (!extras) {
    return Response.json({ ok: false, error: "extras array is required" }, { status: 400 });
  }

  const normalized = normalizeExtras(extras);
  if (!normalized.ok) {
    return Response.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  await setAppMetaValue(HERO_CATALOG_EXTRA_KEY, JSON.stringify(normalized.heroes));
  return Response.json({ ok: true });
}
