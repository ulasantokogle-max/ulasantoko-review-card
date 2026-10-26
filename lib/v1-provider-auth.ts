import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const PROVIDER_COOKIE = "v1_provider_session";
const MAX_AGE = 60 * 60 * 8;

function signature(payload: string, key: string) {
  return createHmac("sha256", key).update("v1-provider:" + payload).digest("base64url");
}

export function createProviderSession(): string {
  const key = process.env.ADMIN_KEY;
  if (!key) throw new Error("Provider secret is not configured");
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return exp + "." + signature(exp, key);
}

export function isProviderAuthenticated(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  const token = req.cookies.get(PROVIDER_COOKIE)?.value;
  if (!key || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d{10,12}$/.test(parts[0])) return false;
  const exp = Number(parts[0]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(exp) || exp <= now || exp > now + MAX_AGE) return false;
  const expected = Buffer.from(signature(parts[0], key));
  const supplied = Buffer.from(parts[1]);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export const providerCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const, path: "/",
  maxAge: MAX_AGE,
};
