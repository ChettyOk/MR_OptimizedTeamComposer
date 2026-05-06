import { characterMetaFor } from "@teamcomposer/optimizer";
import { getAppMetaValue } from "@teamcomposer/db";
import { MAP_CATALOG, MAP_GAME_MODE_ORDER } from "@/data/maps";
import {
  HERO_CATALOG_EXTRA_KEY,
  mergeHeroCatalog,
  parseCatalogExtrasJson,
} from "@/lib/hero-catalog-merge";

const PATCH_VERSION_KEY = "data_patch_version";

export async function GET() {
  const [patchVersion, rawExtras] = await Promise.all([
    getAppMetaValue(PATCH_VERSION_KEY),
    getAppMetaValue(HERO_CATALOG_EXTRA_KEY),
  ]);
  const heroes = mergeHeroCatalog(parseCatalogExtrasJson(rawExtras));
  const tierList = heroes.map((h) => ({
    heroId: h.id,
    name: h.name,
    meta: characterMetaFor(h.id),
  }));

  return Response.json({
    ok: true,
    patchVersion: patchVersion ?? null,
    maps: MAP_CATALOG.map((m) => ({
      id: m.id,
      name: m.name,
      gameMode: m.gameMode,
    })),
    gameModes: [...MAP_GAME_MODE_ORDER],
    heroCount: heroes.length,
    tierList,
    limits: {
      optimizeRequestsPerMinute: 60,
      optimizeResultCacheTtlSeconds: Number(
        process.env.OPTIMIZE_CACHE_TTL_SEC ?? "300",
      ),
    },
  });
}
