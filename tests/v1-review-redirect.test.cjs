const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Exercise the exact URL policy function in the V1 route without credentials or Supabase.
// Keep this test scoped to V1; it does not modify V2 or the physical QR mappings.
const source = fs.readFileSync(
  path.join(__dirname, "../app/r-v1/[cardCode]/route.ts"),
  "utf8"
);
const start = source.indexOf("function isApprovedGoogleReviewUrl(");
const end = source.indexOf("\nfunction failure(", start);
assert.ok(start >= 0 && end > start, "V1 redirect URL policy exists");
const fnSource = source.slice(start, end).replace(
  "value: string): boolean",
  "value)"
);
const isApproved = new Function(fnSource + "\nreturn isApprovedGoogleReviewUrl;")();

test("valid Google review composer destination allowed", () => {
  assert.equal(isApproved("https://search.google.com/local/writereview?placeid=ChIJ123abc_DEF"), true);
});

test("other destinations are rejected", () => {
  for (const url of [
    "http://search.google.com/local/writereview?placeid=abc",
    "https://evil.example/local/writereview?placeid=abc",
    "https://search.google.com.evil.example/local/writereview?placeid=abc",
    "https://search.google.com/local/writereview",
    "https://search.google.com/local/writereview?placeid=%2F%2Fbad",
    "https://search.google.com/maps?placeid=abc",
    "https://user:pass@search.google.com/local/writereview?placeid=abc",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(isApproved(url), false, url);
  }
});
