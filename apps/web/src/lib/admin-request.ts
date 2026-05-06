import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export async function isAdminRequestAuthorized(request?: Request): Promise<boolean> {
  void request;
  if (!adminAuthConfigured()) return true;
  const jar = await cookies();
  return verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}
