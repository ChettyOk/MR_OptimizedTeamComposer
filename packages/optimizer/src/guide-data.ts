import rawGuide from "./guide-data.raw.json";

type RawHeroGuide = {
  role: string | null;
  archetype: string | null;
  rangeStyle: string | null;
  primaryJob: string | null;
  primaryZone: string | null;
  secondaryJob: string | null;
  secondaryZone: string | null;
  healingPriority: number | null;
  healingResponsibility: string | null;
  notes: string | null;
  counters: string[];
  counteredBy: string[];
  synergies: string[];
};

export interface HeroGuideProfile {
  role: "Vanguard" | "Duelist" | "Strategist";
  archetype?: string;
  rangeStyle?: string;
  primaryJob?: string;
  primaryZone?: string;
  secondaryJob?: string;
  secondaryZone?: string;
  healingPriority?: number;
  healingResponsibility?: string;
  notes?: string;
  counters: readonly string[];
  counteredBy: readonly string[];
  synergies: readonly string[];
}

export const HERO_NAME_BY_ID: Readonly<Record<string, string>> = {
  "adam-warlock": "Adam Warlock",
  angela: "Angela",
  "black-cat": "Black Cat",
  "black-panther": "Black Panther",
  "black-widow": "Black Widow",
  blade: "Blade",
  "captain-america": "Captain America",
  "cloak-dagger": "Cloak & Dagger",
  daredevil: "Daredevil",
  "deadpool-duelist": "Deadpool (Duelist)",
  "deadpool-vanguard": "Deadpool (Vanguard)",
  "deadpool-strategist": "Deadpool (Strategist)",
  "doctor-strange": "Doctor Strange",
  "elsa-bloodstone": "Elsa Bloodstone",
  "emma-frost": "Emma Frost",
  gambit: "Gambit",
  groot: "Groot",
  hawkeye: "Hawkeye",
  hela: "Hela",
  hulk: "Hulk",
  "human-torch": "Human Torch",
  "invisible-woman": "Invisible Woman",
  "iron-fist": "Iron Fist",
  "iron-man": "Iron Man",
  jeff: "Jeff the Land Shark",
  loki: "Loki",
  "luna-snow": "Luna Snow",
  magik: "Magik",
  magneto: "Magneto",
  mantis: "Mantis",
  "mister-fantastic": "Mister Fantastic",
  "moon-knight": "Moon Knight",
  namor: "Namor",
  "peni-parker": "Peni Parker",
  phoenix: "Phoenix",
  psylocke: "Psylocke",
  punisher: "The Punisher",
  "rocket-raccoon": "Rocket Raccoon",
  rogue: "Rogue",
  "scarlet-witch": "Scarlet Witch",
  "spider-man": "Spider-Man",
  "squirrel-girl": "Squirrel Girl",
  "star-lord": "Star-Lord",
  storm: "Storm",
  "the-thing": "The Thing",
  thor: "Thor",
  ultron: "Ultron",
  venom: "Venom",
  "white-fox": "White Fox",
  "winter-soldier": "Winter Soldier",
  wolverine: "Wolverine",
};

const MANUAL_NAME_TO_ID: Record<string, string> = {
  cloakanddagger: "cloak-dagger",
  cloakdagger: "cloak-dagger",
  misterfantastic: "mister-fantastic",
  mrfantastic: "mister-fantastic",
  moonnight: "moon-knight",
  thepunisher: "punisher",
  starlord: "star-lord",
  spiderman: "spider-man",
  jeffthelandshark: "jeff",
  deadpool: "deadpool-duelist",
  deadpoolduelist: "deadpool-duelist",
  deadpoolvanguard: "deadpool-vanguard",
  deadpoolstrategist: "deadpool-strategist",
};

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const normalizedNameToId = new Map<string, string>();
for (const [id, name] of Object.entries(HERO_NAME_BY_ID)) {
  normalizedNameToId.set(normalizeName(name), id);
}
for (const [alias, id] of Object.entries(MANUAL_NAME_TO_ID)) {
  normalizedNameToId.set(alias, id);
}

function resolveHeroId(name: string): string | null {
  return normalizedNameToId.get(normalizeName(name)) ?? null;
}

function normalizeRole(role: string | null): HeroGuideProfile["role"] | null {
  if (role === "Vanguard" || role === "Duelist" || role === "Strategist") {
    return role;
  }
  return null;
}

function mapNameListToIds(items: string[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (normalizeName(item) === "deadpool") {
      for (const id of [
        "deadpool-duelist",
        "deadpool-vanguard",
        "deadpool-strategist",
      ]) {
        if (!ids.includes(id)) ids.push(id);
      }
      continue;
    }
    const id = resolveHeroId(item);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

const guideById = new Map<string, HeroGuideProfile>();

for (const [heroName, raw] of Object.entries(rawGuide as Record<string, RawHeroGuide>)) {
  const id = resolveHeroId(heroName);
  const role = normalizeRole(raw.role);
  if (!id || !role) {
    continue;
  }
  guideById.set(id, {
    role,
    archetype: raw.archetype ?? undefined,
    rangeStyle: raw.rangeStyle ?? undefined,
    primaryJob: raw.primaryJob ?? undefined,
    primaryZone: raw.primaryZone ?? undefined,
    secondaryJob: raw.secondaryJob ?? undefined,
    secondaryZone: raw.secondaryZone ?? undefined,
    healingPriority:
      typeof raw.healingPriority === "number" ? raw.healingPriority : undefined,
    healingResponsibility: raw.healingResponsibility ?? undefined,
    notes: raw.notes ?? undefined,
    counters: mapNameListToIds(raw.counters),
    counteredBy: mapNameListToIds(raw.counteredBy),
    synergies: mapNameListToIds(raw.synergies),
  });
}

export const HERO_GUIDE_BY_ID: ReadonlyMap<string, HeroGuideProfile> = guideById;
