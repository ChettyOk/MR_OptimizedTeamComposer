import type {
  BanSuggestion,
  DraftPickSuggestion,
  OptimizeInput,
  ScoredTeam,
} from "@teamcomposer/optimizer";
import type { Hero } from "@/data/heroes";
import type { GameMode } from "@/data/maps";

type OptimizeMode = "optimize" | "draft";

export interface OptimizeResponse {
  ok: boolean;
  teams?: ScoredTeam[];
  banSuggestions?: BanSuggestion[];
  error?: string;
}

export interface DraftResponse {
  ok: boolean;
  picks?: DraftPickSuggestion[];
  error?: string;
}

export interface MetaResponse {
  ok: boolean;
  patchVersion: string | null;
  maps: Array<{ id: string; name: string; gameMode: GameMode }>;
  gameModes: GameMode[];
  heroCount: number;
  tierList: Array<{
    heroId: string;
    name: string;
    meta: { tier: string; winRate: number; pickRate: number; banRate: number } | null;
  }>;
  limits: {
    optimizeRequestsPerMinute: number;
    optimizeResultCacheTtlSeconds: number;
  };
}

export async function getHeroes(): Promise<Hero[]> {
  const res = await fetch("/api/heroes");
  const json = (await res.json()) as { ok: boolean; heroes?: Hero[] };
  if (!res.ok || !json.ok || !Array.isArray(json.heroes)) {
    throw new Error("Failed to load heroes");
  }
  return json.heroes;
}

export async function getMeta(): Promise<MetaResponse> {
  const res = await fetch("/api/meta");
  const json = (await res.json()) as MetaResponse;
  if (!res.ok || !json.ok) throw new Error("Failed to load meta");
  return json;
}

export async function runOptimizeRequest(
  payload: OptimizeInput,
  mode: OptimizeMode,
  topN = 5,
): Promise<OptimizeResponse | DraftResponse> {
  const res = await fetch("/api/optimize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, mode, topN }),
  });
  const json = (await res.json()) as OptimizeResponse | DraftResponse;
  if (!res.ok) {
    return { ...json, ok: false, error: (json as { error?: string }).error ?? "Request failed" };
  }
  return json;
}
