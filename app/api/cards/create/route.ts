import { NextRequest, NextResponse } from "next/server";
import { v1SupabaseServer, hasDedicatedV1Database, canIssueNewV1Cards } from "@/lib/v1-supabase";
import { checkV1RateLimit } from "@/lib/v1-rate-limit";
import { hashActivationPin, generateActivationPin } from "@/lib/pin";
import { randomInt } from "node:crypto";

export const dynamic = "force-dynamic";

const adminKey = process.env.ADMIN_KEY;

function getSupabase() {
  return v1SupabaseServer();
}

function generateCardCode() {
  const number = randomInt(10000, 100000);
  return `ULAS-${number}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const receivedAdminKey = String(body.admin_key ?? "").trim();
    const cardCodeInput = String(body.card_code ?? "").trim().toUpperCase();

    const supabase = getSupabase();
    if (!(await checkV1RateLimit(supabase, request, "create"))) {
      return NextResponse.json({success:false,message:"Terlalu banyak percobaan atau keamanan sementara tidak tersedia."},{status:429,headers:{"Retry-After":"900"}});
    }

    if (!adminKey) {
      return NextResponse.json(
        {
          success: false,
          message: "ADMIN_KEY belum dikonfigurasi di server.",
        },
        { status: 500 }
      );
    }

    if (receivedAdminKey !== adminKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin key tidak valid.",
        },
        { status: 401 }
      );
    }


    // Keep existing legacy behavior until V1-only environment is installed.
    // In isolated mode, never issue cards before migration is verified.
    if (hasDedicatedV1Database() && !(await canIssueNewV1Cards())) {
      return NextResponse.json({success:false,message:"Database V1 baru belum siap untuk penerbitan kartu."},
        {status:503,headers:{"Cache-Control":"no-store"}});
    }
    let cardCode = cardCodeInput;

    if (cardCode && !/^ULAS-\d{5,}$/.test(cardCode)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format kode kartu tidak valid.",
        },
        { status: 400 }
      );
    }

    // Dedicated V1: allocate sequentially through the same atomic RPC as
    // Provider Bulk Create. Never use the legacy random-code allocator here.
    if (!cardCode && hasDedicatedV1Database()) {
      const pin = generateActivationPin();
      const { data, error } = await supabase.rpc("v1_bulk_create_cards", {
        p_pin_hashes: [hashActivationPin(pin)],
      });
      if (error || !Array.isArray(data) || data.length !== 1 ||
          typeof data[0]?.card_code !== "string") {
        return NextResponse.json({
          success: false, message: "Pembuatan kartu V1 belum siap. Periksa koneksi database.",
        }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({
        success: true, message: "Kartu berhasil dibuat.",
        card_code: data[0].card_code,
        activation_pin: pin,
        status: "inactive",
      }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    let attempts = 0;

    while (!cardCode && attempts < 10) {
      const candidate = generateCardCode();

      const { data: existing } = await supabase
        .from("cards")
        .select("id")
        .eq("card_code", candidate)
        .maybeSingle();

      if (!existing) {
        cardCode = candidate;
        break;
      }

      attempts++;
    }

    if (!cardCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Gagal membuat kode kartu unik.",
        },
        { status: 500 }
      );
    }

    const { data: existingCard } = await supabase
      .from("cards")
      .select("id")
      .eq("card_code", cardCode)
      .maybeSingle();

    if (existingCard) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode kartu sudah digunakan.",
        },
        { status: 409 }
      );
    }

    const activationPin = generateActivationPin();
    const activationPinHash = hashActivationPin(activationPin);

    const { data: card, error } = await supabase
      .from("cards")
      .insert({
        card_code: cardCode,
        activation_pin_hash: activationPinHash,
        status: "inactive",
      })
      .select("id, card_code, status")
      .single();

    if (error) {
      console.error("CARD_CREATE_ERROR", error);

      return NextResponse.json(
        {
          success: false,
          message: "Kartu gagal dibuat. Hubungi administrator.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Kartu berhasil dibuat.",
        card_code: card.card_code,
        activation_pin: activationPin,
        status: card.status,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("CREATE_CARD_ROUTE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Request tidak dapat diproses.",
      },
      { status: 500 }
    );
  }
}
