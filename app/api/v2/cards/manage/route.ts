import { NextRequest, NextResponse } from "next/server";
import { ensureV2ShortLink, getV2ShortLink, v2DestinationUrl } from "@/lib/shortio";
import { createClient } from "@supabase/supabase-js";

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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function authorized(value: unknown) {
  return Boolean(adminKey) && clean(value) === adminKey!.trim();
}

function publicPath(code: string) {
  return "/" + encodeURIComponent(code);
}

function settingsPath(code: string) {
  return "/settings/" + encodeURIComponent(code);
}

function toolsPath(code: string) {
  return "/card-tools/" + encodeURIComponent(code);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!authorized(body.admin_key)) {
      return NextResponse.json(
        { ok: false, error: "Admin key tidak valid." },
        { status: 401 }
      );
    }

    const action = clean(body.action) || "list";
    const supabase = getAdminClient();

    if (action === "list") {
      const { data: cards, error: cardError } = await supabase
        .from("v2_cards")
        .select("id, card_code, business_id, status, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (cardError) throw new Error("Gagal membaca kartu V2.");

      const cardRows = cards ?? [];
      if (!cardRows.length) {
        return NextResponse.json({ ok: true, cards: [] });
      }

      const businessIds = [...new Set(cardRows.map((row) => row.business_id).filter(Boolean))];

      const [{ data: businesses, error: businessError }, { data: landings, error: landingError }] =
        await Promise.all([
          supabase
            .from("v2_businesses")
            .select("id, business_name, google_maps_url, google_review_url, logo_url, status")
            .in("id", businessIds),
          supabase
            .from("v2_landing_pages")
            .select("card_id, title, headline, is_active")
            .in("card_id", cardRows.map((row) => row.id)),
        ]);

      if (businessError) throw new Error("Gagal membaca data bisnis V2.");
      if (landingError) throw new Error("Gagal membaca landing page V2.");

      const businessMap = new Map((businesses ?? []).map((item) => [item.id, item]));
      const landingMap = new Map((landings ?? []).map((item) => [item.card_id, item]));

      const result = await Promise.all(cardRows.map(async (card) => {
        const business = businessMap.get(card.business_id);
        const landing = landingMap.get(card.id);
        const businessName = clean(business?.business_name);
        const cardActive = card.status === "active";
        const businessActive = business?.status === "active";
        const landingActive = landing?.is_active !== false;

        let shortLinkReady = false;
        try {
          const short = await getV2ShortLink(card.card_code);
          shortLinkReady = Boolean(short && short.originalURL === v2DestinationUrl(card.card_code));
        } catch {
          shortLinkReady = false;
        }

        return {
          id: card.id,
          card_code: card.card_code,
          status: cardActive && businessActive && landingActive ? "active" : "inactive",
          card_status: card.status,
          business_status: business?.status ?? "unknown",
          landing_active: landingActive,
          business_name: businessName || "Belum diatur",
          configured: Boolean(businessName),
          review_ready: Boolean(business?.google_review_url),
          short_link_ready: shortLinkReady,
          logo_url: business?.logo_url ?? null,
          created_at: card.created_at,
          updated_at: card.updated_at,
          public_path: publicPath(card.card_code),
          settings_path: settingsPath(card.card_code),
          tools_path: toolsPath(card.card_code),
        };
      }));

      return NextResponse.json({ ok: true, cards: result });
    }

    if (action === "status") {
      const code = clean(body.card_code).toUpperCase();

      if (!/^LP\d{5}$/.test(code)) {
        return NextResponse.json(
          { ok: false, error: "Format kode V2 tidak valid." },
          { status: 400 }
        );
      }

      const requestedStatus = clean(body.status);
      if (requestedStatus !== "active" && requestedStatus !== "inactive") {
        return NextResponse.json(
          { ok: false, error: "Status hanya active atau inactive." },
          { status: 400 }
        );
      }

      const { data: card, error: readError } = await supabase
        .from("v2_cards")
        .select("id, card_code")
        .eq("card_code", code)
        .maybeSingle();

      if (readError) throw new Error("Gagal membaca kartu V2.");
      if (!card) {
        return NextResponse.json(
          { ok: false, error: "Kartu V2 tidak ditemukan." },
          { status: 404 }
        );
      }

      const { error: updateError } = await supabase
        .from("v2_cards")
        .update({
          status: requestedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id);

      if (updateError) throw new Error("Gagal mengubah status kartu V2.");

      return NextResponse.json({
        ok: true,
        card_code: card.card_code,
        status: requestedStatus,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Action V2 tidak dikenal." },
      { status: 400 }
    );
  } catch (error) {
    console.error("V2_CARDS_MANAGE_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Request tidak dapat diproses.",
      },
      { status: 500 }
    );
  }
}
