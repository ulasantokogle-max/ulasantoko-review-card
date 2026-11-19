const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname,"../lib/v1-google-maps.ts"),"utf8");
const script = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const link="https://maps.app.goo.gl/9QxANuCdbfTxQnr66";
const expanded="https://www.google.com/maps/place/MJH+(Media+Jump+Start+Hub)+Digital+Solution,+Gg.+H.Latif+1+No.192,+Mustikajaya,+Bekasi+17158";
const id="ChIJ0zTGG8mRaS4R-Wq3wTTcDZ0";
const item={id,displayName:{text:"MJH (Media Jump Start Hub) Digital Solution"},formattedAddress:"Gg. H. Latif 1 No. 192, Bekasi 17158",location:{latitude:-6.31,longitude:107.02}};
function instantiate(nativeItems, productmateId=id, details=item) {
 const exports={};
 const calls=[];
 const fetch=async (url, options={})=>{
  const urlString=String(url); calls.push(urlString);
  if(urlString.startsWith("https://maps.app.goo.gl/"))return {status:302,headers:{get:()=>expanded}};
  if(urlString.endsWith("places:searchText"))return {ok:true,json:async()=>({places:nativeItems})};
  if(urlString.includes("productmate.com/api"))return {
   ok:true,status:200,headers:{get:()=> "application/json"},
   text:async()=>JSON.stringify({place_id:productmateId,review_url:"https://search.google.com/local/writereview?placeid="+productmateId,verification:"not_verified"})
  };
  if(urlString.includes("places.googleapis.com/v1/places/"))return {ok:true,json:async()=>details};
  throw Error("Unexpected URL "+urlString);
 };
 vm.runInNewContext(script,{exports,fetch,URL,process:{env:{V1_GOOGLE_PLACES_API_KEY:"mock-key"}},AbortSignal,console,Math,Number,decodeURIComponent});
 return {api:exports,calls};
}
test("parallel resolver returns Google verified result when Google and Productmate agree",async()=>{
 const ctx=instantiate([item]);
 const result=await ctx.api.resolveV1GoogleReviewCandidate(link,item.displayName.text);
 assert.equal(result.reason,"ok");
 assert.equal(result.source,"google");
 assert.equal(result.candidate.placeId,id);
 assert.equal(result.google,"found");
 assert.equal(result.fallback,"found");
});
test("parallel resolver uses independently verified Productmate candidate if Google search fails",async()=>{
 const ctx=instantiate([]);
 const result=await ctx.api.resolveV1GoogleReviewCandidate(link,item.displayName.text);
 assert.equal(result.reason,"ok");
 assert.equal(result.source,"productmate");
 assert.equal(result.candidate.verified,false);
});
test("parallel resolver refuses different Place IDs from two providers",async()=>{
 const other={...item,id:"ChIJDifferentPlace123"};
 const ctx=instantiate([other]);
 const result=await ctx.api.resolveV1GoogleReviewCandidate(link,item.displayName.text);
 assert.equal(result.reason,"provider_conflict");
 assert.equal(result.candidate,null);
});
test("parallel candidate lookup starts both providers before awaiting either",()=>{
 assert.match(source,/Promise\.allSettled\(\[/);
 assert.match(source,/suggestV1GooglePlace\(url, businessName\)/);
 assert.match(source,/suggestV1ProductmatePlace\(url\)/);
});
