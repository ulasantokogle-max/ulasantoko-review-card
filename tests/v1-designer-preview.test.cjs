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
  assert.match(page,/await verifyCodes\(cards\.map\(c => c\.code\)\)/);
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
  assert.match(page,/await verifyCodes\(cards\.map\(c => c\.code\)\)/);
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

test("uploaded templates mask their old right-hand QR when new V1 QR is on the left",()=>{
  const defaultCover=layouts.v1DefaultTemplateQrCleanup("navy_left");
  assert.deepEqual(defaultCover,{enabled:true,x:69.5,y:58.5,size:31,color:"#ffffff"});
  assert.deepEqual(layouts.v1DefaultTemplateQrCleanup("white_right"),
    {enabled:true,x:30.5,y:58.5,size:31,color:"#ffffff"});
  const safe=layouts.v1SafeTemplateQrCleanup({enabled:true,x:999,y:-10,size:90,color:"invalid"});
  assert.equal(safe.size,43);
  assert.equal(safe.color,"#ffffff");
  assert.ok(safe.x<=100-safe.size/2 && safe.y>=safe.size/2);
});
test("same template QR cleanup is used by live preview, HD PNG and print exports",()=>{
  assert.match(page,/templateQrCleanup:templates\[selectedDesign\]\?templateCleanup\[selectedDesign\]:undefined/);
  assert.match(page,/templateQrCleanup:templates\[design\]\?templateCleanup\[design\]:undefined/);
  assert.match(page,/setTemplateCleanup/);
  assert.match(page,/v1UploadedTemplatePlacement\(key\)/);
  assert.match(page,/Tutup QR lama yang ada di gambar template/);
  assert.match(exportsSource,/if\(settings\.templateQrCleanup\?\.enabled\)/);
  assert.match(exportsSource,/v1SafeTemplateQrCleanup\(settings\.templateQrCleanup\)/);
  assert.ok(exportsSource.indexOf("v1SafeTemplateQrCleanup(settings.templateQrCleanup)")
    < exportsSource.indexOf("const qr=await qrCanvas"));
});
test("renderer masks uploaded QR before drawing exactly one new verified V1 QR",async()=>{
  const logs=[];
  const previousDocument=global.document;
  const previousImage=global.Image;
  const context={
    fillRect(...args){logs.push({op:"fillRect",args,color:this.fillStyle});},
    drawImage(...args){logs.push({op:"drawImage",source:args[0]});},
    fillText(...args){logs.push({op:"fillText",args});}, strokeRect(...args){logs.push({op:"strokeRect",args});}, save(){}, restore(){}, beginPath(){},
    arc(){},stroke(){},createLinearGradient(){return {addColorStop(){}};}
  };
  global.document={createElement:(tag)=>{
    assert.equal(tag,"canvas");
    return {width:0,height:0,getContext:()=>context};
  }};
  global.Image=class {
    width=1000;height=1000;onload=null;
    set src(_value){if(this.onload)this.onload();}
  };
  try{
    const mod=loadTypescript("lib/v1-designer-export.ts",{
      "qrcode":{default:{toCanvas:async()=>{}}},
      "@/lib/v1-designer-layout":layouts,
    });
    await mod.renderV1Card({
      card:{code:"ULAS-00206",url:layouts.v1CardUrl("ULAS-00206")},
      design:"navy_left",mode:"black",pixels:1000,
      placement:layouts.v1UploadedTemplatePlacement("navy_left"),
      templateDataUrl:"data:image/png;base64,not-used-in-stub",
      templateQrCleanup:layouts.v1DefaultTemplateQrCleanup("navy_left"),
      showTemplateNfc:true,
    });
    const fillOld=logs.findIndex(x=>x.op==="fillRect"&&x.args[2]===310);
    const qrDraw=logs.map((x,i)=>x.op==="drawImage"?i:-1).filter(i=>i>=0);
    assert.equal(qrDraw.length,2,"template background followed by one newly encoded QR");
    assert.ok(fillOld>qrDraw[0]&&fillOld<qrDraw[1],"old embedded QR must be hidden before new QR is drawn");
    const mask=logs[fillOld];
    assert.equal(mask.color,"#ffffff");
    assert.deepEqual(mask.args,[540,430,310,310]);
    assert.ok(logs.some(x=>x.op==="fillText"&&x.args[0]==="TAP NFC"),"visible Tap NFC picture and text must be rendered");
    assert.ok(logs.some(x=>x.op==="strokeRect"),"Tap NFC phone icon must be drawn");
    // No oversized white backing may appear outside a QR on uploaded artwork.
    // The generated QR image itself is opaque and retains its own quiet zone.
    assert.ok(!logs.some(x=>x.op==="fillRect"&&x.args[2]>=240&&x.args[2]<=270),
      "an uploaded template must not get an additional white QR outline");
    assert.ok(qrDraw[1]>fillOld,"the generated QR is rendered over the template after cleanup");
    assert.ok(!logs.some(x=>x.op==="fillRect"&&x.args[0]===800&&x.args[1]===912),
      "footer YukReview must not be covered by a white rectangle");
    assert.ok(!logs.some(x=>x.op==="fillText"&&x.args[0]==="ULAS-00206"),
      "the printed card must not display its ULAS code");
  }finally{
    if(previousDocument===undefined)delete global.document; else global.document=previousDocument;
    if(previousImage===undefined)delete global.Image; else global.Image=previousImage;
  }
});

test("uploaded QR fits completely below the five stars and inside the original frame",()=>{
  const left=layouts.v1UploadedTemplatePlacement("navy_left");
  const right=layouts.v1UploadedTemplatePlacement("white_right");
  assert.deepEqual(left,{x:31,y:58,size:26});
  assert.deepEqual(right,{x:69,y:58,size:26});
  assert.ok(left.y-left.size/2>=45,"QR quiet-zone starts below the five-star row");
  assert.ok(left.x-left.size/2>16,"QR stays inside blue frame left edge");
  assert.ok(left.x+left.size/2<47,"QR stays inside blue frame right edge");
  assert.deepEqual(layouts.v1DefaultPlacement("navy_left"),{x:29,y:55,size:35},
    "existing built-in design defaults must remain unchanged");
});
test("template NFC flag is respected consistently by preview, PNG, ZIP and print",()=>{
  assert.match(page,/showTemplateNfc:templates\[selectedDesign\]\?\(templateNfc\[selectedDesign\]\?\?true\):false/);
  assert.match(page,/showTemplateNfc:templates\[design\]\?\(templateNfc\[design\]\?\?true\):false/);
  assert.match(page,/setTemplateNfc/);
  assert.match(page,/Tampilkan gambar Tap NFC di area kanan/);
  assert.match(exportsSource,/if\(settings\.showTemplateNfc===true\)/);
  assert.match(exportsSource,/drawTemplateTapNfc\(ctx,size\*cleanup\.x\/100,size\*cleanup\.y\/100,size\)/);
});

test("V1 card renderer hides card code but preserves the full verified QR URL",()=>{
  assert.equal(layouts.v1CardUrl("ULAS-00206"),"https://app.ulasantoko.space/r-v1/ULAS-00206");
  assert.doesNotMatch(exportsSource,/ctx\.fillText\(card\.code/);
  assert.match(exportsSource,/ctx\.drawImage\(qr,/);
  assert.match(exportsSource,/if\(custom\)/);
  assert.equal(layouts.v1SafePlacement({x:31,y:58,size:26}).size,26,
    "the safety clamp must preserve a 26% QR");
  assert.equal(layouts.v1DefaultPlacement("navy_left").size,35,
    "built-in QR designs keep their prior default size");
  assert.match(page,/v1UploadedTemplatePlacement\(key\)/);
});

test("uploaded artwork uses the QR canvas only, with quiet zone for scanning",async()=>{
  const source=read("lib/v1-designer-export.ts");
  assert.match(source,/width:720,margin:4,errorCorrectionLevel:"H"/);
  assert.match(source,/light:"#ffffff"/);
  assert.doesNotMatch(source,/light:"#0000"/);
  assert.match(source,/if\(!custom\)\{\s*const whiteBacking=px\+size\*0\.012/);
  assert.doesNotMatch(source,/Math\.min\(29,position\.size\+3\)/);
  assert.match(source,/ctx\.drawImage\(qr,size\*position\.x\/100-px\/2,size\*position\.y\/100-px\/2,px,px\)/);
  // Both the preview and every PNG/ZIP/PDF export share the renderer.
  assert.match(page,/renderV1Card\(\{/);
  assert.match(page,/renderV1Card\(renderSettings\(first,side\)\)/);
  assert.match(page,/renderV1Card\(renderSettings\(card,face\)\)/);
  assert.match(page,/renderV1Card\(renderSettings\(card,"front",1417\)\)/);
});

test("clean reference template defaults preserve native NFC and YukReview branding",()=>{
  assert.match(page,/setTemplateNfc\(old=>\(\{\.\.\.old,\[key\]:false\}\)\)/);
  assert.match(page,/v1DefaultTemplateQrCleanup\(key\),enabled:false/);
  assert.match(page,/kotak QR biru dan ikon NFC/);
  assert.doesNotMatch(exportsSource,/ctx\.fillRect\(size\*\.80,size\*\.912/);
  assert.deepEqual(layouts.v1UploadedTemplatePlacement("white_left"),{x:31,y:58,size:26});
});
