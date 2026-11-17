import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { hasDedicatedV1Database, v1SupabaseServer } from "@/lib/v1-supabase";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  if (!isProviderAuthenticated(request)) {
    return NextResponse.json({ message: "Sesi Provider diperlukan." }, { status: 401, headers });
  }
  if (!hasDedicatedV1Database()) {
    return NextResponse.json({
      mode: "legacy", ready: false,
      reason: "Koneksi Supabase V1 khusus belum dipasang pada hosting. Jangan membuat kartu massal dahulu.",
    }, { headers });
  }

  try {
    const client = v1SupabaseServer();
    const [gate, cards] = await Promise.all([
      client.from("v1_migration_gate")
        .select("imported_and_verified")
        .eq("singleton", true)
        .maybeSingle(),
      client.from("cards").select("id", { head: true, count: "exact" }),
    ]);
    if (gate.error || cards.error || !gate.data) throw new Error("V1 database not ready");
    const ready = gate.data.imported_and_verified === true;
    return NextResponse.json({
      mode: "isolated", ready,
      cardCount: cards.count ?? 0,
      reason: ready ? "Data V1 sudah disetujui untuk operasi." : "Menunggu pemulihan dan verifikasi kartu V1 lama. Bulk Create terkunci.",
    }, { headers });
  } catch {
    return NextResponse.json({
      mode: "isolated", ready: false,
      reason: "Status database V1 belum tersedia. Jangan buat kartu.",
    }, { status: 503, headers });
  }
}
