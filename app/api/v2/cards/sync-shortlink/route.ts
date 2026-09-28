import { NextRequest, NextResponse } from "next/server";
import { ensureV2ShortLink } from "@/lib/shortio";

export const dynamic = "force-dynamic";

const adminKey = process.env.ADMIN_KEY;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!adminKey || clean(body.admin_key) !== adminKey.trim()) {
      return NextResponse.json(
        { ok: false, error: "Admin key tidak valid." },
        { status: 401 }
      );
    }

    const code = clean(body.card_code).toUpperCase();

    if (!/^LP\d{5}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: "Format kode V2 harus seperti LP00101." },
        { status: 400 }
      );
    }

    const result = await ensureV2ShortLink(code, clean(body.title) || code);

    return NextResponse.json({
      ok: true,
      card_code: code,
      short_url: result.shortURL,
      destination_url: result.originalURL,
      existing: result.existing,
    });
  } catch (error) {
    console.error("V2_SHORTLINK_ERROR", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Short link tidak dapat dibuat.",
      },
      { status: 400 }
    );
  }
}
