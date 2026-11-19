const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("V1 Provider links to the dedicated NFC writer", () => {
  assert.match(read("app/admin/provider/page.tsx"), /href="\/admin\/provider\/nfc-writer"/);
});
test("NFC writer uses V1-only authenticated card lookup and immutable physical URL", () => {
  const page = read("app/admin/provider/nfc-writer/page.tsx");
  assert.match(page, /\/api\/v1\/provider\/session/);
  assert.match(page, /\/api\/v1\/provider\/cards\?card_code=/);
  assert.match(page, /https:\/\/app\.ulasantoko\.space\/r-v1\//);
  assert.match(page, /recordType: "url"/);
  assert.match(page, /confirmWrite/);
  assert.doesNotMatch(page, /\/api\/v3\/|v3Supabase|\/api\/v2\/|supabaseServer\(/);
});
test("NFC writer never edits server data or card activation", () => {
  const page = read("app/admin/provider/nfc-writer/page.tsx");
  assert.doesNotMatch(page, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(page, /activation_pin|pin_hash|rpc\(/);
});
