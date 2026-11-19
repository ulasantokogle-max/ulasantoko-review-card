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
  assert.match(ui, /Aktifkan ke Maps \(Bukan Ulasan Langsung\)/);
  assert.match(ui, /bukan langsung formulir Tulis Ulasan/);
});

test("Only exact Google Maps short URLs can use fallback", () => {
  const api = read("app/api/cards/activate/route.ts");
  assert.match(api, /url\.hostname === "maps\.app\.goo\.gl"/);
  assert.match(api, /!url\.username && !url\.password && !url\.port/);
  assert.match(api, /!url\.search && !url\.hash/);
  assert.match(api, /isSafeMapsShortLink/);
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

test("exact Google Maps short-link fallback is exercised against malicious input", () => {
  const source = read("app/api/cards/activate/route.ts");
  const start = source.indexOf("function isSafeMapsShortLink(");
  const end = source.indexOf("\ntry {\n  const placeId", start);
  assert.ok(start >= 0 && end > start);
  const snippet = source.slice(start, end).replace("value: string): boolean", "value)");
  const fn = new Function(snippet + "\nreturn isSafeMapsShortLink;")();
  assert.equal(fn("https://maps.app.goo.gl/AbCdEf123456789XY"), true);
  for (const url of [
    "https://maps.app.goo.gl/short",
    "https://maps.app.goo.gl.evil.example/AbCdEf123456789XY",
    "http://maps.app.goo.gl/AbCdEf123456789XY",
    "https://maps.app.goo.gl/AbCdEf123456789XY?next=bad",
    "https://maps.app.goo.gl/AbCdEf123456789XY#bad",
    "https://user:pass@maps.app.goo.gl/AbCdEf123456789XY",
  ]) assert.equal(fn(url), false, url);
});

test("failed optional Places lookup does not block confirmed Maps short link", () => {
  const api = read("app/api/cards/activate/route.ts");
  assert.match(api, /suggestion = await suggestV1GooglePlace/);
  assert.match(api, /catch \(lookupError\)/);
  assert.match(api, /else if \(isSafeMapsShortLink\(googleMapsUrl\)\)/);
  const ui = read("components/ActivationForm.tsx");
  assert.match(ui, /setMessage\(""\); \/\/ Confirmation is an option/);
  assert.match(ui, /setMapsFallback\(null\)/);
});
