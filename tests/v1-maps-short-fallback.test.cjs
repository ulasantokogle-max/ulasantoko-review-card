const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("V1 Maps short links require deliberate confirmation before activation", () => {
  const api = read("app/api/cards/activate/route.ts");
  const ui = read("components/ActivationForm.tsx");
  assert.match(api, /code:"CONFIRM_MAPS_LINK"/);
  assert.match(api, /confirmedMapsUrl !== googleMapsUrl/);
  assert.match(api, /googleReviewUrl = googleMapsUrl/);
  assert.match(ui, /confirmed_maps_url: mapsFallback === reviewUrl\.trim\(\)/);
  assert.match(ui, /Saya Setuju, Aktifkan ke Google Maps/);
  assert.match(ui, /bukan langsung formulir Tulis Ulasan/);
});

test("Only exact Google Maps short URLs can use fallback", () => {
  const api = read("app/api/cards/activate/route.ts");
  assert.match(api, /shortLink\.hostname === "maps\.app\.goo\.gl"/);
  assert.match(api, /!shortLink\.username && !shortLink\.password && !shortLink\.port/);
  assert.match(api, /!shortLink\.search && !shortLink\.hash/);
  assert.match(api, /safeMapsShortLink/);
  assert.match(api, /verifyActivationPin/);
  assert.match(api, /\.eq\("status", "inactive"\)/);
});

test("V1 direct composer and V3/V2 continue unchanged", () => {
  const api = read("app/api/cards/activate/route.ts");
  assert.match(api, /resolveV1GooglePlaceId/);
  assert.match(api, /search\.google\.com\/local\/writereview\?placeid=/);
  assert.doesNotMatch(api, /v3Supabase|v2Supabase/);
  assert.match(read("app/r-v1/[cardCode]/route.ts"), /url\.hostname === "maps\.app\.goo\.gl"/);
});
