import { NextRequest, NextResponse } from "next/server";
import { v1SupabaseServer, canIssueNewV1Cards, hasDedicatedV1Database } from "@/lib/v1-supabase";
import { checkV1RateLimit } from "@/lib/v1-rate-limit";
import { hashActivationPin, generateActivationPin } from "@/lib/pin";
import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
function adminKeyMatches(provided: string, configured: string): boolean {
  const digest = (s: string) => createHmac("sha256", "v1-admin-key-compare").update(s).digest();
  return timingSafeEqual(digest(provided), digest(configured));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const receivedAdminKey = String(body.admin_key ?? "").trim();
    const cardCodeInput = String(body.card_code ?? "").trim().toUpperCase();

    if (!hasDedicatedV1Database()) {
      return NextResponse.json({success:false,message:"Koneksi database khusus V1 belum diatur. Pembuatan kartu ditahan agar data sistem lama tetap aman."},
        {status:503,headers:noStore});
    }
    const supabase = v1SupabaseServer();
    if (!(await checkV1RateLimit(supabase, request, "create"))) {
      return NextResponse.json({success:false,message:"Terlalu banyak percobaan atau keamanan sementara tidak tersedia."},{status:429,headers:{"Retry-After":"900"}});
    }

    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      return NextResponse.json(
        {
          success: false,
          message: "ADMIN_KEY belum dikonfigurasi di server.",
        },
        { status: 500, headers: noStore }
      );
    }

    if (!adminKeyMatches(receivedAdminKey, adminKey)) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin key tidak valid.",
        },
        { status: 401, headers: noStore }
      );
    }


    if (!await canIssueNewV1Cards()) {
      return NextResponse.json({success:false,message:"Migrasi data kartu V1 belum terverifikasi."},{status:503,headers:noStore});
    }

    if (cardCodeInput && !/^ULAS-\d{5,}$/.test(cardCodeInput)) {
      return NextResponse.json({success:false,message:"Format kode kartu tidak valid."},
        {status:400,headers:noStore});
    }

    const activationPin = generateActivationPin();
    const activationPinHash = hashActivationPin(activationPin);

    if (!cardCodeInput) {
      // Same atomic sequential allocator as V1 Bulk Create. Avoid random
      // codes, gaps caused by collisions and duplicate code races.
      const {data,error} = await supabase.rpc("v1_bulk_create_cards",{
        p_pin_hashes:[activationPinHash],
      });
      if (error || !Array.isArray(data) || data.length !== 1 ||
          typeof data[0]?.card_code !== "string") {
        console.error("V1_SINGLE_RPC_ERROR",error?.code ?? "unexpected_result");
        return NextResponse.json({success:false,message:"Pembuatan kartu belum siap. Periksa database V1."},
          {status:503,headers:noStore});
      }
      return NextResponse.json({
        success:true,message:"Kartu berhasil dibuat.",
        card_code:data[0].card_code,activation_pin:activationPin,status:"inactive",
      },{status:201,headers:noStore});
    }

    // Preserve manual-code workflow for legacy V1 print stock.
    // The database UNIQUE constraint is the final concurrency guard.
    const {data: existingCard,error: lookupError} = await supabase.from("cards")
      .select("id").eq("card_code",cardCodeInput).maybeSingle();
    if (lookupError) {
      return NextResponse.json({success:false,message:"Pengecekan kode kartu V1 gagal."},
        {status:503,headers:noStore});
    }
    if (existingCard) {
      return NextResponse.json({success:false,message:"Kode kartu sudah digunakan."},
        {status:409,headers:noStore});
    }
    const {data:card,error:insertError} = await supabase.from("cards")
      .insert({card_code:cardCodeInput,activation_pin_hash:activationPinHash,status:"inactive"})
      .select("card_code,status").single();
    if (insertError || !card) {
      if (insertError?.code === "23505") {
        return NextResponse.json({success:false,message:"Kode kartu sudah digunakan."},
          {status:409,headers:noStore});
      }
      console.error("V1_SINGLE_INSERT_ERROR",insertError?.code);
      return NextResponse.json({success:false,message:"Kartu gagal dibuat. Periksa database V1."},
        {status:503,headers:noStore});
    }
    return NextResponse.json({
      success:true,message:"Kartu berhasil dibuat.",
      card_code:card.card_code,activation_pin:activationPin,status:card.status,
    },{status:201,headers:noStore});
  } catch (error) {
    console.error("CREATE_CARD_ROUTE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Request tidak dapat diproses.",
      },
      { status: 500, headers: noStore }
    );
  }
}
