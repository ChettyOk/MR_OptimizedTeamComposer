import { eq, sql } from "drizzle-orm";
import { drizzle as nodePostgresDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as neonHttpDrizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database =
  | ReturnType<typeof nodePostgresDrizzle<typeof schema>>
  | ReturnType<typeof neonHttpDrizzle<typeof schema>>;

let cached: Database | null = null;

export function getDb(): Database | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    // Vercel serverless runtime should use Neon’s serverless driver.
    // To be explicit, set `DATABASE_CLIENT=neon` in Vercel env vars.
    const client = (process.env.DATABASE_CLIENT ?? "").toLowerCase();
    const useNeon =
      client === "neon" ||
      client === "neon-serverless" ||
      (!client && process.env.VERCEL === "1");

    cached = useNeon
      ? (neonHttpDrizzle(neon(url), { schema }) as Database)
      : nodePostgresDrizzle(new Pool({ connectionString: url }), { schema });
  }
  return cached;
}

export async function pingDatabase(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function getAppMetaValue(key: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ value: schema.appMeta.value })
    .from(schema.appMeta)
    .where(eq(schema.appMeta.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setAppMetaValue(
  key: string,
  value: string,
): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL not configured");
  }
  await db
    .insert(schema.appMeta)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.appMeta.key,
      set: { value, updatedAt: sql`now()` },
    });
}

export { schema };
export * from "./schema";
