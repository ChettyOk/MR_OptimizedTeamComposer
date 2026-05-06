import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function POST() {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
  return Response.json({ ok: true });
}
