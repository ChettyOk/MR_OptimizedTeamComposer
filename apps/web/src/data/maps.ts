/**
 * Quickplay/Competitive map pool and mode grouping.
 * Synced to Mobalytics maps guide:
 * https://mobalytics.gg/marvel-rivals/guides/maps-modes-guide
 */

export type GameMode = "Convergence" | "Convoy" | "Domination";

export interface GameMap {
  id: string;
  /** Title aligned with official map branding. */
  name: string;
  gameMode: GameMode;
  compositionTips: readonly string[];
}

export const MAP_GAME_MODE_ORDER: readonly GameMode[] = [
  "Convergence",
  "Convoy",
  "Domination",
] as const;

export const MAP_CATALOG: readonly GameMap[] = [
  {
    id: "empire-of-eternal-night-central-park",
    name: "Empire of Eternal Night: Central Park",
    gameMode: "Convergence",
    compositionTips: [
      "Poke comps are strong due to long sightlines and narrow payload paths.",
      "Keep flank awareness in side buildings; dive can punish backline poke angles.",
    ],
  },
  {
    id: "tokyo-2099-shin-shibuya",
    name: "Tokyo 2099: Shin-Shibuya",
    gameMode: "Convergence",
    compositionTips: [
      "Long sightlines and open centers favor ranged heroes.",
      "Doctor Strange portals are especially strong for breaking first-point chokes.",
    ],
  },
  {
    id: "klyntar-symbiotic-surface",
    name: "Klyntar: Symbiotic Surface",
    gameMode: "Convergence",
    compositionTips: [
      "Dive comps are strong for fast attack captures; area control excels on defense.",
      "Use moving symbiote routes and side tunnels to create flank pressure.",
    ],
  },
  {
    id: "intergalactic-empire-wakanda-hall-of-djalia",
    name: "Intergalactic Empire of Wakanda: Hall of Djalia",
    gameMode: "Convergence",
    compositionTips: [
      "Triple Strategist sustain comps are very effective across all checkpoints.",
      "Use multiple entrances/paths to split attention instead of walking main.",
    ],
  },
  {
    id: "kun-lun-heart-of-heaven",
    name: "K'un-Lun: Heart of Heaven",
    gameMode: "Convergence",
    compositionTips: [
      "New competitive map: play for vertical control and fast objective rotations.",
      "Hybrid comps with one anchor and mobile follow-up work best while the meta settles.",
    ],
  },
  {
    id: "lower-manhattan",
    name: "Lower Manhattan",
    gameMode: "Convergence",
    compositionTips: [
      "Convergence on this map is tight and fast: run durable frontline plus close-range Duelist follow-up.",
      "UAV scan reveals positions/Ult charge for both teams, so vary engage timing and avoid telegraphed ult setups.",
      "Vertical balconies and side flanks are high-value; prioritize mobile Strategists with self-peel.",
    ],
  },
  {
    id: "empire-of-eternal-night-midtown",
    name: "Empire of Eternal Night: Midtown",
    gameMode: "Convoy",
    compositionTips: [
      "Brawl comps work well due to many corners, side rooms, and short re-engage paths.",
      "Control center high ground on second point to command 360-degree payload angles.",
    ],
  },
  {
    id: "tokyo-2099-spider-islands",
    name: "Tokyo 2099: Spider-Islands",
    gameMode: "Convoy",
    compositionTips: [
      "Triple Strategist sustain comps can outlast long, slow payload fights.",
      "Respect environmental KO ledges and portal-backdoor access on final point.",
    ],
  },
  {
    id: "hellfire-gala-arakko",
    name: "Hellfire Gala: Arakko",
    gameMode: "Convoy",
    compositionTips: [
      "Poke comps are favored by long narrow lanes; dive can still leverage portals/flanks.",
      "Brawl comps struggle most unless they find fast side-path engages.",
    ],
  },
  {
    id: "yggsgard-yggdrasill-path",
    name: "Yggsgard: Yggdrasill Path",
    gameMode: "Convoy",
    compositionTips: [
      "One of the strongest poke/sniper maps, especially on first point.",
      "Control halfway corners/high strips to split each checkpoint path in two.",
    ],
  },
  {
    id: "museum-of-contemplation",
    name: "Museum of Contemplation",
    gameMode: "Convoy",
    compositionTips: [
      "New competitive map: layered indoor lanes favor coordinated room-by-room clears.",
      "Use durable frontlines plus short-range follow-up to convert corridor control.",
    ],
  },
  {
    id: "yggsgard-royal-palace",
    name: "Yggsgard: Royal Palace",
    gameMode: "Domination",
    compositionTips: [
      "Area-control comps are strong due to close-quarter mission areas and cover density.",
      "Long-range heroes struggle more here unless they secure high-ground control.",
    ],
  },
  {
    id: "intergalactic-empire-wakanda-birnin-tchalla",
    name: "Intergalactic Empire of Wakanda: Birin T'Challa",
    gameMode: "Domination",
    compositionTips: [
      "Poke comps are favored by open, exposed mission areas and easy health-pack access.",
      "If not on Vanguard, avoid overcommitting to objective center and play map edges.",
    ],
  },
  {
    id: "hydra-charteris-base-hells-heaven",
    name: "Hydra Charteris Base: Hell's Heaven",
    gameMode: "Domination",
    compositionTips: [
      "Dive comps perform well via side hallways/flanks and backline isolation windows.",
      "Track map reorganization timing and avoid getting cut off from your team.",
    ],
  },
  {
    id: "hellfire-gala-krakoa",
    name: "Hellfire Gala: Krakoa",
    gameMode: "Domination",
    compositionTips: [
      "New competitive map: split objective pressure between main floor and flank approaches.",
      "AoE control and fast support peel are valuable during repeated retake fights.",
    ],
  },
  {
    id: "klyntar-celestial-husk",
    name: "Klyntar Awakens: The Celestial Husk",
    gameMode: "Domination",
    compositionTips: [
      "New competitive map: favor comps that can quickly retake elevation and anchor space.",
      "Run at least one high-mobility engager to punish isolated backline positions.",
    ],
  },
] as const;

const byId = new Map<string, GameMap>(MAP_CATALOG.map((m) => [m.id, m]));

export function mapById(id: string): GameMap | undefined {
  return byId.get(id);
}

export function mapsForGameMode(mode: GameMode): readonly GameMap[] {
  return MAP_CATALOG.filter((m) => m.gameMode === mode);
}
