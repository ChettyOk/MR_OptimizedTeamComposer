import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  optimizeTeamComposition: vi.fn(),
  suggestNextDraftPicks: vi.fn(),
  getAppMetaValue: vi.fn(),
}));

vi.mock("@teamcomposer/optimizer", () => ({
  optimizeTeamComposition: mocks.optimizeTeamComposition,
  suggestNextDraftPicks: mocks.suggestNextDraftPicks,
}));

vi.mock("@teamcomposer/db", () => ({
  getAppMetaValue: mocks.getAppMetaValue,
}));

import { POST } from "../route";

describe("POST /api/optimize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppMetaValue.mockImplementation(async () => null);
  });

  it("returns 400 when roster is missing", async () => {
    const req = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "optimize" }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("roster");
  });

  it("returns optimized teams and injects DB hero overrides", async () => {
    mocks.getAppMetaValue.mockImplementation(async (key: string) => {
      if (key === "hero_guide_overrides_v1") {
        return JSON.stringify({ hulk: { primaryJob: "Peel" } });
      }
      return null;
    });
    mocks.optimizeTeamComposition.mockReturnValue([
      { team: ["hulk", "mantis", "hela", "thor", "loki", "hawkeye"], score: 123, explanation: [], notes: [], breakdown: { roleScore: 40, synergyScore: 50, counterScore: 33, totalScore: 123 }, roleCount: { Vanguard: 2, Duelist: 2, Strategist: 2 } },
    ]);

    const req = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "optimize", topN: 3, roster: ["hulk", "mantis", "hela", "thor", "loki", "hawkeye"] }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; teams: unknown[] };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.teams).toHaveLength(1);
    expect(mocks.optimizeTeamComposition).toHaveBeenCalledTimes(1);

    const callArg = mocks.optimizeTeamComposition.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(callArg.heroOverrides).toEqual({ hulk: { primaryJob: "Peel" } });
  });

  it("returns draft picks in draft mode", async () => {
    mocks.suggestNextDraftPicks.mockReturnValue([
      {
        heroId: "mantis",
        heroName: "Mantis",
        projectedTopScore: 99,
        projectedRoleShape: { Vanguard: 2, Duelist: 2, Strategist: 2 },
        reason: "balanced role shape",
      },
    ]);

    const req = new Request("http://localhost/api/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "draft", roster: ["hulk", "mantis", "hela", "thor", "loki", "hawkeye"] }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; picks: unknown[] };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.picks).toHaveLength(1);
    expect(mocks.suggestNextDraftPicks).toHaveBeenCalledOnce();
  });
});
