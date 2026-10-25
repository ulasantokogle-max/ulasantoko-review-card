import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getPublicClient() {
  if (!supabaseUrl || !anonKey) throw new Error("Supabase public environment variables are missing");
  return createClient(supabaseUrl, anonKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = String(body.lp_slug ?? "").trim().toUpperCase();
    const customerName = String(body.customer_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const category = String(body.category ?? "").trim();
    const message = String(body.message ?? "").trim();
    const isAnonymous = Boolean(body.is_anonymous);

    if (!/^LP\d{5}$/.test(slug)) return NextResponse.json({ message: "Kode LP tidak valid." }, { status: 400 });
    if (!message) return NextResponse.json({ message: "Keluhan wajib diisi." }, { status: 400 });
    if (message.length > 5000) return NextResponse.json({ message: "Keluhan terlalu panjang." }, { status: 400 });
    if (customerName.length > 120 || phone.length > 40) return NextResponse.json({ message: "Data kontak terlalu panjang." }, { status: 400 });

    const supabase = getPublicClient();
    const { data: page, error: pageError } = await supabase
      .from("v2_landing_pages")
      .select("card_id, complaint_enabled, is_active, v2_cards!inner(status)")
      .eq("lp_slug", slug)
      .eq("is_active", true)
      .eq("v2_cards.status", "active")
      .maybeSingle();

    if (pageError || !page || !page.complaint_enabled) {
      return NextResponse.json({ message: "Fitur keluhan belum tersedia untuk card ini." }, { status: 404 });
    }

    const { error } = await supabase.from("v2_complaints").insert({
      card_id: page.card_id,
      customer_name: isAnonymous ? null : customerName || null,
      phone: isAnonymous ? null : phone || null,
      is_anonymous: isAnonymous,
      category: category || null,
      message,
      status: "pending",
    });

    if (error) {
      console.error("V2_COMPLAINT_INSERT_ERROR:", error);
      return NextResponse.json({ message: "Keluhan gagal dikirim." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("V2_COMPLAINT_POST_ERROR:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server." }, { status: 500 });
  }
}
