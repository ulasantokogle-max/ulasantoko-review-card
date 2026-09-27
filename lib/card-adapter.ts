import { createClient } from "@supabase/supabase-js";

export type CardAdapter = {
  id: string;
  code: string;
  name: string | null;
  active: boolean;
  googleReviewUrl: string | null;
  feedback: { enabled: boolean; pageId: string | null };
  complaint: { enabled: boolean };
  config: Record<string, unknown>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Card Adapter V2
 *
 * Satu-satunya read layer yang dipakai feature V2.
 * Existing `cards` tetap menjadi sumber identitas/status kartu.
 * `feedback_pages` bersifat additive: bila tersedia, konfigurasi
 * landing/complaint V2 ikut digunakan.
 */
export async function getCardAdapter(code: string): Promise<CardAdapter | null> {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) return null;

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, card_code, business_name, google_review_url, status")
    .eq("card_code", normalizedCode)
    .maybeSingle();

  if (cardError) {
    console.error("CARD_ADAPTER_CARD_ERROR:", cardError);
    return null;
  }
  if (!card) return null;

  // Optional V2 configuration. Missing feedback_pages must never
  // break the existing card flow.
  const { data: page, error: pageError } = await supabase
    .from("feedback_pages")
    .select("id, page_code, feedback_enabled, complaint_enabled, settings")
    .eq("page_code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (pageError) {
    console.warn("CARD_ADAPTER_PAGE_WARNING:", pageError);
  }

  return {
    id: card.id,
    code: card.card_code,
    name: card.business_name,
    active: card.status === "active",
    googleReviewUrl: card.google_review_url,
    feedback: {
      enabled: page?.feedback_enabled ?? true,
      pageId: page?.id ?? null,
    },
    // Complaint storage currently depends on feedback_pages.
    complaint: {
      enabled: Boolean(page?.id) && (page?.complaint_enabled ?? true),
    },
    config: page?.settings ?? {},
  };
}
