"use client";
import QRCode from "qrcode";
import {V1_DESIGNS,v1SafePlacement,v1SafeTemplateQrCleanup,type V1CardData,type V1DesignKey,type V1QRPlacement,type V1QRMode,type V1TemplateQrCleanup} from "@/lib/v1-designer-layout";

export type V1RenderSettings = {
  card:V1CardData; design:V1DesignKey; mode:V1QRMode;
  placement:V1QRPlacement; templateDataUrl?:string;
  templateQrCleanup?:V1TemplateQrCleanup;
  showTemplateNfc?:boolean;
  pixels?:number;
};

function imageFromDataUrl(dataUrl:string):Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("Gambar template tidak bisa dibaca."));
    image.src=dataUrl;
  });
}
function cropFill(ctx:CanvasRenderingContext2D,img:HTMLImageElement,size:number) {
  const ratio=Math.max(size/img.width,size/img.height);
  const w=img.width*ratio, h=img.height*ratio;
  ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
}
function typography(ctx:CanvasRenderingContext2D,size:number,px:number,bold=false) {
  ctx.font=(bold?"700 ":"500 ")+Math.round(px*size/1000)+"px Arial,Helvetica,sans-serif";
}
async function qrCanvas(url:string,mode:V1QRMode):Promise<HTMLCanvasElement> {
  const canvas=document.createElement("canvas");
  await QRCode.toCanvas(canvas,url,{
    width:720,margin:4,errorCorrectionLevel:"H",
    color:{dark:mode==="blue"?"#123b78":mode==="black"?"#000000":"#172f55",light:"#ffffff"},
  });
  if(mode==="rainbow"){
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Canvas QR tidak tersedia.");
    const img=ctx.getImageData(0,0,canvas.width,canvas.height);
    const stops=[[105,35,115],[27,67,150],[0,99,108],[98,58,129]];
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const at=(y*canvas.width+x)*4;
        if(img.data[at]<160){
          const f=(x/canvas.width)*3,i=Math.min(2,Math.floor(f)),t=f-i;
          for(let k=0;k<3;k++)img.data[at+k]=Math.round(stops[i][k]*(1-t)+stops[i+1][k]*t);
        }
      }
    }
    ctx.putImageData(img,0,0);
  }
  return canvas;
}
function drawNfc(ctx:CanvasRenderingContext2D,x:number,y:number,s:number,color:string){
  ctx.save();
  ctx.strokeStyle=color; ctx.lineWidth=Math.max(1.5,s*0.005);ctx.lineCap="round";
  for(let j=0;j<3;j++){
    const rad=s*(0.018+j*0.014);
    ctx.beginPath();ctx.arc(x-s*0.025,y,rad,-Math.PI/2,Math.PI/2);ctx.stroke();
  }
  ctx.fillStyle=color;ctx.textAlign="center";
  typography(ctx,s,21,true);ctx.fillText("TAP NFC",x,y+s*0.09);
  ctx.restore();
}
/** Dedicated vector NFC picture for uploaded V1 artwork. This is a visual
 * instruction only: the actual NFC chip must still be physically encoded.
 * All coordinates are relative to the original 10x10 cm card.
 */
function drawTemplateTapNfc(ctx:CanvasRenderingContext2D,x:number,y:number,s:number) {
  ctx.save();
  const blue="#135cb1";
  ctx.strokeStyle=blue;ctx.fillStyle=blue;
  ctx.lineWidth=Math.max(2,s*.0045);ctx.lineCap="round";ctx.lineJoin="round";
  // Center phone and wireless signal in the former QR placeholder slot.
  const phoneX=x-s*.085,phoneY=y-s*.083;
  ctx.strokeRect(phoneX,phoneY,s*.083,s*.143);
  ctx.fillRect(phoneX+s*.029,phoneY+s*.129,s*.025,s*.004);
  for(let i=0;i<3;i++){
    ctx.beginPath();
    ctx.arc(x+s*.005,y-s*.013,s*(.025+i*.016),-Math.PI/2,Math.PI/2);
    ctx.stroke();
  }
  ctx.textAlign="center";ctx.fillStyle="#123b78";
  typography(ctx,s,25,true);
  ctx.fillText("TAP NFC",x,y+s*.115);
  ctx.restore();
}

/** Google Review print artwork for the two left-QR V1 presets.
 * All geometry is relative to the 10x10 cm card; never changes QR URL or data.
 */
function drawReferenceLeftCard(ctx:CanvasRenderingContext2D,s:number,qrRight=false){
  const blue="#1262fa",navy="#102d69";
  const S=(v:number)=>v*s;
  const polygon=(points:number[][],color:string)=>{
    ctx.fillStyle=color;ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(S(x),S(y)):ctx.moveTo(S(x),S(y)));
    ctx.closePath();ctx.fill();
  };
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,s,s);
  polygon([[0,0],[.252,0],[0,.252]],"#ff071c");
  polygon([[.145,0],[.25,0],[0,.25],[0,.16]],"#ffbf0b");
  ctx.textAlign="center";ctx.fillStyle="#070707";
  ctx.font=`700 ${Math.round(S(.071))}px Arial,Helvetica,sans-serif`;
  ctx.fillText("Beri Ulasan di",S(.5),S(.125));
  // Reference-style multicolour Google wordmark, drawn on the same baseline.
  ctx.font=`700 ${Math.round(S(.146))}px Arial,Helvetica,sans-serif`;
  const word="Google",colors=["#1769f5","#f31524","#ffbd05","#1769f5","#05c84e","#ef1724"];
  const widths=[...word].map(c=>ctx.measureText(c).width);
  const total=widths.reduce((a,b)=>a+b,0);
  let x=(s-total)/2;ctx.textAlign="left";
  [...word].forEach((letter,i)=>{ctx.fillStyle=colors[i];ctx.fillText(letter,x,S(.283));x+=widths[i];});
  // Five gold stars as crisp vector shapes.
  ctx.fillStyle="#ffbd08";
  for(let n=0;n<5;n++){
    const cx=S(.29+n*.105),cy=S(.381),ro=S(.043),ri=S(.020);
    ctx.beginPath();
    for(let j=0;j<10;j++){
      const theta=-Math.PI/2+j*Math.PI/5,r=j%2?ri:ro;
      if(j===0)ctx.moveTo(cx+Math.cos(theta)*r,cy+Math.sin(theta)*r);
      else ctx.lineTo(cx+Math.cos(theta)*r,cy+Math.sin(theta)*r);
    }
    ctx.closePath();ctx.fill();
  }
  // Strict printed QR frame; the QR itself is drawn later, inside this outline.
  ctx.strokeStyle=blue;ctx.lineWidth=S(.010);
  ctx.strokeRect(S(qrRight?.53:.16),S(.44),S(.31),S(.28));
  ctx.strokeStyle="#9ec0ef";ctx.lineWidth=S(.006);ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(S(qrRight?.49:.51),S(.475));ctx.lineTo(S(qrRight?.49:.51),S(.69));ctx.stroke();
  // Only mirror the NFC illustration. All words, Google lettering and logo stay readable.
  if(qrRight){ctx.save();ctx.translate(s,0);ctx.scale(-1,1);}
  // Original reference has a blue circular tap area and a hand touching a phone.
  const cx=S(.685),cy=S(.58);
  ctx.beginPath();ctx.arc(cx,cy,S(.145),0,Math.PI*2);
  ctx.fillStyle="#d3e7ff";ctx.fill();
  ctx.strokeStyle=blue;ctx.lineWidth=S(.009);ctx.lineCap="round";ctx.lineJoin="round";
  const phoneX=S(.620),phoneY=S(.481),phoneW=S(.124),phoneH=S(.177);
  ctx.beginPath();ctx.roundRect(phoneX,phoneY,phoneW,phoneH,S(.016));ctx.stroke();
  ctx.strokeStyle="#90befa";ctx.lineWidth=S(.005);
  ctx.beginPath();ctx.moveTo(S(.671),S(.495));ctx.lineTo(S(.697),S(.495));ctx.stroke();
  ctx.beginPath();ctx.moveTo(S(.674),S(.645));ctx.lineTo(S(.692),S(.645));ctx.stroke();
  ctx.strokeStyle=blue;ctx.lineWidth=S(.008);
  for(let i=0;i<3;i++){
    ctx.beginPath();ctx.arc(S(.647),S(.572),S(.018+i*.016),-.8,.8);ctx.stroke();
  }
  // Finger, palm and sleeve: independent blue outline, like supplied tap graphic.
  ctx.beginPath();
  ctx.moveTo(S(.80),S(.67));ctx.lineTo(S(.76),S(.625));
  ctx.lineTo(S(.726),S(.606));ctx.quadraticCurveTo(S(.708),S(.593),S(.700),S(.61));
  ctx.quadraticCurveTo(S(.690),S(.626),S(.712),S(.645));
  ctx.lineTo(S(.740),S(.675));
  ctx.moveTo(S(.736),S(.62));ctx.lineTo(S(.751),S(.64));
  ctx.moveTo(S(.756),S(.615));ctx.lineTo(S(.775),S(.636));
  ctx.stroke();
  if(qrRight)ctx.restore();
  // Rounded, pale-blue CTA with both lines centered.
  ctx.fillStyle="#d1e8ff";ctx.beginPath();
  ctx.roundRect(S(.092),S(.744),S(.816),S(.119),S(.058));ctx.fill();
  ctx.textAlign="center";ctx.fillStyle="#115df2";
  ctx.font=`700 ${Math.round(S(.039))}px Arial,Helvetica,sans-serif`;
  ctx.fillText("Scan QR atau tap NFC",S(.5),S(.796));
  ctx.fillStyle="#121212";
  ctx.font=`500 ${Math.round(S(.029))}px Arial,Helvetica,sans-serif`;
  ctx.fillText("untuk memberikan ulasan di Google",S(.5),S(.833));
  // Navy/blue YukReview.id lock-up; no white rectangle on top of branding.
  ctx.textAlign="left";
  const logoX=S(.602),logoY=S(.915);
  ctx.fillStyle=blue;ctx.beginPath();ctx.roundRect(logoX,logoY-S(.026),S(.044),S(.036),S(.012));ctx.fill();
  ctx.beginPath();ctx.moveTo(logoX+S(.009),logoY+S(.007));ctx.lineTo(logoX+S(.007),logoY+S(.019));ctx.lineTo(logoX+S(.022),logoY+S(.006));ctx.fill();
  ctx.fillStyle="#ffffff";ctx.font=`700 ${Math.round(S(.028))}px Arial`;ctx.fillText("★",logoX+S(.008),logoY+S(.002));
  ctx.strokeStyle=blue;ctx.lineWidth=S(.003);
  for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(logoX+S(.036),logoY-S(.031),S(.013+i*.01),-1.4,-.18);ctx.stroke();}
  ctx.font=`700 ${Math.round(S(.036))}px Arial,Helvetica,sans-serif`;
  ctx.fillStyle=navy;ctx.fillText("Yuk",S(.649),logoY+S(.006));
  ctx.fillStyle=blue;ctx.fillText("Review",S(.718),logoY+S(.006));
  ctx.fillStyle=navy;ctx.fillText(".id",S(.851),logoY+S(.006));
  polygon([[.81,1],[1,.771],[1,1]],"#04cc46");
  polygon([[.858,1],[1,.835],[1,1]],"#0c5afa");
}

/** Browser-only: templates and original PIN CSV are never sent to a server. */
export async function renderV1Card(settings:V1RenderSettings):Promise<HTMLCanvasElement> {
  const {card,design,mode}=settings;
  const size=settings.pixels??1417;
  if(size<300 || size>2400)throw new Error("Resolusi kartu tidak valid.");
  const canvas=document.createElement("canvas");
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Canvas desain tidak tersedia.");
  const preset=V1_DESIGNS.find(x=>x.key===design);
  if(!preset)throw new Error("Template V1 tidak valid.");
  const custom=settings.templateDataUrl;
  const referenceLeft=!custom&&(design==="navy_left"||design==="white_left");
  const referenceRight=!custom&&(design==="navy_right"||design==="white_right");
  if(custom){
    const img=await imageFromDataUrl(custom);
    cropFill(ctx,img,size);
    // Uploaded templates may already contain a QR (often a placeholder,
    // or an outdated/unscannable code). Remove that source QR before adding
    // the verified V1 code below. This is canvas-only; original file stays
    // intact. The same renderer serves live preview, PNG, ZIP and print.
    if(settings.templateQrCleanup?.enabled){
      const cleanup=v1SafeTemplateQrCleanup(settings.templateQrCleanup);
      const side=size*cleanup.size/100;
      ctx.fillStyle=cleanup.color;
      ctx.fillRect(
        size*cleanup.x/100-side/2,
        size*cleanup.y/100-side/2,
        side,side
      );
      // Draw NFC only on the selected template's cleared opposite side.
      // It is never baked into another project's template or into the QR code.
      if(settings.showTemplateNfc===true){
        drawTemplateTapNfc(ctx,size*cleanup.x/100,size*cleanup.y/100,size);
      }
    }
  } else if(referenceLeft||referenceRight){
    drawReferenceLeftCard(ctx,size,referenceRight);
  } else {
    ctx.fillStyle=preset.dark?"#112e57":"#ffffff";ctx.fillRect(0,0,size,size);
    if(preset.dark) {
      const shade=ctx.createLinearGradient(0,0,size,size);
      shade.addColorStop(0,"rgba(10,33,78,0)");shade.addColorStop(1,"rgba(44,91,158,.37)");
      ctx.fillStyle=shade;ctx.fillRect(0,0,size,size);
    } else {
      ctx.strokeStyle="#e4eaf2";ctx.lineWidth=size*0.006;
      ctx.strokeRect(size*0.025,size*0.025,size*0.95,size*0.95);
    }
    const ink=preset.dark?"#ffffff":"#102e58";
    const subdued=preset.dark?"#dce8ff":"#4c627b";
    ctx.textAlign="left";ctx.fillStyle=ink;typography(ctx,size,30,true);
    ctx.fillText("YukReview.id",size*0.08,size*0.12);
    ctx.textAlign="right";ctx.fillStyle=subdued;typography(ctx,size,15,true);
    ctx.fillText("GOOGLE REVIEW",size*0.92,size*0.12);
    ctx.textAlign="center";ctx.fillStyle=ink;typography(ctx,size,36,true);
    ctx.fillText("Bagikan pengalaman Anda",size*0.5,size*0.245);
    const p=v1SafePlacement(settings.placement);
    const nfcX=p.x<50?size*0.75:size*0.25;
    drawNfc(ctx,nfcX,size*0.55,size,ink);
    ctx.fillStyle=subdued;ctx.textAlign="center";typography(ctx,size,25);
    ctx.fillText("Scan QR atau Tap NFC",size*0.5,size*0.83);
  }
  const position=v1SafePlacement(settings.placement);
  const qr=await qrCanvas(card.url,mode);
  const px=size*position.size/100;
  // Uploaded templates already have a printed blue QR frame. Do not draw
  // another, larger white rectangle outside the QR: its white border would
  // cover the frame and look like an oversized outline.
  // QRCode.toCanvas itself retains a 4-module white quiet zone, so an opaque
  // QR image fully covers any old QR pixels in its own footprint and remains
  // readable by phone cameras.
  // Keep the previous backing untouched for built-in V1 designs.
  if(!custom&&!referenceLeft&&!referenceRight){
    const whiteBacking=px+size*0.012;
    ctx.fillStyle="#ffffff";
    ctx.fillRect(size*position.x/100-whiteBacking/2,
      size*position.y/100-whiteBacking/2,whiteBacking,whiteBacking);
  }
  ctx.drawImage(qr,size*position.x/100-px/2,size*position.y/100-px/2,px,px);
  // Do not paint over the uploaded artwork footer: the old mask obscured
  // the official YukReview branding. The card code remains only in QR/CSV.
  return canvas;
}
export function v1CanvasPng(canvas:HTMLCanvasElement):Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG gagal dibuat.")),"image/png"));
}
export function v1Download(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
}

/** Small dependency-free ZIP writer (STORE, UTF-8), compatible with PNG files. */
function crc32(data:Uint8Array):number {
  let crc=0xffffffff;
  for(const b of data){
    crc^=b;
    for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function u16(view:DataView,off:number,val:number){view.setUint16(off,val,true);}
function u32(view:DataView,off:number,val:number){view.setUint32(off,val>>>0,true);}
export function v1Zip(files:{name:string; bytes:Uint8Array}[]):Blob{
  if(!files.length || files.length>400)throw new Error("Jumlah file ZIP tidak valid.");
  const chunks:BlobPart[]=[];
  const directory:Uint8Array[]=[];
  let offset=0,centralSize=0;
  const encoder=new TextEncoder();
  for(const file of files){
    const name=encoder.encode(file.name);
    if(name.byteLength>240 || file.bytes.byteLength>0xffffffff)throw new Error("Ukuran ZIP tidak valid.");
    const crc=crc32(file.bytes);
    const local=new Uint8Array(30+name.length);
    const lv=new DataView(local.buffer);
    u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x800);u16(lv,8,0);
    u32(lv,14,crc);u32(lv,18,file.bytes.length);u32(lv,22,file.bytes.length);
    u16(lv,26,name.length);local.set(name,30);
    // Convert to owned ArrayBuffers: BlobPart must not carry SharedArrayBuffer-like types.
    const ownedBytes=new Uint8Array(file.bytes.byteLength);
    ownedBytes.set(file.bytes);
    chunks.push(local.buffer,ownedBytes.buffer);
    const record=new Uint8Array(46+name.length);
    const rv=new DataView(record.buffer);
    u32(rv,0,0x02014b50);u16(rv,4,20);u16(rv,6,20);u16(rv,8,0x800);
    u32(rv,16,crc);u32(rv,20,file.bytes.length);u32(rv,24,file.bytes.length);
    u16(rv,28,name.length);u32(rv,42,offset);record.set(name,46);
    directory.push(record);
    offset+=local.length+file.bytes.length;
    centralSize+=record.length;
  }
  // Directory entries are typed as Uint8Array<ArrayBufferLike> by Node typings.
  // Copy into plain ArrayBuffer objects for the DOM Blob constructor.
  for(const entry of directory){
    const buffer=new ArrayBuffer(entry.byteLength);
    new Uint8Array(buffer).set(entry);
    chunks.push(buffer);
  }
  const end=new Uint8Array(22), ev=new DataView(end.buffer);
  u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);
  u32(ev,12,centralSize);u32(ev,16,offset);
  chunks.push(end.buffer);
  return new Blob(chunks,{type:"application/zip"});
}
