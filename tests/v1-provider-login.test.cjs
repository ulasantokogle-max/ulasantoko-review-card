const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const load = (name) => fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const compile = (source) => ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
}).outputText;

function rateLimiter() {
  const module = {exports:{}};
  new Function("require","module","exports",compile(load("lib/v1-rate-limit.ts")))(require,module,module.exports);
  return module.exports.getV1RateLimitStatus;
}
const originalAdminKey = process.env.ADMIN_KEY;
const originalRateSecret = process.env.V1_RATE_LIMIT_SECRET;
const request = {headers:{get:(name)=>name==="x-real-ip"?"10.10.10.10":null}};

test("actual rate-limit denial is distinguished from unavailable DB",async()=>{
  process.env.V1_RATE_LIMIT_SECRET="unit-test-only-secret";
  const status=rateLimiter();
  assert.equal(await status({rpc:async()=>({data:false,error:null})},request,"login"),"limited");
  assert.equal(await status({rpc:async()=>({data:null,error:{code:"PGRST202"}})},request,"login"),"unavailable");
  assert.equal(await status({rpc:async()=>{throw Error("database paused")}},request,"login"),"unavailable");
  assert.equal(await status({rpc:async()=>({data:true,error:null})},request,"login"),"allowed");
  if(originalRateSecret===undefined)delete process.env.V1_RATE_LIMIT_SECRET;
  else process.env.V1_RATE_LIMIT_SECRET=originalRateSecret;
});

function providerRoute(limitState="unavailable") {
  let lookedUpDb=0;
  let checkedLimit=0;
  const module={exports:{}};
  const json=(data,options={})=>({
    data,status:options.status||200,headers:options.headers||{},
    cookies:{values:{},set(name,value){this.values[name]=value;}},
  });
  const mockRequire=(name)=>{
    if(name==="next/server")return {NextResponse:{json}};
    if(name==="node:crypto")return require(name);
    if(name==="@/lib/supabase")return {supabaseServer:()=>{lookedUpDb++;return {};}};
    if(name==="@/lib/v1-rate-limit")return {getV1RateLimitStatus:async()=>{checkedLimit++;return limitState;}};
    if(name==="@/lib/v1-provider-auth")return {
      PROVIDER_COOKIE:"v1_provider_session",createProviderSession:()=>"signed-session",
      isProviderAuthenticated:()=>false,providerCookieOptions:{httpOnly:true,sameSite:"strict",path:"/"}
    };
    throw new Error("Unexpected import "+name);
  };
  new Function("require","module","exports",compile(load("app/api/v1/provider/session/route.ts")))(
    mockRequire,module,module.exports);
  return {
    POST:module.exports.POST,
    getCounts:()=>({lookedUpDb,checkedLimit}),
  };
}

test("correct Provider Admin Key logs in even with paused V1 card database",async()=>{
  process.env.ADMIN_KEY="provider-unit-test-key";
  const route=providerRoute();
  const response=await route.POST({json:async()=>({admin_key:"provider-unit-test-key"})});
  assert.equal(response.status,200);
  assert.equal(response.data.authenticated,true);
  assert.equal(response.cookies.values.v1_provider_session,"signed-session");
  assert.deepEqual(route.getCounts(),{lookedUpDb:0,checkedLimit:0});
  process.env.ADMIN_KEY=originalAdminKey;
});
test("incorrect key + unavailable rate-limit backend returns 503, not fake 429",async()=>{
  process.env.ADMIN_KEY="provider-unit-test-key";
  const route=providerRoute("unavailable");
  const response=await route.POST({json:async()=>({admin_key:"wrong-key"})});
  assert.equal(response.status,503);
  assert.doesNotMatch(response.data.message,/terlalu banyak percobaan/i);
  assert.deepEqual(route.getCounts(),{lookedUpDb:1,checkedLimit:1});
  process.env.ADMIN_KEY=originalAdminKey;
});
test("real exceeded rate-limit returns 429 with Retry-After",async()=>{
  process.env.ADMIN_KEY="provider-unit-test-key";
  const route=providerRoute("limited");
  const response=await route.POST({json:async()=>({admin_key:"wrong-key"})});
  assert.equal(response.status,429);
  assert.equal(response.headers["Retry-After"],"900");
  process.env.ADMIN_KEY=originalAdminKey;
});
test("incorrect key with working limiter returns 401",async()=>{
  process.env.ADMIN_KEY="provider-unit-test-key";
  const route=providerRoute("allowed");
  const response=await route.POST({json:async()=>({admin_key:"wrong-key"})});
  assert.equal(response.status,401);
  process.env.ADMIN_KEY=originalAdminKey;
});
