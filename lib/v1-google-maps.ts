/**
 * Accept only Google-owned direct review destinations. Do not treat a normal
 * Google Maps share URL as a direct review form.
 */
export function officialV1DirectReviewUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        url.hash || url.searchParams.has("continue")) return null;
    if (url.hostname === "g.page" && !url.search &&
        /^\/r\/[A-Za-z0-9_-]{8,100}\/review\/?$/.test(url.pathname)) {
      return url.toString();
    }
    if (url.hostname === "search.google.com" &&
        url.pathname === "/local/writereview" &&
        [...url.searchParams.keys()].every(key => key === "placeid") &&
        url.searchParams.getAll("placeid").length === 1 &&
        /^ChIJ[-_A-Za-z0-9]+$/.test(url.searchParams.get("placeid") ?? "")) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

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

/**
 * Resolve Google Maps share links into a Google Place ID using Places API (New).
 * Direct extraction still takes priority in resolveV1GooglePlaceId.
 *
 * Never use the customer's free-text business name to guess the location.
 * Only query the title AND coordinates actually embedded in the expanded Maps URL.
 * No API key = no guessed Place ID; caller must not activate a non-direct URL.
 */
export type V1GooglePlaceCandidate = {
  placeId: string;
  name: string;
  address: string;
  verified: boolean;
};

function coordinatesFromMapsUrl(url: URL): { lat: number; lng: number } | null {
  const decoded = decodeURIComponent(url.toString());
  const marker = decoded.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  const at = decoded.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  const found = marker || at;
  if (!found) return null;
  const lat = Number(found[1]);
  const lng = Number(found[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? {lat, lng} : null;
}

function titleFromMapsUrl(url: URL): string | null {
  const matched = url.pathname.match(/\/(?:maps\/)?place\/([^/]+)/);
  if (!matched) return null;
  let title: string;
  try { title = decodeURIComponent(matched[1]).replace(/\+/g, " ").trim(); }
  catch { return null; }
  // Coordinates / opaque IDs / generic map pins are not business names.
  if (!title || title.length < 3 || title.length > 180 ||
      /^[-\d.,\s]+$/.test(title)) return null;
  return title;
}

async function expandV1GoogleMapsUrl(value: string): Promise<URL | null> {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!validGoogleUrl(url)) return null;
  for (let hop = 0; hop < 5 && url.hostname === "maps.app.goo.gl"; hop++) {
    const response = await fetch(url.toString(), {
      method: "GET", redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) return null;
    const next = new URL(location, url);
    if (!validGoogleUrl(next)) return null;
    url = next;
  }
  return url.hostname === "maps.app.goo.gl" ? null : url;
}

function normalizePlaceTitle(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
    Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export async function suggestV1GooglePlace(value: string): Promise<V1GooglePlaceCandidate | null> {
  const apiKey = process.env.V1_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const url = await expandV1GoogleMapsUrl(value);
  if (!url) return null;
  const title = titleFromMapsUrl(url);
  const marker = coordinatesFromMapsUrl(url);
  if (!title || !marker) return null;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: title,
      maxResultCount: 10,
      languageCode: "id",
      locationBias: {
        circle: { center: { latitude: marker.lat, longitude: marker.lng }, radius: 300 },
      },
    }),
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const json = await response.json() as { places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }> };
  const candidates = (json.places || [])
    .filter(p => p.id && /^[-_A-Za-z0-9]{10,}$/.test(p.id) &&
      p.displayName?.text && p.formattedAddress &&
      p.location && Number.isFinite(p.location.latitude) &&
      Number.isFinite(p.location.longitude))
    .map(p => ({
      id: p.id!,
      name: p.displayName!.text!,
      address: p.formattedAddress!,
      distance: metersBetween(marker.lat, marker.lng, p.location!.latitude!, p.location!.longitude!),
    }))
    .filter(p => p.distance <= 150)
    .sort((a, b) => a.distance - b.distance);

  const exact = candidates.filter(p => normalizePlaceTitle(p.name) === normalizePlaceTitle(title));
  // Auto-resolve only on exact business-name match, close coordinates and no
  // competing nearby match. Google Maps URL must identify a specific place.
  const best = exact[0];
  if (best && best.distance <= 40 && exact.filter(p => p.distance <= 80).length === 1) {
    return { placeId: best.id, name: best.name, address: best.address, verified: true };
  }

  // For ambiguous results require human confirmation; never auto-activate.
  const nearest = candidates[0];
  if (!nearest || nearest.distance > 100 ||
      candidates.filter(p => p.distance < 80).length !== 1) return null;
  return { placeId: nearest.id, name: nearest.name, address: nearest.address, verified: false };
}
