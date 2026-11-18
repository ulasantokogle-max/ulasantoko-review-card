const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname,"..",p),"utf8");

const apiPaths = [
  "app/api/v1/provider/cards/route.ts",
  "app/r-v1/[cardCode]/route.ts",
  "app/api/cards/create/route.ts",
  "app/api/cards/activate/route.ts",
];
test("all V1 runtime endpoints resolve through the V1 database adapter",()=>{
  for(const path of apiPaths){
    const source=read(path);
    assert.match(source,/v1SupabaseServer/,"missing V1 adapter in "+path);
    assert.doesNotMatch(source,/import\s+\{[^}]*supabaseServer[^}]*\}\s+from\s+"@\/lib\/supabase"/,
      "shared V2 adapter must not be imported in "+path);
  }
});
test("V1 scan, activation and Provider lookup preserve old card codes",()=>{
  for(const path of [
    "app/api/v1/provider/cards/route.ts",
    "app/r-v1/[cardCode]/route.ts",
    "app/api/cards/activate/route.ts",
  ]) assert.ok(read(path).includes("^ULAS-\\d{4,}$"),"4-digit legacy code "+path);
});
test("isolated activation requires successful legacy-card migration",()=>{
  const src=read("app/api/cards/activate/route.ts");
  assert.match(src,/hasDedicatedV1Database\(\) && !\(await canIssueNewV1Cards\(\)\)/);
});
test("single card uses bulk RPC when isolated, but retains pre-cutover fallback",()=>{
  const src=read("app/api/cards/create/route.ts");
  assert.match(src,/if \(!cardCode && hasDedicatedV1Database\(\)\)/);
  assert.match(src,/supabase\.rpc\("v1_bulk_create_cards"/);
  assert.match(src,/if \(hasDedicatedV1Database\(\) && !\(await canIssueNewV1Cards\(\)\)\)/);
  assert.match(src,/while \(!cardCode && attempts < 10\)/);
  const ui=read("app/admin/cards/page.tsx");
  assert.match(ui,/Kosongkan untuk kode otomatis/);
});
test("public V1 card pages do not request PIN hashes or allow arbitrary links",()=>{
  const src=read("app/card/[cardCode]/page.tsx");
  assert.match(src,/.select\("card_code,status,business_name,google_review_url"\)/);
  assert.doesNotMatch(src,/.select\("\*"\)/);
  assert.match(src,/isApprovedV1ReviewUrl/);
  assert.match(src,/maps\.app\.goo\.gl/);
  assert.match(src,/v1SupabaseServer/);
});
test("V1-only env selector preserves legacy fallback until dedicated credentials exist",()=>{
  const src=read("lib/v1-supabase.ts");
  assert.match(src,/const url = dedicatedUrl \|\| process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(src,/const key = dedicatedKey \|\| process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(src,/isApprovedDedicatedV1DatabaseUrl/);
});
