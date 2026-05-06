import { getAppMetaValue } from "@teamcomposer/db";
import {
  HERO_CATALOG_EXTRA_KEY,
  mergeHeroCatalog,
  parseCatalogExtrasJson,
} from "@/lib/hero-catalog-merge";

export async function GET() {
  const raw = await getAppMetaValue(HERO_CATALOG_EXTRA_KEY);
  const extras = parseCatalogExtrasJson(raw);
  const heroes = mergeHeroCatalog(extras);
  return Response.json({ ok: true, heroes });
}
