import { getAppMetaValue, setAppMetaValue } from "@teamcomposer/db";
import { isAdminRequestAuthorized } from "@/lib/admin-request";

const HERO_OVERRIDES_KEY = "hero_guide_overrides_v1";

interface HeroOverridesBody {
  heroOverrides: Record<string, unknown>;
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = await getAppMetaValue(HERO_OVERRIDES_KEY);
  const heroOverrides = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  return Response.json({ ok: true, heroOverrides });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HeroOverridesBody;
  if (!body || typeof body.heroOverrides !== "object" || body.heroOverrides === null) {
    return Response.json(
      { ok: false, error: "heroOverrides object is required" },
      { status: 400 },
    );
  }

  await setAppMetaValue(HERO_OVERRIDES_KEY, JSON.stringify(body.heroOverrides));
  return Response.json({ ok: true });
}
