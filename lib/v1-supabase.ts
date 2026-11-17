import { createClient } from "@supabase/supabase-js";
import { isApprovedDedicatedV1DatabaseUrl } from "@/lib/v1-project-guard";

/**
 * Independent V1 data connection. Never change the shared SUPABASE_* variables
 * in order to migrate V1: the same repo has V2 routes using those settings.
 *
 * Legacy V1 uses the old shared vars until BOTH dedicated vars are supplied
 * to the V1 Vercel project. Partial configuration fails closed.
 */
export function hasDedicatedV1Database(): boolean {
  return !!(process.env.V1_SUPABASE_URL && process.env.V1_SUPABASE_SERVICE_ROLE_KEY);
}

export function v1SupabaseServer() {
  const dedicatedUrl = process.env.V1_SUPABASE_URL;
  const dedicatedKey = process.env.V1_SUPABASE_SERVICE_ROLE_KEY;
  if (Boolean(dedicatedUrl) !== Boolean(dedicatedKey)) {
    throw new Error("Incomplete V1 database configuration");
  }

  // Hard-pin the isolated production V1 project. A mistaken environment URL
  // must never allow a V1 write to reach V2, V3, WiV1 or another Supabase DB.
  // This guard is evaluated only when the new dedicated V1 variables are set.
  if (dedicatedUrl && !isApprovedDedicatedV1DatabaseUrl(dedicatedUrl)) {
    throw new Error("V1 database URL does not match the approved isolated project");
  }

  const url = dedicatedUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = dedicatedKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("V1 database credentials are not configured");
  }

  // Credentials remain on server-side routes only.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Once dedicated V1 credentials are introduced, forbid issuance of cards
 * until the historical dataset has been restored and signed off.
 * Existing legacy connection is not forced to have the new gate table.
 */
export async function canIssueNewV1Cards(): Promise<boolean> {
  if (!hasDedicatedV1Database()) return true;
  try {
    const { data, error } = await v1SupabaseServer()
      .from("v1_migration_gate")
      .select("imported_and_verified")
      .eq("singleton", true)
      .maybeSingle();
    return !error && data?.imported_and_verified === true;
  } catch {
    return false;
  }
}
