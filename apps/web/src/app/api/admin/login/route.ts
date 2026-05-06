import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthConfigured,
  constantTimeStringEqual,
  signAdminSession,
} from "@/lib/admin-session";

export async function POST(request: Request) {
  if (!adminAuthConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "Admin login is disabled. Set ADMIN_USERNAME and ADMIN_PASSWORD on the server.",
      },
      { status: 400 },
    );
  }

  const expectedUser = (process.env.ADMIN_USERNAME ?? "").trim();
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const rec = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const username = typeof rec.username === "string" ? rec.username.trim() : "";
  const password = typeof rec.password === "string" ? rec.password : "";

  const userOk = constantTimeStringEqual(username, expectedUser);
  const passOk = constantTimeStringEqual(password, expectedPass);
  if (!userOk || !passOk) {
    return Response.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
  }

  let token: string;
  try {
    token = signAdminSession();
  } catch {
    return Response.json({ ok: false, error: "Session error" }, { status: 500 });
  }

  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return Response.json({ ok: true });
}
