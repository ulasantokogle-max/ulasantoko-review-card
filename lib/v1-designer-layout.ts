export type V1DesignKey = "navy_left" | "navy_right" | "white_left" | "white_right";
export type V1QRMode = "rainbow" | "blue" | "black";
export type V1Side = "front" | "back";
export type V1Paper = "a3" | "a3plus";
export type V1Flip = "long" | "short";

export const V1_DESIGNS: {key: V1DesignKey; title: string; dark: boolean; qrLeft: boolean}[] = [
  {key:"navy_left",title:"1. Navy QR kiri",dark:true,qrLeft:true},
  {key:"navy_right",title:"2. Navy QR kanan",dark:true,qrLeft:false},
  {key:"white_right",title:"3. Putih QR kanan",dark:false,qrLeft:false},
  {key:"white_left",title:"4. Putih QR kiri",dark:false,qrLeft:true},
];

export type V1QRPlacement = {x: number; y: number; size: number};
export type V1CardData = {code: string; url: string};

export function v1DefaultPlacement(key: V1DesignKey): V1QRPlacement {
  return {x:key.endsWith("_left") ? 29 : 71,y:55,size:35};
}
export function v1SafePlacement(p: V1QRPlacement): V1QRPlacement {
  const size = Math.max(25, Math.min(43, Number(p.size) || 35));
  const half = size/2 + 3;
  return {
    size,
    x:Math.max(half, Math.min(100-half, Number(p.x) || 50)),
    y:Math.max(half, Math.min(100-half, Number(p.y) || 55)),
  };
}
export function v1PageLayout(paper: V1Paper) {
  return paper === "a3plus"
    ? {columns:3,rows:4,pageWidthMm:329,pageHeightMm:483,cardsPerPage:12}
    : {columns:3,rows:2,pageWidthMm:420,pageHeightMm:297,cardsPerPage:6};
}
/** Flip on the physical paper's long or short edge. Use all slots, even empty ones. */
export function v1MirrorSlot(slot: number,paper: V1Paper,flip: V1Flip):number {
  const {columns,rows,cardsPerPage}=v1PageLayout(paper);
  if (!Number.isInteger(slot) || slot < 0 || slot >= cardsPerPage) throw new Error("Invalid print slot");
  const row=Math.floor(slot/columns);
  const col=slot%columns;
  const flipColumn = paper === "a3plus" ? flip==="long" : flip==="short";
  return (flipColumn ? row : rows-1-row)*columns + (flipColumn ? columns-1-col : col);
}
/** Never allow V3/WiV1 origins into a printed V1 QR. */
export function v1CardUrl(code:string):string {
  if (!/^ULAS-\d{4,}$/.test(code)) throw new Error("Kode V1 tidak valid.");
  return "https://app.ulasantoko.space/r-v1/" + encodeURIComponent(code);
}
