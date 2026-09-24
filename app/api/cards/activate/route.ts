import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

/**
 * Validasi apakah URL merupakan URL Google Maps yang diperbolehkan.
 */
function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();

    const allowedHosts = [
      "maps.app.goo.gl",
      "goo.gl",
      "maps.google.com",
      "maps.google.co.id",
      "google.com",
      "www.google.com",
      "google.co.id",
      "www.google.co.id",
      "www.google.com",
      "www.google.co.uk",
      "maps.app.google",
    ];

    return allowedHosts.some(
      (allowedHost) =>
        host === allowedHost || host.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
}

/**
 * Membuka short URL Google Maps dan mengikuti redirect
 * sampai mendapatkan URL tujuan akhirnya.
 *
 * Contoh:
 *
 * https://maps.app.goo.gl/f85APXtVrArkZJgq9
 *
 * menjadi URL Google Maps tujuan.
 */
async function resolveGoogleMapsUrl(reviewUrl: string): Promise<string> {
  const response = await fetch(reviewUrl, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Link Google Maps tidak dapat dibuka.");
  }

  return response.url;
}

/**
 * Mencari Place ID Google Maps menggunakan Google Places API (New).
 *
 * Pencarian utama menggunakan nama bisnis.
 *
 * Contoh:
 * Gudang MJH
 *
 * akan dicari melalui:
 * https://places.googleapis.com/v1/places:searchText
 */
async function findPlaceId(
  businessName: string,
  mapsUrl: string
): Promise<{
  placeId: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUri: string;
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY belum dikonfigurasi di server Vercel."
    );
  }

  /**
   * Nama bisnis menjadi query utama.
   *
   * Kita sengaja tidak memasukkan URL panjang ke textQuery
   * karena bisa membuat hasil pencarian Google Places menjadi
   * kurang akurat.
   */
  const textQuery = businessName
    .replace(/\s+/g, " ")
    .trim();

  if (!textQuery) {
    throw new Error("Nama bisnis wajib diisi.");
  }

  /**
   * Google Places API (New)
   */
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 5,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Google Places API error:", data);

    throw new Error(
      data?.error?.message ||
        "Gagal mencari lokasi di Google Maps."
    );
  }

  const places = data?.places || [];

  if (!places.length) {
    throw new Error(
      `Lokasi "${businessName}" tidak ditemukan di Google Maps.`
    );
  }

  /**
   * Normalisasi nama untuk pencocokan.
   */
  const normalizedBusinessName = businessName
    .toLowerCase()
    .trim();

  /**
   * Cari nama yang benar-benar sama terlebih dahulu.
   */
  const exactMatch = places.find((place: any) => {
    const name = place?.displayName?.text
      ?.toLowerCase()
      .trim();

    return name === normalizedBusinessName;
  });

  /**
   * Kalau tidak ada exact match, cari yang mengandung
   * nama bisnis.
   */
  const partialMatch = places.find((place: any) => {
    const name = place?.displayName?.text
      ?.toLowerCase()
      .trim();

    if (!name) return false;

    return (
      name.includes(normalizedBusinessName) ||
      normalizedBusinessName.includes(name)
    );
  });

  /**
   * Kita TIDAK langsung mengambil places[0].
   *
   * Prioritas:
   * 1. Exact match
   * 2. Partial match
   *
   * Kalau tidak ada keduanya, dianggap gagal agar tidak
   * salah mengaktifkan kartu untuk bisnis lain.
   */
  const selectedPlace = exactMatch || partialMatch;

  if (!selectedPlace?.id) {
    const resultNames = places
      .map((place: any) => place?.displayName?.text)
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Lokasi "${businessName}" tidak ditemukan secara tepat di Google Maps. ` +
        (resultNames
          ? `Hasil yang ditemukan: ${resultNames}`
          : "")
    );
  }

  return {
    placeId: selectedPlace.id,
    displayName:
      selectedPlace.displayName?.text || businessName,
    formattedAddress:
      selectedPlace.formattedAddress || "",
    googleMapsUri:
      selectedPlace.googleMapsUri || mapsUrl,
  };
}

/**
 * POST /api/cards/activate
 */
export async function POST(req: Request) {
  try {
    /**
     * ============================
     * BACA REQUEST
     * ============================
     */
    const body = await req.json();

    const cardCode = String(body.cardCode || "").trim();

    const businessName = String(
      body.businessName || ""
    ).trim();

    const reviewUrl = String(
      body.reviewUrl || ""
    ).trim();

    /**
     * ============================
     * VALIDASI INPUT
     * ============================
     */
    if (!cardCode || !businessName || !reviewUrl) {
      return NextResponse.json(
        {
          error: "Semua field wajib diisi.",
        },
        { status: 400 }
      );
    }

    /**
     * Pastikan link yang dimasukkan adalah Google Maps.
     */
    if (!isGoogleMapsUrl(reviewUrl)) {
      return NextResponse.json(
        {
          error:
            "Link harus berupa link Google Maps yang valid.",
        },
        { status: 400 }
      );
    }

    /**
     * ============================
     * SUPABASE
     * ============================
     */
    const db = supabaseServer();

    /**
     * Cari kartu berdasarkan card_code.
     */
    const {
      data: existing,
      error: findError,
    } = await db
      .from("cards")
      .select("*")
      .eq("card_code", cardCode)
      .maybeSingle();

    if (findError) {
      console.error(
        "Supabase find card error:",
        findError
      );

      return NextResponse.json(
        {
          error: "Gagal membaca data kartu.",
          detail: findError.message,
        },
        { status: 500 }
      );
    }

    /**
     * Kartu tidak ditemukan.
     */
    if (!existing) {
      return NextResponse.json(
        {
          error: "Kode kartu tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    /**
     * Kartu sudah aktif.
     */
    if (existing.status === "active") {
      return NextResponse.json(
        {
          error: "Kartu ini sudah aktif.",
        },
        { status: 409 }
      );
    }

    /**
     * ============================
     * RESOLVE GOOGLE MAPS URL
     * ============================
     *
     * Contoh:
     *
     * Input:
     * https://maps.app.goo.gl/f85APXtVrArkZJgq9
     *
     * Akan diikuti redirect-nya.
     */
    let resolvedMapsUrl = reviewUrl;

    try {
      resolvedMapsUrl =
        await resolveGoogleMapsUrl(reviewUrl);
    } catch (error: any) {
      console.error(
        "Google Maps resolve error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error?.message ||
            "Link Google Maps tidak dapat dibuka.",
        },
        { status: 400 }
      );
    }

    /**
     * ============================
     * CARI PLACE ID
     * ============================
     */
    let place;

    try {
      place = await findPlaceId(
        businessName,
        resolvedMapsUrl
      );
    } catch (error: any) {
      console.error(
        "Place ID lookup error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error?.message ||
            "Gagal mendapatkan Place ID Google Maps.",
        },
        { status: 400 }
      );
    }

    /**
     * ============================
     * BUAT LINK GOOGLE REVIEW
     * ============================
     *
     * Hasil:
     *
     * https://search.google.com/local/writereview?placeid=PLACE_ID
     */
    const googleReviewUrl =
      `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
        place.placeId
      )}`;

    /**
     * ============================
     * UPDATE DATA KARTU
     * ============================
     */
    const payload: Record<string, any> = {
      card_code: cardCode,

      business_name: businessName,

      google_review_url: googleReviewUrl,

      status: "active",

      activated_at: new Date().toISOString(),

      updated_at: new Date().toISOString(),
    };

    const {
      data: result,
      error: updateError,
    } = await db
      .from("cards")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "Supabase update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Kartu ditemukan tetapi gagal diaktifkan.",
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    /**
     * ============================
     * RESPONSE
     * ============================
     */
    return NextResponse.json({
      ok: true,

      message: "Kartu berhasil diaktifkan.",

      data: {
        cardCode,

        businessName,

        /**
         * Place ID Google Maps
         */
        placeId: place.placeId,

        /**
         * URL Google Maps hasil resolve.
         */
        googleMapsUrl: resolvedMapsUrl,

        /**
         * URL review yang akan dibuka customer.
         */
        googleReviewUrl,

        /**
         * Data tambahan dari Google Places.
         */
        placeName: place.displayName,

        address: place.formattedAddress,

        /**
         * Data kartu dari Supabase.
         */
        card: result,
      },
    });
  } catch (error: any) {
    console.error("Server error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Server error.",
      },
      { status: 500 }
    );
  }
}
