const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("V1 migration gate remains locked until imported cards exist", async()=>{
  const previousUrl=process.env.V1_SUPABASE_URL;
  const previousKey=process.env.V1_SUPABASE_SERVICE_ROLE_KEY;
  process.env.V1_SUPABASE_URL="https://pkgdtrasmakjeykhvxhh.supabase.co";
  process.env.V1_SUPABASE_SERVICE_ROLE_KEY="unit-test-key-only";

  let gate=true, count=0, rpcError=false;
  const client={
    from(name){
      if(name==="v1_migration_gate")return {
        select:()=>({eq:()=>({maybeSingle:async()=>({
          data:{imported_and_verified:gate},error:rpcError?{message:"offline"}:null,
        })})}),
      };
      if(name==="cards")return{
        select:async()=>({count,error:rpcError?{message:"offline"}:null}),
      };
      throw Error("unexpected table "+name);
    },
  };
  const requireMock=(name)=>{
    if(name==="@supabase/supabase-js")return{createClient:()=>client};
    if(name==="@/lib/v1-project-guard")return{isApprovedDedicatedV1DatabaseUrl:()=>true};
    throw Error("unexpected module "+name);
  };
  const module={exports:{}};
  const js=ts.transpileModule(root("lib/v1-supabase.ts"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  new Function("require","module","exports",js)(requireMock,module,module.exports);
  const can=module.exports.canIssueNewV1Cards;
  try{
    assert.equal(await can(),false,"0 cards must be blocked even when flag=true");
    count=15;gate=false;
    assert.equal(await can(),false,"gate=false must block");
    gate=true;
    assert.equal(await can(),true,"gate=true with cards permits operation");
    rpcError=true;
    assert.equal(await can(),false,"database error fails closed");
  }finally{
    if(previousUrl===undefined)delete process.env.V1_SUPABASE_URL;
    else process.env.V1_SUPABASE_URL=previousUrl;
    if(previousKey===undefined)delete process.env.V1_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.V1_SUPABASE_SERVICE_ROLE_KEY=previousKey;
  }
});
test("diagnostics page and API require Provider authentication and hide secrets",()=>{
 const page=root("app/admin/provider/diagnostics/page.tsx");
 const api=root("app/api/v1/provider/status/route.ts");
 const provider=root("app/admin/provider/page.tsx");
 assert.match(provider,/href="\/admin\/provider\/diagnostics"/);
 assert.match(page,/\/api\/v1\/provider\/session/);
 assert.match(page,/\/api\/v1\/provider\/status/);
 assert.match(api,/if \(!isProviderAuthenticated\(request\)\)/);
 assert.match(api,/status: 401/);
 assert.match(api,/imported && count > 0/);
 assert.doesNotMatch(api,/serviceRoleKey:/);
});
