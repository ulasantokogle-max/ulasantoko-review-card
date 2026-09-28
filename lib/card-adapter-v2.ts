import { createClient } from "@supabase/supabase-js";

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

type CardApiResponse = {
  ok?: boolean;
  error?: string;
  qr?: { target_path?: string | null };
  card?: {
    id?: string;
    status?: string | null;
    card_code?: string | null;
    google_review_url?: string | null;
  };
  business?: {
    id?: string;
    business_code?: string | null;
    business_name?: string | null;
    google_review_url?: string | null;
  };
  public_path?: string | null;
  landing_page?: {
    id?: string;
    slug?: string | null;
    title?: string | null;
    headline?: string | null;
    is_active?: boolean;
    description?: string | null;
    settings?: Record<string, unknown> | null;
  };
};

type FeedbackPage = {
  id: string;
  page_code: string;
  feedback_enabled?: boolean | null;
  complaint_enabled?: boolean | null;
  is_active?: boolean | null;
  settings?: Record<string, unknown> | null;
  google_review_url?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("V2_CONFIG_ERROR: Supabase environment variables are missing");
}

const supabaseUrlValue = supabaseUrl;
const supabaseAnonKeyValue = supabaseAnonKey;
const cardApiUrl = `${supabaseUrlValue.replace(/\/$/, "")}/functions/v1/card-api`;
const supabase = createClient(supabaseUrlValue, supabaseAnonKeyValue);

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * V2-only Card Adapter.
 *
 * Identity/status comes from the V2 card API. Presentation data comes from
 * the existing feedback_pages.settings record used by the dashboard/legacy
 * landing flow. Legacy adapter is untouched.
 */
export async function getCardAdapterV2(code: string): Promise<CardAdapterV2 | null> {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) return null;

  let response: Response;

  try {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${supabaseAnonKeyValue}`);
    headers.set("apikey", supabaseAnonKeyValue);

    response = await fetch(cardApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ card_code: normalizedCode }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("CARD_ADAPTER_V2_HTTP_ERROR:", error);
    throw new Error(`V2_HTTP_FETCH_ERROR: ${error instanceof Error ? error.message : "Unknown fetch error"}`);
  }

  let payload: CardApiResponse;

  try {
    payload = (await response.json()) as CardApiResponse;
  } catch (error) {
    console.error("CARD_ADAPTER_V2_JSON_ERROR:", error);
    throw new Error(`V2_JSON_ERROR: ${error instanceof Error ? error.message : "Invalid JSON response"}`);
  }

  if (!response.ok || payload.ok === false) {
    console.error("CARD_ADAPTER_V2_API_ERROR:", payload.error ?? response.statusText);
    throw new Error(`V2_API_ERROR_${response.status}: ${payload.error ?? response.statusText ?? "Unknown error"}`);
  }

  const card = payload.card;

  if (!card?.id || !card.card_code) {
    console.error("CARD_ADAPTER_V2_INVALID_RESPONSE:", payload);
    throw new Error("V2_INVALID_RESPONSE: card.id or card.card_code is missing");
  }

  // Load the dashboard settings even when the feedback page itself is not
  // marked active. Card activation is controlled by cards.status; the page's
  // is_active flag should not make the customer's configured branding vanish.
  let feedbackPage: FeedbackPage | null = null;
  try {
    const { data, error } = await supabase
      .from("feedback_pages")
      .select("id, page_code, feedback_enabled, complaint_enabled, is_active, settings, google_review_url")
      .eq("page_code", normalizedCode)
      .maybeSingle();

    if (error) {
      console.warn("CARD_ADAPTER_V2_PAGE_WARNING:", error);
    } else {
      feedbackPage = data as FeedbackPage | null;
    }
  } catch (error) {
    console.warn("CARD_ADAPTER_V2_PAGE_FETCH_WARNING:", error);
  }

  // Compatibility fallback for public customer-facing data. This is read-only
  // and does not change the legacy system. It also guarantees that a V2 card
  // can still resolve its Google Review URL even when the V2 page settings
  // record is incomplete or unavailable to the public role.
  let legacyCard: { business_name?: string | null; google_review_url?: string | null } | null = null;
  try {
    const { data, error } = await supabase
      .from("cards")
      .select("business_name, google_review_url")
      .eq("card_code", normalizedCode)
      .maybeSingle();

    if (error) {
      console.warn("CARD_ADAPTER_V2_LEGACY_CARD_WARNING:", error);
    } else {
      legacyCard = data as { business_name?: string | null; google_review_url?: string | null } | null;
    }
  } catch (error) {
    console.warn("CARD_ADAPTER_V2_LEGACY_CARD_FETCH_WARNING:", error);
  }

  const apiLandingSettings = isRecord(payload.landing_page?.settings) ? payload.landing_page.settings : {};
  const feedbackSettings = isRecord(feedbackPage?.settings) ? feedbackPage.settings : {};

  // Dashboard settings win over API defaults/test data.
  const settings: Record<string, unknown> = {
    ...apiLandingSettings,
    ...feedbackSettings,
  };

  const configuredBusinessName =
    getString(settings.business_name) ??
    getString(settings.store_name) ??
    getString(settings.nama_toko) ??
    getString(settings.name);

  // Keep V2 presentation compatible with the existing feedback_pages record:
  // google_review_url is a real column there, while newer dashboard versions
  // may also keep the value inside settings.
  const googleReviewUrl =
    getString(settings.google_review_url) ??
    getString(settings.googleReviewUrl) ??
    getString(feedbackPage?.google_review_url) ??
    getString(legacyCard?.google_review_url) ??
    getString(payload.business?.google_review_url) ??
    getString(card.google_review_url);

  const active = card.status === "active";
  const pageId = getString(feedbackPage?.id) ?? getString(payload.landing_page?.id);

  const headline =
    getString(settings.headline) ??
    getString(settings.customer_headline) ??
    getString(settings.review_title) ??
    "BAGAIMANA PENGALAMAN ANDA HARI INI?";
  const description =
    getString(settings.description) ??
    getString(settings.customer_description) ??
    getString(settings.review_description) ??
    "Kami selalu ingin memberikan yang terbaik untuk Anda.";

  return {
    id: card.id,
    code: card.card_code,
    name:
      configuredBusinessName ??
      getString(legacyCard?.business_name) ??
      getString(payload.business?.business_name) ??
      getString(payload.landing_page?.title),
    active,
    googleReviewUrl,
    feedback: {
      enabled: Boolean(pageId) && active && (feedbackPage?.feedback_enabled ?? true),
      pageId,
    },
    complaint: {
      enabled: Boolean(pageId) && active && (feedbackPage?.complaint_enabled ?? true),
    },
    config: settings,
    publicPath: getString(payload.public_path),
    targetPath: getString(payload.qr?.target_path),
    landingPage: {
      id: pageId,
      slug: getString(settings.slug) ?? getString(payload.landing_page?.slug) ?? normalizedCode,
      title:
        configuredBusinessName ??
        getString(legacyCard?.business_name) ??
        getString(payload.landing_page?.title),
      headline,
      description,
    },
  };
}
