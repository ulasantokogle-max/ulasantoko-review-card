import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

function getPublicClient() {
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase public environment variables are missing");
  }

  return createClient(supabaseUrl, anonKey);
}

function isAuthorized(request: NextRequest) {
  if (!adminKey) return false;
  const supplied = request.headers.get("x-admin-key")?.trim();
  return Boolean(supplied) && supplied === adminKey;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cardCode = String(body.card_code ?? "").trim().toUpperCase();
    const customerName = String(body.customer_name ?? "").trim();
    const message = String(body.message ?? "").trim();
    const isAnonymous = Boolean(body.is_anonymous);

    if (!cardCode) {
      return NextResponse.json({ message: "Kode card wajib diisi." }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ message: "Keluhan wajib diisi." }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ message: "Keluhan terlalu panjang." }, { status: 400 });
    }

    if (customerName.length > 120) {
      return NextResponse.json({ message: "Nama terlalu panjang." }, { status: 400 });
    }

    const supabase = getPublicClient();
    const { data: page, error: pageError } = await supabase
      .from("feedback_pages")
      .select("id, page_code, complaint_enabled, is_active")
      .eq("page_code", cardCode)
      .eq("is_active", true)
      .maybeSingle();

    if (pageError) {
      console.error("COMPLAINT_PAGE_LOOKUP_ERROR:", pageError);
      return NextResponse.json({ message: "Gagal memeriksa card." }, { status: 500 });
    }

    if (!page || page.complaint_enabled === false) {
      return NextResponse.json({ message: "Fitur keluhan belum tersedia untuk card ini." }, { status: 404 });
    }

    const { error: insertError } = await supabase
      .from("feedback_complaints")
      .insert({
        feedback_page_id: page.id,
        customer_name: isAnonymous ? null : customerName || null,
        is_anonymous: isAnonymous,
        message,
        status: "pending",
      });

    if (insertError) {
      console.error("COMPLAINT_INSERT_ERROR:", insertError);
      return NextResponse.json({ message: "Keluhan gagal dikirim." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("COMPLAINT_POST_ERROR:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("feedback_complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOAD_COMPLAINTS_ERROR:", error);
      return NextResponse.json({ message: "Data keluhan gagal dimuat." }, { status: 500 });
    }

    return NextResponse.json({ complaints: data ?? [] });
  } catch (error) {
    console.error("COMPLAINT_GET_ERROR:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim().toLowerCase();
    const allowedStatuses = ["pending", "reviewed", "resolved", "rejected"];

    if (!id || !allowedStatuses.includes(status)) {
      return NextResponse.json({ message: "ID atau status tidak valid." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("feedback_complaints")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("UPDATE_COMPLAINT_ERROR:", error);
      return NextResponse.json({ message: "Status gagal diperbarui." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("COMPLAINT_PATCH_ERROR:", error);
    return NextResponse.json({ message: "Terjadi kesalahan server." }, { status: 500 });
  }
}
