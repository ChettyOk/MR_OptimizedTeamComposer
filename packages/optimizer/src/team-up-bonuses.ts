import type { HeroId } from "./index";

/**
 * Team-up pair weights from RivalsMeta Team-Ups.
 * Source: https://rivalsmeta.com/team-ups
 *
 * Weight model:
 * - Higher tier + higher win-rate pair variants receive larger pair bonuses.
 * - Triple variants are represented by their strongest pair edges.
 */
const S_PLUS = 8.8;
const S = 7.8;
const A = 6.5;
const B = 4.8;
const C = 2.6;

type PairDef = readonly [HeroId, HeroId, number];

const RAW_PAIRS: readonly PairDef[] = [
  // S / S+ data-backed edges
  ["peni-parker", "spider-man", S_PLUS],
  ["hulk", "black-panther", S],
  ["hulk", "the-thing", S - 0.2],
  ["iron-man", "ultron", S],
  ["iron-man", "squirrel-girl", B + 0.4],
  ["mantis", "loki", S],
  ["mantis", "groot", A + 1.0],
  ["storm", "adam-warlock", S],

  // A tier + high-usage variants
  ["doctor-strange", "magik", A + 0.7],
  ["doctor-strange", "scarlet-witch", A],
  ["gambit", "rogue", A + 0.9],
  ["gambit", "magneto", A - 0.4],
  ["black-cat", "white-fox", A + 0.5],
  ["white-fox", "luna-snow", A - 0.3],
  ["rocket-raccoon", "mister-fantastic", A + 0.2],
  ["rocket-raccoon", "star-lord", A - 0.1],
  ["hela", "namor", A - 0.5],
  ["captain-america", "winter-soldier", A - 0.6],
  ["daredevil", "punisher", A],
  ["angela", "thor", A + 0.5],
  ["moon-knight", "blade", A - 0.1],
  ["human-torch", "the-thing", A - 0.4],
  ["invisible-woman", "doctor-strange", A - 0.7],

  // B tier variants
  ["luna-snow", "iron-fist", B + 0.8],
  ["luna-snow", "emma-frost", C + 0.7],
  ["cloak-dagger", "psylocke", B],
  ["cloak-dagger", "hawkeye", B - 0.4],
  ["venom", "hela", B + 0.5],
  ["venom", "jeff", B - 0.2],
  ["groot", "rocket-raccoon", B + 0.6],
  ["groot", "jeff", C + 0.7],
  ["wolverine", "hulk", B - 0.1],
  ["wolverine", "the-thing", C + 0.4],

  // C tier fallback
  ["phoenix", "wolverine", C + 0.4],
  ["phoenix", "black-widow", C],
];

function pairKey(a: HeroId, b: HeroId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const PAIR_BONUS = new Map<string, number>();
for (const [a, b, bonus] of RAW_PAIRS) {
  PAIR_BONUS.set(pairKey(a, b), bonus);
}

export function teamUpBonusForPair(a: HeroId, b: HeroId): number {
  return PAIR_BONUS.get(pairKey(a, b)) ?? 0;
}
