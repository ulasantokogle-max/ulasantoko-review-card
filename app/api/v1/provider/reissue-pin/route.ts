import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { v1SupabaseServer, hasDedicatedV1Database, canIssueNewV1Cards } from "@/lib/v1-supabase";
import { getV1RateLimitStatus } from "@/lib/v1-rate-limit";
import { generateActivationPin, hashActivationPin } from "@/lib/pin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

// Provider-only recovery. NEVER return existing PIN/hash and NEVER bypass PIN checks.
export async function POST(req: NextRequest) {
  if (!isProviderAuthenticated(req)) {
    return NextResponse.json({ message: "Login Provider V1 diperlukan." }, { status: 401, headers });
  }
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) {
    return NextResponse.json({ message: "Permintaan tidak berasal dari halaman Provider ini." }, { status: 403, headers });
  }
  if (!hasDedicatedV1Database() || !(await canIssueNewV1Cards())) {
    return NextResponse.json({ message: "Pemulihan PIN membutuhkan database V1 khusus yang terverifikasi." }, { status: 503, headers });
  }

  let code = "";
  try {
    const body = await req.json();
    code = typeof body.card_code === "string" ? body.card_code.trim().toUpperCase() : "";
    const confirmation = typeof body.confirm_card_code === "string" ? body.confirm_card_code.trim().toUpperCase() : "";
    if (!/^ULAS-\d{4,}$/.test(code) || confirmation !== code) {
      return NextResponse.json({ message: "Konfirmasi kode kartu tidak sesuai." }, { status: 400, headers });
    }
  } catch {
    return NextResponse.json({ message: "Data permintaan tidak valid." }, { status: 400, headers });
  }

  try {
    const db = v1SupabaseServer();
    const limit = await getV1RateLimitStatus(db, req, "create");
    if (limit !== "allowed") {
      return NextResponse.json(
        { message: limit === "limited" ? "Batas permintaan tercapai. Coba lagi nanti." : "Sistem pembatasan permintaan tidak tersedia." },
        { status: limit === "limited" ? 429 : 503, headers }
      );
    }
    // One-time randomly generated PIN; atomically rotate only inactive cards.
    const pin = generateActivationPin();
    const pinHash = hashActivationPin(pin);
    const { data, error } = await db.from("cards")
      .update({ activation_pin_hash: pinHash, updated_at: new Date().toISOString() })
      .eq("card_code", code)
      .eq("status", "inactive")
      .select("card_code,status")
      .maybeSingle();
    if (error) {
      console.error("V1_PROVIDER_PIN_REISSUE_ERROR", error.code);
      return NextResponse.json({ message: "PIN baru gagal diterbitkan." }, { status: 503, headers });
    }
    if (!data) return NextResponse.json({ message: "Kartu tidak ditemukan atau sudah aktif. Tidak ada PIN yang diganti." }, { status: 409, headers });
    return NextResponse.json({
      message: "PIN baru berhasil diterbitkan. PIN sebelumnya tidak berlaku lagi.",
      card_code: data.card_code,
      activation_pin: pin,
    }, { headers });
  } catch {
    return NextResponse.json({ message: "Layanan V1 tidak tersedia." }, { status: 503, headers });
  }
}
