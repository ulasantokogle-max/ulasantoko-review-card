import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { v1SupabaseServer } from "@/lib/v1-supabase";
import { getV1RateLimitStatus } from "@/lib/v1-rate-limit";
import { PROVIDER_COOKIE, createProviderSession, isProviderAuthenticated, providerCookieOptions } from "@/lib/v1-provider-auth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isProviderAuthenticated(request) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = typeof body?.admin_key === "string" ? body.admin_key.trim() : "";
    const secret = process.env.ADMIN_KEY;

    if (!secret) {
      return NextResponse.json({
        message: "Admin Key Provider belum dikonfigurasi pada server V1.",
      }, { status: 503, headers: noStore });
    }
    if (!input) {
      return NextResponse.json({ message: "Masukkan Admin Key Provider." },
        { status: 400, headers: noStore });
    }

    const digest = (value: string) =>
      createHmac("sha256", "v1-auth-compare").update(value).digest();
    const validAdminKey = timingSafeEqual(digest(input), digest(secret));

    // A correctly authenticated Provider must not be locked out because
    // the legacy card database is paused. The session is signed by ADMIN_KEY;
    // card operations still independently enforce the V1 migration gate.
    if (validAdminKey) {
      const response = NextResponse.json({ authenticated: true }, { headers: noStore });
      response.cookies.set(PROVIDER_COOKIE, createProviderSession(), providerCookieOptions);
      return response;
    }

    // Only failed logins consume the persistent login-specific rate limit.
    // RPC failures are infrastructure errors (503), not "too many attempts" (429).
    const throttle = await getV1RateLimitStatus(v1SupabaseServer(), request, "login");
    if (throttle === "unavailable") {
      return NextResponse.json({
        message: "Pemeriksaan keamanan login V1 sementara tidak tersedia. Periksa koneksi database V1.",
      }, { status: 503, headers: noStore });
    }
    if (throttle === "limited") {
      return NextResponse.json({ message: "Batas percobaan login tercapai. Coba lagi nanti." },
        { status: 429, headers: { ...noStore, "Retry-After": "900" } });
    }
    return NextResponse.json({ message: "Admin Key Provider tidak cocok." },
      { status: 401, headers: noStore });
  } catch {
    return NextResponse.json({
      message: "Login Provider V1 belum tersedia. Periksa konfigurasi server.",
    }, { status: 503, headers: noStore });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  response.cookies.set(PROVIDER_COOKIE, "", { ...providerCookieOptions, maxAge: 0 });
  return response;
}
