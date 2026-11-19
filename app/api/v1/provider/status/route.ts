import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { hasDedicatedV1Database, v1SupabaseServer } from "@/lib/v1-supabase";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

type Check = { ok: boolean; label: string; detail: string };
function checks(configured: boolean, connected: boolean, imported: boolean): Check[] {
  return [
    {
      ok: configured,
      label: "Koneksi Supabase khusus V1",
      detail: configured
        ? "Konfigurasi hosting V1 ditemukan."
        : "Hosting belum memiliki V1_SUPABASE_URL dan V1_SUPABASE_SERVICE_ROLE_KEY yang lengkap.",
    },
    {
      ok: connected,
      label: "Akses database V1 baru",
      detail: connected
        ? "Database V1 terhubung."
        : "Koneksi database V1 belum tersedia atau belum terverifikasi.",
    },
    {
      ok: Boolean(process.env.V1_GOOGLE_PLACES_API_KEY),
      label: "Konversi Google Maps → Direct Google Review",
      detail: process.env.V1_GOOGLE_PLACES_API_KEY
        ? "API key V1 tersedia. Kesiapan layanan Google Places masih perlu diuji dengan link nyata."
        : "V1_GOOGLE_PLACES_API_KEY belum dikonfigurasi. Link Maps tanpa Place ID tidak dapat dikonversi otomatis.",
    },
    {
      ok: imported,
      label: "Pemulihan dan audit kartu lama",
      detail: imported
        ? "Data kartu V1 lama sudah disetujui melalui migration gate."
        : "Kartu lama belum diimpor dan diverifikasi. Pembuatan kartu harus tetap dikunci.",
    },
  ];
}
export async function GET(request: NextRequest) {
  if (!isProviderAuthenticated(request)) {
    return NextResponse.json({ message: "Sesi Provider diperlukan." },
      { status: 401, headers });
  }

  const providedUrl = Boolean(process.env.V1_SUPABASE_URL);
  const providedKey = Boolean(process.env.V1_SUPABASE_SERVICE_ROLE_KEY);
  const configured = hasDedicatedV1Database();

  // Do not expose URLs, service-role keys or other environment values.
  if (!configured) {
    const reason = (providedUrl !== providedKey)
      ? "Konfigurasi Supabase V1 belum lengkap. Periksa kedua environment variables pada hosting V1."
      : "Koneksi Supabase V1 khusus belum dipasang pada hosting. Jangan membuat kartu massal dahulu.";
    return NextResponse.json({
      mode: "legacy",
      ready: false,
      cardCount: null,
      reason,
      checks: checks(false, false, false),
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
    const imported = gate.data.imported_and_verified === true;
    const count = cards.count ?? 0;
    // A malformed empty migration must not masquerade as successful recovery.
    const ready = imported && count > 0;
    return NextResponse.json({
      mode: "isolated",
      ready,
      cardCount: count,
      reason: ready
        ? "Database V1 terverifikasi. Pembuatan kartu dapat digunakan."
        : imported && count === 0
          ? "Migration gate terbuka tetapi database belum berisi kartu lama. Pembuatan kartu dikunci sampai audit ulang."
          : "Data kartu V1 lama belum dipulihkan dan diverifikasi. Bulk Create masih dikunci.",
      checks: checks(true, true, ready),
    }, { headers });
  } catch {
    return NextResponse.json({
      mode: "isolated",
      ready: false,
      cardCount: null,
      reason: "Database V1 belum dapat diperiksa. Periksa konfigurasi hosting V1 dan kondisi database.",
      checks: checks(true, false, false),
    }, { status: 503, headers });
  }
}
