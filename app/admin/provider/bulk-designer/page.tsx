"use client";
import {useEffect,useState} from "react";
import {parseV1BulkCsv} from "@/lib/v1-bulk-csv";
import {
  V1_DESIGNS,v1CardUrl,v1DefaultPlacement,v1UploadedTemplatePlacement,v1DefaultTemplateQrCleanup,v1PageLayout,v1MirrorSlot,
  type V1CardData,type V1DesignKey,type V1QRMode,type V1QRPlacement,
  type V1Side,type V1Paper,type V1Flip,type V1TemplateQrCleanup
} from "@/lib/v1-designer-layout";
import {renderV1Card,v1CanvasPng,v1Download,v1Zip} from "@/lib/v1-designer-export";

export default function BulkDesignerV1Page() {
  const [authenticated,setAuthenticated]=useState(false);
  const [checking,setChecking]=useState(true);
  const [cards,setCards]=useState<V1CardData[]>([]);
  const [filename,setFilename]=useState("");
  const [frontDesign,setFrontDesign]=useState<V1DesignKey>("navy_right");
  const [backDesign,setBackDesign]=useState<V1DesignKey>("navy_left");
  const [templates,setTemplates]=useState<Partial<Record<V1DesignKey,string>>>({});
  const [templateCleanup,setTemplateCleanup]=useState<Partial<Record<V1DesignKey,V1TemplateQrCleanup>>>({});
  const [templateNfc,setTemplateNfc]=useState<Partial<Record<V1DesignKey,boolean>>>({});
  const [frontPosition,setFrontPosition]=useState<V1QRPlacement>(v1DefaultPlacement("navy_right"));
  const [backPosition,setBackPosition]=useState<V1QRPlacement>(v1DefaultPlacement("navy_left"));
  const [mode,setMode]=useState<V1QRMode>("rainbow");
  const [side,setSide]=useState<V1Side>("front");
  const [paper,setPaper]=useState<V1Paper>("a3plus");
  const [doubleSided,setDoubleSided]=useState(false);
  const [duplexFlip,setDuplexFlip]=useState<V1Flip>("long");
  const [preview,setPreview]=useState("");
  const [previewError,setPreviewError]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");

  useEffect(()=>{
    fetch("/api/v1/provider/session",{cache:"no-store"})
      .then(r=>r.json()).then(d=>setAuthenticated(d.authenticated===true))
      .catch(()=>setAuthenticated(false)).finally(()=>setChecking(false));
  },[]);

  const selectedDesign=side==="front"?frontDesign:backDesign;
  const selectedPlacement=side==="front"?frontPosition:backPosition;
  const first=cards[0];

  useEffect(()=>{
    if(!first){setPreview("");setPreviewError("");return;}
    let cancelled=false;
    setPreviewError("");
    void renderV1Card({
      card:first,design:selectedDesign,mode,placement:selectedPlacement,
      templateDataUrl:templates[selectedDesign],
      templateQrCleanup:templates[selectedDesign]?templateCleanup[selectedDesign]:undefined,
      showTemplateNfc:templates[selectedDesign]?(templateNfc[selectedDesign]??true):false,
      pixels:650,
    }).then(canvas=>{if(!cancelled)setPreview(canvas.toDataURL("image/png"));})
      .catch(e=>{if(!cancelled)setPreviewError(e instanceof Error?e.message:"Preview gagal.");});
    return ()=>{cancelled=true;};
  },[first,selectedDesign,mode,selectedPlacement,templates,templateCleanup,templateNfc]);

  async function verifyCodes(codes:string[]){
    const response=await fetch("/api/v1/provider/validate-cards",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({codes}),cache:"no-store"
    });
    const result=await response.json();
    if(!response.ok || result.valid!==true){
      throw new Error(result.message || "Kode kartu V1 belum terverifikasi.");
    }
  }
  async function loadCsv(file:File){
    setCards([]);setPreview("");setError("");setFilename("");
    try{
      if(file.size>1_000_000)throw new Error("CSV terlalu besar (maksimal 1 MB).");
      const text=(await file.text()).replace(/^\ufeff/,"");
      const codes=parseV1BulkCsv(text);
      await verifyCodes(codes);
      // Keep only verified V1 card codes and links. Never retain CSV activation PINs.
      setCards(codes.map(code=>({code,url:v1CardUrl(code)})));
      setFilename(file.name);
    }catch(e){setError(e instanceof Error?e.message:"CSV tidak dapat dibaca.");}
  }
  async function uploadTemplate(key:V1DesignKey,file?:File){
    if(!file)return;
    try{
      if(!["image/png","image/jpeg"].includes(file.type) || file.size>8_000_000 || file.size===0){
        throw new Error("Template harus PNG/JPG, maksimal 8 MB.");
      }
      const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
      const png=bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
      const jpg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
      if(!(png||jpg))throw new Error("File bukan PNG/JPG yang valid.");
      const encoded=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Gagal membaca template."));
        reader.onerror=()=>reject(new Error("Gagal membaca template."));
        reader.readAsDataURL(file);
      });
      setTemplates(old=>({...old,[key]:encoded}));
      // Clean print artwork (including Google Review reference) has a blank
      // blue QR frame and an existing NFC illustration. Preserve both.
      // Older artwork containing a baked QR can opt into masking manually.
      setTemplateCleanup(old=>({...old,[key]:{
        ...v1DefaultTemplateQrCleanup(key),enabled:false,
      }}));
      setTemplateNfc(old=>({...old,[key]:false}));
      // Pick a position inside the uploaded artwork's blue QR box (not the
      // larger generic preset QR, which can overlap the Google star row).
      if(side==="front"){
        setFrontDesign(key);
        setFrontPosition(v1UploadedTemplatePlacement(key));
      }else{
        setBackDesign(key);
        setBackPosition(v1UploadedTemplatePlacement(key));
      }
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"Template gagal diproses.");}
  }
  function changeDesign(next:V1DesignKey){
    if(side==="front"){
      setFrontDesign(next);
      setFrontPosition(templates[next]?v1UploadedTemplatePlacement(next):v1DefaultPlacement(next));
    }else{
      setBackDesign(next);
      setBackPosition(templates[next]?v1UploadedTemplatePlacement(next):v1DefaultPlacement(next));
    }
  }
  function changeTemplateCleanup(patch:Partial<V1TemplateQrCleanup>){
    setTemplateCleanup(old=>({
      ...old,
      [selectedDesign]:{
        ...v1DefaultTemplateQrCleanup(selectedDesign),
        ...old[selectedDesign],
        ...patch,
      },
    }));
  }
  function positionValue(field:keyof V1QRPlacement,value:number){
    const fn=(old:V1QRPlacement)=>({...old,[field]:value});
    if(side==="front")setFrontPosition(fn);
    else setBackPosition(fn);
  }
  function renderSettings(card:V1CardData,face:V1Side,pixels=1417){
    const design=face==="front"?frontDesign:backDesign;
    return {
      card,design,mode,pixels,
      placement:face==="front"?frontPosition:backPosition,
      templateDataUrl:templates[design],
      templateQrCleanup:templates[design]?templateCleanup[design]:undefined,
      showTemplateNfc:templates[design]?(templateNfc[design]??true):false,
    };
  }
  async function downloadFirstPng(){
    if(!first || busy)return;
    setBusy(true);setError("");setProgress("Memvalidasi kartu V1...");
    try{
      await verifyCodes(cards.map(c => c.code));
      const canvas=await renderV1Card(renderSettings(first,side));
      v1Download(await v1CanvasPng(canvas),first.code+"-"+side+"-HD.png");
      setProgress("PNG HD telah diminta untuk diunduh (1417 × 1417 px).");
    }catch(e){setError(e instanceof Error?e.message:"PNG gagal dibuat.");}
    finally{setBusy(false);}
  }
  async function downloadZip(){
    if(!cards.length||busy)return;
    setBusy(true);setError("");setProgress("Memvalidasi semua kode kartu ke database V1...");
    try{
      await verifyCodes(cards.map(c => c.code));
      const files:{name:string;bytes:Uint8Array}[]=[];
      for(let i=0;i<cards.length;i++){
        const card=cards[i];
        for(const face of (doubleSided?["front","back"] as const:["front"] as const)){
          const canvas=await renderV1Card(renderSettings(card,face));
          const blob=await v1CanvasPng(canvas);
          files.push({
            name:card.code+"-"+(face==="front"?"depan":"belakang")+".png",
            bytes:new Uint8Array(await blob.arrayBuffer()),
          });
        }
        if(i===0 || (i+1)%5===0 || i+1===cards.length)
          setProgress("Menyiapkan PNG HD "+(i+1)+" / "+cards.length+" kartu...");
      }
      const zip=v1Zip(files);
      v1Download(zip,"V1-Desain-PNG-HD-"+cards.length+"-kartu.zip");
      setProgress("ZIP PNG HD berhasil disiapkan. PIN tidak disertakan.");
    }catch(e){setError(e instanceof Error?e.message:"ZIP HD gagal dibuat.");}
    finally{setBusy(false);}
  }
  async function printCards(){
    if(!cards.length||busy)return;
    const win=window.open("","_blank");
    if(!win){setError("Izinkan pop-up browser untuk membuka PDF cetak.");return;}
    setBusy(true);setError("");setProgress("Memeriksa kode kartu V1...");
    win.document.write("<!doctype html><html><head><title>Menyiapkan cetak V1...</title></head><body style='font-family:Arial'>Memvalidasi kartu V1...</body></html>");
    try{
      await verifyCodes(cards.map(c => c.code));
      const layout=v1PageLayout(paper);
      const pageHtml:string[]=[];
      for(let i=0;i<cards.length;i+=layout.cardsPerPage){
        const slots=Array.from({length:layout.cardsPerPage},(_,j)=>cards[i+j]??null);
        const frontImgs:string[]=[];
        const backImgs:string[]=[];
        for(let j=0;j<slots.length;j++){
          const card=slots[j];
          if(!card){frontImgs.push("");backImgs.push("");continue;}
          const front=await renderV1Card(renderSettings(card,"front",1417));
          frontImgs.push(front.toDataURL("image/png"));
          if(doubleSided){
            const back=await renderV1Card(renderSettings(card,"back",1417));
            backImgs.push(back.toDataURL("image/png"));
          }
        }
        const printSide=(imgs:string[],back:boolean)=>{
          const printed=slots.map((_,j)=>{
            const idx=back?v1MirrorSlot(j,paper,duplexFlip):j;
            const img=imgs[idx];
            return '<article class="slot">'+(img?'<img alt="Desain kartu V1" src="'+img+'">':"")+
              '<i class="cut tl"></i><i class="cut tr"></i><i class="cut bl"></i><i class="cut br"></i></article>';
          }).join("");
          return '<section class="sheet">'+printed+'</section>';
        };
        pageHtml.push(printSide(frontImgs,false));
        if(doubleSided)pageHtml.push(printSide(backImgs,true));
        setProgress("Menyiapkan lembar "+(Math.floor(i/layout.cardsPerPage)+1)+" / "+Math.ceil(cards.length/layout.cardsPerPage)+"...");
      }
      const size=paper==="a3plus"?"329mm 483mm":"A3 landscape";
      const css='@page{size:'+size+';margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial;background:white}.sheet{width:'+layout.pageWidthMm+'mm;height:'+layout.pageHeightMm+'mm;display:grid;grid-template-columns:repeat('+layout.columns+',100mm);grid-template-rows:repeat('+layout.rows+',100mm);gap:5mm;align-content:center;justify-content:center;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.slot{width:100mm;height:100mm;position:relative;border:.12mm dashed #abb7c9;break-inside:avoid}.slot img{display:block;width:100%;height:100%;object-fit:cover}.cut{position:absolute;width:3mm;height:3mm;pointer-events:none}.tl{top:-1.5mm;left:-1.5mm;border-top:.2mm solid #888;border-left:.2mm solid #888}.tr{top:-1.5mm;right:-1.5mm;border-top:.2mm solid #888;border-right:.2mm solid #888}.bl{bottom:-1.5mm;left:-1.5mm;border-bottom:.2mm solid #888;border-left:.2mm solid #888}.br{bottom:-1.5mm;right:-1.5mm;border-bottom:.2mm solid #888;border-right:.2mm solid #888}@media screen{body{background:#e9eef5}.sheet{background:white;margin:10mm auto;box-shadow:0 2px 16px #a8b1c0}}';
      win.document.open();
      win.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>V1 Bulk Designer — Cetak HD</title><style>'+css+'</style></head><body>'+pageHtml.join("")+'</body></html>');
      win.document.close();win.focus();
      setProgress("Preview cetak siap. Tekan Ctrl/Cmd+P, Save as PDF, skala 100%.");
    }catch(e){
      win.close();setError(e instanceof Error?e.message:"Gagal membuat cetakan V1.");
    }finally{setBusy(false);}
  }

  const currentPreset=V1_DESIGNS.find(d=>d.key===selectedDesign)!;
  const currentCleanup=templates[selectedDesign] ?
    (templateCleanup[selectedDesign]??v1DefaultTemplateQrCleanup(selectedDesign)) : undefined;
  const sheet=v1PageLayout(paper);
  return <main className="min-h-screen bg-gray-50 px-4 py-8 text-slate-900">
    <section className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
      <a href="/admin/provider" className="text-sm text-blue-700 underline">← Kembali ke Provider V1</a>
      <p className="mt-5 text-xs font-bold tracking-wide text-blue-700">ULASANTOKO V1 · PROVIDER</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Bulk Card Designer V1</h1>
      <p className="mt-2 max-w-4xl text-sm text-slate-600">Upload CSV Bulk Create, pilih desain, atur QR, preview kartu pertama, lalu ekspor PNG HD atau cetak A3/A3+. Semua gambar diproses di browser; PIN aktivasi tidak dicetak atau diunggah. Nomor ULAS juga tidak dicetak di pojok desain, tetapi tetap tersimpan dalam CSV dan tautan QR.</p>
      {checking ? <p className="mt-6">Memeriksa sesi Provider V1...</p> :
        !authenticated ? <p className="mt-6">Silakan <a href="/admin/provider" className="text-blue-700 underline">login Provider V1</a> terlebih dahulu.</p> :
      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-bold">1. Upload CSV V1</h2>
            <p className="mt-2 text-xs text-slate-600">Hanya CSV asli Bulk Create V1. Kode dicek ke database khusus V1; tidak ada PIN yang dikirim.</p>
            <input aria-label="CSV kartu V1" type="file" accept=".csv,text/csv" className="mt-3 block w-full text-sm"
              onChange={e=>{const file=e.target.files?.[0];if(file)void loadCsv(file);}}/>
            {filename && <p className="mt-2 break-all text-xs text-slate-500">File: {filename}</p>}
            <p className="mt-3 text-sm font-semibold text-blue-800">{cards.length} kartu siap diproses.</p>
            <a href="/admin/provider/bulk-create" className="mt-2 inline-block text-sm text-blue-700 underline">Buka Bulk Create V1 untuk membuat kartu</a>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-bold">2. Pilih desain kartu</h2>
            <p className="mt-1 text-xs text-slate-500">Untuk desain Google Review clean dengan kotak QR biru dan ikon NFC yang sudah dicetak, unggah PNG referensi pada slot 4. QR rainbow otomatis ditempatkan di kotak biru (26%); ilustrasi NFC dan logo YukReview.id asli tidak ditimpa. Template tetap lokal di browser.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {V1_DESIGNS.map(design=><div key={design.key} className="rounded-lg border border-slate-200 p-2">
                <div className={"mb-2 flex h-12 items-center justify-center rounded-md border text-xs font-semibold "+(design.dark?"bg-[#112e57] text-white":"bg-white text-slate-800")}>
                  {design.title}
                </div>
                <label className="text-xs font-medium">{templates[design.key]?"Template diunggah":"Upload PNG/JPG"}
                  <input aria-label={"Upload "+design.title} className="mt-1 block w-full text-[10px]" type="file" accept="image/png,image/jpeg"
                    onChange={e=>{const file=e.target.files?.[0];if(file)void uploadTemplate(design.key,file);}}/>
                </label>
                {templates[design.key] && <button className="mt-1 text-xs text-blue-700 underline" onClick={()=>{
                  setTemplates(old=>({...old,[design.key]:undefined}));
                  setTemplateCleanup(old=>({...old,[design.key]:undefined}));
                  setTemplateNfc(old=>({...old,[design.key]:undefined}));
                }}>Pakai desain bawaan</button>}
              </div>)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold">Desain depan
                <select className="mt-1 w-full rounded-lg border p-2 text-sm" value={frontDesign}
                  onChange={e=>{const next=e.target.value as V1DesignKey;setFrontDesign(next);setFrontPosition(templates[next]?v1UploadedTemplatePlacement(next):v1DefaultPlacement(next));}}>
                  {V1_DESIGNS.map(d=><option value={d.key} key={d.key}>{d.title}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Desain belakang
                <select className="mt-1 w-full rounded-lg border p-2 text-sm" value={backDesign}
                  onChange={e=>{const next=e.target.value as V1DesignKey;setBackDesign(next);setBackPosition(templates[next]?v1UploadedTemplatePlacement(next):v1DefaultPlacement(next));}}>
                  {V1_DESIGNS.map(d=><option value={d.key} key={d.key}>{d.title}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold">Warna QR Code</label>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {([["rainbow","Rainbow"],["black","Hitam-putih"],["blue","Biru"]] as const).map(([value,label])=>
                <label key={value} className="flex items-center gap-1"><input type="radio" name="v1-qr-mode" checked={mode===value} onChange={()=>setMode(value)}/>{label}</label>
              )}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold">Atur posisi & ukuran QR — {side==="front"?"depan":"belakang"}</h3>
              {templates[selectedDesign] && <p className="mt-1 text-xs text-blue-800">Untuk gambar custom, ukuran awal QR 26%, X {selectedDesign.endsWith("_left")?"31":"69"}%, Y 58% agar masuk di kotak desain tanpa menutup bintang.</p>}
              {([["x","Posisi horizontal (X)",15,85],["y","Posisi vertikal (Y)",25,78],["size","Ukuran QR",25,43]] as const).map(([field,label,min,max])=>
                <label className="mt-3 block text-xs" key={field}>{label} — <strong>{selectedPlacement[field]}%</strong>
                  <input className="mt-1 block w-full" type="range" min={min} max={max} value={selectedPlacement[field]}
                    onChange={e=>positionValue(field,Number(e.target.value))}/>
                </label>
              )}
              <button className="mt-3 text-xs text-blue-700 underline" onClick={()=>changeDesign(selectedDesign)}>Reset posisi QR</button>
            </div>
            {currentCleanup && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-bold text-amber-950">Tutup QR lama yang ada di gambar template</h3>
              <p className="mt-1 text-xs text-amber-900">
                Agar tidak muncul dua QR, sistem menutup QR yang sudah tercetak di file gambar
                sebelum menambahkan satu QR aktif V1. Area penutup dapat dipindahkan agar
                tidak menutupi bintang atau teks.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-950">
                <input type="checkbox" checked={currentCleanup.enabled}
                  onChange={e=>changeTemplateCleanup({enabled:e.target.checked})}/>
                Template ini sudah memiliki QR lama — tutup QR lama
              </label>
              {currentCleanup.enabled && <>
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <input type="checkbox"
                    checked={templateNfc[selectedDesign]??true}
                    onChange={e=>setTemplateNfc(old=>({...old,[selectedDesign]:e.target.checked}))}/>
                  Tampilkan gambar Tap NFC di area kanan/kiri yang sudah dibersihkan
                </label>
                {([["x","Posisi QR lama horizontal (X)",15,85],
                   ["y","Posisi QR lama vertikal (Y)",25,80],
                   ["size","Ukuran area penutup",24,43]] as const).map(([field,label,min,max])=>
                  <label className="mt-3 block text-xs text-amber-950" key={field}>
                    {label} — <strong>{currentCleanup[field]}%</strong>
                    <input className="mt-1 block w-full" type="range" min={min} max={max}
                      value={currentCleanup[field]}
                      onChange={e=>changeTemplateCleanup({[field]:Number(e.target.value)})}/>
                  </label>
                )}
                <label className="mt-3 flex items-center justify-between text-xs text-amber-950">
                  Warna area penghapus (samakan dengan latar)
                  <input aria-label="Warna penutup QR lama" type="color"
                    value={currentCleanup.color}
                    onChange={e=>changeTemplateCleanup({color:e.target.value})}/>
                </label>
                <button className="mt-3 text-xs text-blue-700 underline"
                  onClick={()=>setTemplateCleanup(old=>({...old,[selectedDesign]:v1DefaultTemplateQrCleanup(selectedDesign)}))}>
                  Reset penutup QR lama
                </button>
              </>}
              <p className="mt-2 text-xs text-amber-900">
                Preview dan semua hasil PNG/ZIP/PDF memakai pengaturan yang sama.
                Pastikan hanya ada satu QR, lalu tes scan sebelum cetak massal.
              </p>
            </div>}
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={doubleSided} onChange={e=>setDoubleSided(e.target.checked)}/>
              Cetak bolak-balik (dua sisi, QR & NFC dapat bertukar posisi)
            </label>
            {doubleSided && <label className="mt-3 block text-sm">Arah balik kertas
              <select className="mt-1 w-full rounded-lg border p-2" value={duplexFlip} onChange={e=>setDuplexFlip(e.target.value as V1Flip)}>
                <option value="long">Balik sisi panjang (long edge)</option>
                <option value="short">Balik sisi pendek (short edge)</option>
              </select>
            </label>}
            <p className="mt-3 text-xs text-slate-500">QR otomatis menyimpan tautan asli V1. Uji scan fisik depan/belakang sebelum cetak massal.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-bold">3. Export HD & cetak</h2>
            <label className="mt-3 block text-sm font-medium">Ukuran lembar
              <select className="mt-1 block w-full rounded-lg border p-2" value={paper} onChange={e=>setPaper(e.target.value as V1Paper)}>
                <option value="a3plus">A3+ portrait · 329 × 483 mm · 12 kartu</option>
                <option value="a3">A3 landscape · 420 × 297 mm · 6 kartu</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">Kartu 10 × 10 cm, jarak 5 mm, tanda potong. PNG individual 1417 × 1417 px (≈360 DPI).</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button disabled={!cards.length||busy} onClick={()=>void downloadFirstPng()} className="rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40">PNG kartu pertama</button>
              <button disabled={!cards.length||busy} onClick={()=>void downloadZip()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Download ZIP HD</button>
              <button disabled={!cards.length||busy} onClick={()=>void printCards()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-2">Preview cetak {sheet.cardsPerPage} kartu/lembar · Simpan PDF</button>
            </div>
            {progress && <p role="status" className="mt-3 text-sm text-blue-800">{progress}</p>}
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <p className="mt-3 text-xs text-slate-500">Di jendela cetak tekan Ctrl/Cmd+P, pilih Save as PDF, ukuran kertas sesuai pengaturan dan skala 100%. Browser/printer tertentu memerlukan ukuran kustom untuk A3+.</p>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-xl font-bold text-slate-900">Preview kartu pertama — {side==="front"?"depan":"belakang"}</h2>
            <p className="mt-1 text-sm text-slate-600">Preview langsung dari CSV terverifikasi. PIN aktivasi tidak ditampilkan.</p>
            <div className="mt-4 flex gap-2">
              <button aria-pressed={side==="front"} className={"rounded-lg px-4 py-2 text-sm font-semibold "+(side==="front"?"bg-blue-700 text-white":"border bg-white text-slate-700")} onClick={()=>setSide("front")}>Depan</button>
              <button aria-pressed={side==="back"} className={"rounded-lg px-4 py-2 text-sm font-semibold "+(side==="back"?"bg-blue-700 text-white":"border bg-white text-slate-700")} onClick={()=>setSide("back")}>Belakang</button>
            </div>
            <div className="mt-4 flex min-h-[360px] items-center justify-center rounded-xl border bg-white p-6">
              {!first?<p className="text-center text-sm text-slate-500">Preview muncul setelah CSV Bulk Create V1 diunggah dan kode kartu berhasil diverifikasi.</p>:
                previewError?<p role="alert" className="text-sm text-red-700">{previewError}</p>:
                preview?<img alt={"Preview "+side+" kartu "+first.code} className="aspect-square w-full max-w-[440px] rounded-md shadow" src={preview}/>:
                <p className="text-sm text-slate-500">Menyiapkan preview desain...</p>}
            </div>
            {first && <p className="mt-3 text-center text-xs text-slate-500">{first.code} · {currentPreset.title} · {cards.length} kartu</p>}
            <div className="mt-5 border-t pt-4">
              <h3 className="text-sm font-bold">Preview layout {paper==="a3plus"?"A3+ 3×4":"A3 3×2"}</h3>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border bg-white p-3">
                {Array.from({length:sheet.cardsPerPage},(_,i)=><div key={i}
                  className={"flex aspect-square items-center justify-center border border-dashed text-center text-[10px] "+(cards[i]?"border-blue-300 bg-blue-50 text-blue-900":"border-slate-200 text-slate-400")}>
                    {cards[i]?.code||"Slot "+(i+1)}
                </div>)}
              </div>
              <p className="mt-2 text-xs text-slate-500">Lembar ini hanya petunjuk posisi. Tombol Preview cetak menghasilkan kartu dengan QR sebenarnya dan posisi bolak-balik yang disesuaikan.</p>
            </div>
          </div>
        </aside>
      </div>}
      <nav className="mt-7 flex flex-wrap gap-5 text-sm text-blue-700">
        <a href="/admin/provider">Provider V1</a><a href="/admin/provider/bulk-create">Bulk Create V1</a>
      </nav>
    </section>
  </main>;
}
