import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "tc_admin_session";

/** Both must be set (non-empty) to require sign-in for /admin and /api/admin/*. */
export function adminAuthConfigured(): boolean {
  const u = (process.env.ADMIN_USERNAME ?? "").trim();
  const p = process.env.ADMIN_PASSWORD ?? "";
  return u.length > 0 && p.length > 0;
}

function sessionSigningSecret(): string {
  if (!adminAuthConfigured()) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are not both set");
  }
  const u = (process.env.ADMIN_USERNAME ?? "").trim();
  const p = process.env.ADMIN_PASSWORD ?? "";
  return createHash("sha256")
    .update(`tc-admin-session-v1\0${u}\0${p}`, "utf8")
    .digest("hex");
}

/** Constant-time string compare via SHA-256 digests (same length). */
export function constantTimeStringEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(createHash("sha256").update(a, "utf8").digest(), createHash("sha256").update(b, "utf8").digest());
  } catch {
    return false;
  }
}

export function signAdminSession(): string {
  const secret = sessionSigningSecret();
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  if (!adminAuthConfigured()) return false;
  let secret: string;
  try {
    secret = sessionSigningSecret();
  } catch {
    return false;
  }
  const i = token.indexOf(".");
  if (i <= 0 || i === token.length - 1) return false;
  const payloadB64 = token.slice(0, i);
  const sigB64 = token.slice(i + 1);
  let expected: Buffer;
  let got: Buffer;
  try {
    expected = createHmac("sha256", secret).update(payloadB64).digest();
    got = Buffer.from(sigB64, "base64url");
  } catch {
    return false;
  }
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return false;
  }
  try {
    const json = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof json.exp !== "number" || json.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
