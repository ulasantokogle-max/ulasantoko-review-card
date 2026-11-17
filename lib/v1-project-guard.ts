/** Prevent cross-project V1 database writes from a misconfigured Vercel env. */
const V1_APPROVED_HOST = "pkgdtrasmakjeykhvxhh.supabase.co";

export function isApprovedDedicatedV1DatabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && parsed.hostname === V1_APPROVED_HOST
      && parsed.pathname === "/"
      && !parsed.username && !parsed.password
      && !parsed.search && !parsed.hash
      && !parsed.port;
  } catch {
    return false;
  }
}
