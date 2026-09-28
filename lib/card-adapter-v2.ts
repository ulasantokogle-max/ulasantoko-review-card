import { supabaseServer } from "@/lib/supabase";

export type CardAdapterV2 = {
  id: string;
  code: string;
  name: string | null;
  active: boolean;
  googleReviewUrl: string | null;
  feedback: { enabled: boolean; pageId: string | null };
  complaint: { enabled: boolean };
  config: Record<string, unknown>;
  publicPath: string | null;
  targetPath: string | null;
  landingPage: {
    id: string | null;
    slug: string | null;
    title: string | null;
    headline: string | null;
    description: string | null;
  };
};

type V2Business = {
  id: string;
  business_code: string;
  business_name: string;
  google_maps_url: string | null;
  google_review_url: string | null;
  google_place_id: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  status: string;
};

type V2Card = {
  id: string;
  card_code: string;
  status: string;
  business_id: string;
};

type V2LandingPage = {
  id: string;
  card_id: string;
  lp_slug: string;
  template_key: string | null;
  title: string | null;
  headline: string | null;
  description: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  review_enabled: boolean | null;
  complaint_enabled: boolean | null;
  feedback_enabled: boolean | null;
  is_active: boolean | null;
  settings: Record<string, unknown> | null;
};

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getCardAdapterV2(code: string): Promise<CardAdapterV2 | null> {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) return null;

  const supabase = supabaseServer();

  // V2 customer presentation is fully standalone. Legacy cards/feedback_pages
  // are intentionally not read here.
  const { data: card, error: cardError } = await supabase
    .from("v2_cards")
    .select("id, card_code, status, business_id")
    .eq("card_code", normalizedCode)
    .maybeSingle();

  if (cardError) {
    console.error("V2_CARD_READ_ERROR:", cardError);
    throw new Error("V2_CARD_READ_ERROR");
  }
  if (!card) return null;

  const v2Card = card as V2Card;

  const { data: business, error: businessError } = await supabase
    .from("v2_businesses")
    .select("id, business_code, business_name, google_maps_url, google_review_url, google_place_id, logo_url, address, phone, status")
    .eq("id", v2Card.business_id)
    .maybeSingle();

  if (businessError) {
    console.error("V2_BUSINESS_READ_ERROR:", businessError);
    throw new Error("V2_BUSINESS_READ_ERROR");
  }
  if (!business) return null;

  const { data: lp, error: lpError } = await supabase
    .from("v2_landing_pages")
    .select("id, card_id, lp_slug, template_key, title, headline, description, primary_color, secondary_color, review_enabled, complaint_enabled, feedback_enabled, is_active, settings")
    .eq("card_id", v2Card.id)
    .maybeSingle();

  if (lpError) {
    console.error("V2_LP_READ_ERROR:", lpError);
    throw new Error("V2_LP_READ_ERROR");
  }

  const v2Business = business as V2Business;
  const v2Landing = lp as V2LandingPage | null;
  const settings: Record<string, unknown> = {
    ...(v2Landing?.settings ?? {}),
    business_name: v2Business.business_name,
    google_maps_url: v2Business.google_maps_url,
    google_review_url: v2Business.google_review_url,
    google_place_id: v2Business.google_place_id,
    logo_url: v2Business.logo_url,
    address: v2Business.address,
    phone: v2Business.phone,
    whatsapp_owner: v2Landing?.settings?.whatsapp_owner ?? v2Business.phone,
    primary_color: v2Landing?.primary_color,
    secondary_color: v2Landing?.secondary_color,
  };

  const active = v2Card.status === "active" && v2Business.status === "active";

  return {
    id: v2Card.id,
    code: v2Card.card_code,
    name: v2Business.business_name,
    active,
    googleReviewUrl: getString(v2Business.google_review_url),
    feedback: {
      enabled: active && (v2Landing?.review_enabled ?? true) && (v2Landing?.feedback_enabled ?? true),
      pageId: v2Landing?.id ?? null,
    },
    complaint: {
      enabled: active && (v2Landing?.complaint_enabled ?? true),
    },
    config: settings,
    publicPath: "/" + v2Card.card_code,
    targetPath: "/" + (v2Landing?.lp_slug ?? v2Card.card_code),
    landingPage: {
      id: v2Landing?.id ?? null,
      slug: getString(v2Landing?.lp_slug) ?? v2Card.card_code,
      title: getString(v2Landing?.title) ?? v2Business.business_name,
      headline: getString(v2Landing?.headline) ?? "BAGAIMANA PENGALAMAN ANDA HARI INI?",
      description: getString(v2Landing?.description) ?? "Kami selalu ingin memberikan yang terbaik untuk Anda.",
    },
  };
}
