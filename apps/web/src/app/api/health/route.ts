import { getDb, pingDatabase } from "@teamcomposer/db";

export async function GET() {
  const db = getDb();
  if (!db) {
    return Response.json({
      ok: true,
      database: "not_configured" as const,
    });
  }

  try {
    await pingDatabase(db);
    return Response.json({ ok: true, database: "connected" as const });
  } catch {
    return Response.json(
      { ok: false, database: "error" as const },
      { status: 503 },
    );
  }
}
