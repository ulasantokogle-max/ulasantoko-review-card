const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("direct Google Review URL helper validates exact Google URL formats", () => {
  const source = read("lib/v1-google-maps.ts");
  const start = source.indexOf("export function officialV1DirectReviewUrl(");
  const end = source.indexOf("\n// V1-only Google Maps link resolver.", start);
  assert.ok(start >= 0 && end > start);
  const fnSource = source.slice(start, end).replace("export function officialV1DirectReviewUrl(value: string): string | null", "function officialV1DirectReviewUrl(value)");
  const parse = new Function(fnSource + "\nreturn officialV1DirectReviewUrl;")();
  for (const url of [
    "https://g.page/r/CUV5rS-Chn95EBM/review",
    "https://search.google.com/local/writereview?placeid=ChIJabc123_DEF",
  ]) assert.equal(parse(url), url);
  for (const url of [
    "https://maps.app.goo.gl/AbCdEf123456",
    "https://g.page/r/CUV5rS-Chn95EBM",
    "https://g.page.evil.example/r/CUV5rS-Chn95EBM/review",
    "https://g.page/r/CUV5rS-Chn95EBM/review?next=https://evil.example",
    "http://g.page/r/CUV5rS-Chn95EBM/review",
    "https://g.page/r/short/review",
    "https://search.google.com/local/writereview?placeid=ChIJabc&next=evil",
    "https://search.google.com/local/writereview?placeid=ChIJabc&placeid=ChIJdef",
    "https://search.google.com/local/writereview?placeid=",
  ]) assert.equal(parse(url), null, url);
});

test("V1 activation prioritizes official direct link ahead of Place ID resolver", () => {
  const source = read("app/api/cards/activate/route.ts");
  assert.match(source, /const directReviewUrl = officialV1DirectReviewUrl\(googleMapsUrl\)/);
  assert.ok(source.indexOf("if (directReviewUrl)") < source.indexOf("await resolveV1GooglePlaceId(googleMapsUrl)"));
  assert.match(source, /\.eq\("status", "inactive"\)/);
  assert.match(source, /verifyActivationPin/);
});

test("V1 redirect accepts only direct g.page review paths", () => {
  const source = read("app/r-v1/[cardCode]/route.ts");
  const start = source.indexOf("function isApprovedGoogleReviewUrl(");
  const end = source.indexOf("\nfunction failure(", start);
  assert.ok(start >= 0 && end > start);
  const fnSource = source.slice(start, end).replace("value: string): boolean", "value)");
  const approve = new Function(fnSource + "\nreturn isApprovedGoogleReviewUrl;")();
  assert.equal(approve("https://g.page/r/CUV5rS-Chn95EBM/review"), true);
  assert.equal(approve("https://g.page/r/CUV5rS-Chn95EBM"), false);
  assert.equal(approve("https://g.page.evil.example/r/CUV5rS-Chn95EBM/review"), false);
  assert.equal(approve("https://maps.app.goo.gl/AbCdEf123456789XY"), true);
});

test("V2/V3/WiV1 routes are untouched and V1 form labels direct review", () => {
  const ui = read("components/ActivationForm.tsx");
  assert.match(ui, /https:\/\/g.page\/r\/\.\.\.\/review/);
  const api = read("app/api/cards/activate/route.ts");
  assert.doesNotMatch(api, /v3Supabase|v2Supabase/);
});
