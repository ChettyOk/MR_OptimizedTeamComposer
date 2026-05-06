# Marvel Rivals Team Composition Optimizer

A production-oriented **full-stack 6v6 team optimizer** for Marvel Rivals.

It recommends top team compositions using weighted scoring with explainable outputs:

- **Role score** (role balance + situational/map-aware job fit + healing profile)
- **Synergy score** (positive hero interactions)
- **Counter score** (how well your team answers the enemy lineup)

Final score formula:

`total score = role score + synergy score + counter score`

The optimizer is powered by curated hero metadata extracted from:

- `5paceCat's Simplified Character Guide for Marvel Rivals.xlsx`

## Features

- 6v6 lineup generation with bans, locks, and pool constraints
- Optional enemy lineup input (up to 6) for counter-aware scoring
- Optional preferred heroes and preferred roles for tie-break sorting
- Top N recommendations (default 5)
- Explanation for every team (human-readable reasons)
- Draft mode: next best pick suggestions from current locks
- Map-aware situational adjustments (Convergence / Convoy / Domination / etc.)
- Deadpool flex role handling (Vanguard, Duelist, Strategist)

## Architecture

### Monorepo

- `apps/web` — Next.js App Router frontend + REST API routes
- `packages/optimizer` — pure TypeScript optimization engine
- `packages/db` — Postgres/Drizzle package (not required for core optimization)

### API Layer

- `POST /api/optimize`
  - `mode: "optimize"` returns top team recommendations
  - `mode: "draft"` returns next-pick suggestions
- `GET /api/heroes` — merged built-in roster + extra heroes from Postgres (public read)
- `GET /api/admin/hero-data` — hero-guide overrides (auth when `ADMIN_USERNAME` + `ADMIN_PASSWORD` are set)
- `PUT /api/admin/hero-data` — write overrides (valid admin **session cookie** after `/admin/login`)
- `GET/PUT /api/admin/catalog-extras` — custom heroes `{ id, name, role }[]` (same session)
- `POST /api/admin/login` / `POST /api/admin/logout` — body `{ username, password }` → httpOnly session cookie
- **`/admin`** — separate admin UI (not linked from `/`). When admin env vars are set, sign in at **`/admin/login`**. Scripts can use `curl -c`/`-b` with the session cookie after logging in.

### Optimizer Engine

Located in `packages/optimizer/src/index.ts`.

Core approaches:

- **Filtered combinations + heuristic scoring**
- Hybrid search strategy:
  - exhaustive combination enumeration when feasible
  - beam search fallback for larger pools

This avoids brute-force explosion while still producing strong results.

## Data Model

### Heroes

- id, name, role (Vanguard / Duelist / Strategist)
- role flex support (Deadpool as V/D/S in assignment phase)

### Guide Metadata (Spreadsheet-derived)

- archetype
- primary/secondary jobs and zones (in data, close-range **Brawl** replaces the old **Pressure** label for the style wheel)
- healing priority / responsibility
- counters
- countered by
- synergies

See:

- `packages/optimizer/src/guide-data.raw.json`
- `packages/optimizer/src/guide-data.ts`

### Maps

- competitive/game playlist mode
- map-level composition tips used for situational context

See:

- `apps/web/src/data/maps.ts`

## Scoring Logic

For each candidate 6-hero team:

1. **Role score**
   - role-shape quality (tank/dps/support balance in 6v6)
   - map-mode job fit bonuses
   - healing profile contribution
   - job diversity contribution

2. **Synergy score**
   - pairwise synergy relationships from guide data

3. **Counter score**
   - enemy matchup counters/countered-by effects
   - **Dive / Poke / Brawl wheel** when an enemy lineup is set: Dive beats Poke, Poke beats Brawl, Brawl beats Dive (see `packages/optimizer/src/job-triangle.ts`)
   - **Poke-heavy enemies:** aerial “flyer” ids (Storm, Iron Man, Human Torch, etc.) are penalized on your team; a **Dive + Brawl** shell gets a small bonus vs poke spread
   - **`POST /api/optimize`** returns **`banSuggestions`** (job-based pool denial targets) when `enemyTeam` is non-empty
   - internal anti-synergy penalties where relevant

4. **Total**
   - strict additive formula

5. **Explainability**
   - top reasons emitted as natural-language bullets
   - includes role shape, key synergies, enemy counter interactions, map fit notes

## Draft Mode

Given current locked heroes, draft mode evaluates each next-pick candidate by projecting the best resulting team and returns ranked suggestions with:

- projected top score
- projected role shape
- concise rationale

## Setup

### Prerequisites

- Node 20+
- pnpm 9+

### Install and run

```bash
pnpm install
pnpm dev
```

Open:

- `http://localhost:3000`

## API Contract

### Optimize request

```json
{
  "mode": "optimize",
  "topN": 5,
  "roster": ["captain-america", "hela", "mantis"],
  "banned": ["spider-man"],
  "locked": ["captain-america"],
  "enemyTeam": ["venom", "loki"],
  "preferredHeroes": ["mantis"],
  "preferredRoles": ["Strategist"],
  "map": {
    "mapId": "empire-of-eternal-night-midtown",
    "mapName": "EMPIRE OF ETERNAL NIGHT: MIDTOWN",
    "mode": "Convoy",
    "compositionTips": ["...", "..."]
  }
}
```

### Optimize response

- `teams[]` with:
  - `team`
  - `score`
  - `breakdown` (`roleScore`, `synergyScore`, `counterScore`, `totalScore`)
  - `explanation[]`

### Draft response

```json
{
  "mode": "draft",
  "picks": [
    {
      "heroId": "mantis",
      "heroName": "Mantis",
      "projectedTopScore": 123.4,
      "projectedRoleShape": { "Vanguard": 2, "Duelist": 2, "Strategist": 2 },
      "reason": "..."
    }
  ]
}
```

### Admin hero override request

```json
{
  "heroOverrides": {
    "hulk": {
      "primaryJob": "Peel",
      "healingPriority": 2
    }
  }
}
```

## Testing

Web/API tests are implemented with Vitest:

```bash
pnpm --filter @teamcomposer/web test
```

## Deployment Notes

This app is deployment-ready for standard Next.js hosting (e.g. Vercel, Railway, Fly.io).

### Vercel + Neon (Postgres)

For Neon on Vercel, set these environment variables in the Vercel project:

- `DATABASE_URL`: your Neon connection string (include `?sslmode=require` if your Neon dashboard shows it)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: enables `/admin/login` and admin API session cookies
- `REDIS_URL` (optional): enables optimize result caching (the app still works without it)
- `DATABASE_CLIENT` (optional): set to `"neon"` to force the Neon serverless DB driver (defaults to Neon on Vercel)

Run DB migrations separately (Vercel won’t do this automatically):

```bash
pnpm db:migrate
```

Recommended production steps:

- set **`ADMIN_USERNAME`** and **`ADMIN_PASSWORD`** in the server environment (replaces the old single `ADMIN_API_KEY`); sign in at `/admin/login` so the browser gets the session cookie for admin APIs
- enable CI lint/type checks
- add API rate limiting if exposing publicly
- persist hero/map/versioned metadata in DB for live balancing tools
- add telemetry for recommendation quality and draft outcomes

## Design Decisions

- Keep core optimizer in a standalone package for testability and reuse.
- Preserve strict 6v6 constraints even when requirements examples mention 5v5.
- Use explainable heuristic scoring over opaque black-box models for trust and debuggability.
- Keep API contract stable so frontend can evolve independently.

