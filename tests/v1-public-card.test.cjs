const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../app/card/[cardCode]/page.tsx"), "utf8"
);
const start = source.indexOf("function isApprovedV1ReviewUrl(");
const end = source.indexOf("\nexport default async function", start);
assert.ok(start >= 0 && end > start, "V1 public page URL policy exists");
const js = ts.transpileModule(
  source.slice(start,end) + "\nexports.isApprovedV1ReviewUrl = isApprovedV1ReviewUrl;",
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;
const exported = {};
new Function("exports", js)(exported);
const isApproved = exported.isApprovedV1ReviewUrl;

test("public V1 card page allows only genuine Google Review composer links",()=>{
  assert.equal(isApproved("https://search.google.com/local/writereview?placeid=ChIJ123abc_DEF"), true);
  for(const input of [
    null, undefined, "javascript:alert(1)", "https://evil.example/steal",
    "http://search.google.com/local/writereview?placeid=ChIJ123",
    "https://search.google.com.evil.test/local/writereview?placeid=ChIJ123",
    "https://search.google.com/local/writereview",
    "https://user:password@search.google.com/local/writereview?placeid=abc",
    "https://search.google.com/maps?placeid=ChIJ123"
  ]) assert.equal(isApproved(input),false,String(input));
});

test("public V1 page does not query or render stored PINs",()=>{
  assert.match(source,/\.select\("card_code,status,business_name,google_review_url"\)/);
  assert.doesNotMatch(source,/\.select\("\*"\)/);
  assert.match(source,/safeReviewUrl\s*\?\s*<a/);
});
