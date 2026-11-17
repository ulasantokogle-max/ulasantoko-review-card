"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Card = { code: string; url: string };
const BASE = "https://app.ulasantoko.space/r-v1/";

function escapeHtml(input: string) {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}
async function qrImage(url: string, mode: string) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    width: 480, margin: 4, errorCorrectionLevel: "H",
    color: { dark: mode === "blue" ? "#123b78" : mode === "black" ? "#000000" : "#172f55", light: "#ffffff" },
  });
  if (mode === "rainbow") {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        if (image.data[idx] < 160) {
          const p = x / canvas.width;
          // Dark, high-contrast rainbow palette, keeping white background intact.
          const stops = [[105,35,115],[27,67,150],[0,99,108],[98,58,129]];
          const v = p * 3; const i = Math.min(2, Math.floor(v)); const t = v - i;
          for (let c = 0; c < 3; c++) image.data[idx+c] = Math.round(stops[i][c]*(1-t)+stops[i+1][c]*t);
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  return canvas.toDataURL("image/png");
}

export default function BulkDesignerV1Page() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [mode, setMode] = useState("rainbow");
  const [doubleSided, setDoubleSided] = useState(true);
  const [duplexFlip, setDuplexFlip] = useState<"long" | "short">("long");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/provider/session", { cache: "no-store" })
      .then(r => r.json()).then(d => setAuthenticated(d.authenticated === true))
      .catch(() => setAuthenticated(false)).finally(() => setChecking(false));
  }, []);

  async function loadCsv(file: File) {
    try {
      const text = (await file.text()).replace(/^\ufeff/, "");
      if (file.size > 1_000_000) throw new Error("CSV terlalu besar (maksimal 1 MB).");
      const lines = text.split(/\r?\n/);
      const codes = Array.from(new Set(lines
        .map(row => row.match(/ULAS-\d{5,}/i)?.[0].toUpperCase())
        .filter((value): value is string => !!value)));
      if (!codes.length || codes.length > 200) throw new Error("CSV harus berisi 1–200 kode kartu ULAS-xxxxx.");
      setCards(codes.map(code => ({ code, url: BASE + encodeURIComponent(code) })));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "CSV tidak dapat dibaca."); }
  }

  async function printCards() {
    if (!cards.length || busy) return;
    setBusy(true); setError("");
    // Open the window synchronously within the button click so pop-up blockers don't intercept it.
    const win = window.open("", "_blank");
    if (!win) { setError("Izinkan pop-up untuk membuat PDF."); setBusy(false); return; }
    try {
      win.document.write("<!doctype html><html><head><title>Menyiapkan desain V1...</title></head><body><p>Menyiapkan desain kartu...</p></body></html>");
      const images = await Promise.all(cards.map(c => qrImage(c.url, mode)));
      const render = (c: Card, qr: string, back: boolean) => {
        const qrPart = '<img class="qr" alt="QR code" src="' + qr + '">';
        const nfcPart = '<div class="nfc"><span class="waves">)))</span><strong>TAP NFC</strong></div>';
        return '<article class="card"><header><b>YukReview.id</b><span>GOOGLE REVIEW</span></header>' +
          '<h2>' + (back ? 'Terima kasih atas ulasan Anda' : 'Bagikan pengalaman Anda') + '</h2>' +
          '<div class="middle">' + (back ? qrPart+nfcPart : nfcPart+qrPart) + '</div>' +
          '<p>Scan QR atau Tap NFC</p><small>' + escapeHtml(c.code) + '</small></article>';
      };
      let sheets = "";
      for (let i = 0; i < cards.length; i += 6) {
        // Keep all 6 slots so partial pages also register correctly on the back.
        const slots = Array.from({ length: 6 }, (_, j) => cards[i+j] ?? null);
        const renderSlot = (index: number, back: boolean) => {
          const c = slots[index];
          return c ? render(c, images[i+index], back)
            : '<article class="card empty"></article>';
        };
        sheets += '<section class="sheet">' +
          slots.map((_, j) => renderSlot(j, false)).join("") +
          '</section>';
        if (doubleSided) {
          const mirror = (j: number) => {
            const row = Math.floor(j / 3), col = j % 3;
            return duplexFlip === "long" ? (1-row)*3+col : row*3+(2-col);
          };
          sheets += '<section class="sheet back">' +
            slots.map((_, j) => renderSlot(mirror(j), true)).join("") +
            '</section>';
        }
      }
      const css = '@page{size:A3 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#14345e;background:white}.sheet{width:100%;display:grid;grid-template-columns:repeat(3,100mm);grid-template-rows:repeat(2,100mm);gap:3mm;justify-content:center;break-after:page;page-break-after:always}.card{height:100mm;width:100mm;border:0.25mm solid #d4dce5;padding:7mm;position:relative;overflow:hidden;break-inside:avoid}.card header{display:flex;align-items:center;justify-content:space-between;font-size:10pt}.card header span{font-size:6pt;letter-spacing:0.7pt}.card h2{font-size:14pt;text-align:center;margin:9mm 0 5mm}.middle{display:flex;align-items:center;justify-content:space-around;height:45mm}.qr{height:39mm;width:39mm;image-rendering:auto}.nfc{text-align:center;width:33mm}.waves{font-size:25pt;display:block}.nfc strong{font-size:10pt}.card p{font-size:10pt;text-align:center;margin:3mm 0}.card small{position:absolute;right:7mm;bottom:5mm;font-size:7pt}.back .card{border-style:dashed}.sheet:last-child{break-after:auto;page-break-after:auto}@media screen{body{padding:10mm;background:#eee}.sheet{background:white;margin:0 auto 10mm;max-width:404mm;min-height:280mm;padding-top:4mm;box-shadow:0 1px 8px #ddd}}';
      win.document.open();
      win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>V1 Bulk Designer</title><style>'+css+'</style></head><body>'+sheets+'</body></html>');
      win.document.close();
      win.focus();
    } catch (e) {
      win.close();
      setError(e instanceof Error ? e.message : "Gagal membuat desain.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-gray-50 px-5 py-10">
    <section className="mx-auto max-w-3xl rounded-3xl border bg-white p-7 shadow-sm">
      <p className="text-xs font-bold text-blue-700">ULASANTOKO V1 · PROVIDER</p>
      <h1 className="mt-2 text-2xl font-bold">Bulk Designer V1</h1>
      <p className="mt-2 text-sm text-gray-600">Import CSV Bulk Create untuk desain kartu 10 × 10 cm, 6 kartu per lembar A3 landscape.</p>
      {checking ? <p className="mt-5">Memeriksa sesi Provider...</p>
        : !authenticated ? <p className="mt-5">Silakan <a href="/admin/provider" className="text-blue-700 underline">login Provider</a> terlebih dahulu.</p>
        : <>
          <label htmlFor="csv" className="mt-6 block text-sm font-semibold">CSV kartu V1</label>
          <input id="csv" type="file" accept=".csv,text/csv" className="my-3 block w-full"
            onChange={e => {const file=e.target.files?.[0]; if(file) void loadCsv(file);}}/>
          <label htmlFor="color" className="block text-sm font-semibold">Pilihan QR</label>
          <select id="color" className="my-2 rounded-xl border p-3" value={mode} onChange={e=>setMode(e.target.value)}>
            <option value="rainbow">Rainbow (gradasi kontras)</option>
            <option value="blue">Biru</option><option value="black">Gelap</option>
          </select>
          <label className="my-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={doubleSided} onChange={e=>setDoubleSided(e.target.checked)}/>
            Dua sisi (QR dan NFC bertukar posisi di belakang)
          </label>
          {doubleSided && <>
            <label htmlFor="duplex" className="block text-sm font-semibold">Arah balik kertas untuk sisi belakang</label>
            <select id="duplex" value={duplexFlip}
              onChange={e=>setDuplexFlip(e.target.value as "long"|"short")}
              className="my-2 rounded-xl border p-3">
              <option value="long">Balik sisi panjang (long edge)</option>
              <option value="short">Balik sisi pendek (short edge)</option>
            </select>
            <p className="mb-3 text-xs text-gray-600">Wajib uji 1 lembar dan cocokkan QR/NFC kedua sisi dengan kode kartu yang sama sebelum cetak massal.</p>
          </>}
          <p className="mb-4 text-sm text-gray-600">{cards.length} kartu siap didesain.</p>
          <button disabled={!cards.length || busy} onClick={printCards}
            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? "Menyiapkan..." : "Buka Desain / Simpan PDF"}
          </button>
          <p className="mt-3 text-xs text-gray-500">
            Pada jendela desain, tekan Ctrl/Cmd+P, pilih Save as PDF, kertas A3 landscape, skala 100%.
            Lakukan uji scan dan uji registrasi depan/belakang sebelum produksi massal.
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </>}
      <nav className="mt-8 flex flex-wrap gap-5 text-sm text-blue-700">
        <a href="/admin/provider">Provider V1</a><a href="/admin/provider/bulk-create">Bulk Create</a>
      </nav>
    </section>
  </main>;
}
