"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HERO_CATALOG, type Hero, type HeroRole } from "@/data/heroes";
import {
  MAP_GAME_MODE_ORDER,
  mapById,
  mapsForGameMode,
  type GameMode,
} from "@/data/maps";
import type { OptimizeInput, Role } from "@teamcomposer/optimizer";
import { getHeroes, getMeta, runOptimizeRequest } from "@/lib/api-client";
import { useComposerStore } from "@/store/composer-store";
import { SynergyGraph } from "@/components/synergy-graph";

const ROLES: HeroRole[] = ["Vanguard", "Duelist", "Strategist"];
const OFFICIAL_NEWS = [
  "Season 7.5: The Vault is broken and New York is on the brink.",
  "Chain-CC Protection is live to reduce stun-lock loops.",
  "Lower Manhattan storyline escalates the Alchemax timeline incursion.",
] as const;

const OFFICIAL_MAP_SPOTLIGHT = [
  { name: "Museum of Contemplation", vibe: "High-pressure objective routing and layered choke fights." },
  { name: "K'un-Lun: Heart of Heaven", vibe: "Vertical control with fast engage/retake windows." },
  { name: "Klyntar Awakens: The Celestial Husk", vibe: "Shifting terrain and heavy collapse punish windows." },
] as const;

const SOURCES = [
  {
    group: "Meta Stats",
    items: [
      {
        label: "RivalsMeta Characters",
        url: "https://rivalsmeta.com/characters",
        usage: "Hero tier/win-rate/pick-rate/ban-rate weighting.",
      },
      {
        label: "RivalsMeta Team-Ups",
        url: "https://rivalsmeta.com/team-ups",
        usage: "Team-up synergy pair bonuses and impact weighting.",
      },
      {
        label: "RivalsMeta Team Comps",
        url: "https://rivalsmeta.com/team-comps",
        usage: "Role-structure constraints and comp-shape priors.",
      },
    ],
  },
  {
    group: "Algorithm References",
    items: [
      {
        label: "DFS/Backtracking Video 1",
        url: "https://www.youtube.com/watch?v=Crq0doN9ozM",
        usage: "Backtracking + pruning search pattern inspiration.",
      },
      {
        label: "DFS/Backtracking Video 2",
        url: "https://www.youtube.com/watch?v=DnhEMyRZe0g",
        usage: "Branch-and-bound framing and traversal approach.",
      },
    ],
  },
] as const;

function roleStyles(role: HeroRole): string {
  switch (role) {
    case "Vanguard":
      return "border-amber-300/55 bg-amber-400/20 text-amber-100";
    case "Duelist":
      return "border-rose-300/55 bg-rose-500/20 text-rose-100";
    case "Strategist":
      return "border-cyan-300/55 bg-cyan-500/20 text-cyan-100";
    default:
      return "";
  }
}

function scoreColor(value: number): string {
  if (value >= 25) return "text-emerald-300";
  if (value >= 0) return "text-blue-100";
  return "text-rose-300";
}

function roleGlyph(role: HeroRole): string {
  if (role === "Vanguard") return "V";
  if (role === "Duelist") return "D";
  return "S";
}

function heroMonogram(name: string): string {
  const parts = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function TeamComposerApp() {
  const { data: heroData } = useQuery({
    queryKey: ["heroes"],
    queryFn: getHeroes,
  });
  const { data: metaData } = useQuery({
    queryKey: ["meta"],
    queryFn: getMeta,
  });

  const heroCatalog = heroData ?? HERO_CATALOG;
  const [pool, setPool] = useState<Set<string>>(() => new Set(HERO_CATALOG.map((h) => h.id)));
  const [missingPortraitIds, setMissingPortraitIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPool((prev) => {
      const next = new Set(prev);
      for (const h of heroCatalog) next.add(h.id);
      return next;
    });
  }, [heroCatalog]);
  const [banned, setBanned] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<string[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<string[]>([]);
  const [preferredHeroes, setPreferredHeroes] = useState<Set<string>>(new Set());
  const [preferredRoles, setPreferredRoles] = useState<Set<Role>>(new Set());
  const {
    selectedMapId,
    setSelectedMapId,
    requestStatus,
    setRequestStatus,
    results,
    setResults,
    draftPicks,
    setDraftPicks,
    banSuggestions,
    setBanSuggestions,
    clearComputed,
  } = useComposerStore();
  const [loadingOptimize, setLoadingOptimize] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const currentMap = useMemo(
    () => mapById(selectedMapId) ?? mapById("empire-of-eternal-night-midtown")!,
    [selectedMapId],
  );

  const heroesByRole = useMemo(() => {
    const map = new Map<HeroRole, Hero[]>();
    for (const role of ROLES) map.set(role, []);
    for (const hero of heroCatalog) map.get(hero.role)!.push(hero);
    return map;
  }, [heroCatalog]);

  const heroById = useMemo(() => {
    return new Map(heroCatalog.map((h) => [h.id, h]));
  }, [heroCatalog]);

  const visibleBanSuggestions = useMemo(
    () => banSuggestions.filter((s) => pool.has(s.heroId) && !banned.has(s.heroId)),
    [banSuggestions, pool, banned],
  );

  const effectivePool = useMemo(
    () => heroCatalog.filter((h) => pool.has(h.id) && !banned.has(h.id)),
    [heroCatalog, pool, banned],
  );

  const canOptimize = effectivePool.length >= 6;

  const markPortraitMissing = (id: string) => {
    setMissingPortraitIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const heroPortraitPath = (id: string) => {
    const configuredImage = heroById.get(id)?.imageUrl?.trim();
    if (configuredImage) return configuredImage;
    if (id.startsWith("deadpool-")) return "/heroes/deadpool.webp";
    return `/heroes/${id}.webp`;
  };

  const payload = useCallback(
    (): OptimizeInput => ({
      roster: heroCatalog.filter((h) => pool.has(h.id)).map((h) => h.id),
      banned: [...banned],
      locked,
      enemyTeam,
      preferredHeroes: [...preferredHeroes],
      preferredRoles: [...preferredRoles],
      map: {
        mapId: currentMap.id,
        mapName: currentMap.name,
        mode: currentMap.gameMode,
        compositionTips: currentMap.compositionTips,
      },
    }),
    [heroCatalog, pool, banned, locked, enemyTeam, preferredHeroes, preferredRoles, currentMap],
  );

  const pickMap = (id: string) => {
    setSelectedMapId(id);
    clearComputed();
  };

  const togglePool = (id: string) => {
    setPool((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setBanned((b) => {
          const nb = new Set(b);
          nb.delete(id);
          return nb;
        });
        setLocked((l) => l.filter((x) => x !== id));
        setEnemyTeam((t) => t.filter((x) => x !== id));
        setPreferredHeroes((p) => {
          const np = new Set(p);
          np.delete(id);
          return np;
        });
      } else {
        next.add(id);
      }
      return next;
    });
    clearComputed();
  };

  const toggleBan = (id: string) => {
    if (!pool.has(id)) return;
    setBanned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLocked((l) => l.filter((x) => x !== id));
    setPreferredHeroes((p) => {
      const np = new Set(p);
      np.delete(id);
      return np;
    });
    clearComputed();
  };

  const toggleLock = (id: string) => {
    if (banned.has(id) || !pool.has(id)) return;
    setLocked((prev) => {
      const idx = prev.indexOf(id);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
    clearComputed();
  };

  const toggleEnemy = (id: string) => {
    setEnemyTeam((prev) => {
      const idx = prev.indexOf(id);
      if (idx >= 0) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
    clearComputed();
  };

  const togglePreferredHero = (id: string) => {
    if (banned.has(id) || !pool.has(id)) return;
    setPreferredHeroes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResults(null);
  };

  const togglePreferredRole = (role: Role) => {
    setPreferredRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
    setResults(null);
  };

  const runOptimize = async () => {
    setLoadingOptimize(true);
    setDraftPicks(null);
    setBanSuggestions([]);
    setRequestStatus(null);
    try {
      const json = await runOptimizeRequest(payload(), "optimize", 5);
      if (!json.ok) {
        setRequestStatus(json.error ?? "Failed to optimize");
        setResults([]);
        setBanSuggestions([]);
        return;
      }
      setResults("teams" in json ? (json.teams ?? []) : []);
      setBanSuggestions(
        "banSuggestions" in json && Array.isArray(json.banSuggestions)
          ? json.banSuggestions
          : [],
      );
    } catch {
      setRequestStatus("Failed to optimize");
      setResults([]);
    } finally {
      setLoadingOptimize(false);
    }
  };

  const runDraftMode = async () => {
    setLoadingDraft(true);
    setRequestStatus(null);
    setBanSuggestions([]);
    try {
      const json = await runOptimizeRequest(payload(), "draft", 5);
      if (!json.ok) {
        setRequestStatus(json.error ?? "Failed to evaluate draft");
        setDraftPicks([]);
        return;
      }
      setDraftPicks("picks" in json ? (json.picks ?? []) : []);
    } catch {
      setRequestStatus("Failed to evaluate draft");
      setDraftPicks([]);
    } finally {
      setLoadingDraft(false);
    }
  };

  return (
    <div className="mr-shell flex min-h-screen flex-col text-blue-50">
      <header className="border-b border-blue-900/60 bg-slate-950/55 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            Marvel Rivals Command Center · 6v6
          </p>
          <h1 className="mr-title text-3xl font-semibold tracking-tight sm:text-4xl">
            Team composition optimizer
          </h1>
          <p className="max-w-4xl text-base leading-relaxed text-blue-100/75 sm:text-lg">
            Full-stack optimizer with map context, enemy counters, preferred heroes/roles,
            weighted scoring (`role + synergy + counter`), top 3-5 teams, and draft mode.
            Hero archetypes/jobs/counters/synergies come from your spreadsheet guide.
          </p>
          <div className="mr-subpanel mt-2 rounded-xl px-3 py-2 text-xs text-blue-100/80">
            <span className="font-semibold text-rose-300">Official Universe Signal:</span>{" "}
            {OFFICIAL_NEWS.join(" • ")}
          </div>
          <a
            href="https://www.marvelrivals.com/"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/85 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200"
          >
            Visit official Marvel Rivals site
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="mr-subpanel mr-fade-in grid grid-cols-2 gap-3 rounded-xl p-4 text-sm sm:grid-cols-6">
          <div>
            <div className="text-blue-100/60">Map</div>
            <div className="font-semibold">{currentMap.name}</div>
          </div>
          <div>
            <div className="text-blue-100/60">Mode</div>
            <div className="font-semibold">{currentMap.gameMode}</div>
          </div>
          <div>
            <div className="text-blue-100/60">Pool</div>
            <div className="font-semibold">{pool.size} heroes</div>
          </div>
          <div>
            <div className="text-blue-100/60">Draft State</div>
            <div className="font-semibold">
              {locked.length}/6 locked · {enemyTeam.length}/6 enemy
            </div>
          </div>
          <div>
            <div className="text-blue-100/60">Patch</div>
            <div className="font-semibold">{metaData?.patchVersion ?? "local"}</div>
          </div>
          <div>
            <div className="text-blue-100/60">Rate/Cache</div>
            <div className="font-semibold">
              {metaData?.limits.optimizeRequestsPerMinute ?? 60}/min ·{" "}
              {metaData?.limits.optimizeResultCacheTtlSeconds ?? 300}s
            </div>
          </div>
        </section>
        <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-blue-50">Season World Spotlight</h2>
          <p className="mt-1 text-sm text-blue-100/65">
            Curated from current official world themes to keep strategic context aligned with the live universe tone.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {OFFICIAL_MAP_SPOTLIGHT.map((item) => (
              <div key={item.name} className="mr-subpanel rounded-xl p-3">
                <div className="text-sm font-semibold text-cyan-100">{item.name}</div>
                <div className="mt-1 text-xs text-blue-100/70">{item.vibe}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-blue-50">Map</h2>
              <p className="text-sm text-blue-100/65">
                Grouped by game mode to model situational jobs (peel, pressure,
                flanking/dive, control) in scoring.
              </p>
            </div>
            <div className="mr-subpanel rounded-lg px-3 py-2 text-sm">
              <div className="font-medium">{currentMap.name}</div>
              <div className="text-blue-200/70">{currentMap.gameMode}</div>
            </div>
          </div>
          <div className="mt-5 space-y-7">
            {MAP_GAME_MODE_ORDER.map((mode: GameMode) => {
              const maps = mapsForGameMode(mode);
              if (!maps.length) return null;
              return (
                <div key={mode}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200/60">
                    {mode}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {maps.map((m) => {
                      const active = selectedMapId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => pickMap(m.id)}
                          className={`rounded-xl border p-3 text-left text-sm ${
                            active
                              ? "border-rose-400/80 bg-rose-500/15 ring-2 ring-rose-300/35"
                              : "mr-chip"
                          }`}
                        >
                          <div className="font-medium">{m.name}</div>
                          <div className="mt-1 text-xs text-blue-100/60">{m.compositionTips[0]}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-blue-50">Hero pool</h2>
              <p className="text-sm text-blue-100/65">
                Keep 6v6 constraints. Toggle pool, bans, locks, enemy picks, and preferred inputs.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {ROLES.map((role) => (
                <div key={role}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200/60">
                    {role}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(heroesByRole.get(role) ?? []).map((h) => {
                      const on = pool.has(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => togglePool(h.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? roleStyles(role) : "mr-chip text-blue-200/70"}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="mr-avatar inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[10px] font-bold">
                              {!missingPortraitIds.has(h.id) ? (
                                <img
                                  src={heroPortraitPath(h.id)}
                                  alt={h.name}
                                  className="h-full w-full rounded-full object-cover"
                                  loading="lazy"
                                  onError={() => markPortraitMissing(h.id)}
                                />
                              ) : (
                                heroMonogram(h.name)
                              )}
                            </span>
                            <span>{h.name}</span>
                            <span className="text-[10px] opacity-80">{roleGlyph(h.role)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="mr-subpanel mr-fade-in rounded-xl p-3">
                <h3 className="text-sm font-semibold">Summary</h3>
                <p className="mt-1 text-sm text-blue-100/75">
                  Pool {pool.size} · Available {effectivePool.length}
                </p>
                <p className="text-sm text-blue-100/75">
                  Locked {locked.length}/6 · Enemy {enemyTeam.length}/6
                </p>
              </div>

              <div className="mr-subpanel mr-fade-in rounded-xl p-3">
                <h3 className="text-sm font-semibold">Bans</h3>
                <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {heroCatalog.filter((h) => pool.has(h.id)).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggleBan(h.id)}
                      className={`rounded-lg border px-2 py-1 text-xs text-zinc-800 dark:text-zinc-100 ${
                        banned.has(h.id)
                          ? "border-red-500/50 bg-red-500/15"
                          : "mr-chip"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="mr-avatar inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[9px] font-bold">
                          {!missingPortraitIds.has(h.id) ? (
                            <img
                              src={heroPortraitPath(h.id)}
                              alt={h.name}
                              className="h-full w-full rounded-full object-cover"
                              loading="lazy"
                              onError={() => markPortraitMissing(h.id)}
                            />
                          ) : (
                            heroMonogram(h.name)
                          )}
                        </span>
                        <span>{h.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {visibleBanSuggestions.length > 0 && (
                  <div className="mt-3 border-t border-blue-800/50 pt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-200/60">
                      Suggested bans (vs enemy jobs)
                    </h4>
                    <p className="mt-1 text-xs text-blue-100/60">
                      From last optimize — denies more of their Dive / Poke / Brawl identity still in
                      pool.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {visibleBanSuggestions.map((s) => {
                        const label = heroById.get(s.heroId)?.name ?? s.heroId;
                        return (
                          <li key={s.heroId} className="text-xs">
                            <button
                              type="button"
                              onClick={() => toggleBan(s.heroId)}
                              className="font-medium text-red-700 underline decoration-red-400/60 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                            >
                              Ban {label}
                            </button>
                            <span className="ml-1.5 text-blue-100/70">{s.reason}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mr-subpanel mr-fade-in rounded-xl p-3">
                <h3 className="text-sm font-semibold">Locks (your draft)</h3>
                <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {heroCatalog.filter((h) => pool.has(h.id) && !banned.has(h.id)).map((h) => {
                    const i = locked.indexOf(h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => toggleLock(h.id)}
                        className={`rounded-lg border px-2 py-1 text-xs text-zinc-800 dark:text-zinc-100 ${
                          i >= 0
                            ? "border-emerald-500/50 bg-emerald-500/15"
                            : "mr-chip"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className="mr-avatar inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[9px] font-bold">
                            {!missingPortraitIds.has(h.id) ? (
                              <img
                                src={heroPortraitPath(h.id)}
                                alt={h.name}
                                className="h-full w-full rounded-full object-cover"
                                loading="lazy"
                                onError={() => markPortraitMissing(h.id)}
                              />
                            ) : (
                              heroMonogram(h.name)
                            )}
                          </span>
                          <span>{i >= 0 ? `${i + 1}. ${h.name}` : h.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold">Enemy lineup (optional)</h2>
            <p className="mt-1 text-sm text-blue-100/65">Pick up to 6 enemies to improve counter scoring.</p>
            <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-y-auto">
              {heroCatalog.map((h) => {
                const active = enemyTeam.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleEnemy(h.id)}
                    className={`rounded-lg border px-2 py-1 text-xs text-zinc-800 dark:text-zinc-100 ${
                      active
                        ? "border-violet-500/50 bg-violet-500/15"
                        : "mr-chip"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="mr-avatar inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[9px] font-bold">
                        {!missingPortraitIds.has(h.id) ? (
                          <img
                            src={heroPortraitPath(h.id)}
                            alt={h.name}
                            className="h-full w-full rounded-full object-cover"
                            loading="lazy"
                            onError={() => markPortraitMissing(h.id)}
                          />
                        ) : (
                          heroMonogram(h.name)
                        )}
                      </span>
                      <span>{h.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold">Preferences (optional)</h2>
            <p className="mt-1 text-sm text-blue-100/65">Soft preferences for sorting close-scoring teams.</p>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-200/60">Roles</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => togglePreferredRole(r)}
                  className={`rounded-lg border px-2 py-1 text-xs text-zinc-800 dark:text-zinc-100 ${
                    preferredRoles.has(r)
                      ? "border-indigo-500/50 bg-indigo-500/15"
                      : "mr-chip"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-200/60">Heroes</h3>
            <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {heroCatalog.filter((h) => pool.has(h.id) && !banned.has(h.id)).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => togglePreferredHero(h.id)}
                  className={`rounded-lg border px-2 py-1 text-xs text-zinc-800 dark:text-zinc-100 ${
                    preferredHeroes.has(h.id)
                      ? "border-indigo-500/50 bg-indigo-500/15"
                      : "mr-chip"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="mr-avatar inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[9px] font-bold">
                      {!missingPortraitIds.has(h.id) ? (
                        <img
                          src={heroPortraitPath(h.id)}
                          alt={h.name}
                          className="h-full w-full rounded-full object-cover"
                          loading="lazy"
                          onError={() => markPortraitMissing(h.id)}
                        />
                      ) : (
                        heroMonogram(h.name)
                      )}
                    </span>
                    <span>{h.name}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="mr-subpanel mr-fade-in sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl p-3 backdrop-blur">
          <button
            type="button"
            onClick={runOptimize}
            disabled={!canOptimize || loadingOptimize}
            className="mr-btn-primary rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loadingOptimize ? "Optimizing..." : "Generate Top Teams"}
          </button>
          <button
            type="button"
            onClick={runDraftMode}
            disabled={!canOptimize || locked.length >= 6 || loadingDraft}
            className="mr-btn-secondary rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loadingDraft ? "Evaluating draft..." : "Draft mode: Next best pick"}
          </button>
          {!canOptimize && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Need at least 6 available heroes after bans.
            </p>
          )}
          {requestStatus && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {requestStatus}
            </p>
          )}
        </div>

        {draftPicks && (
          <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold">Draft mode suggestions</h2>
            <ul className="mt-3 space-y-2">
              {draftPicks.map((pick) => (
                <li key={pick.heroId} className="mr-subpanel mr-fade-in rounded-lg p-3 text-sm">
                  <div className="font-medium">{pick.heroName}</div>
                  <div className="text-blue-100/65">Projected top score: {pick.projectedTopScore.toFixed(1)}</div>
                  <div className="text-blue-100/65">
                    Role shape: {pick.projectedRoleShape.Vanguard}/{pick.projectedRoleShape.Duelist}/{pick.projectedRoleShape.Strategist}
                  </div>
                  <p className="mt-1 text-blue-100/80">{pick.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results && (
          <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold">Top team recommendations</h2>
            <p className="mt-1 text-sm text-blue-100/65">Showing top {results.length} 6v6 compositions.</p>
            <ul className="mt-4 space-y-5">
              {results.map((result, idx) => (
                <li key={idx} className="mr-subpanel mr-fade-in rounded-xl p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-semibold">Option {idx + 1}</div>
                    <div className="text-sm text-blue-100/70">Total {result.breakdown.totalScore.toFixed(1)}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                    {result.team.map((id) => {
                      const hero = heroById.get(id);
                      return (
                        <div
                          key={`${idx}-${id}`}
                          className={`rounded-lg border px-2 py-2 text-center text-xs font-medium sm:text-sm ${
                            hero ? roleStyles(hero.role) : "mr-chip"
                          }`}
                        >
                          <div className="mr-avatar mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[10px] font-bold">
                            {hero ? (
                              !missingPortraitIds.has(hero.id) ? (
                                <img
                                  src={heroPortraitPath(hero.id)}
                                  alt={hero.name}
                                  className="h-full w-full rounded-full object-cover"
                                  loading="lazy"
                                  onError={() => markPortraitMissing(hero.id)}
                                />
                              ) : (
                                heroMonogram(hero.name)
                              )
                            ) : (
                              heroMonogram(id)
                            )}
                          </div>
                          {hero?.name ?? id}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="mr-subpanel rounded-lg px-3 py-2 text-xs">
                      <div className="text-blue-100/60">Role score</div>
                      <div className={`font-semibold ${scoreColor(result.breakdown.roleScore)}`}>
                        {result.breakdown.roleScore.toFixed(1)}
                      </div>
                    </div>
                    <div className="mr-subpanel rounded-lg px-3 py-2 text-xs">
                      <div className="text-blue-100/60">Synergy score</div>
                      <div className={`font-semibold ${scoreColor(result.breakdown.synergyScore)}`}>
                        {result.breakdown.synergyScore.toFixed(1)}
                      </div>
                    </div>
                    <div className="mr-subpanel rounded-lg px-3 py-2 text-xs">
                      <div className="text-blue-100/60">Counter score</div>
                      <div className={`font-semibold ${scoreColor(result.breakdown.counterScore)}`}>
                        {result.breakdown.counterScore.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <ul className="mt-3 list-inside list-disc text-sm text-blue-100/80">
                    {result.explanation.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results && results.length > 0 && (
          <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-blue-50">Synergy graph view</h2>
            <p className="mt-1 text-sm text-blue-100/65">
              Force-layout interaction map for your top recommendation.
            </p>
            <div className="mt-4">
              <SynergyGraph team={results[0]} heroesById={heroById} />
            </div>
          </section>
        )}

        <section className="mr-panel mr-fade-in rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-blue-50">Sources & Data</h2>
          <p className="mt-1 text-sm text-blue-100/65">
            External references used for model logic, map context, and UX theme direction.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {SOURCES.map((group) => (
              <div key={group.group} className="mr-subpanel rounded-xl p-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
                  {group.group}
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.items.map((item) => (
                    <li key={item.url} className="text-sm">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-100 underline decoration-cyan-300/45 underline-offset-4 hover:text-cyan-200"
                      >
                        {item.label}
                        <span aria-hidden="true">↗</span>
                      </a>
                      <p className="mt-0.5 text-xs text-blue-100/65">{item.usage}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
