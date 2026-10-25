import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// This protection is deliberately fail-closed. The V1-only RPC migration
// must be applied BEFORE deploying routes that call it.
export async function checkV1RateLimit(
  supabase: SupabaseClient,
  request: NextRequest,
  purpose: "create" | "activate",
  cardCode = "",
): Promise<boolean> {
  const secret = process.env.V1_RATE_LIMIT_SECRET || process.env.ADMIN_KEY;
  if (!secret) return false;
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  // Hash identifiers; never save addresses, admin keys or PINs in rate-limit table.
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
  const windowSeconds = 15 * 60;
  const rules = purpose === "create"
    ? [{ bucket: "v1:create:ip:" + digest(ip), limit: 10 }]
    : [
        { bucket: "v1:activate:ip:" + digest(ip), limit: 20 },
        { bucket: "v1:activate:card:" + digest(cardCode), limit: 6 },
      ];

  for (const rule of rules) {
    const { data, error } = await supabase.rpc("v1_check_rate_limit", {
      p_bucket: rule.bucket,
      p_limit: rule.limit,
      p_window_seconds: windowSeconds,
    });
    if (error || data !== true) return false;
  }
  return true;
}
