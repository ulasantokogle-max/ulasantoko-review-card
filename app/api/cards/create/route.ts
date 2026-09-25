import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashActivationPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminKey = process.env.ADMIN_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function generateCardCode() {
  const number = Math.floor(10000 + Math.random() * 90000);
  return `ULAS-${number}`;
}

function generateActivationPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const receivedAdminKey = String(body.admin_key ?? "").trim();
    const cardCodeInput = String(body.card_code ?? "").trim().toUpperCase();

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
          message: "Kartu gagal dibuat.",
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
      { status: 201 }
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
