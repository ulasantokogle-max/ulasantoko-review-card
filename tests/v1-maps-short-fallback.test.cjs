const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("V1 activation never stores a non-review Maps share link for new cards", () => {
  const api = read("app/api/cards/activate/route.ts");
  assert.doesNotMatch(api, /googleReviewUrl = googleMapsUrl/);
  assert.doesNotMatch(api, /CONFIRM_MAPS_LINK/);
  assert.match(api, /MAPS_UNRESOLVED/);
  assert.match(api, /verifiedBusinessName \|\| businessName/);
  assert.match(api, /suggestV1GooglePlace\(googleMapsUrl, businessName\)/);
  assert.match(api, /verifyActivationPin/);
  assert.match(api, /\.eq\("status", "inactive"\)/);
});

test("Google Maps resolver requires source URL title and marker coordinates", () => {
  const maps = read("lib/v1-google-maps.ts");
  assert.match(maps, /placeIdentityFromMapsUrl\(url\)/);
  assert.match(maps, /coordinatesFromMapsUrl\(url\)/);
  assert.match(maps, /V1_GOOGLE_PLACES_API_KEY/);
  assert.match(maps, /places:searchText/);
  assert.match(maps, /normalizePlaceTitle\(p.name\) === normalizePlaceTitle\(queryTitle\)/);
  assert.match(maps, /best.distance <= 40/);
  assert.match(maps, /verified: true/);
  assert.match(maps, /verified: false/);
  assert.doesNotMatch(maps, /textQuery: businessName/);
});

test("V1 customer screen only offers Google Review, never Maps-only activation", () => {
  const ui = read("components/ActivationForm.tsx");
  assert.doesNotMatch(ui, /Aktifkan ke Maps \(Bukan Ulasan Langsung\)/);
  assert.doesNotMatch(ui, /confirmed_maps_url/);
  assert.match(ui, /maps.app.goo.gl/);
  assert.match(ui, /CONFIRM_GOOGLE_PLACE/);
});

test("existing V1 active Maps link routing preserved; no V2/V3 changes", () => {
  const redirect = read("app/r-v1/[cardCode]/route.ts");
  assert.match(redirect, /url.hostname === "maps.app.goo.gl"/);
  const activate = read("app/api/cards/activate/route.ts");
  assert.doesNotMatch(activate, /v3Supabase|v2Supabase/);
});
