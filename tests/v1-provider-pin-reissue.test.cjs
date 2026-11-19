const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Provider PIN reissue requires session, same-origin and dedicated V1", () => {
 const api = read("app/api/v1/provider/reissue-pin/route.ts");
 assert.match(api,/isProviderAuthenticated\(req\)/);
 assert.match(api,/origin !== new URL\(req.url\).origin/);
 assert.match(api,/hasDedicatedV1Database\(\)/);
 assert.match(api,/canIssueNewV1Cards\(\)/);
 assert.match(api,/getV1RateLimitStatus\(db, req, "create"\)/);
 assert.match(api,/confirmation !== code/);
});
test("Reissue rotates hash only on inactive card, returns one-time new PIN", () => {
 const api=read("app/api/v1/provider/reissue-pin/route.ts");
 assert.match(api,/generateActivationPin\(\)/);
 assert.match(api,/hashActivationPin\(pin\)/);
 assert.match(api,/\.eq\("status", "inactive"\)/);
 assert.match(api,/activation_pin: pin/);
 assert.doesNotMatch(api,/\.select\("activation_pin_hash"/);
 assert.doesNotMatch(api,/console\.log\(pin\)/);
});
test("Provider and activation input expose safe recovery flow without bypassing PIN", () => {
 const provider=read("app/admin/provider/page.tsx");
 const ui=read("components/ActivationForm.tsx");
 const recovery=read("app/admin/provider/reissue-pin/page.tsx");
 assert.match(provider,/href="\/admin\/provider\/reissue-pin"/);
 assert.match(ui,/autoComplete="off"/);
 assert.match(ui,/showPin \? "text" : "password"/);
 assert.match(recovery,/card.status !== "inactive"/);
 assert.match(recovery,/Terbitkan PIN Baru dan Batalkan PIN Lama/);
 const activation=read("app/api/cards/activate/route.ts");
 assert.match(activation,/verifyActivationPin\(/);
});
