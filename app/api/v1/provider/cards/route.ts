import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { supabaseServer } from "@/lib/supabase";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!isProviderAuthenticated(req)) {
    return NextResponse.json({ message: "Sesi Provider berakhir." }, { status: 401, headers });
  }
  const code = (new URL(req.url).searchParams.get("card_code") || "").trim().toUpperCase();
  if (!/^ULAS-\d{5,}$/.test(code)) {
    return NextResponse.json({ message: "Masukkan kode kartu yang valid." }, { status: 400, headers });
  }
  try {
    const { data, error } = await supabaseServer().from("cards")
      .select("card_code,status,business_name").eq("card_code", code).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Kartu tidak ditemukan." }, { status: 404, headers });
    // Never return activation PIN/hash or private user data.
    return NextResponse.json({ card: data }, { headers });
  } catch {
    return NextResponse.json({ message: "Pencarian kartu gagal." }, { status: 503, headers });
  }
}
