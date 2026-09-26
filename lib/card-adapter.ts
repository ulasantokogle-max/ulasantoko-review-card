import { createClient } from "@supabase/supabase-js";

export type CardAdapter = {
  id: string;
  code: string;
  name: string | null;
  active: boolean;

  googleReviewUrl: string | null;

  feedback: {
    enabled: boolean;
    pageId: string | null;
  };

  complaint: {
    enabled: boolean;
  };

  config: Record<string, unknown>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing");
}

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

/**
 * Card Adapter V2
 *
 * IMPORTANT:
 * Adapter ini menjadi satu-satunya layer
 * yang digunakan feature V2 untuk mengambil
 * konfigurasi card.
 *
 * Sistem existing tidak diubah.
 */
export async function getCardAdapter(
  code: string
): Promise<CardAdapter | null> {
  if (!code) {
    return null;
  }

  /*
   * V2 mencoba mengambil data dari feedback_pages.
   *
   * Jangan mengubah tabel card existing.
   */
  const { data, error } = await supabase
    .from("feedback_pages")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("CARD_ADAPTER_ERROR:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name ?? null,
    active: data.active ?? true,

    googleReviewUrl:
      data.google_review_url ?? null,

    feedback: {
      enabled:
        data.feedback_enabled ?? true,

      pageId:
        data.id ?? null,
    },

    complaint: {
      enabled:
        data.complaint_enabled ?? true,
    },

    config:
      data.config ?? {},
  };
}
