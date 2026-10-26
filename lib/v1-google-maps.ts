// V1-only Google Maps link resolver. Never infer a Place ID from a business name.
const allowedHosts = new Set([
  "maps.app.goo.gl", "maps.google.com", "www.google.com",
  "google.com", "search.google.com",
]);

function validGoogleUrl(url: URL) {
  return url.protocol === "https:" && allowedHosts.has(url.hostname) &&
    !url.username && !url.password && url.port === "";
}

export function explicitGooglePlaceId(url: URL): string | null {
  const direct = url.searchParams.get("placeid") ||
    url.searchParams.get("place_id") ||
    url.searchParams.get("query_place_id");
  if (direct && /^ChIJ[-_A-Za-z0-9]+$/.test(direct)) return direct;
  // Some long Google Maps share links embed a native Place ID in data segments.
  const embedded = url.toString().match(/(?:!1s|%211s)(ChIJ[-_A-Za-z0-9]+)/);
  return embedded?.[1] ?? null;
}

export async function resolveV1GooglePlaceId(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Masukkan URL Google Maps yang benar."); }
  if (!validGoogleUrl(url)) throw new Error("Gunakan tautan HTTPS dari Google Maps.");
  for (let hop = 0; hop < 5; hop++) {
    const id = explicitGooglePlaceId(url);
    if (id) return id;
    if (url.hostname !== "maps.app.goo.gl") break;
    // Short links: follow only one hop at a time and validate every destination.
    // No direct access to internal IPs, arbitrary hosts, or unapproved schemes.
    const response = await fetch(url.toString(), {
      method: "GET", redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; V1GoogleMapsLinkResolver/1.0)" },
    });
    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) break;
    const next = new URL(location, url);
    if (!validGoogleUrl(next)) throw new Error("Link Maps mengarah ke domain tidak diizinkan.");
    url = next;
  }
  throw new Error(
    "Link Google Maps dikenali, tetapi Place ID belum dapat dipastikan. " +
    "Gunakan link Tulis Ulasan dari Google Business Profile agar tidak salah lokasi."
  );
}
