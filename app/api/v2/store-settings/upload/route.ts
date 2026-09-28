import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { verifyActivationPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const code = clean(form.get("card_code")).toUpperCase();
    const pin = clean(form.get("pin"));
    const type = clean(form.get("type"));
    const file = form.get("file");

    if (!/^LP\d{5}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Kode V2 tidak valid." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ ok: false, error: "PIN harus 6 digit." }, { status: 400 });
    }
    if (type !== "logo" && type !== "cover") {
      return NextResponse.json({ ok: false, error: "Tipe upload tidak valid." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "File belum dipilih." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "File harus berupa gambar." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Ukuran gambar maksimal 5 MB." }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: card, error: cardError } = await supabase
      .from("v2_cards")
      .select("id, card_code, status, business_id, activation_pin_hash")
      .eq("card_code", code)
      .maybeSingle();

    if (cardError) throw new Error("V2_CARD_READ_ERROR");
    if (!card) throw new Error("Kartu V2 tidak ditemukan.");
    if (card.status !== "active") throw new Error("Kartu V2 belum aktif.");
    if (!card.activation_pin_hash || !verifyActivationPin(pin, card.activation_pin_hash)) {
      throw new Error("PIN aktivasi salah.");
    }

    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    const path = code + "/" + type + "-" + Date.now() + "." + extension;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase
      .storage
      .from("v2-assets")
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error("V2_ASSET_UPLOAD_ERROR", uploadError);
      throw new Error("Upload gagal. Pastikan bucket v2-assets sudah dibuat.");
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum tersedia.");
    const publicUrl =
      baseUrl.replace(/\/$/, "") +
      "/storage/v1/object/public/v2-assets/" +
      path.split("/").map(encodeURIComponent).join("/");

    const now = new Date().toISOString();

    if (type === "logo") {
      const { error } = await supabase
        .from("v2_businesses")
        .update({ logo_url: publicUrl, updated_at: now })
        .eq("id", card.business_id);
      if (error) throw new Error("Logo gagal disimpan.");
    } else {
      const { data: landing } = await supabase
        .from("v2_landing_pages")
        .select("id, settings")
        .eq("card_id", card.id)
        .maybeSingle();

      const settings =
        landing?.settings && typeof landing.settings === "object"
          ? landing.settings
          : {};

      const nextSettings = { ...settings, cover_url: publicUrl };

      if (landing) {
        const { error } = await supabase
          .from("v2_landing_pages")
          .update({ settings: nextSettings, updated_at: now })
          .eq("id", landing.id);
        if (error) throw new Error("Cover gagal disimpan.");
      } else {
        const { error } = await supabase
          .from("v2_landing_pages")
          .insert({
            card_id: card.id,
            lp_slug: code,
            template_key: "lp002",
            title: code,
            headline: "BAGAIMANA PENGALAMAN ANDA HARI INI?",
            description: "Kami selalu ingin memberikan yang terbaik untuk Anda.",
            settings: nextSettings,
            is_active: true,
          });
        if (error) throw new Error("Cover gagal disimpan.");
      }
    }

    return NextResponse.json({ ok: true, url: publicUrl, type });
  } catch (error) {
    console.error("V2_UPLOAD_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload tidak dapat diproses." },
      { status: 400 }
    );
  }
}
