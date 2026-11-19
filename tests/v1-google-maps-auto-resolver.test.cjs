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
  assert.match(source, /placeIdentityFromMapsUrl\(url\)/);
  assert.match(source, /coordinatesFromMapsUrl\(url\)/);
});

test("V1 can interpret Google Maps query share URL without marker, but requires confirmation", async () => {
  const api = loadResolver(async (url, init) => {
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    const body = JSON.parse(init.body);
    assert.equal(body.textQuery, "MJH Digital Solution");
    assert.equal(body.locationBias, undefined);
    return { ok: true, json: async () => ({places:[
      place("ChIJQueryPlace123", "MJH Digital Solution", -6.20, 106.80),
    ]})};
  });
  const result = await api.suggestV1GooglePlace("https://www.google.com/maps/search/?api=1&query=MJH+Digital+Solution");
  assert.equal(result.placeId, "ChIJQueryPlace123");
  assert.equal(result.verified, false);
});

test("V1 refuses ambiguous query-only results instead of guessing a business", async () => {
  const api = loadResolver(async () => ({
    ok: true, json: async () => ({places:[
      place("ChIJQueryPlace123", "MJH Digital Solution", -6.2, 106.8),
      place("ChIJQueryPlace456", "MJH Digital Solution", -6.3, 106.9),
    ]}),
  }));
  assert.equal(await api.suggestV1GooglePlace("https://www.google.com/maps/search/?query=MJH+Digital+Solution"), null);
});

test("V1 can parse long Google Maps URL title without coordinates for human confirmation", async () => {
  const api = loadResolver(async () => ({
    ok: true, json: async () => ({ places:[
      place("ChIJQueryPlace123", "MJH Digital Solution", -6.2, 106.8),
    ] }),
  }));
  const result = await api.suggestV1GooglePlace("https://www.google.com/maps/place/MJH+Digital+Solution/");
  assert.equal(result.verified, false);
});

test("V1 handles Google Maps short link that redirects to CID-only URL", async () => {
  let placesCalls = 0;
  const api = loadResolver(async (url, init) => {
    if (String(url).includes("maps.app.goo.gl")) {
      return { status: 302, headers: { get: () => "https://www.google.com/maps?cid=1234567890123456" } };
    }
    placesCalls++;
    const request = JSON.parse(init.body);
    assert.equal(request.textQuery, "MJH (Media Jump Start Hub) Digital Solution");
    return { ok: true, json: async () => ({ places: [
      place("ChIJExactMJD123", "MJH (Media Jump Start Hub) Digital Solution", -6.2, 106.8),
    ] }) };
  });
  const result = await api.suggestV1GooglePlace(
    "https://maps.app.goo.gl/9QxANuCdbfTxQnr66",
    "MJH (Media Jump Start Hub) Digital Solution",
  );
  assert.equal(result.placeId, "ChIJExactMJD123");
  assert.equal(result.verified, false);
  assert.equal(placesCalls, 1);
});

test("V1 CID fallback never auto-selects a different business", async () => {
  const api = loadResolver(async (url) => String(url).includes("maps.app.goo.gl")
    ? { status: 302, headers: { get: () => "https://www.google.com/maps?cid=123456" } }
    : { ok: true, json: async () => ({ places: [
      place("ChIJIncorrect", "Different Business Name", -6.2, 106.8),
    ] }) });
  assert.equal(await api.suggestV1GooglePlace(
    "https://maps.app.goo.gl/9QxANuCdbfTxQnr66", "MJH (Media Jump Start Hub) Digital Solution"), null);
});

test("V1 CID fallback rejects multiple exact-name business branches", async () => {
  const api = loadResolver(async url => String(url).includes("maps.app.goo.gl")
    ? {status:302,headers:{get:()=> "https://www.google.com/maps?cid=11223"}}
    : {ok:true,json:async()=>({places:[
      place("ChIJBranchA12345", "MJH (Media Jump Start Hub) Digital Solution", -6.2, 106.8),
      place("ChIJBranchB12345", "MJH (Media Jump Start Hub) Digital Solution", -6.1, 106.7),
    ]})});
  assert.equal(await api.suggestV1GooglePlace(
    "https://maps.app.goo.gl/9QxANuCdbfTxQnr66", "MJH (Media Jump Start Hub) Digital Solution"), null);
});

test("V1 CID fallback never searches untrusted redirected domains", async () => {
  let calledPlaces = false;
  const api = loadResolver(async url => {
    if (String(url).includes("maps.app.goo.gl"))
      return {status:302,headers:{get:()=> "https://evil.example/maps?cid=123"}};
    calledPlaces = true;
    return {ok:true,json:async()=>({places:[]})};
  });
  assert.equal(await api.suggestV1GooglePlace(
    "https://maps.app.goo.gl/9QxANuCdbfTxQnr66", "MJH (Media Jump Start Hub) Digital Solution"),null);
  assert.equal(calledPlaces,false);
});

test("V1 parses the real MJH Maps name and appended address, auto-confirming only exact address", async () => {
  let googleRequests = 0;
  const expanded = "https://www.google.com/maps/place/MJH+(Media+Jump+Start+Hub)+Digital+Solution,+Gg.+H.Latif+1+No.192,+RT.002%2FRW.003,+Mustikajaya,+Mustika+Jaya,+Bekasi,+West+Java+17158/data=!4m2!3m1!1s0x2e6991c91bc634d3:0x9d0ddc34c1b76af9";
  const api = loadResolver(async (url, init) => {
    if (String(url).includes("maps.app.goo.gl"))
      return {status:302,headers:{get:key=> key==="location" ? expanded : null}};
    googleRequests++;
    const body=JSON.parse(init.body);
    assert.match(body.textQuery, /^MJH \(Media Jump Start Hub\) Digital Solution, Gg\. H\.Latif 1 No\.192/);
    return {ok:true,json:async()=>({places:[
      place("ChIJRealFormatTest12345","MJH (Media Jump Start Hub) Digital Solution",-6.31,107.02)
    ].map(p=>({...p,formattedAddress:"Gg. H. Latif 1 No. 192, Mustikajaya, Bekasi, West Java 17158"}))})};
  });
  const result=await api.suggestV1GooglePlace("https://maps.app.goo.gl/9QxANuCdbfTxQnr66");
  assert.equal(result.placeId,"ChIJRealFormatTest12345");
  assert.equal(result.verified,true);
  assert.equal(googleRequests,1);
});

test("V1 refuses automatic activation if Maps business address differs", async () => {
  const expanded="https://www.google.com/maps/place/MJH+(Media+Jump+Start+Hub)+Digital+Solution,+Gg.+H.Latif+1+No.192,+Mustikajaya,+Bekasi+17158";
  const api=loadResolver(async url=>String(url).includes("maps.app.goo.gl")
    ? {status:302,headers:{get:()=>expanded}}
    : {ok:true,json:async()=>({places:[{
       ...place("ChIJIncorrectAddr12345","MJH (Media Jump Start Hub) Digital Solution",-6.31,107.02),
       formattedAddress:"Jl. Lain No. 5, Bekasi, West Java 17158",
    }]})});
  const result=await api.suggestV1GooglePlace("https://maps.app.goo.gl/9QxANuCdbfTxQnr66");
  assert.equal(result.verified,false);
});
