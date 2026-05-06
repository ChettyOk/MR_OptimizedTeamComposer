import {
  HERO_GUIDE_BY_ID,
  HERO_NAME_BY_ID,
  type HeroGuideProfile,
} from "./guide-data";
import {
  dominantTriangleStyle,
  emptyStyleDensity,
  ingestJobsIntoDensity,
  jobToTriangleStyle,
  POKE_VULNERABLE_FLYER_IDS,
  triangleStyleCounters,
  type TriangleStyle,
} from "./job-triangle";
import { characterMetaFor } from "./character-meta";
import { teamUpBonusForPair } from "./team-up-bonuses";

export type { CharacterMeta } from "./character-meta";
export { characterMetaFor };

export type HeroId = string;
export type Role = "Vanguard" | "Duelist" | "Strategist";

export type Team6 = readonly [HeroId, HeroId, HeroId, HeroId, HeroId, HeroId];

export interface MapPlanningContext {
  mapId: string;
  mapName: string;
  mode: string;
  compositionTips: readonly string[];
}

export type HeroGuideOverride = Partial<HeroGuideProfile>;

export interface OptimizeInput {
  roster: readonly HeroId[];
  banned?: readonly HeroId[];
  locked?: readonly HeroId[];
  enemyTeam?: readonly HeroId[];
  preferredHeroes?: readonly HeroId[];
  preferredRoles?: readonly Role[];
  map?: MapPlanningContext;
  heroOverrides?: Record<string, HeroGuideOverride>;
}

export interface ScoreBreakdown {
  roleScore: number;
  synergyScore: number;
  counterScore: number;
  totalScore: number;
}

export interface ScoredTeam {
  team: Team6;
  score: number;
  notes: readonly string[];
  explanation: readonly string[];
  breakdown: ScoreBreakdown;
  roleCount: Readonly<Record<Role, number>>;
}

export interface DraftPickSuggestion {
  heroId: HeroId;
  heroName: string;
  projectedTopScore: number;
  projectedRoleShape: Readonly<Record<Role, number>>;
  reason: string;
}

export interface BanSuggestion {
  heroId: HeroId;
  reason: string;
}

interface SearchState {
  picked: HeroId[];
  scoreHint: number;
}

interface EvaluatedTeam {
  breakdown: ScoreBreakdown;
  roleCount: Record<Role, number>;
  assignment: Map<HeroId, Role>;
  explanation: string[];
}

const MAX_RESULTS = 5;
const EXHAUSTIVE_COMBINATION_LIMIT = 90000;
const BEAM_WIDTH = 320;

const MODE_JOB_BONUS: Record<string, Partial<Record<string, number>>> = {
  Convergence: { Dive: 2.5, Poke: 1.5, Brawl: 2, Peel: 1.5, Control: 1.5 },
  Convoy: { Shield: 2.5, Control: 2, Poke: 1.5, Brawl: 1.5 },
  Domination: { Control: 2.5, Brawl: 2, Peel: 2, Dive: 1.5 },
  "Resource Rumble": { Dive: 2.5, Poke: 2, Brawl: 1.5 },
  Annihilation: { Brawl: 2.5, Control: 2, Heal: 1.5 },
  "Doom Match": { Dive: 2.5, Brawl: 2.5, Peel: 1.5 },
};

const DEADPOOL_ROLE_VARIANTS = [
  "deadpool-duelist",
  "deadpool-vanguard",
  "deadpool-strategist",
] as const;

const ROLE_STRUCTURE_CONSTRAINTS = {
  minVanguard: 1,
  maxVanguard: 2,
  minDuelist: 2,
  maxDuelist: 3,
  minStrategist: 1,
  maxStrategist: 2,
} as const;

const HIGH_MOBILITY_HEROES = new Set<HeroId>([
  "spider-man",
  "black-panther",
  "iron-fist",
  "magik",
  "star-lord",
  "venom",
  "black-cat",
  "human-torch",
  "phoenix",
  "wolverine",
]);

const ULT_CANCEL_HEROES = new Set<HeroId>([
  "mantis",
  "loki",
  "emma-frost",
  "scarlet-witch",
  "magneto",
  "namor",
  "doctor-strange",
  "peni-parker",
]);

const OFF_MAP_THREAT_HEROES = new Set<HeroId>([
  "hulk",
  "the-thing",
  "venom",
  "namor",
  "storm",
  "groot",
  "magneto",
  "invisible-woman",
  "human-torch",
  "jeff",
]);

function heroName(id: HeroId): string {
  return HERO_NAME_BY_ID[id] ?? id;
}

function profileFor(
  id: HeroId,
  overrides?: Record<string, HeroGuideOverride>,
): HeroGuideProfile | null {
  const base = HERO_GUIDE_BY_ID.get(id);
  const override = overrides?.[id];
  if (!base && !override) return null;
  if (!base && override?.role) {
    return {
      role: override.role,
      counters: override.counters ?? [],
      counteredBy: override.counteredBy ?? [],
      synergies: override.synergies ?? [],
      archetype: override.archetype,
      rangeStyle: override.rangeStyle,
      primaryJob: override.primaryJob,
      primaryZone: override.primaryZone,
      secondaryJob: override.secondaryJob,
      secondaryZone: override.secondaryZone,
      healingPriority: override.healingPriority,
      healingResponsibility: override.healingResponsibility,
      notes: override.notes,
    };
  }
  if (!base) return null;
  if (!override) return base;
  return {
    ...base,
    ...override,
    counters: (override.counters ?? base.counters) as readonly string[],
    counteredBy: (override.counteredBy ?? base.counteredBy) as readonly string[],
    synergies: (override.synergies ?? base.synergies) as readonly string[],
  };
}

function roleOptionsOf(
  id: HeroId,
  overrides?: Record<string, HeroGuideOverride>,
): readonly Role[] {
  const role = profileFor(id, overrides)?.role;
  return role ? [role] : [];
}

function roleShapeScore(roleCount: Record<Role, number>): number {
  if (
    roleCount.Vanguard < ROLE_STRUCTURE_CONSTRAINTS.minVanguard ||
    roleCount.Vanguard > ROLE_STRUCTURE_CONSTRAINTS.maxVanguard ||
    roleCount.Duelist < ROLE_STRUCTURE_CONSTRAINTS.minDuelist ||
    roleCount.Duelist > ROLE_STRUCTURE_CONSTRAINTS.maxDuelist ||
    roleCount.Strategist < ROLE_STRUCTURE_CONSTRAINTS.minStrategist ||
    roleCount.Strategist > ROLE_STRUCTURE_CONSTRAINTS.maxStrategist
  ) {
    return -180;
  }

  let score = 0;
  if (roleCount.Strategist === 1) score += 16;
  else if (roleCount.Strategist === 2) score += 20;

  if (roleCount.Vanguard === 1) score += 12;
  else if (roleCount.Vanguard === 2) score += 15;

  if (roleCount.Duelist >= 2 && roleCount.Duelist <= 3) score += 14;

  if (
    roleCount.Vanguard === 2 &&
    roleCount.Duelist === 2 &&
    roleCount.Strategist === 2
  ) {
    score += 12;
  }

  return score;
}

function satisfiesRoleStructureConstraints(roleCount: Record<Role, number>): boolean {
  return (
    roleCount.Vanguard >= ROLE_STRUCTURE_CONSTRAINTS.minVanguard &&
    roleCount.Vanguard <= ROLE_STRUCTURE_CONSTRAINTS.maxVanguard &&
    roleCount.Duelist >= ROLE_STRUCTURE_CONSTRAINTS.minDuelist &&
    roleCount.Duelist <= ROLE_STRUCTURE_CONSTRAINTS.maxDuelist &&
    roleCount.Strategist >= ROLE_STRUCTURE_CONSTRAINTS.minStrategist &&
    roleCount.Strategist <= ROLE_STRUCTURE_CONSTRAINTS.maxStrategist
  );
}

function chooseBestRoleSplit(
  team: HeroId[],
  overrides?: Record<string, HeroGuideOverride>,
): {
  roleCount: Record<Role, number>;
  assignment: Map<HeroId, Role>;
} {
  const roleCount: Record<Role, number> = {
    Vanguard: 0,
    Duelist: 0,
    Strategist: 0,
  };
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestCount: Record<Role, number> = { ...roleCount };
  let bestAssignment = new Map<HeroId, Role>();

  const walk = (idx: number, current: Map<HeroId, Role>) => {
    if (idx >= team.length) {
      const score = roleShapeScore(roleCount);
      if (score > bestScore) {
        bestScore = score;
        bestCount = { ...roleCount };
        bestAssignment = new Map(current);
      }
      return;
    }

    const id = team[idx];
    const options = roleOptionsOf(id, overrides);
    if (options.length === 0) {
      walk(idx + 1, current);
      return;
    }

    for (const role of options) {
      roleCount[role] += 1;
      current.set(id, role);
      walk(idx + 1, current);
      current.delete(id);
      roleCount[role] -= 1;
    }
  };

  walk(0, new Map());
  return { roleCount: bestCount, assignment: bestAssignment };
}

function normalizePool(input: OptimizeInput): { pool: HeroId[]; locked: HeroId[] } {
  const expandInputHeroIds = (ids: readonly HeroId[] | undefined): HeroId[] => {
    if (!ids) return [];
    const out: HeroId[] = [];
    for (const id of ids) {
      if (id === "deadpool") out.push(...DEADPOOL_ROLE_VARIANTS);
      else out.push(id);
    }
    return [...new Set(out)];
  };

  const banned = new Set(expandInputHeroIds(input.banned));
  const uniqueRoster = expandInputHeroIds(input.roster);
  const pool = uniqueRoster.filter((id) => !banned.has(id));
  const poolSet = new Set(pool);
  const locked = expandInputHeroIds(input.locked).filter((id) => poolSet.has(id));
  return { pool, locked };
}

function baseHeroValue(id: HeroId, input: OptimizeInput): number {
  const profile = profileFor(id, input.heroOverrides);
  if (!profile) return 1;

  let score = 4;
  if (profile.archetype === "Generalist") score += 3;
  if (profile.archetype === "Hybrid") score += 2.5;
  if (profile.archetype === "Specialist") score += 1.2;

  const mapModeBonus = input.map ? MODE_JOB_BONUS[input.map.mode] : undefined;
  if (mapModeBonus && profile.primaryJob) score += mapModeBonus[profile.primaryJob] ?? 0;
  if (mapModeBonus && profile.secondaryJob) {
    score += (mapModeBonus[profile.secondaryJob] ?? 0) * 0.6;
  }

  if (profile.role === "Strategist" && typeof profile.healingPriority === "number") {
    score += Math.max(0, 6 - profile.healingPriority) * 1.8;
  }

  const meta = characterMetaFor(id);
  if (meta) {
    const tierBonus: Record<string, number> = {
      S: 3.2,
      A: 2.1,
      B: 0.8,
      C: -0.8,
      D: -2.5,
    };
    const winDelta = (meta.winRate - 50) * 0.92;
    const pickSignal = Math.min(meta.pickRate, 25) * 0.05;
    const banSignal = Math.min(meta.banRate, 20) * 0.03;
    score += (tierBonus[meta.tier] ?? 0) + winDelta + pickSignal + banSignal;
  }

  return score;
}

function pairwiseSynergyAndCounter(
  a: HeroId,
  b: HeroId,
  input: OptimizeInput,
): { synergy: number; counter: number; reasons: string[] } {
  const pa = profileFor(a, input.heroOverrides);
  const pb = profileFor(b, input.heroOverrides);
  let synergy = 0;
  let counter = 0;
  const reasons: string[] = [];

  if (pa?.synergies.includes(b)) {
    synergy += 6;
    reasons.push(`${heroName(a)} -> ${heroName(b)} synergy`);
  }
  if (pb?.synergies.includes(a)) {
    synergy += 6;
    reasons.push(`${heroName(b)} -> ${heroName(a)} synergy`);
  }

  if (pa?.counteredBy.includes(b)) {
    counter -= 2.5;
    reasons.push(`${heroName(a)} is pressured by ${heroName(b)}`);
  }
  if (pb?.counteredBy.includes(a)) {
    counter -= 2.5;
    reasons.push(`${heroName(b)} is pressured by ${heroName(a)}`);
  }

  const teamUp = teamUpBonusForPair(a, b);
  if (teamUp > 0) {
    synergy += teamUp;
    reasons.push(`${heroName(a)} + ${heroName(b)} team-up bonus (+${teamUp.toFixed(1)})`);
  }

  return { synergy, counter, reasons };
}

function triangleStylesForHero(id: HeroId, input: OptimizeInput): TriangleStyle[] {
  const profile = profileFor(id, input.heroOverrides);
  if (!profile) return [];
  const out = new Set<TriangleStyle>();
  const a = jobToTriangleStyle(profile.primaryJob);
  const b = jobToTriangleStyle(profile.secondaryJob);
  if (a) out.add(a);
  if (b) out.add(b);
  return [...out];
}

const JOB_TRIANGLE_WIN = 2;

function jobTriangleEnemyScore(
  team: HeroId[],
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  if (!enemyTeam.length) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  for (const ally of team) {
    const allyStyles = triangleStylesForHero(ally, input);
    if (!allyStyles.length) continue;
    for (const enemy of enemyTeam) {
      const enemyStyles = triangleStylesForHero(enemy, input);
      if (!enemyStyles.length) continue;
      for (const a of allyStyles) {
        for (const e of enemyStyles) {
          if (triangleStyleCounters(a, e)) {
            score += JOB_TRIANGLE_WIN;
            reasons.push(
              `${heroName(ally)} (${a} job) beats ${heroName(enemy)} (${e}) on Dive/Poke/Brawl wheel (+${JOB_TRIANGLE_WIN})`,
            );
          }
          if (triangleStyleCounters(e, a)) {
            score -= JOB_TRIANGLE_WIN * 0.65;
            reasons.push(
              `${heroName(enemy)} (${e} job) beats ${heroName(ally)} (${a}) on style wheel (${(-JOB_TRIANGLE_WIN * 0.65).toFixed(1)})`,
            );
          }
        }
      }
    }
  }

  return { score, reasons };
}

function enemyStyleDensity(
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): ReturnType<typeof emptyStyleDensity> {
  const d = emptyStyleDensity();
  for (const e of enemyTeam) {
    const p = profileFor(e, input.heroOverrides);
    if (p) ingestJobsIntoDensity(d, p.primaryJob, p.secondaryJob);
  }
  return d;
}

function teamHasTriangleStyle(
  team: HeroId[],
  style: TriangleStyle,
  input: OptimizeInput,
): boolean {
  for (const id of team) {
    if (triangleStylesForHero(id, input).includes(style)) return true;
  }
  return false;
}

const FLYER_POKE_PENALTY = 2.35;
const MIXED_SHELL_VS_POKE_BONUS = 1.85;
const STYLE_DOM_COUNTER_BONUS = 2.4;
const POKE_INTO_FLYER_BONUS = 1.2;

/** Poke-vulnerable flyers + reward dive/brawl mix vs poke-heavy enemies (beyond pairwise triangle). */
function compWideEnemyJobScore(
  team: HeroId[],
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  if (!enemyTeam.length) return { score: 0, reasons: [] };

  const density = enemyStyleDensity(enemyTeam, input);
  const dom = dominantTriangleStyle(density);
  let score = 0;
  const reasons: string[] = [];

  if (dom === "Poke" && density.poke >= 1.15) {
    let flyerPenalty = 0;
    for (const ally of team) {
      if (!POKE_VULNERABLE_FLYER_IDS.has(ally)) continue;
      flyerPenalty += FLYER_POKE_PENALTY;
      reasons.push(
        `${heroName(ally)} is aerial / high-profile — weak into this poke-heavy lineup (-${FLYER_POKE_PENALTY.toFixed(2)})`,
      );
    }
    flyerPenalty = Math.min(flyerPenalty, 6.5);
    score -= flyerPenalty;

    if (
      teamHasTriangleStyle(team, "Dive", input) &&
      teamHasTriangleStyle(team, "Brawl", input)
    ) {
      score += MIXED_SHELL_VS_POKE_BONUS;
      reasons.push(
        `Dive + Brawl mix punishes enemy poke spread (+${MIXED_SHELL_VS_POKE_BONUS.toFixed(2)})`,
      );
    }
  }

  if (dom === "Poke" && teamHasTriangleStyle(team, "Dive", input)) {
    score += STYLE_DOM_COUNTER_BONUS;
    reasons.push(
      `Dive pressure counters enemy poke core (+${STYLE_DOM_COUNTER_BONUS.toFixed(2)})`,
    );
  }
  if (dom === "Brawl" && teamHasTriangleStyle(team, "Poke", input)) {
    score += STYLE_DOM_COUNTER_BONUS;
    reasons.push(
      `Poke spacing counters enemy brawl core (+${STYLE_DOM_COUNTER_BONUS.toFixed(2)})`,
    );
  }
  if (dom === "Dive" && teamHasTriangleStyle(team, "Brawl", input)) {
    score += STYLE_DOM_COUNTER_BONUS;
    reasons.push(
      `Brawl peel/counter-engage counters enemy dive core (+${STYLE_DOM_COUNTER_BONUS.toFixed(2)})`,
    );
  }

  const enemyFlyers = enemyTeam.filter((id) => POKE_VULNERABLE_FLYER_IDS.has(id)).length;
  if (enemyFlyers > 0 && teamHasTriangleStyle(team, "Poke", input)) {
    const flyerPunish = Math.min(enemyFlyers, 3) * POKE_INTO_FLYER_BONUS;
    score += flyerPunish;
    reasons.push(
      `Poke punish into ${enemyFlyers} enemy flyer${enemyFlyers > 1 ? "s" : ""} (+${flyerPunish.toFixed(2)})`,
    );
  }

  return { score, reasons };
}

function strategistOffHealerScore(
  team: HeroId[],
  assignment: Map<HeroId, Role>,
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const strategistIds = team.filter((id) => assignment.get(id) === "Strategist");
  if (strategistIds.length < 3) return { score, reasons };

  const offHealers = strategistIds.filter((id) => {
    const p = profileFor(id, input.heroOverrides);
    return typeof p?.healingPriority === "number" && p.healingPriority >= 3.2;
  });
  if (offHealers.length > 0) {
    const v = Math.min(offHealers.length, 2) * 2.15;
    score += v;
    reasons.push(
      `Triple-support shell stabilized by ${offHealers.length} off-healer${offHealers.length > 1 ? "s" : ""} (+${v.toFixed(2)})`,
    );
  }

  const hasAdam = strategistIds.includes("adam-warlock");
  const hasUltron = strategistIds.includes("ultron");
  if (hasAdam && hasUltron) {
    score += 3.2;
    reasons.push("Adam Warlock + Ultron off-heal duo scales well in triple support (+3.20)");
  } else if (hasAdam || hasUltron) {
    score += 1.35;
    reasons.push("Off-healer specialist value in triple support (+1.35)");
  }

  return { score, reasons };
}

function heroCompThriveScore(
  team: HeroId[],
  roleCount: Record<Role, number>,
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  if (!enemyTeam.length) return { score: 0, reasons: [] };

  const density = enemyStyleDensity(enemyTeam, input);
  const enemyDom = dominantTriangleStyle(density);
  if (!enemyDom) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  const teamHasDive = teamHasTriangleStyle(team, "Dive", input);
  const teamHasPoke = teamHasTriangleStyle(team, "Poke", input);
  const teamHasBrawl = teamHasTriangleStyle(team, "Brawl", input);

  // Team-comp shell bonus before hero-level adds.
  if (enemyDom === "Poke" && teamHasDive && roleCount.Strategist >= 2) {
    score += 2.1;
    reasons.push("Anti-poke comp shell active: dive core with 2+ Strategists (+2.10)");
  }
  if (enemyDom === "Dive" && teamHasBrawl && roleCount.Vanguard >= 2) {
    score += 2.1;
    reasons.push("Anti-dive comp shell active: brawl/peel frontline (+2.10)");
  }
  if (enemyDom === "Brawl" && teamHasPoke && roleCount.Strategist >= 1) {
    score += 2.1;
    reasons.push("Anti-brawl comp shell active: poke spacing with sustain (+2.10)");
  }

  const enemyFlyers = enemyTeam.filter((id) => POKE_VULNERABLE_FLYER_IDS.has(id)).length;
  const heroNotes: Array<{ value: number; text: string }> = [];

  for (const id of team) {
    const p = profileFor(id, input.heroOverrides);
    if (!p) continue;

    const styles = triangleStylesForHero(id, input);
    let heroDelta = 0;

    // Core wheel: dive > poke, poke > brawl(+flyers), brawl > dive.
    if (enemyDom === "Poke" && styles.includes("Dive")) heroDelta += 1.45;
    if (enemyDom === "Brawl" && styles.includes("Poke")) heroDelta += 1.45;
    if (enemyDom === "Dive" && styles.includes("Brawl")) heroDelta += 1.45;

    // Secondary supportive fit per role/job traits.
    if (enemyDom === "Dive" && (p.primaryJob === "Peel" || p.secondaryJob === "Peel")) {
      heroDelta += 0.95;
    }
    if (
      enemyDom === "Brawl" &&
      (p.primaryJob === "Control" || p.secondaryJob === "Control")
    ) {
      heroDelta += 0.85;
    }
    if (enemyDom === "Poke" && (p.primaryJob === "Dive" || p.secondaryJob === "Dive")) {
      heroDelta += 0.75;
    }

    // Poke heroes gain extra value into flyer-heavy enemies.
    if (enemyFlyers > 0 && styles.includes("Poke")) {
      heroDelta += Math.min(enemyFlyers, 3) * 0.35;
    }

    if (heroDelta > 0) {
      score += heroDelta;
      heroNotes.push({
        value: heroDelta,
        text: `${heroName(id)} thrives into enemy ${enemyDom} profile (+${heroDelta.toFixed(2)})`,
      });
    }
  }

  for (const n of heroNotes.sort((a, b) => b.value - a.value).slice(0, 5)) {
    reasons.push(n.text);
  }

  return { score, reasons };
}

type CompProfile = {
  diveUnits: number;
  pokeUnits: number;
  brawlUnits: number;
  controlUnits: number;
  healUnits: number;
  strategistUnits: number;
  flyerUnits: number;
  total: number;
};

function buildCompProfile(team: readonly HeroId[], input: OptimizeInput): CompProfile {
  const out: CompProfile = {
    diveUnits: 0,
    pokeUnits: 0,
    brawlUnits: 0,
    controlUnits: 0,
    healUnits: 0,
    strategistUnits: 0,
    flyerUnits: 0,
    total: team.length,
  };

  for (const id of team) {
    const p = profileFor(id, input.heroOverrides);
    if (!p) continue;
    if (p.role === "Strategist") out.strategistUnits += 1;
    if (p.primaryJob === "Dive" || p.secondaryJob === "Dive") out.diveUnits += 1;
    if (p.primaryJob === "Poke" || p.secondaryJob === "Poke") out.pokeUnits += 1;
    if (p.primaryJob === "Brawl" || p.secondaryJob === "Brawl") out.brawlUnits += 1;
    if (p.primaryJob === "Control" || p.secondaryJob === "Control") out.controlUnits += 1;
    if (p.primaryJob === "Heal" || p.secondaryJob === "Heal") out.healUnits += 1;
    if (POKE_VULNERABLE_FLYER_IDS.has(id)) out.flyerUnits += 1;
  }

  return out;
}

function fullCompCounterScore(
  team: HeroId[],
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  if (!enemyTeam.length) return { score: 0, reasons: [] };

  const own = buildCompProfile(team, input);
  const enemy = buildCompProfile(enemyTeam, input);

  let score = 0;
  const reasons: string[] = [];

  const enemyFullDive = enemy.diveUnits >= 4;
  const enemyPokeHeavy = enemy.pokeUnits >= 4;
  const enemyFlyerHeavy = enemy.flyerUnits >= 3;
  const enemyControlSustain = enemy.controlUnits >= 3 && (enemy.healUnits >= 2 || enemy.strategistUnits >= 2);

  const ownHeavyBrawl = own.brawlUnits >= 4;
  const ownBalanced =
    own.diveUnits >= 2 &&
    own.pokeUnits >= 2 &&
    own.brawlUnits >= 2 &&
    own.strategistUnits >= 1 &&
    own.total >= 6;
  const ownDiveCounter = own.diveUnits >= 3;
  const ownPokeCounter = own.pokeUnits >= 3;
  const ownMixedCounter =
    own.pokeUnits >= 2 &&
    own.brawlUnits >= 2 &&
    own.strategistUnits >= 1;

  if (enemyFullDive && (ownHeavyBrawl || ownBalanced)) {
    score += ownHeavyBrawl ? 3.3 : 2.6;
    reasons.push("Enemy full dive is countered by your heavy brawl/balanced structure");
  }
  if (enemyFlyerHeavy && ownPokeCounter) {
    score += 3.1;
    reasons.push("Enemy flyer-heavy comp is countered by your poke shell");
  }
  if (enemyPokeHeavy && ownDiveCounter) {
    score += 3.2;
    reasons.push("Enemy poke-heavy comp is countered by your dive shell");
  }
  if (enemyControlSustain && (ownPokeCounter || ownMixedCounter)) {
    score += ownPokeCounter ? 2.8 : 2.2;
    reasons.push("Enemy control/sustain comp is pressured by your poke/mixed counter-comp");
  }

  return { score, reasons };
}

function enemyCounterScore(
  team: HeroId[],
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  if (!enemyTeam.length) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  for (const ally of team) {
    const profile = profileFor(ally, input.heroOverrides);
    if (!profile) continue;
    for (const enemy of enemyTeam) {
      if (profile.counters.includes(enemy)) {
        score += 3.5;
        reasons.push(`${heroName(ally)} counters ${heroName(enemy)} (+3.5)`);
      }
      if (profile.counteredBy.includes(enemy)) {
        score -= 2.5;
        reasons.push(`${heroName(enemy)} counters ${heroName(ally)} (-2.5)`);
      }
    }
  }

  const tri = jobTriangleEnemyScore(team, enemyTeam, input);
  score += tri.score;
  reasons.push(...tri.reasons);

  const comp = compWideEnemyJobScore(team, enemyTeam, input);
  score += comp.score;
  reasons.push(...comp.reasons);

  const fullComp = fullCompCounterScore(team, enemyTeam, input);
  score += fullComp.score;
  reasons.push(...fullComp.reasons);

  return { score, reasons };
}

function tacticalKitScore(
  team: HeroId[],
  enemyTeam: readonly HeroId[],
  input: OptimizeInput,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  let mobilityCount = 0;
  let ultControlCount = 0;
  let offMapCount = 0;

  for (const id of team) {
    const profile = profileFor(id, input.heroOverrides);
    const hasDiveJob = profile?.primaryJob === "Dive" || profile?.secondaryJob === "Dive";
    if (HIGH_MOBILITY_HEROES.has(id) || hasDiveJob) mobilityCount += 1;
    if (ULT_CANCEL_HEROES.has(id)) ultControlCount += 1;
    if (OFF_MAP_THREAT_HEROES.has(id)) offMapCount += 1;
  }

  const mobilityScore = Math.min(mobilityCount, 4) * 1.35;
  if (mobilityScore > 0) {
    score += mobilityScore;
    reasons.push(`Mobility pressure from ${mobilityCount} high-mobility heroes (+${mobilityScore.toFixed(2)})`);
  }

  const ultScore = Math.min(ultControlCount, 3) * 1.8;
  if (ultScore > 0) {
    score += ultScore;
    reasons.push(`Ultimate counter/cancel coverage across ${ultControlCount} heroes (+${ultScore.toFixed(2)})`);
  }

  const envScore = Math.min(offMapCount, 3) * 1.25;
  if (envScore > 0) {
    score += envScore;
    reasons.push(`Environmental kill pressure from ${offMapCount} heroes (+${envScore.toFixed(2)})`);
  }

  if (mobilityCount >= 2 && ultControlCount >= 1) {
    score += 1.65;
    reasons.push("Mobility + ult denial package enables engage/peel tempo (+1.65)");
  }
  if (enemyTeam.length > 0 && ultControlCount >= 2) {
    score += 1.15;
    reasons.push("Double ult-control hedge into enemy win-condition ults (+1.15)");
  }

  return { score, reasons };
}

function evaluateTeam(team: HeroId[], input: OptimizeInput): EvaluatedTeam {
  const explanation: string[] = [];
  const { roleCount, assignment } = chooseBestRoleSplit(team, input.heroOverrides);

  let roleScore = roleShapeScore(roleCount);
  let synergyScore = 0;
  let counterScore = 0;

  for (const id of team) roleScore += baseHeroValue(id, input);

  const uniqueJobs = new Set<string>();
  for (const id of team) {
    const profile = profileFor(id, input.heroOverrides);
    if (profile?.primaryJob) uniqueJobs.add(profile.primaryJob);
    if (profile?.secondaryJob) uniqueJobs.add(profile.secondaryJob);
  }
  roleScore += uniqueJobs.size * 1.8;

  const positivePairNotes: Array<{ value: number; text: string }> = [];
  for (let i = 0; i < team.length; i += 1) {
    for (let j = i + 1; j < team.length; j += 1) {
      const pair = pairwiseSynergyAndCounter(team[i], team[j], input);
      synergyScore += pair.synergy;
      counterScore += pair.counter;
      for (const reason of pair.reasons) {
        const val = reason.includes("synergy") ? pair.synergy : pair.counter;
        positivePairNotes.push({ value: val, text: reason });
      }
    }
  }

  const enemyCounters = enemyCounterScore(team, input.enemyTeam ?? [], input);
  counterScore += enemyCounters.score;
  const tactical = tacticalKitScore(team, input.enemyTeam ?? [], input);
  synergyScore += tactical.score;
  const offHealer = strategistOffHealerScore(team, assignment, input);
  synergyScore += offHealer.score;
  const compThrive = heroCompThriveScore(team, roleCount, input.enemyTeam ?? [], input);
  synergyScore += compThrive.score;

  explanation.push(
    `Balanced role shape: ${roleCount.Vanguard} Vanguard / ${roleCount.Duelist} Duelist / ${roleCount.Strategist} Strategist`,
  );

  for (const note of positivePairNotes.sort((a, b) => b.value - a.value).slice(0, 3)) {
    explanation.push(note.text);
  }
  for (const reason of enemyCounters.reasons.slice(0, 6)) explanation.push(reason);
  for (const reason of tactical.reasons.slice(0, 4)) explanation.push(reason);
  for (const reason of offHealer.reasons.slice(0, 3)) explanation.push(reason);
  for (const reason of compThrive.reasons.slice(0, 5)) explanation.push(reason);

  if (input.map) {
    explanation.push(`Map context: ${input.map.mapName} (${input.map.mode})`);
    for (const tip of input.map.compositionTips.slice(0, 2)) {
      explanation.push(`Map fit: ${tip}`);
    }
  }

  const breakdown: ScoreBreakdown = {
    roleScore,
    synergyScore,
    counterScore,
    totalScore: roleScore + synergyScore + counterScore,
  };

  return { breakdown, roleCount, assignment, explanation };
}

function preferenceMatch(
  team: HeroId[],
  roleCount: Record<Role, number>,
  input: OptimizeInput,
): number {
  const preferredHeroes = new Set<HeroId>(
    (input.preferredHeroes ?? []).flatMap((id) =>
      id === "deadpool" ? [...DEADPOOL_ROLE_VARIANTS] : [id],
    ),
  );
  const preferredRoles = input.preferredRoles ?? [];

  let match = 0;
  for (const id of team) if (preferredHeroes.has(id)) match += 1;
  for (const role of preferredRoles) if (roleCount[role] > 0) match += 1;
  return match;
}

function combinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  const kk = Math.min(k, n - k);
  for (let i = 1; i <= kk; i += 1) {
    result = (result * (n - kk + i)) / i;
    if (result > EXHAUSTIVE_COMBINATION_LIMIT + 1) return result;
  }
  return result;
}

/** Max of (synergy + counter) over distinct pairs in the pool — bounds any undirected pair contribution. */
function poolMaxPairwiseDelta(heroIds: HeroId[], input: OptimizeInput): number {
  let m = 0;
  for (let i = 0; i < heroIds.length; i += 1) {
    for (let j = i + 1; j < heroIds.length; j += 1) {
      const p = pairwiseSynergyAndCounter(heroIds[i], heroIds[j], input);
      m = Math.max(m, p.synergy + p.counter);
    }
  }
  return m;
}

/**
 * suffixTopKBase[start][k] = sum of the k largest baseHeroValue scores in rest.slice(start).
 * Used to bound how much total base value can still be added when picking from that suffix.
 */
function buildSuffixTopKBaseSums(
  rest: HeroId[],
  input: OptimizeInput,
  maxK: number,
): number[][] {
  const n = rest.length;
  const out: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: maxK + 1 }, () => 0),
  );
  for (let start = 0; start < n; start += 1) {
    const vals = rest.slice(start).map((id) => baseHeroValue(id, input));
    vals.sort((a, b) => b - a);
    let run = 0;
    const cap = Math.min(maxK, vals.length);
    for (let k = 1; k <= cap; k += 1) {
      run += vals[k - 1];
      out[start][k] = run;
    }
  }
  return out;
}

/** Safe overestimate of preferenceMatch for any completion extending locked + picked from rest[restStart..]. */
function optimisticPreferenceUpperBound(
  locked: HeroId[],
  picked: HeroId[],
  restStart: number,
  rem: number,
  rest: HeroId[],
  input: OptimizeInput,
): number {
  const preferredSet = new Set<HeroId>(
    (input.preferredHeroes ?? []).flatMap((id) =>
      id === "deadpool" ? [...DEADPOOL_ROLE_VARIANTS] : [id],
    ),
  );
  const pr = input.preferredRoles ?? [];
  const team = [...locked, ...picked];
  let heroPref = 0;
  for (const id of team) if (preferredSet.has(id)) heroPref += 1;
  let prefInSuffix = 0;
  for (let i = restStart; i < rest.length; i += 1) {
    if (preferredSet.has(rest[i])) prefInSuffix += 1;
  }
  heroPref += Math.min(rem, prefInSuffix);
  const cap = 6 + pr.length;
  return Math.min(cap, heroPref + pr.length);
}

function compareLexPrefScore(a: { pref: number; score: number }, b: { pref: number; score: number }): number {
  if (a.pref !== b.pref) return a.pref - b.pref;
  return a.score - b.score;
}

/**
 * Optimistic upper bound on totalScore for any full 6 completing locked ∪ picked with rem picks from rest[restStart..].
 */
function optimisticTotalScoreUpperBound(
  locked: HeroId[],
  picked: HeroId[],
  restStart: number,
  rem: number,
  suffixTopKBase: number[][],
  maxPairDelta: number,
  input: OptimizeInput,
): number {
  const team = [...locked, ...picked];
  const sumBase =
    team.reduce((acc, id) => acc + baseHeroValue(id, input), 0) +
    (suffixTopKBase[restStart]?.[rem] ?? 0);

  let internalPairs = 0;
  for (let i = 0; i < team.length; i += 1) {
    for (let j = i + 1; j < team.length; j += 1) {
      const p = pairwiseSynergyAndCounter(team[i], team[j], input);
      internalPairs += p.synergy + p.counter;
    }
  }

  const s = team.length;
  const futurePairs =
    rem * s * maxPairDelta + (rem > 1 ? (rem * (rem - 1)) / 2 : 0) * maxPairDelta;

  const enemyN = input.enemyTeam?.length ?? 0;
  const enemySlack = enemyN > 0 ? 6 * enemyN * 5 + 80 : 0;
  const roleJobSlack = 340;

  return sumBase + internalPairs + futurePairs + roleJobSlack + enemySlack;
}

function evaluateCandidate(team: HeroId[], input: OptimizeInput): ScoredTeam {
  const evalResult = evaluateTeam(team, input);
  return {
    team: team as unknown as Team6,
    score: evalResult.breakdown.totalScore,
    notes: evalResult.explanation,
    explanation: evalResult.explanation,
    breakdown: evalResult.breakdown,
    roleCount: evalResult.roleCount,
  };
}

/**
 * Depth-first search with backtracking over C(|rest|, need) completions.
 * Branch-and-bound: skip a subtree when an optimistic (preference, totalScore) upper bound
 * cannot beat the current K-th best team under the same lex order as sortAndDeduplicate
 * (preference first, then score). Preference is bounded optimistically so we never prune
 * a branch that could still produce a team that displaces the current top-K frontier.
 *
 * Classic DFS + pruning framing (e.g. tutorial walkthroughs):
 * - https://www.youtube.com/watch?v=Crq0doN9ozM
 * - https://www.youtube.com/watch?v=DnhEMyRZe0g
 */
function dfsExhaustiveSearch(
  rest: HeroId[],
  need: number,
  locked: HeroId[],
  input: OptimizeInput,
): ScoredTeam[] {
  const output: ScoredTeam[] = [];
  const suffixTopKBase = buildSuffixTopKBaseSums(rest, input, need);
  const poolIds = [...new Set([...locked, ...rest])];
  const maxPairDelta = poolMaxPairwiseDelta(poolIds, input);

  const topLex: Array<{ pref: number; score: number }> = [];

  const pushTopLex = (pref: number, score: number) => {
    topLex.push({ pref, score });
    topLex.sort((a, b) => compareLexPrefScore(b, a));
    while (topLex.length > MAX_RESULTS) topLex.pop();
  };

  const lexPrunesSubtree = (prefUb: number, scoreUb: number): boolean => {
    if (topLex.length < MAX_RESULTS) return false;
    const worst = topLex[MAX_RESULTS - 1];
    return compareLexPrefScore({ pref: prefUb, score: scoreUb }, worst) < 0;
  };

  const walk = (start: number, picked: HeroId[]) => {
    if (picked.length === need) {
      const scored = evaluateCandidate([...locked, ...picked], input);
      output.push(scored);
      const pref = preferenceMatch(
        [...scored.team],
        scored.roleCount as Record<Role, number>,
        input,
      );
      pushTopLex(pref, scored.score);
      return;
    }

    const rem = need - picked.length;
    const prefUb = optimisticPreferenceUpperBound(locked, picked, start, rem, rest, input);
    const scoreUb = optimisticTotalScoreUpperBound(
      locked,
      picked,
      start,
      rem,
      suffixTopKBase,
      maxPairDelta,
      input,
    );
    if (lexPrunesSubtree(prefUb, scoreUb)) return;

    const remaining = rem;
    const indices: number[] = [];
    for (let i = start; i <= rest.length - remaining; i += 1) indices.push(i);
    indices.sort(
      (ia, ib) => baseHeroValue(rest[ib], input) - baseHeroValue(rest[ia], input),
    );

    for (const i of indices) {
      picked.push(rest[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };

  walk(0, []);
  return output;
}

function beamSearch(
  rest: HeroId[],
  need: number,
  locked: HeroId[],
  input: OptimizeInput,
): ScoredTeam[] {
  const scoredRest = [...rest].sort(
    (a, b) => baseHeroValue(b, input) - baseHeroValue(a, input),
  );

  let states: SearchState[] = [{ picked: [], scoreHint: 0 }];
  for (let depth = 0; depth < need; depth += 1) {
    const next: SearchState[] = [];
    for (const state of states) {
      const startIndex =
        state.picked.length === 0
          ? 0
          : scoredRest.indexOf(state.picked[state.picked.length - 1]) + 1;
      for (let i = startIndex; i < scoredRest.length; i += 1) {
        const id = scoredRest[i];
        if (state.picked.includes(id)) continue;
        const pairHint = state.picked.reduce(
          (acc, other) => acc + pairwiseSynergyAndCounter(id, other, input).synergy,
          0,
        );
        next.push({
          picked: [...state.picked, id],
          scoreHint: state.scoreHint + baseHeroValue(id, input) + pairHint,
        });
      }
    }
    next.sort((a, b) => b.scoreHint - a.scoreHint);
    states = next.slice(0, BEAM_WIDTH);
  }

  return states.map((state) => evaluateCandidate([...locked, ...state.picked], input));
}

function sortAndDeduplicate(candidates: ScoredTeam[], input: OptimizeInput): ScoredTeam[] {
  const constrained = candidates.filter((team) =>
    satisfiesRoleStructureConstraints(team.roleCount as Record<Role, number>),
  );
  const source = constrained.length > 0 ? constrained : candidates;
  const ranked = source
    .map((team) => ({
      team,
      preference: preferenceMatch(
        [...team.team],
        team.roleCount as Record<Role, number>,
        input,
      ),
    }))
    .sort((a, b) => b.preference - a.preference || b.team.score - a.team.score);

  const unique = new Map<string, ScoredTeam>();
  for (const entry of ranked) {
    const key = [...entry.team.team].sort().join("|");
    if (!unique.has(key)) unique.set(key, entry.team);
    if (unique.size >= MAX_RESULTS) break;
  }
  return [...unique.values()];
}

export function optimizeTeamComposition(input: OptimizeInput): readonly ScoredTeam[] {
  const { pool, locked } = normalizePool(input);
  if (pool.length < 6 || locked.length > 6) return [];

  const need = 6 - locked.length;
  const rest = pool.filter((id) => !locked.includes(id));
  if (rest.length < need) return [];

  let candidates: ScoredTeam[];
  if (need === 0) {
    candidates = [evaluateCandidate([...locked], input)];
  } else if (combinationCount(rest.length, need) <= EXHAUSTIVE_COMBINATION_LIMIT) {
    candidates = dfsExhaustiveSearch(rest, need, locked, input);
  } else {
    candidates = beamSearch(rest, need, locked, input);
  }

  return sortAndDeduplicate(candidates, input);
}

export function suggestNextDraftPicks(
  input: OptimizeInput,
  maxSuggestions = 5,
): readonly DraftPickSuggestion[] {
  const { pool, locked } = normalizePool(input);
  if (locked.length >= 6) return [];

  const taken = new Set(locked);
  const options = pool.filter((id) => !taken.has(id));
  const suggestions: DraftPickSuggestion[] = [];

  for (const candidate of options) {
    const projected = optimizeTeamComposition({ ...input, locked: [...locked, candidate] })[0];
    if (!projected) continue;
    suggestions.push({
      heroId: candidate,
      heroName: heroName(candidate),
      projectedTopScore: projected.score,
      projectedRoleShape: projected.roleCount,
      reason: projected.explanation.slice(0, 2).join("; "),
    });
  }

  suggestions.sort((a, b) => b.projectedTopScore - a.projectedTopScore);
  return suggestions.slice(0, maxSuggestions);
}

type BanRow = { heroId: HeroId; weight: number; reason: string };

/**
 * Ban targets still in the roster pool (not on the locked enemy list): deny more of the
 * enemy's dominant Dive/Poke/Brawl identity, using primary/secondary jobs from the guide.
 */
export function suggestBansAgainstEnemy(
  input: OptimizeInput,
  limit = 5,
): readonly BanSuggestion[] {
  const enemies = input.enemyTeam ?? [];
  if (!enemies.length) return [];

  const banned = new Set(input.banned ?? []);
  const pool = [...new Set(input.roster)].filter((id) => !enemies.includes(id) && !banned.has(id));

  const density = emptyStyleDensity();
  for (const e of enemies) {
    const p = profileFor(e, input.heroOverrides);
    if (p) ingestJobsIntoDensity(density, p.primaryJob, p.secondaryJob);
  }
  const dom = dominantTriangleStyle(density);

  const rows: BanRow[] = [];

  const pushStyleRows = (style: TriangleStyle, primaryW: number, secondaryW: number, blurb: string) => {
    for (const id of pool) {
      const p = profileFor(id, input.heroOverrides);
      if (!p) continue;
      let w = 0;
      let reason = "";
      if (jobToTriangleStyle(p.primaryJob) === style) {
        w += primaryW;
        reason = `${blurb} (primary ${style}).`;
      } else if (jobToTriangleStyle(p.secondaryJob) === style) {
        w += secondaryW;
        reason = `${blurb} (secondary ${style}).`;
      }
      if (w > 0) rows.push({ heroId: id, weight: w, reason });
    }
  };

  if (dom === "Poke") {
    pushStyleRows("Poke", 3.2, 2.05, "Extra poke — deny more range stack");
  } else if (dom === "Dive") {
    pushStyleRows("Dive", 2.85, 1.65, "Extra dive — trim their flank stack");
  } else if (dom === "Brawl") {
    pushStyleRows("Brawl", 2.95, 1.75, "Extra brawl — shrink their frontline options");
  } else {
    const style: TriangleStyle | null =
      density.poke >= density.dive && density.poke >= density.brawl && density.poke >= 0.85
        ? "Poke"
        : density.dive >= density.brawl && density.dive >= 0.85
          ? "Dive"
          : density.brawl >= 0.85
            ? "Brawl"
            : null;
    if (style) {
      pushStyleRows(style, 2.2, 1.4, "Enemy jobs lean this style — thin the pool");
    }
  }

  rows.sort((a, b) => b.weight - a.weight);
  const seen = new Set<HeroId>();
  const out: BanSuggestion[] = [];
  for (const r of rows) {
    if (seen.has(r.heroId)) continue;
    seen.add(r.heroId);
    out.push({ heroId: r.heroId, reason: r.reason });
    if (out.length >= limit) break;
  }
  return out;
}
