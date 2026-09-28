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
  slug?: string | null;
  business_name?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  google_review_url?: string | null;
  review_title?: string | null;
  review_description?: string | null;
  complaint_title?: string | null;
  complaint_description?: string | null;
  feedback_enabled?: boolean | null;
  complaint_enabled?: boolean | null;
  is_active?: boolean | null;
  settings?: Record<string, unknown> | null;
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
 * Identity/status still comes from the V2 card API. Presentation data is
 * resolved from the existing `feedback_pages` record for the same card code.
 * This is important because the dashboard's store settings (logo, cover,
 * Google Review URL, etc.) already live there. The legacy adapter is untouched.
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
    throw new Error(
      `V2_HTTP_FETCH_ERROR: ${error instanceof Error ? error.message : "Unknown fetch error"}`,
    );
  }

  let payload: CardApiResponse;

  try {
    payload = (await response.json()) as CardApiResponse;
  } catch (error) {
    console.error("CARD_ADAPTER_V2_JSON_ERROR:", error);
    throw new Error(
      `V2_JSON_ERROR: ${error instanceof Error ? error.message : "Invalid JSON response"}`,
    );
  }

  if (!response.ok || payload.ok === false) {
    console.error("CARD_ADAPTER_V2_API_ERROR:", payload.error ?? response.statusText);
    throw new Error(
      `V2_API_ERROR_${response.status}: ${payload.error ?? response.statusText ?? "Unknown API error"}`,
    );
  }

  const card = payload.card;

  if (!card?.id || !card.card_code) {
    console.error("CARD_ADAPTER_V2_INVALID_RESPONSE:", payload);
    throw new Error("V2_INVALID_RESPONSE: card.id or card.card_code is missing");
  }

  // IMPORTANT: feedback_pages is the source already used by the dashboard
  // and the existing LP route. Resolve it by page_code so LP00103 keeps its
  // real store configuration instead of inheriting a test/default landing page.
  let feedbackPage: FeedbackPage | null = null;
  try {
    const { data, error } = await supabase
      .from("feedback_pages")
      .select(
        "id, page_code, slug, business_name, logo_url, cover_url, primary_color, secondary_color, google_review_url, review_title, review_description, complaint_title, complaint_description, feedback_enabled, complaint_enabled, is_active, settings",
      )
      .eq("page_code", normalizedCode)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.warn("CARD_ADAPTER_V2_PAGE_WARNING:", error);
    } else {
      feedbackPage = data as FeedbackPage | null;
    }
  } catch (error) {
    console.warn("CARD_ADAPTER_V2_PAGE_FETCH_WARNING:", error);
  }

  const apiLandingSettings = isRecord(payload.landing_page?.settings)
    ? payload.landing_page.settings
    : {};
  const feedbackSettings = isRecord(feedbackPage?.settings)
    ? feedbackPage.settings
    : {};

  // Feedback-page columns are flattened into the same config object consumed
  // by V2CustomerLanding. Explicit dashboard values win over API defaults.
  const settings: Record<string, unknown> = {
    ...apiLandingSettings,
    ...feedbackSettings,
    ...(feedbackPage?.logo_url ? { logo_url: feedbackPage.logo_url } : {}),
    ...(feedbackPage?.cover_url ? { cover_url: feedbackPage.cover_url } : {}),
    ...(feedbackPage?.primary_color ? { primary_color: feedbackPage.primary_color } : {}),
    ...(feedbackPage?.secondary_color ? { secondary_color: feedbackPage.secondary_color } : {}),
  };

  const googleReviewUrl =
    getString(feedbackPage?.google_review_url) ??
    getString(payload.business?.google_review_url) ??
    getString(card.google_review_url) ??
    getString(settings.google_review_url);

  const active = card.status === "active" && feedbackPage?.is_active !== false;
  const pageId = getString(feedbackPage?.id) ?? getString(payload.landing_page?.id);

  // Do not let a test/default landing_page response overwrite the real store
  // presentation. Only use explicit V2 settings when present; otherwise keep
  // the stable customer-facing defaults.
  const headline =
    getString(settings.headline) ??
    getString(settings.customer_headline) ??
    "BAGAIMANA PENGALAMAN ANDA HARI INI?";
  const description =
    getString(settings.description) ??
    getString(settings.customer_description) ??
    "Kami selalu ingin memberikan yang terbaik untuk Anda.";

  return {
    id: card.id,
    code: card.card_code,
    name:
      getString(feedbackPage?.business_name) ??
      getString(payload.business?.business_name) ??
      getString(settings.business_name),
    active,
    googleReviewUrl,
    feedback: {
      enabled:
        Boolean(pageId) &&
        active &&
        (feedbackPage?.feedback_enabled ?? true),
      pageId,
    },
    complaint: {
      enabled:
        Boolean(pageId) &&
        active &&
        (feedbackPage?.complaint_enabled ?? true),
    },
    config: settings,
    publicPath: getString(payload.public_path),
    targetPath: getString(payload.qr?.target_path),
    landingPage: {
      id: pageId,
      slug:
        getString(feedbackPage?.slug) ??
        getString(payload.landing_page?.slug) ??
        normalizedCode,
      title:
        getString(feedbackPage?.business_name) ??
        getString(payload.landing_page?.title),
      headline,
      description,
    },
  };
}
