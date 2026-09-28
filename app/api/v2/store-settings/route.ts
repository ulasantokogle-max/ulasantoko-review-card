import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { verifyActivationPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

type SettingsPayload = {
  business_name?: string;
  google_maps_url?: string;
  whatsapp_owner?: string;
  phone?: string;
  address?: string;
  headline?: string;
  description?: string;
  review_title?: string;
  review_description?: string;
  primary_color?: string;
  secondary_color?: string;
  cover_position?: string;
  review_enabled?: boolean;
  complaint_enabled?: boolean;
  feedback_enabled?: boolean;
};

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function validMapsUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && (
      u.hostname === "google.com" ||
      u.hostname.endsWith(".google.com") ||
      u.hostname === "maps.google.com" ||
      u.hostname === "maps.app.goo.gl"
    );
  } catch {
    return false;
  }
}

async function resolvePlaceId(mapsUrl: string, businessName: string) {
  const response = await fetch(mapsUrl, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UlasanToko/2.0)" },
    cache: "no-store",
  });

  try {
    const finalUrl = new URL(response.url);
    const direct =
      finalUrl.searchParams.get("placeid") ||
      finalUrl.searchParams.get("place_id");
    if (direct) return direct;
  } catch {}

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY belum tersedia di Vercel.");

  const places = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({ textQuery: businessName, languageCode: "id" }),
      cache: "no-store",
    }
  );

  if (!places.ok) throw new Error("Google Places gagal mencari bisnis.");
  const data = await places.json();
  const place = data?.places?.[0];
  if (!place?.id) throw new Error("Place ID tidak ditemukan. Pastikan nama toko dan link Google Maps benar.");
  return place.id as string;
}

async function authorize(code: string, pin: string) {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("v2_cards")
    .select("id, card_code, status, business_id, activation_pin_hash")
    .eq("card_code", code)
    .maybeSingle();

  if (error) throw new Error("V2_CARD_READ_ERROR");
  if (!data) throw new Error("Kartu V2 tidak ditemukan.");
  if (data.status !== "active") throw new Error("Kartu V2 belum aktif.");
  if (!data.activation_pin_hash || !verifyActivationPin(pin, data.activation_pin_hash)) {
    throw new Error("PIN aktivasi salah.");
  }
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: "read" | "save";
      card_code?: string;
      pin?: string;
      settings?: SettingsPayload;
    };

    const code = clean(body.card_code).toUpperCase();
    const pin = clean(body.pin);

    if (!/^LP\d{5}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Format kode V2 harus seperti LP00101." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ ok: false, error: "PIN harus 6 digit." }, { status: 400 });
    }

    const card = await authorize(code, pin);
    const supabase = supabaseServer();

    const [{ data: business, error: businessReadError }, { data: landing, error: landingReadError }] =
      await Promise.all([
        supabase
          .from("v2_businesses")
          .select("id, business_code, business_name, google_review_url, google_place_id, logo_url, address, phone, status")
          .eq("id", card.business_id)
          .single(),
        supabase
          .from("v2_landing_pages")
          .select("id, lp_slug, template_key, title, headline, description, primary_color, secondary_color, review_enabled, complaint_enabled, feedback_enabled, is_active, settings")
          .eq("card_id", card.id)
          .maybeSingle(),
      ]);

    if (businessReadError) throw new Error("V2_BUSINESS_READ_ERROR");
    if (landingReadError) throw new Error("V2_LP_READ_ERROR");

    if (body.action === "read") {
      return NextResponse.json({ ok: true, business, landing });
    }

    const input = body.settings ?? {};
    const businessName = clean(input.business_name) || business.business_name;
    if (!businessName) {
      return NextResponse.json({ ok: false, error: "Nama toko wajib diisi." }, { status: 400 });
    }

    const mapsUrl = clean(input.google_maps_url);
    let googleReviewUrl = business.google_review_url;
    let googlePlaceId = business.google_place_id;

    if (mapsUrl) {
      if (!validMapsUrl(mapsUrl)) {
        return NextResponse.json({ ok: false, error: "Link Google Maps tidak valid." }, { status: 400 });
      }
      googlePlaceId = await resolvePlaceId(mapsUrl, businessName);
      googleReviewUrl = "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(googlePlaceId);
    }

    const previous = landing?.settings && typeof landing.settings === "object" ? landing.settings : {};
    const nextSettings: Record<string, unknown> = {
      ...previous,
      google_maps_url: mapsUrl || previous.google_maps_url || null,
      google_place_id: googlePlaceId,
      whatsapp_owner: clean(input.whatsapp_owner),
      phone: clean(input.phone),
      address: clean(input.address),
      review_title: clean(input.review_title),
      review_description: clean(input.review_description),
      cover_position: clean(input.cover_position) || "center",
      primary_color: clean(input.primary_color) || landing?.primary_color || "#173A32",
      secondary_color: clean(input.secondary_color) || landing?.secondary_color || "#D49A3A",
    };

    const now = new Date().toISOString();

    const { error: businessError } = await supabase
      .from("v2_businesses")
      .update({
        business_name: businessName,
        google_review_url: googleReviewUrl,
        google_place_id: googlePlaceId,
        phone: clean(input.phone) || business.phone || null,
        address: clean(input.address) || business.address || null,
        updated_at: now,
      })
      .eq("id", card.business_id);

    if (businessError) throw new Error("Gagal menyimpan data toko V2.");

    const patch = {
      title: businessName,
      headline: clean(input.headline) || landing?.headline || "BAGAIMANA PENGALAMAN ANDA HARI INI?",
      description: clean(input.description) || landing?.description || "Kami selalu ingin memberikan yang terbaik untuk Anda.",
      primary_color: clean(input.primary_color) || landing?.primary_color || "#173A32",
      secondary_color: clean(input.secondary_color) || landing?.secondary_color || "#D49A3A",
      review_enabled: typeof input.review_enabled === "boolean" ? input.review_enabled : landing?.review_enabled ?? true,
      complaint_enabled: typeof input.complaint_enabled === "boolean" ? input.complaint_enabled : landing?.complaint_enabled ?? true,
      feedback_enabled: typeof input.feedback_enabled === "boolean" ? input.feedback_enabled : landing?.feedback_enabled ?? true,
      settings: nextSettings,
      updated_at: now,
    };

    let updatedLanding;
    if (landing) {
      const result = await supabase
        .from("v2_landing_pages")
        .update(patch)
        .eq("id", landing.id)
        .select("id, lp_slug, template_key, title, headline, description, primary_color, secondary_color, review_enabled, complaint_enabled, feedback_enabled, is_active, settings")
        .single();
      if (result.error) throw new Error("Gagal menyimpan konfigurasi landing page V2.");
      updatedLanding = result.data;
    } else {
      const result = await supabase
        .from("v2_landing_pages")
        .insert({
          card_id: card.id,
          lp_slug: code,
          template_key: "lp002",
          ...patch,
          is_active: true,
        })
        .select("id, lp_slug, template_key, title, headline, description, primary_color, secondary_color, review_enabled, complaint_enabled, feedback_enabled, is_active, settings")
        .single();
      if (result.error) throw new Error("Gagal membuat landing page V2.");
      updatedLanding = result.data;
    }

    return NextResponse.json({
      ok: true,
      message: "Pengaturan toko V2 berhasil disimpan.",
      business,
      landing: updatedLanding,
    });
  } catch (error) {
    console.error("V2_SETTINGS_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Request tidak dapat diproses." },
      { status: 400 }
    );
  }
}
