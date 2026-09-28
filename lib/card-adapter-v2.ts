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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing");
}

const cardApiUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/card-api`;

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * V2-only Card Adapter.
 *
 * IMPORTANT:
 * - Does not touch the legacy `lib/card-adapter.ts`.
 * - Reads card data through the HTTP card-api Edge Function.
 * - The Edge Function owns the call to public.v2_resolve_card().
 */
export async function getCardAdapterV2(code: string): Promise<CardAdapterV2 | null> {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) return null;

  let response: Response;

  try {
    response = await fetch(cardApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ card_code: normalizedCode }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("CARD_ADAPTER_V2_HTTP_ERROR:", error);
    return null;
  }

  let payload: CardApiResponse;

  try {
    payload = (await response.json()) as CardApiResponse;
  } catch (error) {
    console.error("CARD_ADAPTER_V2_JSON_ERROR:", error);
    return null;
  }

  if (!response.ok || payload.ok === false) {
    console.error("CARD_ADAPTER_V2_API_ERROR:", payload.error ?? response.statusText);
    return null;
  }

  const card = payload.card;
  const business = payload.business;
  const landingPage = payload.landing_page;

  if (!card?.id || !card.card_code) return null;

  const settings = landingPage?.settings ?? {};
  const googleReviewUrl =
    getString(business?.google_review_url) ??
    getString(settings.google_review_url);

  const landingPageActive = landingPage?.is_active !== false;
  const pageId = getString(landingPage?.id);

  return {
    id: card.id,
    code: card.card_code,
    name: getString(business?.business_name),
    active: card.status === "active",
    googleReviewUrl,
    feedback: {
      enabled: Boolean(pageId) && landingPageActive,
      pageId,
    },
    complaint: {
      enabled: Boolean(pageId) && landingPageActive,
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
