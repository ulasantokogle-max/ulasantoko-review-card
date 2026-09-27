import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminKey = process.env.ADMIN_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isAuthorized(request: NextRequest) {
  if (!adminKey) return false;
  const supplied = request.headers.get("x-admin-key")?.trim();
  return Boolean(supplied) && supplied === adminKey;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const businessName = String(body.business_name ?? "").trim();
    const googleReviewUrl = String(body.google_review_url ?? "").trim();
    const googlePlaceId = String(body.google_place_id ?? "").trim();
    const logoUrl = String(body.logo_url ?? "").trim();
    const address = String(body.address ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const title = String(body.title ?? "").trim();
    const headline = String(body.headline ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!businessName) {
      return NextResponse.json(
        { message: "Nama bisnis wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase.rpc("v2_create_card", {
      p_business_name: businessName,
      p_google_review_url: googleReviewUrl || null,
      p_google_place_id: googlePlaceId || null,
      p_logo_url: logoUrl || null,
      p_address: address || null,
      p_phone: phone || null,
      p_title: title || null,
      p_headline: headline || null,
      p_description: description || null,
    });

    if (error) {
      console.error("V2_CREATE_CARD_ERROR:", error);
      return NextResponse.json(
        { message: "Card V2 gagal dibuat.", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, card: data });
  } catch (error) {
    console.error("V2_CREATE_CARD_POST_ERROR:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("v2_cards")
      .select(
        `
        id,
        card_code,
        status,
        activated_at,
        created_at,
        v2_businesses (
          business_code,
          business_name,
          google_review_url
        ),
        v2_landing_pages (
          lp_slug,
          is_active,
          template_key
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("V2_LIST_CARDS_ERROR:", error);
      return NextResponse.json(
        { message: "Data card V2 gagal dimuat." },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards: data ?? [] });
  } catch (error) {
    console.error("V2_LIST_CARDS_GET_ERROR:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
