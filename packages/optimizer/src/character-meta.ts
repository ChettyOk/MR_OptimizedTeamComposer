import type { HeroId } from "./index";

export interface CharacterMeta {
  tier: "S" | "A" | "B" | "C" | "D";
  winRate: number;
  pickRate: number;
  banRate: number;
}

const META: Partial<Record<HeroId, CharacterMeta>> = {
  "peni-parker": { tier: "S", winRate: 59.69, pickRate: 10.06, banRate: 12.21 },
  ultron: { tier: "S", winRate: 57.35, pickRate: 7.37, banRate: 0.4 },
  magik: { tier: "S", winRate: 55.84, pickRate: 14.15, banRate: 5.25 },
  storm: { tier: "A", winRate: 55.07, pickRate: 2.38, banRate: 0.09 },
  hulk: { tier: "A", winRate: 54.26, pickRate: 12.29, banRate: 0.88 },
  daredevil: { tier: "S", winRate: 54.15, pickRate: 8.32, banRate: 16.68 },
  "rocket-raccoon": { tier: "A", winRate: 52.94, pickRate: 14.29, banRate: 0.3 },
  mantis: { tier: "A", winRate: 52.38, pickRate: 4.49, banRate: 0.13 },
  "captain-america": { tier: "A", winRate: 52.11, pickRate: 7.58, banRate: 0.31 },
  "mister-fantastic": { tier: "A", winRate: 52.09, pickRate: 5.15, banRate: 0.14 },
  angela: { tier: "A", winRate: 51.62, pickRate: 5.71, banRate: 0.45 },
  "doctor-strange": { tier: "A", winRate: 51.56, pickRate: 27.08, banRate: 0.95 },
  rogue: { tier: "A", winRate: 51.55, pickRate: 10.01, banRate: 0.25 },
  "invisible-woman": { tier: "A", winRate: 51.03, pickRate: 41.49, banRate: 5.44 },
  thor: { tier: "A", winRate: 50.75, pickRate: 12.74, banRate: 0.44 },
  "white-fox": { tier: "A", winRate: 50.71, pickRate: 38.59, banRate: 1.44 },
  "iron-man": { tier: "B", winRate: 50.51, pickRate: 6.76, banRate: 1.26 },
  "black-panther": { tier: "A", winRate: 50.41, pickRate: 6.98, banRate: 5.38 },
  "iron-fist": { tier: "B", winRate: 50.25, pickRate: 7.67, banRate: 0.92 },
  groot: { tier: "A", winRate: 49.71, pickRate: 7.35, banRate: 17.61 },
  "the-thing": { tier: "B", winRate: 49.55, pickRate: 11.47, banRate: 4.13 },
  loki: { tier: "B", winRate: 49.43, pickRate: 6.52, banRate: 2.59 },
  hela: { tier: "B", winRate: 49.3, pickRate: 7.41, banRate: 3.2 },
  blade: { tier: "B", winRate: 49.25, pickRate: 5.55, banRate: 0.3 },
  "star-lord": { tier: "B", winRate: 48.96, pickRate: 7.46, banRate: 0.42 },
  venom: { tier: "B", winRate: 48.94, pickRate: 10.95, banRate: 0.76 },
  "adam-warlock": { tier: "B", winRate: 48.93, pickRate: 3.64, banRate: 0.08 },
  gambit: { tier: "A", winRate: 48.82, pickRate: 17.63, banRate: 26.74 },
  psylocke: { tier: "B", winRate: 48.52, pickRate: 8.08, banRate: 0.42 },
  "spider-man": { tier: "B", winRate: 48.52, pickRate: 18.26, banRate: 7.93 },
  "human-torch": { tier: "B", winRate: 48.19, pickRate: 2.75, banRate: 0.15 },
  "moon-knight": { tier: "B", winRate: 47.9, pickRate: 11.95, banRate: 17.08 },
  "winter-soldier": { tier: "B", winRate: 47.74, pickRate: 12.1, banRate: 0.78 },
  "scarlet-witch": { tier: "B", winRate: 47.69, pickRate: 9.86, banRate: 0.59 },
  "deadpool-duelist": { tier: "B", winRate: 47.57, pickRate: 4.58, banRate: 0.15 },
  "deadpool-vanguard": { tier: "B", winRate: 47.5, pickRate: 12.49, banRate: 4.98 },
  "deadpool-strategist": { tier: "C", winRate: 44.55, pickRate: 9.24, banRate: 0.11 },
  "black-cat": { tier: "B", winRate: 47.46, pickRate: 25.1, banRate: 3.11 },
  magneto: { tier: "B", winRate: 47.42, pickRate: 19.08, banRate: 0.79 },
  namor: { tier: "B", winRate: 46.94, pickRate: 13.17, banRate: 11.76 },
  "luna-snow": { tier: "B", winRate: 46.85, pickRate: 22.63, banRate: 0.47 },
  "elsa-bloodstone": { tier: "B", winRate: 46.65, pickRate: 6.44, banRate: 15.83 },
  punisher: { tier: "C", winRate: 46.24, pickRate: 13.26, banRate: 3.07 },
  "cloak-dagger": { tier: "B", winRate: 46.24, pickRate: 29.55, banRate: 14.05 },
  wolverine: { tier: "C", winRate: 46.19, pickRate: 4.28, banRate: 1.23 },
  "emma-frost": { tier: "C", winRate: 45.5, pickRate: 16.67, banRate: 1.03 },
  jeff: { tier: "C", winRate: 45.48, pickRate: 17.72, banRate: 0.52 },
  hawkeye: { tier: "C", winRate: 45.02, pickRate: 2.75, banRate: 0.43 },
  phoenix: { tier: "C", winRate: 44.92, pickRate: 8.54, banRate: 4.91 },
  "squirrel-girl": { tier: "C", winRate: 44.76, pickRate: 7.24, banRate: 1.64 },
  "black-widow": { tier: "D", winRate: 38.24, pickRate: 3.16, banRate: 0.22 },
};

export function characterMetaFor(id: HeroId): CharacterMeta | null {
  return META[id] ?? null;
}
