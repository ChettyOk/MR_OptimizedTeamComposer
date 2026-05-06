import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export async function isAdminRequestAuthorized(): Promise<boolean> {
  if (!adminAuthConfigured()) return true;
  const jar = await cookies();
  return verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}
