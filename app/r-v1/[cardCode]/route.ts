import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dedicated V1 redirect only. V2 public landing and legacy entry routes stay unchanged.
 * Map a physical V1 QR/NFC/Short.io URL here only after preview verification.
 */
function isApprovedGoogleReviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "search.google.com" &&
      url.pathname === "/local/writereview" &&
      /^[-_A-Za-z0-9]+$/.test(url.searchParams.get("placeid") ?? "") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;
  const code = cardCode?.trim().toUpperCase() ?? "";

  if (!/^ULAS-\d{5,}$/.test(code)) {
    return failure("Kode kartu tidak valid.", 400);
  }

  try {
    const { data: card, error } = await supabaseServer()
      .from("cards")
      .select("status, google_review_url")
      .eq("card_code", code)
      .maybeSingle();

    if (error) {
      console.error("V1_DIRECT_REVIEW_LOOKUP_ERROR", error.code);
      return failure("Gagal memeriksa kartu.", 503);
    }
    if (!card) {
      return failure("Kartu tidak ditemukan.", 404);
    }
    if (card.status === "inactive") {
      const activationUrl = new URL("/activate", request.url);
      activationUrl.searchParams.set("card_code", code);
      return NextResponse.redirect(activationUrl, {status: 307, headers: {"Cache-Control": "no-store, private"}});
    }
    if (card.status !== "active") {
      return failure("Kartu tidak tersedia.", 404);
    }

    const url = card.google_review_url;
    if (typeof url !== "string" || !isApprovedGoogleReviewUrl(url)) {
      return failure("Tautan Google Review belum valid.", 422);
    }

    return NextResponse.redirect(url, {
      status: 307,
      headers: {
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("V1_DIRECT_REVIEW_ERROR", error);
    return failure("Terjadi kendala saat memproses kartu.", 503);
  }
}
