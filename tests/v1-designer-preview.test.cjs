const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
function loadTypescript(file,stubs={}){
  const js=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};
  new Function("require","exports","module",js)((name)=>stubs[name]??require(name),mod.exports,mod);
  return mod.exports;
}
const layouts=loadTypescript("lib/v1-designer-layout.ts");
const page=read("app/admin/provider/bulk-designer/page.tsx");
const exportsSource=read("lib/v1-designer-export.ts");
test("V1 designer supports four locally uploaded templates and front/back preview",()=>{
  assert.equal(layouts.V1_DESIGNS.length,4);
  assert.match(page,/Upload PNG\/JPG/);
  assert.match(page,/setTemplates/);
  assert.match(page,/Preview kartu pertama/);
  assert.match(page,/setSide\("front"\)/);
  assert.match(page,/setSide\("back"\)/);
  assert.match(page,/pixels:650/);
});
test("V1 designer enforces verification and never exports a PIN",()=>{
  assert.match(page,/parseV1BulkCsv\(text\)/);
  assert.match(page,/await verifyCodes\(codes\)/);
  assert.match(page,/await verifyCodes\(cards\.map\(c=>c\.code\)\)/);
  assert.match(page,/fetch\("\/api\/v1\/provider\/session"/);
  assert.match(page,/fetch\("\/api\/v1\/provider\/validate-cards"/);
  assert.doesNotMatch(page,/activation_pin/);
  assert.doesNotMatch(exportsSource,/activation_pin|pin_hash|SUPABASE_SERVICE_ROLE_KEY/);
  assert.equal(layouts.v1CardUrl("ULAS-00206"),"https://app.ulasantoko.space/r-v1/ULAS-00206");
  assert.throws(()=>layouts.v1CardUrl("https://yukreview.id/ULAS-00206"),/Kode V1/);
});
test("A3 and A3+ layouts match physical paper sizes and grid capacities",()=>{
  assert.deepEqual(layouts.v1PageLayout("a3"),{columns:3,rows:2,pageWidthMm:420,pageHeightMm:297,cardsPerPage:6});
  assert.deepEqual(layouts.v1PageLayout("a3plus"),{columns:3,rows:4,pageWidthMm:329,pageHeightMm:483,cardsPerPage:12});
  for(const paper of ["a3","a3plus"]){
    const layout=layouts.v1PageLayout(paper);
    for(const flip of ["long","short"]){
      const slots=Array.from({length:layout.cardsPerPage},(_,i)=>layouts.v1MirrorSlot(i,paper,flip));
      assert.equal(new Set(slots).size,layout.cardsPerPage);
      assert.deepEqual(slots.map(i=>slots[i]),Array.from({length:layout.cardsPerPage},(_,i)=>i));
    }
  }
});
test("QR position and size clamp within card safety margins",()=>{
  const p=layouts.v1SafePlacement({x:0,y:200,size:90});
  assert.equal(p.size,43);
  assert.ok(p.x>=24.5&&p.y<=75.5);
  assert.deepEqual(layouts.v1DefaultPlacement("navy_left"),{x:29,y:55,size:35});
  assert.deepEqual(layouts.v1DefaultPlacement("white_right"),{x:71,y:55,size:35});
});
test("export module generates real PNG, client-side ZIP and A3+ print options",()=>{
  assert.match(exportsSource,/errorCorrectionLevel:"H"/);
  assert.match(exportsSource,/size>2400/);
  assert.match(exportsSource,/image\/png/);
  assert.match(exportsSource,/application\/zip/);
  assert.match(page,/v1Zip\(files\)/);
  assert.match(page,/v1MirrorSlot\(j,paper,duplexFlip\)/);
  assert.match(page,/329mm 483mm/);
  assert.match(page,/width:100mm/);
  assert.match(page,/await verifyCodes\(cards\.map\(c=>c\.code\)\)/);
});
test("ZIP export produces a valid local and central directory",()=>{
  const mod=loadTypescript("lib/v1-designer-export.ts",{
    "qrcode":{},
    "@/lib/v1-designer-layout":layouts
  });
  const blob=mod.v1Zip([
    {name:"ULAS-00206-depan.png",bytes:new Uint8Array([1,2,3,4])},
    {name:"ULAS-00207-depan.png",bytes:new Uint8Array([5,6])},
  ]);
  assert.equal(blob.type,"application/zip");
  return blob.arrayBuffer().then(buf=>{
    const bytes=new Uint8Array(buf),view=new DataView(buf);
    assert.equal(view.getUint32(0,true),0x04034b50);
    assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);
    assert.equal(view.getUint16(bytes.length-22+10,true),2);
    const text=new TextDecoder().decode(bytes);
    assert.ok(text.includes("ULAS-00206-depan.png"));
    assert.ok(text.includes("ULAS-00207-depan.png"));
  });
});
