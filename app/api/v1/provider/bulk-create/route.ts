import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { checkV1RateLimit } from "@/lib/v1-rate-limit";
import { generateActivationPin, hashActivationPin } from "@/lib/pin";
import { v1SupabaseServer, canIssueNewV1Cards } from "@/lib/v1-supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!isProviderAuthenticated(request)) {
    return NextResponse.json({ message: "Login Provider diperlukan." }, { status: 401, headers: noStore });
  }
  let count: number;
  try {
    const body = await request.json();
    count = body.count;
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error();
  } catch {
    return NextResponse.json({ message: "Jumlah harus 1–100 kartu." }, { status: 400, headers: noStore });
  }
  try {
    const db = v1SupabaseServer();
    if (!await checkV1RateLimit(db, request, "create")) {
      return NextResponse.json({ message: "Limit percobaan tercapai atau layanan database belum tersedia." },
        { status: 429, headers: { ...noStore, "Retry-After": "900" } });
    }
    if (!await canIssueNewV1Cards()) {
      return NextResponse.json({message:"Data kartu V1 lama belum diimpor dan diverifikasi. Bulk Create masih dikunci."},{status:503,headers:noStore});
    }
    const uniquePins = new Set<string>();
    while (uniquePins.size < count) uniquePins.add(generateActivationPin());
    const pins = Array.from(uniquePins);
    const { data, error } = await db.rpc("v1_bulk_create_cards", { p_pin_hashes: pins.map(hashActivationPin) });
    if (error) {
      console.error("V1_BULK_CREATE_ERROR", error.code);
      return NextResponse.json({ message: "Bulk Create belum siap. Periksa migrasi database khusus V1." },
        { status: 503, headers: noStore });
    }
    const rows = (data || []) as { card_code: string }[];
    if (rows.length !== count) {
      return NextResponse.json({ message: "Hasil batch tidak sesuai. Jangan coba ulang sebelum audit data." },
        { status: 500, headers: noStore });
    }
    return NextResponse.json({
      cards: rows.map((row, i) => ({
        card_code: row.card_code,
        activation_pin: pins[i],
        url: "https://app.ulasantoko.space/r-v1/" + encodeURIComponent(row.card_code),
      })),
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "Database V1 tidak tersedia." }, { status: 503, headers: noStore });
  }
}
