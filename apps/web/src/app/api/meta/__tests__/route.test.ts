import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppMetaValue: vi.fn(),
}));

vi.mock("@teamcomposer/db", () => ({
  getAppMetaValue: mocks.getAppMetaValue,
}));

import { GET } from "../route";

describe("GET /api/meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppMetaValue.mockResolvedValue(null);
  });

  it("returns catalog shape and null patch when unset", async () => {
    const res = await GET();
    const body = (await res.json()) as {
      ok: boolean;
      patchVersion: string | null;
      heroCount: number;
      maps: { id: string }[];
      tierList: unknown[];
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.patchVersion).toBeNull();
    expect(body.heroCount).toBeGreaterThan(0);
    expect(body.maps.length).toBeGreaterThan(0);
    expect(body.tierList.length).toBe(body.heroCount);
  });

  it("returns patchVersion from app_meta", async () => {
    mocks.getAppMetaValue.mockImplementation(async (key: string) => {
      if (key === "data_patch_version") return "2026.05.01";
      return null;
    });

    const res = await GET();
    const body = (await res.json()) as { patchVersion: string | null };

    expect(body.patchVersion).toBe("2026.05.01");
  });
});
