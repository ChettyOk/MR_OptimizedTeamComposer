/**
 * Style wheel used for team-vs-enemy job matchup scoring:
 * Dive > Poke, Poke > Brawl, Brawl > Dive ("A > B" means A counters B).
 */

export type TriangleStyle = "Dive" | "Poke" | "Brawl";

/** Maps a guide primary/secondary job to a triangle style, if it participates in the wheel. */
export function jobToTriangleStyle(job: string | null | undefined): TriangleStyle | null {
  if (!job) return null;
  if (job === "Dive" || job === "Poke" || job === "Brawl") return job;
  return null;
}

/** True if `attacker` counters `defender` on the Dive / Poke / Brawl wheel. */
export function triangleStyleCounters(attacker: TriangleStyle, defender: TriangleStyle): boolean {
  const beats: Record<TriangleStyle, TriangleStyle> = {
    Dive: "Poke",
    Poke: "Brawl",
    Brawl: "Dive",
  };
  return beats[attacker] === defender;
}

/** Aggregate primary (weight 1) + secondary (0.55) triangle jobs for a roster slice. */
export type StyleDensity = { dive: number; poke: number; brawl: number };

export function emptyStyleDensity(): StyleDensity {
  return { dive: 0, poke: 0, brawl: 0 };
}

export function ingestJobsIntoDensity(
  density: StyleDensity,
  primaryJob: string | undefined,
  secondaryJob: string | undefined,
): void {
  const add = (t: TriangleStyle | null, w: number) => {
    if (t === "Dive") density.dive += w;
    if (t === "Poke") density.poke += w;
    if (t === "Brawl") density.brawl += w;
  };
  add(jobToTriangleStyle(primaryJob), 1);
  add(jobToTriangleStyle(secondaryJob), 0.55);
}

/**
 * Dominant enemy style when clearly ahead (else null = mixed).
 * Used for ban suggestions and comp-wide penalties.
 */
export function dominantTriangleStyle(d: StyleDensity): TriangleStyle | null {
  const total = d.dive + d.poke + d.brawl;
  if (total < 1) return null;
  const ranked = (
    [
      ["Poke", d.poke],
      ["Dive", d.dive],
      ["Brawl", d.brawl],
    ] as [TriangleStyle, number][]
  ).sort((a, b) => b[1] - a[1]);
  const [top, v1] = ranked[0];
  const v2 = ranked[1][1];
  if (v1 < 1) return null;
  if (v1 - v2 < 0.35) return null;
  return top;
}

/** High-mobility / aerial heroes: drafting many into poke-heavy enemies is penalized. */
export const POKE_VULNERABLE_FLYER_IDS: ReadonlySet<string> = new Set([
  "storm",
  "iron-man",
  "human-torch",
  "phoenix",
  "magneto",
  "ultron",
  "star-lord",
]);
