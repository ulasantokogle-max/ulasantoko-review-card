const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("V1 Maps check is provider-only, same-origin and rate-limited", () => {
 const api = read("app/api/v1/provider/maps-check/route.ts");
 assert.match(api,/isProviderAuthenticated\(request\)/);
 assert.match(api,/origin !== new URL\(request.url\).origin/);
 assert.match(api,/hasDedicatedV1Database\(\)/);
 assert.match(api,/getV1RateLimitStatus\(v1SupabaseServer\(\), request, "create"\)/);
 assert.match(api,/!allowed.includes\(u.hostname\)/);
 assert.match(api,/Cache-Control":"no-store, private/);
});

test("V1 Maps check reuses the production resolver but never activates a card", () => {
 const api = read("app/api/v1/provider/maps-check/route.ts");
 assert.match(api,/suggestV1GooglePlace\(mapsUrl,businessName\)/);
 assert.match(api,/resolveV1GooglePlaceId\(mapsUrl\)/);
 assert.match(api,/candidate.verified \? "resolved" : "confirm"/);
 assert.doesNotMatch(api,/\.from\("cards"\)/);
 assert.doesNotMatch(api,/\.update\(/);
 assert.doesNotMatch(api,/activation_pin|pin_hash/);
 assert.doesNotMatch(api,/V3_|v3Supabase|v2Supabase|WiV1/);
});

test("V1 diagnostics shows the result and requires explicit inspection", () => {
 const ui = read("app/admin/provider/diagnostics/page.tsx");
 assert.match(ui,/Periksa Tanpa Aktivasi/);
 assert.match(ui,/\/api\/v1\/provider\/maps-check/);
 assert.match(ui,/MJH \(Media Jump Start Hub\) Digital Solution/);
 assert.match(ui,/noopener noreferrer/);
 assert.match(ui,/Pemeriksaan ini belum mengaktifkan kartu/);
});
