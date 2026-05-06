import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppMetaValue: vi.fn(),
  setAppMetaValue: vi.fn(),
  cookieGet: vi.fn((): { value: string } | undefined => undefined),
}));

vi.mock("@teamcomposer/db", () => ({
  getAppMetaValue: mocks.getAppMetaValue,
  setAppMetaValue: mocks.setAppMetaValue,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));

import { GET, PUT } from "../route";
import { signAdminSession } from "@/lib/admin-session";

describe("/api/admin/hero-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    mocks.cookieGet.mockReset();
    mocks.cookieGet.mockReturnValue(undefined);
  });

  it("reads stored overrides", async () => {
    mocks.getAppMetaValue.mockResolvedValue(
      JSON.stringify({ hulk: { primaryJob: "Peel" } }),
    );

    const req = new Request("http://localhost/api/admin/hero-data", { method: "GET" });
    const res = await GET(req);
    const body = (await res.json()) as { ok: boolean; heroOverrides: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.heroOverrides).toEqual({ hulk: { primaryJob: "Peel" } });
  });

  it("rejects unauthorized when admin credentials are set but session is missing", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "secret-pass";

    const req = new Request("http://localhost/api/admin/hero-data", { method: "GET" });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("allows GET when admin session cookie is valid", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "secret-pass";
    mocks.getAppMetaValue.mockResolvedValue("{}");
    mocks.cookieGet.mockReturnValue({ value: signAdminSession() });

    const req = new Request("http://localhost/api/admin/hero-data", { method: "GET" });
    const res = await GET(req);
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("writes overrides to DB", async () => {
    const req = new Request("http://localhost/api/admin/hero-data", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heroOverrides: { hela: { primaryJob: "Poke" } } }),
    });

    const res = await PUT(req);
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.setAppMetaValue).toHaveBeenCalledWith(
      "hero_guide_overrides_v1",
      JSON.stringify({ hela: { primaryJob: "Poke" } }),
    );
  });
});
