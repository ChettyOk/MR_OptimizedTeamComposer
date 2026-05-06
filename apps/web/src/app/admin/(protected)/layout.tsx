import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

/** Always run auth on the server; avoids static prerender skipping the cookie check. */
export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  if (!adminAuthConfigured()) {
    return children;
  }
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    redirect("/admin/login");
  }
  return children;
}
