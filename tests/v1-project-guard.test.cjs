const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname,"../lib/v1-project-guard.ts"),"utf8");
const compiled = ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const output = {exports:{}};
new Function("module","exports","URL",compiled)(output,output.exports,URL);
const {isApprovedDedicatedV1DatabaseUrl:isApproved} = output.exports;

test("accepts only exact isolated Supabase V1 origin",()=>{
  assert.equal(isApproved("https://pkgdtrasmakjeykhvxhh.supabase.co"),true);
  assert.equal(isApproved("https://pkgdtrasmakjeykhvxhh.supabase.co/"),true);
});
test("rejects V3, WiV1, legacy project and arbitrary domains",()=>{
  for (const host of [
    "sflwutmloshwijnejtqc.supabase.co",
    "fzzburisxfnyurkkcqbl.supabase.co",
    "mnpherdmkecbogomzlnk.supabase.co",
    "evil.example",
    "pkgdtrasmakjeykhvxhh.supabase.co.evil.example"
  ]) assert.equal(isApproved("https://"+host+"/"),false,host);
});
test("rejects insecure origins, URL credentials, ports and paths",()=>{
  for(const value of [
    "http://pkgdtrasmakjeykhvxhh.supabase.co/",
    "https://username:pass@pkgdtrasmakjeykhvxhh.supabase.co/",
    "https://pkgdtrasmakjeykhvxhh.supabase.co:9443/",
    "https://pkgdtrasmakjeykhvxhh.supabase.co/rest/v1/",
    "https://pkgdtrasmakjeykhvxhh.supabase.co/?foo=1",
    "not-a-url"
  ]) assert.equal(isApproved(value),false,value);
});
test("V1-specific client invokes project boundary guard before creating client",()=>{
  const client=fs.readFileSync(path.join(__dirname,"../lib/v1-supabase.ts"),"utf8");
  assert.match(client,/if \(dedicatedUrl && !isApprovedDedicatedV1DatabaseUrl\(dedicatedUrl\)\)/);
  assert.match(client,/throw new Error\("V1 database URL does not match the approved isolated project"\)/);
});
