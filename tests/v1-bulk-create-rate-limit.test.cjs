const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const src = fs.readFileSync(path.join(__dirname, "../lib/v1-rate-limit.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
}}).outputText;
const module1 = { exports: {} };
new Function("require", "exports", "module", js)(require, module1.exports, module1);
const { getV1RateLimitStatus } = module1.exports;
const req = { headers: { get: key => key === "x-real-ip" ? "203.0.113.1" : null } };

async function checkWithSecret(callback) {
  const old = process.env.V1_RATE_LIMIT_SECRET;
  process.env.V1_RATE_LIMIT_SECRET = "fixture-v1-rate-limit-secret";
  try { return await callback(); } finally {
    if (old === undefined) delete process.env.V1_RATE_LIMIT_SECRET;
    else process.env.V1_RATE_LIMIT_SECRET = old;
  }
}

test("V1 provider bulk-create limiter passes successful requests", async () => {
  await checkWithSecret(async () => {
    let count = 0;
    const db = { rpc: async (name, params) => {
      assert.equal(name, "v1_check_rate_limit");
      assert.equal(params.p_window_seconds, 900);
      count++;
      return { data: true, error: null };
    }};
    assert.equal(await getV1RateLimitStatus(db, req, "create"), "allowed");
    assert.equal(count, 2, "global and per-IP checks are required");
  });
});

test("V1 provider bulk-create limiter distinguishes actual throttle and DB outage", async () => {
  await checkWithSecret(async () => {
    const restricted = { rpc: async () => ({ data: false, error: null }) };
    const databaseFailed = { rpc: async () => ({ data: null, error: { code: "PGRST202" } }) };
    assert.equal(await getV1RateLimitStatus(restricted, req, "create"), "limited");
    assert.equal(await getV1RateLimitStatus(databaseFailed, req, "create"), "unavailable");
    assert.equal(await getV1RateLimitStatus({rpc: () => {throw new Error("offline")}}, req, "create"), "unavailable");
  });
});

test("V1 bulk-create route reports infrastructure errors as 503, real throttles as 429", () => {
  const route = fs.readFileSync(path.join(__dirname, "../app/api/v1/provider/bulk-create/route.ts"), "utf8");
  assert.match(route, /getV1RateLimitStatus\(db, request, "create"\)/);
  assert.match(route, /if \(throttle === "unavailable"\)/);
  assert.match(route, /status: 503, headers: noStore/);
  assert.match(route, /if \(throttle === "limited"\)/);
  assert.match(route, /status: 429/);
  assert.doesNotMatch(route, /Limit percobaan tercapai atau layanan database belum tersedia/);
});
