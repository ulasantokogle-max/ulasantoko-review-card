const test=require("node:test"); const assert=require("node:assert/strict"); const fs=require("node:fs"); const path=require("node:path");
const read=(p)=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const provider=read("app/admin/provider/page.tsx");
const bulk=read("app/admin/provider/bulk-create/page.tsx");
const designer=read("app/admin/provider/bulk-designer/page.tsx");
const bulkApi=read("app/api/v1/provider/bulk-create/route.ts");
const statusApi=read("app/api/v1/provider/status/route.ts");
const validateApi=read("app/api/v1/provider/validate-cards/route.ts");
test("Provider dashboard exposes both mass-create and designer menus",()=>{
 assert.match(provider,/href="\/admin\/provider\/bulk-create"/);
 assert.match(provider,/href="\/admin\/provider\/bulk-designer"/);
});
test("bulk-create page only enables action after verified database readiness",()=>{
 assert.match(bulk,/readiness\?\.ready !== true/);
 assert.match(bulk,/fetch\("\/api\/v1\/provider\/status"/);
 assert.match(bulk,/fetch\("\/api\/v1\/provider\/session"/);
});
test("bulk APIs cannot fall back to old shared credentials",()=>{
 assert.match(bulkApi,/if \(!hasDedicatedV1Database\(\)\)/);
 assert.match(bulkApi,/!await canIssueNewV1Cards\(\)/);
 assert.match(validateApi,/!hasDedicatedV1Database\(\)/);
 assert.match(validateApi,/!\(await canIssueNewV1Cards\(\)\)/);
 assert.match(statusApi,/const configured = hasDedicatedV1Database\(\);/);
 assert.match(statusApi,/if \(!configured\)/);
 assert.match(statusApi,/ready: false/);
});
test("designer checks session and verifies V1-only CSV before print",()=>{
 assert.match(designer,/parseV1BulkCsv\(text\)/);
 assert.match(designer,/await verifyCodes\(cards\.map\(c => c\.code\)\)/);
 assert.match(designer,/fetch\("\/api\/v1\/provider\/session"/);
});
