const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const file = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const activation = file("app/api/cards/activate/route.ts");
const single = file("app/api/cards/create/route.ts");
const bulk = file("app/api/v1/provider/bulk-create/route.ts");
const designer = file("app/api/v1/provider/validate-cards/route.ts");

test("V1 activation rejects incomplete isolated DB migration", () => {
  assert.match(activation, /hasDedicatedV1Database\(\)\s*&&\s*!\(await canIssueNewV1Cards\(\)\)/);
  assert.match(activation, /pemulihan data kartu lama belum diverifikasi/);
});
test("V1 single-card creation requires verified migration", () => {
  assert.match(single, /!await canIssueNewV1Cards\(\)/);
});
test("V1 bulk creation cannot fall back to shared legacy database", () => {
  assert.match(bulk, /!hasDedicatedV1Database\(\)/);
  assert.match(bulk, /!await canIssueNewV1Cards\(\)/);
});
test("V1 bulk designer requires isolated database and verified import", () => {
  assert.match(designer, /!hasDedicatedV1Database\(\)/);
  assert.match(designer, /!\(await canIssueNewV1Cards\(\)\)/);
});

test("V1 single-card creation protects PIN response from caches", () => {
  assert.match(single, /const noStore = \{ "Cache-Control": "no-store" \}/);
  assert.match(single, /status: 201, headers: noStore/);
  assert.match(single, /timingSafeEqual\(digest\(provided\), digest\(configured\)\)/);
  assert.doesNotMatch(single, /receivedAdminKey !== adminKey/);
});
