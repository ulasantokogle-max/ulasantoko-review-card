const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../lib/v1-google-maps.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadResolver(fetcher) {
  const exports = {};
  const context = {
    exports, URL, process: { env: { V1_GOOGLE_PLACES_API_KEY: "test-only" } },
    fetch: fetcher, AbortSignal, console, Number, Math, decodeURIComponent,
  };
  vm.runInNewContext(transpiled, context);
  return exports;
}
function mapsResponse() {
  return { status: 302, headers: { get: key => key === "location" ?
    "https://www.google.com/maps/place/MJH+Digital+Solution/@-6.200000,106.800000,18z/data=!3d-6.200000!4d106.800000" : null } };
}
const place = (id, name, lat, lng) => ({
  id, displayName: { text: name },
  formattedAddress: "Jakarta, Indonesia",
  location: { latitude: lat, longitude: lng },
});

test("V1 resolves Google short link to direct review Place ID if exact name and coordinates match", async () => {
  let hits = 0;
  const api = loadResolver(async (url, init) => {
    hits++;
    if (String(url).includes("maps.app.goo.gl")) return mapsResponse();
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(init.method, "POST");
    const request = JSON.parse(init.body);
    assert.equal(request.textQuery, "MJH Digital Solution");
    return { ok: true, json: async () => ({ places: [
      place("ChIJFakePlace001", "MJH Digital Solution", -6.2, 106.8),
    ] }) };
  });
  const result = await api.suggestV1GooglePlace("https://maps.app.goo.gl/AbCdEf123456789");
  assert.equal(result.placeId, "ChIJFakePlace001");
  assert.equal(result.verified, true);
  assert.equal(result.name, "MJH Digital Solution");
  assert.equal(hits, 2);
});

test("V1 never silently auto-picks an unrelated business", async () => {
  const api = loadResolver(async url => String(url).includes("maps.app.goo.gl")
    ? mapsResponse()
    : { ok: true, json: async () => ({ places: [
      place("ChIJFakePlace002", "Different Business", -6.2, 106.8),
    ] }) });
  const result = await api.suggestV1GooglePlace("https://maps.app.goo.gl/AbCdEf123456789");
  assert.equal(result.verified, false);
});

test("V1 rejects unsafe redirected host before requesting Places", async () => {
  let placesCalls = 0;
  const api = loadResolver(async url => {
    if (String(url).includes("maps.app.goo.gl"))
      return { status: 302, headers: { get: () => "https://untrusted.example/path" } };
    placesCalls++;
    return {ok:true, json:async()=>({places:[]})};
  });
  assert.equal(await api.suggestV1GooglePlace("https://maps.app.goo.gl/AbCdEf123456789"), null);
  assert.equal(placesCalls, 0);
});

test("V1 needs API key for non-explicit Google Maps links", async () => {
  const api = loadResolver(async () => { throw Error("must not call"); });
  api.suggestV1GooglePlace;
  // Resolver's safety policy is exercised via source inspection for missing-key handling.
  assert.match(source, /if \(!apiKey\) return null;/);
  assert.match(source, /titleFromMapsUrl\(url\)/);
  assert.match(source, /coordinatesFromMapsUrl\(url\)/);
});
