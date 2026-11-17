import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type V1RateLimitStatus = "allowed" | "limited" | "unavailable";
type V1Purpose = "create" | "activate" | "login";

/**
 * A database outage is NOT the same as a user exceeding the rate limit.
 * This tri-state result keeps misleading HTTP 429 errors out of Provider login.
 */
export async function getV1RateLimitStatus(
  supabase: SupabaseClient,
  request: NextRequest,
  purpose: V1Purpose,
  cardCode = "",
): Promise<V1RateLimitStatus> {
  const secret = process.env.V1_RATE_LIMIT_SECRET || process.env.ADMIN_KEY;
  if (!secret) return "unavailable";

  // Never store raw IPs, PINs or admin keys in Supabase.
  const ip = (request.headers.get("x-real-ip") || "unknown").trim().slice(0,100);
  const digest = (value: string) =>
    createHmac("sha256", secret).update(value).digest("hex").slice(0,32);
  const windowSeconds = 15 * 60;
  // A global bucket is mandatory even when the IP header cannot be trusted.
  const rules = purpose === "login" ? [
      { bucket: "v1:login:global", limit: 120 },
      { bucket: "v1:login:ip:" + digest(ip), limit: 6 },
    ] : purpose === "create" ? [
      { bucket: "v1:create:global", limit: 60 },
      { bucket: "v1:create:ip:" + digest(ip), limit: 10 },
    ] : [
      { bucket: "v1:activate:card:" + digest(cardCode), limit: 6 },
      { bucket: "v1:activate:ip:" + digest(ip), limit: 20 },
    ];

  try {
    for (const rule of rules) {
      const { data, error } = await supabase.rpc("v1_check_rate_limit", {
        p_bucket: rule.bucket,
        p_limit: rule.limit,
        p_window_seconds: windowSeconds,
      });
      if (error || (data !== true && data !== false)) return "unavailable";
      if (data === false) return "limited";
    }
    return "allowed";
  } catch {
    return "unavailable";
  }
}

/** Legacy V1 create/activate caller interface remains fail-closed. */
export async function checkV1RateLimit(
  supabase: SupabaseClient,
  request: NextRequest,
  purpose: "create" | "activate",
  cardCode = "",
): Promise<boolean> {
  return (await getV1RateLimitStatus(supabase,request,purpose,cardCode)) === "allowed";
}
