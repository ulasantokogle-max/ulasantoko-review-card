import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { canIssueNewV1Cards, hasDedicatedV1Database, v1SupabaseServer } from "@/lib/v1-supabase";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!isProviderAuthenticated(request)) {
    return NextResponse.json({ message: "Sesi Provider diperlukan." }, { status: 401, headers });
  }
  if (!hasDedicatedV1Database() || !(await canIssueNewV1Cards())) {
    return NextResponse.json({
      message: "Database V1 belum dipulihkan dan diverifikasi. Desain cetak massal masih terkunci.",
    }, { status: 503, headers });
  }
  let codes: string[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.codes) || body.codes.length < 1 || body.codes.length > 200) throw new Error();
    codes = body.codes;
    if (codes.some(c => typeof c !== "string" || !/^ULAS-\d{5,}$/.test(c))
        || new Set(codes).size !== codes.length) throw new Error();
  } catch {
    return NextResponse.json({ message: "Daftar kode kartu V1 tidak valid (maksimum 200)." }, { status: 400, headers });
  }
  try {
    const { data, error } = await v1SupabaseServer().from("cards")
      .select("card_code").in("card_code", codes);
    if (error) throw new Error(error.code);
    const found = new Set((data || []).map(row => row.card_code));
    const missing = codes.filter(code => !found.has(code));
    if (missing.length) {
      return NextResponse.json({
        message: "Ada kode yang tidak terdaftar pada V1. Batalkan cetak dan gunakan CSV khusus V1.",
        unknownCount: missing.length,
      }, { status: 409, headers });
    }
    return NextResponse.json({ valid: true, count: codes.length }, { headers });
  } catch {
    return NextResponse.json({ message: "Validasi database V1 gagal. Cetak dibatalkan." }, { status: 503, headers });
  }
}
