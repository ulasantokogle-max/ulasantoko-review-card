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
  let decoded: string;
  try { decoded = decodeURIComponent(url.toString()); } catch { return null; }
  const pairs = [
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /(?:[?&](?:ll|center|sll)=)(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
  ];
  const found = pairs.map(re => decoded.match(re)).find(Boolean);
  if (!found) return null;
  const lat = Number(found[1]), lng = Number(found[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? {lat, lng} : null;
}

// Google Maps sometimes includes the street address after a comma in the
// /maps/place/<business name>,+<street address>/ URL segment. Previously V1
// treated the entire path as a business name and exact matching always failed.
function placeIdentityFromMapsUrl(url: URL): { name: string; address: string | null } | null {
  const matched = url.pathname.match(/\/(?:maps\/)?place\/([^/]+)/);
  let raw: string | null = matched?.[1] ?? null;
  if (!raw) {
    raw = url.searchParams.get("query") || url.searchParams.get("q") ||
      url.searchParams.get("destination");
  }
  if (!raw) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(raw).replace(/\+/g, " ").trim(); }
  catch { return null; }
  if (!decoded || decoded.length < 3 || decoded.length > 400 ||
      /^[-\d.,\s]+$/.test(decoded) || /^https?:\/\//i.test(decoded)) return null;

  // Only /place paths can carry an address suffix. Query URLs may legitimately
  // contain commas within an official business name; do not split those.
  const comma = matched ? decoded.indexOf(",") : -1;
  const name = (comma >= 0 ? decoded.slice(0, comma) : decoded).trim();
  const address = comma >= 0 ? decoded.slice(comma + 1).trim() : null;
  if (name.length < 3 || name.length > 180) return null;
  return { name, address: address && address.length >= 6 ? address : null };
}

function titleFromMapsUrl(url: URL): string | null {
  return placeIdentityFromMapsUrl(url)?.name ?? null;
}

function addressMatchesMapsPath(sourceAddress: string, resolvedAddress: string): boolean {
  const postcode = sourceAddress.match(/\b\d{5}\b/)?.[0];
  const house = sourceAddress.match(/\b(?:no\.?|nomor)\s*(\d{1,5})\b/i)?.[1];
  if (!postcode || !house) return false;
  const normalizedResolved = resolvedAddress.normalize("NFKC").toLocaleLowerCase("id-ID");
  const resolvedPostcode = normalizedResolved.match(/\b\d{5}\b/)?.[0];
  const resolvedHouse = normalizedResolved.match(/\b(?:no\.?|nomor)\s*(\d{1,5})\b/i)?.[1];
  // Exact business name + matching house number and postal code, and only
  // one candidate. Without this evidence, require human confirmation.
  return postcode === resolvedPostcode && house === resolvedHouse;
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

export async function suggestV1GooglePlace(value: string, fallbackBusinessName = ""): Promise<V1GooglePlaceCandidate | null> {
  const apiKey = process.env.V1_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const url = await expandV1GoogleMapsUrl(value);
  if (!url) return null;
  const identity = placeIdentityFromMapsUrl(url);
  const title = identity?.name || null;
  const marker = coordinatesFromMapsUrl(url);
  // A legitimate Google Maps share may resolve to /maps?cid=... without
  // a readable name or coordinates. Only in that case use the customer-supplied
  // business name to search Google Places, and NEVER auto-confirm that result.
  // An invalid/unsafe redirect still fails in expandV1GoogleMapsUrl.
  const nameFallback = !title && typeof fallbackBusinessName === "string" &&
    fallbackBusinessName.trim().length >= 4 && fallbackBusinessName.trim().length <= 180
    ? fallbackBusinessName.trim() : null;
  const queryTitle = title || nameFallback;
  if (!queryTitle) return null;
  const requiresOwnerConfirmation = !title;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: identity?.address ? queryTitle + ", " + identity.address : queryTitle,
      maxResultCount: 10,
      languageCode: "id",
      ...(marker ? { locationBias: {
        circle: { center: { latitude: marker.lat, longitude: marker.lng }, radius: 300 },
      } } : {}),
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
      distance: marker ? metersBetween(marker.lat, marker.lng, p.location!.latitude!, p.location!.longitude!) : null,
    }))
    .filter(p => p.distance === null || p.distance <= 150)
    .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));

  const exact = candidates.filter(p => normalizePlaceTitle(p.name) === normalizePlaceTitle(queryTitle));
  // Auto-resolve only on exact business-name match, close coordinates and no
  // competing nearby match. Google Maps URL must identify a specific place.
  const best = exact[0];
  if (!requiresOwnerConfirmation && !marker && identity?.address &&
      exact.length === 1 && best &&
      addressMatchesMapsPath(identity.address, best.address)) {
    return { placeId: best.id, name: best.name, address: best.address, verified: true };
  }
  if (!requiresOwnerConfirmation && marker && best && best.distance !== null && best.distance <= 40 &&
      exact.filter(p => p.distance !== null && p.distance <= 80).length === 1 &&
      candidates.filter(p => p.distance !== null && p.distance <= 40).length === 1) {
    return { placeId: best.id, name: best.name, address: best.address, verified: true };
  }

  // Without coordinates, never auto-approve. A unique exact-title Places
  // match may be shown to the customer for explicit name/address confirmation.
  const possible = requiresOwnerConfirmation
    ? exact
    : marker ? candidates.filter(p => p.distance !== null && p.distance <= 100) : exact;
  if (possible.length !== 1) return null;
  const candidate = possible[0];
  return { placeId: candidate.id, name: candidate.name, address: candidate.address, verified: false };
}

/**
 * Optional external fallback for Google Maps shares that cannot be resolved by
 * Google Places text search. Productmate only extracts a Place ID; its response
 * is explicitly NOT verified. Therefore Google Places Details MUST independently
 * confirm the exact business name before we offer it for manual confirmation.
 *
 * Does not read or write any card/PIN data and does not expose the V1 API key.
 */
export async function suggestV1ProductmatePlace(value: string): Promise<V1GooglePlaceCandidate | null> {
  const googleKey = process.env.V1_GOOGLE_PLACES_API_KEY;
  if (!googleKey) return null;
  const expanded = await expandV1GoogleMapsUrl(value);
  if (!expanded) return null;
  const identity = placeIdentityFromMapsUrl(expanded);
  if (!identity?.name) return null;
  const endpoint = "https://productmate.com/api/v1/google-review-link";
  const response = await fetch(endpoint, {
    method:"POST", redirect:"manual", cache:"no-store",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({maps_url:value}),
    signal:AbortSignal.timeout(9000),
  });
  if (!response.ok || response.status !== 200 ||
      !(response.headers.get("content-type") || "").includes("application/json")) return null;
  const raw = await response.text();
  if (raw.length > 10000) return null;
  let external: { place_id?: unknown; review_url?: unknown; verification?: unknown };
  try { external = JSON.parse(raw); } catch { return null; }
  const id = external.place_id;
  if (typeof id !== "string" || !/^ChIJ[-_A-Za-z0-9]{8,}$/.test(id)) return null;
  if (external.review_url !== `https://search.google.com/local/writereview?placeid=${id}`) return null;
  if (external.verification !== "not_verified") return null;

  // Attempt independent Google verification first. Google Places Details can
  // fail because of API restrictions, quota, billing, or a temporary outage.
  // Do not silently discard an otherwise valid Productmate candidate in that
  // case. Return it unverified using identity from the actual Google Maps URL.
  // Customer MUST preview the Google review link and explicitly confirm it.
  let details: Response | null = null;
  try {
    details = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(id), {
      headers:{"X-Goog-Api-Key":googleKey,
        "X-Goog-FieldMask":"id,displayName,formattedAddress"},
      signal:AbortSignal.timeout(7000),cache:"no-store",
    });
  } catch {
    // Fall through to manual verification against the original Google URL.
  }
  if (details?.ok) {
    try {
      const result = await details.json() as {
        id?: string; displayName?:{text?: string}; formattedAddress?:string;
      };
      if (result.id !== id || typeof result.displayName?.text !== "string" ||
          typeof result.formattedAddress !== "string") return null;
      if (normalizePlaceTitle(result.displayName.text) !== normalizePlaceTitle(identity.name)) return null;
      if (identity.address) {
        const postA = identity.address.match(/\b\d{5}\b/)?.[0];
        const postB = result.formattedAddress.match(/\b\d{5}\b/)?.[0];
        const numberA = identity.address.match(/\b(?:no\.?|nomor)\s*(\d{1,5})\b/i)?.[1];
        const numberB = result.formattedAddress.match(/\b(?:no\.?|nomor)\s*(\d{1,5})\b/i)?.[1];
        if ((postA && postB && postA !== postB) ||
            (numberA && numberB && numberA !== numberB)) return null;
      }
      return { placeId:id,name:result.displayName.text,address:result.formattedAddress,verified:false };
    } catch {
      return null; // Invalid details from Google must not silently pass.
    }
  }

  // Name/address here are copied from the *expanded Google Maps URL*, NOT
  // from Productmate or user-supplied text. Candidate remains unverified.
  // Reject plain search URLs without a concrete Google Maps location address.
  if (!identity.address || identity.address.length < 12 ||
      !/\b\d{5}\b/.test(identity.address)) return null;
  return { placeId:id,name:identity.name,address:identity.address,verified:false };

}

/**
 * V1-only parallel resolver. Search Google and third-party fallback concurrently
 * to avoid chained timeouts on slow providers. Accept a third-party result only
 * after its independent Google Details validation (inside that resolver).
 *
 * If two providers disagree on the Place ID, fail closed instead of assigning
 * somebody else's review page. No database writes or stored credentials.
 */
export type V1ReviewResolution = {
  candidate: V1GooglePlaceCandidate | null;
  source: "google" | "productmate" | "none";
  reason: "ok" | "unresolved" | "provider_conflict" | "google_error" | "fallback_error";
  google: "found" | "unresolved" | "error";
  fallback: "found" | "unresolved" | "error";
};

export async function resolveV1GoogleReviewCandidate(
  url: string,
  businessName: string,
): Promise<V1ReviewResolution> {
  // Both helpers validate the final Google URL and never follow arbitrary hosts.
  const [googleResult, fallbackResult] = await Promise.allSettled([
    suggestV1GooglePlace(url, businessName),
    suggestV1ProductmatePlace(url),
  ]);
  const google = googleResult.status === "rejected" ? null : googleResult.value;
  const fallback = fallbackResult.status === "rejected" ? null : fallbackResult.value;
  const googleStatus = googleResult.status === "rejected" ? "error" : google ? "found" : "unresolved";
  const fallbackStatus = fallbackResult.status === "rejected" ? "error" : fallback ? "found" : "unresolved";
  const common = {google:googleStatus, fallback:fallbackStatus} as const;

  if (google && fallback && google.placeId !== fallback.placeId) {
    return {candidate:null,source:"none",reason:"provider_conflict",...common};
  }
  if (google) return {candidate:google,source:"google",reason:"ok",...common};
  if (fallback) return {candidate:fallback,source:"productmate",reason:"ok",...common};
  return {
    candidate:null,source:"none",
    reason:googleResult.status === "rejected" ? "google_error" :
      fallbackResult.status === "rejected" ? "fallback_error" : "unresolved",
    ...common,
  };
}
