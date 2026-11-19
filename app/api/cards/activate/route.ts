import { NextRequest, NextResponse } from "next/server";
import { v1SupabaseServer, hasDedicatedV1Database, canIssueNewV1Cards } from "@/lib/v1-supabase";
import { checkV1RateLimit } from "@/lib/v1-rate-limit";
import { verifyActivationPin } from "@/lib/pin";
import { resolveV1GooglePlaceId, suggestV1GooglePlace } from "@/lib/v1-google-maps";

export const dynamic = "force-dynamic";

type ActivateRequest = {
  card_code?: string;
  activation_pin?: string;
  business_name?: string;
  google_review_url?: string;
  confirmed_place_id?: string;
  confirmed_maps_url?: string;
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


export async function POST(request: NextRequest) {
  try {
    // After V1-only credentials are configured, do not accept activations
    // before historical cards are audited. Legacy fallback is unchanged.
    if (hasDedicatedV1Database() && !(await canIssueNewV1Cards())) {
      return NextResponse.json({
        success: false,
        message: "Aktivasi V1 belum tersedia: verifikasi migrasi kartu belum selesai.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const body = (await request.json()) as ActivateRequest;
    const supabase = v1SupabaseServer();

    const cardCode = normalizeCardCode(body.card_code ?? "");
    const activationPin = normalizePin(body.activation_pin ?? "");
    const businessName = normalizeBusinessName(body.business_name ?? "");
    const googleMapsUrl = (body.google_review_url ?? "").trim();
    const confirmedPlaceId = (body.confirmed_place_id ?? "").trim();
    const confirmedMapsUrl = (body.confirmed_maps_url ?? "").trim();

    if (!(await checkV1RateLimit(supabase, request, "activate", cardCode))) {
      return NextResponse.json({success:false,message:"Terlalu banyak percobaan atau keamanan sementara tidak tersedia."},{status:429,headers:{"Retry-After":"900"}});
    }

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

    if (!/^ULAS-\d{4,}$/.test(cardCode)) {
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

    if (!googleMapsUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Maps wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (confirmedPlaceId && !/^ChIJ[-_A-Za-z0-9]+$/.test(confirmedPlaceId)) {
      return NextResponse.json({success:false,message:"Place ID konfirmasi tidak valid."},{status:400});
    }

    if (!/^https:\/\//i.test(googleMapsUrl)) {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Maps tidak valid.",
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
 * GOOGLE PLACE ID
 * ================================
 */

let googleReviewUrl: string;

try {
  const placeId = await resolveV1GooglePlaceId(googleMapsUrl);
  if (confirmedPlaceId && confirmedPlaceId !== placeId) {
    return NextResponse.json({success:false,message:"Konfirmasi bisnis tidak cocok dengan link Google."},{status:422});
  }
  googleReviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
} catch (error) {
  try {
    const suggestion = await suggestV1GooglePlace(googleMapsUrl);
    if (suggestion) {
      if (confirmedPlaceId) {
        if (confirmedPlaceId !== suggestion.placeId) {
          return NextResponse.json({success:false,message:"Lokasi berubah. Periksa kembali bisnis Anda."},{status:422});
        }
        googleReviewUrl = `https://search.google.com/local/writereview?placeid=${suggestion.placeId}`;
      } else {
        return NextResponse.json({
          success: false,
          code: "CONFIRM_GOOGLE_PLACE",
          message: "Periksa nama dan alamat bisnis sebelum aktivasi.",
          candidate: suggestion,
        }, { status: 422 });
      }
    } else {
      // If Google does not expose a verifiable Place ID, never fabricate one.
      // A Google Maps share link can be used ONLY after the customer explicitly
      // accepts that it opens Maps rather than the direct review composer.
      let shortLink: URL | null = null;
      try { shortLink = new URL(googleMapsUrl); } catch { /* invalid input */ }
      const safeMapsShortLink = shortLink?.protocol === "https:" &&
        shortLink.hostname === "maps.app.goo.gl" &&
        !shortLink.username && !shortLink.password && !shortLink.port &&
        !shortLink.search && !shortLink.hash &&
        /^\/[A-Za-z0-9_-]{10,}$/.test(shortLink.pathname);
      if (!safeMapsShortLink) {
        return NextResponse.json({success:false,message: error instanceof Error ? error.message : "Place ID belum dapat dipastikan."},{status:422});
      }
      if (confirmedMapsUrl !== googleMapsUrl) {
        return NextResponse.json({
          success:false, code:"CONFIRM_MAPS_LINK",
          message:"Place ID tidak ditemukan. Anda dapat menghubungkan kartu ke halaman Google Maps bisnis, tetapi bukan langsung ke formulir Tulis Ulasan. Periksa link sebelum konfirmasi.",
          maps_url: googleMapsUrl,
        },{status:422});
      }
      googleReviewUrl = googleMapsUrl;
    }
  } catch (lookupError) {
    console.error("V1_PLACE_SUGGESTION_ERROR", lookupError);
    return NextResponse.json({success:false,message:"Pencarian lokasi gagal. Coba lagi atau gunakan link Tulis Ulasan resmi."},{status:422});
  }
}

/*
 * ================================
 * GENERATE GOOGLE REVIEW URL
 * ================================
 */

// Destination was selected above: verified direct review link or explicit Maps fallback.
    
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
