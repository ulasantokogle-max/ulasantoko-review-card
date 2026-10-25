import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServerClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cardCode = String(body.card_code ?? "").trim().toUpperCase();
    const pin = String(body.pin ?? "").trim();

    if (!/^LP\d{5}$/.test(cardCode)) {
      return NextResponse.json({ message: "Kode card tidak valid." }, { status: 400 });
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ message: "PIN harus 6 digit." }, { status: 400 });
    }

    const supabase = getServerClient();
    const { data, error } = await supabase.rpc("v2_activate_card", {
      p_card_code: cardCode,
      p_pin: pin,
    });

    if (error) {
      const code = error.message;
      if (code.includes("card_not_found")) {
        return NextResponse.json({ message: "Card tidak ditemukan." }, { status: 404 });
      }
      if (code.includes("card_blocked")) {
        return NextResponse.json({ message: "Card sedang diblokir." }, { status: 403 });
      }
      if (code.includes("invalid_pin")) {
        return NextResponse.json({ message: "PIN aktivasi salah." }, { status: 401 });
      }

      console.error("V2_ACTIVATE_ERROR:", error);
      return NextResponse.json({ message: "Aktivasi card gagal." }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("V2_ACTIVATE_POST_ERROR:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server." }, { status: 500 });
  }
}
