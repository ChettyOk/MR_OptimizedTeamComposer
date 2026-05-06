import { createHash } from "node:crypto";
import {
  optimizeTeamComposition,
  suggestBansAgainstEnemy,
  suggestNextDraftPicks,
  type OptimizeInput,
} from "@teamcomposer/optimizer";
import { getAppMetaValue } from "@teamcomposer/db";
import {
  HERO_CATALOG_EXTRA_KEY,
  mergeExtrasIntoHeroOverrides,
  parseCatalogExtrasJson,
} from "@/lib/hero-catalog-merge";
import {
  getCachedOptimizeResponse,
  optimizeCacheKey,
  setCachedOptimizeResponse,
} from "@/lib/optimize-result-cache";
import {
  checkOptimizeRateLimit,
  getOptimizeClientId,
} from "@/lib/rate-limit-optimize";

interface OptimizeRequest extends OptimizeInput {
  mode?: "optimize" | "draft";
  topN?: number;
}

const HERO_OVERRIDES_KEY = "hero_guide_overrides_v1";
const PATCH_VERSION_KEY = "data_patch_version";

function shortHash(raw: string | null): string {
  return createHash("sha256").update(raw ?? "").digest("hex").slice(0, 12);
}

export async function POST(request: Request) {
  const rate = checkOptimizeRateLimit(getOptimizeClientId(request));
  if (!rate.ok) {
    return Response.json(
      { ok: false, error: "rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  try {
    const body = (await request.json()) as OptimizeRequest;
    const mode = body.mode ?? "optimize";
    const [rawOverrides, rawExtras, rawPatch] = await Promise.all([
      getAppMetaValue(HERO_OVERRIDES_KEY),
      getAppMetaValue(HERO_CATALOG_EXTRA_KEY),
      getAppMetaValue(PATCH_VERSION_KEY),
    ]);
    const fromDb = rawOverrides
      ? (JSON.parse(rawOverrides) as OptimizeInput["heroOverrides"])
      : undefined;
    const extras = parseCatalogExtrasJson(rawExtras);
    const mergedOverrides = mergeExtrasIntoHeroOverrides(
      extras,
      fromDb as Record<string, unknown> | undefined,
    );
    const heroOverrides = mergedOverrides as OptimizeInput["heroOverrides"];
    const input: OptimizeRequest = { ...body, heroOverrides };

    if (!Array.isArray(body.roster) || body.roster.length === 0) {
      return Response.json(
        { ok: false, error: "roster is required" },
        { status: 400 },
      );
    }

    if (mode === "draft") {
      const picks = suggestNextDraftPicks(input, input.topN ?? 5);
      return Response.json({ ok: true, mode, picks });
    }

    const topN = input.topN ?? 5;
    const dataEpoch = `${rawPatch ?? "none"}|${shortHash(rawOverrides)}|${shortHash(rawExtras)}`;
    const cacheKey = optimizeCacheKey(dataEpoch, topN, input);
    const cached = await getCachedOptimizeResponse(cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-optimize-cache": "HIT",
        },
      });
    }

    const teams = optimizeTeamComposition(input).slice(0, topN);
    const banSuggestions =
      Array.isArray(input.enemyTeam) && input.enemyTeam.length > 0
        ? [...suggestBansAgainstEnemy(input, 5)]
        : [];
    const payload = { ok: true as const, mode, teams, banSuggestions };
    const json = JSON.stringify(payload);
    await setCachedOptimizeResponse(cacheKey, json);
    return new Response(json, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-optimize-cache": "MISS",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
