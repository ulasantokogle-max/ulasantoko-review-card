import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseServer } from "@/lib/supabase";
import { checkV1RateLimit } from "@/lib/v1-rate-limit";
import { PROVIDER_COOKIE, createProviderSession, isProviderAuthenticated, providerCookieOptions } from "@/lib/v1-provider-auth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isProviderAuthenticated(request) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  try {
    // Reuse persistent fail-closed create throttling; do not log passwords.
    if (!await checkV1RateLimit(supabaseServer(), request, "create")) {
      return NextResponse.json({ message: "Terlalu banyak percobaan. Coba nanti." }, { status: 429, headers: noStore });
    }
    const body = await request.json();
    const input = typeof body.admin_key === "string" ? body.admin_key.trim() : "";
    const secret = process.env.ADMIN_KEY;
    if (!secret || !input) return NextResponse.json({ message: "Login gagal." }, { status: 401, headers: noStore });
    const digest = (s: string) => createHmac("sha256", "v1-auth-compare").update(s).digest();
    if (!timingSafeEqual(digest(input), digest(secret))) {
      return NextResponse.json({ message: "Login gagal." }, { status: 401, headers: noStore });
    }
    const response = NextResponse.json({ authenticated: true }, { headers: noStore });
    response.cookies.set(PROVIDER_COOKIE, createProviderSession(), providerCookieOptions);
    return response;
  } catch {
    return NextResponse.json({ message: "Login belum tersedia." }, { status: 503, headers: noStore });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  response.cookies.set(PROVIDER_COOKIE, "", { ...providerCookieOptions, maxAge: 0 });
  return response;
}
