const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const src=fs.readFileSync(path.join(__dirname,"../lib/v1-google-maps.ts"),"utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mapsUrl="https://maps.app.goo.gl/9QxANuCdbfTxQnr66";
const expanded="https://www.google.com/maps/place/MJH+(Media+Jump+Start+Hub)+Digital+Solution,+Gg.+H.Latif+1+No.192,+RT.002%2FRW.003,+Mustikajaya,+Mustika+Jaya,+Bekasi,+West+Java+17158/data=!4m2!3m1!1s0x2e6991c91bc634d3:0x9d0ddc34c1b76af9";
const id="ChIJ0zTGG8mRaS4R-Wq3wTTcDZ0";
const review_url="https://search.google.com/local/writereview?placeid="+id;
const entity={id,displayName:{text:"MJH (Media Jump Start Hub) Digital Solution"},formattedAddress:"Gg. H. Latif 1 No. 192, Mustikajaya, Bekasi, Jawa Barat 17158"};
function load(fetcher){
 const exports={};
 vm.runInNewContext(js,{exports,URL,fetch:fetcher,
 process:{env:{V1_GOOGLE_PLACES_API_KEY:"mock-key"}},AbortSignal,console,Math,Number,decodeURIComponent});
 return exports;
}
function response(body, status=200){
 return {ok:status===200,status,headers:{get:()=> "application/json"},
 text:async()=>JSON.stringify(body),json:async()=>body};
}
function links(fetchResult, details=entity){
 let calls=[];
 const api=load(async (u,opts)=>{
  calls.push(String(u));
  if(String(u).startsWith("https://maps.app.goo.gl/"))return {status:302,headers:{get:()=>expanded}};
  if(String(u)==="https://productmate.com/api/v1/google-review-link"){
   assert.equal(opts.method,"POST");
   assert.deepEqual(JSON.parse(opts.body),{maps_url:mapsUrl});
   return response(fetchResult);
  }
  assert.equal(u,"https://places.googleapis.com/v1/places/"+id);
  assert.equal(opts.headers["X-Goog-FieldMask"],"id,displayName,formattedAddress");
  return response(details);
 });
 return {api,calls};
}
test("Productmate fallback requires Google Details and never auto-approves",async()=>{
 const {api,calls}=links({place_id:id,review_url,verification:"not_verified"});
 const r=await api.suggestV1ProductmatePlace(mapsUrl);
 assert.equal(r.placeId,id);
 assert.equal(r.name,entity.displayName.text);
 assert.equal(r.verified,false);
 assert.equal(calls.length,3);
});
test("Productmate wrong place name is rejected",async()=>{
 const {api}=links({place_id:id,review_url,verification:"not_verified"},
 {...entity,displayName:{text:"Different Business"}});
 assert.equal(await api.suggestV1ProductmatePlace(mapsUrl),null);
});
test("Productmate conflicting address is rejected",async()=>{
 const {api}=links({place_id:id,review_url,verification:"not_verified"},
 {...entity,formattedAddress:"Jl. Salah No. 5, Jakarta 17159"});
 assert.equal(await api.suggestV1ProductmatePlace(mapsUrl),null);
});
test("Productmate forged review URL is rejected before Google details",async()=>{
 const {api,calls}=links({place_id:id,review_url:"https://evil.example/review",verification:"not_verified"});
 assert.equal(await api.suggestV1ProductmatePlace(mapsUrl),null);
 assert.equal(calls.length,2);
});
test("Productmate unverified output cannot be marked as verified",async()=>{
 const {api}=links({place_id:id,review_url,verification:"verified"});
 assert.equal(await api.suggestV1ProductmatePlace(mapsUrl),null);
});
test("Productmate fallback is only invoked after native resolver failure in both V1 paths",()=>{
 const activation=fs.readFileSync(path.join(__dirname,"../app/api/cards/activate/route.ts"),"utf8");
 const provider=fs.readFileSync(path.join(__dirname,"../app/api/v1/provider/maps-check/route.ts"),"utf8");
 for(const s of [activation,provider]){
  assert.ok(s.indexOf("suggestV1GooglePlace(")<s.indexOf("suggestV1ProductmatePlace("));
 }
 assert.match(activation,/confirmedPlaceId/);
 assert.match(activation,/!candidate.verified && !confirmedPlaceId/);
 assert.doesNotMatch(src,/V3_SUPABASE|v3Supabase|v2Supabase|wifiSupabase/);
});

test("Productmate candidate remains unverified when Google Places Details rejects the call",async()=>{
 const exports={};
 let calls=0;
 const fetcher=async (url,options)=>{
   calls++;
   if(String(url).startsWith("https://maps.app.goo.gl/"))
     return {status:302,headers:{get:()=>expanded}};
   if(String(url).includes("productmate.com"))
     return response({place_id:id,review_url,verification:"not_verified"});
   return {ok:false,status:403};
 };
 const api=load(fetcher);
 const candidate=await api.suggestV1ProductmatePlace(mapsUrl);
 assert.equal(candidate.placeId,id);
 assert.equal(candidate.verified,false);
 assert.equal(candidate.name,"MJH (Media Jump Start Hub) Digital Solution");
 assert.match(candidate.address,/17158/);
 assert.equal(calls,3);
});
test("Productmate fallback needs manual preview before activation",()=>{
 const ui=fs.readFileSync(path.join(__dirname,"../components/ActivationForm.tsx"),"utf8");
 assert.match(ui,/candidateConfirmed/);
 assert.match(ui,/Pratinjau formulir Google Review/);
 assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
 assert.match(ui,/Boolean\(candidate && !candidateConfirmed\)/);
 assert.match(ui,/setCandidateConfirmed\(false\)/);
});
