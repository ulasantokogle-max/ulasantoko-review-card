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
  qr?: {
    target_path?: string | null;
  };
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
  settings?: Record<string, unknown> | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("V2_CONFIG_ERROR: Supabase environment variables are missing");
}

// The guard above guarantees these values exist; keep local constants so
// TypeScript also knows they are strings inside the adapter request.
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
 * IMPORTANT:
 * - Does not touch the legacy `lib/card-adapter.ts`.
 * - The HTTP card-api remains the primary V2 source for card/landing data.
 * - Existing `feedback_pages.settings` is used as an additive compatibility
 *   source for the V2 presentation config (logo, cover, WhatsApp, etc.).
 * - This keeps the current V2 architecture while mapping the configuration
 *   already used by the existing dashboard without changing the legacy flow.
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
  const business = payload.business;
  const landingPage = payload.landing_page;

  if (!card?.id || !card.card_code) {
    console.error("CARD_ADAPTER_V2_INVALID_RESPONSE:", payload);
    throw new Error("V2_INVALID_RESPONSE: card.id or card.card_code is missing");
  }

  const landingSettings = isRecord(landingPage?.settings) ? landingPage.settings : {};

  // `feedback_pages` is the existing source used by the dashboard for the
  // store presentation settings. Read it only when needed, then merge it
  // underneath any settings already supplied by the V2 API.
  let feedbackPage: FeedbackPage | null = null;
  try {
    const { data, error } = await supabase
      .from("feedback_pages")
      .select("id, page_code, feedback_enabled, complaint_enabled, settings")
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

  const feedbackSettings = isRecord(feedbackPage?.settings) ? feedbackPage.settings : {};
  const settings: Record<string, unknown> = {
    ...feedbackSettings,
    ...landingSettings,
  };

  const googleReviewUrl =
    getString(business?.google_review_url) ??
    getString(card?.google_review_url) ??
    getString(settings.google_review_url);

  const landingPageActive = landingPage?.is_active !== false;
  const pageId =
    getString(landingPage?.id) ??
    getString(feedbackPage?.id);

  return {
    id: card.id,
    code: card.card_code,
    name: getString(business?.business_name),
    active: card.status === "active",
    googleReviewUrl,
    feedback: {
      enabled:
        Boolean(pageId) &&
        landingPageActive &&
        (landingPage?.is_active !== false) &&
        (feedbackPage?.feedback_enabled ?? true),
      pageId,
    },
    complaint: {
      enabled:
        Boolean(pageId) &&
        landingPageActive &&
        (feedbackPage?.complaint_enabled ?? true),
    },
    config: settings,
    publicPath: getString(payload.public_path),
    targetPath: getString(payload.qr?.target_path),
    landingPage: {
      id: pageId,
      slug: getString(landingPage?.slug),
      title: getString(landingPage?.title),
      headline: getString(landingPage?.headline),
      description: getString(landingPage?.description),
    },
  };
}
