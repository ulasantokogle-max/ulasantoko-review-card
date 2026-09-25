import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyActivationPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;

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

type ActivateRequest = {
  card_code?: string;
  activation_pin?: string;
  business_name?: string;
  google_maps_url?: string;
};

function normalizeCardCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizePin(value: string) {
  return value.trim();
}

function normalizeBusinessName(value: string) {
  return value.trim();
}

function normalizeGoogleMapsUrl(value: string) {
  return value.trim();
}

function isValidGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "google.com" ||
        url.hostname.endsWith(".google.com") ||
        url.hostname === "maps.google.com" ||
        url.hostname === "maps.app.goo.gl"
      )
    );
  } catch {
    return false;
  }
}

async function extractPlaceIdFromGoogleMapsUrl(
  googleMapsUrl: string,
  businessName: string
) {
  /*
   * 1. Resolve Google Maps URL
   */
  const response = await fetch(googleMapsUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GoogleMapsPlaceResolver/1.0)",
    },
  });

  const finalUrl = response.url;

  /*
   * 2. Coba ambil Place ID dari URL
   */
  try {
    const parsedUrl = new URL(finalUrl);

    const placeId =
      parsedUrl.searchParams.get("placeid") ||
      parsedUrl.searchParams.get("place_id");

    if (placeId) {
      return placeId;
    }
  } catch {
    // lanjut ke Google Places API
  }

  /*
   * 3. Fallback ke Google Places API
   */
  if (!googleMapsApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY belum tersedia.");
  }

  const placesResponse = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleMapsApiKey,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({
        textQuery: businessName,
        languageCode: "id",
      }),
    }
  );

  if (!placesResponse.ok) {
    const errorText = await placesResponse.text();

    console.error("GOOGLE_PLACES_ERROR", errorText);

    throw new Error("Gagal mencari Place ID Google Maps.");
  }

  const placesData = await placesResponse.json();

  const place = placesData?.places?.[0];

  if (!place?.id) {
    throw new Error(
      "Place ID tidak ditemukan. Pastikan nama bisnis sesuai dengan Google Maps."
    );
  }

  return place.id;
}

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "google.com" ||
        url.hostname.endsWith(".google.com") ||
        url.hostname === "maps.google.com" ||
        url.hostname === "maps.app.goo.gl"
      )
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActivateRequest;

    const cardCode = normalizeCardCode(body.card_code ?? "");
    const activationPin = normalizePin(body.activation_pin ?? "");
    const businessName = normalizeBusinessName(body.business_name ?? "");
    const googleReviewUrl = normalizeGoogleReviewUrl(
      body.google_review_url ?? ""
    );

    /*
     * ================================
     * BASIC VALIDATION
     * ================================
     */

    if (!cardCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode kartu wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!/^ULAS-\d{5,}$/.test(cardCode)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format kode kartu tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(activationPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN aktivasi harus terdiri dari 6 digit.",
        },
        { status: 400 }
      );
    }

    if (!businessName) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama bisnis wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!googleReviewUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Review wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!isValidGoogleReviewUrl(googleReviewUrl)) {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Review tidak valid.",
        },
        { status: 400 }
      );
    }

    /*
     * ================================
     * FIND CARD
     * ================================
     */

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(
        `
        id,
        card_code,
        business_name,
        google_review_url,
        status,
        activation_pin_hash,
        activated_at
        `
      )
      .eq("card_code", cardCode)
      .maybeSingle();

    if (cardError) {
      console.error("CARD_LOOKUP_ERROR", cardError);

      return NextResponse.json(
        {
          success: false,
          message: "Terjadi kesalahan saat memeriksa kartu.",
        },
        { status: 500 }
      );
    }

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode kartu tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    /*
     * ================================
     * CHECK CARD STATUS
     * ================================
     *
     * Kartu yang sudah aktif TIDAK BOLEH
     * diaktivasi ulang.
     */

    if (card.status === "active") {
      return NextResponse.json(
        {
          success: false,
          message: "Kartu sudah aktif dan tidak dapat diaktivasi ulang.",
        },
        { status: 409 }
      );
    }

    /*
     * ================================
     * CHECK PIN HASH
     * ================================
     */

    if (!card.activation_pin_hash) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN aktivasi kartu belum tersedia.",
        },
        { status: 409 }
      );
    }

    const pinValid = verifyActivationPin(
      activationPin,
      card.activation_pin_hash
    );

    if (!pinValid) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN aktivasi salah.",
        },
        { status: 401 }
      );
    }

    /*
     * ================================
     * ACTIVATE CARD
     * ================================
     *
     * Jangan pernah menyimpan PIN asli.
     * Database hanya menyimpan hash.
     */

    const activatedAt = new Date().toISOString();

    const { data: activatedCard, error: updateError } = await supabase
      .from("cards")
      .update({
        business_name: businessName,
        google_review_url: googleReviewUrl,
        status: "active",
        activated_at: activatedAt,
        updated_at: activatedAt,
      })
      .eq("id", card.id)
      .eq("status", "inactive")
      .select(
        `
        id,
        card_code,
        business_name,
        google_review_url,
        status,
        activated_at
        `
      )
      .maybeSingle();

    if (updateError) {
      console.error("CARD_ACTIVATION_ERROR", updateError);

      return NextResponse.json(
        {
          success: false,
          message: "Kartu gagal diaktivasi.",
        },
        { status: 500 }
      );
    }

    /*
     * Kalau data tidak kembali berarti ada race condition:
     * kartu mungkin sudah diaktivasi request lain.
     */

    if (!activatedCard) {
      return NextResponse.json(
        {
          success: false,
          message: "Kartu sudah diaktivasi atau tidak dapat diaktivasi.",
        },
        { status: 409 }
      );
    }

    /*
     * ================================
     * SUCCESS
     * ================================
     */

    return NextResponse.json(
      {
        success: true,
        message: "Kartu berhasil diaktivasi.",
        card: {
          card_code: activatedCard.card_code,
          business_name: activatedCard.business_name,
          google_review_url: activatedCard.google_review_url,
          status: activatedCard.status,
          activated_at: activatedCard.activated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("ACTIVATE_ROUTE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Request tidak dapat diproses.",
      },
      { status: 500 }
    );
  }
}
