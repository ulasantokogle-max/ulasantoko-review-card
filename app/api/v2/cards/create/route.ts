import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateActivationPin, hashActivationPin } from "@/lib/pin";
import { ensureV2ShortLink } from "@/lib/shortio";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminKey = process.env.ADMIN_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server configuration belum lengkap.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

async function nextCardCode(supabase: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabase
    .from("v2_cards")
    .select("card_code")
    .like("card_code", "LP%");

  if (error) throw new Error("Gagal membaca kode kartu V2.");

  let max = 100;
  for (const row of data ?? []) {
    const match = String(row.card_code ?? "").match(/^LP(\d{5})$/);
    if (match) max = Math.max(max, Number(match[1]));
  }

  const candidate = max + 1;
  if (candidate > 99999) throw new Error("Nomor kode kartu V2 sudah penuh.");
  return `LP${String(candidate).padStart(5, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const receivedAdminKey = normalizeCode(body.admin_key);
    const requestedCode = normalizeCode(body.card_code);

    if (!adminKey) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_KEY belum dikonfigurasi di server." },
        { status: 500 }
      );
    }

    if (receivedAdminKey !== adminKey.trim()) {
      return NextResponse.json(
        { ok: false, error: "Admin key tidak valid." },
        { status: 401 }
      );
    }

    if (requestedCode && !/^LP\d{5}$/.test(requestedCode)) {
      return NextResponse.json(
        { ok: false, error: "Format kode V2 harus seperti LP00101." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    let cardCode = requestedCode || "";

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = cardCode || await nextCardCode(supabase);

      const { data: existing } = await supabase
        .from("v2_cards")
        .select("id")
        .eq("card_code", candidate)
        .maybeSingle();

      if (existing) {
        if (requestedCode) {
          return NextResponse.json(
            { ok: false, error: "Kode kartu V2 sudah digunakan." },
            { status: 409 }
          );
        }
        cardCode = "";
        continue;
      }

      const activationPin = generateActivationPin();
      const activationPinHash = hashActivationPin(activationPin);

      const { data: business, error: businessError } = await supabase
        .from("v2_businesses")
        .insert({
          business_code: candidate,
          business_name: "",
          status: "active",
        })
        .select("id, business_code, business_name, status")
        .single();

      if (businessError) {
        console.error("V2_BUSINESS_CREATE_ERROR", businessError);
        return NextResponse.json(
          { ok: false, error: "Gagal membuat data bisnis V2." },
          { status: 500 }
        );
      }

      const { data: card, error: cardError } = await supabase
        .from("v2_cards")
        .insert({
          card_code: candidate,
          business_id: business.id,
          activation_pin_hash: activationPinHash,
          status: "active",
        })
        .select("id, card_code, status, business_id")
        .single();

      if (cardError) {
        await supabase.from("v2_businesses").delete().eq("id", business.id);

        if (cardError.code === "23505" && !requestedCode) {
          cardCode = "";
          continue;
        }

        console.error("V2_CARD_CREATE_ERROR", cardError);
        return NextResponse.json(
          { ok: false, error: "Gagal membuat kartu V2." },
          { status: 500 }
        );
      }

      const { error: landingError } = await supabase
        .from("v2_landing_pages")
        .insert({
          card_id: card.id,
          lp_slug: candidate,
          template_key: "lp002",
          title: "",
          headline: "TERIMA KASIH SUDAH BERKUNJUNG",
          description: "Bagikan pengalaman Anda dan bantu kami memberikan pelayanan terbaik.",
          review_enabled: true,
          complaint_enabled: true,
          feedback_enabled: true,
          is_active: true,
          settings: {},
        });

      if (landingError) {
        await supabase.from("v2_cards").delete().eq("id", card.id);
        await supabase.from("v2_businesses").delete().eq("id", business.id);
        console.error("V2_LANDING_CREATE_ERROR", landingError);
        return NextResponse.json(
          { ok: false, error: "Gagal membuat landing page V2." },
          { status: 500 }
        );
      }

      const { error: qrError } = await supabase
        .from("v2_qr_configs")
        .insert({
          card_id: card.id,
          target_path: "/" + candidate,
          qr_style: { errorCorrectionLevel: "H", margin: 2 },
        });

      if (qrError) {
        await supabase.from("v2_cards").delete().eq("id", card.id);
        await supabase.from("v2_businesses").delete().eq("id", business.id);
        console.error("V2_QR_CONFIG_CREATE_ERROR", qrError);
        return NextResponse.json(
          { ok: false, error: "Gagal membuat konfigurasi QR V2." },
          { status: 500 }
        );
      }

      let shortLink: string | null = null;
      let shortLinkError: string | null = null;

      try {
        const short = await ensureV2ShortLink(card.card_code, "Ulasan Toko V2 " + card.card_code);
        shortLink = short.shortURL;
      } catch (error) {
        shortLinkError = error instanceof Error ? error.message : "Short.io link gagal dibuat.";
        console.error("V2_SHORTLINK_CREATE_WARNING", error);
      }

      return NextResponse.json({
        ok: true,
        card_code: card.card_code,
        activation_pin: activationPin,
        status: card.status,
        public_path: "/" + card.card_code,
        settings_path: "/settings/" + card.card_code,
        tools_path: "/card-tools/" + card.card_code,
        short_url: shortLink,
        short_link_error: shortLinkError,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Gagal mendapatkan kode kartu V2 unik." },
      { status: 500 }
    );
  } catch (error) {
    console.error("V2_CREATE_CARD_ERROR", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Request tidak dapat diproses.",
      },
      { status: 500 }
    );
  }
}
